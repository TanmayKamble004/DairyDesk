import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { useToast } from '../components/Toast'
import {
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
import { REPORTS, REPORT_TYPES, buildReport } from '../data/reports'
import { inr } from '../data/storeMock'

const TYPES = REPORT_TYPES

/** RFC 4180 quoting — a product name with a comma must not split the row. */
function toCsv(cols, rows) {
  const cell = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n')
}

function download(filename, text) {
  // BOM so Excel opens the ₹ column as UTF-8 rather than mojibake.
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** The last 30 days, which is the range a report is usually wanted for. */
const defaultRange = () => {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 30)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { from: iso(start), to: iso(today) }
}

export default function Reports() {
  const toast = useToast()
  const [range, setRange] = useState(defaultRange)
  const [type, setType] = useState('Stock Summary')
  const [filename, setFilename] = useState('inventory_report')
  const [generatedAt, setGeneratedAt] = useState(null)
  const [sources, setSources] = useState(null)
  const [failed, setFailed] = useState(false)

  const { from, to } = range
  const spec = REPORTS[type]
  const cols = spec.columns
  const money = spec.money ?? []

  /* Every report's source is fetched up front rather than per type, so switching
     the dropdown is instant and the CSV can never export a half-loaded page. */
  const load = useCallback(() => {
    return Promise.all([
      api.get('/products/'),
      api.get('/orders/'),
      api.get('/purchase-orders/'),
      api.get('/stock-batches/'),
    ])
      .then(([products, orders, purchaseOrders, batches]) => {
        setSources({
          products: products.data,
          orders: orders.data,
          purchaseOrders: purchaseOrders.data,
          batches: batches.data,
        })
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load report data. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () => (sources ? buildReport(type, sources, from, to) : []),
    [sources, type, from, to],
  )

  return (
    <>
      <PageHeader title="Reports">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              try {
                download(filename, toCsv(cols, rows))
                toast.success(`Exported ${rows.length} row(s) to ${filename}.csv.`)
              } catch {
                toast.error('Could not export the CSV. Check your browser download settings.')
              }
            }}
            disabled={!sources || rows.length === 0}
            className={buttonSecondary}
          >
            ⭳ Export CSV
          </button>
          <button
            onClick={() => {
              setGeneratedAt(new Date())
              toast.success(`${type} report generated — ${rows.length} row(s).`)
            }}
            disabled={!sources}
            className={buttonPrimary}
          >
            Generate Report
          </button>
        </div>
        <p className="w-full text-sm text-muted">Generate a view of your inventory and export it.</p>
      </PageHeader>

      <Card className="mb-6 p-5">
        <h2 className="text-lg font-semibold text-ink">Report settings</h2>
        <p className="text-sm text-muted">
          {spec.dated
            ? 'Pick a range and a report type, then generate.'
            : 'Stock Summary is a snapshot of stock on hand now, so the date range does not apply.'}
        </p>

        {/* The range is disabled rather than hidden on an undated report: the
            controls keep their place, and a disabled input says "not applicable
            here" where a silently ignored one would just look broken. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              From date
            </label>
            <input
              id="from"
              type="date"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              value={from}
              disabled={!spec.dated}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              To date
            </label>
            <input
              id="to"
              type="date"
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              value={to}
              disabled={!spec.dated}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="type" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Report type
            </label>
            <select id="type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filename" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              File name
            </label>
            <input
              id="filename"
              className={inputClass}
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {failed && <LoadFailed what="report data" onRetry={load} />}
      {!failed && !sources && <Spinner label="Loading report data…" />}

      {sources && (
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Preview</h2>
            <p className="text-sm text-muted">
              {rows.length} row{rows.length === 1 ? '' : 's'} · {type}
              {generatedAt && ` · generated ${generatedAt.toLocaleTimeString('en-IN')}`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fresh-soft px-2.5 py-0.5 text-xs font-medium text-fresh-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-fresh" aria-hidden="true" />
            Ready
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-muted">
              <tr>
                {cols.map((c, i) => (
                  <Th key={c} className={money.includes(i) ? 'text-right' : ''}>
                    {c}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, ri) => (
                <tr key={ri} className="hover:bg-surface-muted">
                  {r.map((cell, ci) => (
                    <Td
                      key={ci}
                      className={`${money.includes(ci) ? 'text-right tabular-nums' : ''} ${
                        ci === 0 ? 'font-medium text-ink' : ''
                      }`}
                    >
                      {/* A null money cell means the figure is not known —
                          an unreceived product has no cost to price against.
                          Shown as —, and left empty in the CSV, so it never
                          reads as a genuine ₹0. */}
                      {money.includes(ci)
                        ? cell === null
                          ? <span className="text-muted">—</span>
                          : inr(cell)
                        : cell}
                    </Td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={cols.length}
                  title={spec.dated ? 'Nothing in this range' : 'Nothing to report'}
                  detail={
                    spec.dated
                      ? 'Widen the date range or pick another report type.'
                      : 'Add a product and receive stock to see it here.'
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </>
  )
}
