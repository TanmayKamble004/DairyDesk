"""API views (spec section 4)."""
import logging

from django.db import transaction
from django.db.models import Case, IntegerField, Value, When
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Customer,
    Invoice,
    Order,
    Product,
    PurchaseOrder,
    StockBatch,
    Supplier,
    User,
)
from .permissions import CanManageStaff, IsOwner, is_owner
from .serializers import (
    CustomerSerializer,
    InvoiceSerializer,
    LoginSerializer,
    OrderSerializer,
    OrderStatusSerializer,
    ProductSerializer,
    PurchaseOrderSerializer,
    SecurityAnswerResetSerializer,
    SecurityQuestionSerializer,
    StaffPasswordSerializer,
    StaffSerializer,
    StockBatchDisposalSerializer,
    StockBatchSerializer,
    SupplierSerializer,
)
from .services import ensure_invoice

logger = logging.getLogger(__name__)

STATUS_SEVERITY = [StockBatch.STATUS_EXPIRED, StockBatch.STATUS_AGEING, StockBatch.STATUS_FRESH]

# One sentence for a wrong answer, an unknown username and a switched-off
# account alike. Telling them apart would make this endpoint a way to discover
# which accounts exist, and the person who genuinely forgot their password is
# no better off for knowing which half they got wrong.
RESET_REFUSED = (
    "That username and answer do not match. Check both, or ask an owner to "
    "reset the password from the Staff page."
)


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class PasswordResetThrottle(AnonRateThrottle):
    """Rate cap shared by both recovery endpoints.

    These are the only unauthenticated writes in the app, and what they accept
    is a guess at a credential. Uncapped, the security question is only as
    strong as how fast someone can POST at it — which is very fast. The rate
    itself lives in settings under this scope.
    """

    scope = "password_reset"


def recoverable_user(username):
    """The account this username may recover, or None — there is no third answer.

    Unknown username, no security question configured, and a disabled account
    all collapse to None so that every caller is forced to treat them alike.
    `is_active` belongs in that list as much as the question does: switching
    someone off is how this app ends an account (see StaffViewSet), and a
    recovery flow that let a disabled account set a fresh password would quietly
    undo that.
    """
    user = User.objects.filter(username=username.strip()).first()
    if user is None or not user.is_active or not user.has_security_question:
        return None
    return user


class SecurityQuestionView(APIView):
    """Step 1 — POST a username, get back the question to answer, or null.

    Anonymous by necessity: the person who needs this cannot sign in. `null`
    covers every case where recovery is unavailable, so the response reveals
    nothing about which usernames exist beyond the accounts an owner has
    deliberately set a question on.
    """

    # No authentication at all rather than the project defaults: these are for
    # people holding no credentials, and dropping SessionAuthentication also
    # drops its CSRF enforcement, which an anonymous POST cannot satisfy.
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = SecurityQuestionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = recoverable_user(serializer.validated_data["username"])
        return Response({"security_question": user.security_question if user else None})


class SecurityAnswerResetView(APIView):
    """Step 2 — a correct answer sets a new password.

    The answer is the credential here, so it is checked against a hash, capped
    by the throttle above, and never echoed back. What this endpoint cannot do
    is reveal the forgotten password: it is hashed and unreadable, and the only
    move available is replacing it — the same reasoning as the owner's
    set-password action.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = SecurityAnswerResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = recoverable_user(data["username"])
        if user is None:
            # Hash the answer against nobody before refusing. Skipping this
            # would return for an unknown username far faster than for a real
            # account with a wrong answer, and that gap is itself an
            # account-existence oracle. Django's own ModelBackend does the same.
            User().set_security_answer(data["answer"])
            logger.warning("Password reset refused: no recoverable account matched.")
            raise ValidationError({"detail": RESET_REFUSED})

        if not user.check_security_answer(data["answer"]):
            logger.warning("Password reset refused for %s: wrong answer.", user.username)
            raise ValidationError({"detail": RESET_REFUSED})

        user.set_password(data["password"])
        user.save(update_fields=["password"])
        # The one line an audit needs: this is the only way a password changes
        # without an owner signed in to have done it.
        logger.info("Password reset via security question for %s.", user.username)
        return Response({"detail": "Password updated. You can sign in with it now."})


class StaffViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Who can sign in, and as what. Owner-only, top to bottom.

    Deliberately no `destroy`: a staff member's name is attached to the orders
    and invoices they handled, so leavers are switched off (`is_active`), never
    removed. DELETE therefore answers 405 rather than 404 — the absence is the
    design, not an oversight.
    """

    serializer_class = StaffSerializer
    permission_classes = [CanManageStaff]
    # Owners first, then alphabetically — the shape the Staff table renders in.
    queryset = User.objects.annotate(
        role_rank=Case(
            When(role=User.Role.OWNER, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by("role_rank", "first_name", "username")

    def perform_update(self, serializer):
        """Guard the two edits that can lock the store out of its own admin."""
        staff = serializer.instance
        actor = self.request.user
        active = serializer.validated_data.get("is_active", staff.is_active)
        role = serializer.validated_data.get("role", staff.role)

        if staff.pk == actor.pk and (not active or role != User.Role.OWNER):
            raise ValidationError(
                {
                    "detail": (
                        "You cannot disable your own account or drop your own owner "
                        "role — you would lose this page along with it. Another owner "
                        "can do it for you."
                    )
                }
            )

        # Demoting or disabling the last owner leaves nobody able to manage
        # staff, add owners, or see the financial pages.
        loses_owner = staff.role == User.Role.OWNER and (
            role != User.Role.OWNER or not active
        )
        if loses_owner and not self._other_active_owners(staff).exists():
            raise ValidationError(
                {
                    "detail": (
                        f"'{staff.get_full_name() or staff.username}' is the only "
                        "active owner. Make someone else an owner first."
                    )
                }
            )

        serializer.save()

    @staticmethod
    def _other_active_owners(staff):
        return User.objects.filter(role=User.Role.OWNER, is_active=True).exclude(pk=staff.pk)

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, pk=None):
        """Someone forgot theirs; the owner sets a new one.

        Passwords are hashed and unreadable, so there is nothing to recover —
        replacing it is the only move available.
        """
        staff = self.get_object()
        serializer = StaffPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        staff.set_password(serializer.validated_data["password"])
        staff.save(update_fields=["password"])
        return Response(self.get_serializer(staff).data)


class ProductViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Product.objects.select_related("supplier")
    serializer_class = ProductSerializer

    def get_permissions(self):
        """Staff maintain the catalogue; only the owner removes from it.

        Deleting is the one irreversible action here — it takes the product's
        stock history with it — so it follows the same owner gate as the rest
        of this app's destructive/financial surface.
        """
        if self.action == "destroy":
            return [IsOwner()]
        return super().get_permissions()

    def perform_destroy(self, product):
        """Refuse deletions that would quietly destroy trading history.

        OrderItem.product is PROTECT, so an ordered product would raise
        ProtectedError and surface as a 500; batches are CASCADE, so stock rows
        would vanish without a word. Both are caught here as plain 400s.
        """
        order_count = product.order_items.count()
        if order_count:
            raise ValidationError(
                {
                    "detail": (
                        f"'{product.name}' appears on {order_count} order line(s) and "
                        "cannot be deleted. Its sales history depends on it."
                    )
                }
            )

        in_stock = sum(batch.quantity for batch in product.batches.all())
        if in_stock:
            raise ValidationError(
                {
                    "detail": (
                        f"'{product.name}' still has {in_stock} unit(s) across "
                        f"{product.batches.count()} stock batch(es). Clear the stock "
                        "before deleting the product."
                    )
                }
            )

        # Drop the uploaded photo too, or MEDIA_ROOT accumulates orphans.
        if product.image:
            product.image.delete(save=False)
        product.delete()

    @action(detail=False, methods=["get"])
    def categories(self, request):
        """Categories already in use, for the product form's dropdown.

        There is no Category table — a category exists exactly as long as some
        product carries it — so this derives the list from the products
        themselves rather than from a lookup table that could drift out of sync.
        """
        names = (
            Product.objects.exclude(category="")
            .values_list("category", flat=True)
            .distinct()
            .order_by("category")
        )
        return Response(list(names))


class StockBatchViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """POST = receive new stock; GET = the batch list behind the shelf's pages."""

    queryset = StockBatch.objects.select_related("product", "disposed_by")
    serializer_class = StockBatchSerializer

    def get_queryset(self):
        """`?status=` and `?disposed=` — the filters the three shelf pages use.

        Status is read in Python rather than handed to SQL: the ageing window
        depends on each batch's own shelf life, so there is no single cutoff
        date to filter on. Same trade the admin's ExpiryStatusFilter makes, and
        for the same reason — one definition of "ageing", in the model.
        """
        queryset = super().get_queryset()

        disposed = self.request.query_params.get("disposed")
        if disposed == "true":
            queryset = queryset.filter(disposed_at__isnull=False)
        elif disposed == "false":
            queryset = queryset.filter(disposed_at__isnull=True)

        wanted = self.request.query_params.get("status")
        if wanted in STATUS_SEVERITY:
            matching = [b.pk for b in queryset if b.expiry_status == wanted]
            queryset = queryset.filter(pk__in=matching)
        return queryset

    @action(detail=True, methods=["post"])
    def dispose(self, request, pk=None):
        """Write an expired batch off — the stock went in the bin.

        Open to staff as well as the owner: whoever clears the shelf is who
        records it, and making them fetch the owner first is how disposals end
        up unrecorded. It is not a destructive action in the sense the owner
        gate protects — the row, its dates and its cost all stay; only the
        quantity goes to zero, and the write-off is signed.

        Expired stock only. Fresh or ageing stock leaving the shelf is a loss or
        a sale, neither of which this endpoint is, so both are refused rather
        than quietly accepted.
        """
        batch = self.get_object()

        if batch.is_disposed:
            raise ValidationError(
                {
                    "detail": (
                        f"This batch of {batch.product.name} was already disposed of "
                        f"on {batch.disposed_at:%d %b %Y}."
                    )
                }
            )
        if batch.expiry_status != StockBatch.STATUS_EXPIRED:
            raise ValidationError(
                {
                    "detail": (
                        f"Only expired stock can be disposed of. This batch of "
                        f"{batch.product.name} is {batch.expiry_status} — it expires "
                        f"on {batch.expiry_date:%d %b %Y}."
                    )
                }
            )

        serializer = StockBatchDisposalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch.dispose(request.user, serializer.validated_data["note"].strip())
        return Response(self.get_serializer(batch).data)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    def get_permissions(self):
        # Same split as products: staff maintain the list, owner removes from it.
        if self.action == "destroy":
            return [IsOwner()]
        return super().get_permissions()

    def perform_destroy(self, supplier):
        """Product.supplier is PROTECT, so an assigned supplier would 500."""
        products = list(supplier.products.values_list("name", flat=True)[:3])
        count = supplier.products.count()
        if count:
            listed = ", ".join(products)
            more = f" and {count - len(products)} more" if count > len(products) else ""
            raise ValidationError(
                {
                    "detail": (
                        f"'{supplier.name}' supplies {count} product(s) ({listed}{more}) "
                        "and cannot be deleted. Reassign them to another supplier first."
                    )
                }
            )
        supplier.delete()


class PurchaseOrderViewSet(viewsets.ReadOnlyModelViewSet):
    """Stock ordered from suppliers. Raised by auto-reorder, so read-only here."""

    # `batches` is prefetched because estimated_value prices each order off the
    # product's most recent batch — without it that is a query per row.
    queryset = PurchaseOrder.objects.select_related("supplier", "product").prefetch_related(
        "product__batches"
    )
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        product = self.request.query_params.get("product")
        status_filter = self.request.query_params.get("status")
        if product:
            queryset = queryset.filter(product_id=product)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


class CustomerViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Maintained from the order form, where a new buyer first turns up."""

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_permissions(self):
        # Same split as products and suppliers: staff add to the list while
        # taking an order, only the owner removes from it.
        if self.action == "destroy":
            return [IsOwner()]
        return super().get_permissions()

    def perform_destroy(self, customer):
        """Order.customer is PROTECT — without this check it would be a 500."""
        count = customer.orders.count()
        if count:
            raise ValidationError(
                {
                    "detail": (
                        f"'{customer.name}' is named on {count} order(s) and cannot "
                        "be deleted. Their trading history depends on it."
                    )
                }
            )
        customer.delete()


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


class InventoryStatusView(APIView):
    """The whole shelf in three numbers — one per expiry status.

    The 3D shelf used to render a stack per product, which meant fifty-eight
    stacks the moment the catalogue filled up: a colourful thicket that told
    nobody how much stock was actually at risk. It now renders one stack per
    status, and this is what those three stacks are made of.

    Deliberately its own endpoint rather than a shape bolted onto
    /api/inventory/: that one answers "per product" and is a list, so there is
    no room in it for a total, and two consumers already read it as one.
    """

    def get(self, request):
        buckets = {
            status: {
                "status": status,
                "quantity": 0,
                "batch_count": 0,
                "product_count": 0,
                "next_expiry": None,
            }
            for status in STATUS_SEVERITY
        }
        products_seen = {status: set() for status in STATUS_SEVERITY}

        # Disposed batches are excluded by the same quantity check that hides
        # sold-out ones: disposal zeroes the quantity. Nothing on the shelf is
        # stock the store no longer holds.
        for batch in StockBatch.objects.filter(quantity__gt=0).select_related("product"):
            bucket = buckets[batch.expiry_status]
            bucket["quantity"] += batch.quantity
            bucket["batch_count"] += 1
            products_seen[batch.expiry_status].add(batch.product_id)
            # For fresh and ageing this is the next thing to worry about; for
            # expired it is the oldest thing still sitting there. Same field,
            # because in both cases it is the earliest date in the bucket.
            if bucket["next_expiry"] is None or batch.expiry_date < bucket["next_expiry"]:
                bucket["next_expiry"] = batch.expiry_date

        for status, bucket in buckets.items():
            bucket["product_count"] = len(products_seen[status])

        # Severity order (expired first) is the API's, not the shelf's — the
        # shelf lays them out fresh to expired. Returned as a list so the order
        # is part of the response rather than left to the client's key order.
        return Response([buckets[status] for status in STATUS_SEVERITY])


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
