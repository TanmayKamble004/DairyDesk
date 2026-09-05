/**
 * Chart primitives for the Dashboard, drawn as inline SVG. No chart library is
 * pulled in: both forms are small, and the app already draws its movement chart
 * this way in Stock Levels.
 *
 * Colour rules these follow:
 *  - The donut is part-to-whole across product categories, so identity is the
 *    job and the palette is categorical: fixed slot order, never cycled, with a
 *    seventh category folded into "Other".
 *  - The bar chart is a single measure over time, so it is one hue, not a
 *    rainbow, and it carries no legend — the title names the series.
 *  - Identity never rests on colour alone: every segment is named in the legend
 *    with its value, and large segments are labelled in place.
 */
import { useId, useState } from 'react'

/* Slot order matches --color-series-* in index.css. That order was checked for
   lightness band, chroma floor, adjacent CVD separation and normal-vision
   separation against a white surface — do not reorder or extend it. */
export const SERIES = ['#1677d2', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']
const OTHER = '#98a2b3'

export const seriesColor = (i) => SERIES[i] ?? OTHER

/** Fold a long tail into "Other" so the palette is never cycled. */
export function foldSeries(entries, max = SERIES.length) {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  if (sorted.length <= max) return sorted
  const head = sorted.slice(0, max - 1)
  const tail = sorted.slice(max - 1)
  return [...head, { label: 'Other', value: tail.reduce((s, e) => s + e.value, 0), isOther: true }]
}

/* ---------------------------------------------------------------- donut --- */

const R = 62 // ring radius, in viewBox units
const STROKE = 26
const C = 2 * Math.PI * R
const GAP = 2 // surface gap between adjacent segments, in the same units

/**
 * Part-to-whole ring. `data` is `[{ label, value }]`; anything with a zero or
 * negative value is dropped, because a slice you cannot see is noise.
 */
export function DonutChart({ data, total, centerLabel, formatValue = (v) => v }) {
  const [hover, setHover] = useState(null)
  const slices = data.filter((d) => d.value > 0)
  const sum = total ?? slices.reduce((s, d) => s + d.value, 0)

  if (!sum) {
    return (
      <p className="py-10 text-center text-sm text-muted">
        No stock on hand to break down yet.
      </p>
    )
  }

  let offset = 0
  const arcs = slices.map((d, i) => {
    const len = (d.value / sum) * C
    // A single full-circle slice must not be nicked by a gap it doesn't need.
    const drawn = slices.length === 1 ? len : Math.max(len - GAP, 0.75)
    const mid = offset + len / 2
    const angle = (mid / C) * 2 * Math.PI - Math.PI / 2
    const arc = {
      ...d,
      color: d.isOther ? OTHER : seriesColor(i),
      dash: `${drawn} ${C - drawn}`,
      dashOffset: -offset,
      share: d.value / sum,
      lx: 100 + Math.cos(angle) * R,
      ly: 100 + Math.sin(angle) * R,
    }
    offset += len
    return arc
  })

  return (
    <div className="relative">
      <svg viewBox="0 0 200 200" className="mx-auto h-52 w-52" role="img"
        aria-label={`Stock by category: ${slices.map((d) => `${d.label} ${formatValue(d.value)}`).join(', ')}`}
      >
        <g transform="rotate(-90 100 100)">
          {arcs.map((a) => (
            <circle
              key={a.label}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={hover === a.label ? STROKE + 4 : STROKE}
              strokeDasharray={a.dash}
              strokeDashoffset={a.dashOffset}
              className="cursor-pointer transition-[stroke-width] duration-150"
              onMouseEnter={() => setHover(a.label)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>
        {/* Values sit on the segments that can hold them. The halo is what keeps
            white legible on the lighter slots; the legend carries the rest. */}
        {arcs
          .filter((a) => a.share >= 0.08)
          .map((a) => (
            <text
              key={a.label}
              x={a.lx}
              y={a.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fontWeight="700"
              fill="#ffffff"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth="3"
              paintOrder="stroke"
              className="pointer-events-none"
            >
              {formatValue(a.value)}
            </text>
          ))}
        <text x="100" y="94" textAnchor="middle" fontSize="22" fontWeight="700" fill="#172033">
          {formatValue(sum)}
        </text>
        <text x="100" y="112" textAnchor="middle" fontSize="11" fontWeight="500" fill="#667085">
          {centerLabel}
        </text>
      </svg>

      {/* The legend doubles as the table view: every category, named and valued. */}
      <ul className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {arcs.map((a) => (
          <li
            key={a.label}
            className={`flex items-center gap-1.5 text-xs transition-opacity ${
              hover && hover !== a.label ? 'opacity-45' : 'opacity-100'
            }`}
            onMouseEnter={() => setHover(a.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: a.color }}
              aria-hidden="true"
            />
            <span className="capitalize text-muted">{a.label}</span>
            <span className="font-semibold tabular-nums text-ink">{formatValue(a.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ bar --- */

// A near-square viewBox: these panels are as tall as they are wide, and a wide
// chart aspect would leave the bars stranded in a strip at the bottom.
const BW = 400
const BH = 300
const BPAD = { top: 30, right: 8, bottom: 32, left: 46 }

/** Round an axis top up to 1, 2 or 5 x 10^n so the ticks land on real numbers. */
function niceMax(peak) {
  if (!(peak > 0)) return 1
  const magnitude = 10 ** Math.floor(Math.log10(peak))
  const scaled = peak / magnitude
  const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10
  return step * magnitude
}

/** Rounded data-end anchored to the baseline: top corners only. */
function barPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h)
  return `M${x} ${y + h} L${x} ${y + rad} Q${x} ${y} ${x + rad} ${y} L${x + w - rad} ${y} Q${
    x + w
  } ${y} ${x + w} ${y + rad} L${x + w} ${y + h} Z`
}

/**
 * Single-measure column chart. One hue by design — these bars are the same
 * quantity over time, not competing series, so categorical colour would be a
 * lie about what varies.
 */
export function BarChart({ data, formatValue = (v) => String(v), valueLabel = '' }) {
  const [hover, setHover] = useState(null)
  const clipId = useId()

  if (!data.length) {
    return <p className="py-10 text-center text-sm text-muted">Nothing to chart yet.</p>
  }

  const peak = Math.max(...data.map((d) => d.value), 0)
  // A flat run of zeroes still needs a sane axis rather than a divide by zero.
  const max = niceMax(peak)
  const plotW = BW - BPAD.left - BPAD.right
  const plotH = BH - BPAD.top - BPAD.bottom
  const step = plotW / data.length
  const barW = Math.min(38, step * 0.52)
  const y = (v) => BPAD.top + (1 - v / max) * plotH
  // Formatting rounds, so two different tick values can render the same label.
  // Keep the first of each label rather than stacking "₹0" on "₹0".
  const seen = new Set()
  const ticks = Array.from({ length: 4 }, (_, i) => (max / 3) * i).filter((t) => {
    const label = formatValue(t)
    if (seen.has(label)) return false
    seen.add(label)
    return true
  })

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${BW} ${BH}`}
        className="w-full"
        role="img"
        aria-label={`${valueLabel} by day: ${data
          .map((d) => `${d.label} ${formatValue(d.value)}`)
          .join(', ')}`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={BW} height={BH} />
          </clipPath>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={BPAD.left}
              x2={BW - BPAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#e6edf5"
              strokeWidth="1"
            />
            <text x={BPAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#667085">
              {formatValue(t)}
            </text>
          </g>
        ))}

        <g clipPath={`url(#${clipId})`}>
          {data.map((d, i) => {
            const x = BPAD.left + i * step + (step - barW) / 2
            const top = y(d.value)
            const h = BPAD.top + plotH - top
            const active = hover === i
            return (
              <g key={d.label}>
                {/* Hit target is the whole column, not the drawn bar — a 3px bar
                    is impossible to hover otherwise. */}
                <rect
                  x={BPAD.left + i * step}
                  y={BPAD.top}
                  width={step}
                  height={plotH}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
                <path
                  d={barPath(x, top, barW, Math.max(h, 2), 4)}
                  fill={active ? '#0b4f8a' : '#1677d2'}
                  className="pointer-events-none transition-colors"
                />
                {/* Selective direct labels: the peak is always named, the rest
                    on hover, so the chart is not a wall of numbers. */}
                {(active || d.value === peak) && d.value > 0 && (
                  <text
                    x={x + barW / 2}
                    y={top - 8}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="600"
                    fill="#172033"
                    className="pointer-events-none"
                  >
                    {formatValue(d.value)}
                  </text>
                )}
                <text
                  x={x + barW / 2}
                  y={BH - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill={active ? '#172033' : '#667085'}
                  className="pointer-events-none"
                >
                  {d.label}
                </text>
              </g>
            )
          })}
        </g>

        {/* A run of real zeroes draws an empty axis and nothing else. Naming the
            absence is clearer than a blank panel — and it states what the API
            returned rather than substituting a value for it. */}
        {peak === 0 && (
          <text
            x={BPAD.left + plotW / 2}
            y={BPAD.top + plotH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fill="#5b6577"
          >
            No {valueLabel.toLowerCase() || 'activity'} in this period
          </text>
        )}
      </svg>
    </div>
  )
}
