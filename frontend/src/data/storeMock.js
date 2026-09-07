/**
 * Formatting helpers, the store's own details, and the one dataset still
 * without an endpoint behind it.
 *
 * The mock product catalogue that used to live here is gone: Products,
 * Inventory, Alerts, Stock Levels and Reports all read the API now, and a
 * hand-maintained copy of the catalogue could only drift out of step with it
 * — which it had, by the time it was removed.
 *
 * `MOVEMENT` is what remains of the mock, feeding the Stock Levels chart, which
 * is labelled as demo data on the page. Replace it with a movement endpoint and
 * this file is formatting helpers alone.
 */

export const STORE = {
  name: 'DairyDesk',
  code: 'STORE-01',
  city: 'Pune, MH',
  lastRestock: '2 Sep 2026, 09:40 AM',
}

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

/**
 * Per-category rollup used by the Stock Levels cards, which feed it live API
 * rows mapped to this shape: `{ category, quantity, reorderPoint }`. The
 * thresholds below mirror Product.stock_status server-side — keep the two in
 * step, or a category reads healthy here and low in the API.
 */
export function categoryRollup(products) {
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
