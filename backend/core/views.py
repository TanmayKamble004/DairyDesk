"""API views (spec section 4)."""
from django.db import transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Customer, Invoice, Order, Product, StockBatch, StockDisposal
from .permissions import IsOwner
from .serializers import (
    CustomerSerializer,
    DisposeStockSerializer,
    InvoiceSerializer,
    LoginSerializer,
    OrderSerializer,
    OrderStatusSerializer,
    ProductSerializer,
    StockBatchSerializer,
    StockDisposalSerializer,
)
from .services import (
    dashboard_data,
    dispose_batch,
    ensure_invoice,
    resolve_date_range,
)

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

    @action(detail=True, methods=["post"], url_path="dispose")
    def dispose(self, request, pk=None):
        """POST /api/stock-batches/{id}/dispose/ — write off expired stock."""
        batch = self.get_object()
        serializer = DisposeStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        disposal = dispose_batch(
            batch_id=batch.pk,
            quantity=serializer.validated_data["quantity"],
            reason=serializer.validated_data["reason"],
            notes=serializer.validated_data["notes"],
            user=request.user,
        )
        return Response(
            StockDisposalSerializer(disposal).data, status=status.HTTP_201_CREATED
        )


class StockDisposalViewSet(viewsets.ReadOnlyModelViewSet):
    """Disposal history. Write-offs happen through the batch's dispose action."""

    queryset = StockDisposal.objects.select_related("batch__product", "disposed_by")
    serializer_class = StockDisposalSerializer


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

    Only batches with quantity > 0 are active stock: a batch that was fully
    deducted by an order or fully written off by a disposal drops out of every
    figure here, including the expired counts and the crate heights on the
    shelf. Disposals therefore need no special handling — they shrink
    StockBatch.quantity, and a zero-quantity batch is simply skipped.

    Expired batches that still hold stock are counted (so the shelf shows red)
    and reported as `expired_quantity`, the amount awaiting disposal, but they
    never contribute to available quantity or nearest expiry.
    """

    def get(self, request):
        rows = []
        for product in Product.objects.prefetch_related("batches"):
            counts = {"fresh": 0, "ageing": 0, "expired": 0}
            available = 0
            expired_quantity = 0
            nearest_expiry = None
            for batch in product.batches.all():
                if batch.quantity == 0:
                    continue
                status = batch.expiry_status
                counts[status] += 1
                if status == StockBatch.STATUS_EXPIRED:
                    expired_quantity += batch.quantity
                else:
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
                    "expired_quantity": expired_quantity,
                    "batch_counts": counts,
                    "worst_status": worst_status,
                    "nearest_expiry": nearest_expiry,
                }
            )
        return Response(rows)


class DashboardView(APIView):
    """KPIs and summary lists. Financial data is included for owners only.

    Supports `?range=today|7d|30d` or a custom `?start=&end=` pair; the range
    scopes the sales, order and disposal figures. Stock figures are always
    "right now" — a shelf doesn't have a date range.
    """

    def get(self, request):
        date_range = resolve_date_range(
            request.query_params.get("range"),
            request.query_params.get("start"),
            request.query_params.get("end"),
        )
        return Response(dashboard_data(user=request.user, date_range=date_range))
