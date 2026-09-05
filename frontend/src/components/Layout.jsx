import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { STORE, fmtTime } from '../data/storeMock'
import Logo from './Logo'

/**
 * Store-shell layout: a fixed rail with a white logo band over a blue gradient,
 * the page list, and a status box pinned to the bottom. Collapses to an
 * off-canvas drawer under `lg`.
 */

// Light stroke icons, drawn inline so the app takes on no icon dependency.
// They inherit `currentColor`, which is what lets one nav item invert on the
// active white pill without a second colour rule.
const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="2" />
    </>
  ),
  products: (
    <>
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5v-9Z" />
      <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 21v-9" />
    </>
  ),
  stock: (
    <>
      <path d="M4 20V12M10 20V4M16 20v-5M22 20H2" />
    </>
  ),
  inventory: (
    <>
      <rect x="3" y="3.5" width="18" height="4.5" rx="1.5" />
      <path d="M4.5 8v10.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V8" />
      <path d="M10 12h4" />
    </>
  ),
  orders: (
    <>
      <path d="M2.5 3h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L19.5 7H6" />
      <circle cx="9.5" cy="19.5" r="1.4" />
      <circle cx="16.5" cy="19.5" r="1.4" />
    </>
  ),
  suppliers: (
    <>
      <path d="M3 6.5h10.5v9H3z" />
      <path d="M13.5 9.5h3.8l2.7 3v3h-6.5z" />
      <circle cx="6.5" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  reports: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-2" />
    </>
  ),
  invoices: (
    <>
      <path d="M6 2.5h12v19l-2.5-1.8-2.4 1.8L12 20l-2.4 1.5L7 20 6 21.5v-19Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  staff: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c0-3.3 3.4-5.6 7.5-5.6s7.5 2.3 7.5 5.6" />
    </>
  ),
}

/**
 * Ornament for the status panel's elastic middle.
 *
 * This block is what absorbs the height the page list used to leave empty, so
 * it has to hold up at 80px and at 400px alike — hence a repeating texture
 * carrying the fill and a single mark centred on it, rather than a lone glyph
 * that would strand itself in the middle of a tall panel.
 *
 * Deliberately a drop and a texture rather than anything numeric: the panel
 * sits in an inventory app, so a bar, ring or dial in it would be read as a
 * figure. Nothing here is data, and nothing here can be mistaken for it.
 */
function Ornament() {
  return (
    <div
      className="rail-texture flex min-h-[4.5rem] grow items-center justify-center py-4"
      aria-hidden="true"
    >
      <span className="rail-glow flex h-24 w-24 items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="h-9 w-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--color-rail-ornament)' }}
        >
          <path d="M12 3.4c3.5 4 5.4 6.6 5.4 9a5.4 5.4 0 1 1-10.8 0c0-2.4 1.9-5 5.4-9Z" />
          <path d="M9.4 13.2a2.6 2.6 0 0 0 2.6 2.6" />
        </svg>
      </span>
    </div>
  )
}

// Order mirrors the standalone store build; Inventory and Invoices are kept
// because they are this app's live batch/expiry pages and drop nothing.
// Alerts is deliberately absent: it is reached from the Dashboard, next to the
// KPIs that raise the same concerns.
const PAGES = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/products', label: 'Products', icon: 'products' },
  { to: '/stock', label: 'Stock Levels', icon: 'stock' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/orders', label: 'Orders', icon: 'orders' },
  { to: '/suppliers', label: 'Suppliers', icon: 'suppliers' },
  { to: '/reports', label: 'Reports', icon: 'reports', ownerOnly: true },
  { to: '/invoices', label: 'Invoices', icon: 'invoices', ownerOnly: true },
]

// Its own group rather than a ninth page: managing who can sign in is not
// store work, and the heading is what tells a staff member's screen apart from
// an owner's. Rendered inside the scrolling nav, so it sits against Invoices at
// the top of the gap instead of drifting down onto the status card.
const OWNER_PAGES = [{ to: '/staff', label: 'Staff', icon: 'staff' }]

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-white text-brand shadow-sm'
      : 'text-white/85 hover:bg-white/12 hover:text-white'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [syncedAt] = useState(() => new Date())

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const isOwner = user?.role === 'owner'
  const pages = PAGES.filter((p) => !p.ownerOnly || isOwner)

  const navLink = (p) => (
    <li key={p.to}>
      <NavLink to={p.to} end={p.end} className={linkClass} onClick={() => setOpen(false)}>
        <Icon name={p.icon} />
        {p.label}
      </NavLink>
    </li>
  )

  // The wrapper is transparent rather than bg-canvas: the tinted washes live
  // on <body>, and an opaque wrapper here would cover them, leaving the frosted
  // cards with nothing to refract.
  return (
    <div className="min-h-screen">
      {/* Mobile-only drawer trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="fixed left-3 top-3 z-50 rounded-xl bg-surface p-2.5 text-brand shadow-card ring-1 ring-line lg:hidden"
      >
        <span className="block h-0.5 w-5 rounded bg-current" />
        <span className="mt-1 block h-0.5 w-5 rounded bg-current" />
        <span className="mt-1 block h-0.5 w-5 rounded bg-current" />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`on-rail fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-linear-to-b from-brand/92 to-brand-deep/95 backdrop-blur-2xl transition-transform lg:translate-x-0 lg:rounded-r-3xl ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* White band under the logo, as in the reference. The rounded bottom
            edge is what blends the band into the gradient below it. */}
        <div className="flex h-[84px] shrink-0 items-center rounded-br-3xl bg-surface px-5 lg:rounded-tr-3xl">
          <Logo className="h-14" />
        </div>

        {/* Grow is deliberately off here and on the panel below: the page list
            keeps its natural height at the top, and the panel is what absorbs
            the leftover column. `min-h-0` lets it shrink past its content on a
            short viewport so the list scrolls rather than pushing the panel
            off the bottom. */}
        <nav aria-label="Pages" className="min-h-0 shrink overflow-y-auto px-3 pt-6">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Pages
          </div>
          <ul className="space-y-1.5">{pages.map(navLink)}</ul>

          {isOwner && (
            <div className="mt-5 border-t border-white/15 pt-4">
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
                Owner
              </div>
              <ul className="space-y-1.5">{OWNER_PAGES.map(navLink)}</ul>
            </div>
          )}
        </nav>

        {/* The status panel. `grow shrink-0` is what closes the gap the page
            list used to leave: it fills the rest of the column instead of
            sitting as a small block at the bottom, and never compresses below
            its own content. Under `short` it drops back to a compact box and
            `mt-auto` re-pins it — auto margins eat free space before grow does,
            so the two are kept on separate breakpoints rather than combined. */}
        <div className="rail-panel short:mt-auto m-3 flex min-h-60 shrink-0 grow flex-col rounded-2xl px-4 py-4 text-xs short:min-h-0 short:grow-0">
          {/* 1 — Store identity */}
          <div className="pb-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rail-dim">
              <span
                className="h-1.5 w-1.5 rounded-full bg-fresh shadow-[0_0_0_3px_rgba(53,166,111,0.22)]"
                aria-hidden="true"
              />
              System online
            </div>
            <div className="mt-2.5 text-sm font-semibold tracking-tight text-white">
              {STORE.name}
            </div>
            <div className="mt-1 text-rail-dim">
              {STORE.code} · {STORE.city}
            </div>
          </div>

          {/* 2 — Where a quick-stats strip would go. Nothing numeric about the
              store is on the client without a request: the live figures all sit
              behind `api.get`, and the arrays left in storeMock describe a
              demo store, so putting them here would have the rail contradict
              the API-backed pages beside it. Ornament instead, per the brief. */}
          <div className="flex grow flex-col border-t border-rail-divider short:hidden">
            <Ornament />
          </div>

          {/* 3 — Sync status */}
          <div className="flex items-center gap-2 border-t border-rail-divider py-3 text-rail-dim short:hidden">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 1.8" />
            </svg>
            Last sync
            <span className="ml-auto font-semibold tabular-nums text-white">
              {fmtTime(syncedAt)}
            </span>
          </div>

          {/* 4 — Account */}
          <div className="flex items-center justify-between gap-2 border-t border-rail-divider pt-3">
            <span className="flex min-w-0 items-center gap-1.5 text-white">
              <span className="truncate font-medium">{user?.username}</span>
              <span className="shrink-0 rounded-md bg-white/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {user?.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-md px-1.5 py-0.5 font-medium text-rail-dim transition-colors hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* pt-20 under `lg` clears the floating drawer button, which is fixed
          over the content and would otherwise sit on the page title. */}
      <main className="px-4 pb-8 pt-20 sm:px-6 lg:ml-60 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
