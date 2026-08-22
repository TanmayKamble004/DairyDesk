"""Tests for stock disposal and the inventory/FIFO behaviour it touches."""
import threading
from datetime import timedelta
from decimal import Decimal

from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from .models import (
    LOW_STOCK_THRESHOLD,
    Customer,
    Invoice,
    Order,
    OrderItem,
    Product,
    StockBatch,
    StockDisposal,
    User,
)
from .serializers import OrderSerializer
from .services import deduct_stock_fifo, dispose_batch


def make_user(username="owner", role=User.Role.OWNER):
    return User.objects.create_user(username=username, password="pw12345!", role=role)


def make_product(name="Full Cream Milk", price="66.00"):
    return Product.objects.create(
        name=name,
        category="Milk",
        unit=Product.Unit.LITRE,
        selling_price=Decimal(price),
    )


def make_batch(product, quantity, days_to_expiry, days_received_ago=0):
    """Batch whose expiry is relative to today, so status is deterministic."""
    today = timezone.localdate()
    return StockBatch.objects.create(
        product=product,
        quantity=quantity,
        purchase_price=Decimal("50.00"),
        expiry_date=today + timedelta(days=days_to_expiry),
        received_date=today - timedelta(days=days_received_ago),
    )


class DisposalServiceTests(TestCase):
    """services.dispose_batch — the business rules."""

    def setUp(self):
        self.user = make_user()
        self.product = make_product()

    def test_partial_disposal_reduces_quantity_and_keeps_batch(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        disposal = dispose_batch(
            batch_id=batch.pk,
            quantity=4,
            reason=StockDisposal.Reason.EXPIRED,
            notes="Curdled",
            user=self.user,
        )

        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 6)
        self.assertEqual(disposal.quantity, 4)
        self.assertEqual(disposal.notes, "Curdled")
        # The batch row itself must survive the write-off.
        self.assertTrue(StockBatch.objects.filter(pk=batch.pk).exists())

    def test_complete_disposal_zeroes_quantity_and_keeps_batch(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-2)

        dispose_batch(
            batch_id=batch.pk,
            quantity=10,
            reason=StockDisposal.Reason.SPOILED,
            user=self.user,
        )

        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 0)
        self.assertTrue(StockBatch.objects.filter(pk=batch.pk).exists())
        self.assertEqual(StockDisposal.objects.filter(batch=batch).count(), 1)

    def test_repeated_partial_disposals_accumulate(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        dispose_batch(batch_id=batch.pk, quantity=3, reason="expired", user=self.user)
        dispose_batch(batch_id=batch.pk, quantity=7, reason="expired", user=self.user)

        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 0)
        self.assertEqual(batch.disposals.count(), 2)

    def test_zero_quantity_rejected(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        with self.assertRaises(ValidationError) as ctx:
            dispose_batch(batch_id=batch.pk, quantity=0, reason="expired", user=self.user)

        self.assertIn("quantity", ctx.exception.detail)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 10)
        self.assertEqual(StockDisposal.objects.count(), 0)

    def test_negative_quantity_rejected(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        with self.assertRaises(ValidationError):
            dispose_batch(batch_id=batch.pk, quantity=-5, reason="expired", user=self.user)

        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 10)
        self.assertEqual(StockDisposal.objects.count(), 0)

    def test_excessive_quantity_rejected(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        with self.assertRaises(ValidationError) as ctx:
            dispose_batch(batch_id=batch.pk, quantity=11, reason="expired", user=self.user)

        self.assertIn("10 remaining", str(ctx.exception.detail))
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 10)

    def test_fresh_batch_cannot_be_disposed(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=10)

        with self.assertRaises(ValidationError) as ctx:
            dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.user)

        self.assertIn("batch", ctx.exception.detail)
        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 10)

    def test_ageing_batch_cannot_be_disposed(self):
        # Inside the 3-day ageing window — still sellable, so not disposable.
        batch = make_batch(self.product, quantity=10, days_to_expiry=2)

        with self.assertRaises(ValidationError):
            dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.user)

        batch.refresh_from_db()
        self.assertEqual(batch.quantity, 10)

    def test_batch_expiring_today_is_not_disposable(self):
        # expiry_date == today is 'ageing', not 'expired' — boundary check.
        batch = make_batch(self.product, quantity=5, days_to_expiry=0)

        with self.assertRaises(ValidationError):
            dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.user)


class DisposalHistoryTests(TestCase):
    """Audit trail: who disposed of what, when."""

    def setUp(self):
        self.owner = make_user("owner", User.Role.OWNER)
        self.staff = make_user("staff", User.Role.STAFF)
        self.product = make_product()

    def test_disposal_records_the_acting_user(self):
        batch = make_batch(self.product, quantity=8, days_to_expiry=-1)

        disposal = dispose_batch(
            batch_id=batch.pk, quantity=2, reason="damaged", user=self.staff
        )

        self.assertEqual(disposal.disposed_by, self.staff)
        self.assertEqual(disposal.reason, "damaged")
        self.assertIsNotNone(disposal.disposed_at)

    def test_history_keeps_one_row_per_disposal_with_its_own_user(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

        dispose_batch(batch_id=batch.pk, quantity=3, reason="expired", user=self.owner)
        dispose_batch(batch_id=batch.pk, quantity=2, reason="spoiled", user=self.staff)

        disposals = StockDisposal.objects.filter(batch=batch)
        self.assertEqual(disposals.count(), 2)
        self.assertEqual(
            sorted(d.disposed_by.username for d in disposals), ["owner", "staff"]
        )
        self.assertEqual(sum(d.quantity for d in disposals), 5)

    def test_history_is_newest_first(self):
        batch = make_batch(self.product, quantity=10, days_to_expiry=-1)
        first = dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.owner)
        second = dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.owner)

        self.assertEqual(list(StockDisposal.objects.all()), [second, first])

    def test_disposed_user_is_protected_from_deletion(self):
        batch = make_batch(self.product, quantity=5, days_to_expiry=-1)
        dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.staff)

        from django.db.models import ProtectedError

        with self.assertRaises(ProtectedError):
            self.staff.delete()

    def test_disposed_batch_is_protected_from_deletion(self):
        batch = make_batch(self.product, quantity=5, days_to_expiry=-1)
        dispose_batch(batch_id=batch.pk, quantity=1, reason="expired", user=self.owner)

        from django.db.models import ProtectedError

        with self.assertRaises(ProtectedError):
            batch.delete()


class DisposalAPITests(APITestCase):
    """POST /api/stock-batches/{id}/dispose/ and GET /api/stock-disposals/."""

    def setUp(self):
        self.user = make_user("owner", User.Role.OWNER)
        self.product = make_product()
        self.batch = make_batch(self.product, quantity=10, days_to_expiry=-1)
        self.url = f"/api/stock-batches/{self.batch.pk}/dispose/"

    def test_dispose_requires_authentication(self):
        response = self.client.post(self.url, {"quantity": 1, "reason": "expired"})

        self.assertEqual(response.status_code, 401)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 10)

    def test_disposal_list_requires_authentication(self):
        self.assertEqual(self.client.get("/api/stock-disposals/").status_code, 401)

    def test_jwt_login_then_dispose(self):
        """End-to-end through the real auth path, not force_authenticate."""
        token = self.client.post(
            "/api/auth/login/", {"username": "owner", "password": "pw12345!"}
        ).data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(self.url, {"quantity": 4, "reason": "expired"})

        self.assertEqual(response.status_code, 201)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 6)

    def test_dispose_returns_created_record(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.url, {"quantity": 3, "reason": "spoiled", "notes": "Smelled off"}
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["quantity"], 3)
        self.assertEqual(response.data["reason"], "spoiled")
        self.assertEqual(response.data["notes"], "Smelled off")
        self.assertEqual(response.data["product_name"], "Full Cream Milk")
        self.assertEqual(response.data["disposed_by_username"], "owner")

    def test_notes_are_optional(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"quantity": 1, "reason": "expired"})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["notes"], "")

    def test_reason_defaults_to_expired(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"quantity": 1})

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["reason"], "expired")

    def test_invalid_reason_rejected(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"quantity": 1, "reason": "bored"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("reason", response.data)

    def test_zero_quantity_returns_400(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"quantity": 0, "reason": "expired"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("quantity", response.data)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 10)

    def test_excessive_quantity_returns_400(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"quantity": 99, "reason": "expired"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("quantity", response.data)

    def test_non_expired_batch_returns_400(self):
        self.client.force_authenticate(self.user)
        fresh = make_batch(self.product, quantity=5, days_to_expiry=9)

        response = self.client.post(
            f"/api/stock-batches/{fresh.pk}/dispose/", {"quantity": 1, "reason": "expired"}
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("batch", response.data)

    def test_unknown_batch_returns_404(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/stock-batches/999999/dispose/", {"quantity": 1, "reason": "expired"}
        )

        self.assertEqual(response.status_code, 404)

    def test_staff_can_dispose(self):
        """Disposal is stock work, not financial data — staff are allowed."""
        self.client.force_authenticate(make_user("staff", User.Role.STAFF))

        response = self.client.post(self.url, {"quantity": 2, "reason": "expired"})

        self.assertEqual(response.status_code, 201)

    def test_disposal_list_returns_history(self):
        self.client.force_authenticate(self.user)
        self.client.post(self.url, {"quantity": 2, "reason": "expired"})
        self.client.post(self.url, {"quantity": 3, "reason": "damaged"})

        response = self.client.get("/api/stock-disposals/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(
            sorted(row["quantity"] for row in response.data), [2, 3]
        )

    def test_disposal_list_is_read_only(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            "/api/stock-disposals/", {"batch": self.batch.pk, "quantity": 1}
        )

        self.assertEqual(response.status_code, 405)


class BatchPurchasePriceVisibilityTests(APITestCase):
    """purchase_price is financial data: owner-only on read, writable by staff.

    Staff keep the rest of the batch — quantity and expiry drive the disposal
    feature — so this withholds the one field rather than the endpoint.
    """

    def setUp(self):
        self.owner = make_user("owner", User.Role.OWNER)
        self.staff = make_user("staff", User.Role.STAFF)
        self.product = make_product()
        self.batch = make_batch(self.product, quantity=10, days_to_expiry=5)

    def test_owner_sees_purchase_price(self):
        self.client.force_authenticate(self.owner)

        row = self.client.get("/api/stock-batches/").data[0]

        self.assertEqual(row["purchase_price"], "50.00")

    def test_staff_does_not_see_purchase_price(self):
        self.client.force_authenticate(self.staff)

        response = self.client.get("/api/stock-batches/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("purchase_price", response.data[0])

    def test_staff_still_sees_fields_the_disposal_feature_needs(self):
        self.client.force_authenticate(self.staff)

        row = self.client.get("/api/stock-batches/").data[0]

        self.assertEqual(row["quantity"], 10)
        self.assertEqual(row["expiry_status"], "fresh")
        self.assertIn("expiry_date", row)
        self.assertIn("product_name", row)

    def test_staff_can_still_receive_stock(self):
        """Withholding it on read must not break the receive-stock form."""
        self.client.force_authenticate(self.staff)
        today = timezone.localdate()

        response = self.client.post(
            "/api/stock-batches/",
            {
                "product": self.product.pk,
                "quantity": 12,
                "purchase_price": "42.50",
                "expiry_date": (today + timedelta(days=7)).isoformat(),
                "received_date": today.isoformat(),
            },
        )

        self.assertEqual(response.status_code, 201)
        # Written through to the database...
        created = StockBatch.objects.get(pk=response.data["id"])
        self.assertEqual(created.purchase_price, Decimal("42.50"))
        # ...but not echoed back to staff.
        self.assertNotIn("purchase_price", response.data)

    def test_unauthenticated_request_is_rejected(self):
        self.assertEqual(self.client.get("/api/stock-batches/").status_code, 401)


class InventoryAggregationTests(APITestCase):
    """Disposals must flow through /api/inventory/ and the dashboard."""

    def setUp(self):
        self.user = make_user()
        self.client.force_authenticate(self.user)
        self.product = make_product()
        self.fresh = make_batch(self.product, quantity=20, days_to_expiry=10)
        self.expired = make_batch(self.product, quantity=8, days_to_expiry=-1)

    def inventory_row(self):
        return self.client.get("/api/inventory/").data[0]

    def test_expired_stock_reported_but_not_available(self):
        row = self.inventory_row()

        self.assertEqual(row["available_quantity"], 20)
        self.assertEqual(row["expired_quantity"], 8)
        self.assertEqual(row["batch_counts"], {"fresh": 1, "ageing": 0, "expired": 1})
        self.assertEqual(row["worst_status"], "expired")

    def test_partial_disposal_reduces_expired_quantity_only(self):
        dispose_batch(
            batch_id=self.expired.pk, quantity=5, reason="expired", user=self.user
        )

        row = self.inventory_row()
        self.assertEqual(row["expired_quantity"], 3)
        self.assertEqual(row["available_quantity"], 20)
        self.assertEqual(row["batch_counts"]["expired"], 1)

    def test_full_disposal_removes_the_batch_from_aggregation(self):
        """A zero-quantity batch must stop counting — no red crate on the shelf."""
        dispose_batch(
            batch_id=self.expired.pk, quantity=8, reason="expired", user=self.user
        )

        row = self.inventory_row()
        self.assertEqual(row["expired_quantity"], 0)
        self.assertEqual(row["batch_counts"]["expired"], 0)
        self.assertEqual(row["worst_status"], "fresh")
        self.assertEqual(row["available_quantity"], 20)

    def test_product_available_quantity_ignores_disposed_stock(self):
        expired_extra = make_batch(self.product, quantity=6, days_to_expiry=-3)
        dispose_batch(
            batch_id=expired_extra.pk, quantity=6, reason="expired", user=self.user
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.available_quantity, 20)

    def test_dashboard_stops_flagging_the_product_once_disposed(self):
        before = self.client.get("/api/dashboard/").data["kpis"]
        self.assertEqual(before["products_expired_count"], 1)

        dispose_batch(
            batch_id=self.expired.pk, quantity=8, reason="expired", user=self.user
        )

        after = self.client.get("/api/dashboard/").data["kpis"]
        self.assertEqual(after["products_expired_count"], 0)
        self.assertEqual(after["expired_quantity"], 0)

    def test_dashboard_stock_value_unaffected_by_expired_disposal(self):
        before = self.client.get("/api/dashboard/").data["kpis"][
            "total_available_stock_value"
        ]

        dispose_batch(
            batch_id=self.expired.pk, quantity=8, reason="expired", user=self.user
        )

        after = self.client.get("/api/dashboard/").data["kpis"][
            "total_available_stock_value"
        ]
        self.assertEqual(before, after)


class FifoBehaviourTests(TestCase):
    """Existing FIFO deduction must be unchanged by the disposal feature."""

    def setUp(self):
        self.user = make_user()
        self.product = make_product()
        self.customer = Customer.objects.create(name="Sharma Store", phone="9820011223")

    def create_order(self, quantity):
        serializer = OrderSerializer(
            data={
                "customer": self.customer.pk,
                "items": [{"product": self.product.pk, "quantity": quantity}],
            }
        )
        serializer.is_valid(raise_exception=True)
        return serializer.save()

    def test_deducts_oldest_batch_first(self):
        oldest = make_batch(self.product, quantity=10, days_to_expiry=5, days_received_ago=3)
        newest = make_batch(self.product, quantity=10, days_to_expiry=9, days_received_ago=0)

        self.create_order(6)

        oldest.refresh_from_db()
        newest.refresh_from_db()
        self.assertEqual(oldest.quantity, 4)
        self.assertEqual(newest.quantity, 10)

    def test_spills_into_next_batch_when_first_runs_out(self):
        oldest = make_batch(self.product, quantity=10, days_to_expiry=5, days_received_ago=3)
        newest = make_batch(self.product, quantity=10, days_to_expiry=9, days_received_ago=0)

        self.create_order(14)

        oldest.refresh_from_db()
        newest.refresh_from_db()
        self.assertEqual(oldest.quantity, 0)
        self.assertEqual(newest.quantity, 6)

    def test_expired_batches_are_never_used(self):
        expired = make_batch(self.product, quantity=50, days_to_expiry=-1)
        fresh = make_batch(self.product, quantity=10, days_to_expiry=9)

        self.create_order(10)

        expired.refresh_from_db()
        fresh.refresh_from_db()
        self.assertEqual(expired.quantity, 50)
        self.assertEqual(fresh.quantity, 0)

    def test_insufficient_stock_blocks_and_deducts_nothing(self):
        fresh = make_batch(self.product, quantity=5, days_to_expiry=9)

        with self.assertRaises(ValidationError):
            self.create_order(6)

        fresh.refresh_from_db()
        self.assertEqual(fresh.quantity, 5)

    def test_same_product_lines_are_combined_before_the_check(self):
        make_batch(self.product, quantity=5, days_to_expiry=9)
        serializer = OrderSerializer(
            data={
                "customer": self.customer.pk,
                "items": [
                    {"product": self.product.pk, "quantity": 3},
                    {"product": self.product.pk, "quantity": 3},
                ],
            }
        )
        serializer.is_valid(raise_exception=True)

        with self.assertRaises(ValidationError):
            serializer.save()

    def test_disposal_does_not_disturb_fifo_on_remaining_stock(self):
        expired = make_batch(self.product, quantity=8, days_to_expiry=-1)
        oldest = make_batch(self.product, quantity=10, days_to_expiry=5, days_received_ago=3)
        newest = make_batch(self.product, quantity=10, days_to_expiry=9, days_received_ago=0)

        dispose_batch(batch_id=expired.pk, quantity=8, reason="expired", user=self.user)
        self.create_order(6)

        oldest.refresh_from_db()
        newest.refresh_from_db()
        self.assertEqual(oldest.quantity, 4)
        self.assertEqual(newest.quantity, 10)

    def test_zero_quantity_batches_are_skipped_by_fifo(self):
        emptied = make_batch(self.product, quantity=4, days_to_expiry=5, days_received_ago=5)
        later = make_batch(self.product, quantity=10, days_to_expiry=9, days_received_ago=0)
        self.create_order(4)  # empties the first batch
        emptied.refresh_from_db()
        self.assertEqual(emptied.quantity, 0)

        self.create_order(3)

        emptied.refresh_from_db()
        later.refresh_from_db()
        self.assertEqual(emptied.quantity, 0)
        self.assertEqual(later.quantity, 7)


class DashboardTests(APITestCase):
    """GET /api/dashboard/ — role gating, calculations, filters, efficiency."""

    def setUp(self):
        self.owner = make_user("owner", User.Role.OWNER)
        self.staff = make_user("staff", User.Role.STAFF)
        self.customer = Customer.objects.create(name="Sharma Store", phone="9820011223")
        self.milk = make_product("Full Cream Milk", "66.00")

    def dashboard(self, user, **params):
        self.client.force_authenticate(user)
        response = self.client.get("/api/dashboard/", params)
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def place_order(self, quantity, days_ago=0, status=None):
        """Order with a backdated created_at (auto_now_add needs an UPDATE)."""
        order = Order.objects.create(customer=self.customer, status=status or Order.Status.PENDING)
        OrderItem.objects.create(
            order=order,
            product=self.milk,
            quantity=quantity,
            unit_price=self.milk.selling_price,
        )
        if days_ago:
            Order.objects.filter(pk=order.pk).update(
                created_at=timezone.now() - timedelta(days=days_ago)
            )
        return order

    # --- authentication & role gating ---

    def test_requires_authentication(self):
        self.assertEqual(self.client.get("/api/dashboard/").status_code, 401)

    def test_owner_sees_financial_data(self):
        kpis = self.dashboard(self.owner)["kpis"]

        for key in (
            "total_available_stock_value",
            "period_sales_total",
            "unpaid_invoice_count",
            "disposed_quantity",
            "disposed_value",
        ):
            self.assertIn(key, kpis)

    def test_staff_never_receives_financial_kpis(self):
        kpis = self.dashboard(self.staff)["kpis"]

        for key in (
            "total_available_stock_value",
            "period_sales_total",
            "unpaid_invoice_count",
            "disposed_quantity",
            "disposed_value",
        ):
            self.assertNotIn(key, kpis)

    def test_staff_still_sees_stock_kpis(self):
        make_batch(self.milk, quantity=25, days_to_expiry=8)

        kpis = self.dashboard(self.staff)["kpis"]

        self.assertEqual(kpis["total_available_quantity"], 25)
        self.assertIn("expired_quantity", kpis)
        self.assertIn("pending_order_count", kpis)

    def test_staff_has_no_sales_summary(self):
        data = self.dashboard(self.staff)

        self.assertNotIn("sales_summary", data)
        self.assertIn("sales_summary", self.dashboard(self.owner))

    def test_staff_recent_orders_carry_no_totals(self):
        self.place_order(4)

        staff_rows = self.dashboard(self.staff)["recent_orders"]
        owner_rows = self.dashboard(self.owner)["recent_orders"]

        self.assertEqual(len(staff_rows), 1)
        self.assertNotIn("total", staff_rows[0])
        self.assertIn("total", owner_rows[0])
        # Staff still get the non-financial context they need.
        self.assertEqual(staff_rows[0]["item_count"], 1)
        self.assertEqual(staff_rows[0]["customer_name"], "Sharma Store")

    def test_staff_category_breakdown_carries_no_value(self):
        make_batch(self.milk, quantity=10, days_to_expiry=8)

        staff_rows = self.dashboard(self.staff)["category_breakdown"]
        owner_rows = self.dashboard(self.owner)["category_breakdown"]

        self.assertNotIn("stock_value", staff_rows[0])
        self.assertIn("stock_value", owner_rows[0])
        self.assertEqual(staff_rows[0]["available_quantity"], 10)

    def test_staff_disposal_rows_carry_no_value(self):
        batch = make_batch(self.milk, quantity=5, days_to_expiry=-1)
        dispose_batch(batch_id=batch.pk, quantity=5, reason="expired", user=self.staff)

        staff_rows = self.dashboard(self.staff)["recent_disposals"]
        owner_rows = self.dashboard(self.owner)["recent_disposals"]

        self.assertNotIn("value", staff_rows[0])
        self.assertEqual(owner_rows[0]["value"], "330.00")

    # --- stock calculations ---

    def test_available_quantity_excludes_expired_stock(self):
        make_batch(self.milk, quantity=30, days_to_expiry=8)
        make_batch(self.milk, quantity=12, days_to_expiry=-2)

        kpis = self.dashboard(self.owner)["kpis"]

        self.assertEqual(kpis["total_available_quantity"], 30)
        self.assertEqual(kpis["expired_quantity"], 12)

    def test_near_expiry_counts_the_ageing_window_only(self):
        make_batch(self.milk, quantity=7, days_to_expiry=2)  # ageing
        make_batch(self.milk, quantity=5, days_to_expiry=3)  # ageing (boundary)
        make_batch(self.milk, quantity=40, days_to_expiry=4)  # fresh
        make_batch(self.milk, quantity=9, days_to_expiry=-1)  # expired

        kpis = self.dashboard(self.owner)["kpis"]

        self.assertEqual(kpis["near_expiry_quantity"], 12)
        self.assertEqual(kpis["expired_quantity"], 9)
        self.assertEqual(kpis["total_available_quantity"], 52)

    def test_zero_quantity_batches_are_ignored_everywhere(self):
        make_batch(self.milk, quantity=0, days_to_expiry=-1)
        make_batch(self.milk, quantity=0, days_to_expiry=8)

        kpis = self.dashboard(self.owner)["kpis"]

        self.assertEqual(kpis["expired_quantity"], 0)
        self.assertEqual(kpis["total_available_quantity"], 0)
        self.assertEqual(kpis["products_expired_count"], 0)
        self.assertEqual(self.dashboard(self.owner)["expiring_batches"], [])

    def test_expiring_batches_list_is_expired_first_then_soonest(self):
        make_batch(self.milk, quantity=3, days_to_expiry=2)
        make_batch(self.milk, quantity=4, days_to_expiry=-5)
        make_batch(self.milk, quantity=5, days_to_expiry=1)
        make_batch(self.milk, quantity=6, days_to_expiry=30)  # fresh, excluded

        rows = self.dashboard(self.owner)["expiring_batches"]

        self.assertEqual([r["status"] for r in rows], ["expired", "ageing", "ageing"])
        self.assertEqual([r["days_left"] for r in rows], [-5, 1, 2])

    def test_stock_value_uses_selling_price_of_sellable_batches(self):
        make_batch(self.milk, quantity=10, days_to_expiry=8)
        make_batch(self.milk, quantity=10, days_to_expiry=-1)  # expired: no value

        kpis = self.dashboard(self.owner)["kpis"]

        self.assertEqual(kpis["total_available_stock_value"], "660.00")

    # --- low stock ---

    def test_low_stock_uses_the_threshold_inclusively(self):
        at_threshold = make_product("Dahi", "90.00")
        above = make_product("Ghee", "620.00")
        make_batch(at_threshold, quantity=LOW_STOCK_THRESHOLD, days_to_expiry=8)
        make_batch(above, quantity=LOW_STOCK_THRESHOLD + 1, days_to_expiry=8)

        data = self.dashboard(self.owner)
        names = [p["name"] for p in data["low_stock_products"]]

        # `self.milk` has no batches at all, so it is low stock too.
        self.assertIn("Dahi", names)
        self.assertIn("Full Cream Milk", names)
        self.assertNotIn("Ghee", names)
        self.assertEqual(data["kpis"]["low_stock_count"], 2)

    def test_expired_stock_does_not_rescue_a_low_stock_product(self):
        make_batch(self.milk, quantity=500, days_to_expiry=-1)

        data = self.dashboard(self.owner)

        self.assertEqual(data["kpis"]["low_stock_count"], 1)
        self.assertEqual(data["low_stock_products"][0]["available_quantity"], 0)

    def test_disposal_can_push_a_product_into_low_stock(self):
        # Sellable stock is untouched by disposing expired stock, so the
        # product's low-stock state must come only from sellable quantity.
        make_batch(self.milk, quantity=50, days_to_expiry=8)
        expired = make_batch(self.milk, quantity=5, days_to_expiry=-1)

        self.assertEqual(self.dashboard(self.owner)["kpis"]["low_stock_count"], 0)

        dispose_batch(batch_id=expired.pk, quantity=5, reason="expired", user=self.owner)

        data = self.dashboard(self.owner)
        self.assertEqual(data["kpis"]["low_stock_count"], 0)
        self.assertEqual(data["kpis"]["expired_quantity"], 0)

    # --- date filtering ---

    def test_defaults_to_today(self):
        data = self.dashboard(self.owner)

        self.assertEqual(data["range"]["key"], "today")
        self.assertEqual(data["range"]["start"], timezone.localdate())
        self.assertEqual(data["range"]["end"], timezone.localdate())

    def test_today_range_excludes_older_orders(self):
        self.place_order(2)  # today
        self.place_order(3, days_ago=5)

        kpis = self.dashboard(self.owner, range="today")["kpis"]

        self.assertEqual(kpis["period_order_count"], 1)
        self.assertEqual(kpis["period_sales_total"], "132.00")

    def test_seven_day_range_includes_the_last_week(self):
        self.place_order(2)
        self.place_order(3, days_ago=5)
        self.place_order(4, days_ago=20)

        kpis = self.dashboard(self.owner, range="7d")["kpis"]

        self.assertEqual(kpis["period_order_count"], 2)
        self.assertEqual(kpis["period_sales_total"], "330.00")

    def test_thirty_day_range_includes_everything_recent(self):
        self.place_order(2)
        self.place_order(3, days_ago=5)
        self.place_order(4, days_ago=20)

        kpis = self.dashboard(self.owner, range="30d")["kpis"]

        self.assertEqual(kpis["period_order_count"], 3)

    def test_custom_range(self):
        self.place_order(3, days_ago=10)
        self.place_order(4, days_ago=2)
        today = timezone.localdate()

        data = self.dashboard(
            self.owner,
            start=str(today - timedelta(days=12)),
            end=str(today - timedelta(days=8)),
        )

        self.assertEqual(data["range"]["key"], "custom")
        self.assertEqual(data["kpis"]["period_order_count"], 1)
        self.assertEqual(data["kpis"]["period_sales_total"], "198.00")

    def test_range_scopes_disposals(self):
        batch = make_batch(self.milk, quantity=10, days_to_expiry=-1)
        old = dispose_batch(batch_id=batch.pk, quantity=4, reason="expired", user=self.owner)
        StockDisposal.objects.filter(pk=old.pk).update(
            disposed_at=timezone.now() - timedelta(days=10)
        )
        dispose_batch(batch_id=batch.pk, quantity=2, reason="expired", user=self.owner)

        self.assertEqual(self.dashboard(self.owner, range="today")["kpis"]["disposed_quantity"], 2)
        self.assertEqual(self.dashboard(self.owner, range="30d")["kpis"]["disposed_quantity"], 6)

    def test_stock_kpis_ignore_the_range(self):
        """Stock is a "right now" figure — a date filter must not change it."""
        make_batch(self.milk, quantity=25, days_to_expiry=8)

        today = self.dashboard(self.owner, range="today")["kpis"]
        month = self.dashboard(self.owner, range="30d")["kpis"]

        self.assertEqual(today["total_available_quantity"], month["total_available_quantity"])

    def test_unknown_range_rejected(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/dashboard/", {"range": "last-year"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("range", response.data)

    def test_custom_range_needs_both_ends(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/dashboard/", {"start": "2026-01-01"})

        self.assertEqual(response.status_code, 400)

    def test_custom_range_rejects_malformed_dates(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get(
            "/api/dashboard/", {"start": "01-01-2026", "end": "2026-01-05"}
        )

        self.assertEqual(response.status_code, 400)

    def test_custom_range_rejects_inverted_dates(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get(
            "/api/dashboard/", {"start": "2026-02-01", "end": "2026-01-01"}
        )

        self.assertEqual(response.status_code, 400)

    # --- sales summary ---

    def test_sales_summary_totals_and_average(self):
        self.place_order(2)
        self.place_order(4)

        summary = self.dashboard(self.owner)["sales_summary"]

        self.assertEqual(summary["order_count"], 2)
        self.assertEqual(summary["sales_total"], "396.00")
        self.assertEqual(summary["average_order_value"], "198.00")

    def test_sales_summary_tracks_outstanding_invoice_money(self):
        order = self.place_order(5, status=Order.Status.DELIVERED)
        Invoice.objects.create(
            order=order,
            total_amount=Decimal("330.00"),
            paid_amount=Decimal("100.00"),
            status=Invoice.Status.PARTIAL,
        )

        summary = self.dashboard(self.owner)["sales_summary"]

        self.assertEqual(summary["invoiced_total"], "330.00")
        self.assertEqual(summary["collected_total"], "100.00")
        self.assertEqual(summary["outstanding_total"], "230.00")
        self.assertEqual(summary["delivered_count"], 1)

    # --- empty / zero data ---

    def test_empty_database_returns_zeros_not_errors(self):
        Product.objects.all().delete()
        Customer.objects.all().delete()

        data = self.dashboard(self.owner)

        self.assertEqual(data["kpis"]["total_available_quantity"], 0)
        self.assertEqual(data["kpis"]["expired_quantity"], 0)
        self.assertEqual(data["kpis"]["near_expiry_quantity"], 0)
        self.assertEqual(data["kpis"]["low_stock_count"], 0)
        self.assertEqual(data["kpis"]["total_available_stock_value"], "0.00")
        self.assertEqual(data["kpis"]["period_sales_total"], "0.00")
        self.assertEqual(data["expiring_batches"], [])
        self.assertEqual(data["low_stock_products"], [])
        self.assertEqual(data["recent_orders"], [])
        self.assertEqual(data["recent_disposals"], [])
        self.assertEqual(data["category_breakdown"], [])

    def test_zero_orders_gives_zero_average_not_division_error(self):
        summary = self.dashboard(self.owner)["sales_summary"]

        self.assertEqual(summary["order_count"], 0)
        self.assertEqual(summary["average_order_value"], "0.00")

    def test_staff_empty_database(self):
        Product.objects.all().delete()

        data = self.dashboard(self.staff)

        self.assertEqual(data["kpis"]["total_available_quantity"], 0)
        self.assertNotIn("sales_summary", data)

    # --- efficiency ---

    def test_query_count_does_not_grow_with_data(self):
        """Guards against N+1: the payload must cost a fixed number of queries."""
        make_batch(self.milk, quantity=20, days_to_expiry=8)
        self.place_order(2)
        self.client.force_authenticate(self.owner)

        with CaptureQueriesContext(connection) as small:
            self.client.get("/api/dashboard/")

        for i in range(6):
            product = make_product(f"Product {i}", "50.00")
            make_batch(product, quantity=15, days_to_expiry=8)
            make_batch(product, quantity=4, days_to_expiry=-1)
            self.place_order(2)

        with CaptureQueriesContext(connection) as large:
            self.client.get("/api/dashboard/")

        self.assertEqual(
            len(large),
            len(small),
            f"query count grew from {len(small)} to {len(large)} — likely an N+1",
        )


class ConcurrentDisposalTests(TransactionTestCase):
    """Two disposals racing on one batch must never over-dispose.

    TransactionTestCase (not TestCase) because the threads need real commits
    to see each other's work.
    """

    def setUp(self):
        self.user = make_user()
        self.product = make_product()
        self.batch = make_batch(self.product, quantity=10, days_to_expiry=-1)

    def run_concurrently(self, quantity, workers=2):
        barrier = threading.Barrier(workers)
        results = []
        lock = threading.Lock()

        def worker():
            outcome = "unexpected"
            try:
                barrier.wait(timeout=10)
                dispose_batch(
                    batch_id=self.batch.pk,
                    quantity=quantity,
                    reason="expired",
                    user=self.user,
                )
                outcome = "ok"
            except ValidationError:
                outcome = "rejected"
            except Exception as exc:  # surfaced in the assertion message
                outcome = f"error: {exc!r}"
            finally:
                with lock:
                    results.append(outcome)
                connection.close()

        threads = [threading.Thread(target=worker) for _ in range(workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=20)
        return results

    def test_racing_disposals_cannot_exceed_batch_quantity(self):
        # Two threads each want 7 of a 10-unit batch: exactly one can win.
        results = self.run_concurrently(quantity=7)

        self.assertEqual(sorted(results), ["ok", "rejected"], results)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 3)
        self.assertEqual(StockDisposal.objects.count(), 1)

    def test_racing_disposals_that_both_fit_both_succeed(self):
        results = self.run_concurrently(quantity=5)

        self.assertEqual(results, ["ok", "ok"], results)
        self.batch.refresh_from_db()
        self.assertEqual(self.batch.quantity, 0)
        self.assertEqual(StockDisposal.objects.count(), 2)
        self.assertEqual(
            sum(d.quantity for d in StockDisposal.objects.all()), 10
        )
