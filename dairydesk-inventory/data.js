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
  { id: 1, name: "Amul Gold Milk 1L", sku: "DRY-1001", category: "Dairy", quantity: 148, reorderPoint: 40, unitPrice: 68, supplierId: 1 },
  { id: 2, name: "Britannia Brown Bread", sku: "BAK-2001", category: "Bakery", quantity: 18, reorderPoint: 25, unitPrice: 45, supplierId: 2 },
  { id: 3, name: "Tata Salt 1kg", sku: "GRO-3001", category: "Grocery", quantity: 0, reorderPoint: 30, unitPrice: 28, supplierId: 3 },
  { id: 4, name: "Nescafe Classic 50g", sku: "BEV-4001", category: "Beverages", quantity: 76, reorderPoint: 20, unitPrice: 185, supplierId: 4 },
  { id: 5, name: "Lays Classic Salted", sku: "SNK-5001", category: "Snacks", quantity: 210, reorderPoint: 60, unitPrice: 20, supplierId: 4 },
  { id: 6, name: "Surf Excel 1kg", sku: "HOU-6001", category: "Household", quantity: 34, reorderPoint: 25, unitPrice: 165, supplierId: 3 },
  { id: 7, name: "Colgate Strong Teeth", sku: "PER-7001", category: "Personal Care", quantity: 12, reorderPoint: 20, unitPrice: 95, supplierId: 5 },
  { id: 8, name: "Amul Butter 500g", sku: "DRY-1002", category: "Dairy", quantity: 42, reorderPoint: 30, unitPrice: 275, supplierId: 1 },
  { id: 9, name: "Maggi Noodles 12-pack", sku: "GRO-3002", category: "Grocery", quantity: 95, reorderPoint: 40, unitPrice: 168, supplierId: 4 },
  { id: 10, name: "Tropicana Orange 1L", sku: "BEV-4002", category: "Beverages", quantity: 8, reorderPoint: 24, unitPrice: 120, supplierId: 6 },
  { id: 11, name: "Dettol Handwash 200ml", sku: "PER-7002", category: "Personal Care", quantity: 64, reorderPoint: 25, unitPrice: 99, supplierId: 5 },
  { id: 12, name: "Fortune Sunflower Oil 1L", sku: "GRO-3003", category: "Grocery", quantity: 52, reorderPoint: 30, unitPrice: 145, supplierId: 3 },
  { id: 13, name: "Cadbury Dairy Milk 55g", sku: "SNK-5002", category: "Snacks", quantity: 0, reorderPoint: 50, unitPrice: 50, supplierId: 4 },
  { id: 14, name: "Harpic Toilet Cleaner", sku: "HOU-6002", category: "Household", quantity: 27, reorderPoint: 20, unitPrice: 89, supplierId: 3 },
  { id: 15, name: "Nandini Curd 400g", sku: "DRY-1003", category: "Dairy", quantity: 22, reorderPoint: 35, unitPrice: 40, supplierId: 1 },
  { id: 16, name: "Parle-G Biscuits 800g", sku: "SNK-5003", category: "Snacks", quantity: 130, reorderPoint: 45, unitPrice: 85, supplierId: 2 },
  { id: 17, name: "Real Mixed Fruit 1L", sku: "BEV-4003", category: "Beverages", quantity: 46, reorderPoint: 24, unitPrice: 110, supplierId: 6 },
  { id: 18, name: "Vim Dishwash Bar", sku: "HOU-6003", category: "Household", quantity: 88, reorderPoint: 30, unitPrice: 25, supplierId: 3 },
  { id: 19, name: "Kissan Mixed Jam 500g", sku: "GRO-3004", category: "Grocery", quantity: 15, reorderPoint: 18, unitPrice: 160, supplierId: 6 },
  { id: 20, name: "Head & Shoulders 340ml", sku: "PER-7003", category: "Personal Care", quantity: 38, reorderPoint: 15, unitPrice: 340, supplierId: 5 },
];

/* ------------------------------- Orders -------------------------------- */

const ORDERS = [
  { id: "ORD-2417", date: "2026-09-02", party: "Walk-in Customer", type: "Sales", items: 6, quantity: 24, value: 2840, status: "Delivered" },
  { id: "PO-1182", date: "2026-09-02", party: "Sunrise Dairy Co.", type: "Purchase", items: 3, quantity: 180, value: 18400, status: "Shipped" },
  { id: "ORD-2416", date: "2026-09-01", party: "Sharma Provisions", type: "Sales", items: 12, quantity: 96, value: 11250, status: "Delivered" },
  { id: "PO-1181", date: "2026-09-01", party: "Nova Foods Pvt Ltd", type: "Purchase", items: 8, quantity: 240, value: 26800, status: "Pending" },
  { id: "ORD-2415", date: "2026-08-31", party: "Cafe Aroma", type: "Sales", items: 4, quantity: 40, value: 7400, status: "Shipped" },
  { id: "PO-1180", date: "2026-08-31", party: "Kirana Wholesale", type: "Purchase", items: 15, quantity: 420, value: 38900, status: "Delivered" },
  { id: "ORD-2414", date: "2026-08-30", party: "Walk-in Customer", type: "Sales", items: 2, quantity: 5, value: 640, status: "Cancelled" },
  { id: "ORD-2413", date: "2026-08-30", party: "Green Grocers", type: "Sales", items: 9, quantity: 72, value: 9180, status: "Delivered" },
  { id: "PO-1179", date: "2026-08-29", party: "FreshCare Supplies", type: "Purchase", items: 6, quantity: 150, value: 15600, status: "Delivered" },
  { id: "ORD-2412", date: "2026-08-29", party: "Hotel Palm Court", type: "Sales", items: 11, quantity: 130, value: 21400, status: "Pending" },
  { id: "PO-1178", date: "2026-08-28", party: "Juice Valley Beverages", type: "Purchase", items: 4, quantity: 96, value: 10560, status: "Cancelled" },
  { id: "ORD-2411", date: "2026-08-28", party: "Sharma Provisions", type: "Sales", items: 7, quantity: 58, value: 6720, status: "Delivered" },
  { id: "ORD-2410", date: "2026-08-27", party: "Walk-in Customer", type: "Sales", items: 3, quantity: 9, value: 1180, status: "Delivered" },
  { id: "PO-1177", date: "2026-08-27", party: "Sunrise Dairy Co.", type: "Purchase", items: 3, quantity: 200, value: 19800, status: "Shipped" },
  // Older history — enough rows that pagination and Load more are exercised.
  { id: "ORD-2409", date: "2026-08-26", party: "Green Grocers", type: "Sales", items: 5, quantity: 44, value: 5240, status: "Delivered" },
  { id: "ORD-2408", date: "2026-08-26", party: "Cafe Aroma", type: "Sales", items: 3, quantity: 28, value: 4980, status: "Delivered" },
  { id: "PO-1176", date: "2026-08-25", party: "Metro Snacks & Beverages", type: "Purchase", items: 9, quantity: 310, value: 22400, status: "Delivered" },
  { id: "ORD-2407", date: "2026-08-25", party: "Sharma Provisions", type: "Sales", items: 8, quantity: 64, value: 8130, status: "Delivered" },
  { id: "ORD-2406", date: "2026-08-24", party: "Hotel Palm Court", type: "Sales", items: 14, quantity: 152, value: 24600, status: "Delivered" },
  { id: "PO-1175", date: "2026-08-24", party: "Kirana Wholesale", type: "Purchase", items: 11, quantity: 380, value: 31200, status: "Cancelled" },
  { id: "ORD-2405", date: "2026-08-23", party: "Walk-in Customer", type: "Sales", items: 1, quantity: 3, value: 205, status: "Delivered" },
  { id: "ORD-2404", date: "2026-08-23", party: "Green Grocers", type: "Sales", items: 6, quantity: 51, value: 6890, status: "Shipped" },
  { id: "PO-1174", date: "2026-08-22", party: "FreshCare Supplies", type: "Purchase", items: 5, quantity: 140, value: 13750, status: "Delivered" },
  { id: "ORD-2403", date: "2026-08-22", party: "Cafe Aroma", type: "Sales", items: 4, quantity: 36, value: 5410, status: "Delivered" },
  { id: "ORD-2402", date: "2026-08-21", party: "Sharma Provisions", type: "Sales", items: 10, quantity: 88, value: 10420, status: "Pending" },
  { id: "PO-1173", date: "2026-08-21", party: "Juice Valley Beverages", type: "Purchase", items: 3, quantity: 84, value: 9240, status: "Delivered" },
  { id: "ORD-2401", date: "2026-08-20", party: "Hotel Palm Court", type: "Sales", items: 12, quantity: 118, value: 19800, status: "Delivered" },
  { id: "ORD-2400", date: "2026-08-20", party: "Walk-in Customer", type: "Sales", items: 2, quantity: 7, value: 890, status: "Cancelled" },
  { id: "PO-1172", date: "2026-08-19", party: "Sunrise Dairy Co.", type: "Purchase", items: 4, quantity: 220, value: 21400, status: "Delivered" },
  { id: "ORD-2399", date: "2026-08-19", party: "Green Grocers", type: "Sales", items: 7, quantity: 62, value: 7640, status: "Delivered" },
  { id: "ORD-2398", date: "2026-08-18", party: "Cafe Aroma", type: "Sales", items: 5, quantity: 41, value: 6120, status: "Shipped" },
  { id: "PO-1171", date: "2026-08-18", party: "Nova Foods Pvt Ltd", type: "Purchase", items: 7, quantity: 195, value: 17900, status: "Delivered" },
  { id: "ORD-2397", date: "2026-08-17", party: "Sharma Provisions", type: "Sales", items: 9, quantity: 76, value: 9350, status: "Delivered" },
  { id: "ORD-2396", date: "2026-08-17", party: "Walk-in Customer", type: "Sales", items: 4, quantity: 14, value: 1720, status: "Delivered" },
];

/* ------------------------------ Suppliers ------------------------------ */

const SUPPLIERS = [
  { id: 1, name: "Sunrise Dairy Co.", contact: "Meera Kulkarni", phone: "+91 98220 41220", email: "orders@sunrisedairy.in", productsSupplied: 3, lastOrder: "2026-09-02", rating: 4.8 },
  { id: 2, name: "Nova Foods Pvt Ltd", contact: "Rajat Menon", phone: "+91 98111 77304", email: "supply@novafoods.com", productsSupplied: 2, lastOrder: "2026-09-01", rating: 4.4 },
  { id: 3, name: "Kirana Wholesale", contact: "Anil Deshpande", phone: "+91 97654 20981", email: "anil@kiranawholesale.in", productsSupplied: 6, lastOrder: "2026-08-31", rating: 4.1 },
  { id: 4, name: "Metro Snacks & Beverages", contact: "Priya Nair", phone: "+91 99001 55432", email: "priya@metrosnacks.in", productsSupplied: 4, lastOrder: "2026-08-30", rating: 3.6 },
  { id: 5, name: "FreshCare Supplies", contact: "Vikram Shah", phone: "+91 98330 60117", email: "vikram@freshcare.co.in", productsSupplied: 3, lastOrder: "2026-08-29", rating: 4.6 },
  { id: 6, name: "Juice Valley Beverages", contact: "Sana Qureshi", phone: "+91 97020 33845", email: "sales@juicevalley.in", productsSupplied: 3, lastOrder: "2026-08-28", rating: 3.2 },
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

const DEFAULT_THRESHOLDS = {
  lowStock: 25,
  reorderPoint: 30,
  overstockLimit: 200,
  criticalStock: 10,
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
