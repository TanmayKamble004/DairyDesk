"""Server-side business rules (spec section 3)."""
from collections import defaultdict
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from .models import Invoice, Product, PurchaseOrder

# Bill numbers look like INV-2026-0001 and restart each calendar year, the way
# a shop's bill book does.
INVOICE_NUMBER_PREFIX = "INV"
INVOICE_NUMBER_WIDTH = 4
# Retries for the (rare) case of two deliveries confirmed at the same instant.
INVOICE_NUMBER_ATTEMPTS = 5


def deduct_stock_fifo(product_quantities):
    """Deduct quantities from each product's oldest non-expired batches (FIFO).

    `product_quantities` is an iterable of (product, quantity) pairs; multiple
    pairs for the same product are combined. If any product has insufficient
    available (non-expired) stock, raises a ValidationError naming every short
    product and deducts nothing. Callers must wrap this in a transaction so a
    failure elsewhere in order creation also rolls the deduction back.
    """
    today = timezone.localdate()
    needed = defaultdict(int)
    for product, quantity in product_quantities:
        needed[product] += quantity

    shortages = []
    deductions = []
    for product, quantity in needed.items():
        batches = list(
            product.batches.select_for_update()
            .filter(expiry_date__gte=today, quantity__gt=0)
            .order_by("received_date", "expiry_date", "id")
        )
        available = sum(batch.quantity for batch in batches)
        if available < quantity:
            shortages.append(
                f"'{product.name}' (requested {quantity}, available {available})"
            )
            continue
        remaining = quantity
        for batch in batches:
            take = min(batch.quantity, remaining)
            deductions.append((batch, take))
            remaining -= take
            if remaining == 0:
                break

    if shortages:
        raise serializers.ValidationError(
            {"items": [f"Insufficient stock for {'; '.join(shortages)}."]}
        )

    for batch, take in deductions:
        batch.quantity -= take
        batch.save(update_fields=["quantity"])


def open_purchase_order(product):
    """The product's outstanding purchase order, if it has one."""
    return product.purchase_orders.filter(status=PurchaseOrder.Status.PLACED).first()


def raise_auto_reorders(products=None):
    """Raise a purchase order for each auto-reorder product at/below threshold.

    Returns the orders it created. Deliberately skips a product that already
    has one outstanding: without that, every sale below the threshold would
    raise another order for stock that is already on its way.

    `products` limits the sweep to specific rows; omit it to check them all.
    """
    if products is None:
        products = Product.objects.filter(auto_reorder=True).select_related("supplier")

    created = []
    for product in products:
        if not product.auto_reorder or product.supplier_id is None:
            continue
        if product.reorder_quantity <= 0:
            continue
        if product.available_quantity > product.reorder_threshold:
            continue
        if open_purchase_order(product):
            continue
        created.append(
            PurchaseOrder.objects.create(
                supplier=product.supplier,
                product=product,
                quantity=product.reorder_quantity,
            )
        )
    return created


def fulfil_purchase_orders(product):
    """Close a product's outstanding orders once its stock is received.

    Receiving a batch is the only signal this app has that a supplier
    delivered, and leaving the order open would block every later reorder.
    """
    return product.purchase_orders.filter(status=PurchaseOrder.Status.PLACED).update(
        status=PurchaseOrder.Status.RECEIVED
    )


def next_invoice_number(when=None):
    """The next bill number for `when`'s year, as INV-<year>-<sequence>.

    Reads the newest invoice of that year rather than counting them, so a
    deleted bill never causes a number to be handed out twice. Ordering is by
    id, not by the number string: ids are assigned in creation order, while a
    lexical sort on the number would put "10000" before "9999" once a year runs
    past the padding width.

    This only proposes a number — uniqueness is the column's job. See
    ensure_invoice for the collision handling.
    """
    year = (when or timezone.localdate()).year
    prefix = f"{INVOICE_NUMBER_PREFIX}-{year}-"
    latest = (
        Invoice.objects.filter(number__startswith=prefix)
        .order_by("-id")
        .values_list("number", flat=True)
        .first()
    )
    sequence = int(latest.rsplit("-", 1)[1]) + 1 if latest else 1
    return f"{prefix}{sequence:0{INVOICE_NUMBER_WIDTH}d}"


def ensure_invoice(order):
    """Create the order's invoice if it doesn't exist yet (idempotent).

    total_amount = sum of quantity x unit_price over the order's items.
    """
    existing = Invoice.objects.filter(order=order).first()
    if existing:
        return existing

    total = sum(
        (item.quantity * item.unit_price for item in order.items.all()),
        Decimal("0"),
    )

    for attempt in range(INVOICE_NUMBER_ATTEMPTS):
        try:
            # Its own savepoint: callers run inside a transaction, and an
            # IntegrityError would otherwise poison the whole thing rather than
            # letting us try the next number.
            with transaction.atomic():
                return Invoice.objects.create(
                    order=order, total_amount=total, number=next_invoice_number()
                )
        except IntegrityError:
            # Either another delivery took the number we picked, or it invoiced
            # this same order first. The second case is already the answer.
            raced = Invoice.objects.filter(order=order).first()
            if raced:
                return raced
            if attempt == INVOICE_NUMBER_ATTEMPTS - 1:
                raise
