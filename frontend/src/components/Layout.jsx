import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { STORE, fmtTime } from '../data/storeMock'

/**
 * Store-shell layout: a fixed dark rail with the page list, and a status box
 * pinned to the bottom. Collapses to an off-canvas drawer under `lg`.
 */

const ICONS = {
  dashboard: 'M3 3h7v7H3V3zm11 0h7v4h-7V3zM3 14h7v7H3v-7zm11-3h7v10h-7V11z',
  products: 'M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.8 8 12 11.7 5.2 8 12 4.3z',
  stock: 'M4 20h3v-8H4v8zm6.5 0h3V4h-3v16zm6.5 0h3v-6h-3v6z',
  orders: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v1.5H8V12zm0 4h8v1.5H8V16z',
  suppliers: 'M3 6h11v9H3V6zm12 3h3.5L21 12v3h-6V9zM6.5 20a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm11 0a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  reports: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 13h2v5H8v-5zm3.5-3h2v8h-2v-8zM15 15h2v3h-2v-3z',
  inventory: 'M4 4h16v4H4V4zm0 6h16v10H4V10zm5 3h6v1.6H9V13z',
  invoices: 'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2V2zm3 5h8v1.6H8V7zm0 4h8v1.6H8V11zm0 4h5v1.6H8V15z',
  staff: 'M12 12.2a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2zM3.5 21v-1.4c0-2.9 3.8-5.2 8.5-5.2s8.5 2.3 8.5 5.2V21h-17z',
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

function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand text-white'
      : 'text-rail-ink hover:bg-rail-hover hover:text-white'
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
        <Icon path={ICONS[p.icon]} />
        {p.label}
      </NavLink>
    </li>
  )

  return (
    <div className="min-h-screen bg-canvas">
      {/* Mobile-only drawer trigger */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        className="fixed left-3 top-3 z-50 rounded-lg bg-rail p-2.5 text-rail-ink shadow-lg lg:hidden"
      >
        <span className="block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
        <span className="mt-1 block h-0.5 w-5 bg-current" />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-rail transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="h-9 w-9 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate font-bold text-white">{STORE.name}</div>
            <div className="truncate text-xs text-rail-muted">Store inventory tracker</div>
          </div>
        </div>

        <nav aria-label="Pages" className="flex-1 overflow-y-auto px-3">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-rail-muted">
            Pages
          </div>
          <ul className="space-y-1">{pages.map(navLink)}</ul>

          {isOwner && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-rail-muted">
                Owner
              </div>
              <ul className="space-y-1">{OWNER_PAGES.map(navLink)}</ul>
            </div>
          )}
        </nav>

        <div className="m-3 rounded-xl bg-rail-soft p-3.5 text-xs">
          <div className="flex items-center gap-2 font-medium text-rail-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-fresh" aria-hidden="true" />
            System online
          </div>
          <div className="mt-2 font-semibold text-white">{STORE.name}</div>
          <div className="mt-0.5 text-rail-muted">
            {STORE.code} · {STORE.city}
          </div>
          <div className="text-rail-muted">Last sync {fmtTime(syncedAt)}</div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            <span className="flex min-w-0 items-center gap-1.5 text-rail-ink">
              <span className="truncate">{user?.username}</span>
              <span className="shrink-0 rounded bg-brand/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                {user?.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded px-1.5 py-0.5 text-rail-muted transition-colors hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-6 lg:ml-60 lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
