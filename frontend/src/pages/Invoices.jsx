import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import ReceivePaymentDialog from '../components/ReceivePaymentDialog'
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
  buttonSecondary,
} from '../components/ui'
import { formatINR, toPaise } from '../data/money'
import { fmtDateTime } from '../data/storeMock'

const TABS = [
  { id: 'bills', label: 'Bills' },
  { id: 'payments', label: 'Payments' },
]

const tileLabelClass = 'text-[11px] font-semibold uppercase tracking-wider'

/**
 * The two views of the same set of bills: the ledger, and the money still to
 * collect. Roving tabindex with arrow keys â€” one Tab stop for the strip, as a
 * tablist is a single control and not five.
 */
function Tabs({ value, onChange }) {
  function onKeyDown(e) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = TABS[(TABS.findIndex((t) => t.id === value) + step + TABS.length) % TABS.length]
    onChange(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Invoice views"
      onKeyDown={onKeyDown}
      className="inline-flex gap-1 rounded-xl border border-line bg-surface-muted p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              selected
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/** One figure in the grand-total row. `tone` tints the value, not the card. */
function TotalTile({ label, amount, note, tone = 'text-ink' }) {
  return (
    <Card className="p-5">
      <span className={`${tileLabelClass} text-muted`}>{label}</span>
      <div className={`mt-3 text-[30px] font-bold leading-none tabular-nums ${tone}`}>
        {formatINR(amount)}
      </div>
      <div className="mt-2.5 text-xs font-medium text-muted">{note}</div>
    </Card>
  )
}

/** The ledger: every bill raised, newest first, whatever its state. */
function BillsTable({ invoices, highlightOrder }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line bg-surface-muted">
          <tr>
            {/* The bill number replaces the row id as the identifier on
                screen: it is what the customer quotes back. */}
            <Th>Bill no.</Th>
            <Th>Issued</Th>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">Paid</Th>
            <Th className="text-right">Due</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {invoices.map((inv) => {
            const due = toPaise(inv.amount_due) > 0
            return (
              <tr
                key={inv.id}
                className={
                  inv.order === highlightOrder
                    ? 'bg-info-soft text-info-ink'
                    : 'hover:bg-surface-muted'
                }
              >
                <Td className="font-medium tabular-nums text-ink">{inv.number}</Td>
                <Td className="text-muted" title={inv.created_at}>
                  {fmtDateTime(inv.created_at)}
                </Td>
                <Td>Order #{inv.order}</Td>
                <Td>{inv.customer_name}</Td>
                <Td className="text-right tabular-nums">{formatINR(inv.total_amount)}</Td>
                <Td className="text-right tabular-nums">{formatINR(inv.paid_amount)}</Td>
                {/* Nothing owed reads as a dash, not as â‚¹0.00 â€” a settled bill
                    should not look like a row with a figure in it. */}
                <Td
                  className={`text-right tabular-nums ${
                    due ? 'font-semibold text-coral-ink' : 'text-muted'
                  }`}
                >
                  {due ? formatINR(inv.amount_due) : 'â€”'}
                </Td>
                <Td>
                  <Badge value={inv.status} />
                </Td>
              </tr>
            )
          })}
          {invoices.length === 0 && (
            <EmptyRow
              colSpan={8}
              title="No invoices yet"
              detail="Deliver an order to generate one."
            />
          )}
        </tbody>
      </table>
    </Card>
  )
}

/**
 * The collection side: what the shop has billed, what it has been paid, and
 * the bills that account for the difference.
 */
function PaymentsPanel({ invoices, onReceive }) {
  const totals = useMemo(() => {
    let billed = 0
    let received = 0
    for (const inv of invoices) {
      billed += toPaise(inv.total_amount)
      received += toPaise(inv.paid_amount)
    }
    return { billed, received, outstanding: billed - received }
  }, [invoices])

  // Oldest first â€” the debt that has been waiting longest is the one to chase,
  // which is the opposite of the ledger's newest-first reading order.
  const owing = useMemo(
    () =>
      invoices
        .filter((inv) => toPaise(inv.amount_due) > 0)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [invoices],
  )

  const collectedPct = totals.billed > 0 ? (totals.received / totals.billed) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TotalTile
          label="Grand total"
          amount={totals.billed / 100}
          note={`${invoices.length} ${invoices.length === 1 ? 'bill' : 'bills'} raised`}
        />
        <TotalTile
          label="Received"
          amount={totals.received / 100}
          note={`${collectedPct.toFixed(collectedPct % 1 === 0 ? 0 : 1)}% of the grand total`}
          tone="text-fresh-ink"
        />
        <TotalTile
          label="Outstanding"
          amount={totals.outstanding / 100}
          note={
            owing.length === 0
              ? 'Every bill is settled'
              : `Across ${owing.length} ${owing.length === 1 ? 'bill' : 'bills'}`
          }
          tone={totals.outstanding > 0 ? 'text-coral-ink' : 'text-ink'}
        />
      </div>

      {invoices.length > 0 && (
        <Card className="p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className={`${tileLabelClass} text-muted`}>Collected</span>
            <span className="text-sm font-semibold tabular-nums text-ink">
              {formatINR(totals.received / 100)} of {formatINR(totals.billed / 100)}
            </span>
          </div>
          {/* Decorative: the two figures above it already say this in words. */}
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-soft"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-fresh transition-[width] duration-500"
              style={{ width: `${Math.min(collectedPct, 100)}%` }}
            />
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">Awaiting payment</h2>
          <p className="mt-1 text-xs text-muted">
            Longest outstanding first. Record what the customer hands over â€” in full or in
            part.
          </p>
        </div>
        <table className="w-full">
          <thead className="border-b border-line bg-surface-muted">
            <tr>
              <Th>Bill no.</Th>
              <Th>Issued</Th>
              <Th>Customer</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Paid</Th>
              <Th className="text-right">Due</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {owing.map((inv) => (
              <tr key={inv.id} className="hover:bg-surface-muted">
                <Td className="font-medium tabular-nums text-ink">{inv.number}</Td>
                <Td className="text-muted" title={inv.created_at}>
                  {fmtDateTime(inv.created_at)}
                </Td>
                <Td>{inv.customer_name}</Td>
                <Td className="text-right tabular-nums">{formatINR(inv.total_amount)}</Td>
                <Td className="text-right tabular-nums">{formatINR(inv.paid_amount)}</Td>
                <Td className="text-right font-semibold tabular-nums text-coral-ink">
                  {formatINR(inv.amount_due)}
                </Td>
                <Td>
                  <Badge value={inv.status} />
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={(e) => onReceive(inv, e.currentTarget)}
                    className={`${buttonSecondary} whitespace-nowrap text-xs`}
                  >
                    Receive payment
                  </button>
                </Td>
              </tr>
            ))}
            {owing.length === 0 && (
              <EmptyRow
                colSpan={8}
                title={invoices.length === 0 ? 'No invoices yet' : 'Nothing outstanding'}
                detail={
                  invoices.length === 0
                    ? 'Deliver an order to generate one.'
                    : 'Every bill raised has been paid in full.'
                }
              />
            )}
          </tbody>
          {owing.length > 1 && (
            <tfoot className="border-t border-line bg-surface-muted">
              <tr>
                <Td colSpan={5} className="font-medium text-ink">
                  Total outstanding
                </Td>
                <Td className="text-right text-base font-semibold tabular-nums text-coral-ink">
                  {formatINR(totals.outstanding / 100)}
                </Td>
                <Td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  )
}

export default function Invoices() {
  const toast = useToast()
  const [invoices, setInvoices] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)
  const [tab, setTab] = useState('bills')
  const [paying, setPaying] = useState(null)
  // Focus goes back to the row's own button, which is the element that
  // disappears the moment the bill is settled â€” hence a ref rather than the
  // dialog's "whatever was focused when it opened".
  const triggerRef = useRef(null)
  // The bill the dialog is showing, held past the point `paying` is cleared:
  // the panel animates out over 180ms and needs something to render until it
  // has. Without this the dialog blanks its own heading as it closes.
  const shown = useRef(null)
  if (paying) shown.current = paying

  useEffect(() => {
    api
      .get('/invoices/')
      .then((res) => {
        setInvoices(res.data)
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load invoices. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  // Set when navigating here from an order's "View invoice" link.
  const highlightOrder = useLocation().state?.highlightOrder

  const openPayment = useCallback((invoice, trigger) => {
    triggerRef.current = trigger
    setPaying(invoice)
  }, [])

  // Patch the one row in place rather than refetching: the API has just
  // returned the updated bill, and a reload would rebuild the whole table â€”
  // and with it lose the scroll position of whoever is working down the list.
  const applyPayment = useCallback((updated) => {
    setInvoices((prev) =>
      (prev ?? []).map((inv) => (inv.id === updated.id ? updated : inv)),
    )
    setPaying(null)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices">
        <Tabs value={tab} onChange={setTab} />
      </PageHeader>

      {failed && <LoadFailed what="invoices" onRetry={() => setReloads((n) => n + 1)} />}
      {!failed && !invoices && <Spinner />}

      {invoices && (
        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={-1}>
          {tab === 'bills' ? (
            <BillsTable invoices={invoices} highlightOrder={highlightOrder} />
          ) : (
            <PaymentsPanel invoices={invoices} onReceive={openPayment} />
          )}
        </div>
      )}

      {shown.current && (
        <ReceivePaymentDialog
          bill={{
            number: shown.current.number,
            customerName: shown.current.customer_name,
            total: shown.current.total_amount,
            paid: shown.current.paid_amount,
            due: shown.current.amount_due,
          }}
          url={`/invoices/${shown.current.id}/record-payment/`}
          isOpen={paying !== null}
          returnFocusRef={triggerRef}
          onClose={() => setPaying(null)}
          onRecorded={applyPayment}
        />
      )}
    </div>
  )
}
