"""Seed realistic demo data. Safe to re-run: clears seeded tables first.

Orders and disposals go through the real services (FIFO deduction, invoice
generation, the expiry check) rather than being written straight to the DB, so
the seeded state is one the application could actually have reached. That also
means batch quantities here are pre-order figures: what you see in the UI is
what's left after the demo orders and disposals have been applied.
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    Customer,
    Invoice,
    Order,
    OrderItem,
    Product,
    StockBatch,
    StockDisposal,
    User,
)
from core.services import deduct_stock_fifo, dispose_batch, ensure_invoice

OWNER_CREDENTIALS = ("owner", "owner123")
STAFF_CREDENTIALS = ("staff", "staff123")

# Pack sizes live in the product name because Unit is litre/kg/piece only —
# a 200 g paneer block is one sellable "piece", which is how the shop counts it.
# name, category, unit, selling_price
PRODUCTS = [
    # --- Liquid milk ---
    ("Full Cream Milk", "Milk", Product.Unit.LITRE, "68.00"),
    ("Toned Milk", "Milk", Product.Unit.LITRE, "56.00"),
    ("Double Toned Milk", "Milk", Product.Unit.LITRE, "50.00"),
    ("Cow Milk", "Milk", Product.Unit.LITRE, "62.00"),
    ("Buffalo Milk", "Milk", Product.Unit.LITRE, "80.00"),
    ("A2 Desi Cow Milk", "Milk", Product.Unit.LITRE, "120.00"),
    # --- Fermented ---
    ("Dahi (Curd)", "Fermented", Product.Unit.KG, "92.00"),
    ("Dahi Cup 400 g", "Fermented", Product.Unit.PIECE, "45.00"),
    ("Greek Yogurt 200 g Cup", "Fermented", Product.Unit.PIECE, "90.00"),
    # --- Beverages ---
    ("Chaas (Buttermilk)", "Beverages", Product.Unit.LITRE, "32.00"),
    ("Masala Chaas 200 ml", "Beverages", Product.Unit.PIECE, "15.00"),
    ("Sweet Lassi 200 ml", "Beverages", Product.Unit.PIECE, "25.00"),
    ("Rose Flavoured Milk 200 ml", "Beverages", Product.Unit.PIECE, "28.00"),
    ("Kesar Badam Milk 180 ml", "Beverages", Product.Unit.PIECE, "35.00"),
    # --- Fresh cheese ---
    ("Paneer", "Fresh Cheese", Product.Unit.KG, "420.00"),
    ("Malai Paneer Block 200 g", "Fresh Cheese", Product.Unit.PIECE, "95.00"),
    ("Processed Cheese Slices 200 g", "Fresh Cheese", Product.Unit.PIECE, "135.00"),
    ("Cheese Cubes 200 g", "Fresh Cheese", Product.Unit.PIECE, "145.00"),
    # --- Fats ---
    ("Table Butter 500 g", "Fats", Product.Unit.PIECE, "285.00"),
    ("White Butter (Safed Makhan)", "Fats", Product.Unit.KG, "520.00"),
    ("Cow Ghee", "Fats", Product.Unit.KG, "680.00"),
    ("Buffalo Ghee", "Fats", Product.Unit.KG, "740.00"),
    ("Fresh Malai Cream 250 ml", "Fats", Product.Unit.PIECE, "85.00"),
    # --- Sweets & khoa ---
    ("Kesar Shrikhand 500 g", "Sweets", Product.Unit.PIECE, "160.00"),
    ("Amrakhand 400 g", "Sweets", Product.Unit.PIECE, "130.00"),
    ("Khoa (Mawa)", "Sweets", Product.Unit.KG, "460.00"),
    ("Milk Peda 250 g", "Sweets", Product.Unit.PIECE, "140.00"),
    # --- Powder ---
    ("Full Cream Milk Powder 500 g", "Powder", Product.Unit.PIECE, "320.00"),
]

# product name -> list of (quantity, purchase_price, days_until_expiry, days_since_received)
# Negative days_until_expiry = already expired. Deliberate mix of fresh / ageing /
# expired so the 3D shelf shows all three colours, plus several multi-batch
# products so FIFO deduction is visible. Products absent from this map end up
# with zero available stock on purpose.
BATCHES = {
    "Full Cream Milk": [(120, "58.00", 5, 0), (80, "58.00", 2, 1), (40, "56.00", -1, 4)],
    "Toned Milk": [(150, "47.00", 6, 0), (90, "47.00", 1, 2), (30, "46.00", -2, 5)],
    "Double Toned Milk": [(60, "42.00", 4, 1)],
    "Cow Milk": [(70, "52.00", 5, 0), (35, "51.00", 2, 2)],
    "Buffalo Milk": [(50, "68.00", 4, 0), (20, "67.00", -1, 4)],
    "A2 Desi Cow Milk": [(25, "95.00", 6, 1)],
    "Dahi (Curd)": [(40, "72.00", 4, 1), (18, "70.00", 2, 3), (12, "68.00", -2, 7)],
    "Dahi Cup 400 g": [(60, "34.00", 7, 1)],
    "Greek Yogurt 200 g Cup": [(24, "68.00", 12, 2)],
    "Chaas (Buttermilk)": [(80, "22.00", 3, 0), (25, "22.00", -1, 4)],
    "Masala Chaas 200 ml": [(90, "10.00", 8, 1)],
    "Sweet Lassi 200 ml": [(70, "17.00", 6, 1)],
    "Rose Flavoured Milk 200 ml": [(48, "19.00", 20, 3)],
    "Paneer": [(30, "330.00", 8, 0), (12, "325.00", 2, 4)],
    "Malai Paneer Block 200 g": [(36, "72.00", 9, 1)],
    "Processed Cheese Slices 200 g": [(20, "105.00", 60, 6)],
    "Table Butter 500 g": [(28, "225.00", 90, 8)],
    "White Butter (Safed Makhan)": [(8, "430.00", 15, 3)],
    "Cow Ghee": [(22, "560.00", 300, 12)],
    "Buffalo Ghee": [(14, "615.00", 320, 12)],
    "Fresh Malai Cream 250 ml": [(16, "62.00", 3, 1)],
    "Kesar Shrikhand 500 g": [(20, "120.00", 10, 2)],
    "Amrakhand 400 g": [(9, "98.00", 3, 2)],
    "Khoa (Mawa)": [(10, "380.00", 2, 1), (6, "375.00", -3, 6)],
    "Full Cream Milk Powder 500 g": [(25, "250.00", 400, 20)],
}

# Fictional demo customers across Mumbai, Thane and Navi Mumbai: 18 households
# and 10 shops named after their owner, which is how small traders here sign
# their boards. Given names and surnames are drawn from the most common in
# India (Devi, Singh, Kumar, Das, Kaur, Yadav, Kumari, Lal, Bai, Sharma…) and
# paired at random — no real person is described.
# name, phone, address
CUSTOMERS = [
    ("Umesh Singh General Store", "9820011223", "Shop 4, SV Road, Andheri West, Mumbai 400058"),
    ("Naresh Mandal Tea Stall", "9833445566", "Near Station, Dadar East, Mumbai 400014"),
    ("Rekha Gupta", "9867778899", "Flat 12, Hill Road, Bandra West, Mumbai 400050"),
    ("Ganesh Patel Sweet Mart", "9811122334", "Main Bazaar, Borivali West, Mumbai 400092"),
    ("Sunita Devi", "9845566778", "B-303, Chembur Colony, Chembur, Mumbai 400071"),
    ("Manju Devi Kirana Store", "9702233445", "Gokhale Road, Thane West, Thane 400602"),
    ("Gopal Chandra Dairy Corner", "9819944556", "LBS Marg, Mulund West, Mumbai 400080"),
    ("Mira Gupta Namkeen House", "9930055667", "Telang Road, Matunga East, Mumbai 400019"),
    ("Saroj Biswas Provision Store", "9821166778", "Hanuman Road, Vile Parle East, Mumbai 400057"),
    ("Ramesh Kumar", "9769922334", "Lake Homes, Powai, Mumbai 400076"),
    ("Radha Begam Caterers", "9892233446", "Pipe Road, Kurla West, Mumbai 400070"),
    ("Dipak Chaudhari Snack Centre", "9987744551", "Sector 17, Vashi, Navi Mumbai 400703"),
    ("Anita Sharma", "9860033447", "Rajawadi, Ghatkopar East, Mumbai 400077"),
    ("Punam Kumari Tiffin Service", "9773366889", "Hiranandani Gardens, Powai, Mumbai 400076"),
    ("Sanjay Yadav", "9820977332", "SV Road, Jogeshwari West, Mumbai 400102"),
    ("Lakshmi Das", "9922088445", "Sector 21, Nerul, Navi Mumbai 400706"),
    ("Rajesh Prasad", "9768811223", "Sion Circle, Sion, Mumbai 400022"),
    ("Gita Kumari", "9833990022", "Marve Road, Malad West, Mumbai 400064"),
    ("Sunil Singh", "9819055443", "Thakur Complex, Kandivali East, Mumbai 400101"),
    ("Manoj Lal", "9702277889", "Katrak Road, Wadala, Mumbai 400031"),
    ("Shanti Devi", "9930766554", "Sector 8, Airoli, Navi Mumbai 400708"),
    ("Ashok Kumar", "9867422113", "Aarey Road, Goregaon East, Mumbai 400063"),
    ("Suman Kaur", "9892255770", "Sonapur Lane, Bhandup West, Mumbai 400078"),
    ("Santosh Mandal", "9821344667", "SV Road, Santacruz West, Mumbai 400054"),
    ("Usha Bai", "9975511220", "Agra Road, Kalyan West, Thane 421301"),
    ("Dinesh Raut", "9769633880", "Shanti Nagar, Mira Road East, Thane 401107"),
    ("Asha Devi", "9860744992", "Manpada Road, Dombivli East, Thane 421201"),
    ("Vinod Sharma", "9833177664", "Clare Road, Byculla, Mumbai 400008"),
]

# customer name, status, days_ago, [(product name, qty)]
# Quantities stay well inside available (non-expired) stock — deduct_stock_fifo
# refuses anything short, so a bad row here fails the seed loudly.
ORDERS = [
    ("Umesh Singh General Store", Order.Status.DELIVERED, 26,
     [("Full Cream Milk", 20), ("Dahi (Curd)", 4)]),
    ("Naresh Mandal Tea Stall", Order.Status.DELIVERED, 21,
     [("Toned Milk", 30), ("Chaas (Buttermilk)", 10)]),
    ("Ganesh Patel Sweet Mart", Order.Status.DELIVERED, 17,
     [("Paneer", 5), ("Khoa (Mawa)", 3)]),
    ("Mira Gupta Namkeen House", Order.Status.DELIVERED, 12,
     [("Buffalo Milk", 15), ("Dahi Cup 400 g", 10)]),
    ("Manju Devi Kirana Store", Order.Status.DELIVERED, 8,
     [("Toned Milk", 25), ("Masala Chaas 200 ml", 20)]),
    ("Radha Begam Caterers", Order.Status.DELIVERED, 4,
     [("Table Butter 500 g", 6), ("Full Cream Milk", 15)]),
    ("Gopal Chandra Dairy Corner", Order.Status.PROCESSED, 3,
     [("Cow Milk", 20), ("Sweet Lassi 200 ml", 12)]),
    ("Dipak Chaudhari Snack Centre", Order.Status.PROCESSED, 2,
     [("Paneer", 6), ("Cow Ghee", 2)]),
    ("Rekha Gupta", Order.Status.PROCESSED, 1,
     [("A2 Desi Cow Milk", 4), ("Greek Yogurt 200 g Cup", 3)]),
    ("Punam Kumari Tiffin Service", Order.Status.PENDING, 1,
     [("Double Toned Milk", 20), ("Kesar Shrikhand 500 g", 3)]),
    ("Sunita Devi", Order.Status.PENDING, 0,
     [("Toned Milk", 3), ("Dahi (Curd)", 1)]),
    ("Ramesh Kumar", Order.Status.PENDING, 0,
     [("Full Cream Milk", 5), ("Rose Flavoured Milk 200 ml", 6)]),
    ("Saroj Biswas Provision Store", Order.Status.PENDING, 0,
     [("Chaas (Buttermilk)", 12), ("Malai Paneer Block 200 g", 4)]),
]

# Paid amounts for delivered orders' invoices, keyed by customer name.
# None = fully paid, 0 = unpaid, anything else = partial.
INVOICE_PAYMENTS = {
    "Umesh Singh General Store": None,
    "Naresh Mandal Tea Stall": Decimal("900.00"),
    "Ganesh Patel Sweet Mart": None,
    "Mira Gupta Namkeen House": Decimal("0"),
    "Manju Devi Kirana Store": Decimal("700.00"),
    "Radha Begam Caterers": None,
}

# Write-offs against expired batches: (product, batch index, qty, reason, notes, days_ago).
# Deliberately partial in places so expired stock remains for the Dispose UI.
DISPOSALS = [
    ("Toned Milk", 2, 30, "expired", "Pouches past date, returned by Naresh Mandal Tea Stall", 4),
    ("Dahi (Curd)", 2, 12, "spoiled", "Curd turned sour in the display chiller", 6),
    ("Khoa (Mawa)", 1, 6, "expired", "Mawa dried out, unfit for sweets", 5),
    ("Full Cream Milk", 2, 25, "expired", "Morning crate not collected", 3),
    ("Chaas (Buttermilk)", 1, 10, "spoiled", "Bottles left out of the chiller overnight", 2),
    ("Full Cream Milk", 2, 5, "damaged", "Pouches punctured while unloading", 1),
]


class Command(BaseCommand):
    help = "Reset and seed demo data: users, products, batches, customers, orders, invoices, disposals."

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()
        now = timezone.now()

        self.stdout.write(
            self.style.WARNING(
                "Resetting demo data — deleting ALL products, batches, customers, "
                "orders, invoices and disposals, plus the 'owner' and 'staff' "
                "accounts. Other user accounts are left untouched."
            )
        )

        # Clear seeded data (order matters for FK protection: disposals PROTECT
        # both their batch and their user, so they go first).
        Invoice.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        Customer.objects.all().delete()
        StockDisposal.objects.all().delete()
        StockBatch.objects.all().delete()
        Product.objects.all().delete()
        User.objects.filter(username__in=[OWNER_CREDENTIALS[0], STAFF_CREDENTIALS[0]]).delete()

        # Users — owner is a superuser so admin is usable straight away.
        owner = User.objects.create_superuser(
            username=OWNER_CREDENTIALS[0],
            password=OWNER_CREDENTIALS[1],
            email="owner@dairydesk.local",
            role=User.Role.OWNER,
        )
        staff = User.objects.create_user(
            username=STAFF_CREDENTIALS[0],
            password=STAFF_CREDENTIALS[1],
            email="staff@dairydesk.local",
            role=User.Role.STAFF,
        )

        products = {}
        for name, category, unit, price in PRODUCTS:
            products[name] = Product.objects.create(
                name=name, category=category, unit=unit, selling_price=Decimal(price)
            )

        # Keep batches per product in creation order so DISPOSALS can index them.
        batches = {}
        batch_count = 0
        for product_name, rows in BATCHES.items():
            batches[product_name] = []
            for quantity, purchase_price, days_to_expiry, days_received_ago in rows:
                batches[product_name].append(
                    StockBatch.objects.create(
                        product=products[product_name],
                        quantity=quantity,
                        purchase_price=Decimal(purchase_price),
                        expiry_date=today + timedelta(days=days_to_expiry),
                        received_date=today - timedelta(days=days_received_ago),
                    )
                )
                batch_count += 1

        customers = {}
        for name, phone, address in CUSTOMERS:
            customers[name] = Customer.objects.create(name=name, phone=phone, address=address)

        order_count = item_count = invoice_count = 0
        for customer_name, status, days_ago, items in ORDERS:
            # Real FIFO deduction: expired batches are skipped and a shortage
            # raises, so seeded orders can never drive stock negative.
            deduct_stock_fifo((products[name], qty) for name, qty in items)

            order = Order.objects.create(customer=customers[customer_name], status=status)
            OrderItem.objects.bulk_create(
                OrderItem(
                    order=order,
                    product=products[name],
                    quantity=qty,
                    unit_price=products[name].selling_price,
                )
                for name, qty in items
            )
            item_count += len(items)
            order_count += 1

            if days_ago:
                # created_at is auto_now_add, so backdating needs an UPDATE.
                Order.objects.filter(pk=order.pk).update(
                    created_at=now - timedelta(days=days_ago)
                )

            if status == Order.Status.DELIVERED:
                invoice = ensure_invoice(order)
                paid = INVOICE_PAYMENTS.get(customer_name)
                if paid is None:
                    invoice.paid_amount, invoice.status = (
                        invoice.total_amount,
                        Invoice.Status.PAID,
                    )
                elif paid == 0:
                    invoice.paid_amount, invoice.status = Decimal("0"), Invoice.Status.UNPAID
                else:
                    invoice.paid_amount, invoice.status = paid, Invoice.Status.PARTIAL
                invoice.save(update_fields=["paid_amount", "status"])
                invoice_count += 1

        # Disposal history — through the service, so the expiry rule is enforced.
        disposal_count = 0
        for i, (product_name, index, qty, reason, notes, days_ago) in enumerate(DISPOSALS):
            disposal = dispose_batch(
                batch_id=batches[product_name][index].pk,
                quantity=qty,
                reason=reason,
                notes=notes,
                user=owner if i % 2 == 0 else staff,
            )
            StockDisposal.objects.filter(pk=disposal.pk).update(
                disposed_at=now - timedelta(days=days_ago)
            )
            disposal_count += 1

        total = (
            2
            + len(products)
            + batch_count
            + len(customers)
            + order_count
            + item_count
            + invoice_count
            + disposal_count
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write(f"  Users:          2 (owner + staff)")
        self.stdout.write(f"    owner login:  {OWNER_CREDENTIALS[0]} / {OWNER_CREDENTIALS[1]} (superuser)")
        self.stdout.write(f"    staff login:  {STAFF_CREDENTIALS[0]} / {STAFF_CREDENTIALS[1]}")
        self.stdout.write(f"  Products:       {len(products)}")
        self.stdout.write(f"  StockBatches:   {batch_count}")
        self.stdout.write(f"  Customers:      {len(customers)}")
        self.stdout.write(f"  Orders:         {order_count}")
        self.stdout.write(f"  OrderItems:     {item_count}")
        self.stdout.write(f"  Invoices:       {invoice_count}")
        self.stdout.write(f"  StockDisposals: {disposal_count}")
        self.stdout.write(self.style.SUCCESS(f"  Total records:  {total}"))
