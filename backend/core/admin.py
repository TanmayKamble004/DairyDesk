from datetime import timedelta

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone

from .models import (
    AGEING_THRESHOLD_DAYS,
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


@admin.register(User)
class CoreUserAdmin(UserAdmin):
    list_display = ["username", "role", "email", "is_staff", "is_superuser"]
    list_filter = ["role", "is_staff", "is_superuser", "is_active"]
    fieldsets = UserAdmin.fieldsets + (("Dairy role", {"fields": ["role"]}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Dairy role", {"fields": ["role"]}),)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "sku",
        "category",
        "supplier",
        "unit",
        "selling_price",
        "reorder_threshold",
        "reorder_quantity",
        "available_quantity",
    ]
    list_filter = ["category", "unit", "supplier"]
    search_fields = ["name", "sku", "category", "supplier__name"]

    @admin.display(description="Available qty")
    def available_quantity(self, obj):
        return obj.available_quantity


class ExpiryStatusFilter(admin.SimpleListFilter):
    """Filter batches by the computed fresh/ageing/expired status."""

    title = "expiry status"
    parameter_name = "expiry_status"

    def lookups(self, request, model_admin):
        return [
            (StockBatch.STATUS_FRESH, "Fresh"),
            (StockBatch.STATUS_AGEING, "Ageing"),
            (StockBatch.STATUS_EXPIRED, "Expired"),
        ]

    def queryset(self, request, queryset):
        today = timezone.localdate()
        ageing_cutoff = today + timedelta(days=AGEING_THRESHOLD_DAYS)
        if self.value() == StockBatch.STATUS_EXPIRED:
            return queryset.filter(expiry_date__lt=today)
        if self.value() == StockBatch.STATUS_AGEING:
            return queryset.filter(expiry_date__gte=today, expiry_date__lte=ageing_cutoff)
        if self.value() == StockBatch.STATUS_FRESH:
            return queryset.filter(expiry_date__gt=ageing_cutoff)
        return queryset


@admin.register(StockBatch)
class StockBatchAdmin(admin.ModelAdmin):
    list_display = [
        "product",
        "quantity",
        "purchase_price",
        "received_date",
        "expiry_date",
        "expiry_status",
    ]
    list_filter = [ExpiryStatusFilter, "product", "expiry_date"]
    search_fields = ["product__name"]
    date_hierarchy = "expiry_date"

    @admin.display(description="Expiry status")
    def expiry_status(self, obj):
        return obj.expiry_status


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "contact_person",
        "phone",
        "email",
        "products_supplied",
        "last_order_date",
        "rating",
    ]
    search_fields = ["name", "contact_person", "email"]
    list_filter = ["rating"]


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "product",
        "supplier",
        "quantity",
        "status",
        "auto_generated",
        "created_at",
    ]
    list_filter = ["status", "auto_generated", "supplier"]
    search_fields = ["product__name", "supplier__name"]
    date_hierarchy = "created_at"


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "phone", "address"]
    search_fields = ["name", "phone"]


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "customer", "status", "created_at", "item_count"]
    list_filter = ["status", "created_at"]
    search_fields = ["customer__name"]
    date_hierarchy = "created_at"
    inlines = [OrderItemInline]

    @admin.display(description="Items")
    def item_count(self, obj):
        return obj.items.count()


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ["order", "product", "quantity", "unit_price", "line_total"]
    list_filter = ["product"]
    search_fields = ["order__customer__name", "product__name"]

    @admin.display(description="Line total")
    def line_total(self, obj):
        return obj.line_total


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ["id", "order", "total_amount", "paid_amount", "status"]
    list_filter = ["status"]
    search_fields = ["order__customer__name"]
