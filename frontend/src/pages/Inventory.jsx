import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { notifyInventoryChanged } from '../api/inventoryEvents'
import {
  Badge,
  Card,
  ErrorAlert,
  PageHeader,
  Spinner,
  SuccessAlert,
  Td,
  Th,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '../components/ui'

const today = () => new Date().toISOString().slice(0, 10)

// Mirrors StockDisposal.Reason on the backend.
const DISPOSAL_REASONS = [
  ['expired', 'Expired'],
  ['spoiled', 'Spoiled'],
  ['damaged', 'Damaged'],
  ['other', 'Other'],
]

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-IN') : '—')

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

/** Write-off form for one expired batch. Quantity is capped at what's left. */
function DisposeForm({ batch, unit, onDone, onCancel }) {
  const [form, setForm] = useState({
    quantity: String(batch.quantity),
    reason: 'expired',
    notes: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const quantity = Number(form.quantity)
  const quantityValid =
    form.quantity !== '' && Number.isInteger(quantity) && quantity >= 1 && quantity <= batch.quantity

  async function handleSubmit(e) {
    e.preventDefault()
    // Client-side guard; services.dispose_batch re-checks under a row lock.
    if (!quantityValid) {
      setError(`Enter a whole number between 1 and ${batch.quantity}.`)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await api.post(`/stock-batches/${batch.id}/dispose/`, {
        quantity,
        reason: form.reason,
        notes: form.notes,
      })
      onDone(quantity)
    } catch (err) {
      setError(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-expired/25 bg-expired-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Quantity (max {batch.quantity})
          </label>
          <input
            type="number"
            min="1"
            max={batch.quantity}
            step="1"
            className={inputClass}
            value={form.quantity}
            onChange={set('quantity')}
            autoFocus
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Reason</label>
          <select className={inputClass} value={form.reason} onChange={set('reason')} required>
            {DISPOSAL_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-700">Notes (optional)</label>
          <input
            type="text"
            className={inputClass}
            value={form.notes}
            onChange={set('notes')}
            placeholder="e.g. curdled, returned by customer"
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !quantityValid}
          className={buttonDanger}
        >
          {submitting ? 'Disposing…' : `Confirm disposal${quantityValid ? ` of ${quantity} ${unit}` : ''}`}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className={buttonSecondary}>
          Cancel
        </button>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorAlert message={error} onDismiss={() => setError('')} />
        </div>
      )}
    </form>
  )
}

function ExpiredStock({ batches, unitFor, onDisposed }) {
  const [disposingId, setDisposingId] = useState(null)

  if (batches.length === 0) {
    return (
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-slate-800">Expired stock</h2>
        <p className="mt-1 text-sm text-slate-500">
          Nothing expired is holding stock — nothing to dispose of.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Expired stock
          <span className="ml-2 rounded-full bg-expired-soft px-2 py-0.5 text-xs font-medium text-expired-ink ring-1 ring-inset ring-expired/20">
            {batches.length} batch{batches.length === 1 ? '' : 'es'} pending disposal
          </span>
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Disposal writes the stock off and keeps the batch on record.
        </p>
      </div>
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Product</Th>
            <Th className="text-right">Remaining</Th>
            <Th>Expired on</Th>
            <Th>Received</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {batches.map((batch) => (
            <tr key={batch.id} className="align-top">
              <Td className="font-medium text-slate-800">
                {batch.product_name}
                <span className="ml-2 text-xs font-normal text-slate-400">#{batch.id}</span>
              </Td>
              <Td className="text-right tabular-nums">
                {batch.quantity} {unitFor(batch)}
              </Td>
              <Td>{formatDate(batch.expiry_date)}</Td>
              <Td>{formatDate(batch.received_date)}</Td>
              <Td>
                {disposingId === batch.id ? (
                  <span className="text-sm text-empty">Disposing…</span>
                ) : (
                  <button
                    onClick={() => setDisposingId(batch.id)}
                    className="rounded-lg border border-expired/30 bg-white px-3 py-1.5 text-xs font-medium text-expired-ink shadow-sm transition-colors hover:bg-expired-soft"
                  >
                    Dispose
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {disposingId && (
        <div className="border-t border-slate-200 p-4">
          {(() => {
            const batch = batches.find((b) => b.id === disposingId)
            if (!batch) return null
            return (
              <DisposeForm
                batch={batch}
                unit={unitFor(batch)}
                onCancel={() => setDisposingId(null)}
                onDone={(quantity) => {
                  setDisposingId(null)
                  onDisposed(batch, quantity)
                }}
              />
            )
          })()}
        </div>
      )}
    </Card>
  )
}

function DisposalHistory({ disposals, unitForProductName }) {
  if (disposals.length === 0) return null
  return (
    <Card className="overflow-x-auto">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-800">Disposal history</h2>
      </div>
      <table className="w-full">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <Th>Product</Th>
            <Th className="text-right">Quantity</Th>
            <Th>Reason</Th>
            <Th>Notes</Th>
            <Th>Disposed by</Th>
            <Th>When</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {disposals.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-800">{d.product_name}</Td>
              <Td className="text-right tabular-nums">
                {d.quantity} {unitForProductName(d.product_name)}
              </Td>
              <Td className="capitalize">{d.reason}</Td>
              <Td className="text-slate-500">{d.notes || '—'}</Td>
              <Td>{d.disposed_by_username}</Td>
              <Td>{formatDateTime(d.disposed_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export default function Inventory() {
  // The Dashboard's quick actions deep-link here with intent.
  const navState = useLocation().state
  const expiredRef = useRef(null)

  const [rows, setRows] = useState(null)
  const [products, setProducts] = useState([])
  const [batches, setBatches] = useState([])
  const [disposals, setDisposals] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(Boolean(navState?.openReceiveForm))

  const load = useCallback(() => {
    return Promise.all([
      api.get('/inventory/'),
      api.get('/products/'),
      api.get('/stock-batches/'),
      api.get('/stock-disposals/'),
    ])
      .then(([inv, prods, batch, disposed]) => {
        setRows(inv.data)
        setProducts(prods.data)
        setBatches(batch.data)
        setDisposals(disposed.data)
        setError('')
      })
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // "Dispose expired stock" from the Dashboard lands on the expired table.
  useEffect(() => {
    if (navState?.focusExpired && rows && expiredRef.current) {
      expiredRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [navState, rows])

  // A batch is disposable only while it is expired AND still holds stock.
  const expiredBatches = useMemo(
    () => batches.filter((b) => b.expiry_status === 'expired' && b.quantity > 0),
    [batches],
  )

  const unitById = useMemo(
    () => new Map(products.map((p) => [p.id, p.unit])),
    [products],
  )
  const unitByName = useMemo(
    () => new Map(products.map((p) => [p.name, p.unit])),
    [products],
  )
  const unitFor = (batch) => unitById.get(batch.product) ?? ''
  const unitForProductName = (name) => unitByName.get(name) ?? ''

  async function handleDisposed(batch, quantity) {
    setSuccess(
      `Disposed ${quantity} ${unitFor(batch)} of ${batch.product_name} (batch #${batch.id}).`,
    )
    await load()
    // Keeps the Dashboard's 3D shelf in step with the new stock levels.
    notifyInventoryChanged()
  }

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
            load().then(notifyInventoryChanged)
          }}
        />
      )}

      {error && <ErrorAlert message={error} />}
      <SuccessAlert message={success} onDismiss={() => setSuccess('')} />
      {!error && !rows && <Spinner />}
      {rows && (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <Th>Product</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Available</Th>
                  <Th className="text-right">Expired</Th>
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
                    <Td className="text-right tabular-nums">
                      {row.expired_quantity > 0 ? (
                        <span className="font-medium text-expired">
                          {row.expired_quantity} {row.unit}
                        </span>
                      ) : (
                        <span className="text-empty">—</span>
                      )}
                    </Td>
                    <Td>
                      <Badge value={row.worst_status} />
                    </Td>
                    <Td className="tabular-nums">
                      <span className="font-medium text-fresh">{row.batch_counts.fresh}</span>
                      {' / '}
                      <span className="font-medium text-ageing">{row.batch_counts.ageing}</span>
                      {' / '}
                      <span className="font-medium text-expired">{row.batch_counts.expired}</span>
                    </Td>
                    <Td>{row.nearest_expiry ?? '—'}</Td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <Td className="py-8 text-center text-empty" colSpan={7}>
                      No products yet.
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <div ref={expiredRef}>
            <ExpiredStock
              batches={expiredBatches}
              unitFor={unitFor}
              onDisposed={handleDisposed}
            />
          </div>

          <DisposalHistory disposals={disposals} unitForProductName={unitForProductName} />
        </>
      )}
    </div>
  )
}
