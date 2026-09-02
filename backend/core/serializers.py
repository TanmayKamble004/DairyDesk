"""DRF serializers for the API (spec section 4)."""
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Customer, Invoice, Order, OrderItem, Product, StockBatch
from .permissions import is_owner
from .services import deduct_stock_fifo

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

    class Meta:
        model = Product
        fields = ["id", "name", "category", "unit", "selling_price", "available_quantity"]


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
