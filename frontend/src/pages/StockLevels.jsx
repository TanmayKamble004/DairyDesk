import { useMemo, useState } from 'react'
import { Card, PageHeader } from '../components/ui'
import { MOVEMENT, categoryRollup, num } from '../data/storeMock'

const TONE = {
  green: { bar: 'bg-accent-green', pill: 'bg-fresh-soft text-fresh-ink', dot: 'bg-fresh' },
  blue: { bar: 'bg-accent-blue', pill: 'bg-info-soft text-info-ink', dot: 'bg-brand' },
  amber: { bar: 'bg-accent-amber', pill: 'bg-ageing-soft text-ageing-ink', dot: 'bg-ageing' },
  red: { bar: 'bg-accent-red', pill: 'bg-expired-soft text-expired-ink', dot: 'bg-expired' },
}

const RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All', days: 60 },
]

/* Chart geometry, in viewBox units — constant, so it stays out of the render. */
const W = 1000
const H = 260
const PAD = { top: 12, right: 8, bottom: 8, left: 34 }

/**
 * Smooth area chart. Drawn as inline SVG rather than pulling in a chart
 * library: two series, no interaction, so a path is cheaper than a canvas.
 */
function MovementChart({ rows }) {
  const { inPath, outPath, inArea, outArea, ticks, max } = useMemo(() => {
    const peak = Math.max(...rows.flatMap((r) => [r.stockIn, r.stockOut]), 1)
    const max = Math.ceil(peak / 50) * 50
    const x = (i) =>
      PAD.left + (i / Math.max(rows.length - 1, 1)) * (W - PAD.left - PAD.right)
    const y = (v) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)

    // Catmull-Rom → cubic bezier, which is what gives the organic curve.
    const spline = (vals) => {
      const pts = vals.map((v, i) => [x(i), y(v)])
      if (pts.length < 2) return ''
      let d = `M ${pts[0][0]} ${pts[0][1]}`
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[i + 2] ?? p2
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${
          p2[0] - (p3[0] - p1[0]) / 6
        } ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`
      }
      return d
    }

    const close = (d) =>
      `${d} L ${x(rows.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`

    const inD = spline(rows.map((r) => r.stockIn))
    const outD = spline(rows.map((r) => r.stockOut))
    const step = max / 5
    return {
      inPath: inD,
      outPath: outD,
      inArea: close(inD),
      outArea: close(outD),
      max,
      ticks: Array.from({ length: 6 }, (_, i) => ({ v: i * step, y: y(i * step) })),
    }
  }, [rows])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-64 w-full"
      role="img"
      aria-label={`Stock movement over ${rows.length} days, peaking at ${max} units`}
    >
      <defs>
        <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#16a34a" stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.20" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t.v}>
          <line
            x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y}
            stroke="currentColor" className="text-line" strokeWidth="1"
          />
          <text
            x={PAD.left - 8} y={t.y + 4} textAnchor="end"
            className="fill-current text-muted" fontSize="12"
          >
            {t.v}
          </text>
        </g>
      ))}

      <path d={outArea} fill="url(#outFill)" />
      <path d={inArea} fill="url(#inFill)" />
      <path d={outPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
      <path d={inPath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export default function StockLevels() {
  const [days, setDays] = useState(60)
  const cards = useMemo(() => categoryRollup(), [])
  const rows = useMemo(() => MOVEMENT.slice(-days), [days])

  return (
    <>
      <PageHeader title="Stock Levels">
        <p className="w-full text-sm text-muted">
          Quantity against reorder threshold, by category.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const tone = TONE[c.tone]
          const pct = Math.min(Math.round((c.ratio / 2) * 100), 100)
          return (
            <Card key={c.name} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium text-muted">{c.name}</div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone.pill}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
                  {c.label}
                </span>
              </div>
              <div className="mt-2 text-3xl font-semibold text-ink">
                {num(c.qty)}
                <span className="ml-1 text-sm font-medium text-muted">units</span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-neutral-soft">
                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>Reorder at {num(c.reorder)}</span>
                <span>
                  {c.items} SKUs{c.out > 0 && ` · ${c.out} out`}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Stock movement trend</h2>
            <p className="text-sm text-muted">Units received against units dispatched.</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  days === r.days ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-2 flex justify-end gap-4 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-green" aria-hidden="true" />
            Stock in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-amber" aria-hidden="true" />
            Stock out
          </span>
        </div>

        <MovementChart rows={rows} />
      </Card>
    </>
  )
}
