"""Server-side business rules (spec section 3)."""
from collections import defaultdict
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Invoice


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
