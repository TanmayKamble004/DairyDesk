import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { Card, ErrorAlert, PageHeader, Spinner } from '../components/ui'

const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

// Tile definitions in display order; a tile renders only if its key is in the
// API response (financial KPIs are absent for staff).
const KPI_TILES = [
  { key: 'total_available_stock_value', label: 'Stock value (available)', format: formatINR },
  { key: 'todays_sales_total', label: "Today's sales", format: formatINR },
  { key: 'todays_order_count', label: "Today's orders" },
  { key: 'products_ageing_count', label: 'Products ageing', warnIfPositive: 'amber' },
  { key: 'products_expired_count', label: 'Products expired', warnIfPositive: 'red' },
  { key: 'unpaid_invoice_count', label: 'Unpaid invoices', warnIfPositive: 'amber' },
]

const WARN_TEXT = { amber: 'text-amber-600', red: 'text-red-600' }

function KpiTiles({ kpis }) {
  const tiles = KPI_TILES.filter((tile) => kpis[tile.key] !== undefined)
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map(({ key, label, format, warnIfPositive }) => {
        const raw = kpis[key]
        const valueClass =
          warnIfPositive && Number(raw) > 0 ? WARN_TEXT[warnIfPositive] : 'text-slate-800'
        return (
          <Card key={key} className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </div>
            <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>
              {format ? format(raw) : raw}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// Phase 4 will replace this with the react-three-fiber <Canvas> shelf.
function ShelfPlaceholder() {
  return (
    <Card className="flex h-80 items-center justify-center border-2 border-dashed border-slate-300 bg-slate-100/50 shadow-none">
      <div className="text-center">
        <div className="text-4xl">📦</div>
        <div className="mt-2 font-medium text-slate-500">3D inventory shelf — Phase 4</div>
        <div className="mt-1 text-sm text-slate-400">
          The interactive react-three-fiber shelf will render here.
        </div>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const [kpis, setKpis] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/dashboard/')
      .then((res) => setKpis(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  return (
    <div>
      <PageHeader title="Dashboard" />
      {error && <ErrorAlert message={error} />}
      {!error && !kpis && <Spinner />}
      {kpis && (
        <div className="space-y-6">
          <KpiTiles kpis={kpis} />
          <ShelfPlaceholder />
        </div>
      )}
    </div>
  )
}
