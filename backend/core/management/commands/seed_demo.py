"""Seed realistic demo data. Safe to re-run: clears seeded tables first."""
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
    PurchaseOrder,
    StockBatch,
    Supplier,
    User,
)

OWNER_CREDENTIALS = ("owner", "owner123")
STAFF_CREDENTIALS = ("staff", "staff123")

# name, sku, category, unit, selling_price, reorder_threshold, reorder_quantity, supplier
PRODUCTS = [
    ("Full Cream Milk", "MLK-1001", "Milk", Product.Unit.LITRE, "66.00", 30, 80, "Sunrise Dairy Co."),
    ("Toned Milk", "MLK-1002", "Milk", Product.Unit.LITRE, "54.00", 25, 70, "Sunrise Dairy Co."),
    ("Dahi (Curd)", "FRM-2001", "Fermented", Product.Unit.KG, "90.00", 10, 30, "Sunrise Dairy Co."),
    ("Paneer", "CHZ-3001", "Fresh Cheese", Product.Unit.KG, "380.00", 8, 24, "Nova Foods Pvt Ltd"),
    ("Ghee", "FAT-4001", "Fats", Product.Unit.KG, "620.00", 6, 20, "Kirana Wholesale"),
    ("Chaas (Buttermilk)", "FRM-2002", "Fermented", Product.Unit.LITRE, "30.00", 15, 40, "FreshCare Supplies"),
    ("Butter", "FAT-4002", "Fats", Product.Unit.KG, "540.00", 5, 18, "Kirana Wholesale"),
]

# product name -> list of (quantity, purchase_price, days_until_expiry, days_since_received)
# Negative days_until_expiry = already expired. Deliberate mix of fresh / ageing / expired
# so the 3D shelf will show all three colors.
BATCHES = {
    "Full Cream Milk": [(40, "58.00", 5, 0), (25, "58.00", 2, 1), (10, "56.00", -1, 3)],
    "Toned Milk": [(50, "47.00", 6, 0), (20, "47.00", 1, 2)],
    "Dahi (Curd)": [(15, "70.00", 4, 1), (8, "70.00", 3, 2), (5, "68.00", -2, 6)],
    "Paneer": [(12, "300.00", 8, 0), (6, "295.00", 2, 4)],
    "Ghee": [(20, "500.00", 180, 10)],
    "Chaas (Buttermilk)": [(30, "22.00", 3, 0), (10, "22.00", -1, 4)],
    "Butter": [(10, "430.00", 45, 5), (4, "425.00", 3, 20)],
}

# name, contact person, phone, email, products supplied, days since last order, rating
SUPPLIERS = [
    ("Sunrise Dairy Co.", "Meera Kulkarni", "+91 98220 41220", "orders@sunrisedairy.in", 3, 1, "4.8"),
    ("Nova Foods Pvt Ltd", "Rajat Menon", "+91 98111 77304", "supply@novafoods.com", 2, 2, "4.4"),
    ("Kirana Wholesale", "Anil Deshpande", "+91 97654 20981", "anil@kiranawholesale.in", 6, 3, "4.1"),
    ("Metro Snacks & Beverages", "Priya Nair", "+91 99001 55432", "priya@metrosnacks.in", 4, 4, "3.6"),
    ("FreshCare Supplies", "Vikram Shah", "+91 98330 60117", "vikram@freshcare.co.in", 3, 5, "4.6"),
    ("Juice Valley Beverages", "Sana Qureshi", "+91 97020 33845", "sales@juicevalley.in", 3, 6, "3.2"),
]

CUSTOMERS = [
    ("Sharma General Store", "9820011223", "Shop 4, SV Road, Andheri West, Mumbai"),
    ("Patil Tea House", "9833445566", "Near Station, Dadar East, Mumbai"),
    ("Mrs. D'Souza", "9867778899", "Flat 12, Hill Road, Bandra West, Mumbai"),
    ("Gupta Sweets", "9811122334", "Main Bazaar, Borivali West, Mumbai"),
    ("Iyer Household", "9845566778", "Chembur Colony, Mumbai"),
]

# customer name -> (status, [(product name, qty)])
ORDERS = [
    ("Sharma General Store", Order.Status.DELIVERED, [("Full Cream Milk", 10), ("Dahi (Curd)", 3)]),
    ("Patil Tea House", Order.Status.DELIVERED, [("Toned Milk", 15), ("Chaas (Buttermilk)", 5)]),
    ("Mrs. D'Souza", Order.Status.PROCESSED, [("Paneer", 1), ("Butter", 1), ("Ghee", 1)]),
    ("Gupta Sweets", Order.Status.PENDING, [("Full Cream Milk", 20), ("Paneer", 4)]),
    ("Iyer Household", Order.Status.PENDING, [("Toned Milk", 2), ("Dahi (Curd)", 1)]),
]

# Paid amounts for delivered orders' invoices, keyed by customer name.
INVOICE_PAYMENTS = {
    "Sharma General Store": None,  # None = fully paid
    "Patil Tea House": Decimal("500.00"),  # partial
}


class Command(BaseCommand):
    help = "Clear and seed demo data: users, products, batches, customers, orders, invoices."

    @transaction.atomic
    def handle(self, *args, **options):
        today = timezone.localdate()

        # Clear seeded data (order matters for FK protection).
        Invoice.objects.all().delete()
        OrderItem.objects.all().delete()
        Order.objects.all().delete()
        Customer.objects.all().delete()
        StockBatch.objects.all().delete()
        # Before products and suppliers: PurchaseOrder protects both.
        PurchaseOrder.objects.all().delete()
        Product.objects.all().delete()
        # After products: Product.supplier is PROTECT.
        Supplier.objects.all().delete()
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

        # Suppliers first — products point at them.
        suppliers = {}
        for name, contact, phone, email, supplied, days_ago, rating in SUPPLIERS:
            suppliers[name] = Supplier.objects.create(
                name=name,
                contact_person=contact,
                phone=phone,
                email=email,
                products_supplied=supplied,
                last_order_date=today - timedelta(days=days_ago),
                rating=Decimal(rating),
            )

        products = {}
        for name, sku, category, unit, price, threshold, reorder_qty, supplier in PRODUCTS:
            products[name] = Product.objects.create(
                name=name,
                sku=sku,
                category=category,
                unit=unit,
                selling_price=Decimal(price),
                reorder_threshold=threshold,
                reorder_quantity=reorder_qty,
                supplier=suppliers[supplier],
            )

        batch_count = 0
        for product_name, batches in BATCHES.items():
            for quantity, purchase_price, days_to_expiry, days_received_ago in batches:
                StockBatch.objects.create(
                    product=products[product_name],
                    quantity=quantity,
                    purchase_price=Decimal(purchase_price),
                    expiry_date=today + timedelta(days=days_to_expiry),
                    received_date=today - timedelta(days=days_received_ago),
                )
                batch_count += 1

        customers = {}
        for name, phone, address in CUSTOMERS:
            customers[name] = Customer.objects.create(name=name, phone=phone, address=address)

        order_count = item_count = invoice_count = 0
        for customer_name, status, items in ORDERS:
            order = Order.objects.create(customer=customers[customer_name], status=status)
            order_count += 1
            total = Decimal("0")
            for product_name, qty in items:
                product = products[product_name]
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=qty,
                    unit_price=product.selling_price,
                )
                total += qty * product.selling_price
                item_count += 1
            if status == Order.Status.DELIVERED:
                paid = INVOICE_PAYMENTS.get(customer_name)
                if paid is None:
                    paid_amount, inv_status = total, Invoice.Status.PAID
                elif paid == 0:
                    paid_amount, inv_status = Decimal("0"), Invoice.Status.UNPAID
                else:
                    paid_amount, inv_status = paid, Invoice.Status.PARTIAL
                Invoice.objects.create(
                    order=order,
                    total_amount=total,
                    paid_amount=paid_amount,
                    status=inv_status,
                )
                invoice_count += 1

        self.stdout.write(self.style.SUCCESS("Demo data seeded."))
        self.stdout.write(f"  Users:        2 (owner + staff)")
        self.stdout.write(f"    owner login: {OWNER_CREDENTIALS[0]} / {OWNER_CREDENTIALS[1]} (superuser)")
        self.stdout.write(f"    staff login: {STAFF_CREDENTIALS[0]} / {STAFF_CREDENTIALS[1]}")
        self.stdout.write(f"  Products:     {len(products)}")
        self.stdout.write(f"  Suppliers:    {len(SUPPLIERS)}")
        self.stdout.write(f"  StockBatches: {batch_count}")
        self.stdout.write(f"  Customers:    {len(customers)}")
        self.stdout.write(f"  Orders:       {order_count}")
        self.stdout.write(f"  OrderItems:   {item_count}")
        self.stdout.write(f"  Invoices:     {invoice_count}")
