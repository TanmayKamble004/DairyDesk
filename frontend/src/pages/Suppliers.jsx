import { Card, PageHeader } from '../components/ui'
import { SUPPLIERS, fmtDate } from '../data/storeMock'

// Fixed palette indexed by supplier id, so an avatar keeps its colour.
const AVATAR_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#0891b2', '#e11d48']

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** Rating bands mirror the store build: 4.5+ excellent, 4+ good, 3.5+ average. */
function ratingPill(r) {
  if (r >= 4.5) return { label: 'Excellent', cls: 'bg-fresh-soft text-fresh-ink', dot: 'bg-fresh' }
  if (r >= 4) return { label: 'Good', cls: 'bg-info-soft text-info-ink', dot: 'bg-brand' }
  if (r >= 3.5) return { label: 'Average', cls: 'bg-ageing-soft text-ageing-ink', dot: 'bg-ageing' }
  return { label: 'Poor', cls: 'bg-expired-soft text-expired-ink', dot: 'bg-expired' }
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  )
}

export default function Suppliers() {
  return (
    <>
      <PageHeader title="Suppliers">
        <p className="w-full text-sm text-muted">Vendors supplying stock to this store.</p>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SUPPLIERS.map((s) => {
          const rating = ratingPill(s.rating)
          return (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ backgroundColor: AVATAR_COLORS[(s.id - 1) % AVATAR_COLORS.length] }}
                  aria-hidden="true"
                >
                  {initials(s.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{s.name}</div>
                  <div className="truncate text-sm text-muted">{s.contact}</div>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-line border-t border-line">
                <Row label="Phone">{s.phone}</Row>
                <Row label="Email">
                  <a href={`mailto:${s.email}`} className="text-brand hover:text-brand-hover">
                    {s.email}
                  </a>
                </Row>
                <Row label="Products supplied">{s.productsSupplied}</Row>
                <Row label="Last order">{fmtDate(s.lastOrder)}</Row>
              </dl>

              <div className="mt-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${rating.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${rating.dot}`} aria-hidden="true" />
                  {s.rating.toFixed(1)} · {rating.label}
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
