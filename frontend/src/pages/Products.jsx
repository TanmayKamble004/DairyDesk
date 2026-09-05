import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import GlassModal from '../components/GlassModal'
import { useToast } from '../components/Toast'
import {
  AddMenu,
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
import { inr, num } from '../data/storeMock'
import { ProductFormBody } from './ProductForm'

// Ties the dialog's pinned submit button to the form inside its scrolling
// body: they are in different parts of the panel, so the button reaches the
// form by id rather than by being inside it.
const CREATE_FORM_ID = 'create-product-form'

const STATUS_LABEL = {
  in_stock: 'In Stock',
  low_stock: 'Low Stock',
  out_of_stock: 'Out of Stock',
}

const STATUS_STYLE = {
  in_stock: 'bg-fresh-soft text-fresh-ink',
  low_stock: 'bg-ageing-soft text-ageing-ink',
  out_of_stock: 'bg-expired-soft text-expired-ink',
}

const STATUS_DOT = {
  in_stock: 'bg-fresh',
  low_stock: 'bg-ageing',
  out_of_stock: 'bg-expired',
}

function StatusPill({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[value]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[value]}`} aria-hidden="true" />
      {STATUS_LABEL[value]}
    </span>
  )
}

function StatCard({ label, value, unit, icon }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-info-ink">
        {icon}
      </div>
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </div>
    </Card>
  )
}

export default function Products() {
  const toast = useToast()
  const [products, setProducts] = useState(null)
  const [failed, setFailed] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [reloads, setReloads] = useState(0)
  const [creating, setCreating] = useState(false)
  // Mirrors the form's own saving flag, so the footer button outside it can
  // say "Saving…" and lock while the request is in flight.
  const [savingNew, setSavingNew] = useState(false)
  // Whether the form has anything in it worth warning about on a stray click.
  const [dirty, setDirty] = useState(false)
  const addButtonRef = useRef(null)

  // Cancel is explicit, so it closes without asking — unlike the overlay and
  // Escape, which route through the dialog's own confirm.
  const closeCreate = useCallback(() => {
    setCreating(false)
    setDirty(false)
  }, [])

  const handleCreated = useCallback(() => {
    closeCreate()
    // The new SKU is not in `products`, and the save may also have raised an
    // auto-reorder — one refetch is what makes the list true again.
    setReloads((n) => n + 1)
  }, [closeCreate])

  useEffect(() => {
    api
      .get('/products/')
      .then((res) => {
        setProducts(res.data)
        setFailed(false)
      })
      .catch((err) => {
        // Toasts fade, so a failed load also leaves something on the page —
        // otherwise the user is looking at an empty screen with no reason why.
        setFailed(true)
        toast.error(`Could not load products. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  // Stable identity while loading, so the memos below don't rerun each render.
  const list = useMemo(() => products ?? [], [products])

  const categories = useMemo(
    () => [...new Set(list.map((p) => p.category))].sort(),
    [list],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = list.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    const valueOf = (p) => {
      if (sort.key === 'value') return p.available_quantity * Number(p.selling_price)
      if (sort.key === 'selling_price') return Number(p.selling_price)
      // supplier_name is null on products that predate suppliers.
      return p[sort.key] ?? ''
    }
    return [...filtered].sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [list, search, category, sort])

  const avgStock = list.length
    ? Math.round(list.reduce((s, p) => s + p.available_quantity, 0) / list.length)
    : 0

  function toggleSort(key) {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))
  }

  const SortTh = ({ label, sortKey, className = '' }) => (
    <Th className={className}>
      <button
        onClick={() => toggleSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink"
      >
        {label}
        {sort.key === sortKey && (
          <span aria-hidden="true">{sort.dir === 'asc' ? '▲' : '▼'}</span>
        )}
      </button>
    </Th>
  )

  return (
    <>
      <GlassModal
        isOpen={creating}
        onClose={closeCreate}
        title="New product"
        subtitle="Add a SKU to the catalogue. Image and description are optional."
        returnFocusRef={addButtonRef}
        confirmClose={dirty}
        confirmMessage="This product has not been saved. Discard it?"
        footer={
          <>
            <button type="button" onClick={closeCreate} className={buttonSecondary}>
              Cancel
            </button>
            <button
              type="submit"
              form={CREATE_FORM_ID}
              disabled={savingNew}
              className={buttonPrimary}
            >
              {savingNew ? 'Saving…' : 'Create product'}
            </button>
          </>
        }
      >
        <ProductFormBody
          formId={CREATE_FORM_ID}
          layout="modal"
          onSaved={handleCreated}
          onCancel={closeCreate}
          onBusyChange={setSavingNew}
          onDirtyChange={setDirty}
        />
      </GlassModal>

      <PageHeader title="Products">
        <AddMenu
          label="Add"
          icon="📦"
          title="Create product"
          description="Add a new SKU with an image and reorder levels."
          triggerRef={addButtonRef}
          onSelect={() => setCreating(true)}
        />
        <p className="w-full text-sm text-muted">
          Every SKU stocked in this store, with live quantity and value.
        </p>
      </PageHeader>

      {failed && (
        <LoadFailed what="products" onRetry={() => setReloads((n) => n + 1)} />
      )}
      {!failed && !products && <Spinner />}

      {products && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total SKUs" value={list.length} icon="📦" />
            <StatCard label="Categories" value={categories.length} icon="📊" />
            <StatCard label="Avg. Stock Level" value={avgStock} unit="units" icon="✓" />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap gap-3 border-b border-line p-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or SKU…"
                aria-label="Search products"
                className={`${inputClass} flex-1 sm:min-w-64`}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
                className={`${inputClass} sm:w-48`}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-muted">
                  <tr>
                    <SortTh label="Product name" sortKey="name" />
                    <SortTh label="SKU" sortKey="sku" />
                    <SortTh label="Category" sortKey="category" />
                    <SortTh label="Supplier" sortKey="supplier_name" />
                    <SortTh label="Quantity" sortKey="available_quantity" className="text-right" />
                    <SortTh label="Reorder at" sortKey="reorder_threshold" className="text-right" />
                    <SortTh label="Unit price" sortKey="selling_price" className="text-right" />
                    <SortTh label="Total value" sortKey="value" className="text-right" />
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-muted">
                      <Td className="font-medium text-ink">
                        <Link
                          to={`/products/${p.id}/edit`}
                          className="flex items-center gap-3 hover:text-brand"
                          title={`Edit ${p.name}`}
                        >
                          {p.image ? (
                            <img
                              src={p.image}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-xl border border-line object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-muted text-xs text-empty"
                              aria-hidden="true"
                            >
                              ▢
                            </span>
                          )}
                          <span className="underline-offset-4 hover:underline">{p.name}</span>
                        </Link>
                      </Td>
                      <Td className="text-muted">{p.sku}</Td>
                      <Td>{p.category}</Td>
                      <Td>
                        {p.supplier_name ?? <span className="text-muted">Unassigned</span>}
                      </Td>
                      <Td className="text-right tabular-nums">{num(p.available_quantity)}</Td>
                      <Td className="text-right tabular-nums text-muted">
                        {num(p.reorder_threshold)}
                      </Td>
                      <Td className="text-right tabular-nums">{inr(p.selling_price)}</Td>
                      <Td className="text-right font-medium tabular-nums">
                        {inr(p.available_quantity * Number(p.selling_price))}
                      </Td>
                      <Td>
                        <StatusPill value={p.stock_status} />
                      </Td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <EmptyRow
                      colSpan={9}
                      title={list.length ? 'No products match' : 'No products yet'}
                      detail={
                        list.length
                          ? 'Try a different search term or category.'
                          : 'Use the + button to add your first SKU.'
                      }
                    />
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
