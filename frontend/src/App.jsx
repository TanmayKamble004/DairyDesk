import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Alerts from './pages/Alerts'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Invoices from './pages/Invoices'
import Login from './pages/Login'
import Orders from './pages/Orders'
import Products from './pages/Products'
import Reports from './pages/Reports'
import StockLevels from './pages/StockLevels'
import Suppliers from './pages/Suppliers'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

function RequireOwner({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'owner') {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/stock" element={<StockLevels />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/alerts" element={<Alerts />} />
            {/* Reports is this app's financial export, so it follows the same
                owner-only gate as Invoices. */}
            <Route
              path="/reports"
              element={
                <RequireOwner>
                  <Reports />
                </RequireOwner>
              }
            />
            <Route
              path="/invoices"
              element={
                <RequireOwner>
                  <Invoices />
                </RequireOwner>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
