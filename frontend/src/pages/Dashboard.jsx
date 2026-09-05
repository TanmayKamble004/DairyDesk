import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import {
  Badge,
  Card,
  EmptyRow,
  IconChip,
  LoadFailed,
  PageHeader,
  Panel,
  Spinner,
  Td,
  Th,
} from '../components/ui'
import { BarChart, DonutChart, foldSeries } from '../components/charts'
import InventoryShelf from '../components/InventoryShelf'
import { useAlerts } from '../data/alerts'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

/** Axis and bar labels need to fit; ₹1,17,830 does not. */
const compactINR = (value) => {
  const n = Number(value)
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `₹${Math.round(n)}`
}

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

/* --------------------------------------------------------------- icons --- */

const TILE_ICONS = {
  total_available_stock_value: (
    <>
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M2.5 10.5h19M6.5 15h3" />
    </>
  ),
  todays_sales_total: <path d="M3 17.5 9 11l4 4 8-8.5M21 6.5h-5M21 6.5v5" />,
  todays_order_count: (
    <>
      <path d="M2.5 3h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L19.5 7H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="16.5" cy="19.5" r="1.4" />
    </>
  ),
  products_ageing_count: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  products_expired_count: (
    <>
      <path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" />
      <path d="M12 10v4M12 16.8v.2" />
    </>
  ),
  unpaid_invoice_count: (
    <>
      <path d="M6 2.5h12v19l-2.5-1.8-2.4 1.8L12 20l-2.4 1.5L7 20 6 21.5v-19Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  alerts: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </>
  ),
}

function TileIcon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TILE_ICONS[name]}
    </svg>
  )
}

/* ---------------------------------------------------------------- KPIs --- */

// Tile definitions in display order; a tile renders only if its key is in the
// API response (financial KPIs are absent for staff).
const KPI_TILES = [
  { key: 'total_available_stock_value', label: 'Stock value (available)', format: formatINR },
  { key: 'todays_sales_total', label: "Today's sales", format: formatINR },
  { key: 'todays_order_count', label: "Today's orders" },
  { key: 'products_ageing_count', label: 'Products ageing', warnIfPositive: 'ageing' },
  { key: 'products_expired_count', label: 'Products expired', warnIfPositive: 'expired' },
  { key: 'unpaid_invoice_count', label: 'Unpaid invoices', warnIfPositive: 'ageing' },
]

// A tile that needs attention switches to its light status surface and gains a
// worded note, so the alert never reads as colour alone.
const WARN_TONES = {
  ageing: {
    bg: 'bg-ageing-soft/40',
    border: 'border-ageing/25',
    label: 'text-ageing-ink',
    value: 'text-ageing-ink',
    dot: 'bg-ageing',
    chip: 'ageing',
    note: 'Needs attention',
  },
  expired: {
    bg: 'bg-coral-soft/40',
    border: 'border-coral/40',
    label: 'text-coral-ink',
    value: 'text-coral-ink',
    dot: 'bg-expired',
    chip: 'coral',
    note: 'Action required',
  },
}

/* The alert card is the way in to the Alerts page, so it carries the same
   severity tints the tiles use — and states the count in words, never in
   colour alone. */
const ALERT_TONES = {
  Critical: {
    card: 'border-coral/40 bg-coral-soft/40 hover:border-coral',
    label: 'text-coral-ink',
    value: 'text-coral-ink',
    dot: 'bg-expired',
    chip: 'coral',
    note: 'Action required',
  },
  Warning: {
    card: 'border-ageing/25 bg-ageing-soft/40 hover:border-ageing',
    label: 'text-ageing-ink',
    value: 'text-ageing-ink',
    dot: 'bg-ageing',
    chip: 'ageing',
    note: 'Needs attention',
  },
  Normal: {
    card: 'border-glass-line bg-glass hover:border-brand/40',
    label: 'text-muted',
    value: 'text-ink',
    dot: 'bg-fresh',
    chip: 'brand',
    note: 'All clear',
  },
}

const tileLabelClass = 'text-[11px] font-semibold uppercase tracking-wider'

/**
 * Alerts has no sidebar entry — this is its entry point, sitting in the KPI
 * grid because it answers the same question the tiles do: what needs me today.
 */
function AlertsCard({ className = '' }) {
  // No toast on failure: the dashboard has its own error surface, and a card
  // that is only a link should not raise a second complaint about the same API.
  const { active, highest, failed, loaded } = useAlerts()
  const tone = ALERT_TONES[loaded ? highest : 'Normal']

  return (
    <Link
      to="/alerts"
      className={`flex flex-col rounded-2xl border p-5 glass-chrome transition-colors ${tone.card} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`${tileLabelClass} ${tone.label}`}>Alerts</span>
        <IconChip tone={tone.chip}>
          <TileIcon name="alerts" />
        </IconChip>
      </div>

      {loaded && !failed ? (
        <>
          <div className={`mt-3 text-[30px] font-bold leading-none ${tone.value}`}>{active}</div>
          <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${tone.value}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
            {active === 0 ? tone.note : `${highest} · ${tone.note}`}
          </div>
        </>
      ) : (
        // Counting failed or hasn't finished; the card is still the way in.
        <div className="mt-3 text-sm font-medium text-muted">
          {failed ? 'Count unavailable' : 'Checking…'}
        </div>
      )}
    </Link>
  )
}

function KpiTiles({ kpis }) {
  const tiles = KPI_TILES.filter((tile) => kpis[tile.key] !== undefined)
  return (
    <>
      {tiles.map(({ key, label, format, warnIfPositive }) => {
        const raw = kpis[key]
        const tone = warnIfPositive && Number(raw) > 0 ? WARN_TONES[warnIfPositive] : null
        return (
          <Card key={key} glass className="flex flex-col p-5" bg={tone?.bg} border={tone?.border}>
            <div className="flex items-start justify-between gap-3">
              <span className={`${tileLabelClass} ${tone ? tone.label : 'text-muted'}`}>
                {label}
              </span>
              <IconChip tone={tone ? tone.chip : 'brand'}>
                <TileIcon name={key} />
              </IconChip>
            </div>
            <div
              className={`mt-3 text-[30px] font-bold leading-none tabular-nums ${
                tone ? tone.value : 'text-ink'
              }`}
            >
              {format ? format(raw) : raw}
            </div>
            {tone && (
              <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-medium ${tone.value}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                {tone.note}
              </div>
            )}
          </Card>
        )
      })}
    </>
  )
}

/* -------------------------------------------------- derived chart series --- */

/** Available stock per product category, largest first, tail folded to Other. */
function stockByCategory(inventory) {
  const totals = new Map()
  for (const row of inventory) {
    const key = row.category || 'uncategorised'
    totals.set(key, (totals.get(key) ?? 0) + row.available_quantity)
  }
  return foldSeries([...totals].map(([label, value]) => ({ label, value })))
}

/**
 * The last seven days from the orders the page already fetched. `money` follows
 * the same rule the API uses for the dashboard KPIs: staff see counts, owners
 * see rupees, so this chart never reveals a figure the KPI row withholds.
 */
function lastSevenDays(orders, money) {
  const days = []
  const index = new Map()
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    const bucket = {
      key: d.toDateString(),
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      value: 0,
    }
    days.push(bucket)
    index.set(bucket.key, bucket)
  }
  for (const order of orders) {
    const d = new Date(order.created_at)
    d.setHours(0, 0, 0, 0)
    const bucket = index.get(d.toDateString())
    if (bucket) bucket.value += money ? Number(order.total) : 1
  }
  return days
}

/** Products carrying expired or ageing batches, most urgent first. */
function expiringSoon(inventory) {
  const rank = { expired: 0, ageing: 1 }
  return inventory
    .filter((row) => row.worst_status === 'expired' || row.worst_status === 'ageing')
    .sort((a, b) => {
      const byStatus = rank[a.worst_status] - rank[b.worst_status]
      if (byStatus !== 0) return byStatus
      return (a.nearest_expiry ?? '9999').localeCompare(b.nearest_expiry ?? '9999')
    })
    .slice(0, 6)
}

const recentOrders = (orders) =>
  [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6)

/* ----------------------------------------------------------------- page --- */

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)

  const [inventory, setInventory] = useState(null)
  const [orders, setOrders] = useState(null)
  const [panelsFailed, setPanelsFailed] = useState(false)
  const [panelReloads, setPanelReloads] = useState(0)

  useEffect(() => {
    api
      .get('/dashboard/')
      .then((res) => {
        setKpis(res.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load the dashboard. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  // The charts and tables read the same two endpoints the Inventory and Orders
  // pages already use — no new endpoint, and nothing here is derived from
  // anything but the API response.
  useEffect(() => {
    Promise.all([api.get('/inventory/'), api.get('/orders/')])
      .then(([inv, ord]) => {
        setInventory(inv.data)
        setOrders(ord.data)
        setPanelsFailed(false)
      })
      .catch((err) => {
        setPanelsFailed(true)
        toast.error(`Could not load dashboard panels. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelReloads])

  const retryPanels = useCallback(() => setPanelReloads((n) => n + 1), [])

  // Owners get the financial KPIs, and only then does the sales chart show money.
  const showsMoney = kpis?.todays_sales_total !== undefined
  const categories = useMemo(() => (inventory ? stockByCategory(inventory) : []), [inventory])
  const salesSeries = useMemo(
    () => (orders ? lastSevenDays(orders, showsMoney) : []),
    [orders, showsMoney],
  )
  const expiring = useMemo(() => (inventory ? expiringSoon(inventory) : []), [inventory])

  // Seven cards in a four-column grid would leave a hole at the end of row two.
  // Widening the last card closes it, so the grid reads as deliberate rather
  // than short — and at four cards (a staff view) it stays a plain tile.
  const visibleTiles = kpis ? KPI_TILES.filter((t) => kpis[t.key] !== undefined).length : 0
  const alertsSpansTwo = (visibleTiles + 1) % 4 === 3
  const latest = useMemo(() => (orders ? recentOrders(orders) : []), [orders])

  const panelsLoading = !panelsFailed && (!inventory || !orders)

  return (
    <div>
      <PageHeader title="Dairy Desk Dashboard" />

      <div className="space-y-5 xl:space-y-6">
        {/* KPIs and the alert card share one grid; a slow or failed KPI fetch
            must not hide the alert card, which is navigation. */}
        {failed && <LoadFailed what="the dashboard" onRetry={() => setReloads((n) => n + 1)} />}
        {!failed && !kpis && <Spinner />}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {kpis && <KpiTiles kpis={kpis} />}
          <AlertsCard className={alertsSpansTwo ? 'xl:col-span-2' : ''} />
        </div>

        {/* Shelf, category split and sales trend. The shelf fetches its own data
            and is left exactly as it is — only the row around it is laid out. */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 xl:gap-6">
          {/* The shelf renders its own card with an opaque gradient inside the
              protected component, so the glass goes around it as a mat rather
              than through it. Nothing here reaches the 3D scene. */}
          <Card glass className="p-2 xl:col-span-6">
            <InventoryShelf />
          </Card>

          <Panel
            glass
            title="Stock by Category"
            subtitle="Available units on hand"
            className="h-[400px] xl:col-span-3"
            bodyClass="flex items-center justify-center px-5 pb-5"
          >
            {panelsFailed ? (
              <p className="text-sm text-muted">Unavailable.</p>
            ) : !inventory ? (
              <Spinner label="" />
            ) : (
              <DonutChart
                data={categories}
                centerLabel="units"
                formatValue={(v) => v.toLocaleString('en-IN')}
              />
            )}
          </Panel>

          <Panel
            glass
            title="Sales Summary"
            subtitle={showsMoney ? 'Revenue, last 7 days' : 'Orders placed, last 7 days'}
            className="h-[400px] xl:col-span-3"
            bodyClass="flex flex-col justify-between px-5 pb-5"
          >
            {panelsFailed ? (
              <p className="text-sm text-muted">Unavailable.</p>
            ) : !orders ? (
              <Spinner label="" />
            ) : (
              <>
                <div>
                  <div className="text-2xl font-bold leading-none text-ink">
                    {showsMoney
                      ? formatINR(kpis?.todays_sales_total ?? 0)
                      : (kpis?.todays_order_count ?? 0)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {showsMoney ? "Today's sales" : "Today's orders"}
                  </div>
                </div>
                <BarChart
                  data={salesSeries}
                  valueLabel={showsMoney ? 'Revenue' : 'Orders'}
                  formatValue={showsMoney ? compactINR : (v) => String(Math.round(v))}
                />
              </>
            )}
          </Panel>
        </div>

        {/* Live rows from the same two endpoints — nothing here is hardcoded. */}
        {panelsFailed ? (
          <LoadFailed what="the dashboard panels" onRetry={retryPanels} />
        ) : panelsLoading ? (
          <Card glass className="p-5">
            <Spinner />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
            <Panel
              glass
              title="Expired & Near-expiry stock"
              subtitle="Worst batch status per product"
              action={
                <Link to="/inventory" className="text-xs font-semibold text-brand hover:text-brand-hover">
                  View all →
                </Link>
              }
              bodyClass="overflow-x-auto pb-1"
            >
              <table className="w-full">
                <thead>
                  <tr className="border-y border-glass-line bg-glass-veil">
                    <Th>Product</Th>
                    <Th className="text-right">Quantity</Th>
                    <Th>Expiry</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {expiring.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-white/30">
                      <Td className="font-medium text-ink">{row.name}</Td>
                      <Td className="text-right tabular-nums">
                        {row.available_quantity} {row.unit}
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(row.nearest_expiry)}</Td>
                      <Td>
                        <Badge value={row.worst_status} />
                      </Td>
                    </tr>
                  ))}
                  {expiring.length === 0 && (
                    <EmptyRow
                      colSpan={4}
                      title="Nothing ageing or expired"
                      detail="Every batch on the shelf is still fresh."
                    />
                  )}
                </tbody>
              </table>
            </Panel>

            <Panel
              glass
              title="Recent Orders"
              subtitle="Latest activity across the store"
              action={
                <Link to="/orders" className="text-xs font-semibold text-brand hover:text-brand-hover">
                  View all →
                </Link>
              }
              bodyClass="overflow-x-auto pb-1"
            >
              <table className="w-full">
                <thead>
                  <tr className="border-y border-glass-line bg-glass-veil">
                    <Th>Order</Th>
                    <Th>Customer</Th>
                    <Th className="text-right">Items</Th>
                    <Th className="text-right">Total</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {latest.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-white/30">
                      <Td className="font-semibold text-brand">#{order.id}</Td>
                      <Td className="max-w-[12rem] truncate">{order.customer_name}</Td>
                      <Td className="text-right tabular-nums">{order.items.length}</Td>
                      <Td className="text-right tabular-nums">{formatINR(order.total)}</Td>
                      <Td>
                        <Badge value={order.status} />
                      </Td>
                    </tr>
                  ))}
                  {latest.length === 0 && (
                    <EmptyRow
                      colSpan={5}
                      title="No orders yet"
                      detail="New orders appear here as they are placed."
                    />
                  )}
                </tbody>
              </table>
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}
