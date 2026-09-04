"""Core data models for DairyDesk (spec section 3, MVP cut)."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Sum
from django.utils import timezone

# Days-to-expiry at or below which a batch counts as "ageing".
AGEING_THRESHOLD_DAYS = 3


class User(AbstractUser):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        STAFF = "staff", "Staff"

    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)

    def __str__(self):
        return f"{self.username} ({self.role})"


class Product(models.Model):
    class Unit(models.TextChoices):
        LITRE = "litre", "Litre"
        KG = "kg", "Kilogram"
        PIECE = "piece", "Piece"

    name = models.CharField(max_length=100)
    sku = models.CharField(max_length=32, unique=True)
    category = models.CharField(max_length=100)
    # Nullable only so products that predate suppliers keep loading; the API
    # requires one, so any edit fills it in. PROTECT stops a supplier being
    # deleted out from under the products it supplies.
    supplier = models.ForeignKey(
        "Supplier",
        on_delete=models.PROTECT,
        related_name="products",
        null=True,
        blank=True,
    )
    unit = models.CharField(max_length=10, choices=Unit.choices)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    # Optional catalogue photo. Stored under MEDIA_ROOT/products/.
    image = models.ImageField(upload_to="products/", blank=True, null=True)
    # Quantity to put on a purchase order once stock falls to the threshold.
    reorder_quantity = models.PositiveIntegerField(default=0)
    # Stock at or below this counts as "low" on the Products page.
    reorder_threshold = models.PositiveIntegerField(default=0)
    # When on, hitting the threshold raises a purchase order to `supplier`
    # for `reorder_quantity` units without anyone asking. See services.py.
    auto_reorder = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def available_quantity(self):
        """Sum of quantities across this product's non-expired batches."""
        today = timezone.localdate()
        total = self.batches.filter(expiry_date__gte=today).aggregate(
            total=Sum("quantity")
        )["total"]
        return total or 0

    @property
    def stock_status(self):
        """Stock health against the reorder threshold: out / low / in stock."""
        quantity = self.available_quantity
        if quantity == 0:
            return "out_of_stock"
        if quantity <= self.reorder_threshold:
            return "low_stock"
        return "in_stock"


class StockBatch(models.Model):
    STATUS_FRESH = "fresh"
    STATUS_AGEING = "ageing"
    STATUS_EXPIRED = "expired"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="batches")
    quantity = models.PositiveIntegerField()
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2)
    expiry_date = models.DateField()
    received_date = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ["expiry_date", "received_date"]
        verbose_name_plural = "stock batches"

    def __str__(self):
        return f"{self.product.name} × {self.quantity} (exp {self.expiry_date})"

    @property
    def expiry_status(self):
        """Computed: fresh (> threshold days left), ageing (<= threshold), expired (past)."""
        today = timezone.localdate()
        if self.expiry_date < today:
            return self.STATUS_EXPIRED
        if self.expiry_date <= today + timedelta(days=AGEING_THRESHOLD_DAYS):
            return self.STATUS_AGEING
        return self.STATUS_FRESH


class Supplier(models.Model):
    """A vendor this store buys stock from.

    `products_supplied` is entered rather than counted: Product has no supplier
    relation yet, so there is nothing to count from. See the Suppliers page.
    """

    name = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    products_supplied = models.PositiveIntegerField(default=0)
    last_order_date = models.DateField()
    # 0.0–5.0, one decimal — the bands the Suppliers page colours by.
    rating = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("5"))],
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    """Stock ordered *from* a supplier, as opposed to Order (sold to a customer).

    One product per order, because the quantity comes from that product's
    `reorder_quantity`. Batching a supplier's outstanding lines into a single
    order would be the next step, and does not change this model's shape.
    """

    class Status(models.TextChoices):
        PLACED = "placed", "Placed"
        RECEIVED = "received", "Received"
        CANCELLED = "cancelled", "Cancelled"

    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchase_orders"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="purchase_orders"
    )
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PLACED)
    # False for anything a person raises by hand, once that exists.
    auto_generated = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PO #{self.pk}: {self.quantity} × {self.product.name} from {self.supplier.name}"


class Customer(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    address = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSED = "processed", "Processed"
        DELIVERED = "delivered", "Delivered"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Order #{self.pk} — {self.customer.name} ({self.status})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.PositiveIntegerField()
    # Snapshot of the product's selling price at order time.
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.product.name} × {self.quantity}"

    @property
    def line_total(self):
        return self.quantity * self.unit_price


class Invoice(models.Model):
    class Status(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIAL = "partial", "Partial"
        PAID = "paid", "Paid"

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="invoice")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.UNPAID)

    def __str__(self):
        return f"Invoice for order #{self.order_id} ({self.status})"
