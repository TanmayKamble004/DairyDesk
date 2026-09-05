/**
 * The three expiry statuses, in one place.
 *
 * The 3D shelf renders one stack per status and each stack opens that status's
 * page, so the colour on the crate, the tint on the page it opens and the route
 * between them all have to agree. They did not when the shelf carried its own
 * palette: its greens and ambers were three-js defaults while every badge
 * around it used the app's. One definition each, here.
 *
 * `color` is a hex literal because three.js materials cannot read a CSS custom
 * property; it is kept in step with `--color-fresh` / `-ageing` / `-expired` in
 * index.css by hand. Everything else in the app should use the Tailwind tokens.
 */

// Fresh → ageing → expired: the order stock moves through, which is the order
// the shelf lays the stacks out in and the pages list their tabs in. The API
// returns the same three worst-first, for triage rather than for display.
export const EXPIRY_ORDER = ['fresh', 'ageing', 'expired']

export const EXPIRY_STATUS = {
  fresh: {
    label: 'Fresh',
    color: '#35a66f',
    path: '/inventory/fresh',
    title: 'Fresh stock',
    blurb: 'Well inside shelf life.',
    tone: {
      card: 'border-fresh/25 bg-fresh-soft/50',
      ink: 'text-fresh-ink',
      dot: 'bg-fresh',
      chip: 'fresh',
    },
  },
  ageing: {
    label: 'Ageing',
    color: '#f2a93b',
    path: '/inventory/ageing',
    title: 'Ageing stock',
    blurb: 'Inside its ageing window — sell this first.',
    tone: {
      card: 'border-ageing/25 bg-ageing-soft/50',
      ink: 'text-ageing-ink',
      dot: 'bg-ageing',
      chip: 'ageing',
    },
  },
  expired: {
    label: 'Expired',
    color: '#e86f6f',
    path: '/inventory/expired',
    title: 'Expired stock',
    blurb: 'Past its date. Not sellable — dispose of it.',
    tone: {
      card: 'border-coral/40 bg-coral-soft/50',
      ink: 'text-coral-ink',
      dot: 'bg-expired',
      chip: 'coral',
    },
  },
}

export const isExpiryStatus = (value) => Object.hasOwn(EXPIRY_STATUS, value)

/** Whole days from today to `iso`; negative once the date is past. */
export function daysUntil(iso) {
  if (!iso) return null
  const target = new Date(iso)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

export const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

/** "in 4 days" / "today" / "3 days ago" — the same phrase on all three pages. */
export function expiryPhrase(iso) {
  const days = daysUntil(iso)
  if (days === null) return '—'
  if (days === 0) return 'today'
  if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`
  const past = Math.abs(days)
  return `${past} day${past === 1 ? '' : 's'} ago`
}
