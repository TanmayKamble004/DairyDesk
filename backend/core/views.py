"""API views (spec section 4)."""
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Customer, Invoice, Order, Product, StockBatch
from .permissions import IsOwner, is_owner
from .serializers import (
    CustomerSerializer,
    InvoiceSerializer,
    LoginSerializer,
    OrderSerializer,
    OrderStatusSerializer,
    ProductSerializer,
    StockBatchSerializer,
)
from .services import ensure_invoice

STATUS_SEVERITY = [StockBatch.STATUS_EXPIRED, StockBatch.STATUS_AGEING, StockBatch.STATUS_FRESH]


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class ProductViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer


class StockBatchViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """POST = receive new stock."""

    queryset = StockBatch.objects.select_related("product")
    serializer_class = StockBatchSerializer


class CustomerViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Order.objects.select_related("customer").prefetch_related("items__product")
    serializer_class = OrderSerializer

    def partial_update(self, request, *args, **kwargs):
        """PATCH — status transition. Delivering auto-creates the invoice."""
        order = self.get_object()
        serializer = OrderStatusSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save()
            if order.status == Order.Status.DELIVERED:
                ensure_invoice(order)
        return Response(OrderSerializer(order, context=self.get_serializer_context()).data)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Owner only — staff must not see financial data."""

    queryset = Invoice.objects.select_related("order__customer")
    serializer_class = InvoiceSerializer
    permission_classes = [IsOwner]


class InventoryView(APIView):
    """Per-product stock summary consumed by the 3D shelf.

    Batches that were fully deducted (quantity 0) are ignored; expired batches
    are counted but excluded from available quantity and nearest expiry.
    """

    def get(self, request):
        rows = []
        for product in Product.objects.prefetch_related("batches"):
            counts = {"fresh": 0, "ageing": 0, "expired": 0}
            available = 0
            nearest_expiry = None
            for batch in product.batches.all():
                if batch.quantity == 0:
                    continue
                status = batch.expiry_status
                counts[status] += 1
                if status != StockBatch.STATUS_EXPIRED:
                    available += batch.quantity
                    if nearest_expiry is None or batch.expiry_date < nearest_expiry:
                        nearest_expiry = batch.expiry_date
            worst_status = next((s for s in STATUS_SEVERITY if counts[s]), None)
            rows.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "category": product.category,
                    "unit": product.unit,
                    "available_quantity": available,
                    "batch_counts": counts,
                    "worst_status": worst_status,
                    "nearest_expiry": nearest_expiry,
                }
            )
        return Response(rows)


class DashboardView(APIView):
    """KPI object for the dashboard. Financial KPIs are included for owners only."""

    def get(self, request):
        today = timezone.localdate()

        products_ageing = set()
        products_expired = set()
        stock_value = 0
        for batch in StockBatch.objects.filter(quantity__gt=0).select_related("product"):
            status = batch.expiry_status
            if status == StockBatch.STATUS_AGEING:
                products_ageing.add(batch.product_id)
            elif status == StockBatch.STATUS_EXPIRED:
                products_expired.add(batch.product_id)
            if status != StockBatch.STATUS_EXPIRED:
                stock_value += batch.quantity * batch.product.selling_price

        todays_orders = Order.objects.filter(created_at__date=today)

        data = {}
        viewer_is_owner = is_owner(request.user)
        if viewer_is_owner:
            # Available stock valued at selling price (non-expired batches only).
            data["total_available_stock_value"] = str(stock_value)
        data["products_ageing_count"] = len(products_ageing)
        data["products_expired_count"] = len(products_expired)
        data["todays_order_count"] = todays_orders.count()
        if viewer_is_owner:
            sales_total = sum(
                (
                    item.line_total
                    for order in todays_orders.prefetch_related("items")
                    for item in order.items.all()
                ),
                0,
            )
            data["todays_sales_total"] = str(sales_total)
            data["unpaid_invoice_count"] = Invoice.objects.exclude(
                status=Invoice.Status.PAID
            ).count()
        return Response(data)
