import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import {
  Badge,
  Card,
  ErrorAlert,
  PageHeader,
  Spinner,
  Td,
  Th,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

function ReceiveStockForm({ products, onDone, onCancel }) {
  const [form, setForm] = useState({
    product: products[0]?.id ?? '',
    quantity: '',
    purchase_price: '',
    expiry_date: '',
    received_date: today(),
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/stock-batches/', form)
      onDone()
    } catch (err) {
      setError(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Receive stock</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Product</label>
          <select className={inputClass} value={form.product} onChange={set('product')} required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={form.quantity}
            onChange={set('quantity')}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Purchase price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={form.purchase_price}
            onChange={set('purchase_price')}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Expiry date</label>
          <input
            type="date"
            className={inputClass}
            value={form.expiry_date}
            onChange={set('expiry_date')}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Received date</label>
          <input
            type="date"
            className={inputClass}
            value={form.received_date}
            onChange={set('received_date')}
            required
          />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" disabled={submitting} className={buttonPrimary}>
            {submitting ? 'Saving…' : 'Receive stock'}
          </button>
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        </div>
        {error && (
          <div className="sm:col-span-2 lg:col-span-5">
            <ErrorAlert message={error} onDismiss={() => setError('')} />
          </div>
        )}
      </form>
    </Card>
  )
}

export default function Inventory() {
  const [rows, setRows] = useState(null)
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(() => {
    return Promise.all([api.get('/inventory/'), api.get('/products/')])
      .then(([inv, prods]) => {
        setRows(inv.data)
        setProducts(prods.data)
        setError('')
      })
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory">
        {!showForm && (
          <button onClick={() => setShowForm(true)} className={buttonPrimary}>
            + Receive stock
          </button>
        )}
      </PageHeader>

      {showForm && products.length > 0 && (
        <ReceiveStockForm
          products={products}
          onCancel={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {error && <ErrorAlert message={error} />}
      {!error && !rows && <Spinner />}
      {rows && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="text-right">Available</Th>
                <Th>Status</Th>
                <Th>Batches (F / A / E)</Th>
                <Th>Nearest expiry</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{row.name}</Td>
                  <Td className="capitalize">{row.category}</Td>
                  <Td className="text-right tabular-nums">
                    {row.available_quantity} {row.unit}
                  </Td>
                  <Td>
                    <Badge value={row.worst_status} />
                  </Td>
                  <Td className="tabular-nums">
                    <span className="text-green-600">{row.batch_counts.fresh}</span>
                    {' / '}
                    <span className="text-amber-600">{row.batch_counts.ageing}</span>
                    {' / '}
                    <span className="text-red-600">{row.batch_counts.expired}</span>
                  </Td>
                  <Td>{row.nearest_expiry ?? '—'}</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td className="py-8 text-center text-slate-400" colSpan={6}>
                    No products yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
