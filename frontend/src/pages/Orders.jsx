import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import {
  Badge,
  Card,
  EmptyRow,
  ErrorAlert,
  PageHeader,
  Spinner,
  Td,
  Th,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '../components/ui'

const NEXT_STATUS = { pending: 'processed', processed: 'delivered' }
const formatINR = (value) =>
  `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

function NewOrderForm({ customers, products, onDone, onCancel }) {
  const [customer, setCustomer] = useState(customers[0]?.id ?? '')
  const [items, setItems] = useState([{ product: products[0]?.id ?? '', quantity: 1 }])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/orders/', {
        customer,
        items: items.map((item) => ({ product: item.product, quantity: Number(item.quantity) })),
      })
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">New order</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-w-xs">
          <label className="mb-1 block text-sm font-medium text-ink">Customer</label>
          <select
            className={inputClass}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            required
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Items</label>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  className={`${inputClass} max-w-xs`}
                  value={item.product}
                  onChange={(e) => updateItem(index, 'product', e.target.value)}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatINR(p.selling_price)}/{p.unit}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  className={`${inputClass} w-24`}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                  className="rounded-lg px-2 py-1 text-muted hover:text-expired disabled:opacity-30"
                  title="Remove item"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { product: products[0]?.id ?? '', quantity: 1 }])
            }
            className="mt-2 text-sm font-medium text-brand hover:text-brand-hover"
          >
            + Add item
          </button>
        </div>

        {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className={buttonPrimary}>
            {submitting ? 'Creating…' : 'Create order'}
          </button>
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </Card>
  )
}

function OrderRow({ order, isOwner, onTransition }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = NEXT_STATUS[order.status]

  async function transition() {
    setBusy(true)
    setError('')
    try {
      await onTransition(order.id, next)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <tr className="hover:bg-surface-muted">
        <Td className="font-medium text-ink">#{order.id}</Td>
        <Td>{order.customer_name}</Td>
        <Td>
          <ul className="space-y-0.5">
            {order.items.map((item) => (
              <li key={item.id} className="text-sm">
                {item.product_name} × {item.quantity}
              </li>
            ))}
          </ul>
        </Td>
        <Td className="tabular-nums">{formatINR(order.total)}</Td>
        <Td>{new Date(order.created_at).toLocaleString()}</Td>
        <Td>
          <Badge value={order.status} />
        </Td>
        <Td>
          {next && (
            <button onClick={transition} disabled={busy} className={`${buttonSecondary} text-xs`}>
              {busy ? 'Updating…' : `Mark ${next}`}
            </button>
          )}
          {order.status === 'delivered' &&
            order.has_invoice &&
            (isOwner ? (
              <Link
                to="/invoices"
                state={{ highlightOrder: order.id }}
                className="text-sm font-medium text-brand hover:text-brand-hover"
              >
                View invoice →
              </Link>
            ) : (
              <span className="text-sm text-muted">Invoice generated</span>
            ))}
        </Td>
      </tr>
      {error && (
        <tr>
          <Td colSpan={7} className="py-2">
            <ErrorAlert message={error} onDismiss={() => setError('')} />
          </Td>
        </tr>
      )}
    </>
  )
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    return Promise.all([api.get('/orders/'), api.get('/customers/'), api.get('/products/')])
      .then(([ord, cust, prods]) => {
        setOrders(ord.data)
        setCustomers(cust.data)
        setProducts(prods.data)
        setError('')
      })
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleTransition(orderId, status) {
    await api.patch(`/orders/${orderId}/`, { status })
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Orders">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className={buttonPrimary}>
            + New order
          </button>
        )}
      </PageHeader>

      {showForm && customers.length > 0 && products.length > 0 && (
        <NewOrderForm
          customers={customers}
          products={products}
          onCancel={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {error && <ErrorAlert message={error} />}
      {!error && !orders && <Spinner />}
      {orders && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Created</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  isOwner={user?.role === 'owner'}
                  onTransition={handleTransition}
                />
              ))}
              {orders.length === 0 && (
                <EmptyRow
                  colSpan={7}
                  title="No orders yet"
                  detail="Create an order to see it listed here."
                />
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
