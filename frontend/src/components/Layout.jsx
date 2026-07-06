import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-slate-800">🥛 DairyDesk</span>
            <div className="flex items-center gap-1">
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
            <span className="text-slate-600">
              {user?.username}
              <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-500">
                {user?.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
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
