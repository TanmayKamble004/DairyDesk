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
    <div className="rounded-xl border border-brand/20 bg-info-soft px-4 py-3 text-sm text-info-ink">
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {value}
    </span>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 lg:mb-7">
      <h1 className="text-2xl font-bold tracking-tight text-ink lg:text-[26px]">{title}</h1>
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
export function Card({ children, className = '', bg, border, glass = false }) {
  // `glass` swaps the solid surface for a frosted one. It is opt-in rather than
  // the default so pages that have not been designed against a tinted ground
  // keep their solid cards; an explicit `bg`/`border` still wins either way.
  const surface = bg ?? (glass ? 'bg-glass' : 'bg-surface')
  const edge = border ?? (glass ? 'border-glass-line' : 'border-line')
  const elevation = glass ? 'glass-chrome' : 'shadow-card'
  return (
    <div className={`rounded-2xl border ${edge} ${surface} ${elevation} ${className}`}>
      {children}
    </div>
  )
}

/**
 * A titled card with the section heading the dashboard panels share — title on
 * the left, optional control or caption on the right, content below.
 */
export function Panel({ title, subtitle, action, children, className = '', bodyClass = 'p-5 pt-0', glass = false }) {
  return (
    <Card glass={glass} className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </Card>
  )
}

/**
 * The rounded tinted square that sits in the corner of a statistic card and at
 * the head of a panel. `tone` picks the wash; the icon inherits `currentColor`.
 */
const CHIP_TONES = {
  brand: 'bg-brand-soft text-brand',
  fresh: 'bg-fresh-soft text-fresh-ink',
  ageing: 'bg-ageing-soft text-ageing-ink',
  expired: 'bg-expired-soft text-expired-ink',
  coral: 'bg-coral-soft text-coral-ink',
  neutral: 'bg-neutral-soft text-neutral-ink',
}

export function IconChip({ children, tone = 'brand', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        CHIP_TONES[tone] ?? CHIP_TONES.brand
      } ${className}`}
    >
      {children}
    </span>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th
      className={`px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-5 py-4 text-sm text-ink ${className}`} {...rest}>
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
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-expired-soft text-xl text-expired-ink" aria-hidden="true">
        ⚠
      </div>
      <div className="text-sm font-semibold text-ink">Could not load {what}.</div>
      <div className="mt-1 text-xs text-muted">
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
      <td colSpan={colSpan} className="px-5 py-12 text-center">
        {/* Decorative glyph — carries the empty/no-stock hue; the sentence
            below it does the reading, so this needs no text contrast. */}
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-soft text-xl text-empty" aria-hidden="true">
          ∅
        </div>
        <div className="text-sm font-medium text-ink">{title}</div>
        {detail && <div className="mt-0.5 text-xs text-muted">{detail}</div>}
      </td>
    </tr>
  )
}

/**
 * Round + in a page header, opening a small menu of things to create. One
 * entry today on each page that uses it, but a menu rather than a plain link
 * because that is the affordance a + promises.
 *
 * `onSelect` opens something in place — a dialog on the page itself. `to` is
 * the older behaviour of navigating to a create route, kept so pages can move
 * across one at a time. `triggerRef` exposes the + itself, which is where
 * focus has to go back to once a dialog it opened is closed: by then the menu
 * item that was clicked no longer exists to return to.
 */
export function AddMenu({ label, title, description, icon, to, onSelect, triggerRef }) {
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
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-2xl leading-none text-white shadow-card transition-colors hover:bg-brand-hover"
      >
        <span aria-hidden="true" className="-mt-0.5">
          +
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border border-line bg-surface shadow-raised"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              if (onSelect) onSelect()
              else navigate(to)
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
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export const buttonPrimary =
  'rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50'
