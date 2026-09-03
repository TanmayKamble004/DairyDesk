/**
 * Store-inventory demo data, ported from the standalone dairydesk-inventory
 * build so the Products / Stock Levels / Suppliers / Reports / Alerts pages
 * render the same figures here as they do there.
 *
 * This is deliberately mock data: the Django backend models batches and
 * expiry, not SKUs, reorder points, suppliers or stock movement. Swap each
 * export for a fetch once those endpoints exist.
 */

export const STORE = {
  name: 'DairyDesk',
  code: 'STORE-01',
  city: 'Pune, MH',
  lastRestock: '2 Sep 2026, 09:40 AM',
}

/* reorderPoint drives Low Stock; overstockLimit drives Overstock. */
export const PRODUCTS = [
  { id: 1, name: 'Amul Gold Milk 1L', sku: 'DRY-1001', category: 'Dairy', quantity: 148, reorderPoint: 40, unitPrice: 68, supplierId: 1 },
  { id: 2, name: 'Britannia Brown Bread', sku: 'BAK-2001', category: 'Bakery', quantity: 18, reorderPoint: 25, unitPrice: 45, supplierId: 2 },
  { id: 3, name: 'Tata Salt 1kg', sku: 'GRO-3001', category: 'Grocery', quantity: 0, reorderPoint: 30, unitPrice: 28, supplierId: 3 },
  { id: 4, name: 'Nescafe Classic 50g', sku: 'BEV-4001', category: 'Beverages', quantity: 76, reorderPoint: 20, unitPrice: 185, supplierId: 4 },
  { id: 5, name: 'Lays Classic Salted', sku: 'SNK-5001', category: 'Snacks', quantity: 210, reorderPoint: 60, unitPrice: 20, supplierId: 4 },
  { id: 6, name: 'Surf Excel 1kg', sku: 'HOU-6001', category: 'Household', quantity: 34, reorderPoint: 25, unitPrice: 165, supplierId: 3 },
  { id: 7, name: 'Colgate Strong Teeth', sku: 'PER-7001', category: 'Personal Care', quantity: 12, reorderPoint: 20, unitPrice: 95, supplierId: 5 },
  { id: 8, name: 'Amul Butter 500g', sku: 'DRY-1002', category: 'Dairy', quantity: 42, reorderPoint: 30, unitPrice: 275, supplierId: 1 },
  { id: 9, name: 'Maggi Noodles 12-pack', sku: 'GRO-3002', category: 'Grocery', quantity: 95, reorderPoint: 40, unitPrice: 168, supplierId: 4 },
  { id: 10, name: 'Tropicana Orange 1L', sku: 'BEV-4002', category: 'Beverages', quantity: 8, reorderPoint: 24, unitPrice: 120, supplierId: 6 },
  { id: 11, name: 'Dettol Handwash 200ml', sku: 'PER-7002', category: 'Personal Care', quantity: 64, reorderPoint: 25, unitPrice: 99, supplierId: 5 },
  { id: 12, name: 'Fortune Sunflower Oil 1L', sku: 'GRO-3003', category: 'Grocery', quantity: 52, reorderPoint: 30, unitPrice: 145, supplierId: 3 },
  { id: 13, name: 'Cadbury Dairy Milk 55g', sku: 'SNK-5002', category: 'Snacks', quantity: 0, reorderPoint: 50, unitPrice: 50, supplierId: 4 },
  { id: 14, name: 'Harpic Toilet Cleaner', sku: 'HOU-6002', category: 'Household', quantity: 27, reorderPoint: 20, unitPrice: 89, supplierId: 3 },
  { id: 15, name: 'Nandini Curd 400g', sku: 'DRY-1003', category: 'Dairy', quantity: 22, reorderPoint: 35, unitPrice: 40, supplierId: 1 },
  { id: 16, name: 'Parle-G Biscuits 800g', sku: 'SNK-5003', category: 'Snacks', quantity: 130, reorderPoint: 45, unitPrice: 85, supplierId: 2 },
  { id: 17, name: 'Real Mixed Fruit 1L', sku: 'BEV-4003', category: 'Beverages', quantity: 46, reorderPoint: 24, unitPrice: 110, supplierId: 6 },
  { id: 18, name: 'Vim Dishwash Bar', sku: 'HOU-6003', category: 'Household', quantity: 88, reorderPoint: 30, unitPrice: 25, supplierId: 3 },
  { id: 19, name: 'Kissan Mixed Jam 500g', sku: 'GRO-3004', category: 'Grocery', quantity: 15, reorderPoint: 18, unitPrice: 160, supplierId: 6 },
  { id: 20, name: 'Head & Shoulders 340ml', sku: 'PER-7003', category: 'Personal Care', quantity: 38, reorderPoint: 15, unitPrice: 340, supplierId: 5 },
]

export const STORE_ORDERS = [
  { id: 'ORD-2417', date: '2026-09-02', party: 'Walk-in Customer', type: 'Sales', items: 6, quantity: 24, value: 2840, status: 'Delivered' },
  { id: 'PO-1182', date: '2026-09-02', party: 'Sunrise Dairy Co.', type: 'Purchase', items: 3, quantity: 180, value: 18400, status: 'Shipped' },
  { id: 'ORD-2416', date: '2026-09-01', party: 'Sharma Provisions', type: 'Sales', items: 12, quantity: 96, value: 11250, status: 'Delivered' },
  { id: 'PO-1181', date: '2026-09-01', party: 'Nova Foods Pvt Ltd', type: 'Purchase', items: 8, quantity: 240, value: 26800, status: 'Pending' },
  { id: 'ORD-2415', date: '2026-08-31', party: 'Cafe Aroma', type: 'Sales', items: 4, quantity: 40, value: 7400, status: 'Shipped' },
  { id: 'PO-1180', date: '2026-08-31', party: 'Kirana Wholesale', type: 'Purchase', items: 15, quantity: 420, value: 38900, status: 'Delivered' },
  { id: 'ORD-2414', date: '2026-08-30', party: 'Walk-in Customer', type: 'Sales', items: 2, quantity: 5, value: 640, status: 'Cancelled' },
  { id: 'ORD-2413', date: '2026-08-30', party: 'Green Grocers', type: 'Sales', items: 9, quantity: 72, value: 9180, status: 'Delivered' },
  { id: 'PO-1179', date: '2026-08-29', party: 'FreshCare Supplies', type: 'Purchase', items: 6, quantity: 150, value: 15600, status: 'Delivered' },
  { id: 'ORD-2412', date: '2026-08-29', party: 'Hotel Palm Court', type: 'Sales', items: 11, quantity: 130, value: 21400, status: 'Pending' },
  { id: 'PO-1178', date: '2026-08-28', party: 'Juice Valley Beverages', type: 'Purchase', items: 4, quantity: 96, value: 10560, status: 'Cancelled' },
  { id: 'ORD-2411', date: '2026-08-28', party: 'Sharma Provisions', type: 'Sales', items: 7, quantity: 58, value: 6720, status: 'Delivered' },
  { id: 'ORD-2410', date: '2026-08-27', party: 'Walk-in Customer', type: 'Sales', items: 3, quantity: 9, value: 1180, status: 'Delivered' },
  { id: 'PO-1177', date: '2026-08-27', party: 'Sunrise Dairy Co.', type: 'Purchase', items: 3, quantity: 200, value: 19800, status: 'Shipped' },
  { id: 'ORD-2409', date: '2026-08-26', party: 'Green Grocers', type: 'Sales', items: 5, quantity: 44, value: 5240, status: 'Delivered' },
  { id: 'ORD-2408', date: '2026-08-26', party: 'Cafe Aroma', type: 'Sales', items: 3, quantity: 28, value: 4980, status: 'Delivered' },
  { id: 'PO-1176', date: '2026-08-25', party: 'Metro Snacks & Beverages', type: 'Purchase', items: 9, quantity: 310, value: 22400, status: 'Delivered' },
  { id: 'ORD-2407', date: '2026-08-25', party: 'Sharma Provisions', type: 'Sales', items: 8, quantity: 64, value: 8130, status: 'Delivered' },
  { id: 'ORD-2406', date: '2026-08-24', party: 'Hotel Palm Court', type: 'Sales', items: 14, quantity: 152, value: 24600, status: 'Delivered' },
  { id: 'PO-1175', date: '2026-08-24', party: 'Kirana Wholesale', type: 'Purchase', items: 11, quantity: 380, value: 31200, status: 'Cancelled' },
  { id: 'ORD-2405', date: '2026-08-23', party: 'Walk-in Customer', type: 'Sales', items: 1, quantity: 3, value: 205, status: 'Delivered' },
  { id: 'ORD-2404', date: '2026-08-23', party: 'Green Grocers', type: 'Sales', items: 6, quantity: 51, value: 6890, status: 'Shipped' },
  { id: 'PO-1174', date: '2026-08-22', party: 'FreshCare Supplies', type: 'Purchase', items: 5, quantity: 140, value: 13750, status: 'Delivered' },
  { id: 'ORD-2403', date: '2026-08-22', party: 'Cafe Aroma', type: 'Sales', items: 4, quantity: 36, value: 5410, status: 'Delivered' },
  { id: 'ORD-2402', date: '2026-08-21', party: 'Sharma Provisions', type: 'Sales', items: 10, quantity: 88, value: 10420, status: 'Pending' },
  { id: 'PO-1173', date: '2026-08-21', party: 'Juice Valley Beverages', type: 'Purchase', items: 3, quantity: 84, value: 9240, status: 'Delivered' },
  { id: 'ORD-2401', date: '2026-08-20', party: 'Hotel Palm Court', type: 'Sales', items: 12, quantity: 118, value: 19800, status: 'Delivered' },
  { id: 'ORD-2400', date: '2026-08-20', party: 'Walk-in Customer', type: 'Sales', items: 2, quantity: 7, value: 890, status: 'Cancelled' },
  { id: 'PO-1172', date: '2026-08-19', party: 'Sunrise Dairy Co.', type: 'Purchase', items: 4, quantity: 220, value: 21400, status: 'Delivered' },
  { id: 'ORD-2399', date: '2026-08-19', party: 'Green Grocers', type: 'Sales', items: 7, quantity: 62, value: 7640, status: 'Delivered' },
  { id: 'ORD-2398', date: '2026-08-18', party: 'Cafe Aroma', type: 'Sales', items: 5, quantity: 41, value: 6120, status: 'Shipped' },
  { id: 'PO-1171', date: '2026-08-18', party: 'Nova Foods Pvt Ltd', type: 'Purchase', items: 7, quantity: 195, value: 17900, status: 'Delivered' },
  { id: 'ORD-2397', date: '2026-08-17', party: 'Sharma Provisions', type: 'Sales', items: 9, quantity: 76, value: 9350, status: 'Delivered' },
  { id: 'ORD-2396', date: '2026-08-17', party: 'Walk-in Customer', type: 'Sales', items: 4, quantity: 14, value: 1720, status: 'Delivered' },
]

export const SUPPLIERS = [
  { id: 1, name: 'Sunrise Dairy Co.', contact: 'Meera Kulkarni', phone: '+91 98220 41220', email: 'orders@sunrisedairy.in', productsSupplied: 3, lastOrder: '2026-09-02', rating: 4.8 },
  { id: 2, name: 'Nova Foods Pvt Ltd', contact: 'Rajat Menon', phone: '+91 98111 77304', email: 'supply@novafoods.com', productsSupplied: 2, lastOrder: '2026-09-01', rating: 4.4 },
  { id: 3, name: 'Kirana Wholesale', contact: 'Anil Deshpande', phone: '+91 97654 20981', email: 'anil@kiranawholesale.in', productsSupplied: 6, lastOrder: '2026-08-31', rating: 4.1 },
  { id: 4, name: 'Metro Snacks & Beverages', contact: 'Priya Nair', phone: '+91 99001 55432', email: 'priya@metrosnacks.in', productsSupplied: 4, lastOrder: '2026-08-30', rating: 3.6 },
  { id: 5, name: 'FreshCare Supplies', contact: 'Vikram Shah', phone: '+91 98330 60117', email: 'vikram@freshcare.co.in', productsSupplied: 3, lastOrder: '2026-08-29', rating: 4.6 },
  { id: 6, name: 'Juice Valley Beverages', contact: 'Sana Qureshi', phone: '+91 97020 33845', email: 'sales@juicevalley.in', productsSupplied: 3, lastOrder: '2026-08-28', rating: 3.2 },
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

export const DEFAULT_THRESHOLDS = {
  lowStock: 25,
  reorderPoint: 30,
  overstockLimit: 200,
  criticalStock: 10,
}

export const THRESHOLD_KEY = 'dairydesk_thresholds'

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

/** Alerts derived from live stock levels against the saved thresholds. */
export function buildAlerts(thresholds, products = PRODUCTS, orders = STORE_ORDERS) {
  const t = thresholds
  const list = []

  for (const p of products) {
    if (p.quantity === 0) {
      list.push({
        sev: 'Critical', icon: 'ban',
        title: `Out of stock: ${p.name}`,
        desc: `${p.sku} · reorder point is ${p.reorderPoint} units. Raise a purchase order.`,
      })
    } else if (p.quantity <= t.criticalStock) {
      list.push({
        sev: 'Critical', icon: 'warn',
        title: `Critically low: ${p.name}`,
        desc: `Only ${p.quantity} units left, below the critical level of ${t.criticalStock}.`,
      })
    } else if (p.quantity <= p.reorderPoint) {
      list.push({
        sev: 'Warning', icon: 'down',
        title: `Low stock: ${p.name}`,
        desc: `${p.quantity} units left against a reorder point of ${p.reorderPoint}.`,
      })
    } else if (p.quantity >= t.overstockLimit) {
      list.push({
        sev: 'Info', icon: 'box',
        title: `Overstocked: ${p.name}`,
        desc: `${p.quantity} units held, over the overstock limit of ${t.overstockLimit}.`,
      })
    }
  }

  const pending = orders.filter((o) => o.status === 'Pending')
  if (pending.length) {
    const oldest = pending[pending.length - 1]
    list.push({
      sev: 'Warning', icon: 'clock',
      title: `${pending.length} order${pending.length > 1 ? 's' : ''} pending`,
      desc: `Oldest is ${oldest.id} from ${fmtDate(oldest.date)}.`,
    })
  }

  list.push({
    sev: 'Info', icon: 'check',
    title: 'Store online',
    desc: `${STORE.name} is syncing inventory normally.`,
  })

  const rank = { Critical: 0, Warning: 1, Info: 2 }
  return list.sort((a, b) => rank[a.sev] - rank[b.sev])
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
