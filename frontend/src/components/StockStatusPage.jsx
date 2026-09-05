import { Link } from 'react-router-dom'
import {
  EXPIRY_ORDER,
  EXPIRY_STATUS,
  expiryPhrase,
  formatDate,
} from '../data/expiryStatus'
import { Card, PageHeader } from './ui'

/**
 * The frame the three shelf pages share: title, the way back to the shelf, the
 * three-way switcher, and the figures for whatever is on this page.
 *
 * Each page owns only its table and its actions. Without this the Expired page
 * — the one that grew a disposal flow — would quietly drift away from the two
 * that did not, and the figures above the table would end up computed twice.
 */

/** The figures, derived from the rows on screen rather than fetched again.
 *
 *  A second request for the same numbers is a second chance to disagree with
 *  the table underneath them: the list is already filtered (the Expired page
 *  hides what has been disposed of), and a summary that counted differently
 *  would be wrong the moment anyone disposed of anything.
 */
function summarise(rows) {
  return {
    quantity: rows.reduce((total, row) => total + row.quantity, 0),
    batches: rows.length,
    products: new Set(rows.map((row) => row.product)).size,
    edgeExpiry: rows.reduce(
      (earliest, row) =>
        earliest === null || row.expiry_date < earliest ? row.expiry_date : earliest,
      null,
    ),
  }
}

function StatusTabs({ current }) {
  return (
    <nav aria-label="Expiry status" className="flex flex-wrap gap-2">
      {EXPIRY_ORDER.map((status) => {
        const meta = EXPIRY_STATUS[status]
        const active = status === current
        return (
          <Link
            key={status}
            to={meta.path}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${
              active
                ? `${meta.tone.card} ${meta.tone.ink}`
                : 'border-line bg-surface text-muted hover:bg-surface-muted hover:text-ink'
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${meta.tone.dot}`}
              aria-hidden="true"
            />
            {meta.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Figure({ label, value, detail, tone }) {
  return (
    <Card className="p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`mt-2 text-[26px] font-bold leading-none tabular-nums ${tone}`}>
        {value}
      </div>
      {detail && <div className="mt-1.5 text-xs text-muted">{detail}</div>}
    </Card>
  )
}

export default function StockStatusPage({ status, rows, children }) {
  const meta = EXPIRY_STATUS[status]
  const figures = rows ? summarise(rows) : null
  const expired = status === 'expired'

  return (
    <div className="space-y-6">
      <PageHeader title={meta.title}>
        <Link
          to="/"
          className="text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
        >
          ← Back to the shelf
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs current={status} />
        <p className="text-sm text-muted">{meta.blurb}</p>
      </div>

      {figures && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Figure
            label="Units on the shelf"
            value={figures.quantity.toLocaleString('en-IN')}
            detail="Across every unit of measure"
            tone={meta.tone.ink}
          />
          <Figure
            label="Batches"
            value={figures.batches}
            detail={expired ? 'Still awaiting disposal' : 'Individual deliveries'}
            tone="text-ink"
          />
          <Figure
            label="Products"
            value={figures.products}
            detail="Distinct lines affected"
            tone="text-ink"
          />
          <Figure
            label={expired ? 'Oldest expiry' : 'Next expiry'}
            value={formatDate(figures.edgeExpiry)}
            detail={figures.edgeExpiry ? expiryPhrase(figures.edgeExpiry) : 'Nothing here'}
            tone="text-ink"
          />
        </div>
      )}

      {children}
    </div>
  )
}
