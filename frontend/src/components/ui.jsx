/** Small shared UI pieces — keep pages focused on data flow. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
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
  // Staff account states. Disabled is neutral, not red: someone on leave is
  // not an error condition.
  active: 'bg-fresh-soft text-fresh-ink',
  disabled: 'bg-neutral-soft text-neutral-ink',
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
  active: 'bg-fresh',
  disabled: 'bg-empty',
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

/**
 * Persistent stand-in for a list that could not be fetched. The toast says
 * what went wrong and fades; this keeps the page from looking merely empty,
 * and offers the one action worth taking.
 */
export function LoadFailed({ what, onRetry }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-2xl text-expired" aria-hidden="true">
        ⚠
      </div>
      <div className="mt-1 text-sm font-medium text-ink">Could not load {what}.</div>
      <div className="mt-0.5 text-xs text-muted">
        The server may be unreachable. Check that the backend is running.
      </div>
      <button onClick={onRetry} className={`${buttonSecondary} mt-4`}>
        Try again
      </button>
    </Card>
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

/**
 * Round + in a page header, opening a small menu of things to create. One
 * entry today on each page that uses it, but a menu rather than a plain link
 * because that is the affordance a + promises.
 */
export function AddMenu({ label, title, description, icon, to }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-2xl leading-none text-white shadow-sm transition-colors hover:bg-brand-hover"
      >
        <span aria-hidden="true" className="-mt-0.5">
          +
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate(to)
            }}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted"
          >
            <span className="mt-0.5 text-lg" aria-hidden="true">
              {icon}
            </span>
            <span>
              <span className="block text-sm font-medium text-ink">{title}</span>
              <span className="block text-xs text-muted">{description}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

export const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'

export const buttonPrimary =
  'rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50'
