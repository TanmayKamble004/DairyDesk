/** Small shared UI pieces — keep pages focused on data flow.
 *
 * Colour comes from the semantic tokens in index.css. Status is never
 * communicated by colour alone: every badge and indicator pairs its colour
 * with a text label and a distinct shape (circle / triangle / square), so
 * the UI still reads correctly in greyscale or with colour-vision deficiency.
 */

/** Distinct silhouettes per status — the non-colour half of the signal. */
export function StatusShape({ shape = 'dot', className = '' }) {
  const paths = {
    circle: <circle cx="5" cy="5" r="4" />,
    triangle: <path d="M5 0.8 L9.4 8.8 H0.6 Z" />,
    square: <rect x="1" y="1" width="8" height="8" rx="1.5" />,
    dash: <rect x="0.8" y="4" width="8.4" height="2" rx="1" />,
    dot: <circle cx="5" cy="5" r="3" />,
  }
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      focusable="false"
      className={`h-2.5 w-2.5 shrink-0 fill-current ${className}`}
    >
      {paths[shape] ?? paths.dot}
    </svg>
  )
}

const STATUS_META = {
  // Inventory expiry — the palette's primary semantic use.
  fresh: { shape: 'circle', chip: 'bg-fresh-soft text-fresh-ink ring-fresh/20' },
  ageing: { shape: 'triangle', chip: 'bg-ageing-soft text-ageing-ink ring-ageing/20' },
  expired: { shape: 'square', chip: 'bg-expired-soft text-expired-ink ring-expired/20' },
  // Order workflow — neutral until it means something.
  pending: { shape: 'dash', chip: 'bg-slate-100 text-slate-600 ring-slate-300/50' },
  processed: { shape: 'dot', chip: 'bg-info-soft text-info-ink ring-info/20' },
  delivered: { shape: 'circle', chip: 'bg-fresh-soft text-fresh-ink ring-fresh/20' },
  // Invoice payment status.
  unpaid: { shape: 'square', chip: 'bg-expired-soft text-expired-ink ring-expired/20' },
  partial: { shape: 'triangle', chip: 'bg-ageing-soft text-ageing-ink ring-ageing/20' },
  paid: { shape: 'circle', chip: 'bg-fresh-soft text-fresh-ink ring-fresh/20' },
}

const NEUTRAL_META = { shape: 'dot', chip: 'bg-slate-100 text-slate-600 ring-slate-300/50' }

/** Colour + shape + word. Never just colour. */
export function Badge({ value }) {
  if (!value) return <span className="text-empty">—</span>
  const meta = STATUS_META[value] ?? NEUTRAL_META
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${meta.chip}`}
    >
      <StatusShape shape={meta.shape} />
      {value}
    </span>
  )
}

/** Inline status marker for legends and dense table cells. */
export function StatusIndicator({ status, label, className = '' }) {
  const meta = STATUS_META[status] ?? NEUTRAL_META
  const tone = {
    fresh: 'text-fresh',
    ageing: 'text-ageing',
    expired: 'text-expired',
  }[status]
  return (
    <span className={`inline-flex items-center gap-1.5 ${tone ?? 'text-slate-500'} ${className}`}>
      <StatusShape shape={meta.shape} />
      <span className="capitalize">{label ?? status}</span>
    </span>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-10 text-sm text-slate-500"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-info" />
      {label}
    </div>
  )
}

function Alert({ tone, icon, message, onDismiss, role }) {
  if (!message) return null
  return (
    <div
      role={role}
      className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${tone}`}
    >
      <span className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-px font-semibold">
          {icon}
        </span>
        <span>{message}</span>
      </span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded font-bold opacity-60 hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  )
}

export function ErrorAlert({ message, onDismiss }) {
  return (
    <Alert
      role="alert"
      tone="border-expired/25 bg-expired-soft text-expired-ink"
      icon="!"
      message={message}
      onDismiss={onDismiss}
    />
  )
}

export function SuccessAlert({ message, onDismiss }) {
  return (
    <Alert
      role="status"
      tone="border-fresh/25 bg-fresh-soft text-fresh-ink"
      icon="✓"
      message={message}
      onDismiss={onDismiss}
    />
  )
}

export function InfoAlert({ message, onDismiss }) {
  return (
    <Alert
      role="status"
      tone="border-info/25 bg-info-soft text-info-ink"
      icon="i"
      message={message}
      onDismiss={onDismiss}
    />
  )
}

/** Muted placeholder for a section with nothing to show yet. */
export function EmptyState({ title, detail }) {
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-sm font-medium text-empty">{title}</div>
      {detail && <div className="mt-1 text-sm text-slate-400">{detail}</div>}
    </div>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-800">{title}</h1>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 ${className}`}
    >
      {children}
    </div>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-4 py-3 text-sm text-slate-800 ${className}`} {...rest}>
      {children}
    </td>
  )
}

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-empty focus:border-info focus:outline-none focus:ring-1 focus:ring-info'

export const buttonPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export const buttonDanger =
  'inline-flex items-center gap-2 rounded-lg bg-expired px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-expired-ink disabled:cursor-not-allowed disabled:opacity-50'
