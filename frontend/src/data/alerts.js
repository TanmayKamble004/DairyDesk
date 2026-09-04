/**
 * Inventory alerts over live API data.
 *
 * Lives outside the Alerts page because the Dashboard shows the same count as
 * its way in — two places computing "how many things need attention" from the
 * same endpoints would eventually disagree.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { fmtDate, num } from './storeMock'

const UNIT_LABEL = { litre: 'litres', kg: 'kg', piece: 'pieces' }

/* Holding this many restock cycles above the reorder point is more stock than
   the cycle needs — cash tied up, and longer on the shelf before it sells. */
const OVERSTOCK_CYCLES = 3

export const qty = (product) =>
  `${num(product.available_quantity)} ${UNIT_LABEL[product.unit] ?? 'units'}`

/**
 * What a low or empty product needs from a person.
 *
 * An outstanding purchase order is the answer to "what do I do about this",
 * so it belongs in the alert rather than one page away — an owner who has
 * already ordered should not be told to order again.
 */
function actionFor(product) {
  const open = product.open_purchase_order
  if (open) {
    return `Reorder already placed: ${num(open.quantity)} from ${open.supplier_name}.`
  }
  if (product.auto_reorder) {
    return 'Auto-reorder is on but no order is open — check the supplier is set.'
  }
  return 'Raise a purchase order.'
}

/**
 * Alerts derived from live stock levels.
 *
 * Rules are ordered worst-first and each product raises at most one, so the
 * list stays as long as the number of things needing attention — not the
 * number of products.
 */
export function buildAlerts(products, orders) {
  const list = []

  for (const p of products) {
    // Half the product's own reorder point, rather than one global number of
    // units: stock that is "nearly gone" for butter is a full shelf of milk.
    const critical = Math.ceil(p.reorder_threshold / 2)

    if (p.stock_status === 'out_of_stock') {
      list.push({
        sev: 'Critical', icon: 'ban', sku: p.sku,
        title: `Out of stock: ${p.name}`,
        desc: `${p.sku} · reorder point is ${num(p.reorder_threshold)}. ${actionFor(p)}`,
      })
    } else if (p.stock_status === 'low_stock' && p.available_quantity <= critical) {
      list.push({
        sev: 'Critical', icon: 'warn', sku: p.sku,
        title: `Critically low: ${p.name}`,
        desc: `Only ${qty(p)} left, under half the reorder point of ${num(p.reorder_threshold)}. ${actionFor(p)}`,
      })
    } else if (p.stock_status === 'low_stock') {
      list.push({
        sev: 'Warning', icon: 'down', sku: p.sku,
        title: `Low stock: ${p.name}`,
        desc: `${qty(p)} left against a reorder point of ${num(p.reorder_threshold)}. ${actionFor(p)}`,
      })
    } else if (
      p.reorder_quantity > 0 &&
      p.available_quantity >= p.reorder_threshold + OVERSTOCK_CYCLES * p.reorder_quantity
    ) {
      list.push({
        sev: 'Info', icon: 'box', sku: p.sku,
        title: `Overstocked: ${p.name}`,
        desc: `${qty(p)} held — over ${OVERSTOCK_CYCLES} restock cycles above the reorder point.`,
      })
    }
  }

  // Orders arrive newest first, so the oldest pending one is the last of them.
  const pending = orders.filter((o) => o.status === 'pending')
  if (pending.length) {
    const oldest = pending[pending.length - 1]
    list.push({
      sev: 'Warning', icon: 'clock',
      title: `${pending.length} order${pending.length > 1 ? 's' : ''} pending`,
      desc: `Oldest is order #${oldest.id} for ${oldest.customer_name}, placed ${fmtDate(oldest.created_at)}.`,
    })
  }

  // A heartbeat, so an empty list never reads as "the page is broken".
  list.push({
    sev: 'Info', icon: 'check',
    title: 'Store online',
    desc: `${num(products.length)} products syncing normally.`,
  })

  const rank = { Critical: 0, Warning: 1, Info: 2 }
  return list.sort((a, b) => rank[a.sev] - rank[b.sev])
}

/**
 * Fetches what the alert rules need and derives the list.
 *
 * `onError` rather than a toast in here: the Alerts page owes the user an
 * explanation when this fails, while the Dashboard card just steps aside.
 */
export function useAlerts({ onError } = {}) {
  const [products, setProducts] = useState(null)
  const [orders, setOrders] = useState([])
  const [failed, setFailed] = useState(false)
  const [checkedAt, setCheckedAt] = useState(() => new Date())

  // Held in a ref so a caller passing an inline callback doesn't re-run the
  // fetch on every render.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const reload = useCallback(() => {
    return Promise.all([api.get('/products/'), api.get('/orders/')])
      .then(([prods, ords]) => {
        setProducts(prods.data)
        setOrders(ords.data)
        setCheckedAt(new Date())
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        onErrorRef.current?.(err)
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Stable identity while loading, so the memos below don't rerun each render.
  const list = useMemo(() => products ?? [], [products])
  const alerts = useMemo(() => buildAlerts(list, orders), [list, orders])

  const active = alerts.filter((a) => a.sev !== 'Info').length
  const highest = alerts.find((a) => a.sev === 'Critical')
    ? 'Critical'
    : alerts.find((a) => a.sev === 'Warning')
      ? 'Warning'
      : 'Normal'

  return {
    products,
    list,
    alerts,
    active,
    highest,
    checkedAt,
    failed,
    loaded: products !== null,
    reload,
  }
}
