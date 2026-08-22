"""Server-side business rules (spec section 3)."""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import serializers

from .models import (
    AGEING_THRESHOLD_DAYS,
    LOW_STOCK_THRESHOLD,
    Invoice,
    Order,
    OrderItem,
    Product,
    StockBatch,
    StockDisposal,
    User,
)


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


def dispose_batch(*, batch_id, quantity, reason, notes="", user):
    """Write off `quantity` units of an expired batch, atomically.

    The batch row is locked for the whole check-and-decrement, so two
    concurrent disposals can never take more than the batch holds. Only
    expired batches may be disposed of; quantity must be positive and no
    larger than what the batch still has. Returns the StockDisposal record.

    Raises a ValidationError (rendered as a 400 by DRF) for every rule
    breach, so callers don't have to translate exceptions.
    """
    with transaction.atomic():
        batch = (
            StockBatch.objects.select_for_update()
            .select_related("product")
            .get(pk=batch_id)
        )

        if batch.expiry_status != StockBatch.STATUS_EXPIRED:
            raise serializers.ValidationError(
                {
                    "batch": [
                        f"Only expired batches can be disposed of; this batch is "
                        f"'{batch.expiry_status}' (expires {batch.expiry_date})."
                    ]
                }
            )
        if quantity <= 0:
            raise serializers.ValidationError(
                {"quantity": ["Disposal quantity must be greater than zero."]}
            )
        if quantity > batch.quantity:
            raise serializers.ValidationError(
                {
                    "quantity": [
                        f"Cannot dispose of {quantity} — the batch has "
                        f"{batch.quantity} remaining."
                    ]
                }
            )

        disposal = StockDisposal.objects.create(
            batch=batch,
            quantity=quantity,
            reason=reason,
            notes=notes,
            disposed_by=user,
        )
        # The batch row itself is kept; only its quantity shrinks.
        batch.quantity -= quantity
        batch.save(update_fields=["quantity"])

    return disposal


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


# --- Dashboard ------------------------------------------------------------
#
# Everything below builds the dashboard read-model. It is deliberately written
# as database aggregation rather than Python loops over batches: the payload
# costs a fixed number of queries no matter how many products, batches or
# orders exist.

MONEY = DecimalField(max_digits=14, decimal_places=2)
# Two decimal places so an empty result formats like a populated one ("0.00").
ZERO_MONEY = Value(Decimal("0.00"), output_field=MONEY)
# Rows shown in each "recent" / "needs attention" list on the dashboard.
DASHBOARD_LIST_LIMIT = 8

# range key -> (label, days of history including today)
DASHBOARD_RANGES = {
    "today": ("Today", 1),
    "7d": ("Last 7 days", 7),
    "30d": ("Last 30 days", 30),
}


def _sum_qty(queryset):
    return queryset.aggregate(total=Coalesce(Sum("quantity"), 0))["total"]


def _sum_money(queryset, expression):
    return queryset.aggregate(
        total=Coalesce(Sum(expression, output_field=MONEY), ZERO_MONEY)
    )["total"]


def resolve_date_range(range_key=None, start=None, end=None):
    """Turn the dashboard's query params into a concrete inclusive date range.

    Accepts either a named range (`today`, `7d`, `30d`) or a custom
    `start`/`end` pair; a custom pair wins if both are given. Raises a
    ValidationError for anything malformed, so the view stays thin.
    """
    today = timezone.localdate()

    if start or end:
        if not (start and end):
            raise serializers.ValidationError(
                {"range": ["A custom range needs both 'start' and 'end'."]}
            )
        start_date, end_date = parse_date(start), parse_date(end)
        if start_date is None or end_date is None:
            raise serializers.ValidationError(
                {"range": ["Dates must be in YYYY-MM-DD format."]}
            )
        if start_date > end_date:
            raise serializers.ValidationError(
                {"range": ["'start' must not be after 'end'."]}
            )
        return {
            "key": "custom",
            "label": f"{start_date:%d %b %Y} - {end_date:%d %b %Y}",
            "start": start_date,
            "end": end_date,
        }

    key = range_key or "today"
    if key not in DASHBOARD_RANGES:
        raise serializers.ValidationError(
            {
                "range": [
                    f"Unknown range '{key}'. Use one of "
                    f"{', '.join(DASHBOARD_RANGES)}, or a custom start & end."
                ]
            }
        )
    label, days = DASHBOARD_RANGES[key]
    return {
        "key": key,
        "label": label,
        "start": today - timedelta(days=days - 1),
        "end": today,
    }


def dashboard_data(*, user, date_range):
    """Build the dashboard payload for `user` over `date_range`.

    Financial figures — stock value, sales, invoices, disposal value — are
    omitted entirely for staff rather than blanked out, so they never leave
    the server. Stock KPIs are always present: staff need them to do the job.
    """
    today = timezone.localdate()
    ageing_cutoff = today + timedelta(days=AGEING_THRESHOLD_DAYS)
    start, end = date_range["start"], date_range["end"]
    is_owner = getattr(user, "role", None) == User.Role.OWNER

    # A batch counts as stock only while it still holds units: disposals and
    # order deductions drop a batch out of every figure by zeroing quantity.
    live = StockBatch.objects.filter(quantity__gt=0)
    sellable = live.filter(expiry_date__gte=today)
    batch_value = F("quantity") * F("product__selling_price")

    available_quantity = _sum_qty(sellable)
    near_expiry_quantity = _sum_qty(sellable.filter(expiry_date__lte=ageing_cutoff))
    expired_quantity = _sum_qty(live.filter(expiry_date__lt=today))

    # Products annotated with their sellable quantity — one query, no N+1.
    sellable_batch = Q(batches__quantity__gt=0, batches__expiry_date__gte=today)
    products = list(
        Product.objects.annotate(
            available=Coalesce(Sum("batches__quantity", filter=sellable_batch), 0)
        ).order_by("available", "name")
    )
    low_stock = [p for p in products if p.available <= LOW_STOCK_THRESHOLD]

    period_orders = Order.objects.filter(
        created_at__date__gte=start, created_at__date__lte=end
    )
    period_disposals = StockDisposal.objects.filter(
        disposed_at__date__gte=start, disposed_at__date__lte=end
    )

    kpis = {
        "total_available_quantity": available_quantity,
        "low_stock_count": len(low_stock),
        "expired_quantity": expired_quantity,
        "near_expiry_quantity": near_expiry_quantity,
        "pending_order_count": Order.objects.filter(status=Order.Status.PENDING).count(),
        "period_order_count": period_orders.count(),
        "products_ageing_count": (
            sellable.filter(expiry_date__lte=ageing_cutoff)
            .values("product_id")
            .distinct()
            .count()
        ),
        "products_expired_count": (
            live.filter(expiry_date__lt=today).values("product_id").distinct().count()
        ),
    }

    if is_owner:
        kpis["total_available_stock_value"] = str(_sum_money(sellable, batch_value))
        kpis["period_sales_total"] = str(
            _sum_money(
                OrderItem.objects.filter(
                    order__created_at__date__gte=start,
                    order__created_at__date__lte=end,
                ),
                F("quantity") * F("unit_price"),
            )
        )
        kpis["unpaid_invoice_count"] = Invoice.objects.exclude(
            status=Invoice.Status.PAID
        ).count()
        kpis["disposed_quantity"] = _sum_qty(period_disposals)
        kpis["disposed_value"] = str(
            _sum_money(
                period_disposals, F("quantity") * F("batch__product__selling_price")
            )
        )

    # Expired first, then nearest expiry — the batches needing action today.
    expiring_batches = [
        {
            "id": batch.id,
            "product_id": batch.product_id,
            "product_name": batch.product.name,
            "unit": batch.product.unit,
            "quantity": batch.quantity,
            "expiry_date": batch.expiry_date,
            "days_left": (batch.expiry_date - today).days,
            "status": batch.expiry_status,
        }
        for batch in live.filter(expiry_date__lte=ageing_cutoff)
        .select_related("product")
        .order_by("expiry_date", "id")[:DASHBOARD_LIST_LIMIT]
    ]

    low_stock_products = [
        {
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "unit": product.unit,
            "available_quantity": product.available,
        }
        for product in low_stock[:DASHBOARD_LIST_LIMIT]
    ]

    recent_orders = []
    for order in (
        Order.objects.select_related("customer")
        .annotate(
            item_count=Count("items"),
            order_total=Coalesce(
                Sum(F("items__quantity") * F("items__unit_price"), output_field=MONEY),
                ZERO_MONEY,
            ),
        )
        .order_by("-created_at")[:DASHBOARD_LIST_LIMIT]
    ):
        row = {
            "id": order.id,
            "customer_name": order.customer.name,
            "status": order.status,
            "created_at": order.created_at,
            "item_count": order.item_count,
        }
        if is_owner:
            row["total"] = str(order.order_total)
        recent_orders.append(row)

    recent_disposals = []
    for disposal in StockDisposal.objects.select_related(
        "batch__product", "disposed_by"
    ).order_by("-disposed_at", "-id")[:DASHBOARD_LIST_LIMIT]:
        row = {
            "id": disposal.id,
            "product_name": disposal.batch.product.name,
            "unit": disposal.batch.product.unit,
            "quantity": disposal.quantity,
            "reason": disposal.reason,
            "disposed_at": disposal.disposed_at,
            "disposed_by_username": disposal.disposed_by.username,
        }
        if is_owner:
            row["value"] = str(disposal.quantity * disposal.batch.product.selling_price)
        recent_disposals.append(row)

    category_breakdown = []
    for group in (
        Product.objects.values("category")
        .annotate(
            product_count=Count("id", distinct=True),
            available=Coalesce(Sum("batches__quantity", filter=sellable_batch), 0),
            value=Coalesce(
                Sum(
                    F("batches__quantity") * F("selling_price"),
                    filter=sellable_batch,
                    output_field=MONEY,
                ),
                ZERO_MONEY,
            ),
        )
        .order_by("category")
    ):
        row = {
            "category": group["category"],
            "product_count": group["product_count"],
            "available_quantity": group["available"],
        }
        if is_owner:
            row["stock_value"] = str(group["value"])
        category_breakdown.append(row)

    data = {
        "range": {
            "key": date_range["key"],
            "label": date_range["label"],
            "start": start,
            "end": end,
        },
        "kpis": kpis,
        "expiring_batches": expiring_batches,
        "low_stock_products": low_stock_products,
        "recent_orders": recent_orders,
        "recent_disposals": recent_disposals,
        "category_breakdown": category_breakdown,
    }

    if is_owner:
        period_invoices = Invoice.objects.filter(
            order__created_at__date__gte=start, order__created_at__date__lte=end
        )
        invoiced = period_invoices.aggregate(
            total=Coalesce(Sum("total_amount"), ZERO_MONEY),
            paid=Coalesce(Sum("paid_amount"), ZERO_MONEY),
        )
        order_count = kpis["period_order_count"]
        sales_total = Decimal(kpis["period_sales_total"])
        data["sales_summary"] = {
            "order_count": order_count,
            "sales_total": str(sales_total),
            "average_order_value": str(
                (sales_total / order_count).quantize(Decimal("0.01"))
                if order_count
                else Decimal("0.00")
            ),
            "delivered_count": period_orders.filter(
                status=Order.Status.DELIVERED
            ).count(),
            "invoiced_total": str(invoiced["total"]),
            "collected_total": str(invoiced["paid"]),
            "outstanding_total": str(invoiced["total"] - invoiced["paid"]),
        }

    return data
