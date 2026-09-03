/** Small shared UI pieces — keep pages focused on data flow. */

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  )
}

export function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 rounded-lg border border-expired/40 bg-expired-soft px-4 py-3 text-sm text-expired-ink"
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true">⚠</span>
        <span>{message}</span>
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="font-bold text-expired-ink/80 hover:text-expired-ink"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function InfoNote({ children }) {
  return (
    <div className="rounded-lg border border-brand/30 bg-info-soft px-4 py-3 text-sm text-info-ink">
      {children}
    </div>
  )
}

// Each status carries a light background, readable text and a dot colour, so
// the meaning never rests on hue alone — the label and dot travel together.
const BADGE_STYLES = {
  // Expiry statuses
  fresh: 'bg-fresh-soft text-fresh-ink',
  ageing: 'bg-ageing-soft text-ageing-ink',
  expired: 'bg-expired-soft text-expired-ink',
  // Order statuses
  pending: 'bg-neutral-soft text-neutral-ink',
  processed: 'bg-info-soft text-info-ink',
  delivered: 'bg-fresh-soft text-fresh-ink',
  // Invoice statuses
  unpaid: 'bg-expired-soft text-expired-ink',
  partial: 'bg-ageing-soft text-ageing-ink',
  paid: 'bg-fresh-soft text-fresh-ink',
}

const BADGE_DOTS = {
  fresh: 'bg-fresh',
  ageing: 'bg-ageing',
  expired: 'bg-expired',
  pending: 'bg-empty',
  processed: 'bg-brand',
  delivered: 'bg-fresh',
  unpaid: 'bg-expired',
  partial: 'bg-ageing',
  paid: 'bg-fresh',
}

export function Badge({ value }) {
  if (!value) return <span className="text-muted">—</span>
  const style = BADGE_STYLES[value] ?? 'bg-neutral-soft text-neutral-ink'
  const dot = BADGE_DOTS[value] ?? 'bg-empty'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {value}
    </span>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      {children}
    </div>
  )
}

/**
 * `bg` and `border` are props rather than something you pass through
 * `className`, because an appended `bg-*` utility does not reliably beat the
 * default one — same specificity means stylesheet order decides, not class
 * order, so a status-tinted card would silently stay white.
 */
export function Card({ children, className = '', bg = 'bg-surface', border = 'border-line' }) {
  return (
    <div className={`rounded-xl border ${border} ${bg} shadow-sm ${className}`}>{children}</div>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-4 py-3 text-sm text-ink ${className}`} {...rest}>
      {children}
    </td>
  )
}

/** Empty table body — a neutral icon plus a sentence, never a bare dash. */
export function EmptyRow({ colSpan, title, detail }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        {/* Decorative glyph — carries the empty/no-stock hue; the sentence
            below it does the reading, so this needs no text contrast. */}
        <div className="text-2xl text-empty" aria-hidden="true">
          ∅
        </div>
        <div className="mt-1 text-sm font-medium text-muted">{title}</div>
        {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
      </td>
    </tr>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

export const buttonPrimary =
  'rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50'
