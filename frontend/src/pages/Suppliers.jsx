import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import GlassModal from '../components/GlassModal'
import { useToast } from '../components/Toast'
import {
  AddMenu,
  Card,
  LoadFailed,
  PageHeader,
  Spinner,
  buttonPrimary,
  buttonSecondary,
} from '../components/ui'
import { fmtDate } from '../data/storeMock'
import { SupplierFormBody } from './SupplierForm'

// Ties the dialog's pinned submit button to the form inside its scrolling
// body: they sit in different parts of the panel, so the button reaches the
// form by id rather than by being inside it.
const CREATE_FORM_ID = 'create-supplier-form'

// Fixed palette indexed by supplier id, so an avatar keeps its colour.
const AVATAR_COLORS = ['#1677d2', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

/** Rating bands mirror the store build: 4.5+ excellent, 4+ good, 3.5+ average. */
function ratingPill(r) {
  if (r >= 4.5) return { label: 'Excellent', cls: 'bg-fresh-soft text-fresh-ink', dot: 'bg-fresh' }
  if (r >= 4) return { label: 'Good', cls: 'bg-info-soft text-info-ink', dot: 'bg-brand' }
  if (r >= 3.5) return { label: 'Average', cls: 'bg-ageing-soft text-ageing-ink', dot: 'bg-ageing' }
  return { label: 'Poor', cls: 'bg-expired-soft text-expired-ink', dot: 'bg-expired' }
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  )
}

export default function Suppliers() {
  const toast = useToast()
  const [suppliers, setSuppliers] = useState(null)
  const [failed, setFailed] = useState(false)
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
    // The new vendor is not in `suppliers` — one refetch is what makes the
    // list true again.
    setReloads((n) => n + 1)
  }, [closeCreate])

  useEffect(() => {
    api
      .get('/suppliers/')
      .then((res) => {
        setSuppliers(res.data)
        setFailed(false)
      })
      .catch((err) => {
        // Toasts fade, so a failed load also leaves something on the page.
        setFailed(true)
        toast.error(`Could not load suppliers. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  return (
    <>
      <GlassModal
        isOpen={creating}
        onClose={closeCreate}
        title="New supplier"
        subtitle="Add a vendor this store buys stock from. Every field is required."
        returnFocusRef={addButtonRef}
        confirmClose={dirty}
        confirmMessage="This supplier has not been saved. Discard it?"
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
              {savingNew ? 'Saving…' : 'Create supplier'}
            </button>
          </>
        }
      >
        <SupplierFormBody
          formId={CREATE_FORM_ID}
          layout="modal"
          onSaved={handleCreated}
          onCancel={closeCreate}
          onBusyChange={setSavingNew}
          onDirtyChange={setDirty}
        />
      </GlassModal>

      <PageHeader title="Suppliers">
        <AddMenu
          label="Add"
          icon="🚚"
          title="Create supplier"
          description="Add a vendor with contact details and rating."
          triggerRef={addButtonRef}
          onSelect={() => setCreating(true)}
        />
        <p className="w-full text-sm text-muted">Vendors supplying stock to this store.</p>
      </PageHeader>

      {failed && <LoadFailed what="suppliers" onRetry={() => setReloads((n) => n + 1)} />}
      {!failed && !suppliers && <Spinner />}

      {suppliers?.length === 0 && (
        <Card className="p-10 text-center">
          <div className="text-2xl text-empty" aria-hidden="true">
            ∅
          </div>
          <div className="mt-1 text-sm font-medium text-muted">No suppliers yet</div>
          <div className="mt-0.5 text-xs text-muted">
            Use the + button to add your first vendor.
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {suppliers?.map((s) => {
          const rating = ratingPill(Number(s.rating))
          return (
            <Card key={s.id} className="flex flex-col p-5">
              <Link
                to={`/suppliers/${s.id}/edit`}
                className="flex items-center gap-3 hover:text-brand"
                title={`Edit ${s.name}`}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                  style={{ backgroundColor: AVATAR_COLORS[s.id % AVATAR_COLORS.length] }}
                  aria-hidden="true"
                >
                  {initials(s.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink underline-offset-4 hover:underline">
                    {s.name}
                  </div>
                  <div className="truncate text-sm text-muted">{s.contact_person}</div>
                </div>
              </Link>

              <dl className="mt-4 divide-y divide-line border-t border-line">
                <Row label="Phone">{s.phone}</Row>
                <Row label="Email">
                  <a href={`mailto:${s.email}`} className="text-brand hover:text-brand-hover">
                    {s.email}
                  </a>
                </Row>
                <Row label="Products supplied">{s.products_supplied}</Row>
                <Row label="Last order">{fmtDate(s.last_order_date)}</Row>
              </dl>

              <div className="mt-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${rating.cls}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${rating.dot}`} aria-hidden="true" />
                  {Number(s.rating).toFixed(1)} · {rating.label}
                </span>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}
