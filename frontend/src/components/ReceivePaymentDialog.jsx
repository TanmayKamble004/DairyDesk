/**
 * Take money against one bill.
 *
 * Shared by the owner's Invoices page and the staff-facing Orders page, which
 * reach the same bill by different routes — hence the neutral `bill` prop and
 * the caller-supplied `url` rather than either page's own shape.
 *
 * The field is what was handed over, not what the bill's total should become:
 * a customer settling ₹500 of a ₹2,000 bill today and ₹300 next week types 500
 * and then 300. The API adds them up and re-derives the status, so nothing here
 * has to decide whether the bill is now partial or paid.
 */
import { useEffect, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import { formatINR, toPaise } from '../data/money'
import GlassModal from './GlassModal'
import { useToast } from './Toast'
import { buttonPrimary, buttonSecondary, inputClass } from './ui'

export default function ReceivePaymentDialog({
  /** { number, customerName, total, paid, due } — strings, as the API sends them. */
  bill,
  /** Where to POST the amount. The response is handed back untouched. */
  url,
  isOpen,
  onClose,
  onRecorded,
  returnFocusRef,
}) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const duePaise = toPaise(bill.due)

  // Reset as the dialog opens, not as it closes: the panel stays mounted
  // through its 180ms exit, and clearing on the way out would blank the field
  // in front of whoever just typed in it.
  useEffect(() => {
    if (isOpen) {
      setAmount('')
      setError('')
      setSaving(false)
    }
  }, [isOpen, url])

  async function submit(e) {
    e.preventDefault()
    const entered = amount.trim()
    const paise = toPaise(entered)
    // The same three refusals the API makes, said before the round trip. The
    // API still checks: another till could have taken money since this loaded.
    if (entered === '' || !Number.isFinite(Number(entered))) {
      setError('Enter the amount received.')
      return
    }
    if (paise <= 0) {
      setError('A payment has to be more than ₹0.')
      return
    }
    if (paise > duePaise) {
      setError(`That is more than is outstanding. ${formatINR(bill.due)} is left.`)
      return
    }

    setSaving(true)
    try {
      const res = await api.post(url, { amount: entered })
      // Said from what was typed rather than from the response, because the
      // two callers get back different shapes — an invoice and an order.
      toast.success(
        paise === duePaise
          ? `${formatINR(entered)} received — ${bill.number} is settled in full.`
          : `${formatINR(entered)} received against ${bill.number}. ` +
            `${formatINR((duePaise - paise) / 100)} still due.`,
      )
      onRecorded(res.data)
    } catch (err) {
      // Field errors come back under `amount`; anything else is a toast.
      const detail = err.response?.data?.amount
      if (detail) setError(Array.isArray(detail) ? detail.join(' ') : String(detail))
      else toast.error(apiErrorMessage(err))
      setSaving(false)
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Receive payment"
      subtitle={`${bill.number} · ${bill.customerName}`}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          <button
            type="submit"
            form="receive-payment"
            disabled={saving || duePaise <= 0}
            className={buttonPrimary}
          >
            {saving ? 'Recording…' : 'Record payment'}
          </button>
        </>
      }
    >
      <form id="receive-payment" onSubmit={submit} className="space-y-4">
        <dl className="rounded-xl border border-line bg-surface-muted px-4 py-3 text-sm">
          <div className="flex items-baseline justify-between py-1">
            <dt className="text-muted">Bill total</dt>
            <dd className="tabular-nums text-ink">{formatINR(bill.total)}</dd>
          </div>
          <div className="flex items-baseline justify-between py-1">
            <dt className="text-muted">Already paid</dt>
            <dd className="tabular-nums text-ink">{formatINR(bill.paid)}</dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
            <dt className="font-medium text-ink">Outstanding</dt>
            <dd className="text-base font-semibold tabular-nums text-ink">
              {formatINR(bill.due)}
            </dd>
          </div>
        </dl>

        <div>
          <label htmlFor="payment-amount" className="mb-1 block text-sm font-medium text-ink">
            Amount received
          </label>
          <div className="flex items-center gap-2">
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={bill.due}
              inputMode="decimal"
              placeholder="0.00"
              className={`${inputClass} max-w-[12rem]${error ? ' ring-1 ring-expired' : ''}`}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                setError('')
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'payment-amount-error' : undefined}
            />
            {/* Settling in full is the common case; typing the figure out
                again is just a chance to mistype it. */}
            <button
              type="button"
              onClick={() => {
                setAmount(String(bill.due))
                setError('')
              }}
              className={buttonSecondary}
            >
              Full {formatINR(bill.due)}
            </button>
          </div>
          {error ? (
            <p id="payment-amount-error" className="mt-1.5 text-xs font-medium text-expired-ink">
              {error}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted">
              Part payments are fine — the bill stays open for the balance.
            </p>
          )}
        </div>
      </form>
    </GlassModal>
  )
}
