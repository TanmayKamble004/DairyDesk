import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { ToastProvider } from './components/Toast'
import Alerts from './pages/Alerts'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Invoices from './pages/Invoices'
import Login from './pages/Login'
import Orders from './pages/Orders'
import ProductForm from './pages/ProductForm'
import Products from './pages/Products'
import Reports from './pages/Reports'
import Staff from './pages/Staff'
import StaffForm from './pages/StaffForm'
import StockLevels from './pages/StockLevels'
import SupplierForm from './pages/SupplierForm'
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
        {/* Above the routes, so a toast raised just before a redirect is still
            on screen when the next page renders. */}
        <ToastProvider>
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
              {/* Owner and staff both maintain the catalogue — no role gate.
                  Deleting is gated inside the form, not by the route. */}
              <Route path="/products/new" element={<ProductForm />} />
              <Route path="/products/:id/edit" element={<ProductForm />} />
              <Route path="/stock" element={<StockLevels />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/suppliers/new" element={<SupplierForm />} />
              <Route path="/suppliers/:id/edit" element={<SupplierForm />} />
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
              {/* Who can sign in, and as what. The API refuses staff outright;
                  these gates only keep the pages out of their way. Unlike
                  products, even the form is owner-only — it sets passwords. */}
              <Route
                path="/staff"
                element={
                  <RequireOwner>
                    <Staff />
                  </RequireOwner>
                }
              />
              <Route
                path="/staff/new"
                element={
                  <RequireOwner>
                    <StaffForm />
                  </RequireOwner>
                }
              />
              <Route
                path="/staff/:id/edit"
                element={
                  <RequireOwner>
                    <StaffForm />
                  </RequireOwner>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
