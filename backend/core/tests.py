"""Role-gating tests (spec section 4: staff cannot see financial data)."""
import io
import os
import shutil
import tempfile
from datetime import timedelta
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .management.commands import seed_demo
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
    ageing_window_days,
)
from .services import ensure_invoice, next_invoice_number

STOCK_BATCHES_URL = "/api/stock-batches/"
INVENTORY_SUMMARY_URL = "/api/inventory/status-summary/"
PRODUCTS_URL = "/api/products/"
CATEGORIES_URL = "/api/products/categories/"
SUPPLIERS_URL = "/api/suppliers/"
PURCHASE_ORDERS_URL = "/api/purchase-orders/"
CUSTOMERS_URL = "/api/customers/"
STAFF_URL = "/api/staff/"
LOGIN_URL = "/api/auth/login/"


def make_supplier(name="Sunrise Dairy Co.", **overrides):
    """A valid supplier — products need one, so most fixtures start here."""
    return Supplier.objects.create(
        name=name,
        contact_person="Meera Kulkarni",
        phone="+91 98220 41220",
        email="orders@sunrisedairy.in",
        products_supplied=3,
        last_order_date=timezone.localdate() - timedelta(days=1),
        rating="4.8",
        **overrides,
    )


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
            sku="MLK-1001",
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


# Uploads land in a throwaway directory so the test run never writes into
# MEDIA_ROOT alongside real product photos.
MEDIA_TMP = tempfile.mkdtemp(prefix="dairydesk-test-media-")


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class ProductCreationTests(APITestCase):
    """Catalogue entry: both roles create products, photo optional."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-catalogue", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-catalogue", password="pw", role=User.Role.STAFF
        )
        cls.supplier = make_supplier("Sunrise Dairy Co.")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def payload(self, **overrides):
        return {
            "name": "Amul Gold Milk 1L",
            "sku": "dry-1001",
            "category": "Dairy",
            "supplier": self.supplier.id,
            "unit": Product.Unit.LITRE,
            "selling_price": "68.00",
            "description": "Full cream, blue pouch.",
            "reorder_threshold": 40,
            "reorder_quantity": 100,
            **overrides,
        }

    @staticmethod
    def image_file():
        buffer = io.BytesIO()
        Image.new("RGB", (4, 4), "white").save(buffer, format="PNG")
        return SimpleUploadedFile("milk.png", buffer.getvalue(), content_type="image/png")

    def test_staff_can_create_a_product_with_reorder_levels(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(PRODUCTS_URL, self.payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(id=res.data["id"])
        self.assertEqual(product.reorder_threshold, 40)
        self.assertEqual(product.reorder_quantity, 100)
        # SKUs are normalised, so casing can't create a near-duplicate.
        self.assertEqual(product.sku, "DRY-1001")

    def test_owner_can_upload_an_image(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(
            PRODUCTS_URL,
            self.payload(image=self.image_file()),
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        product = Product.objects.get(id=res.data["id"])
        self.assertTrue(product.image.name.startswith("products/"))

    def test_image_is_optional(self):
        """Cancelling the image just means the field never gets sent."""
        self.client.force_authenticate(self.staff)
        res = self.client.post(PRODUCTS_URL, self.payload(), format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Product.objects.get(id=res.data["id"]).image)
        self.assertIsNone(res.data["image"])

    def test_duplicate_sku_is_rejected(self):
        self.client.force_authenticate(self.staff)
        self.client.post(PRODUCTS_URL, self.payload())
        res = self.client.post(PRODUCTS_URL, self.payload(name="Another milk"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sku", res.data)

    def test_reorder_quantity_below_threshold_is_rejected(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            PRODUCTS_URL, self.payload(reorder_threshold=40, reorder_quantity=10)
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reorder_quantity", res.data)

    def test_listing_reports_stock_status_against_the_threshold(self):
        self.client.force_authenticate(self.staff)
        created = self.client.post(PRODUCTS_URL, self.payload()).data
        product = Product.objects.get(id=created["id"])
        StockBatch.objects.create(
            product=product,
            quantity=5,  # below the threshold of 40
            purchase_price="60.00",
            expiry_date=timezone.localdate() + timedelta(days=5),
        )
        row = next(
            p for p in self.client.get(PRODUCTS_URL).data if p["id"] == product.id
        )
        self.assertEqual(row["available_quantity"], 5)
        self.assertEqual(row["stock_status"], "low_stock")

    def test_every_field_but_image_and_description_is_required(self):
        """The form marks these mandatory; the API has to agree."""
        self.client.force_authenticate(self.staff)
        for field in [
            "name",
            "sku",
            "category",
            "supplier",
            "unit",
            "selling_price",
            "reorder_threshold",
            "reorder_quantity",
        ]:
            with self.subTest(missing=field):
                payload = self.payload()
                payload.pop(field)
                res = self.client.post(PRODUCTS_URL, payload)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, res.data)

    def test_supplier_is_assigned_and_named_back(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(PRODUCTS_URL, self.payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["supplier"], self.supplier.id)
        # The list column reads the name, not the id.
        self.assertEqual(res.data["supplier_name"], "Sunrise Dairy Co.")
        self.assertEqual(
            Product.objects.get(id=res.data["id"]).supplier_id, self.supplier.id
        )

    def test_unknown_supplier_is_rejected(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(PRODUCTS_URL, self.payload(supplier=9999))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("supplier", res.data)

    def test_description_is_optional(self):
        """Not every SKU needs a note; blank and absent both mean 'none'."""
        self.client.force_authenticate(self.staff)
        blank = self.payload(description="")
        self.assertEqual(
            self.client.post(PRODUCTS_URL, blank).status_code, status.HTTP_201_CREATED
        )
        absent = self.payload(sku="dry-1002")
        absent.pop("description")
        res = self.client.post(PRODUCTS_URL, absent)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Product.objects.get(id=res.data["id"]).description, "")

    def test_zero_reorder_levels_are_accepted(self):
        """Required means present, not non-zero: 0 is a real threshold."""
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            PRODUCTS_URL, self.payload(reorder_threshold=0, reorder_quantity=0)
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_anonymous_cannot_create_a_product(self):
        res = self.client.post(PRODUCTS_URL, self.payload())
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


@override_settings(MEDIA_ROOT=MEDIA_TMP)
class ProductEditTests(APITestCase):
    """Editing and deleting a product from the catalogue page."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-edit", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-edit", password="pw", role=User.Role.STAFF
        )

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA_TMP, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.supplier = make_supplier()
        self.product = Product.objects.create(
            name="Toned Milk",
            sku="MLK-1002",
            category="Milk",
            supplier=self.supplier,
            unit=Product.Unit.LITRE,
            selling_price="54.00",
            description="Blue pouch.",
            reorder_threshold=25,
            reorder_quantity=70,
        )
        self.url = f"{PRODUCTS_URL}{self.product.id}/"

    def payload(self, **overrides):
        return {
            "name": "Toned Milk",
            "sku": "MLK-1002",
            "category": "Milk",
            "supplier": self.supplier.id,
            "unit": Product.Unit.LITRE,
            "selling_price": "54.00",
            "description": "Blue pouch.",
            "reorder_threshold": 25,
            "reorder_quantity": 70,
            **overrides,
        }

    def test_staff_can_update_a_product(self):
        self.client.force_authenticate(self.staff)
        res = self.client.put(
            self.url, self.payload(selling_price="58.00", reorder_threshold=30)
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertEqual(str(self.product.selling_price), "58.00")
        self.assertEqual(self.product.reorder_threshold, 30)

    def test_keeping_its_own_sku_is_not_a_duplicate(self):
        """The uniqueness check has to exclude the row being edited."""
        self.client.force_authenticate(self.staff)
        res = self.client.put(self.url, self.payload(name="Toned Milk 500ml"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_taking_another_products_sku_is_rejected(self):
        Product.objects.create(
            name="Ghee",
            sku="FAT-4001",
            category="Fats",
            unit=Product.Unit.KG,
            selling_price="620.00",
        )
        self.client.force_authenticate(self.staff)
        res = self.client.put(self.url, self.payload(sku="fat-4001"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("sku", res.data)

    def test_clear_image_removes_the_stored_photo(self):
        self.product.image.save(
            "toned.png", ProductCreationTests.image_file(), save=True
        )
        stored = self.product.image.path
        self.client.force_authenticate(self.owner)
        res = self.client.put(
            self.url, self.payload(clear_image=True), format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.product.refresh_from_db()
        self.assertFalse(self.product.image)
        self.assertFalse(os.path.exists(stored))

    def test_owner_can_delete_an_unused_product(self):
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Product.objects.filter(id=self.product.id).exists())

    def test_staff_cannot_delete(self):
        self.client.force_authenticate(self.staff)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Product.objects.filter(id=self.product.id).exists())

    def test_deleting_a_stocked_product_is_refused(self):
        """Batches cascade, so an unchecked delete would erase stock silently."""
        StockBatch.objects.create(
            product=self.product,
            quantity=20,
            purchase_price="47.00",
            expiry_date=timezone.localdate() + timedelta(days=5),
        )
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("20 unit(s)", res.data["detail"])
        self.assertTrue(Product.objects.filter(id=self.product.id).exists())

    def test_deleting_an_ordered_product_is_refused(self):
        """OrderItem is PROTECT — without this check it would be a 500."""
        customer = Customer.objects.create(name="Patil Tea House", phone="9833445566")
        order = Order.objects.create(customer=customer)
        OrderItem.objects.create(
            order=order, product=self.product, quantity=3, unit_price="54.00"
        )
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("order line(s)", res.data["detail"])
        self.assertTrue(Product.objects.filter(id=self.product.id).exists())

    def test_deleting_removes_the_photo_from_disk(self):
        self.product.image.save(
            "toned.png", ProductCreationTests.image_file(), save=True
        )
        stored = self.product.image.path
        self.client.force_authenticate(self.owner)
        self.client.delete(self.url)
        self.assertFalse(os.path.exists(stored))


class SupplierTests(APITestCase):
    """Suppliers get the same treatment as products, minus the photo."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-supplier", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-supplier", password="pw", role=User.Role.STAFF
        )

    def setUp(self):
        self.supplier = Supplier.objects.create(
            name="Sunrise Dairy Co.",
            contact_person="Meera Kulkarni",
            phone="+91 98220 41220",
            email="orders@sunrisedairy.in",
            products_supplied=3,
            last_order_date=timezone.localdate() - timedelta(days=1),
            rating="4.8",
        )
        self.url = f"{SUPPLIERS_URL}{self.supplier.id}/"

    def payload(self, **overrides):
        return {
            "name": "Nova Foods Pvt Ltd",
            "contact_person": "Rajat Menon",
            "phone": "+91 98111 77304",
            "email": "supply@novafoods.com",
            "products_supplied": 2,
            "last_order_date": (timezone.localdate() - timedelta(days=2)).isoformat(),
            "rating": "4.4",
            **overrides,
        }

    def test_staff_can_create_a_supplier(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(SUPPLIERS_URL, self.payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        created = Supplier.objects.get(id=res.data["id"])
        self.assertEqual(created.contact_person, "Rajat Menon")
        self.assertEqual(str(created.rating), "4.4")

    def test_every_field_is_required(self):
        self.client.force_authenticate(self.staff)
        for field in self.payload():
            with self.subTest(missing=field):
                payload = self.payload()
                payload.pop(field)
                res = self.client.post(SUPPLIERS_URL, payload)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, res.data)

    def test_rating_above_five_is_rejected(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(SUPPLIERS_URL, self.payload(rating="5.4"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("rating", res.data)

    def test_future_last_order_is_rejected(self):
        self.client.force_authenticate(self.staff)
        future = (timezone.localdate() + timedelta(days=1)).isoformat()
        res = self.client.post(SUPPLIERS_URL, self.payload(last_order_date=future))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("last_order_date", res.data)

    def test_malformed_email_is_rejected(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(SUPPLIERS_URL, self.payload(email="not-an-email"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_staff_can_update_a_supplier(self):
        self.client.force_authenticate(self.staff)
        res = self.client.put(
            self.url,
            self.payload(name="Sunrise Dairy Co.", contact_person="Meera K.", rating="4.2"),
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.supplier.refresh_from_db()
        self.assertEqual(self.supplier.contact_person, "Meera K.")
        self.assertEqual(str(self.supplier.rating), "4.2")

    def test_owner_can_delete_a_supplier(self):
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Supplier.objects.filter(id=self.supplier.id).exists())

    def test_staff_cannot_delete_a_supplier(self):
        self.client.force_authenticate(self.staff)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Supplier.objects.filter(id=self.supplier.id).exists())

    def test_deleting_an_assigned_supplier_is_refused(self):
        """Product.supplier is PROTECT — without this check it would be a 500."""
        Product.objects.create(
            name="Full Cream Milk",
            sku="MLK-1001",
            category="Milk",
            supplier=self.supplier,
            unit=Product.Unit.LITRE,
            selling_price="66.00",
        )
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Full Cream Milk", res.data["detail"])
        self.assertTrue(Supplier.objects.filter(id=self.supplier.id).exists())

    def test_anonymous_cannot_reach_suppliers(self):
        self.assertEqual(
            self.client.get(SUPPLIERS_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )


class AutoReorderTests(APITestCase):
    """The 'auto submit' toggle: hitting the threshold raises a purchase order."""

    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(
            username="staff-reorder", password="pw", role=User.Role.STAFF
        )
        cls.customer = Customer.objects.create(name="Patil Tea House", phone="9833445566")

    def setUp(self):
        self.supplier = make_supplier()
        self.product = Product.objects.create(
            name="Toned Milk",
            sku="MLK-1002",
            category="Milk",
            supplier=self.supplier,
            unit=Product.Unit.LITRE,
            selling_price="54.00",
            reorder_threshold=10,
            reorder_quantity=50,
            auto_reorder=True,
        )
        self.client.force_authenticate(self.staff)

    def stock(self, quantity):
        return StockBatch.objects.create(
            product=self.product,
            quantity=quantity,
            purchase_price="47.00",
            expiry_date=timezone.localdate() + timedelta(days=10),
        )

    def sell(self, quantity):
        return self.client.post(
            "/api/orders/",
            {
                "customer": self.customer.id,
                "items": [{"product": self.product.id, "quantity": quantity}],
            },
            format="json",
        )

    def test_a_sale_onto_the_threshold_raises_an_order(self):
        self.stock(30)
        res = self.sell(25)  # leaves 5, at or below the threshold of 10
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        order = PurchaseOrder.objects.get(product=self.product)
        self.assertEqual(order.quantity, 50)
        self.assertEqual(order.supplier, self.supplier)
        self.assertEqual(order.status, PurchaseOrder.Status.PLACED)
        self.assertTrue(order.auto_generated)

    def test_a_sale_that_stays_above_the_threshold_raises_nothing(self):
        self.stock(30)
        self.sell(5)  # leaves 25, comfortably above 10
        self.assertFalse(PurchaseOrder.objects.exists())

    def test_the_toggle_off_raises_nothing(self):
        self.product.auto_reorder = False
        self.product.save(update_fields=["auto_reorder"])
        self.stock(30)
        self.sell(25)
        self.assertFalse(PurchaseOrder.objects.exists())

    def test_a_second_sale_does_not_stack_a_second_order(self):
        """Stock already on its way must not be ordered again on every sale."""
        self.stock(30)
        self.sell(25)
        self.sell(3)
        self.assertEqual(PurchaseOrder.objects.count(), 1)

    def test_turning_the_toggle_on_below_threshold_orders_immediately(self):
        """Flipping the switch on a product already low should not wait."""
        self.product.auto_reorder = False
        self.product.save(update_fields=["auto_reorder"])
        self.stock(4)
        res = self.client.patch(
            f"{PRODUCTS_URL}{self.product.id}/", {"auto_reorder": True}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(PurchaseOrder.objects.filter(product=self.product).count(), 1)
        # The response tells the form so it can say an order went out.
        self.assertEqual(res.data["open_purchase_order"]["quantity"], 50)

    def test_receiving_stock_closes_the_order(self):
        self.stock(30)
        self.sell(25)
        order = PurchaseOrder.objects.get(product=self.product)
        self.client.post(
            STOCK_BATCHES_URL,
            {
                "product": self.product.id,
                "quantity": 50,
                "purchase_price": "47.00",
                "expiry_date": (timezone.localdate() + timedelta(days=10)).isoformat(),
                "received_date": timezone.localdate().isoformat(),
            },
        )
        order.refresh_from_db()
        self.assertEqual(order.status, PurchaseOrder.Status.RECEIVED)

    def test_reordering_resumes_after_a_delivery(self):
        """Closing the loop must not leave the product permanently blocked."""
        self.stock(30)
        self.sell(25)
        self.client.post(
            STOCK_BATCHES_URL,
            {
                "product": self.product.id,
                "quantity": 50,
                "purchase_price": "47.00",
                "expiry_date": (timezone.localdate() + timedelta(days=10)).isoformat(),
                "received_date": timezone.localdate().isoformat(),
            },
        )
        self.sell(50)  # back down to 5
        self.assertEqual(
            PurchaseOrder.objects.filter(status=PurchaseOrder.Status.PLACED).count(), 1
        )
        self.assertEqual(PurchaseOrder.objects.count(), 2)

    def test_auto_reorder_without_a_quantity_is_rejected(self):
        res = self.client.patch(
            f"{PRODUCTS_URL}{self.product.id}/",
            {"auto_reorder": True, "reorder_quantity": 0},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reorder_quantity", res.data)

    def test_purchase_orders_are_listed_for_a_product(self):
        self.stock(30)
        self.sell(25)
        res = self.client.get(f"{PURCHASE_ORDERS_URL}?product={self.product.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["product_name"], "Toned Milk")
        self.assertEqual(res.data[0]["supplier_name"], "Sunrise Dairy Co.")

    def test_anonymous_cannot_read_purchase_orders(self):
        self.client.force_authenticate(None)
        self.assertEqual(
            self.client.get(PURCHASE_ORDERS_URL).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


class InvoiceNumberTests(APITestCase):
    """Every bill carries a unique number and the date it was raised."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-invoice", password="pw", role=User.Role.OWNER
        )
        cls.customer = Customer.objects.create(name="Cafe Aroma", phone="9812233445")

    def setUp(self):
        self.supplier = make_supplier()
        self.product = Product.objects.create(
            name="Toned Milk",
            sku="MLK-1002",
            category="Milk",
            supplier=self.supplier,
            unit=Product.Unit.LITRE,
            selling_price="54.00",
        )
        StockBatch.objects.create(
            product=self.product,
            quantity=500,
            purchase_price="47.00",
            expiry_date=timezone.localdate() + timedelta(days=10),
        )
        self.client.force_authenticate(self.owner)

    def deliver_an_order(self, quantity=2):
        """Place an order and walk it to delivered, which raises the invoice."""
        order = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer.id,
                "items": [{"product": self.product.id, "quantity": quantity}],
            },
            format="json",
        ).data
        for status_name in ["processed", "delivered"]:
            self.client.patch(
                f"/api/orders/{order['id']}/", {"status": status_name}, format="json"
            )
        return Invoice.objects.get(order_id=order["id"])

    def test_delivery_raises_a_numbered_dated_invoice(self):
        invoice = self.deliver_an_order()
        self.assertEqual(invoice.number, f"INV-{timezone.localdate().year}-0001")
        self.assertIsNotNone(invoice.created_at)

    def test_numbers_run_in_sequence(self):
        numbers = [self.deliver_an_order().number for _ in range(3)]
        year = timezone.localdate().year
        self.assertEqual(
            numbers, [f"INV-{year}-0001", f"INV-{year}-0002", f"INV-{year}-0003"]
        )

    def test_the_sequence_restarts_each_year(self):
        Invoice.objects.create(
            order=Order.objects.create(customer=self.customer),
            number="INV-2025-0009",
            total_amount="100.00",
        )
        self.assertEqual(next_invoice_number(), f"INV-{timezone.localdate().year}-0001")

    def test_a_deleted_bill_does_not_free_its_number(self):
        """Numbering reads the newest row, not a count, so gaps stay gaps."""
        first = self.deliver_an_order()
        second = self.deliver_an_order()
        first.delete()
        year = timezone.localdate().year
        self.assertEqual(second.number, f"INV-{year}-0002")
        self.assertEqual(next_invoice_number(), f"INV-{year}-0003")

    def test_numbers_are_unique_in_the_database(self):
        taken = self.deliver_an_order().number
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Invoice.objects.create(
                    order=Order.objects.create(customer=self.customer),
                    number=taken,
                    total_amount="10.00",
                )

    def test_re_delivering_does_not_raise_a_second_invoice(self):
        """ensure_invoice is idempotent — and must not burn a number either."""
        invoice = self.deliver_an_order()
        again = ensure_invoice(invoice.order)
        self.assertEqual(again.pk, invoice.pk)
        self.assertEqual(again.number, invoice.number)
        self.assertEqual(Invoice.objects.count(), 1)

    def test_the_api_reports_the_number_and_date(self):
        self.deliver_an_order()
        row = self.client.get("/api/invoices/").data[0]
        self.assertEqual(row["number"], f"INV-{timezone.localdate().year}-0001")
        self.assertIn("created_at", row)

    def test_the_number_cannot_be_set_over_the_api(self):
        """It is the bill's identity, not a field anyone edits."""
        self.deliver_an_order()
        invoice = Invoice.objects.get()
        res = self.client.patch(
            f"/api/invoices/{invoice.id}/", {"number": "INV-2026-9999"}, format="json"
        )
        # The viewset is read-only, so this is refused outright.
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        invoice.refresh_from_db()
        self.assertNotEqual(invoice.number, "INV-2026-9999")

    def test_newest_bill_is_listed_first(self):
        self.deliver_an_order()
        newest = self.deliver_an_order()
        self.assertEqual(self.client.get("/api/invoices/").data[0]["number"], newest.number)


class CustomerTests(APITestCase):
    """Customers are added from the order form and removed only by the owner."""

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-customer", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-customer", password="pw", role=User.Role.STAFF
        )

    def setUp(self):
        self.customer = Customer.objects.create(
            name="Sharma General Store",
            phone="9820011223",
            address="Shop 4, SV Road, Andheri West",
        )
        self.url = f"{CUSTOMERS_URL}{self.customer.id}/"

    def test_staff_can_add_a_customer_mid_order(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            CUSTOMERS_URL,
            {"name": "Cafe Aroma", "phone": "9812233445", "address": "FC Road, Pune"},
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.get(id=res.data["id"]).name, "Cafe Aroma")

    def test_name_and_phone_are_required(self):
        self.client.force_authenticate(self.staff)
        for field in ["name", "phone"]:
            with self.subTest(missing=field):
                payload = {"name": "Cafe Aroma", "phone": "9812233445"}
                payload.pop(field)
                res = self.client.post(CUSTOMERS_URL, payload)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, res.data)

    def test_address_is_optional(self):
        """A walk-in buyer has a name and a number, and nothing else."""
        self.client.force_authenticate(self.staff)
        res = self.client.post(CUSTOMERS_URL, {"name": "Walk-in", "phone": "9800000000"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Customer.objects.get(id=res.data["id"]).address, "")

    def test_owner_can_delete_an_unused_customer(self):
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Customer.objects.filter(id=self.customer.id).exists())

    def test_staff_cannot_delete_a_customer(self):
        self.client.force_authenticate(self.staff)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Customer.objects.filter(id=self.customer.id).exists())

    def test_deleting_a_customer_with_orders_is_refused(self):
        """Order.customer is PROTECT — without this check it would be a 500."""
        Order.objects.create(customer=self.customer)
        self.client.force_authenticate(self.owner)
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("1 order(s)", res.data["detail"])
        self.assertTrue(Customer.objects.filter(id=self.customer.id).exists())

    def test_anonymous_cannot_reach_customers(self):
        self.assertEqual(
            self.client.get(CUSTOMERS_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )


class StaffManagementTests(APITestCase):
    """The owner-only staff roster: add, disable, re-enable, reset passwords."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username="owner-staffadmin",
            password="pw",
            email="owner@dairydesk.local",
            first_name="Priya",
            last_name="Deshmukh",
            role=User.Role.OWNER,
        )
        self.member = User.objects.create_user(
            username="sneha",
            password="Kolhapur#2026",
            email="sneha@dairydesk.local",
            first_name="Sneha",
            last_name="Patil",
            role=User.Role.STAFF,
        )
        self.member_url = f"{STAFF_URL}{self.member.id}/"
        self.client.force_authenticate(self.owner)

    def payload(self, **overrides):
        return {
            "username": "amit",
            "first_name": "Amit",
            "last_name": "Shirke",
            "email": "amit@dairydesk.local",
            "role": User.Role.STAFF,
            "password": "Ratnagiri#2026",
            **overrides,
        }

    # --- Access ---------------------------------------------------------

    def test_staff_cannot_reach_the_roster(self):
        """The whole surface is owner-only, reads included."""
        self.client.force_authenticate(self.member)
        refused = self.client.get(STAFF_URL)
        self.assertEqual(refused.status_code, status.HTTP_403_FORBIDDEN)
        # Not the inherited "financial data" wording — this gate is not money.
        self.assertIn("manage staff", refused.data["detail"])
        self.assertEqual(
            self.client.post(STAFF_URL, self.payload()).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(self.member_url, {"is_active": False}).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_anonymous_cannot_reach_the_roster(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(STAFF_URL).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_owners_are_listed_before_staff(self):
        res = self.client.get(STAFF_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual([row["role"] for row in res.data], ["owner", "staff"])
        self.assertEqual(res.data[0]["full_name"], "Priya Deshmukh")

    # --- Adding ---------------------------------------------------------

    def test_owner_can_add_a_member_who_can_then_sign_in(self):
        res = self.client.post(STAFF_URL, self.payload())
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        added = User.objects.get(username="amit")
        self.assertEqual(added.role, User.Role.STAFF)
        self.assertTrue(added.is_active)

        self.client.force_authenticate(None)
        signin = self.client.post(
            LOGIN_URL, {"username": "amit", "password": "Ratnagiri#2026"}
        )
        self.assertEqual(signin.status_code, status.HTTP_200_OK)
        self.assertEqual(signin.data["role"], "staff")

    def test_the_password_is_hashed_and_never_read_back(self):
        res = self.client.post(STAFF_URL, self.payload())
        self.assertNotIn("password", res.data)
        added = User.objects.get(username="amit")
        self.assertNotEqual(added.password, "Ratnagiri#2026")
        self.assertTrue(added.check_password("Ratnagiri#2026"))

    def test_a_member_can_be_added_as_an_owner(self):
        res = self.client.post(STAFF_URL, self.payload(role=User.Role.OWNER))
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(username="amit").role, User.Role.OWNER)

    def test_a_weak_password_is_refused(self):
        res = self.client.post(STAFF_URL, self.payload(password="123"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", res.data)
        self.assertFalse(User.objects.filter(username="amit").exists())

    def test_a_password_that_is_just_the_username_is_refused(self):
        """The similarity validator needs the user it is comparing against."""
        res = self.client.post(STAFF_URL, self.payload(password="amit"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", res.data)

    def test_a_member_without_a_password_is_refused(self):
        payload = self.payload()
        payload.pop("password")
        res = self.client.post(STAFF_URL, payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", res.data)

    def test_name_and_email_are_required(self):
        for field in ["username", "first_name", "email"]:
            with self.subTest(missing=field):
                payload = self.payload()
                payload.pop(field)
                res = self.client.post(STAFF_URL, payload)
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, res.data)

    def test_a_duplicate_username_is_refused(self):
        res = self.client.post(STAFF_URL, self.payload(username="sneha"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", res.data)

    def test_a_duplicate_email_is_refused(self):
        """Not a database constraint, so the serializer has to catch it."""
        res = self.client.post(STAFF_URL, self.payload(email="SNEHA@dairydesk.local"))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", res.data)

    def test_keeping_your_own_email_while_editing_is_not_a_duplicate(self):
        res = self.client.patch(self.member_url, {"email": "sneha@dairydesk.local"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    # --- Disabling and re-enabling --------------------------------------

    def test_disabling_stops_the_member_signing_in(self):
        res = self.client.patch(self.member_url, {"is_active": False})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertFalse(User.objects.get(pk=self.member.pk).is_active)

        self.client.force_authenticate(None)
        signin = self.client.post(
            LOGIN_URL, {"username": "sneha", "password": "Kolhapur#2026"}
        )
        self.assertEqual(signin.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_a_disabled_member_keeps_their_order_history(self):
        """The point of disabling rather than deleting: nothing is orphaned."""
        self.client.patch(self.member_url, {"is_active": False})
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())
        self.assertEqual(User.objects.get(pk=self.member.pk).username, "sneha")

    def test_re_enabling_restores_the_login(self):
        self.member.is_active = False
        self.member.save(update_fields=["is_active"])
        res = self.client.patch(self.member_url, {"is_active": True})
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(None)
        signin = self.client.post(
            LOGIN_URL, {"username": "sneha", "password": "Kolhapur#2026"}
        )
        self.assertEqual(signin.status_code, status.HTTP_200_OK)

    def test_a_disabled_members_existing_token_stops_working(self):
        """Switching someone off has to end the session, not just the next login."""
        token = self.client.post(
            LOGIN_URL, {"username": "sneha", "password": "Kolhapur#2026"}
        ).data["access"]
        self.client.patch(self.member_url, {"is_active": False})

        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(
            self.client.get(PRODUCTS_URL).status_code, status.HTTP_401_UNAUTHORIZED
        )

    def test_nobody_can_be_deleted(self):
        res = self.client.delete(self.member_url)
        self.assertEqual(res.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(User.objects.filter(pk=self.member.pk).exists())

    # --- Lockout guards --------------------------------------------------

    def test_an_owner_cannot_disable_themselves(self):
        res = self.client.patch(f"{STAFF_URL}{self.owner.id}/", {"is_active": False})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(User.objects.get(pk=self.owner.pk).is_active)

    def test_an_owner_cannot_demote_themselves(self):
        res = self.client.patch(f"{STAFF_URL}{self.owner.id}/", {"role": User.Role.STAFF})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(User.objects.get(pk=self.owner.pk).role, User.Role.OWNER)

    def test_the_last_owner_cannot_be_disabled_by_another_owner(self):
        second = User.objects.create_user(
            username="second-owner",
            password="pw",
            email="second@dairydesk.local",
            first_name="Rohit",
            role=User.Role.OWNER,
        )
        # The second owner disables the first — allowed, two owners exist.
        self.client.force_authenticate(second)
        first = self.client.patch(f"{STAFF_URL}{self.owner.id}/", {"is_active": False})
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        # Now `second` is the only active owner, and nobody may switch it off.
        self.client.force_authenticate(self.owner)  # still authorised in-process
        res = self.client.patch(f"{STAFF_URL}{second.id}/", {"is_active": False})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("only active owner", res.data["detail"])
        self.assertTrue(User.objects.get(pk=second.pk).is_active)

    def test_promoting_a_member_to_owner_is_allowed(self):
        res = self.client.patch(self.member_url, {"role": User.Role.OWNER})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects.get(pk=self.member.pk).role, User.Role.OWNER)

    # --- Password resets -------------------------------------------------

    def test_owner_can_reset_a_forgotten_password(self):
        res = self.client.post(
            f"{self.member_url}set-password/", {"password": "Panchgani#2026"}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("Panchgani#2026"))
        self.assertFalse(self.member.check_password("Kolhapur#2026"))

    def test_a_weak_reset_password_is_refused(self):
        res = self.client.post(f"{self.member_url}set-password/", {"password": "sneha"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("Kolhapur#2026"))

    def test_staff_cannot_reset_anyones_password(self):
        self.client.force_authenticate(self.member)
        res = self.client.post(
            f"{self.member_url}set-password/", {"password": "Panchgani#2026"}
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_a_detail_edit_cannot_carry_a_password(self):
        """Otherwise a routine name change could silently rewrite one."""
        res = self.client.patch(self.member_url, {"password": "Panchgani#2026"})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.member.refresh_from_db()
        self.assertTrue(self.member.check_password("Kolhapur#2026"))

    # --- Last login ------------------------------------------------------

    def test_last_login_starts_empty_and_is_recorded_on_sign_in(self):
        row = next(r for r in self.client.get(STAFF_URL).data if r["username"] == "sneha")
        self.assertIsNone(row["last_login"])

        self.client.force_authenticate(None)
        self.client.post(LOGIN_URL, {"username": "sneha", "password": "Kolhapur#2026"})

        self.client.force_authenticate(self.owner)
        row = next(r for r in self.client.get(STAFF_URL).data if r["username"] == "sneha")
        self.assertIsNotNone(row["last_login"])


class SeedDemoTests(TestCase):
    """seed_demo clears before it seeds, and PROTECT makes the order matter."""

    def test_reseeding_over_existing_data_succeeds(self):
        """Every PROTECT-ed reference must be cleared before its target.

        Running it twice is the point: the first pass builds the graph
        (products -> suppliers, purchase orders -> both), the second has to
        tear that graph down in an order Postgres accepts.
        """
        # seed_demo reports through self.stdout, which verbosity does not gate,
        # so it needs somewhere other than the test log to write.
        call_command("seed_demo", stdout=StringIO())

        # Give the second run a purchase order to trip over — the shape that
        # the docker entrypoint's empty-database seed never produces.
        product = Product.objects.first()
        stray = PurchaseOrder.objects.create(
            supplier=product.supplier, product=product, quantity=10
        )

        # seed_demo reports through self.stdout, which verbosity does not gate,
        # so it needs somewhere other than the test log to write.
        call_command("seed_demo", stdout=StringIO())

        # Counted from the seed's own tables rather than pinned to a number, so
        # editing the catalogue does not fail a test about deletion order.
        self.assertEqual(Supplier.objects.count(), len(seed_demo.SUPPLIERS))
        self.assertEqual(Product.objects.count(), len(seed_demo.CATALOGUE))
        self.assertFalse(PurchaseOrder.objects.filter(pk=stray.pk).exists())
        self.assertFalse(Product.objects.filter(supplier__isnull=True).exists())

    def test_the_seeded_shelf_shows_all_three_expiry_states(self):
        """The 3D shelf has three colours; an all-green seed demos only one."""
        call_command("seed_demo", stdout=StringIO())

        statuses = {batch.expiry_status for batch in StockBatch.objects.all()}
        self.assertEqual(
            statuses,
            {StockBatch.STATUS_FRESH, StockBatch.STATUS_AGEING, StockBatch.STATUS_EXPIRED},
        )

    def test_seeded_skus_and_prices_come_from_the_price_list(self):
        call_command("seed_demo", stdout=StringIO())

        for item in seed_demo.CATALOGUE:
            with self.subTest(sku=item.code):
                product = Product.objects.get(sku=item.code)
                self.assertEqual(str(product.selling_price), item.mrp)
                # Crate size drives the reorder levels; nothing stores it.
                self.assertEqual(product.reorder_threshold, item.per_crate)

    def test_seeded_batches_cost_what_the_price_list_charges(self):
        """Purchase price is the sheet's post-GST price, not the MRP."""
        call_command("seed_demo", stdout=StringIO())

        for item in seed_demo.CATALOGUE:
            batch = StockBatch.objects.filter(product__sku=item.code).first()
            if batch is None:
                continue  # a deliberately out-of-stock line
            with self.subTest(sku=item.code):
                self.assertEqual(str(batch.purchase_price), item.price_after_gst)
                self.assertEqual(batch.shelf_life_days, item.shelf_life_days)


class AgeingWindowTests(TestCase):
    """Ageing is a share of a batch's own shelf life, not a fixed cutoff.

    The catalogue runs from two-day milk sachets to year-long butter, so the
    old flat three-day rule marked milk ageing before it could ever be fresh
    and said nothing useful about ghee.
    """

    def setUp(self):
        self.supplier = make_supplier()
        self.today = timezone.localdate()

    def batch(self, shelf_life_days, days_left):
        """A batch of `shelf_life_days` life with `days_left` still to run."""
        product = Product.objects.create(
            name=f"Product {shelf_life_days}/{days_left}",
            sku=f"SKU-{shelf_life_days}-{days_left}",
            category="Milk",
            supplier=self.supplier,
            unit=Product.Unit.PIECE,
            selling_price="10.00",
        )
        expiry = self.today + timedelta(days=days_left)
        return StockBatch.objects.create(
            product=product,
            quantity=1,
            purchase_price="8.00",
            expiry_date=expiry,
            received_date=expiry - timedelta(days=shelf_life_days),
        )

    def test_window_scales_with_shelf_life(self):
        self.assertEqual(ageing_window_days(2), 1)  # milk sachet
        self.assertEqual(ageing_window_days(15), 4)  # curd sachet
        self.assertEqual(ageing_window_days(30), 8)  # paneer

    def test_window_is_floored_at_a_day(self):
        """Short-lived stock still gets one warning rather than none."""
        self.assertEqual(ageing_window_days(1), 1)
        self.assertEqual(ageing_window_days(0), 1)
        self.assertEqual(ageing_window_days(-5), 1)

    def test_window_is_capped_at_a_fortnight(self):
        """Otherwise a quarter of nine months would amber the ghee for weeks."""
        self.assertEqual(ageing_window_days(270), 14)
        self.assertEqual(ageing_window_days(365), 14)

    def test_milk_is_fresh_on_arrival_and_ageing_on_its_last_day(self):
        """The case the flat three-day rule could not express at all."""
        self.assertEqual(self.batch(2, 2).expiry_status, StockBatch.STATUS_FRESH)
        self.assertEqual(self.batch(2, 1).expiry_status, StockBatch.STATUS_AGEING)
        self.assertEqual(self.batch(2, 0).expiry_status, StockBatch.STATUS_AGEING)
        self.assertEqual(self.batch(2, -1).expiry_status, StockBatch.STATUS_EXPIRED)

    def test_ghee_with_a_month_left_is_still_fresh(self):
        """Under the old rule this was fresh too — but so was ghee with 4 days."""
        self.assertEqual(self.batch(270, 30).expiry_status, StockBatch.STATUS_FRESH)
        self.assertEqual(self.batch(270, 14).expiry_status, StockBatch.STATUS_AGEING)

    def test_the_same_days_left_can_read_either_way(self):
        """Ten days is most of a curd sachet's life left, and the tail of a lassi's.

        This is the whole point of the change: "days remaining" alone cannot
        decide the question, so two batches expiring on the same date get
        opposite answers.
        """
        self.assertEqual(self.batch(15, 10).expiry_status, StockBatch.STATUS_FRESH)
        self.assertEqual(self.batch(180, 10).expiry_status, StockBatch.STATUS_AGEING)


class CategoryLookupTests(APITestCase):
    """The product form's category dropdown reads back what's in use."""

    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(
            username="staff-category", password="pw", role=User.Role.STAFF
        )
        cls.supplier = make_supplier()
        for sku, category in [
            ("MLK-1", "Milk"),
            ("MLK-2", "Milk"),
            ("FAT-1", "Fats"),
        ]:
            Product.objects.create(
                name=f"Product {sku}",
                sku=sku,
                category=category,
                unit=Product.Unit.LITRE,
                selling_price="10.00",
            )

    def test_categories_are_distinct_and_sorted(self):
        self.client.force_authenticate(self.staff)
        res = self.client.get(CATEGORIES_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, ["Fats", "Milk"])

    def test_a_new_category_appears_once_its_product_is_saved(self):
        """There is no category table — saving the product creates it."""
        self.client.force_authenticate(self.staff)
        self.client.post(
            PRODUCTS_URL,
            {
                "name": "Kulfi",
                "sku": "FRZ-1",
                # Padded, to prove the write side trims before it is listed.
                "category": "  Frozen  ",
                "supplier": self.supplier.id,
                "unit": Product.Unit.PIECE,
                "selling_price": "40.00",
                "description": "Malai kulfi, six to a tray.",
                "reorder_threshold": 10,
                "reorder_quantity": 24,
            },
        )
        self.assertEqual(self.client.get(CATEGORIES_URL).data, ["Fats", "Frozen", "Milk"])

    def test_anonymous_cannot_read_categories(self):
        res = self.client.get(CATEGORIES_URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class ExpiredStockDisposalTests(APITestCase):
    """Writing expired stock off â€” the one action the Expired shelf page adds.

    Deliberately open to staff as well as the owner: whoever clears the shelf
    is who records it. What is gated here is not the role but the *stock* â€”
    only expired batches can be disposed of, and only once.
    """

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(
            username="owner-dispose", password="pw", role=User.Role.OWNER
        )
        cls.staff = User.objects.create_user(
            username="staff-dispose",
            password="pw",
            role=User.Role.STAFF,
            first_name="Anjali",
            last_name="Deshpande",
        )
        cls.product = Product.objects.create(
            name="Malai Paneer",
            sku="PNR-2001",
            category="Paneer",
            unit=Product.Unit.KG,
            selling_price="420.00",
        )

    def setUp(self):
        today = timezone.localdate()
        # Long-lived enough that "fresh" is genuinely fresh: the ageing window
        # is a quarter of shelf life, so a 40-day batch turns amber at day 30.
        self.fresh = StockBatch.objects.create(
            product=self.product,
            quantity=30,
            purchase_price="360.00",
            received_date=today,
            expiry_date=today + timedelta(days=40),
        )
        self.expired = StockBatch.objects.create(
            product=self.product,
            quantity=12,
            purchase_price="355.00",
            received_date=today - timedelta(days=20),
            expiry_date=today - timedelta(days=3),
        )

    def dispose_url(self, batch):
        return f"{STOCK_BATCHES_URL}{batch.id}/dispose/"

    def test_staff_can_dispose_of_expired_stock(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(
            self.dispose_url(self.expired), {"note": "Binned, off smell."}
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.expired.refresh_from_db()
        self.assertEqual(self.expired.quantity, 0)
        self.assertEqual(self.expired.disposed_quantity, 12)
        self.assertEqual(self.expired.disposed_by, self.staff)
        self.assertEqual(self.expired.disposal_note, "Binned, off smell.")
        self.assertIsNotNone(self.expired.disposed_at)

    def test_owner_can_dispose_too(self):
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.dispose_url(self.expired))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.disposed_by, self.owner)

    def test_the_note_is_optional(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(self.dispose_url(self.expired))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.expired.refresh_from_db()
        self.assertEqual(self.expired.disposal_note, "")

    def test_fresh_stock_cannot_be_disposed(self):
        """Fresh stock leaving the shelf is a loss or a sale, not a disposal."""
        self.client.force_authenticate(self.owner)
        res = self.client.post(self.dispose_url(self.fresh))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.fresh.refresh_from_db()
        self.assertEqual(self.fresh.quantity, 30)
        self.assertIsNone(self.fresh.disposed_at)

    def test_ageing_stock_cannot_be_disposed(self):
        today = timezone.localdate()
        ageing = StockBatch.objects.create(
            product=self.product,
            quantity=8,
            purchase_price="358.00",
            received_date=today - timedelta(days=18),
            expiry_date=today + timedelta(days=1),
        )
        self.assertEqual(ageing.expiry_status, StockBatch.STATUS_AGEING)

        self.client.force_authenticate(self.staff)
        res = self.client.post(self.dispose_url(ageing))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        ageing.refresh_from_db()
        self.assertEqual(ageing.quantity, 8)

    def test_disposing_twice_is_refused(self):
        self.client.force_authenticate(self.staff)
        self.client.post(self.dispose_url(self.expired))
        res = self.client.post(self.dispose_url(self.expired))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        self.expired.refresh_from_db()
        # The first disposal's figures survive the second attempt â€” a repeat
        # click must not overwrite "12 units written off" with zero.
        self.assertEqual(self.expired.disposed_quantity, 12)

    def test_anonymous_cannot_dispose(self):
        res = self.client.post(self.dispose_url(self.expired))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.expired.refresh_from_db()
        self.assertIsNone(self.expired.disposed_at)

    def test_the_disposal_is_reported_back_with_who_signed_it(self):
        self.client.force_authenticate(self.staff)
        res = self.client.post(self.dispose_url(self.expired), {"note": "Spoiled."})
        self.assertTrue(res.data["is_disposed"])
        self.assertEqual(res.data["disposed_by_name"], "Anjali Deshpande")
        self.assertEqual(res.data["disposed_quantity"], 12)
        self.assertEqual(res.data["quantity"], 0)

    def test_disposed_stock_leaves_the_shelf_summary(self):
        self.client.force_authenticate(self.staff)
        before = {row["status"]: row for row in self.client.get(INVENTORY_SUMMARY_URL).data}
        self.assertEqual(before[StockBatch.STATUS_EXPIRED]["quantity"], 12)

        self.client.post(self.dispose_url(self.expired))

        after = {row["status"]: row for row in self.client.get(INVENTORY_SUMMARY_URL).data}
        self.assertEqual(after[StockBatch.STATUS_EXPIRED]["quantity"], 0)
        self.assertEqual(after[StockBatch.STATUS_EXPIRED]["batch_count"], 0)
        # Disposing expired stock must not disturb what is still sellable.
        self.assertEqual(after[StockBatch.STATUS_FRESH]["quantity"], 30)


class ShelfStatusSummaryTests(APITestCase):
    """The three stacks the 3D shelf renders, and the pages behind them."""

    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_user(
            username="staff-shelf", password="pw", role=User.Role.STAFF
        )
        today = timezone.localdate()
        cls.milk = Product.objects.create(
            name="Toned Milk",
            sku="MLK-3001",
            category="Milk",
            unit=Product.Unit.LITRE,
            selling_price="54.00",
        )
        cls.ghee = Product.objects.create(
            name="Cow Ghee",
            sku="FAT-3002",
            category="Fats",
            unit=Product.Unit.KG,
            selling_price="720.00",
        )
        # Two fresh batches across two products, one ageing, one expired.
        cls.fresh_milk = StockBatch.objects.create(
            product=cls.milk,
            quantity=50,
            purchase_price="48.00",
            received_date=today,
            expiry_date=today + timedelta(days=40),
        )
        StockBatch.objects.create(
            product=cls.ghee,
            quantity=20,
            purchase_price="640.00",
            received_date=today,
            expiry_date=today + timedelta(days=300),
        )
        StockBatch.objects.create(
            product=cls.milk,
            quantity=9,
            purchase_price="47.00",
            received_date=today - timedelta(days=39),
            expiry_date=today + timedelta(days=1),
        )
        cls.expired_milk = StockBatch.objects.create(
            product=cls.milk,
            quantity=4,
            purchase_price="46.00",
            received_date=today - timedelta(days=45),
            expiry_date=today - timedelta(days=2),
        )

    def setUp(self):
        self.client.force_authenticate(self.staff)

    def summary(self):
        res = self.client.get(INVENTORY_SUMMARY_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return {row["status"]: row for row in res.data}

    def test_every_status_is_present_even_at_zero(self):
        """Three stacks, always â€” an empty one still reports nothing expired."""
        StockBatch.objects.all().delete()
        rows = self.client.get(INVENTORY_SUMMARY_URL).data
        self.assertEqual(
            [row["status"] for row in rows],
            [StockBatch.STATUS_EXPIRED, StockBatch.STATUS_AGEING, StockBatch.STATUS_FRESH],
        )
        self.assertTrue(all(row["quantity"] == 0 for row in rows))

    def test_quantities_and_counts_are_bucketed_by_status(self):
        rows = self.summary()
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["quantity"], 70)
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["batch_count"], 2)
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["product_count"], 2)
        self.assertEqual(rows[StockBatch.STATUS_AGEING]["quantity"], 9)
        self.assertEqual(rows[StockBatch.STATUS_EXPIRED]["quantity"], 4)

    def test_a_product_counts_once_per_status_not_once_per_batch(self):
        StockBatch.objects.create(
            product=self.milk,
            quantity=15,
            purchase_price="48.00",
            received_date=timezone.localdate(),
            expiry_date=timezone.localdate() + timedelta(days=40),
        )
        rows = self.summary()
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["batch_count"], 3)
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["product_count"], 2)

    def test_next_expiry_is_the_earliest_date_in_the_bucket(self):
        rows = self.summary()
        self.assertEqual(
            rows[StockBatch.STATUS_EXPIRED]["next_expiry"],
            timezone.localdate() - timedelta(days=2),
        )
        self.assertEqual(
            rows[StockBatch.STATUS_FRESH]["next_expiry"],
            timezone.localdate() + timedelta(days=40),
        )

    def test_sold_out_batches_are_off_the_shelf(self):
        self.fresh_milk.quantity = 0
        self.fresh_milk.save(update_fields=["quantity"])
        rows = self.summary()
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["quantity"], 20)
        self.assertEqual(rows[StockBatch.STATUS_FRESH]["batch_count"], 1)

    def test_batches_can_be_listed_by_status(self):
        """The filter behind each stack's page."""
        res = self.client.get(STOCK_BATCHES_URL, {"status": StockBatch.STATUS_EXPIRED})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["quantity"], 4)
        self.assertEqual(res.data[0]["product_name"], "Toned Milk")

    def test_an_unknown_status_filter_is_ignored_rather_than_erroring(self):
        res = self.client.get(STOCK_BATCHES_URL, {"status": "mouldy"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 4)

    def test_disposed_batches_can_be_listed_separately(self):
        self.expired_milk.dispose(self.staff, "Cleared at close.")

        listed = self.client.get(STOCK_BATCHES_URL, {"disposed": "true"}).data
        self.assertEqual([row["id"] for row in listed], [self.expired_milk.id])
        self.assertEqual(listed[0]["disposal_note"], "Cleared at close.")

        outstanding = self.client.get(
            STOCK_BATCHES_URL, {"status": StockBatch.STATUS_EXPIRED, "disposed": "false"}
        ).data
        self.assertEqual(outstanding, [])

    def test_the_summary_needs_a_login(self):
        self.client.force_authenticate(None)
        res = self.client.get(INVENTORY_SUMMARY_URL)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
