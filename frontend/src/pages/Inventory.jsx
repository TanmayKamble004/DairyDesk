import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
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
      <h2 className="mb-4 text-lg font-semibold text-ink">Receive stock</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Product</label>
          <select className={inputClass} value={form.product} onChange={set('product')} required>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Quantity</label>
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
          <label className="mb-1 block text-sm font-medium text-ink">Purchase price</label>
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
          <label className="mb-1 block text-sm font-medium text-ink">Expiry date</label>
          <input
            type="date"
            className={inputClass}
            value={form.expiry_date}
            onChange={set('expiry_date')}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Received date</label>
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
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="text-right">Available</Th>
                <Th>Status</Th>
                <Th>Batches (fresh / ageing / expired)</Th>
                <Th>Nearest expiry</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">{row.name}</Td>
                  <Td className="capitalize">{row.category}</Td>
                  <Td className="text-right tabular-nums">
                    {row.available_quantity} {row.unit}
                  </Td>
                  <Td>
                    <Badge value={row.worst_status} />
                  </Td>
                  {/* Counts are titled as well as coloured, so the split reads
                      without relying on the three hues. */}
                  <Td className="tabular-nums">
                    <span className="font-medium text-fresh-ink" title="Fresh batches">
                      {row.batch_counts.fresh}
                    </span>
                    <span className="text-muted">{' / '}</span>
                    <span className="font-medium text-ageing-ink" title="Ageing batches">
                      {row.batch_counts.ageing}
                    </span>
                    <span className="text-muted">{' / '}</span>
                    <span className="font-medium text-expired-ink" title="Expired batches">
                      {row.batch_counts.expired}
                    </span>
                  </Td>
                  <Td>{row.nearest_expiry ?? <span className="text-muted">—</span>}</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  title="No products yet"
                  detail="Receive stock to start tracking inventory."
                />
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
