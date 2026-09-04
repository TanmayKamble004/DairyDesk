"""Role-gating tests (spec section 4: staff cannot see financial data)."""
import io
import os
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Customer,
    Order,
    OrderItem,
    Product,
    PurchaseOrder,
    StockBatch,
    Supplier,
    User,
)

STOCK_BATCHES_URL = "/api/stock-batches/"
PRODUCTS_URL = "/api/products/"
CATEGORIES_URL = "/api/products/categories/"
SUPPLIERS_URL = "/api/suppliers/"
PURCHASE_ORDERS_URL = "/api/purchase-orders/"


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
