/* ==========================================================================
   data.js — mock data + the single data-access layer.
   Every page reads through `api.*`. Nothing else touches these arrays, so
   swapping mock for a real backend is a change to this file alone.

   To go live, set API_BASE and flip USE_MOCK to false; each method already
   has the equivalent fetch call written beside it.
   ========================================================================== */

const API_BASE = "/api";
const USE_MOCK = true;

/* Mock reads resolve after a short pause so the skeleton loaders are visible.
   Set to 0 for instant loads; a real backend supplies its own latency. */
const MOCK_LATENCY = 420;
const delay = (ms = MOCK_LATENCY) => new Promise((r) => setTimeout(r, ms));

/* ------------------------- Users and permissions ------------------------ */
/* Mirrors DairyDesk's rule (backend/core/permissions.py): staff perform every
   operational task but must not see financial data. Same demo credentials.

   NOTE: this is frontend-only gating for the mock build. It hides data from an
   honest user; it is NOT security — anyone can edit localStorage or the JS.
   Real enforcement has to live on the server, which is what `api.login` below
   is written to swap over to. */

const USERS = [
  { username: "owner", password: "owner123", role: "owner", name: "Store Owner" },
  { username: "staff", password: "staff123", role: "staff", name: "Store Staff" },
];

/* `financials` covers only what DairyDesk actually withholds: the aggregate
   money figures (total_available_stock_value, todays_sales_total,
   unpaid_invoice_count) and the Invoices page — which maps to Reports here.
   Staff still see unit prices and order totals, exactly as they do in
   DairyDesk's order form and orders table. */
const PERMISSIONS = {
  owner: {
    financials: true,
    pages: ["dashboard", "products", "stock", "orders", "suppliers", "reports", "alerts"],
    addProduct: true,
    addOrder: true,
    addSupplier: true,
    editThresholds: true,
  },
  staff: {
    financials: false,
    // No Reports — it is this app's Invoices: the owner-only financial export.
    pages: ["dashboard", "products", "stock", "orders", "suppliers", "alerts"],
    addProduct: true, // staff receive stock in DairyDesk
    addOrder: true, // staff create and progress orders in DairyDesk
    addSupplier: false, // vendor management stays with the owner
    editThresholds: false, // alert settings are an owner decision
  },
};

const SESSION_KEY = "dairydesk_inventory_session";

/* ------------------------------- Store --------------------------------- */

const STORE = {
  name: "DairyDesk",
  code: "STORE-01",
  city: "Pune, MH",
  lastRestock: "2 Sep 2026, 09:40 AM",
};

/* ------------------------------ Products ------------------------------- */
/* reorderPoint drives the Low Stock status; overstockLimit drives Overstock. */

const PRODUCTS = [
  { id: 1, name: "Golden Cow Milk 230 ml Sachet", sku: "10932", category: "Milk", quantity: 156, reorderPoint: 52, unitPrice: 14, supplierId: 1 },
  { id: 2, name: "Golden Cow Milk 500 ml Sachet", sku: "10913", category: "Milk", quantity: 72, reorderPoint: 24, unitPrice: 28, supplierId: 1 },
  { id: 3, name: "Golden Cow Milk 1 L Sachet", sku: "10914", category: "Milk", quantity: 24, reorderPoint: 12, unitPrice: 55, supplierId: 1 },
  { id: 4, name: "Toned Milk Family Pack 500 ml Sachet", sku: "10519", category: "Milk", quantity: 72, reorderPoint: 24, unitPrice: 27, supplierId: 1 },
  { id: 5, name: "Toned Milk Family Pack 1 L Sachet", sku: "10521", category: "Milk", quantity: 6, reorderPoint: 12, unitPrice: 53, supplierId: 1 },
  { id: 6, name: "Toned Milk Family Pack 5 L Sachet", sku: "10561", category: "Milk", quantity: 0, reorderPoint: 2, unitPrice: 280, supplierId: 1 },
  { id: 7, name: "Standardised Milk 500 ml Sachet", sku: "10613", category: "Milk", quantity: 72, reorderPoint: 24, unitPrice: 29, supplierId: 1 },
  { id: 8, name: "Standardised Milk 1 L Sachet", sku: "10614", category: "Milk", quantity: 24, reorderPoint: 12, unitPrice: 58, supplierId: 1 },
  { id: 9, name: "A2 Milk 500 ml Sachet", sku: "10833", category: "Milk", quantity: 48, reorderPoint: 24, unitPrice: 33, supplierId: 1 },
  { id: 10, name: "A2 Milk 1 L Sachet", sku: "10834", category: "Milk", quantity: 48, reorderPoint: 12, unitPrice: 66, supplierId: 1 },
  { id: 11, name: "Curd 120 g Sachet", sku: "10173", category: "Curd", quantity: 200, reorderPoint: 100, unitPrice: 10, supplierId: 2 },
  { id: 12, name: "Curd 220 g Sachet", sku: "10188", category: "Curd", quantity: 112, reorderPoint: 56, unitPrice: 20, supplierId: 2 },
  { id: 13, name: "Curd 500 g Sachet", sku: "10104", category: "Curd", quantity: 72, reorderPoint: 24, unitPrice: 40, supplierId: 2 },
  { id: 14, name: "Curd 1 kg Sachet", sku: "10105", category: "Curd", quantity: 6, reorderPoint: 12, unitPrice: 77, supplierId: 2 },
  { id: 15, name: "Double Toned Curd 1 kg Sachet", sku: "10139", category: "Curd", quantity: 24, reorderPoint: 12, unitPrice: 67, supplierId: 2 },
  { id: 16, name: "Toned Milk Curd 70 g Cup", sku: "20068", category: "Curd", quantity: 72, reorderPoint: 24, unitPrice: 10, supplierId: 2 },
  { id: 17, name: "Toned Milk Curd 200 g Cup", sku: "20012", category: "Curd", quantity: 0, reorderPoint: 20, unitPrice: 30, supplierId: 2 },
  { id: 18, name: "Toned Milk Curd 400 g Cup", sku: "20013", category: "Curd", quantity: 36, reorderPoint: 12, unitPrice: 85, supplierId: 2 },
  { id: 19, name: "Probiotic Buttermilk 400 ml Sachet", sku: "10042", category: "Buttermilk & Lassi", quantity: 66, reorderPoint: 22, unitPrice: 12, supplierId: 2 },
  { id: 20, name: "Plain Buttermilk 500 ml Sachet", sku: "10033", category: "Buttermilk & Lassi", quantity: 44, reorderPoint: 22, unitPrice: 16, supplierId: 2 },
  { id: 21, name: "Spiced Buttermilk 180 ml Brik", sku: "31217", category: "Buttermilk & Lassi", quantity: 60, reorderPoint: 30, unitPrice: 15, supplierId: 3 },
  { id: 22, name: "Sweet Lassi 165 ml", sku: "20535", category: "Buttermilk & Lassi", quantity: 112, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 23, name: "Mango Lassi 165 ml", sku: "20536", category: "Buttermilk & Lassi", quantity: 14, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 24, name: "Strawberry Lassi 165 ml", sku: "20537", category: "Buttermilk & Lassi", quantity: 56, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 25, name: "Shrikhand Kesar 100 g Cup", sku: "20601", category: "Sweets & Desserts", quantity: 180, reorderPoint: 60, unitPrice: 45, supplierId: 2 },
  { id: 26, name: "Shrikhand Kesar 250 g Cup", sku: "20602", category: "Sweets & Desserts", quantity: 72, reorderPoint: 24, unitPrice: 100, supplierId: 2 },
  { id: 27, name: "Amrakhand 100 g Cup", sku: "20651", category: "Sweets & Desserts", quantity: 120, reorderPoint: 60, unitPrice: 45, supplierId: 2 },
  { id: 28, name: "Amrakhand 250 g Cup", sku: "20652", category: "Sweets & Desserts", quantity: 0, reorderPoint: 24, unitPrice: 100, supplierId: 2 },
  { id: 29, name: "Paneer 200 g Polypack", sku: "20411", category: "Paneer", quantity: 140, reorderPoint: 70, unitPrice: 120, supplierId: 2 },
  { id: 30, name: "Flavoured Milk Badam 200 ml Bottle", sku: "30715", category: "Flavoured Milk", quantity: 63, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 31, name: "Flavoured Milk Chocolate 200 ml Bottle", sku: "30754", category: "Flavoured Milk", quantity: 63, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 32, name: "Flavoured Milk Vanilla 200 ml Bottle", sku: "30723", category: "Flavoured Milk", quantity: 10, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 33, name: "Flavoured Milk Pista 200 ml Bottle", sku: "30744", category: "Flavoured Milk", quantity: 42, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 34, name: "Flavoured Milk Strawberry 200 ml Bottle", sku: "30764", category: "Flavoured Milk", quantity: 84, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 35, name: "Rich Badam Flavoured Milk 180 ml Bottle", sku: "30707", category: "Flavoured Milk", quantity: 48, reorderPoint: 24, unitPrice: 40, supplierId: 3 },
  { id: 36, name: "Rich Pista Flavoured Milk 180 ml Bottle", sku: "30748", category: "Flavoured Milk", quantity: 48, reorderPoint: 24, unitPrice: 40, supplierId: 3 },
  { id: 37, name: "Cold Coffee 180 ml Tin", sku: "30787", category: "Flavoured Milk", quantity: 78, reorderPoint: 26, unitPrice: 50, supplierId: 3 },
  { id: 38, name: "Badam Charger 180 ml Bottle", sku: "30793", category: "Flavoured Milk", quantity: 63, reorderPoint: 21, unitPrice: 35, supplierId: 3 },
  { id: 39, name: "Milkshake Chocolate 125 ml", sku: "31215", category: "Milkshakes", quantity: 0, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 40, name: "Milkshake Cookies & Cream 125 ml", sku: "31216", category: "Milkshakes", quantity: 120, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 41, name: "Milkshake Strawberry 125 ml", sku: "31225", category: "Milkshakes", quantity: 20, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 42, name: "Milkshake Vanilla 125 ml", sku: "31235", category: "Milkshakes", quantity: 120, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 43, name: "Gluco Shakti Orange Whey Drink 200 ml", sku: "21102", category: "Whey Drinks", quantity: 90, reorderPoint: 30, unitPrice: 12, supplierId: 3 },
  { id: 44, name: "Farm Fresh UHT Milk 1 L Brik", sku: "71005", category: "UHT Milk", quantity: 22, reorderPoint: 11, unitPrice: 75, supplierId: 3 },
  { id: 45, name: "Cow Ghee 500 ml Pouch", sku: "30234", category: "Ghee", quantity: 48, reorderPoint: 24, unitPrice: 345, supplierId: 4 },
  { id: 46, name: "Cow Ghee 1 L Pouch", sku: "30235", category: "Ghee", quantity: 48, reorderPoint: 12, unitPrice: 685, supplierId: 4 },
  { id: 47, name: "AGMARK Buffalo Ghee 500 ml Pouch", sku: "30334", category: "Ghee", quantity: 48, reorderPoint: 24, unitPrice: 345, supplierId: 4 },
  { id: 48, name: "AGMARK Buffalo Ghee 1 L Pouch", sku: "30335", category: "Ghee", quantity: 24, reorderPoint: 12, unitPrice: 685, supplierId: 4 },
  { id: 49, name: "Cow Ghee 200 ml Jar", sku: "30252", category: "Ghee", quantity: 180, reorderPoint: 60, unitPrice: 150, supplierId: 4 },
  { id: 50, name: "Cow Ghee 500 ml Jar", sku: "30254", category: "Ghee", quantity: 0, reorderPoint: 24, unitPrice: 365, supplierId: 4 },
  { id: 51, name: "Cow Ghee 1 L Jar", sku: "30255", category: "Ghee", quantity: 24, reorderPoint: 12, unitPrice: 720, supplierId: 4 },
  { id: 52, name: "Cheese Slices 100 g", sku: "73000", category: "Cheese", quantity: 180, reorderPoint: 60, unitPrice: 115, supplierId: 4 },
  { id: 53, name: "Cheese Slices 200 g", sku: "73001", category: "Cheese", quantity: 60, reorderPoint: 30, unitPrice: 215, supplierId: 4 },
  { id: 54, name: "Cheese Cubes 200 g", sku: "73003", category: "Cheese", quantity: 144, reorderPoint: 48, unitPrice: 128, supplierId: 4 },
  { id: 55, name: "Cheese Cubes 120 g", sku: "73004", category: "Cheese", quantity: 180, reorderPoint: 60, unitPrice: 90, supplierId: 4 },
  { id: 56, name: "Cheese Block 200 g", sku: "73005", category: "Cheese", quantity: 96, reorderPoint: 48, unitPrice: 135, supplierId: 4 },
  { id: 57, name: "Pasteurised Table Butter 100 g", sku: "20133", category: "Butter", quantity: 320, reorderPoint: 160, unitPrice: 60, supplierId: 4 },
  { id: 58, name: "Pasteurised Table Butter 500 g", sku: "20134", category: "Butter", quantity: 120, reorderPoint: 30, unitPrice: 290, supplierId: 4 },
];

/* ------------------------------- Orders -------------------------------- */

const ORDERS = [
  { id: "ORD-2417", date: "2026-09-02", party: "Walk-in Customer", type: "Sales", items: 6, quantity: 24, value: 2840, status: "Delivered" },
  { id: "PO-1182", date: "2026-09-02", party: "Heritage Foods Ltd — Fresh Milk Depot", type: "Purchase", items: 3, quantity: 180, value: 18400, status: "Shipped" },
  { id: "ORD-2416", date: "2026-09-01", party: "Sharma Provisions", type: "Sales", items: 12, quantity: 96, value: 11250, status: "Delivered" },
  { id: "PO-1181", date: "2026-09-01", party: "Heritage Foods Ltd — Curd & Chilled Depot", type: "Purchase", items: 8, quantity: 240, value: 26800, status: "Pending" },
  { id: "ORD-2415", date: "2026-08-31", party: "Cafe Aroma", type: "Sales", items: 4, quantity: 40, value: 7400, status: "Shipped" },
  { id: "PO-1180", date: "2026-08-31", party: "Heritage Foods Ltd — Ghee, Cheese & Butter Depot", type: "Purchase", items: 15, quantity: 420, value: 38900, status: "Delivered" },
  { id: "ORD-2414", date: "2026-08-30", party: "Walk-in Customer", type: "Sales", items: 2, quantity: 5, value: 640, status: "Cancelled" },
  { id: "ORD-2413", date: "2026-08-30", party: "Green Grocers", type: "Sales", items: 9, quantity: 72, value: 9180, status: "Delivered" },
  { id: "PO-1179", date: "2026-08-29", party: "Heritage Foods Ltd — Curd & Chilled Depot", type: "Purchase", items: 6, quantity: 150, value: 15600, status: "Delivered" },
  { id: "ORD-2412", date: "2026-08-29", party: "Hotel Palm Court", type: "Sales", items: 11, quantity: 130, value: 21400, status: "Pending" },
  { id: "PO-1178", date: "2026-08-28", party: "Heritage Foods Ltd — Beverage Depot", type: "Purchase", items: 4, quantity: 96, value: 10560, status: "Cancelled" },
  { id: "ORD-2411", date: "2026-08-28", party: "Sharma Provisions", type: "Sales", items: 7, quantity: 58, value: 6720, status: "Delivered" },
  { id: "ORD-2410", date: "2026-08-27", party: "Walk-in Customer", type: "Sales", items: 3, quantity: 9, value: 1180, status: "Delivered" },
  { id: "PO-1177", date: "2026-08-27", party: "Heritage Foods Ltd — Fresh Milk Depot", type: "Purchase", items: 3, quantity: 200, value: 19800, status: "Shipped" },
  // Older history — enough rows that pagination and Load more are exercised.
  { id: "ORD-2409", date: "2026-08-26", party: "Green Grocers", type: "Sales", items: 5, quantity: 44, value: 5240, status: "Delivered" },
  { id: "ORD-2408", date: "2026-08-26", party: "Cafe Aroma", type: "Sales", items: 3, quantity: 28, value: 4980, status: "Delivered" },
  { id: "PO-1176", date: "2026-08-25", party: "Heritage Foods Ltd — Beverage Depot", type: "Purchase", items: 9, quantity: 310, value: 22400, status: "Delivered" },
  { id: "ORD-2407", date: "2026-08-25", party: "Sharma Provisions", type: "Sales", items: 8, quantity: 64, value: 8130, status: "Delivered" },
  { id: "ORD-2406", date: "2026-08-24", party: "Hotel Palm Court", type: "Sales", items: 14, quantity: 152, value: 24600, status: "Delivered" },
  { id: "PO-1175", date: "2026-08-24", party: "Heritage Foods Ltd — Ghee, Cheese & Butter Depot", type: "Purchase", items: 11, quantity: 380, value: 31200, status: "Cancelled" },
  { id: "ORD-2405", date: "2026-08-23", party: "Walk-in Customer", type: "Sales", items: 1, quantity: 3, value: 205, status: "Delivered" },
  { id: "ORD-2404", date: "2026-08-23", party: "Green Grocers", type: "Sales", items: 6, quantity: 51, value: 6890, status: "Shipped" },
  { id: "PO-1174", date: "2026-08-22", party: "Heritage Foods Ltd — Curd & Chilled Depot", type: "Purchase", items: 5, quantity: 140, value: 13750, status: "Delivered" },
  { id: "ORD-2403", date: "2026-08-22", party: "Cafe Aroma", type: "Sales", items: 4, quantity: 36, value: 5410, status: "Delivered" },
  { id: "ORD-2402", date: "2026-08-21", party: "Sharma Provisions", type: "Sales", items: 10, quantity: 88, value: 10420, status: "Pending" },
  { id: "PO-1173", date: "2026-08-21", party: "Heritage Foods Ltd — Beverage Depot", type: "Purchase", items: 3, quantity: 84, value: 9240, status: "Delivered" },
  { id: "ORD-2401", date: "2026-08-20", party: "Hotel Palm Court", type: "Sales", items: 12, quantity: 118, value: 19800, status: "Delivered" },
  { id: "ORD-2400", date: "2026-08-20", party: "Walk-in Customer", type: "Sales", items: 2, quantity: 7, value: 890, status: "Cancelled" },
  { id: "PO-1172", date: "2026-08-19", party: "Heritage Foods Ltd — Fresh Milk Depot", type: "Purchase", items: 4, quantity: 220, value: 21400, status: "Delivered" },
  { id: "ORD-2399", date: "2026-08-19", party: "Green Grocers", type: "Sales", items: 7, quantity: 62, value: 7640, status: "Delivered" },
  { id: "ORD-2398", date: "2026-08-18", party: "Cafe Aroma", type: "Sales", items: 5, quantity: 41, value: 6120, status: "Shipped" },
  { id: "PO-1171", date: "2026-08-18", party: "Heritage Foods Ltd — Curd & Chilled Depot", type: "Purchase", items: 7, quantity: 195, value: 17900, status: "Delivered" },
  { id: "ORD-2397", date: "2026-08-17", party: "Sharma Provisions", type: "Sales", items: 9, quantity: 76, value: 9350, status: "Delivered" },
  { id: "ORD-2396", date: "2026-08-17", party: "Walk-in Customer", type: "Sales", items: 4, quantity: 14, value: 1720, status: "Delivered" },
];

/* ------------------------------ Suppliers ------------------------------ */

const SUPPLIERS = [
  { id: 1, name: "Heritage Foods Ltd — Fresh Milk Depot", contact: "S. Prasad", phone: "+91 90000 11201", email: "freshmilk.depot@heritagefoods.example", productsSupplied: 10, lastOrder: "2026-09-02", rating: 4.7 },
  { id: 2, name: "Heritage Foods Ltd — Curd & Chilled Depot", contact: "K. Lakshmi", phone: "+91 90000 11202", email: "chilled.depot@heritagefoods.example", productsSupplied: 15, lastOrder: "2026-09-01", rating: 4.5 },
  { id: 3, name: "Heritage Foods Ltd — Beverage Depot", contact: "R. Naveen", phone: "+91 90000 11203", email: "beverages.depot@heritagefoods.example", productsSupplied: 19, lastOrder: "2026-08-27", rating: 4.2 },
  { id: 4, name: "Heritage Foods Ltd — Ghee, Cheese & Butter Depot", contact: "M. Yadagiri", phone: "+91 90000 11204", email: "ghee.depot@heritagefoods.example", productsSupplied: 14, lastOrder: "2026-08-21", rating: 4.6 },
];

/* --------------------------- Stock movement ---------------------------- */
/* 60 days of stock-in / stock-out, generated deterministically so the chart
   is stable across reloads. Replace with GET /api/movement?days=N. */

const MOVEMENT = (() => {
  const rows = [];
  const today = new Date("2026-09-02T00:00:00");
  // Deterministic pseudo-random so the trend looks organic but never shifts.
  const rand = (seed) => {
    const s = Math.sin(seed * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = weekend ? 1.35 : 1;
    rows.push({
      date: d.toISOString().slice(0, 10),
      stockIn: Math.round(40 + rand(i + 1) * 150),
      stockOut: Math.round((55 + rand(i + 77) * 120) * base),
    });
  }
  return rows;
})();

/* ------------------------------ Trends --------------------------------- */
/* Day-on-day deltas for the dashboard tiles. `goodWhen` says which direction
   is an improvement, so rising low-stock reads as bad while rising orders
   reads as good — the arrow shows direction, the colour shows meaning. */

const TRENDS = {
  totalProducts: { delta: 3, period: "vs yesterday", goodWhen: "up" },
  low: { delta: 2, period: "vs yesterday", goodWhen: "down" },
  pending: { delta: -1, period: "vs yesterday", goodWhen: "down" },
  todayOrders: { delta: 4, period: "vs yesterday", goodWhen: "up" },
};

/* ----------------------------- Thresholds ------------------------------ */

/* Retuned for the Heritage catalogue, which is counted in packs and bought by
   the crate: crates run from 2 (the 5 L milk sachet) to 160 (100 g butter), so
   the old 10/25/200 band called two normal crates of butter an overstock and
   never called a curd crate low. The user can still edit all four in Settings. */
const DEFAULT_THRESHOLDS = {
  lowStock: 40,
  reorderPoint: 50,
  overstockLimit: 400,
  criticalStock: 20,
};

/* ========================= Derived helpers ============================== */

/** Single source of truth for a product's stock status. */
function statusOf(product) {
  if (product.quantity === 0) return "Out of Stock";
  if (product.quantity <= product.reorderPoint) return "Low Stock";
  return "In Stock";
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/* ============================ Data access ============================== */
/* Async on purpose: the UI already awaits everything, so pointing these at a
   real server needs no changes anywhere else. */

const api = {
  /** Swap for: POST `${API_BASE}/auth/login/` -> { access, refresh, username, role } */
  async login(username, password) {
    const found = USERS.find((u) => u.username === username && u.password === password);
    if (!found) throw new Error("Wrong username or password.");
    const session = { username: found.username, role: found.role, name: found.name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ...session };
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
  },

  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      return s && PERMISSIONS[s.role] ? s : null;
    } catch {
      return null;
    }
  },

  async getStore() {
    // return (await fetch(`${API_BASE}/store`)).json();
    await delay();
    return clone(STORE);
  },

  async getProducts() {
    // return (await fetch(`${API_BASE}/products`)).json();
    await delay();
    return clone(PRODUCTS);
  },

  async getTrends() {
    // return (await fetch(`${API_BASE}/dashboard/trends`)).json();
    await delay();
    return clone(TRENDS);
  },

  async addProduct(product) {
    // return (await fetch(`${API_BASE}/products`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(product) })).json();
    const id = Math.max(0, ...PRODUCTS.map((p) => p.id)) + 1;
    const row = { id, supplierId: null, ...product };
    PRODUCTS.unshift(row);
    return clone(row);
  },

  async getOrders() {
    // return (await fetch(`${API_BASE}/orders`)).json();
    await delay();
    return clone(ORDERS);
  },

  /** Swap for: PATCH `${API_BASE}/orders/${id}/` with { status }. */
  async updateOrderStatus(id, status) {
    const row = ORDERS.find((o) => o.id === id);
    if (!row) throw new Error(`Order ${id} not found.`);
    row.status = status;
    return clone(row);
  },

  async addOrder(order) {
    // return (await fetch(`${API_BASE}/orders`, { method: 'POST', ... })).json();
    ORDERS.unshift(order);
    return clone(order);
  },

  async getSuppliers() {
    // return (await fetch(`${API_BASE}/suppliers`)).json();
    await delay();
    return clone(SUPPLIERS);
  },

  async addSupplier(supplier) {
    // return (await fetch(`${API_BASE}/suppliers`, { method: 'POST', ... })).json();
    const id = Math.max(0, ...SUPPLIERS.map((s) => s.id)) + 1;
    const row = { id, productsSupplied: 0, lastOrder: "—", ...supplier };
    SUPPLIERS.unshift(row);
    return clone(row);
  },

  async getMovement(days) {
    // return (await fetch(`${API_BASE}/movement?days=${days}`)).json();
    const rows = clone(MOVEMENT);
    return days === "all" ? rows : rows.slice(-Number(days));
  },

  /** Thresholds persist per-browser until a real settings endpoint exists. */
  async getThresholds() {
    // return (await fetch(`${API_BASE}/settings/thresholds`)).json();
    try {
      const saved = JSON.parse(localStorage.getItem("dairydesk_inventory_thresholds"));
      return { ...DEFAULT_THRESHOLDS, ...(saved || {}) };
    } catch {
      return { ...DEFAULT_THRESHOLDS };
    }
  },

  async saveThresholds(values) {
    // return (await fetch(`${API_BASE}/settings/thresholds`, { method: 'PUT', ... })).json();
    localStorage.setItem("dairydesk_inventory_thresholds", JSON.stringify(values));
    return clone(values);
  },
};
