import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-info text-white shadow-sm'
      : 'text-slate-300 hover:bg-shell-soft hover:text-white'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-canvas">
      <nav className="bg-shell shadow-sm" aria-label="Main">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold tracking-tight text-white">
              <span aria-hidden="true">🥛</span> DairyDesk
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/inventory" className={linkClass}>
                Inventory
              </NavLink>
              <NavLink to="/orders" className={linkClass}>
                Orders
              </NavLink>
              {user?.role === 'owner' && (
                <NavLink to="/invoices" className={linkClass}>
                  Invoices
                </NavLink>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">
              {user?.username}
              <span className="ml-1.5 rounded-full bg-shell-soft px-2 py-0.5 text-xs capitalize text-slate-300">
                {user?.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-shell-soft hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
