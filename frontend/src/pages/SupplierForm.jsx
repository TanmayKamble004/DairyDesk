import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import {
  Card,
  PageHeader,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '../components/ui'

const EMPTY = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  products_supplied: '',
  last_order_date: '',
  rating: '',
}

// Every field is mandatory. Labels match the ones on screen, so an error names
// the field the way the user sees it.
const FIELD_LABELS = {
  name: 'Supplier name',
  contact_person: 'Contact person',
  phone: 'Phone',
  email: 'Email',
  products_supplied: 'Products supplied',
  last_order_date: 'Last order date',
  rating: 'Rating',
}

const labelClass = 'mb-1 block text-sm font-medium text-ink'
const hintClass = 'mt-1 text-xs text-muted'

/** Red halo on an invalid field — a ring, not a border, so it cannot lose to
 *  `border-line` on stylesheet order. */
const fieldClass = (error) => `${inputClass}${error ? ' ring-1 ring-expired' : ''}`

function validate(form) {
  const errors = {}

  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    if (String(form[field]).trim() === '') {
      errors[field] = `${label} is required.`
    }
  }

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address, like orders@supplier.in.'
  }

  if (!errors.phone && form.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a full phone number.'
  }

  if (!errors.products_supplied) {
    const count = Number(form.products_supplied)
    if (!Number.isInteger(count) || count < 0) {
      errors.products_supplied = 'Products supplied must be a whole number, 0 or more.'
    }
  }

  if (!errors.rating) {
    const rating = Number(form.rating)
    if (!(rating >= 0 && rating <= 5)) {
      errors.rating = 'Rating must be between 0.0 and 5.0.'
    }
  }

  if (!errors.last_order_date && form.last_order_date > new Date().toISOString().slice(0, 10)) {
    // Mirrors the server's rule, so it is caught before the round trip.
    errors.last_order_date = 'The last order cannot be in the future.'
  }

  return errors
}

function Field({ name, label, hint, error, children }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs font-medium text-expired-ink">
          {error}
        </p>
      ) : (
        hint && <p className={hintClass}>{hint}</p>
      )}
    </div>
  )
}

/** Two-step delete, so an irreversible action is never one stray click away. */
function DeleteSupplier({ name, busy, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="rounded-lg border border-expired/40 bg-expired-soft px-4 py-2 text-sm font-medium text-expired-ink hover:bg-expired-soft/70 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
      >
        Delete supplier
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
      <span className="text-sm text-ink">Delete “{name}” permanently?</span>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg bg-expired px-4 py-2 text-sm font-medium text-white hover:bg-expired/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className={buttonSecondary}
      >
        Keep it
      </button>
    </div>
  )
}

export default function SupplierForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(id)
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [loaded, setLoaded] = useState(!isEdit)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    api
      .get(`/suppliers/${id}/`)
      .then((res) => {
        const s = res.data
        setForm({
          name: s.name,
          contact_person: s.contact_person,
          phone: s.phone,
          email: s.email,
          products_supplied: String(s.products_supplied),
          last_order_date: s.last_order_date,
          rating: s.rating,
        })
        setLoaded(true)
      })
      .catch((err) => {
        toast.error(`Could not load this supplier. ${apiErrorMessage(err)}`)
        setLoaded(true)
      })
    // `toast` is stable for the provider's lifetime; listing it would only
    // re-run the fetch on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit])

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear this field's complaint as soon as it is being addressed; the rest
    // stay until the next submit, so the summary keeps matching the form.
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const { [field]: _cleared, ...rest } = prev
      return rest
    })
  }

  function showErrors(errors, summary) {
    setFieldErrors(errors)
    toast.error(summary)
    const first = Object.keys(errors)[0]
    formRef.current?.querySelector(`[name="${first}"]`)?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = validate(form)
    const missing = Object.keys(errors).length
    if (missing) {
      showErrors(
        errors,
        missing === 1
          ? 'One field still needs filling in — see below.'
          : `${missing} fields still need filling in — see below.`,
      )
      return
    }

    setFieldErrors({})
    setSaving(true)

    const payload = Object.fromEntries(
      Object.entries(form).map(([field, value]) => [field, value.trim()]),
    )

    try {
      // PUT, not PATCH: every field is on screen, so this is a full replacement.
      await (isEdit ? api.put(`/suppliers/${id}/`, payload) : api.post('/suppliers/', payload))
      toast.success(isEdit ? `“${form.name}” updated.` : `“${form.name}” added as a supplier.`)
      navigate('/suppliers')
    } catch (err) {
      // Land server-side complaints on the field itself, not only in the toast.
      const data = err.response?.data
      const fromServer = {}
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [field, messages] of Object.entries(data)) {
          if (field in FIELD_LABELS) {
            fromServer[field] = Array.isArray(messages) ? messages.join(' ') : String(messages)
          }
        }
      }
      showErrors(fromServer, apiErrorMessage(err))
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const deleted = form.name
    try {
      await api.delete(`/suppliers/${id}/`)
      toast.success(`“${deleted}” deleted.`)
      navigate('/suppliers')
    } catch (err) {
      // Refusals are expected here — a supplier with products is kept.
      toast.error(apiErrorMessage(err))
      setDeleting(false)
    }
  }

  const describedBy = (field) => (fieldErrors[field] ? `${field}-error` : undefined)

  return (
    // noValidate: the browser's own bubbles show one field at a time and vanish
    // on the next click, so the form reports every problem at once instead.
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      <PageHeader title={isEdit ? 'Edit supplier' : 'New supplier'}>
        <p className="w-full text-sm text-muted">
          {isEdit
            ? 'Change any field and save. Every field is required.'
            : 'Add a vendor this store buys stock from. Every field is required.'}
        </p>
      </PageHeader>

      {!loaded && <Spinner label="Loading supplier…" />}

      <Card className={`max-w-3xl p-5 ${loaded ? '' : 'hidden'}`}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field name="name" label="Supplier name" error={fieldErrors.name}>
            <input
              id="name"
              name="name"
              className={fieldClass(fieldErrors.name)}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Sunrise Dairy Co."
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={describedBy('name')}
            />
          </Field>

          <Field
            name="contact_person"
            label="Contact person"
            error={fieldErrors.contact_person}
          >
            <input
              id="contact_person"
              name="contact_person"
              className={fieldClass(fieldErrors.contact_person)}
              value={form.contact_person}
              onChange={(e) => set('contact_person', e.target.value)}
              placeholder="Meera Kulkarni"
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.contact_person)}
              aria-describedby={describedBy('contact_person')}
            />
          </Field>

          <Field name="phone" label="Phone" error={fieldErrors.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              className={fieldClass(fieldErrors.phone)}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+91 98220 41220"
              maxLength={20}
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={describedBy('phone')}
            />
          </Field>

          <Field name="email" label="Email" error={fieldErrors.email}>
            <input
              id="email"
              name="email"
              type="email"
              className={fieldClass(fieldErrors.email)}
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="orders@sunrisedairy.in"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={describedBy('email')}
            />
          </Field>

          <Field
            name="products_supplied"
            label="Products supplied"
            hint="How many SKUs this vendor supplies."
            error={fieldErrors.products_supplied}
          >
            <input
              id="products_supplied"
              name="products_supplied"
              type="number"
              min="0"
              step="1"
              className={fieldClass(fieldErrors.products_supplied)}
              value={form.products_supplied}
              onChange={(e) => set('products_supplied', e.target.value)}
              placeholder="3"
              aria-invalid={Boolean(fieldErrors.products_supplied)}
              aria-describedby={describedBy('products_supplied')}
            />
          </Field>

          <Field
            name="last_order_date"
            label="Last order date"
            error={fieldErrors.last_order_date}
          >
            <input
              id="last_order_date"
              name="last_order_date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className={fieldClass(fieldErrors.last_order_date)}
              value={form.last_order_date}
              onChange={(e) => set('last_order_date', e.target.value)}
              aria-invalid={Boolean(fieldErrors.last_order_date)}
              aria-describedby={describedBy('last_order_date')}
            />
          </Field>

          <Field
            name="rating"
            label="Rating"
            hint="0.0 to 5.0. 4.5+ reads as Excellent, under 3.5 as Poor."
            error={fieldErrors.rating}
          >
            <input
              id="rating"
              name="rating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              className={fieldClass(fieldErrors.rating)}
              value={form.rating}
              onChange={(e) => set('rating', e.target.value)}
              placeholder="4.8"
              aria-invalid={Boolean(fieldErrors.rating)}
              aria-describedby={describedBy('rating')}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <button type="submit" disabled={saving || deleting} className={buttonPrimary}>
            {saving ? 'Saving…' : isEdit ? 'Update supplier' : 'Create supplier'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            disabled={saving || deleting}
            className={buttonSecondary}
          >
            Cancel
          </button>
          {/* Owner-only, matching products and this app's other destructive surfaces. */}
          {isEdit && user?.role === 'owner' && (
            <DeleteSupplier
              name={form.name}
              busy={saving || deleting}
              onDelete={handleDelete}
            />
          )}
        </div>
      </Card>
    </form>
  )
}
