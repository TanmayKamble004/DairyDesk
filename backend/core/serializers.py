"""DRF serializers for the API (spec section 4)."""
from decimal import Decimal

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import (
    Customer,
    Invoice,
    Order,
    OrderItem,
    Product,
    PurchaseOrder,
    StockBatch,
    Supplier,
    User,
)
from .permissions import is_owner
from .services import (
    deduct_stock_fifo,
    fulfil_purchase_orders,
    open_purchase_order,
    raise_auto_reorders,
)

# Allowed forward moves; re-submitting the current status is a no-op.
ORDER_STATUS_TRANSITIONS = {
    Order.Status.PENDING: {Order.Status.PROCESSED},
    Order.Status.PROCESSED: {Order.Status.DELIVERED},
    Order.Status.DELIVERED: set(),
}


class LoginSerializer(TokenObtainPairSerializer):
    """JWT pair plus the user's role, so the frontend can role-gate routes."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        data["role"] = self.user.role
        return data


def check_password_strength(password, user):
    """Run Django's configured password validators and report a 400, not a 500.

    `user` is what the similarity validator compares against, so a password
    that is just the person's own username is caught before it is stored.
    """
    try:
        password_validation.validate_password(password, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({"password": list(error.messages)}) from error


class StaffSerializer(serializers.ModelSerializer):
    """A person who can sign in to this store. Owner-only — see StaffViewSet.

    Nobody here is ever deleted: their name is attached to past orders and
    invoices, so removing the row would orphan trading history. `is_active` is
    the off switch instead — SimpleJWT refuses to issue a token for an inactive
    user *and* rejects the ones already issued, so switching someone off ends
    their session rather than merely blocking the next login.
    """

    full_name = serializers.SerializerMethodField()
    # Redeclared because the model allows a blank first name; a staff list
    # showing bare usernames is not the page this feeds.
    first_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    # Explicit default because DRF reads a *missing* boolean in form-encoded
    # data as an unchecked checkbox — False — which would silently create every
    # new member already disabled. PATCH is unaffected: partial updates skip
    # defaults, so an edit that says nothing about `is_active` leaves it alone.
    is_active = serializers.BooleanField(default=True)
    # Write-only, and only on create. Changing an existing password goes
    # through set-password/, so a routine detail edit can never rewrite one.
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "role",
            "is_active",
            "last_login",
            "date_joined",
            "password",
        ]
        read_only_fields = ["last_login", "date_joined"]

    def get_full_name(self, user):
        return user.get_full_name() or user.username

    def validate_email(self, email):
        """Not unique on the model, but two people sharing one is a mistake."""
        clashes = User.objects.filter(email__iexact=email.strip())
        if self.instance:
            clashes = clashes.exclude(pk=self.instance.pk)
        if clashes.exists():
            raise serializers.ValidationError("Another staff member already uses this email.")
        return email.strip()

    def validate(self, attrs):
        password = attrs.get("password")

        if self.instance is None:
            if not password:
                raise serializers.ValidationError(
                    {"password": "Set a password — it is what this person signs in with."}
                )
            # Unsaved, purely so the similarity validator has a name and email
            # to compare the password against.
            check_password_strength(password, User(**{
                field: attrs.get(field, "")
                for field in ["username", "first_name", "last_name", "email"]
            }))
        elif password:
            raise serializers.ValidationError(
                {"password": "Use the reset-password action to change an existing password."}
            )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        staff = User(**validated_data)
        staff.set_password(password)
        staff.save()
        return staff


class StaffPasswordSerializer(serializers.Serializer):
    """POST /api/staff/{id}/set-password/ — the owner setting a new password.

    No current-password field: this is the owner resetting someone else's
    forgotten password, not a person changing their own.
    """

    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        check_password_strength(attrs["password"], self.context["staff"])
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    available_quantity = serializers.IntegerField(read_only=True)
    stock_status = serializers.CharField(read_only=True)
    # Sent as multipart when the form carries a photo; omitted otherwise.
    # `null` on update clears the stored file.
    image = serializers.ImageField(required=False, allow_null=True)
    # Multipart has no way to say "null", so removing an existing photo needs
    # its own flag — an empty `image` field just reads as "unchanged".
    clear_image = serializers.BooleanField(write_only=True, required=False)
    # Photo and description are the optional parts of a product. The reorder
    # levels are redeclared because their model defaults of 0 would otherwise
    # make them optional, and a silent zero threshold reads as a real answer.
    reorder_quantity = serializers.IntegerField(min_value=0)
    reorder_threshold = serializers.IntegerField(min_value=0)
    # The FK is nullable in the database purely for products that predate
    # suppliers — every write has to name one.
    supplier = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(), allow_null=False
    )
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    open_purchase_order = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sku",
            "category",
            "supplier",
            "supplier_name",
            "unit",
            "selling_price",
            "description",
            "image",
            "clear_image",
            "reorder_quantity",
            "reorder_threshold",
            "auto_reorder",
            "open_purchase_order",
            "available_quantity",
            "stock_status",
        ]

    def get_open_purchase_order(self, product):
        """The outstanding reorder, so the form can say one is already running."""
        order = open_purchase_order(product)
        if order is None:
            return None
        return {
            "id": order.id,
            "quantity": order.quantity,
            "supplier_name": order.supplier.name,
            "created_at": order.created_at,
        }

    def create(self, validated_data):
        # Write-only flag; there is no stored photo to clear on a new product.
        validated_data.pop("clear_image", None)
        product = super().create(validated_data)
        # A product created already at/below its threshold reorders immediately.
        raise_auto_reorders([product])
        return product

    def update(self, product, validated_data):
        # A new upload wins over the clear flag: replacing is not removing.
        replacing = bool(validated_data.get("image"))
        clearing = validated_data.pop("clear_image", False) and not replacing
        if clearing:
            validated_data["image"] = None
        # Drop the file being replaced or removed, so MEDIA_ROOT does not
        # collect photos nothing points at any more.
        if product.image and (replacing or clearing):
            product.image.delete(save=False)
        product = super().update(product, validated_data)
        # Turning the toggle on, or lowering the threshold onto current stock,
        # should reorder now rather than waiting for the next sale.
        raise_auto_reorders([product])
        return product

    def to_internal_value(self, data):
        """Normalise the SKU before validation, not after.

        A `validate_sku` hook would run *after* the field's uniqueness check,
        so "dry-1001" would clear a check against the stored "DRY-1001" and
        then hit the database constraint as a 500 instead of a 400.

        Category is trimmed in the same pass: it is its own lookup list (see
        ProductViewSet.categories), so " Dairy" must not become a second entry
        in the form's dropdown.
        """
        # A non-dict body is left alone; super() rejects it with a clean 400.
        if hasattr(data, "get"):
            sku = data.get("sku")
            category = data.get("category")
            if isinstance(sku, str) or isinstance(category, str):
                data = data.copy()
                if isinstance(sku, str):
                    data["sku"] = sku.strip().upper()
                if isinstance(category, str):
                    data["category"] = category.strip()
        return super().to_internal_value(data)

    def validate(self, attrs):
        """Cross-field rules for the reordering box."""
        current = self.instance
        threshold = attrs.get(
            "reorder_threshold", getattr(current, "reorder_threshold", 0)
        )
        quantity = attrs.get("reorder_quantity", getattr(current, "reorder_quantity", 0))
        auto = attrs.get("auto_reorder", getattr(current, "auto_reorder", False))

        # Reorder quantity below the threshold can never restore stock.
        if quantity and quantity < threshold:
            raise serializers.ValidationError(
                {
                    "reorder_quantity": (
                        "Reorder quantity should be at least the reorder threshold "
                        f"({threshold}), otherwise restocking leaves the product low."
                    )
                }
            )
        if auto and quantity <= 0:
            raise serializers.ValidationError(
                {
                    "reorder_quantity": (
                        "Auto-reorder needs a reorder quantity above 0 — "
                        "otherwise there is nothing to order."
                    )
                }
            )
        return attrs


class StockBatchSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    expiry_status = serializers.CharField(read_only=True)

    class Meta:
        model = StockBatch
        fields = [
            "id",
            "product",
            "product_name",
            "quantity",
            "purchase_price",
            "expiry_date",
            "received_date",
            "expiry_status",
        ]

    def to_representation(self, batch):
        """Hide the factory buying price from everyone but the owner.

        Staff still POST `purchase_price` when receiving stock, but must never
        be able to read cost data back — otherwise a single GET on this
        endpoint exposes the margin on every product (spec section 4).
        """
        data = super().to_representation(batch)
        request = self.context.get("request")
        if not is_owner(getattr(request, "user", None)):
            data.pop("purchase_price", None)
        return data

    def create(self, validated_data):
        batch = super().create(validated_data)
        # Receiving stock is the only signal this app has that a supplier
        # delivered, so it closes any reorder outstanding for that product.
        fulfil_purchase_orders(batch.product)
        return batch


class SupplierSerializer(serializers.ModelSerializer):
    """Every field is mandatory — the Suppliers card renders all of them."""

    # Redeclared because `default=0` on the model would otherwise make this
    # optional, and a card showing a silent zero is worse than a 400.
    products_supplied = serializers.IntegerField(min_value=0)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "phone",
            "email",
            "products_supplied",
            "last_order_date",
            "rating",
        ]

    def validate_rating(self, rating):
        if not Decimal("0") <= rating <= Decimal("5"):
            raise serializers.ValidationError("Rating must be between 0.0 and 5.0.")
        return rating

    def validate_last_order_date(self, date):
        if date > timezone.localdate():
            raise serializers.ValidationError("The last order cannot be in the future.")
        return date


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Read-only: these are raised by auto-reorder, not by hand."""

    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "supplier",
            "supplier_name",
            "product",
            "product_name",
            "quantity",
            "status",
            "auto_generated",
            "created_at",
        ]


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "address"]


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    quantity = serializers.IntegerField(min_value=1)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "line_total"]
        read_only_fields = ["unit_price"]


class OrderSerializer(serializers.ModelSerializer):
    """List/retrieve/create. Status is read-only here; transitions go through PATCH."""

    items = OrderItemSerializer(many=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    total = serializers.SerializerMethodField()
    has_invoice = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "customer_name",
            "status",
            "created_at",
            "items",
            "total",
            "has_invoice",
        ]
        read_only_fields = ["status", "created_at"]

    def get_total(self, order):
        return str(sum((item.line_total for item in order.items.all()), 0))

    def get_has_invoice(self, order):
        return Invoice.objects.filter(order=order).exists()

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("An order needs at least one item.")
        return items

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        with transaction.atomic():
            deduct_stock_fifo(
                (item["product"], item["quantity"]) for item in items_data
            )
            order = Order.objects.create(**validated_data)
            OrderItem.objects.bulk_create(
                OrderItem(
                    order=order,
                    product=item["product"],
                    quantity=item["quantity"],
                    # Snapshot the selling price at order time.
                    unit_price=item["product"].selling_price,
                )
                for item in items_data
            )
            # A sale is what pushes stock down onto a threshold, so this is
            # where auto-reorder earns its keep. Inside the transaction, so a
            # rolled-back order cannot leave a purchase order behind.
            raise_auto_reorders({item["product"] for item in items_data})
        return order


class OrderStatusSerializer(serializers.ModelSerializer):
    """PATCH /api/orders/{id}/ — status transitions only."""

    class Meta:
        model = Order
        fields = ["status"]

    def validate_status(self, new_status):
        current = self.instance.status
        if new_status != current and new_status not in ORDER_STATUS_TRANSITIONS[current]:
            raise serializers.ValidationError(
                f"Cannot transition from '{current}' to '{new_status}'. "
                "Allowed flow: pending -> processed -> delivered."
            )
        return new_status


class InvoiceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="order.customer.name", read_only=True)
    order_status = serializers.CharField(source="order.status", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            # Read-only by construction: `number` is editable=False on the
            # model and `created_at` is auto_now_add.
            "number",
            "order",
            "customer_name",
            "order_status",
            "created_at",
            "total_amount",
            "paid_amount",
            "status",
        ]
