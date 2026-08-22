import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useInventoryVersion } from '../api/inventoryEvents'
import { useAuth } from '../auth/AuthContext'
import InventoryShelf from '../components/InventoryShelf'
import {
  Badge,
  Card,
  ErrorAlert,
  PageHeader,
  Spinner,
  StatusShape,
  Td,
  Th,
  buttonSecondary,
  inputClass,
} from '../components/ui'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'

const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

const today = () => new Date().toISOString().slice(0, 10)

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
]

// A tile renders only when its key is present in the response, so the
// financial keys the backend withholds from staff simply don't appear.
const KPI_TILES = [
  { key: 'total_available_quantity', label: 'Available stock', unit: 'units' },
  { key: 'total_available_stock_value', label: 'Stock value', format: formatINR },
  { key: 'low_stock_count', label: 'Low stock', tone: 'amber', unit: 'products' },
  { key: 'near_expiry_quantity', label: 'Near expiry', tone: 'amber', unit: 'units' },
  { key: 'expired_quantity', label: 'Expired', tone: 'red', unit: 'units' },
  { key: 'pending_order_count', label: 'Pending orders', tone: 'amber', unit: 'orders' },
  { key: 'period_order_count', label: 'Orders', scoped: true, unit: 'orders' },
  { key: 'period_sales_total', label: 'Sales', scoped: true, format: formatINR },
  { key: 'unpaid_invoice_count', label: 'Unpaid invoices', tone: 'amber', unit: 'invoices' },
  { key: 'disposed_quantity', label: 'Disposed', scoped: true, tone: 'red', unit: 'units' },
  { key: 'disposed_value', label: 'Disposal loss', scoped: true, tone: 'red', format: formatINR },
]

const TONE_TEXT = { amber: 'text-ageing', red: 'text-expired' }

function KpiTiles({ kpis, rangeLabel }) {
  const tiles = KPI_TILES.filter((tile) => kpis[tile.key] !== undefined)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {tiles.map(({ key, label, format, tone, unit, scoped }) => {
        const raw = kpis[key]
        const active = tone && Number(raw) > 0
        return (
          <Card key={key} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
              {scoped && <span className="ml-1 normal-case text-slate-400">· {rangeLabel}</span>}
            </div>
            <div
              className={`mt-2 flex items-center gap-1.5 text-2xl font-semibold ${
                active ? TONE_TEXT[tone] : 'text-slate-800'
              }`}
            >
              {/* Shape repeats the colour's meaning for greyscale / CVD users. */}
              {active && <StatusShape shape={tone === 'red' ? 'square' : 'triangle'} />}
              {format ? format(raw) : raw}
            </div>
            {unit && <div className="mt-0.5 text-xs text-slate-400">{unit}</div>}
          </Card>
        )
      })}
    </div>
  )
}

function RangePicker({ range, custom, onSelect, onCustom, busy }) {
  const [draft, setDraft] = useState(custom)
  const [open, setOpen] = useState(range.key === 'custom')

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Date range" className="flex flex-wrap gap-1">
        {RANGE_OPTIONS.map((option) => {
          const selected = range.key === option.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setOpen(false)
                onSelect(option.key)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-info ${
                selected
                  ? 'bg-info text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={range.key === 'custom'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-info ${
            range.key === 'custom'
              ? 'bg-info text-white shadow-sm'
              : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
          }`}
        >
          Custom
        </button>
      </div>

      {open && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onCustom(draft)
          }}
        >
          <div>
            <label htmlFor="range-start" className="mb-0.5 block text-xs font-medium text-slate-600">
              From
            </label>
            <input
              id="range-start"
              type="date"
              max={draft.end || today()}
              className={`${inputClass} w-40`}
              value={draft.start}
              onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
              required
            />
          </div>
          <div>
            <label htmlFor="range-end" className="mb-0.5 block text-xs font-medium text-slate-600">
              To
            </label>
            <input
              id="range-end"
              type="date"
              min={draft.start}
              className={`${inputClass} w-40`}
              value={draft.end}
              onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
              required
            />
          </div>
          <button type="submit" disabled={busy} className={buttonSecondary}>
            Apply
          </button>
        </form>
      )}
      {busy && <span className="text-sm text-slate-400">Updating…</span>}
    </div>
  )
}

function QuickActions({ isOwner }) {
  const navigate = useNavigate()
  const actions = [
    { label: 'View inventory', to: '/inventory' },
    { label: 'Receive stock', to: '/inventory', state: { openReceiveForm: true } },
    { label: 'Create order', to: '/orders', state: { openOrderForm: true } },
    { label: 'Dispose expired stock', to: '/inventory', state: { focusExpired: true } },
    ...(isOwner ? [{ label: 'View invoices', to: '/invoices' }] : []),
  ]
  return (
    <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => navigate(action.to, { state: action.state })}
          className={`${buttonSecondary} focus:outline-none focus:ring-2 focus:ring-info`}
        >
          {action.label}
        </button>
      ))}
    </nav>
  )
}

function SectionCard({ title, description, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  )
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <Td className="py-8 text-center text-empty" colSpan={colSpan}>
        {children}
      </Td>
    </tr>
  )
}

/** Table row that navigates on click, Enter or Space. */
function LinkRow({ onActivate, label, children }) {
  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onActivate()
        }
      }}
      className="cursor-pointer hover:bg-slate-50 focus:bg-info-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-info"
    >
      {children}
    </tr>
  )
}

function ExpiringSection({ batches, onOpen }) {
  return (
    <SectionCard
      title="Expired & near-expiry stock"
      description="Oldest first. Expired batches can be written off from Inventory."
    >
      <table className="w-full">
        <caption className="sr-only">Batches that are expired or close to expiry</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Product</Th>
            <Th className="text-right">Quantity</Th>
            <Th>Expiry</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {batches.map((batch) => (
            <LinkRow
              key={batch.id}
              label={`Open inventory for ${batch.product_name}`}
              onActivate={() => onOpen(batch.status === 'expired')}
            >
              <Td className="font-medium text-slate-800">{batch.product_name}</Td>
              <Td className="text-right tabular-nums">
                {batch.quantity} {batch.unit}
              </Td>
              <Td>
                {formatDate(batch.expiry_date)}
                <span className="ml-1.5 text-xs text-slate-400">
                  {batch.days_left < 0
                    ? `${Math.abs(batch.days_left)}d ago`
                    : batch.days_left === 0
                      ? 'today'
                      : `in ${batch.days_left}d`}
                </span>
              </Td>
              <Td>
                <Badge value={batch.status} />
              </Td>
            </LinkRow>
          ))}
          {batches.length === 0 && (
            <EmptyRow colSpan={4}>Nothing expiring soon — all stock is fresh.</EmptyRow>
          )}
        </tbody>
      </table>
    </SectionCard>
  )
}

function LowStockSection({ products, onOpen }) {
  return (
    <SectionCard title="Low stock" description="Products at or below the reorder threshold.">
      <table className="w-full">
        <caption className="sr-only">Products running low on sellable stock</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Product</Th>
            <Th>Category</Th>
            <Th className="text-right">Available</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {products.map((product) => (
            <LinkRow
              key={product.id}
              label={`Receive stock for ${product.name}`}
              onActivate={onOpen}
            >
              <Td className="font-medium text-slate-800">{product.name}</Td>
              <Td className="capitalize">{product.category}</Td>
              <Td className="text-right tabular-nums">
                <span
                  className={
                    product.available_quantity === 0
                      ? 'font-semibold text-expired'
                      : 'font-medium text-ageing'
                  }
                >
                  {product.available_quantity} {product.unit}
                </span>
              </Td>
            </LinkRow>
          ))}
          {products.length === 0 && (
            <EmptyRow colSpan={3}>Every product is above the threshold.</EmptyRow>
          )}
        </tbody>
      </table>
    </SectionCard>
  )
}

function RecentOrdersSection({ orders, showTotals, onOpen }) {
  return (
    <SectionCard title="Recent orders" description="Newest first.">
      <table className="w-full">
        <caption className="sr-only">The most recent customer orders</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th className="text-right">Items</Th>
            {showTotals && <Th className="text-right">Total</Th>}
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <LinkRow key={order.id} label={`Open order ${order.id}`} onActivate={onOpen}>
              <Td className="font-medium text-slate-800">#{order.id}</Td>
              <Td>
                {order.customer_name}
                <div className="text-xs text-slate-400">{formatDateTime(order.created_at)}</div>
              </Td>
              <Td className="text-right tabular-nums">{order.item_count}</Td>
              {showTotals && (
                <Td className="text-right tabular-nums">{formatINR(order.total)}</Td>
              )}
              <Td>
                <Badge value={order.status} />
              </Td>
            </LinkRow>
          ))}
          {orders.length === 0 && (
            <EmptyRow colSpan={showTotals ? 5 : 4}>No orders yet.</EmptyRow>
          )}
        </tbody>
      </table>
    </SectionCard>
  )
}

function RecentDisposalsSection({ disposals, showValue, onOpen }) {
  return (
    <SectionCard title="Recent disposals" description="Expired stock written off.">
      <table className="w-full">
        <caption className="sr-only">The most recent stock write-offs</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Product</Th>
            <Th className="text-right">Quantity</Th>
            {showValue && <Th className="text-right">Value</Th>}
            <Th>Reason</Th>
            <Th>By</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {disposals.map((disposal) => (
            <LinkRow
              key={disposal.id}
              label={`Open inventory for ${disposal.product_name}`}
              onActivate={onOpen}
            >
              <Td className="font-medium text-slate-800">
                {disposal.product_name}
                <div className="text-xs text-slate-400">
                  {formatDateTime(disposal.disposed_at)}
                </div>
              </Td>
              <Td className="text-right tabular-nums text-expired">
                −{disposal.quantity} {disposal.unit}
              </Td>
              {showValue && (
                <Td className="text-right tabular-nums">{formatINR(disposal.value)}</Td>
              )}
              <Td className="capitalize">{disposal.reason}</Td>
              <Td>{disposal.disposed_by_username}</Td>
            </LinkRow>
          ))}
          {disposals.length === 0 && (
            <EmptyRow colSpan={showValue ? 5 : 4}>Nothing disposed yet.</EmptyRow>
          )}
        </tbody>
      </table>
    </SectionCard>
  )
}

function CategorySection({ categories, showValue }) {
  const maxQty = Math.max(...categories.map((c) => c.available_quantity), 1)
  return (
    <SectionCard title="Stock by category" description="Sellable stock only.">
      <table className="w-full">
        <caption className="sr-only">Available stock grouped by product category</caption>
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Category</Th>
            <Th className="text-right">Products</Th>
            <Th className="text-right">Available</Th>
            {showValue && <Th className="text-right">Value</Th>}
            <Th className="w-1/3">Share</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {categories.map((row) => (
            <tr key={row.category} className="hover:bg-slate-50">
              <Td className="font-medium capitalize text-slate-800">{row.category}</Td>
              <Td className="text-right tabular-nums">{row.product_count}</Td>
              <Td className="text-right tabular-nums">{row.available_quantity}</Td>
              {showValue && (
                <Td className="text-right tabular-nums">{formatINR(row.stock_value)}</Td>
              )}
              <Td>
                <div
                  className="h-2 w-full rounded-full bg-slate-100"
                  role="img"
                  aria-label={`${row.category}: ${row.available_quantity} units available`}
                >
                  <div
                    className="h-2 rounded-full bg-info"
                    style={{ width: `${(row.available_quantity / maxQty) * 100}%` }}
                  />
                </div>
              </Td>
            </tr>
          ))}
          {categories.length === 0 && (
            <EmptyRow colSpan={showValue ? 5 : 4}>No products yet.</EmptyRow>
          )}
        </tbody>
      </table>
    </SectionCard>
  )
}

function SalesSummary({ summary, rangeLabel }) {
  const stats = [
    { label: 'Orders', value: summary.order_count },
    { label: 'Delivered', value: summary.delivered_count },
    { label: 'Sales', value: formatINR(summary.sales_total) },
    { label: 'Average order', value: formatINR(summary.average_order_value) },
    { label: 'Invoiced', value: formatINR(summary.invoiced_total) },
    { label: 'Collected', value: formatINR(summary.collected_total), tone: 'text-fresh' },
    {
      label: 'Outstanding',
      value: formatINR(summary.outstanding_total),
      tone: Number(summary.outstanding_total) > 0 ? 'text-expired' : undefined,
    },
  ]
  return (
    <SectionCard title="Sales summary" description={rangeLabel}>
      <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 lg:grid-cols-7">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {stat.label}
            </dt>
            <dd className={`mt-1 text-lg font-semibold ${stat.tone ?? 'text-slate-800'}`}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOwner = user?.role === 'owner'
  const inventoryVersion = useInventoryVersion()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [range, setRange] = useState({ key: 'today' })
  const [custom, setCustom] = useState({ start: today(), end: today() })

  const load = useCallback(() => {
    setBusy(true)
    const params =
      range.key === 'custom' ? { start: range.start, end: range.end } : { range: range.key }
    return api
      .get('/dashboard/', { params })
      .then((res) => {
        setData(res.data)
        setError('')
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setBusy(false))
  }, [range])

  useEffect(() => {
    load()
  }, [load, inventoryVersion])

  function applyCustom(draft) {
    setCustom(draft)
    setRange({ key: 'custom', ...draft })
  }

  const goInventory = (focusExpired = false) =>
    navigate('/inventory', { state: focusExpired ? { focusExpired: true } : undefined })
  const goReceive = () => navigate('/inventory', { state: { openReceiveForm: true } })
  const goOrders = () => navigate('/orders')

  return (
    <div>
      <PageHeader title="Dashboard">
        <RangePicker
          range={range}
          custom={custom}
          busy={busy}
          onSelect={(key) => setRange({ key })}
          onCustom={applyCustom}
        />
      </PageHeader>

      <div className="space-y-6">
        <QuickActions isOwner={isOwner} />

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
        {!error && !data && <Spinner label="Loading dashboard…" />}

        {data && (
          <>
            <KpiTiles kpis={data.kpis} rangeLabel={data.range.label} />

            {/* The shelf loads independently, so a KPI failure never hides it. */}
            <InventoryShelf />

            <div className="grid gap-6 lg:grid-cols-2">
              <ExpiringSection batches={data.expiring_batches} onOpen={goInventory} />
              <LowStockSection products={data.low_stock_products} onOpen={goReceive} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <RecentOrdersSection
                orders={data.recent_orders}
                showTotals={isOwner}
                onOpen={goOrders}
              />
              <RecentDisposalsSection
                disposals={data.recent_disposals}
                showValue={isOwner}
                onOpen={() => goInventory(true)}
              />
            </div>

            <CategorySection categories={data.category_breakdown} showValue={isOwner} />

            {data.sales_summary && (
              <SalesSummary summary={data.sales_summary} rangeLabel={data.range.label} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
