import { useCallback, useMemo, useState } from 'react'
import { apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import { Card, LoadFailed, PageHeader, Spinner, inputClass } from '../components/ui'
import { qty, useAlerts } from '../data/alerts'
import { fmtTime, inr, num } from '../data/storeMock'

const SEVERITY = {
  Critical: {
    row: 'border-expired/40 bg-expired-soft',
    pill: 'bg-expired-soft text-expired-ink',
    dot: 'bg-expired',
    icon: 'text-expired-ink',
  },
  Warning: {
    row: 'border-ageing/40 bg-ageing-soft',
    pill: 'bg-ageing-soft text-ageing-ink',
    dot: 'bg-ageing',
    icon: 'text-ageing-ink',
  },
  Info: {
    row: 'border-line bg-surface',
    pill: 'bg-info-soft text-info-ink',
    dot: 'bg-brand',
    icon: 'text-info-ink',
  },
}

const GLYPH = { ban: '⊘', warn: '⚠', down: '↓', box: '▣', clock: '◷', check: '✓' }

/* Stock status carries a tint plus a dot, so the meaning never rests on hue
   alone — the same pairing the Products table uses, and the same keys the
   API sends. */
const STOCK_TONE = {
  in_stock: { label: 'In Stock', pill: 'bg-fresh-soft text-fresh-ink', dot: 'bg-fresh' },
  low_stock: { label: 'Low Stock', pill: 'bg-ageing-soft text-ageing-ink', dot: 'bg-ageing' },
  out_of_stock: {
    label: 'Out of Stock',
    pill: 'bg-expired-soft text-expired-ink',
    dot: 'bg-expired',
  },
}

function Stat({ label, children }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{children}</div>
    </Card>
  )
}

function StockPill({ status }) {
  const tone = STOCK_TONE[status] ?? STOCK_TONE.in_stock
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.pill}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      {tone.label}
    </span>
  )
}

function DetailRow({ label, children, className = '' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-sm font-medium text-ink ${className}`}>{children}</dd>
    </div>
  )
}

function ProductCard({ product }) {
  const open = product.open_purchase_order

  return (
    <div className="mt-4 rounded-lg border border-line bg-surface-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-ink">{product.name}</div>
          <div className="mt-0.5 text-xs text-muted">
            {product.sku} · {product.category}
          </div>
        </div>
        <StockPill status={product.stock_status} />
      </div>

      <dl className="mt-3 divide-y divide-line border-t border-line">
        <DetailRow label="In stock" className="tabular-nums">
          {qty(product)}
        </DetailRow>
        <DetailRow label="Reorder point" className="tabular-nums">
          {num(product.reorder_threshold)}
        </DetailRow>
        <DetailRow label="Unit price" className="tabular-nums">
          {inr(product.selling_price)}
        </DetailRow>
        <DetailRow label="Stock value" className="tabular-nums">
          {inr(product.available_quantity * Number(product.selling_price))}
        </DetailRow>
        <DetailRow label="Supplier">
          {product.supplier_name ?? <span className="text-muted">Unassigned</span>}
        </DetailRow>
        <DetailRow label="Auto-reorder">{product.auto_reorder ? 'On' : 'Off'}</DetailRow>
      </dl>

      {open && (
        <p className="mt-3 rounded-md bg-info-soft px-3 py-2 text-xs text-info-ink">
          Purchase order open: {num(open.quantity)} from {open.supplier_name}.
        </p>
      )}
    </div>
  )
}

export default function Alerts() {
  const toast = useToast()
  const [query, setQuery] = useState('')

  const onError = useCallback(
    (err) => toast.error(`Could not load alerts. ${apiErrorMessage(err)}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const { list, alerts, active, highest, checkedAt, failed, loaded, reload } = useAlerts({
    onError,
  })

  // Name is matched as well as SKU, so a half-remembered code still lands on
  // the product; an exact SKU always wins outright.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const exact = list.find((p) => p.sku.toLowerCase() === q)
    if (exact) return [exact]
    return list.filter(
      (p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    )
  }, [list, query])

  const searched = query.trim().length > 0

  return (
    <>
      <PageHeader title="Alerts & settings">
        <p className="w-full text-sm text-muted">
          Warnings raised from live stock levels, with a SKU lookup for any product.
        </p>
      </PageHeader>

      {failed && <LoadFailed what="alerts" onRetry={reload} />}
      {!failed && !loaded && <Spinner />}

      {loaded && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Active alerts">{active}</Stat>
            <Stat label="Highest severity">{highest}</Stat>
            <Stat label="Last check">{fmtTime(checkedAt)}</Stat>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Inventory alerts</h2>
                  <p className="text-sm text-muted">
                    Raised from stock levels, reorder points and order status.
                  </p>
                </div>
                <button
                  onClick={reload}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                >
                  Re-check
                </button>
              </div>

              <ul className="mt-4 space-y-2.5">
                {alerts.map((a, i) => {
                  const s = SEVERITY[a.sev]
                  return (
                    <li
                      key={`${a.title}-${i}`}
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${s.row}`}
                    >
                      <span className={`mt-0.5 text-lg leading-none ${s.icon}`} aria-hidden="true">
                        {GLYPH[a.icon] ?? '•'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink">{a.title}</div>
                        <div className="mt-0.5 text-sm text-muted">{a.desc}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {a.sku && (
                          <button
                            type="button"
                            onClick={() => setQuery(a.sku)}
                            className="rounded-md px-2 py-0.5 text-xs font-medium text-muted underline-offset-4 transition-colors hover:text-brand hover:underline"
                          >
                            Look up
                          </button>
                        )}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.pill}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                          {a.sev}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>

            <Card className="h-fit p-5">
              <h2 className="text-lg font-semibold text-ink">SKU lookup</h2>
              <p className="text-sm text-muted">
                Type a SKU from an alert to see that product&rsquo;s stock.
              </p>

              <div className="mt-4">
                <label
                  htmlFor="sku-search"
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
                >
                  SKU or product name
                </label>
                <input
                  id="sku-search"
                  type="search"
                  autoComplete="off"
                  list="sku-options"
                  className={inputClass}
                  placeholder={list[0] ? `e.g. ${list[0].sku}` : 'e.g. MLK-1001'}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <datalist id="sku-options">
                  {list.map((p) => (
                    <option key={p.id} value={p.sku}>
                      {p.name}
                    </option>
                  ))}
                </datalist>
              </div>

              {!searched && (
                <p className="mt-4 text-xs text-muted">
                  Every SKU in the catalogue is searchable — {num(list.length)} in total.
                </p>
              )}

              {searched && matches.length === 0 && (
                <div className="mt-4 rounded-lg border border-line bg-surface-muted px-4 py-6 text-center">
                  <div className="text-2xl text-empty" aria-hidden="true">
                    ∅
                  </div>
                  <div className="mt-1 text-sm font-medium text-muted">No product matches</div>
                  <div className="mt-0.5 text-xs text-muted">
                    Check the SKU, or search by product name instead.
                  </div>
                </div>
              )}

              {matches.length === 1 && <ProductCard product={matches[0]} />}

              {matches.length > 1 && (
                <>
                  <p className="mt-4 text-xs text-muted">
                    {matches.length} products match — pick one.
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setQuery(p.sku)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:bg-surface-muted"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">
                              {p.name}
                            </span>
                            <span className="block text-xs text-muted">{p.sku}</span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-muted">
                            {qty(p)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
