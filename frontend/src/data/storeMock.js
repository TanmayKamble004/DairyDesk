/**
 * Store-inventory demo data, ported from the standalone dairydesk-inventory
 * build so the Stock Levels and Reports pages render the same figures here as
 * they do there.
 *
 * This is deliberately mock data: it describes a store nobody stocks. Products,
 * Inventory and Alerts have moved to the API; the pages still importing PRODUCTS
 * and MOVEMENT are the ones with no endpoint behind them yet. Swap each export
 * for a fetch as those endpoints arrive, and this file shrinks to the
 * formatting helpers below.
 */

export const STORE = {
  name: 'DairyDesk',
  code: 'STORE-01',
  city: 'Pune, MH',
  lastRestock: '2 Sep 2026, 09:40 AM',
}

/* The Heritage Foods catalogue, mirroring what `seed_demo` loads into the API:
   `sku` is Heritage's item code, `unitPrice` its MRP, `reorderPoint` the crate
   size ("billing EA"), and `quantity` the packs on hand once expired batches
   are set aside. Everything is counted in packs, as it is server-side.

   Kept in step with backend/core/management/commands/seed_demo.py by hand —
   these two pages are the ones still without an endpoint. */
export const PRODUCTS = [
  { id: 1, name: 'Golden Cow Milk 230 ml Sachet', sku: '10932', category: 'Milk', quantity: 156, reorderPoint: 52, unitPrice: 14, supplierId: 1 },
  { id: 2, name: 'Golden Cow Milk 500 ml Sachet', sku: '10913', category: 'Milk', quantity: 72, reorderPoint: 24, unitPrice: 28, supplierId: 1 },
  { id: 3, name: 'Golden Cow Milk 1 L Sachet', sku: '10914', category: 'Milk', quantity: 24, reorderPoint: 12, unitPrice: 55, supplierId: 1 },
  { id: 4, name: 'Toned Milk Family Pack 500 ml Sachet', sku: '10519', category: 'Milk', quantity: 72, reorderPoint: 24, unitPrice: 27, supplierId: 1 },
  { id: 5, name: 'Toned Milk Family Pack 1 L Sachet', sku: '10521', category: 'Milk', quantity: 6, reorderPoint: 12, unitPrice: 53, supplierId: 1 },
  { id: 6, name: 'Toned Milk Family Pack 5 L Sachet', sku: '10561', category: 'Milk', quantity: 0, reorderPoint: 2, unitPrice: 280, supplierId: 1 },
  { id: 7, name: 'Standardised Milk 500 ml Sachet', sku: '10613', category: 'Milk', quantity: 72, reorderPoint: 24, unitPrice: 29, supplierId: 1 },
  { id: 8, name: 'Standardised Milk 1 L Sachet', sku: '10614', category: 'Milk', quantity: 24, reorderPoint: 12, unitPrice: 58, supplierId: 1 },
  { id: 9, name: 'A2 Milk 500 ml Sachet', sku: '10833', category: 'Milk', quantity: 48, reorderPoint: 24, unitPrice: 33, supplierId: 1 },
  { id: 10, name: 'A2 Milk 1 L Sachet', sku: '10834', category: 'Milk', quantity: 48, reorderPoint: 12, unitPrice: 66, supplierId: 1 },
  { id: 11, name: 'Curd 120 g Sachet', sku: '10173', category: 'Curd', quantity: 200, reorderPoint: 100, unitPrice: 10, supplierId: 2 },
  { id: 12, name: 'Curd 220 g Sachet', sku: '10188', category: 'Curd', quantity: 112, reorderPoint: 56, unitPrice: 20, supplierId: 2 },
  { id: 13, name: 'Curd 500 g Sachet', sku: '10104', category: 'Curd', quantity: 72, reorderPoint: 24, unitPrice: 40, supplierId: 2 },
  { id: 14, name: 'Curd 1 kg Sachet', sku: '10105', category: 'Curd', quantity: 6, reorderPoint: 12, unitPrice: 77, supplierId: 2 },
  { id: 15, name: 'Double Toned Curd 1 kg Sachet', sku: '10139', category: 'Curd', quantity: 24, reorderPoint: 12, unitPrice: 67, supplierId: 2 },
  { id: 16, name: 'Toned Milk Curd 70 g Cup', sku: '20068', category: 'Curd', quantity: 72, reorderPoint: 24, unitPrice: 10, supplierId: 2 },
  { id: 17, name: 'Toned Milk Curd 200 g Cup', sku: '20012', category: 'Curd', quantity: 0, reorderPoint: 20, unitPrice: 30, supplierId: 2 },
  { id: 18, name: 'Toned Milk Curd 400 g Cup', sku: '20013', category: 'Curd', quantity: 36, reorderPoint: 12, unitPrice: 85, supplierId: 2 },
  { id: 19, name: 'Probiotic Buttermilk 400 ml Sachet', sku: '10042', category: 'Buttermilk & Lassi', quantity: 66, reorderPoint: 22, unitPrice: 12, supplierId: 2 },
  { id: 20, name: 'Plain Buttermilk 500 ml Sachet', sku: '10033', category: 'Buttermilk & Lassi', quantity: 44, reorderPoint: 22, unitPrice: 16, supplierId: 2 },
  { id: 21, name: 'Spiced Buttermilk 180 ml Brik', sku: '31217', category: 'Buttermilk & Lassi', quantity: 60, reorderPoint: 30, unitPrice: 15, supplierId: 3 },
  { id: 22, name: 'Sweet Lassi 165 ml', sku: '20535', category: 'Buttermilk & Lassi', quantity: 112, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 23, name: 'Mango Lassi 165 ml', sku: '20536', category: 'Buttermilk & Lassi', quantity: 14, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 24, name: 'Strawberry Lassi 165 ml', sku: '20537', category: 'Buttermilk & Lassi', quantity: 56, reorderPoint: 28, unitPrice: 25, supplierId: 3 },
  { id: 25, name: 'Shrikhand Kesar 100 g Cup', sku: '20601', category: 'Sweets & Desserts', quantity: 180, reorderPoint: 60, unitPrice: 45, supplierId: 2 },
  { id: 26, name: 'Shrikhand Kesar 250 g Cup', sku: '20602', category: 'Sweets & Desserts', quantity: 72, reorderPoint: 24, unitPrice: 100, supplierId: 2 },
  { id: 27, name: 'Amrakhand 100 g Cup', sku: '20651', category: 'Sweets & Desserts', quantity: 120, reorderPoint: 60, unitPrice: 45, supplierId: 2 },
  { id: 28, name: 'Amrakhand 250 g Cup', sku: '20652', category: 'Sweets & Desserts', quantity: 0, reorderPoint: 24, unitPrice: 100, supplierId: 2 },
  { id: 29, name: 'Paneer 200 g Polypack', sku: '20411', category: 'Paneer', quantity: 140, reorderPoint: 70, unitPrice: 120, supplierId: 2 },
  { id: 30, name: 'Flavoured Milk Badam 200 ml Bottle', sku: '30715', category: 'Flavoured Milk', quantity: 63, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 31, name: 'Flavoured Milk Chocolate 200 ml Bottle', sku: '30754', category: 'Flavoured Milk', quantity: 63, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 32, name: 'Flavoured Milk Vanilla 200 ml Bottle', sku: '30723', category: 'Flavoured Milk', quantity: 10, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 33, name: 'Flavoured Milk Pista 200 ml Bottle', sku: '30744', category: 'Flavoured Milk', quantity: 42, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 34, name: 'Flavoured Milk Strawberry 200 ml Bottle', sku: '30764', category: 'Flavoured Milk', quantity: 84, reorderPoint: 21, unitPrice: 30, supplierId: 3 },
  { id: 35, name: 'Rich Badam Flavoured Milk 180 ml Bottle', sku: '30707', category: 'Flavoured Milk', quantity: 48, reorderPoint: 24, unitPrice: 40, supplierId: 3 },
  { id: 36, name: 'Rich Pista Flavoured Milk 180 ml Bottle', sku: '30748', category: 'Flavoured Milk', quantity: 48, reorderPoint: 24, unitPrice: 40, supplierId: 3 },
  { id: 37, name: 'Cold Coffee 180 ml Tin', sku: '30787', category: 'Flavoured Milk', quantity: 78, reorderPoint: 26, unitPrice: 50, supplierId: 3 },
  { id: 38, name: 'Badam Charger 180 ml Bottle', sku: '30793', category: 'Flavoured Milk', quantity: 63, reorderPoint: 21, unitPrice: 35, supplierId: 3 },
  { id: 39, name: 'Milkshake Chocolate 125 ml', sku: '31215', category: 'Milkshakes', quantity: 0, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 40, name: 'Milkshake Cookies & Cream 125 ml', sku: '31216', category: 'Milkshakes', quantity: 120, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 41, name: 'Milkshake Strawberry 125 ml', sku: '31225', category: 'Milkshakes', quantity: 20, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 42, name: 'Milkshake Vanilla 125 ml', sku: '31235', category: 'Milkshakes', quantity: 120, reorderPoint: 40, unitPrice: 15, supplierId: 3 },
  { id: 43, name: 'Gluco Shakti Orange Whey Drink 200 ml', sku: '21102', category: 'Whey Drinks', quantity: 90, reorderPoint: 30, unitPrice: 12, supplierId: 3 },
  { id: 44, name: 'Farm Fresh UHT Milk 1 L Brik', sku: '71005', category: 'UHT Milk', quantity: 22, reorderPoint: 11, unitPrice: 75, supplierId: 3 },
  { id: 45, name: 'Cow Ghee 500 ml Pouch', sku: '30234', category: 'Ghee', quantity: 48, reorderPoint: 24, unitPrice: 345, supplierId: 4 },
  { id: 46, name: 'Cow Ghee 1 L Pouch', sku: '30235', category: 'Ghee', quantity: 48, reorderPoint: 12, unitPrice: 685, supplierId: 4 },
  { id: 47, name: 'AGMARK Buffalo Ghee 500 ml Pouch', sku: '30334', category: 'Ghee', quantity: 48, reorderPoint: 24, unitPrice: 345, supplierId: 4 },
  { id: 48, name: 'AGMARK Buffalo Ghee 1 L Pouch', sku: '30335', category: 'Ghee', quantity: 24, reorderPoint: 12, unitPrice: 685, supplierId: 4 },
  { id: 49, name: 'Cow Ghee 200 ml Jar', sku: '30252', category: 'Ghee', quantity: 180, reorderPoint: 60, unitPrice: 150, supplierId: 4 },
  { id: 50, name: 'Cow Ghee 500 ml Jar', sku: '30254', category: 'Ghee', quantity: 0, reorderPoint: 24, unitPrice: 365, supplierId: 4 },
  { id: 51, name: 'Cow Ghee 1 L Jar', sku: '30255', category: 'Ghee', quantity: 24, reorderPoint: 12, unitPrice: 720, supplierId: 4 },
  { id: 52, name: 'Cheese Slices 100 g', sku: '73000', category: 'Cheese', quantity: 180, reorderPoint: 60, unitPrice: 115, supplierId: 4 },
  { id: 53, name: 'Cheese Slices 200 g', sku: '73001', category: 'Cheese', quantity: 60, reorderPoint: 30, unitPrice: 215, supplierId: 4 },
  { id: 54, name: 'Cheese Cubes 200 g', sku: '73003', category: 'Cheese', quantity: 144, reorderPoint: 48, unitPrice: 128, supplierId: 4 },
  { id: 55, name: 'Cheese Cubes 120 g', sku: '73004', category: 'Cheese', quantity: 180, reorderPoint: 60, unitPrice: 90, supplierId: 4 },
  { id: 56, name: 'Cheese Block 200 g', sku: '73005', category: 'Cheese', quantity: 96, reorderPoint: 48, unitPrice: 135, supplierId: 4 },
  { id: 57, name: 'Pasteurised Table Butter 100 g', sku: '20133', category: 'Butter', quantity: 320, reorderPoint: 160, unitPrice: 60, supplierId: 4 },
  { id: 58, name: 'Pasteurised Table Butter 500 g', sku: '20134', category: 'Butter', quantity: 120, reorderPoint: 30, unitPrice: 290, supplierId: 4 },
]

export const STORE_ORDERS = [
  { id: 'ORD-2417', date: '2026-09-02', party: 'Walk-in Customer', type: 'Sales', items: 6, quantity: 24, value: 2840, status: 'Delivered' },
  { id: 'PO-1182', date: '2026-09-02', party: 'Heritage Foods Ltd — Fresh Milk Depot', type: 'Purchase', items: 3, quantity: 180, value: 18400, status: 'Shipped' },
  { id: 'ORD-2416', date: '2026-09-01', party: 'Sharma Provisions', type: 'Sales', items: 12, quantity: 96, value: 11250, status: 'Delivered' },
  { id: 'PO-1181', date: '2026-09-01', party: 'Heritage Foods Ltd — Curd & Chilled Depot', type: 'Purchase', items: 8, quantity: 240, value: 26800, status: 'Pending' },
  { id: 'ORD-2415', date: '2026-08-31', party: 'Cafe Aroma', type: 'Sales', items: 4, quantity: 40, value: 7400, status: 'Shipped' },
  { id: 'PO-1180', date: '2026-08-31', party: 'Heritage Foods Ltd — Ghee, Cheese & Butter Depot', type: 'Purchase', items: 15, quantity: 420, value: 38900, status: 'Delivered' },
  { id: 'ORD-2414', date: '2026-08-30', party: 'Walk-in Customer', type: 'Sales', items: 2, quantity: 5, value: 640, status: 'Cancelled' },
  { id: 'ORD-2413', date: '2026-08-30', party: 'Green Grocers', type: 'Sales', items: 9, quantity: 72, value: 9180, status: 'Delivered' },
  { id: 'PO-1179', date: '2026-08-29', party: 'Heritage Foods Ltd — Curd & Chilled Depot', type: 'Purchase', items: 6, quantity: 150, value: 15600, status: 'Delivered' },
  { id: 'ORD-2412', date: '2026-08-29', party: 'Hotel Palm Court', type: 'Sales', items: 11, quantity: 130, value: 21400, status: 'Pending' },
  { id: 'PO-1178', date: '2026-08-28', party: 'Heritage Foods Ltd — Beverage Depot', type: 'Purchase', items: 4, quantity: 96, value: 10560, status: 'Cancelled' },
  { id: 'ORD-2411', date: '2026-08-28', party: 'Sharma Provisions', type: 'Sales', items: 7, quantity: 58, value: 6720, status: 'Delivered' },
  { id: 'ORD-2410', date: '2026-08-27', party: 'Walk-in Customer', type: 'Sales', items: 3, quantity: 9, value: 1180, status: 'Delivered' },
  { id: 'PO-1177', date: '2026-08-27', party: 'Heritage Foods Ltd — Fresh Milk Depot', type: 'Purchase', items: 3, quantity: 200, value: 19800, status: 'Shipped' },
  { id: 'ORD-2409', date: '2026-08-26', party: 'Green Grocers', type: 'Sales', items: 5, quantity: 44, value: 5240, status: 'Delivered' },
  { id: 'ORD-2408', date: '2026-08-26', party: 'Cafe Aroma', type: 'Sales', items: 3, quantity: 28, value: 4980, status: 'Delivered' },
  { id: 'PO-1176', date: '2026-08-25', party: 'Heritage Foods Ltd — Beverage Depot', type: 'Purchase', items: 9, quantity: 310, value: 22400, status: 'Delivered' },
  { id: 'ORD-2407', date: '2026-08-25', party: 'Sharma Provisions', type: 'Sales', items: 8, quantity: 64, value: 8130, status: 'Delivered' },
  { id: 'ORD-2406', date: '2026-08-24', party: 'Hotel Palm Court', type: 'Sales', items: 14, quantity: 152, value: 24600, status: 'Delivered' },
  { id: 'PO-1175', date: '2026-08-24', party: 'Heritage Foods Ltd — Ghee, Cheese & Butter Depot', type: 'Purchase', items: 11, quantity: 380, value: 31200, status: 'Cancelled' },
  { id: 'ORD-2405', date: '2026-08-23', party: 'Walk-in Customer', type: 'Sales', items: 1, quantity: 3, value: 205, status: 'Delivered' },
  { id: 'ORD-2404', date: '2026-08-23', party: 'Green Grocers', type: 'Sales', items: 6, quantity: 51, value: 6890, status: 'Shipped' },
  { id: 'PO-1174', date: '2026-08-22', party: 'Heritage Foods Ltd — Curd & Chilled Depot', type: 'Purchase', items: 5, quantity: 140, value: 13750, status: 'Delivered' },
  { id: 'ORD-2403', date: '2026-08-22', party: 'Cafe Aroma', type: 'Sales', items: 4, quantity: 36, value: 5410, status: 'Delivered' },
  { id: 'ORD-2402', date: '2026-08-21', party: 'Sharma Provisions', type: 'Sales', items: 10, quantity: 88, value: 10420, status: 'Pending' },
  { id: 'PO-1173', date: '2026-08-21', party: 'Heritage Foods Ltd — Beverage Depot', type: 'Purchase', items: 3, quantity: 84, value: 9240, status: 'Delivered' },
  { id: 'ORD-2401', date: '2026-08-20', party: 'Hotel Palm Court', type: 'Sales', items: 12, quantity: 118, value: 19800, status: 'Delivered' },
  { id: 'ORD-2400', date: '2026-08-20', party: 'Walk-in Customer', type: 'Sales', items: 2, quantity: 7, value: 890, status: 'Cancelled' },
  { id: 'PO-1172', date: '2026-08-19', party: 'Heritage Foods Ltd — Fresh Milk Depot', type: 'Purchase', items: 4, quantity: 220, value: 21400, status: 'Delivered' },
  { id: 'ORD-2399', date: '2026-08-19', party: 'Green Grocers', type: 'Sales', items: 7, quantity: 62, value: 7640, status: 'Delivered' },
  { id: 'ORD-2398', date: '2026-08-18', party: 'Cafe Aroma', type: 'Sales', items: 5, quantity: 41, value: 6120, status: 'Shipped' },
  { id: 'PO-1171', date: '2026-08-18', party: 'Heritage Foods Ltd — Curd & Chilled Depot', type: 'Purchase', items: 7, quantity: 195, value: 17900, status: 'Delivered' },
  { id: 'ORD-2397', date: '2026-08-17', party: 'Sharma Provisions', type: 'Sales', items: 9, quantity: 76, value: 9350, status: 'Delivered' },
  { id: 'ORD-2396', date: '2026-08-17', party: 'Walk-in Customer', type: 'Sales', items: 4, quantity: 14, value: 1720, status: 'Delivered' },
]

/* Heritage delivers through depots split by cold chain, which is why the fresh
   milk depot was here yesterday and the ghee depot a fortnight ago. Contacts
   are placeholders — this is demo data about a real company. */
export const SUPPLIERS = [
  { id: 1, name: 'Heritage Foods Ltd — Fresh Milk Depot', contact: 'S. Prasad', phone: '+91 90000 11201', email: 'freshmilk.depot@heritagefoods.example', productsSupplied: 10, lastOrder: '2026-09-02', rating: 4.7 },
  { id: 2, name: 'Heritage Foods Ltd — Curd & Chilled Depot', contact: 'K. Lakshmi', phone: '+91 90000 11202', email: 'chilled.depot@heritagefoods.example', productsSupplied: 15, lastOrder: '2026-09-01', rating: 4.5 },
  { id: 3, name: 'Heritage Foods Ltd — Beverage Depot', contact: 'R. Naveen', phone: '+91 90000 11203', email: 'beverages.depot@heritagefoods.example', productsSupplied: 19, lastOrder: '2026-08-27', rating: 4.2 },
  { id: 4, name: 'Heritage Foods Ltd — Ghee, Cheese & Butter Depot', contact: 'M. Yadagiri', phone: '+91 90000 11204', email: 'ghee.depot@heritagefoods.example', productsSupplied: 14, lastOrder: '2026-08-21', rating: 4.6 },
]

/* 60 days of stock-in / stock-out, generated deterministically so the chart is
   stable across reloads. Replace with GET /api/movement?days=N. */
export const MOVEMENT = (() => {
  const rows = []
  const today = new Date('2026-09-02T00:00:00')
  const rand = (seed) => {
    const s = Math.sin(seed * 127.1) * 43758.5453
    return s - Math.floor(s)
  }
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const weekend = d.getDay() === 0 || d.getDay() === 6
    const base = weekend ? 1.35 : 1
    rows.push({
      date: d.toISOString().slice(0, 10),
      stockIn: Math.round(40 + rand(i + 1) * 150),
      stockOut: Math.round((55 + rand(i + 77) * 120) * base),
    })
  }
  return rows
})()

/* ------------------------------ Formatting ------------------------------ */

export const inr = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export const num = (n) => Number(n).toLocaleString('en-IN')

export const fmtDate = (iso) => {
  if (!iso || iso === '—') return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtTime = (d) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** A moment in time, with the two recent days named rather than dated. */
export const fmtDateTime = (iso) => {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return iso

  const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

  // Compare whole days, not elapsed hours: "yesterday at 23:50" is yesterday
  // even when it was forty minutes ago. Rounding absorbs DST shifts.
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const startOfThatDay = new Date(at).setHours(0, 0, 0, 0)
  const daysAgo = Math.round((startOfToday - startOfThatDay) / 86400000)

  if (daysAgo <= 0) return `Today, ${time}`
  if (daysAgo === 1) return `Yesterday, ${time}`
  return `${fmtDate(iso)}, ${time}`
}

/* ------------------------------- Derived -------------------------------- */

/** Single source of truth for a product's stock status. */
export function statusOf(product) {
  if (product.quantity === 0) return 'Out of Stock'
  if (product.quantity <= product.reorderPoint) return 'Low Stock'
  return 'In Stock'
}

/** Per-category rollup used by the Stock Levels cards. */
export function categoryRollup(products = PRODUCTS) {
  const cats = {}
  for (const p of products) {
    const c = (cats[p.category] ||= { qty: 0, reorder: 0, items: 0, out: 0 })
    c.qty += p.quantity
    c.reorder += p.reorderPoint
    c.items += 1
    if (statusOf(p) === 'Out of Stock') c.out += 1
  }
  return Object.entries(cats)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, c]) => {
      const ratio = c.reorder ? c.qty / c.reorder : 1
      const tone = c.qty === 0 ? 'red' : ratio < 1 ? 'amber' : ratio < 1.5 ? 'blue' : 'green'
      const label =
        c.qty === 0
          ? 'Out of stock'
          : ratio < 1
            ? 'Below reorder'
            : ratio < 1.5
              ? 'Near reorder'
              : 'Healthy'
      return { name, ...c, ratio, tone, label }
    })
}

/* -------------------------------- Reports ------------------------------- */

export const REPORT_TYPES = {
  'Stock Summary': ['Product', 'SKU', 'Category', 'Quantity', 'Unit Price', 'Total Value', 'Status'],
  Sales: ['Order ID', 'Date', 'Customer', 'Items', 'Quantity', 'Value', 'Status'],
  Purchases: ['Order ID', 'Date', 'Supplier', 'Items', 'Quantity', 'Value', 'Status'],
  Wastage: ['Product', 'SKU', 'Category', 'Quantity', 'Reason', 'Estimated Loss'],
}

/* Column indexes holding money, so the preview shows ₹ with separators. The
   CSV keeps raw numbers — a spreadsheet needs to sum them. */
export const MONEY_COLS = {
  'Stock Summary': [4, 5],
  Sales: [5],
  Purchases: [5],
  Wastage: [5],
}

export function buildReport(type, from, to) {
  const within = (d) => (!from || d >= from) && (!to || d <= to)

  if (type === 'Stock Summary') {
    return PRODUCTS.map((p) => [
      p.name, p.sku, p.category, p.quantity, p.unitPrice, p.quantity * p.unitPrice, statusOf(p),
    ])
  }

  if (type === 'Sales' || type === 'Purchases') {
    const want = type === 'Sales' ? 'Sales' : 'Purchase'
    return STORE_ORDERS.filter((o) => o.type === want && within(o.date)).map((o) => [
      o.id, o.date, o.party, o.items, o.quantity, o.value, o.status,
    ])
  }

  // Wastage: expired/damaged stock is not modelled yet, so this derives a
  // plausible view from out-of-stock and low-stock items.
  return PRODUCTS.filter((p) => statusOf(p) !== 'In Stock').map((p) => {
    const lost = p.quantity === 0 ? p.reorderPoint : Math.round(p.reorderPoint - p.quantity)
    return [
      p.name, p.sku, p.category, Math.max(lost, 0),
      p.quantity === 0 ? 'Stockout' : 'Below reorder',
      Math.max(lost, 0) * p.unitPrice,
    ]
  })
}
