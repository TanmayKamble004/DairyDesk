"""DRF serializers for the API (spec section 4)."""
from decimal import Decimal

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
            "order",
            "customer_name",
            "order_status",
            "total_amount",
            "paid_amount",
            "status",
        ]
