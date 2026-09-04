import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import { Card, LoadFailed, PageHeader, Spinner } from '../components/ui'
import InventoryShelf from '../components/InventoryShelf'
import { useAlerts } from '../data/alerts'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

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
    bg: 'bg-ageing-soft',
    border: 'border-ageing/30',
    label: 'text-ageing-ink',
    value: 'text-ageing-ink',
    dot: 'bg-ageing',
    note: 'Needs attention',
  },
  expired: {
    bg: 'bg-expired-soft',
    border: 'border-expired/30',
    label: 'text-expired-ink',
    value: 'text-expired-ink',
    dot: 'bg-expired',
    note: 'Action required',
  },
}

/* The alert card is the way in to the Alerts page, so it carries the same
   severity tints the tiles use — and states the count in words, never in
   colour alone. */
const ALERT_TONES = {
  Critical: {
    card: 'border-expired/40 bg-expired-soft hover:border-expired',
    label: 'text-expired-ink',
    value: 'text-expired-ink',
    dot: 'bg-expired',
    note: 'Action required',
  },
  Warning: {
    card: 'border-ageing/40 bg-ageing-soft hover:border-ageing',
    label: 'text-ageing-ink',
    value: 'text-ageing-ink',
    dot: 'bg-ageing',
    note: 'Needs attention',
  },
  Normal: {
    card: 'border-line bg-surface hover:border-brand',
    label: 'text-muted',
    value: 'text-ink',
    dot: 'bg-fresh',
    note: 'All clear',
  },
}

const ALERT_ICON =
  'M12 2 1 21h22L12 2zm0 4.6L19.5 19h-15L12 6.6zM11 10h2v5h-2v-5zm0 6h2v2h-2v-2z'

/**
 * Alerts has no sidebar entry — this is its entry point, parked beside the
 * KPIs because it answers the same question they do: what needs me today.
 */
function AlertsCard() {
  // No toast on failure: the dashboard has its own error surface, and a card
  // that is only a link should not raise a second complaint about the same API.
  const { active, highest, failed, loaded } = useAlerts()
  const tone = ALERT_TONES[loaded ? highest : 'Normal']

  return (
    <Link
      to="/alerts"
      className={`flex h-full flex-col justify-between rounded-xl border p-4 shadow-sm transition-colors ${tone.card}`}
    >
      <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${tone.label}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
          <path d={ALERT_ICON} />
        </svg>
        Alerts
      </div>

      {loaded && !failed ? (
        <>
          <div className={`mt-2 text-2xl font-semibold ${tone.value}`}>{active}</div>
          <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${tone.value}`}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
            {active === 0 ? tone.note : `${highest} · ${tone.note}`}
          </div>
        </>
      ) : (
        // Counting failed or hasn't finished; the card is still the way in.
        <div className="mt-2 text-sm font-medium text-muted">
          {failed ? 'Count unavailable' : 'Checking…'}
        </div>
      )}

      <div className="mt-3 text-xs font-medium text-brand">
        View all
        <span aria-hidden="true" className="ml-1">
          →
        </span>
      </div>
    </Link>
  )
}

function KpiTiles({ kpis }) {
  const tiles = KPI_TILES.filter((tile) => kpis[tile.key] !== undefined)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ key, label, format, warnIfPositive }) => {
        const raw = kpis[key]
        const tone = warnIfPositive && Number(raw) > 0 ? WARN_TONES[warnIfPositive] : null
        return (
          <Card key={key} className="p-4" bg={tone?.bg} border={tone?.border}>
            <div
              className={`text-xs font-medium uppercase tracking-wide ${
                tone ? tone.label : 'text-muted'
              }`}
            >
              {label}
            </div>
            <div className={`mt-2 text-2xl font-semibold ${tone ? tone.value : 'text-ink'}`}>
              {format ? format(raw) : raw}
            </div>
            {tone && (
              <div className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${tone.value}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                {tone.note}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()
  const [kpis, setKpis] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)

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

  // KPIs and the shelf fetch independently, so one failing never hides the other.
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="space-y-6">
        {/* The alert card sits alongside the KPIs whatever they are doing —
            it is navigation, so a slow or failed KPI fetch must not hide it. */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="min-w-0 flex-1">
            {failed && (
              <LoadFailed what="the dashboard" onRetry={() => setReloads((n) => n + 1)} />
            )}
            {!failed && !kpis && <Spinner />}
            {kpis && <KpiTiles kpis={kpis} />}
          </div>
          <div className="xl:w-52 xl:shrink-0">
            <AlertsCard />
          </div>
        </div>
        <InventoryShelf />
      </div>
    </div>
  )
}
