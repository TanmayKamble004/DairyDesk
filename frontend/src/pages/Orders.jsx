import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import {
  Badge,
  Card,
  EmptyRow,
  LoadFailed,
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

// Sentinel option value. A buyer nobody has served before turns up mid-order,
// so the dropdown that names them is also where they get created.
const ADD_CUSTOMER = '__add__'

/**
 * Inline "new customer" panel, opened from the dropdown.
 *
 * Deliberately not a nested <form> — that is invalid inside the order form —
 * so Enter is caught here and routed to Add, rather than submitting an order
 * for a customer who does not exist yet.
 */
function NewCustomerPanel({ cancellable = true, onCancel, onCreated }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const { [field]: _cleared, ...rest } = prev
      return rest
    })
  }

  async function save() {
    const found = {}
    if (!form.name.trim()) found.name = 'A name is required.'
    if (!form.phone.trim()) {
      found.phone = 'A phone number is required.'
    } else if (form.phone.replace(/\D/g, '').length < 7) {
      found.phone = 'Enter a full phone number.'
    }
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }

    setSaving(true)
    try {
      const res = await api.post('/customers/', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        // Optional: a walk-in buyer has a name and a number and nothing else.
        address: form.address.trim(),
      })
      toast.success(`${res.data.name} added as a customer.`)
      onCreated(res.data)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setErrors(
          Object.fromEntries(
            Object.entries(data).map(([field, messages]) => [
              field,
              Array.isArray(messages) ? messages.join(' ') : String(messages),
            ]),
          ),
        )
      }
      toast.error(apiErrorMessage(err))
      setSaving(false)
    }
  }

  const field = (name, label, props = {}) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted" htmlFor={`customer-${name}`}>
        {label}
      </label>
      <input
        id={`customer-${name}`}
        className={`${inputClass}${errors[name] ? ' ring-1 ring-expired' : ''}`}
        value={form[name]}
        onChange={(e) => set(name, e.target.value)}
        aria-invalid={Boolean(errors[name])}
        {...props}
      />
      {errors[name] && (
        <p className="mt-1 text-xs font-medium text-expired-ink">{errors[name]}</p>
      )}
    </div>
  )

  return (
    <div
      className="mt-3 rounded-lg border border-line bg-surface-muted p-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          save()
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {field('name', 'Name', { placeholder: 'Cafe Aroma', maxLength: 100, autoFocus: true })}
        {field('phone', 'Phone', { type: 'tel', placeholder: '98200 11223', maxLength: 20 })}
      </div>
      <div className="mt-3">{field('address', 'Address (optional)', { placeholder: 'FC Road, Pune' })}</div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={save} disabled={saving} className={buttonPrimary}>
          {saving ? 'Adding…' : 'Add customer'}
        </button>
        {cancellable && (
          <button type="button" onClick={onCancel} disabled={saving} className={buttonSecondary}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

/** Two-step, so an irreversible action is never one stray click away. */
function DeleteCustomer({ customer, onDeleted }) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    setBusy(true)
    try {
      await api.delete(`/customers/${customer.id}/`)
      toast.success(`“${customer.name}” deleted.`)
      onDeleted(customer.id)
    } catch (err) {
      // Refusals are expected here — a customer with orders is kept.
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-lg border border-expired/40 bg-expired-soft px-3 py-2 text-sm font-medium text-expired-ink hover:bg-expired-soft/70"
      >
        Delete
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink">Delete “{customer.name}”?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="rounded-lg bg-expired px-3 py-2 text-sm font-medium text-white hover:bg-expired/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className={buttonSecondary}
      >
        Keep
      </button>
    </div>
  )
}

function NewOrderForm({
  customers,
  products,
  isOwner,
  onCustomerAdded,
  onCustomerDeleted,
  onDone,
  onCancel,
}) {
  const toast = useToast()
  const [customer, setCustomer] = useState(customers[0]?.id ?? '')
  // Open straight away when there is nobody to sell to yet, rather than
  // showing an empty dropdown and no way out of it.
  const [addingCustomer, setAddingCustomer] = useState(customers.length === 0)
  const [items, setItems] = useState([{ product: products[0]?.id ?? '', quantity: 1 }])
  const [submitting, setSubmitting] = useState(false)

  const selected = customers.find((c) => String(c.id) === String(customer))

  function updateItem(index, field, value) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  function handleCustomerChange(value) {
    if (value === ADD_CUSTOMER) {
      setAddingCustomer(true)
      return
    }
    setCustomer(value)
  }

  function handleCustomerCreated(created) {
    onCustomerAdded(created)
    setCustomer(created.id)
    setAddingCustomer(false)
  }

  function handleCustomerDeleted(id) {
    onCustomerDeleted(id)
    // Fall back to whoever is left, or to the add panel if that was the last.
    const remaining = customers.filter((c) => c.id !== id)
    setCustomer(remaining[0]?.id ?? '')
    setAddingCustomer(remaining.length === 0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const buyer = selected
    if (!buyer) {
      toast.error('Choose a customer, or add one, before creating the order.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/orders/', {
        customer,
        items: items.map((item) => ({ product: item.product, quantity: Number(item.quantity) })),
      })
      toast.success(`Order created for ${buyer?.name ?? 'the customer'}.`)
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-ink">New order</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-w-xl">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="customer">
            Customer
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="customer"
              className={`${inputClass} max-w-xs`}
              value={addingCustomer ? ADD_CUSTOMER : customer}
              onChange={(e) => handleCustomerChange(e.target.value)}
              required
            >
              {customers.length === 0 && <option value="">No customers yet</option>}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {/* Last, and set apart: it is an action, not another buyer. */}
              <option disabled>──────────</option>
              <option value={ADD_CUSTOMER}>+ Add a new customer…</option>
            </select>
            {/* Deleting follows the same owner-only gate as products and
                suppliers; the API refuses staff regardless. */}
            {isOwner && selected && !addingCustomer && (
              <DeleteCustomer customer={selected} onDeleted={handleCustomerDeleted} />
            )}
          </div>

          {addingCustomer && (
            <NewCustomerPanel
              // Nothing to go back to when this is the first customer.
              cancellable={customers.length > 0}
              onCreated={handleCustomerCreated}
              onCancel={() => setAddingCustomer(false)}
            />
          )}
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

        <div className="flex gap-2">
          <button type="submit" disabled={submitting || !selected} className={buttonPrimary}>
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
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const next = NEXT_STATUS[order.status]

  async function transition() {
    setBusy(true)
    try {
      await onTransition(order.id, next)
      toast.success(
        next === 'delivered'
          ? `Order #${order.id} delivered — invoice generated.`
          : `Order #${order.id} marked ${next}.`,
      )
    } catch (err) {
      toast.error(apiErrorMessage(err))
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
    </>
  )
}

export default function Orders() {
  const { user } = useAuth()
  const toast = useToast()
  const [orders, setOrders] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [failed, setFailed] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    return Promise.all([api.get('/orders/'), api.get('/customers/'), api.get('/products/')])
      .then(([ord, cust, prods]) => {
        setOrders(ord.data)
        setCustomers(cust.data)
        setProducts(prods.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load orders. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleTransition(orderId, status) {
    await api.patch(`/orders/${orderId}/`, { status })
    await load()
  }

  // Patch the list in place rather than reloading: a full `load()` would
  // rebuild the open order form and lose the items already picked.
  const addCustomer = useCallback((created) => {
    setCustomers((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  const removeCustomer = useCallback((id) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Orders">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className={buttonPrimary}>
            + New order
          </button>
        )}
      </PageHeader>

      {/* No `customers.length` gate: with none on file the form opens on its
          "add a customer" panel instead of refusing to appear at all. */}
      {showForm && products.length > 0 && (
        <NewOrderForm
          customers={customers}
          products={products}
          isOwner={user?.role === 'owner'}
          onCustomerAdded={addCustomer}
          onCustomerDeleted={removeCustomer}
          onCancel={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {failed && <LoadFailed what="orders" onRetry={load} />}
      {!failed && !orders && <Spinner />}
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
