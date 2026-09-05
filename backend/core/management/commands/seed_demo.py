"""Seed realistic demo data. Safe to re-run: clears seeded tables first.

The catalogue is Heritage Foods Limited's price list, item for item: the item
code becomes the SKU, MRP becomes the selling price, "price after GST" becomes
what a batch cost to buy, and "billing EA" — the number of packs in a crate —
sets both the reorder levels and the size a batch is received in. "Billing per
crate" is not stored: it is purchase price x crate size, and a stored copy would
only be free to drift.

Everything is counted in packs (Product.Unit.PIECE). A 1 L sachet and a 100 g
cup are each one sellable thing, the crate holds a whole number of them, and the
size is already in the product's name — counting litres instead would make
"available quantity" mean something different from what the shop hands over.
"""
from datetime import timedelta
from decimal import Decimal
from typing import NamedTuple

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
    ageing_window_days,
)
from core.services import next_invoice_number, raise_auto_reorders

OWNER_CREDENTIALS = ("owner", "owner123")
STAFF_CREDENTIALS = ("staff", "staff123")

# Extra people so the owner's Staff page has a roster to manage rather than
# two bare logins. Amit is switched off: someone who has left, kept because his
# name is on past orders. username, password, first, last, role, is_active
EXTRA_USERS = [
    ("rohit", "rohit123", "Rohit", "Kadam", User.Role.OWNER, True),
    ("sneha", "sneha123", "Sneha", "Patil", User.Role.STAFF, True),
    ("amit", "amit123", "Amit", "Shirke", User.Role.STAFF, False),
]

# ------------------------------- Categories -------------------------------
# A category exists exactly as long as a product carries it (there is no
# Category table — see ProductViewSet.categories), so these are the lines a
# dairy counter is actually laid out in, not the price list's row order.

MILK = "Milk"
CURD = "Curd"
BUTTERMILK = "Buttermilk & Lassi"
DESSERTS = "Sweets & Desserts"
PANEER = "Paneer"
FLAVOURED_MILK = "Flavoured Milk"
MILKSHAKES = "Milkshakes"
WHEY = "Whey Drinks"
UHT_MILK = "UHT Milk"
GHEE = "Ghee"
CHEESE = "Cheese"
BUTTER = "Butter"

# --------------------------------- Depots ---------------------------------
# Heritage reaches a retailer through depots split by cold chain, and the split
# matters here: the fresh depot delivers daily against a two-day life, while the
# ambient depot delivers monthly. One supplier row for the whole company would
# collapse that distinction and make every purchase order look alike.

FRESH_DEPOT = "Heritage Foods Ltd — Fresh Milk Depot"
CHILLED_DEPOT = "Heritage Foods Ltd — Curd & Chilled Depot"
BEVERAGE_DEPOT = "Heritage Foods Ltd — Beverage Depot"
FAT_DEPOT = "Heritage Foods Ltd — Ghee, Cheese & Butter Depot"

# name, contact person, phone, email, days since last order, rating.
# `products_supplied` is filled in from the catalogue once it is loaded.
# Contacts are placeholders: this is demo data about a real company, so nothing
# here should look like a phone number or mailbox someone could actually reach.
SUPPLIERS = [
    (FRESH_DEPOT, "S. Prasad", "+91 90000 11201", "freshmilk.depot@heritagefoods.example", 0, "4.7"),
    (CHILLED_DEPOT, "K. Lakshmi", "+91 90000 11202", "chilled.depot@heritagefoods.example", 1, "4.5"),
    (BEVERAGE_DEPOT, "R. Naveen", "+91 90000 11203", "beverages.depot@heritagefoods.example", 6, "4.2"),
    (FAT_DEPOT, "M. Yadagiri", "+91 90000 11204", "ghee.depot@heritagefoods.example", 12, "4.6"),
]


class Item(NamedTuple):
    """One row of the Heritage price list."""

    code: str  # item code -> SKU
    name: str
    category: str
    depot: str
    mrp: str  # -> selling_price
    price_after_gst: str  # -> the batch's purchase_price
    per_crate: int  # "billing EA" -> units in a received batch
    shelf_life_days: int
    blurb: str


# Shelf life is the price list's "shelf-life day" column. Its "shelf-life month"
# column is the same figure rounded to months and is deliberately ignored: two
# columns for one fact can only ever agree by luck.
CATALOGUE = [
    # --- Fresh milk: pasteurised, chilled, two days and gone. ---
    Item("10932", "Golden Cow Milk 230 ml Sachet", MILK, FRESH_DEPOT, "14.00", "11.96", 52, 2,
         "Heritage Golden Cow pasteurised cow milk in a poly sachet — the single-serve daily line."),
    Item("10913", "Golden Cow Milk 500 ml Sachet", MILK, FRESH_DEPOT, "28.00", "23.90", 24, 2,
         "Heritage Golden Cow pasteurised cow milk in a poly sachet."),
    Item("10914", "Golden Cow Milk 1 L Sachet", MILK, FRESH_DEPOT, "55.00", "47.30", 12, 2,
         "Heritage Golden Cow pasteurised cow milk in the litre poly sachet."),
    Item("10519", "Toned Milk Family Pack 500 ml Sachet", MILK, FRESH_DEPOT, "27.00", "24.52", 24, 2,
         "Heritage toned milk — skim-blended to about 3% fat, the everyday household grade."),
    Item("10521", "Toned Milk Family Pack 1 L Sachet", MILK, FRESH_DEPOT, "53.00", "48.53", 12, 2,
         "Heritage toned milk in the litre family sachet."),
    Item("10561", "Toned Milk Family Pack 5 L Sachet", MILK, FRESH_DEPOT, "280.00", "230.50", 2, 2,
         "Heritage toned milk in the 5 litre bulk sachet — the caterer and tea-shop pack."),
    Item("10613", "Standardised Milk 500 ml Sachet", MILK, FRESH_DEPOT, "29.00", "25.50", 24, 2,
         "Heritage standardised milk, held at about 4.5% fat — the tea and coffee grade."),
    Item("10614", "Standardised Milk 1 L Sachet", MILK, FRESH_DEPOT, "58.00", "51.00", 12, 2,
         "Heritage standardised milk in the litre sachet."),
    Item("10833", "A2 Milk 500 ml Sachet", MILK, FRESH_DEPOT, "33.00", "31.00", 24, 2,
         "Heritage A2 milk — buffalo milk carrying only the A2 beta-casein protein. Thinnest margin on the milk shelf."),
    Item("10834", "A2 Milk 1 L Sachet", MILK, FRESH_DEPOT, "66.00", "61.50", 12, 2,
         "Heritage A2 milk in the litre sachet."),

    # --- Curd: sachets run a fortnight, sealed cups three weeks. ---
    Item("10173", "Curd 120 g Sachet", CURD, CHILLED_DEPOT, "10.00", "7.50", 100, 15,
         "Heritage set curd in a single-serve poly sachet; the deepest crate in the list at 100 packs."),
    Item("10188", "Curd 220 g Sachet", CURD, CHILLED_DEPOT, "20.00", "16.00", 56, 15,
         "Heritage set curd in a poly sachet."),
    Item("10104", "Curd 500 g Sachet", CURD, CHILLED_DEPOT, "40.00", "31.75", 24, 15,
         "Heritage set curd in a poly sachet."),
    Item("10105", "Curd 1 kg Sachet", CURD, CHILLED_DEPOT, "77.00", "59.50", 12, 11,
         "Heritage set curd in the kilo sachet — rated four days shorter than the smaller packs."),
    Item("10139", "Double Toned Curd 1 kg Sachet", CURD, CHILLED_DEPOT, "67.00", "50.00", 12, 15,
         "Heritage double-toned curd — the low-fat kilo sachet."),
    Item("20068", "Toned Milk Curd 70 g Cup", CURD, CHILLED_DEPOT, "10.00", "7.50", 24, 21,
         "Heritage toned-milk curd in a heat-sealed cup; the seal buys a week over the sachet."),
    Item("20012", "Toned Milk Curd 200 g Cup", CURD, CHILLED_DEPOT, "30.00", "24.15", 20, 21,
         "Heritage toned-milk curd in a heat-sealed cup."),
    Item("20013", "Toned Milk Curd 400 g Cup", CURD, CHILLED_DEPOT, "85.00", "75.66", 12, 21,
         "Heritage toned-milk curd in the family cup."),

    # --- Buttermilk and lassi. ---
    Item("10042", "Probiotic Buttermilk 400 ml Sachet", BUTTERMILK, CHILLED_DEPOT, "12.00", "10.00", 22, 6,
         "Heritage probiotic buttermilk — live-culture chaas, chilled chain throughout."),
    Item("10033", "Plain Buttermilk 500 ml Sachet", BUTTERMILK, CHILLED_DEPOT, "16.00", "12.50", 22, 7,
         "Heritage plain buttermilk (chaas) in a chilled sachet."),
    Item("31217", "Spiced Buttermilk 180 ml Brik", BUTTERMILK, BEVERAGE_DEPOT, "15.00", "12.36", 30, 180,
         "Heritage spiced buttermilk in an aseptic Tetra Brik — ambient until opened, hence six months against the sachet's week."),
    Item("20535", "Sweet Lassi 165 ml", BUTTERMILK, BEVERAGE_DEPOT, "25.00", "20.70", 28, 180,
         "Heritage sweet lassi in a 165 ml SIG aseptic pack."),
    Item("20536", "Mango Lassi 165 ml", BUTTERMILK, BEVERAGE_DEPOT, "25.00", "20.70", 28, 180,
         "Heritage mango lassi in a 165 ml SIG aseptic pack."),
    Item("20537", "Strawberry Lassi 165 ml", BUTTERMILK, BEVERAGE_DEPOT, "25.00", "20.70", 28, 180,
         "Heritage strawberry lassi in a 165 ml SIG aseptic pack."),

    # --- Sweets: hung curd, sealed cups, three months. ---
    Item("20601", "Shrikhand Kesar 100 g Cup", DESSERTS, CHILLED_DEPOT, "45.00", "37.54", 60, 90,
         "Heritage kesar shrikhand — saffron-set hung curd in a sealed cup."),
    Item("20602", "Shrikhand Kesar 250 g Cup", DESSERTS, CHILLED_DEPOT, "100.00", "83.42", 24, 90,
         "Heritage kesar shrikhand in the sharing cup — a festival line."),
    Item("20651", "Amrakhand 100 g Cup", DESSERTS, CHILLED_DEPOT, "45.00", "38.25", 60, 90,
         "Heritage amrakhand — mango-set hung curd in a sealed cup."),
    Item("20652", "Amrakhand 250 g Cup", DESSERTS, CHILLED_DEPOT, "100.00", "84.99", 24, 90,
         "Heritage amrakhand in the sharing cup."),

    # --- Paneer. ---
    Item("20411", "Paneer 200 g Polypack", PANEER, CHILLED_DEPOT, "120.00", "70.25", 70, 30,
         "Heritage fresh paneer in a sealed polypack. The widest margin in the catalogue, and a 70-pack crate."),

    # --- Flavoured milk: UHT-treated, so ambient for four months. ---
    Item("30715", "Flavoured Milk Badam 200 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "30.00", "24.21", 21, 120,
         "Heritage badam flavoured milk, UHT-treated in a PP bottle."),
    Item("30754", "Flavoured Milk Chocolate 200 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "30.00", "24.21", 21, 120,
         "Heritage chocolate flavoured milk, UHT-treated in a PP bottle."),
    Item("30723", "Flavoured Milk Vanilla 200 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "30.00", "24.21", 21, 120,
         "Heritage vanilla flavoured milk, UHT-treated in a PP bottle."),
    Item("30744", "Flavoured Milk Pista 200 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "30.00", "24.21", 21, 120,
         "Heritage pista flavoured milk, UHT-treated in a PP bottle."),
    Item("30764", "Flavoured Milk Strawberry 200 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "30.00", "24.21", 21, 120,
         "Heritage strawberry flavoured milk, UHT-treated in a PP bottle."),
    Item("30707", "Rich Badam Flavoured Milk 180 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "40.00", "35.99", 24, 120,
         "Heritage Rich Badam — the higher-solids 180 ml bottle, priced above the 200 ml standard line."),
    Item("30748", "Rich Pista Flavoured Milk 180 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "40.00", "35.99", 24, 120,
         "Heritage Rich Pista — the higher-solids 180 ml bottle."),
    Item("30787", "Cold Coffee 180 ml Tin", FLAVOURED_MILK, BEVERAGE_DEPOT, "50.00", "41.41", 26, 120,
         "Heritage cold coffee in a tin — the only canned line in the list, and the priciest single serve."),
    Item("30793", "Badam Charger 180 ml Bottle", FLAVOURED_MILK, BEVERAGE_DEPOT, "35.00", "28.25", 21, 120,
         "Heritage Badam Charger — the almond energy bottle."),

    # --- Milkshakes: six months ambient. ---
    Item("31215", "Milkshake Chocolate 125 ml", MILKSHAKES, BEVERAGE_DEPOT, "15.00", "11.59", 40, 180,
         "Heritage chocolate milkshake in a 125 ml pack — the school-bag size."),
    Item("31216", "Milkshake Cookies & Cream 125 ml", MILKSHAKES, BEVERAGE_DEPOT, "15.00", "11.59", 40, 180,
         "Heritage cookies-and-cream milkshake in a 125 ml pack."),
    Item("31225", "Milkshake Strawberry 125 ml", MILKSHAKES, BEVERAGE_DEPOT, "15.00", "11.59", 40, 180,
         "Heritage strawberry milkshake in a 125 ml pack."),
    Item("31235", "Milkshake Vanilla 125 ml", MILKSHAKES, BEVERAGE_DEPOT, "15.00", "11.59", 40, 180,
         "Heritage vanilla milkshake in a 125 ml pack."),

    # --- Whey drink. ---
    Item("21102", "Gluco Shakti Orange Whey Drink 200 ml", WHEY, BEVERAGE_DEPOT, "12.00", "9.52", 30, 90,
         "Heritage Gluco Shakti — whey fortified with glucose, tangy orange, in a 200 ml SIG aseptic pack."),

    # --- UHT milk: shelf-stable, no cold chain. ---
    Item("71005", "Farm Fresh UHT Milk 1 L Brik", UHT_MILK, BEVERAGE_DEPOT, "75.00", "61.10", 11, 180,
         "Heritage Farm Fresh UHT milk in a 1 L Tetra Brik — six months unopened and no cold chain, which is what the premium over fresh milk buys."),

    # --- Ghee: nine months, and the money on this counter. ---
    Item("30234", "Cow Ghee 500 ml Pouch", GHEE, FAT_DEPOT, "345.00", "260.00", 24, 270,
         "Heritage cow ghee in a poly pouch — the value format."),
    Item("30235", "Cow Ghee 1 L Pouch", GHEE, FAT_DEPOT, "685.00", "515.00", 12, 270,
         "Heritage cow ghee in the litre poly pouch."),
    Item("30334", "AGMARK Buffalo Ghee 500 ml Pouch", GHEE, FAT_DEPOT, "345.00", "260.00", 24, 270,
         "Heritage AGMARK-graded buffalo ghee in a poly pouch; priced level with the cow ghee pouch."),
    Item("30335", "AGMARK Buffalo Ghee 1 L Pouch", GHEE, FAT_DEPOT, "685.00", "515.00", 12, 270,
         "Heritage AGMARK-graded buffalo ghee in the litre poly pouch."),
    Item("30252", "Cow Ghee 200 ml Jar", GHEE, FAT_DEPOT, "150.00", "117.02", 60, 270,
         "Heritage cow ghee in a screw-top jar — the small gifting size, and the highest crate value in the list."),
    Item("30254", "Cow Ghee 500 ml Jar", GHEE, FAT_DEPOT, "365.00", "270.00", 24, 270,
         "Heritage cow ghee in a screw-top jar; the jar carries a rupee premium over the same fill in a pouch."),
    Item("30255", "Cow Ghee 1 L Jar", GHEE, FAT_DEPOT, "720.00", "540.00", 12, 270,
         "Heritage cow ghee in the litre jar — the most expensive single pack on the counter."),

    # --- Cheese. ---
    Item("73000", "Cheese Slices 100 g", CHEESE, FAT_DEPOT, "115.00", "93.90", 60, 270,
         "Heritage processed cheese slices."),
    Item("73001", "Cheese Slices 200 g", CHEESE, FAT_DEPOT, "215.00", "175.55", 30, 270,
         "Heritage processed cheese slices, family pack."),
    Item("73003", "Cheese Cubes 200 g", CHEESE, FAT_DEPOT, "128.00", "104.51", 48, 270,
         "Heritage processed cheese cubes."),
    Item("73004", "Cheese Cubes 120 g", CHEESE, FAT_DEPOT, "90.00", "90.00", 60, 270,
         "Heritage processed cheese cubes. The price list bills this one at MRP, so it currently earns the shop nothing — see the note the seed prints."),
    Item("73005", "Cheese Block 200 g", CHEESE, FAT_DEPOT, "135.00", "110.23", 48, 270,
         "Heritage processed cheese block, for grating and cooking."),

    # --- Butter: a year, the longest life here. ---
    Item("20133", "Pasteurised Table Butter 100 g", BUTTER, FAT_DEPOT, "60.00", "52.42", 160, 365,
         "Heritage pasteurised table butter; a 160-pack crate, the largest intake in the catalogue."),
    Item("20134", "Pasteurised Table Butter 500 g", BUTTER, FAT_DEPOT, "290.00", "253.39", 30, 365,
         "Heritage pasteurised table butter, catering pack."),
]

# Lines the fresh and chilled depots deliver against a short life reorder on
# their own; ambient stock is ordered on a monthly cycle by hand.
AUTO_REORDER_MAX_SHELF_LIFE_DAYS = 21

# ------------------------------ Stock ageing ------------------------------
# A batch's freshness is expressed against its own product's ageing window
# rather than as a fixed number of days, because the window is now a share of
# shelf life (core.models.ageing_window_days). "Ageing" therefore means the same
# thing for a two-day milk sachet as for a nine-month tin of ghee, which a
# literal "expires in 2 days" could not.
FRESH = "fresh"
AGEING = "ageing"
EXPIRED = "expired"


def days_since_received(freshness, shelf_life_days):
    """How long ago a batch must have landed to read as `freshness` today."""
    if freshness == EXPIRED:
        return shelf_life_days + 2
    if freshness == AGEING:
        # Leaves exactly one ageing window of life on the batch.
        return shelf_life_days - ageing_window_days(shelf_life_days)
    return 0  # received today, with its whole life ahead of it


def stock_profile(index):
    """The batches a product carries, as (crates, freshness) pairs.

    Spread by position rather than at random: the 3D shelf, the dashboard
    counts and the Alerts page each need fresh, ageing, expired, low and
    out-of-stock products to exist, and a seed that shuffled would demo
    something different every run.
    """
    if index % 11 == 5:
        return []  # nothing on the shelf — out of stock

    batches = []
    if index % 9 == 4:
        batches.append((0.5, FRESH))  # part crate: at or under the reorder threshold
    else:
        batches.append((2, FRESH))
        if index % 4 == 1:
            batches.append((1, FRESH))
    if index % 3 == 0:
        batches.append((1, AGEING))
    if index % 7 == 0:
        batches.append((0.5, EXPIRED))
    return batches


CUSTOMERS = [
    ("Sharma General Store", "9820011223", "Shop 4, SV Road, Andheri West, Mumbai"),
    ("Patil Tea House", "9833445566", "Near Station, Dadar East, Mumbai"),
    ("Mrs. D'Souza", "9867778899", "Flat 12, Hill Road, Bandra West, Mumbai"),
    ("Gupta Sweets", "9811122334", "Main Bazaar, Borivali West, Mumbai"),
    ("Iyer Household", "9845566778", "Chembur Colony, Mumbai"),
]

# customer name -> (status, [(item code, packs)]). Ordered in crate-ish
# quantities for the trade buyers and in ones and twos for the households.
ORDERS = [
    ("Sharma General Store", Order.Status.DELIVERED,
     [("10914", 24), ("10104", 12), ("20411", 5)]),
    ("Patil Tea House", Order.Status.DELIVERED,
     [("10521", 36), ("10033", 22), ("30787", 13)]),
    ("Mrs. D'Souza", Order.Status.PROCESSED,
     [("30234", 1), ("73000", 2), ("20133", 4)]),
    ("Gupta Sweets", Order.Status.PENDING,
     [("20602", 12), ("20652", 12), ("30255", 2)]),
    ("Iyer Household", Order.Status.PENDING,
     [("10913", 6), ("20012", 4), ("31215", 8)]),
]

# Paid amounts for delivered orders' invoices, keyed by customer name.
INVOICE_PAYMENTS = {
    "Sharma General Store": None,  # None = fully paid
    "Patil Tea House": Decimal("1200.00"),  # partial
}


class Command(BaseCommand):
    help = "Clear and seed demo data: the Heritage catalogue, stock, staff, customers, orders, invoices."

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
        seeded_usernames = [OWNER_CREDENTIALS[0], STAFF_CREDENTIALS[0]]
        seeded_usernames += [username for username, *_ in EXTRA_USERS]
        User.objects.filter(username__in=seeded_usernames).delete()

        # Users — owner is a superuser so admin is usable straight away.
        User.objects.create_superuser(
            username=OWNER_CREDENTIALS[0],
            password=OWNER_CREDENTIALS[1],
            email="owner@dairydesk.local",
            first_name="Priya",
            last_name="Deshmukh",
            role=User.Role.OWNER,
        )
        User.objects.create_user(
            username=STAFF_CREDENTIALS[0],
            password=STAFF_CREDENTIALS[1],
            email="staff@dairydesk.local",
            first_name="Nikhil",
            last_name="Jadhav",
            role=User.Role.STAFF,
        )
        for username, password, first, last, role, active in EXTRA_USERS:
            User.objects.create_user(
                username=username,
                password=password,
                email=f"{username}@dairydesk.local",
                first_name=first,
                last_name=last,
                role=role,
                is_active=active,
            )

        # Suppliers first — products point at them.
        suppliers = {}
        for name, contact, phone, email, days_ago, rating in SUPPLIERS:
            suppliers[name] = Supplier.objects.create(
                name=name,
                contact_person=contact,
                phone=phone,
                email=email,
                # Set from the catalogue below, once there is something to count.
                products_supplied=0,
                last_order_date=today - timedelta(days=days_ago),
                rating=Decimal(rating),
            )

        products = {}
        for item in CATALOGUE:
            products[item.code] = Product.objects.create(
                name=item.name,
                sku=item.code,
                category=item.category,
                supplier=suppliers[item.depot],
                unit=Product.Unit.PIECE,
                selling_price=Decimal(item.mrp),
                description=(
                    f"{item.blurb} Ordered by the crate of {item.per_crate}; "
                    f"{item.shelf_life_days}-day shelf life from receipt."
                ),
                # Reorder when a single crate is left, and bring in two — a
                # reorder quantity at or under the threshold would restock
                # straight back into "low".
                reorder_threshold=item.per_crate,
                reorder_quantity=item.per_crate * 2,
                auto_reorder=item.shelf_life_days <= AUTO_REORDER_MAX_SHELF_LIFE_DAYS,
            )

        # products_supplied is entered, not counted (see Supplier), so it has to
        # be set from the catalogue or the Suppliers page shows four zeroes.
        for supplier in suppliers.values():
            supplier.products_supplied = supplier.products.count()
            supplier.save(update_fields=["products_supplied"])

        batch_count = 0
        for index, item in enumerate(CATALOGUE):
            product = products[item.code]
            for crates, freshness in stock_profile(index):
                received_ago = days_since_received(freshness, item.shelf_life_days)
                received = today - timedelta(days=received_ago)
                StockBatch.objects.create(
                    product=product,
                    # Stock arrives by the crate, so a batch is a whole number
                    # of packs however the profile splits it.
                    quantity=max(1, round(crates * item.per_crate)),
                    purchase_price=Decimal(item.price_after_gst),
                    expiry_date=received + timedelta(days=item.shelf_life_days),
                    received_date=received,
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
            for code, qty in items:
                product = products[code]
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
                    # Same generator the delivery flow uses, so seeded bills
                    # continue the year's sequence instead of starting a rival.
                    number=next_invoice_number(),
                    total_amount=total,
                    paid_amount=paid_amount,
                    status=inv_status,
                )
                invoice_count += 1

        # Products created below their threshold should already be on order:
        # the seed writes rows directly, so nothing has run the rule that the
        # product API runs on every save.
        reorders = raise_auto_reorders()

        statuses = {FRESH: 0, AGEING: 0, EXPIRED: 0}
        for batch in StockBatch.objects.select_related("product"):
            statuses[batch.expiry_status] += 1

        self.stdout.write(self.style.SUCCESS("Demo data seeded (Heritage Foods catalogue)."))
        self.stdout.write(f"  Users:        {2 + len(EXTRA_USERS)}")
        self.stdout.write(f"    owner login: {OWNER_CREDENTIALS[0]} / {OWNER_CREDENTIALS[1]} (superuser)")
        self.stdout.write(f"    staff login: {STAFF_CREDENTIALS[0]} / {STAFF_CREDENTIALS[1]}")
        for username, password, first, last, role, active in EXTRA_USERS:
            state = "" if active else ", disabled"
            self.stdout.write(f"    {username} / {password} — {first} {last} ({role}{state})")
        self.stdout.write(f"  Suppliers:    {len(SUPPLIERS)} Heritage depots")
        self.stdout.write(f"  Products:     {len(products)} across {len({i.category for i in CATALOGUE})} categories")
        self.stdout.write(
            f"  StockBatches: {batch_count} "
            f"({statuses[FRESH]} fresh, {statuses[AGEING]} ageing, {statuses[EXPIRED]} expired)"
        )
        self.stdout.write(f"  PurchaseOrders: {len(reorders)} raised by auto-reorder")
        self.stdout.write(f"  Customers:    {len(customers)}")
        self.stdout.write(f"  Orders:       {order_count}")
        self.stdout.write(f"  OrderItems:   {item_count}")
        self.stdout.write(f"  Invoices:     {invoice_count}")

        zero_margin = [i.code for i in CATALOGUE if Decimal(i.price_after_gst) >= Decimal(i.mrp)]
        if zero_margin:
            self.stdout.write(
                self.style.WARNING(
                    "  Note: the price list bills "
                    f"{', '.join(zero_margin)} at or above MRP, so they sell at no margin. "
                    "Loaded as given — check the source sheet."
                )
            )
