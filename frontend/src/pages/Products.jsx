import { useMemo, useState } from 'react'
import { Card, PageHeader, Td, Th, EmptyRow, inputClass } from '../components/ui'
import { PRODUCTS, inr, num, statusOf } from '../data/storeMock'

const STATUS_STYLE = {
  'In Stock': 'bg-fresh-soft text-fresh-ink',
  'Low Stock': 'bg-ageing-soft text-ageing-ink',
  'Out of Stock': 'bg-expired-soft text-expired-ink',
}

const STATUS_DOT = {
  'In Stock': 'bg-fresh',
  'Low Stock': 'bg-ageing',
  'Out of Stock': 'bg-expired',
}

function StatusPill({ value }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[value]}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[value]}`} aria-hidden="true" />
      {value}
    </span>
  )
}

function StatCard({ label, value, unit, icon }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-info-soft text-info-ink">
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
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const categories = useMemo(
    () => [...new Set(PRODUCTS.map((p) => p.category))].sort(),
    [],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = PRODUCTS.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sort.key === 'value' ? a.quantity * a.unitPrice : a[sort.key]
      const bv = sort.key === 'value' ? b.quantity * b.unitPrice : b[sort.key]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }, [search, category, sort])

  const avgStock = PRODUCTS.length
    ? Math.round(PRODUCTS.reduce((s, p) => s + p.quantity, 0) / PRODUCTS.length)
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
      <PageHeader title="Products">
        <p className="w-full text-sm text-muted">
          Every SKU stocked in this store, with live quantity and value.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total SKUs" value={PRODUCTS.length} icon="📦" />
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
                <SortTh label="Quantity" sortKey="quantity" className="text-right" />
                <SortTh label="Unit price" sortKey="unitPrice" className="text-right" />
                <SortTh label="Total value" sortKey="value" className="text-right" />
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">{p.name}</Td>
                  <Td className="text-muted">{p.sku}</Td>
                  <Td>{p.category}</Td>
                  <Td className="text-right tabular-nums">{num(p.quantity)}</Td>
                  <Td className="text-right tabular-nums">{inr(p.unitPrice)}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {inr(p.quantity * p.unitPrice)}
                  </Td>
                  <Td>
                    <StatusPill value={statusOf(p)} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={7}
                  title="No products match"
                  detail="Try a different search term or category."
                />
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
