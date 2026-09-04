"""Server-side business rules (spec section 3)."""
from collections import defaultdict
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Invoice, Product, PurchaseOrder


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


def ensure_invoice(order):
    """Create the order's invoice if it doesn't exist yet (idempotent).

    total_amount = sum of quantity x unit_price over the order's items.
    """
    total = sum(
        (item.quantity * item.unit_price for item in order.items.all()),
        Decimal("0"),
    )
    invoice, _ = Invoice.objects.get_or_create(
        order=order, defaults={"total_amount": total}
    )
    return invoice
