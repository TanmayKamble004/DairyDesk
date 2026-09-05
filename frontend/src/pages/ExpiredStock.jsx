import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiErrorMessage } from '../api/client'
import GlassModal from '../components/GlassModal'
import StockStatusPage from '../components/StockStatusPage'
import { useToast } from '../components/Toast'
import {
  Card,
  EmptyRow,
  InfoNote,
  LoadFailed,
  Spinner,
  Td,
  Th,
  buttonSecondary,
  inputClass,
} from '../components/ui'
import {
  expiryPhrase,
  formatDate,
  formatDateTime,
} from '../data/expiryStatus'

/**
 * Behind the Expired stack on the 3D shelf: stock that is past its date, and
 * the one thing anyone can do about it — write it off.
 *
 * Disposal is open to staff as well as the owner, unlike the rest of this app's
 * irreversible-looking actions. Whoever clears the shelf is who records it, and
 * making them fetch the owner first is how write-offs end up never recorded at
 * all. It is also not destructive in the way the owner gate protects against:
 * the batch, its dates and its cost all stay, the quantity goes to zero, and
 * the record is signed. The API enforces the same rule and the same limit —
 * expired stock only (see StockBatchViewSet.dispose).
 */

// Recent write-offs are context for the table above, not an archive. The full
// history lives in the batch records; this is "did someone already deal with
// this?", which the last handful answers.
const RECENT_DISPOSALS = 8

function DisposeDialog({ batch, isOpen, onClose, onDone, returnFocusRef }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Cleared as the dialog opens rather than as it closes: the panel stays
  // mounted through its exit animation, and wiping the field on the way out
  // would blank the note in front of whoever just typed it.
  useEffect(() => {
    if (isOpen) {
      setNote('')
      setSubmitting(false)
    }
  }, [isOpen, batch.id])

  async function dispose() {
    setSubmitting(true)
    try {
      await api.post(`/stock-batches/${batch.id}/dispose/`, { note: note.trim() })
      toast.success(
        `Disposed of ${batch.quantity} ${batch.product_unit} of ${batch.product_name}.`,
      )
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispose of this batch?"
      subtitle={`${batch.quantity} ${batch.product_unit} of ${batch.product_name}, expired ${expiryPhrase(
        batch.expiry_date,
      )}.`}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Cancel
          </button>
          {/* Coral rather than the brand blue: this is the one button on the
              page that writes stock off, and it should not look like Save. */}
          <button
            type="button"
            onClick={dispose}
            disabled={submitting}
            className="rounded-xl bg-expired px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-coral-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Disposing…' : 'Dispose of it'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          The batch stays on record with your name and today's date against it, and its{' '}
          {batch.quantity} {batch.product_unit} come off the shelf. This cannot be undone
          from here.
        </p>
        <div>
          <label htmlFor="disposal-note" className="mb-1 block text-sm font-medium text-ink">
            Note <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="disposal-note"
            type="text"
            maxLength={200}
            className={inputClass}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Curdled — returned by customer"
          />
          <p className="mt-1.5 text-xs text-muted">
            The dates already say it expired. Use this for anything they don't.
          </p>
        </div>
      </div>
    </GlassModal>
  )
}

function DisposedTable({ rows }) {
  return (
    <Card className="overflow-x-auto">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold tracking-tight text-ink">
          Recently disposed
        </h2>
        <p className="mt-1 text-xs text-muted">
          The last {Math.min(rows.length, RECENT_DISPOSALS)} write-offs, newest first.
        </p>
      </div>
      <table className="w-full">
        <thead className="border-b border-line bg-surface-muted">
          <tr>
            <Th>Product</Th>
            <Th className="text-right">Written off</Th>
            <Th>Expired</Th>
            <Th>Disposed</Th>
            <Th>By</Th>
            <Th>Note</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.slice(0, RECENT_DISPOSALS).map((row) => (
            <tr key={row.id} className="hover:bg-surface-muted">
              <Td className="font-medium text-ink">{row.product_name}</Td>
              <Td className="text-right tabular-nums">
                {row.disposed_quantity} {row.product_unit}
              </Td>
              <Td className="whitespace-nowrap">{formatDate(row.expiry_date)}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(row.disposed_at)}</Td>
              {/* Null once the account is gone — the write-off outlives the
                  person, and saying so beats an empty cell. */}
              <Td>{row.disposed_by_name ?? <span className="text-muted">Account removed</span>}</Td>
              <Td className="max-w-[16rem] truncate text-muted" title={row.disposal_note}>
                {row.disposal_note || '—'}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

export default function ExpiredStock() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [disposed, setDisposed] = useState([])
  const [failed, setFailed] = useState(false)
  const [target, setTarget] = useState(null)
  // Focus has to return to the row's own button, which is the element that
  // unmounts the moment the disposal succeeds — hence a ref, not the dialog's
  // default "whatever was focused when it opened".
  const triggerRef = useRef(null)
  // The batch the dialog is showing, held past the point `target` is cleared:
  // the panel animates out over 180ms and needs something to render until it
  // has. Without this the dialog blanks its own title as it closes.
  const shown = useRef(null)
  if (target) shown.current = target

  const load = useCallback(() => {
    return Promise.all([
      api.get('/stock-batches/', { params: { status: 'expired', disposed: 'false' } }),
      api.get('/stock-batches/', { params: { disposed: 'true' } }),
    ])
      .then(([outstanding, history]) => {
        setRows(
          // Longest expired first: the oldest thing on the shelf is the one
          // that should have gone in the bin first.
          [...outstanding.data].sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)),
        )
        setDisposed(
          [...history.data].sort((a, b) => b.disposed_at.localeCompare(a.disposed_at)),
        )
        setFailed(false)
      })
      .catch((err) => {
        setFailed(true)
        toast.error(`Could not load expired stock. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <StockStatusPage status="expired" rows={rows}>
      <InfoNote>
        Expired stock cannot be sold. Anyone signed in — owner or staff — can
        dispose of a batch here; the write-off is recorded against their name and
        the batch stays on the books.
      </InfoNote>

      {failed && <LoadFailed what="expired stock" onRetry={load} />}
      {!failed && !rows && <Spinner />}

      {!failed && rows && (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-muted">
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="text-right">Quantity</Th>
                <Th>Received</Th>
                <Th>Expired</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">{row.product_name}</Td>
                  <Td className="capitalize">{row.product_category}</Td>
                  <Td className="text-right tabular-nums">
                    {row.quantity} {row.product_unit}
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(row.received_date)}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(row.expiry_date)}
                    <span className="ml-1.5 text-xs font-medium text-coral-ink">
                      {expiryPhrase(row.expiry_date)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        triggerRef.current = e.currentTarget
                        setTarget(row)
                      }}
                      className="rounded-xl border border-coral/50 bg-coral-soft px-3 py-1.5 text-sm font-semibold text-coral-ink transition-colors hover:bg-expired hover:text-white"
                    >
                      Dispose
                    </button>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <EmptyRow
                  colSpan={6}
                  title="Nothing expired"
                  detail="Every batch on the shelf is still within its date."
                />
              )}
            </tbody>
          </table>
        </Card>
      )}

      {!failed && disposed.length > 0 && <DisposedTable rows={disposed} />}

      {shown.current && (
        <DisposeDialog
          batch={shown.current}
          isOpen={target !== null}
          returnFocusRef={triggerRef}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null)
            load()
          }}
        />
      )}
    </StockStatusPage>
  )
}
