"""API routes (spec section 4)."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register("staff", views.StaffViewSet, basename="staff")
router.register("products", views.ProductViewSet, basename="product")
router.register("stock-batches", views.StockBatchViewSet, basename="stockbatch")
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("purchase-orders", views.PurchaseOrderViewSet, basename="purchaseorder")
router.register("customers", views.CustomerViewSet, basename="customer")
router.register("orders", views.OrderViewSet, basename="order")
router.register("invoices", views.InvoiceViewSet, basename="invoice")

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="token-obtain"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("inventory/", views.InventoryView.as_view(), name="inventory"),
    # Above the router only in the sense that it is its own path; the shelf's
    # three stacks come from here, the per-product rows from the line above.
    path(
        "inventory/status-summary/",
        views.InventoryStatusView.as_view(),
        name="inventory-status-summary",
    ),
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("", include(router.urls)),
]
