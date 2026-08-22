"""Core data models for DairyDesk (spec section 3, MVP cut)."""
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Sum
from django.utils import timezone

# Days-to-expiry at or below which a batch counts as "ageing".
AGEING_THRESHOLD_DAYS = 3

# Available quantity at or below which a product is flagged as running low.
LOW_STOCK_THRESHOLD = 10


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
    category = models.CharField(max_length=100)
    unit = models.CharField(max_length=10, choices=Unit.choices)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)

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


class StockDisposal(models.Model):
    """Audit record of expired stock written off a batch.

    Disposal never deletes the batch: it decrements the batch's quantity and
    leaves this row behind, so the write-off history survives. Both FKs are
    PROTECT for the same reason — a batch or a user with disposals against it
    cannot be deleted out from under the audit trail.
    """

    class Reason(models.TextChoices):
        EXPIRED = "expired", "Expired"
        SPOILED = "spoiled", "Spoiled"
        DAMAGED = "damaged", "Damaged"
        OTHER = "other", "Other"

    batch = models.ForeignKey(StockBatch, on_delete=models.PROTECT, related_name="disposals")
    quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=10, choices=Reason.choices, default=Reason.EXPIRED)
    notes = models.TextField(blank=True)
    disposed_at = models.DateTimeField(auto_now_add=True)
    disposed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="disposals")

    class Meta:
        ordering = ["-disposed_at", "-id"]

    def __str__(self):
        return f"{self.batch.product.name} × {self.quantity} disposed ({self.reason})"


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
