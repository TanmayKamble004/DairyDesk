"""Role-gating tests (spec section 4: staff cannot see financial data)."""
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Product, StockBatch, User

STOCK_BATCHES_URL = "/api/stock-batches/"


class PurchasePriceVisibilityTests(APITestCase):
    """`purchase_price` is the factory buying price — owner-only on read.

    Staff keep the "receive stock" workflow, so they may still POST a price;
    what they must not be able to do is read cost data back and derive the
    margin on every product.
    """

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-test", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-test", password="pw", role=User.Role.STAFF
        )
        cls.product = Product.objects.create(
            name="Full Cream Milk",
            category="Milk",
            unit=Product.Unit.LITRE,
            selling_price="66.00",
        )
        cls.batch = StockBatch.objects.create(
            product=cls.product,
            quantity=40,
            purchase_price="58.00",
            expiry_date=timezone.localdate() + timedelta(days=5),
        )

    def receive_stock_payload(self):
        return {
            "product": self.product.id,
            "quantity": 12,
            "purchase_price": "57.50",
            "expiry_date": (timezone.localdate() + timedelta(days=6)).isoformat(),
            "received_date": timezone.localdate().isoformat(),
        }

    def test_owner_sees_purchase_price(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get(STOCK_BATCHES_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data[0]["purchase_price"], "58.00")

    def test_staff_cannot_see_purchase_price(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get(STOCK_BATCHES_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn("purchase_price", res.data[0])

    def test_staff_still_sees_the_rest_of_the_batch(self):
        """Hiding cost must not break the batch listing itself."""
        self.client.force_authenticate(self.staff)
        res = self.client.get(STOCK_BATCHES_URL)
        row = res.data[0]
        self.assertEqual(row["product_name"], "Full Cream Milk")
        self.assertEqual(row["quantity"], 40)
        self.assertEqual(row["expiry_status"], StockBatch.STATUS_FRESH)

    def test_staff_can_still_receive_stock(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(STOCK_BATCHES_URL, self.receive_stock_payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = StockBatch.objects.get(id=res.data["id"])
        self.assertEqual(str(created.purchase_price), "57.50")

    def test_create_response_hides_price_from_staff(self):
        """The POST echo is a read too — it must not leak the price back."""
        self.client.force_authenticate(self.staff)
        res = self.client.post(STOCK_BATCHES_URL, self.receive_stock_payload())
        self.assertNotIn("purchase_price", res.data)

    def test_create_response_keeps_price_for_owner(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(STOCK_BATCHES_URL, self.receive_stock_payload())
        self.assertEqual(res.data["purchase_price"], "57.50")

    def test_anonymous_cannot_reach_batches(self):
        res = self.client.get(STOCK_BATCHES_URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class DashboardRoleTests(APITestCase):
    """Financial KPIs stay owner-only (regression cover for the shared helper)."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-kpi", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-kpi", password="pw", role=User.Role.STAFF
        )

    def test_owner_gets_financial_kpis(self):
        self.client.force_authenticate(self.owner)
        res = self.client.get("/api/dashboard/")
        self.assertIn("total_available_stock_value", res.data)
        self.assertIn("todays_sales_total", res.data)
        self.assertIn("unpaid_invoice_count", res.data)

    def test_staff_gets_no_financial_kpis(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get("/api/dashboard/")
        self.assertNotIn("total_available_stock_value", res.data)
        self.assertNotIn("todays_sales_total", res.data)
        self.assertNotIn("unpaid_invoice_count", res.data)
        # Non-financial KPIs still reach staff.
        self.assertIn("todays_order_count", res.data)
