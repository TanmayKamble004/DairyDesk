import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import { Card, LoadFailed, PageHeader, Spinner } from '../components/ui'
import InventoryShelf from '../components/InventoryShelf'

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
        {failed && (
          <LoadFailed what="the dashboard" onRetry={() => setReloads((n) => n + 1)} />
        )}
        {!failed && !kpis && <Spinner />}
        {kpis && <KpiTiles kpis={kpis} />}
        <InventoryShelf />
      </div>
    </div>
  )
}
