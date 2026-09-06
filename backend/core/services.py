"""Server-side business rules (spec section 3)."""
from collections import defaultdict
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from . import events
from .models import Invoice, LowStockAlertState, Product, PurchaseOrder

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


def is_low_stock(product):
    """Whether this product should be alerting its supplier right now.

    Uses the same `<=` comparison as raise_auto_reorders and Product.stock_status
    — a product sitting exactly on its threshold already counts as low
    everywhere else in this app, and a second definition of "low" that disagreed
    with the badge on the Products page would be a bug waiting to happen.

    Unlike raise_auto_reorders this does *not* require `auto_reorder`: see
    NOTIFY_ONLY_AUTO_REORDER in settings for the reasoning.
    """
    if product.supplier_id is None:
        return False
    # A threshold of 0 is the default, and means nobody has set one. Alerting on
    # it would email a supplier the moment a product sold out for the first time.
    if product.reorder_threshold <= 0:
        return False
    if settings.NOTIFY_ONLY_AUTO_REORDER and not product.auto_reorder:
        return False
    return product.available_quantity <= product.reorder_threshold


def record_low_stock_events(products):
    """Write a LOW_STOCK event for each product that has *just* gone low.

    Edge-triggered against LowStockAlertState: crossing the threshold writes one
    event, staying below it writes nothing, and recovering above it re-arms so
    the next dip alerts again. Level-triggering here would put an event in the
    outbox for every sale of an already-low product.

    Runs inside the caller's transaction, so the event and the stock change that
    caused it commit together or not at all.
    """
    if not settings.EVENTS_ENABLED:
        return []

    queued = []
    for product in products:
        state, _ = LowStockAlertState.objects.get_or_create(product=product)
        low = is_low_stock(product)
        if low and not state.is_low:
            queued.append(
                events.queue_event(
                    events.LOW_STOCK,
                    settings.LOW_STOCK_ROUTING_KEY,
                    events.build_low_stock_payload(product),
                )
            )
            state.is_low = True
            state.last_event_at = timezone.now()
            state.save(update_fields=["is_low", "last_event_at"])
        elif not low and state.is_low:
            # Restocked. Re-arm, so the next time it runs down the supplier
            # hears about it.
            state.is_low = False
            state.save(update_fields=["is_low"])
    return queued


def on_stock_changed(products):
    """Everything that must happen when a product's stock or thresholds move.

    One entry point rather than two, because the two reactions have to see the
    same stock level: if a caller ran only one of them the app would raise
    purchase orders nobody was told about, or vice versa.
    """
    orders = raise_auto_reorders(products)
    record_low_stock_events(products)
    return orders


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
