import { useMemo, useState } from 'react'
import { useToast } from '../components/Toast'
import { Card, PageHeader, Td, Th, EmptyRow, buttonPrimary, buttonSecondary, inputClass } from '../components/ui'
import { MONEY_COLS, REPORT_TYPES, buildReport, inr } from '../data/storeMock'

const TYPES = Object.keys(REPORT_TYPES)

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

export default function Reports() {
  const toast = useToast()
  const [from, setFrom] = useState('2026-08-27')
  const [to, setTo] = useState('2026-09-02')
  const [type, setType] = useState('Stock Summary')
  const [filename, setFilename] = useState('inventory_report')
  const [generatedAt, setGeneratedAt] = useState(null)

  const cols = REPORT_TYPES[type]
  const rows = useMemo(() => buildReport(type, from, to), [type, from, to])
  const money = MONEY_COLS[type] ?? []

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
            disabled={rows.length === 0}
            className={buttonSecondary}
          >
            ⭳ Export CSV
          </button>
          <button
            onClick={() => {
              setGeneratedAt(new Date())
              toast.success(`${type} report generated — ${rows.length} row(s).`)
            }}
            className={buttonPrimary}
          >
            Generate Report
          </button>
        </div>
        <p className="w-full text-sm text-muted">Generate a view of your inventory and export it.</p>
      </PageHeader>

      <Card className="mb-6 p-5">
        <h2 className="text-lg font-semibold text-ink">Report settings</h2>
        <p className="text-sm text-muted">Pick a range and a report type, then generate.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              From date
            </label>
            <input id="from" type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              To date
            </label>
            <input id="to" type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
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
                      {money.includes(ci) ? inr(cell) : cell}
                    </Td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={cols.length}
                  title="Nothing in this range"
                  detail="Widen the date range or pick another report type."
                />
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
