import { useCallback, useEffect, useRef, useState } from 'react'
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

const UNITS = [
  { value: 'litre', label: 'Litre' },
  { value: 'kg', label: 'Kilogram' },
  { value: 'piece', label: 'Piece' },
]

const EMPTY = {
  name: '',
  sku: '',
  category: '',
  supplier: '',
  unit: 'litre',
  selling_price: '',
  reorder_quantity: '',
  reorder_threshold: '',
  description: '',
  auto_reorder: false,
}

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

// Labels are the ones on screen, so an error names the field the way the user
// sees it. Every field here is also a key the server may complain about.
const FIELD_LABELS = {
  name: 'Product name',
  sku: 'SKU',
  category: 'Category',
  supplier: 'Supplier',
  unit: 'Unit',
  selling_price: 'Selling price',
  reorder_threshold: 'Reorder threshold',
  reorder_quantity: 'Reorder quantity',
  description: 'Description',
}

// Photo and description are the optional parts of a product.
const REQUIRED_FIELDS = Object.keys(FIELD_LABELS).filter((f) => f !== 'description')

const WHOLE_NUMBER_FIELDS = ['reorder_threshold', 'reorder_quantity']

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

// Sentinel <option> value — no real category can collide with it.
const ADD_CATEGORY = ' new'

const labelClass = 'mb-1 block text-sm font-medium text-ink'
const hintClass = 'mt-1 text-xs text-muted'

/** Red halo on an invalid field. A ring, not a border: `border-line` already
 *  sits on the input at the same specificity, so an appended `border-*` would
 *  win or lose on stylesheet order rather than class order. */
const fieldClass = (error) => `${inputClass}${error ? ' ring-1 ring-expired' : ''}`

/** Empty-and-format check for the whole form. Returns field -> message. */
function validate(form) {
  const errors = {}

  for (const field of REQUIRED_FIELDS) {
    if (String(form[field]).trim() === '') {
      errors[field] = `${FIELD_LABELS[field]} is required.`
    }
  }

  // A zero threshold is meaningful ("never flag this low"), so these are
  // checked for shape rather than for truthiness.
  for (const field of WHOLE_NUMBER_FIELDS) {
    if (errors[field]) continue
    const value = Number(form[field])
    if (!Number.isInteger(value) || value < 0) {
      errors[field] = `${FIELD_LABELS[field]} must be a whole number of units, 0 or more.`
    }
  }

  if (!errors.selling_price && !(Number(form.selling_price) > 0)) {
    errors.selling_price = 'Selling price must be more than ₹0.'
  }

  // Auto-reorder with nothing to order would place empty purchase orders.
  if (!errors.reorder_quantity && form.auto_reorder && Number(form.reorder_quantity) <= 0) {
    errors.reorder_quantity =
      'Auto submit needs a reorder quantity above 0 — otherwise there is nothing to order.'
  }

  if (
    !errors.reorder_quantity &&
    !errors.reorder_threshold &&
    Number(form.reorder_quantity) < Number(form.reorder_threshold)
  ) {
    // Mirrors the same rule on the server, so it is caught before the round trip.
    errors.reorder_quantity =
      'Reorder quantity should be at least the reorder threshold, or restocking leaves the product low.'
  }

  return errors
}

function FieldError({ id, message }) {
  return (
    <p id={id} className="mt-1 text-xs font-medium text-expired-ink">
      {message}
    </p>
  )
}

/**
 * Category picker: the categories already in the database, plus an inline
 * escape hatch for a new one. A new category is saved by saving the product —
 * there is no separate category record to create first.
 */
function CategoryField({
  value,
  options,
  adding,
  error,
  onChange,
  onStartAdding,
  onStopAdding,
}) {
  if (adding) {
    return (
      <div>
        <label className={labelClass} htmlFor="category">
          New category
        </label>
        <div className="flex gap-2">
          <input
            id="category"
            name="category"
            className={fieldClass(error)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Frozen"
            maxLength={100}
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'category-error' : undefined}
          />
          {options.length > 0 && (
            <button
              type="button"
              onClick={onStopAdding}
              className={`${buttonSecondary} shrink-0 px-3`}
              title="Pick an existing category instead"
            >
              ✕
            </button>
          )}
        </div>
        {error ? (
          <FieldError id="category-error" message={error} />
        ) : (
          <p className={hintClass}>Saved with the product.</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <label className={labelClass} htmlFor="category">
        Category
      </label>
      <select
        id="category"
        name="category"
        className={fieldClass(error)}
        value={value}
        onChange={(e) =>
          e.target.value === ADD_CATEGORY ? onStartAdding() : onChange(e.target.value)
        }
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'category-error' : undefined}
      >
        <option value="" disabled>
          Select a category…
        </option>
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={ADD_CATEGORY}>+ Add new category…</option>
      </select>
      {error ? (
        <FieldError id="category-error" message={error} />
      ) : (
        <p className={hintClass}>Existing categories, or add one.</p>
      )}
    </div>
  )
}

/**
 * One group of fields. On the page each group is its own card; in a dialog the
 * glass panel is already the surface, so they become plain bands separated by
 * a hairline instead of cards stacked inside a card.
 */
function FormSection({ inModal, className = '', children }) {
  if (inModal) {
    return (
      <section className="border-t border-modal-divider pt-5 first:border-t-0 first:pt-0">
        {children}
      </section>
    )
  }
  return <Card className={className}>{children}</Card>
}

function Field({ name, label, hint, error, children }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label}
      </label>
      {children}
      {error ? <FieldError id={`${name}-error`} message={error} /> : null}
      {!error && hint && <p className={hintClass}>{hint}</p>}
    </div>
  )
}

/**
 * Image picker. The file never leaves the browser until the form is submitted,
 * so "Remove" is a local reset — nothing to undo server-side.
 */
function ImagePicker({ previewUrl, caption, onPick, onClear, disabled, compact = false }) {
  const inputRef = useRef(null)
  // Beside the fields a square well is the right shape. Stacked under them in
  // a dialog it would be a screen of empty box between the last field and the
  // Create button, so there it becomes a band.
  const well = compact ? 'h-40 w-full' : 'aspect-square w-full'

  return (
    <div>
      <span className={labelClass}>Product image</span>

      <div
        className={`overflow-hidden rounded-xl border border-dashed border-line ${
          compact ? 'bg-white/45' : 'bg-surface-muted'
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected product"
            className={`${well} bg-surface object-contain`}
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className={`${well} flex flex-col items-center justify-center gap-2 px-4 text-center transition-colors hover:bg-neutral-soft disabled:cursor-not-allowed`}
          >
            <span className="text-3xl text-empty" aria-hidden="true">
              ⬆
            </span>
            <span className="text-sm font-medium text-ink">Upload an image</span>
            <span className="text-xs text-muted">PNG or JPG, up to 5 MB. Optional.</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files?.[0] ?? null)
          // Reset so re-picking the same file still fires a change event.
          e.target.value = ''
        }}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={`${buttonSecondary} text-xs`}
        >
          {previewUrl ? 'Replace image' : 'Choose image'}
        </button>
        {previewUrl && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="rounded-xl border border-expired/40 bg-expired-soft px-4 py-2 text-xs font-medium text-expired-ink hover:bg-expired-soft/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel image
          </button>
        )}
      </div>

      {caption && <p className={`${hintClass} truncate`}>{caption}</p>}
    </div>
  )
}

/** Small on/off switch. A real checkbox underneath, so it is keyboard- and
 *  screen-reader-operable; the visual is just the label's styling. */
function Toggle({ id, checked, onChange, label, disabled }) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 text-sm font-medium ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <input
        id={id}
        name={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full bg-empty transition-colors peer-checked:bg-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4"
      />
      <span className="text-ink">{label}</span>
    </label>
  )
}

/** Two-step delete, so an irreversible action is never one stray click away. */
function DeleteProduct({ name, busy, onDelete }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy}
        className="rounded-xl border border-expired/40 bg-expired-soft px-4 py-2 text-sm font-medium text-expired-ink hover:bg-expired-soft/70 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
      >
        Delete product
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
        className="rounded-xl bg-expired px-4 py-2 text-sm font-medium text-white hover:bg-expired/90 disabled:cursor-not-allowed disabled:opacity-50"
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

/**
 * The product form itself, with no opinion about where it is rendered. The
 * route below wraps it for the full page; a list page wraps it in a dialog and
 * passes `formId` so a submit button pinned outside the form can still drive
 * it. Fields, validation and both handlers are the same in either case — only
 * the chrome around them differs.
 */
export function ProductFormBody({
  productId,
  formId,
  layout = 'page',
  onSaved,
  onDeleted,
  onCancel,
  onBusyChange,
  onDirtyChange,
}) {
  const id = productId
  const { user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(id)
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [loaded, setLoaded] = useState(!isEdit)
  const [categories, setCategories] = useState([])
  const [addingCategory, setAddingCategory] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [image, setImage] = useState(null)
  const [objectUrl, setObjectUrl] = useState('')
  // The photo already on the product, until it is replaced or cleared.
  const [storedImage, setStoredImage] = useState('')
  // The product's outstanding auto-reorder, if it has one.
  const [openOrder, setOpenOrder] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // What the form looked like when it was last (re)initialised — EMPTY for a
  // new product, the fetched values for an existing one. Everything "unsaved
  // changes" means is measured against this.
  const baseline = useRef({ form: EMPTY, storedImage: '' })

  useEffect(() => {
    api
      .get('/products/categories/')
      .then((res) => {
        setCategories(res.data)
        // An empty catalogue has nothing to pick from, so open on the input.
        if (res.data.length === 0) setAddingCategory(true)
      })
      // A failed lookup must not block product entry — fall back to free text.
      .catch(() => setAddingCategory(true))
  }, [])

  useEffect(() => {
    api
      .get('/suppliers/')
      .then((res) => setSuppliers(res.data))
      .catch(() => setSuppliers([]))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    api
      .get(`/products/${id}/`)
      .then((res) => {
        const p = res.data
        const loadedForm = {
          name: p.name,
          sku: p.sku,
          category: p.category,
          // Products that predate suppliers come back null — the dropdown then
          // opens unset and has to be answered before this can be saved.
          supplier: p.supplier == null ? '' : String(p.supplier),
          unit: p.unit,
          selling_price: p.selling_price,
          reorder_quantity: String(p.reorder_quantity),
          reorder_threshold: String(p.reorder_threshold),
          description: p.description,
          auto_reorder: p.auto_reorder,
        }
        setForm(loadedForm)
        setStoredImage(p.image ?? '')
        setOpenOrder(p.open_purchase_order)
        setLoaded(true)
        baseline.current = { form: loadedForm, storedImage: p.image ?? '' }
      })
      .catch((err) => {
        toast.error(`Could not load this product. ${apiErrorMessage(err)}`)
        setLoaded(true)
      })
    // `toast` is stable for the provider's lifetime; listing it would only
    // re-run the fetch on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit])

  // The dialog's footer sits outside this component but has to grey out while
  // a save is in flight, so the flag is published rather than kept private.
  useEffect(() => {
    onBusyChange?.(saving || deleting)
  }, [saving, deleting, onBusyChange])

  // Likewise for "has anything been typed" — the dialog needs it to decide
  // whether a stray click on the overlay should ask before throwing the form
  // away. A form opened and left alone is not dirty and closes silently.
  useEffect(() => {
    const changed =
      Object.keys(form).some((field) => form[field] !== baseline.current.form[field]) ||
      Boolean(image) ||
      storedImage !== baseline.current.storedImage
    onDirtyChange?.(changed)
  }, [form, image, storedImage, onDirtyChange])

  // Object URLs are revoked on replace/unmount, or the blobs leak for the
  // lifetime of the tab.
  useEffect(() => {
    if (!image) {
      setObjectUrl('')
      return undefined
    }
    const url = URL.createObjectURL(image)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  // A freshly picked file wins; otherwise show whatever is stored.
  const previewUrl = objectUrl || storedImage

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

  function pickImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image. Choose a PNG or JPG.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('That image is larger than 5 MB. Choose a smaller file.')
      return
    }
    setImage(file)
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

    // Multipart rather than JSON, because the photo travels with the fields.
    const payload = new FormData()
    Object.entries(form).forEach(([field, value]) =>
      // Booleans have no trim(); DRF reads "true"/"false" from multipart.
      payload.append(field, typeof value === 'boolean' ? String(value) : value.trim()),
    )
    if (image) payload.append('image', image)
    // Multipart cannot carry a null, so removing the stored photo is its own flag.
    if (isEdit && !image && !storedImage) payload.append('clear_image', 'true')

    try {
      // PUT, not PATCH: every field is on screen, so this is a full replacement.
      const res = await (isEdit
        ? api.put(`/products/${id}/`, payload)
        : api.post('/products/', payload))
      toast.success(
        isEdit ? `“${form.name}” updated.` : `“${form.name}” added to the catalogue.`,
      )
      // The save may have tripped the threshold and raised an order — say so,
      // or an order goes out to a supplier with nothing on screen about it.
      const raised = res.data.open_purchase_order
      if (raised && raised.id !== openOrder?.id) {
        toast.success(
          `Auto-reorder: purchase order #${raised.id} raised for ${raised.quantity} units ` +
            `from ${raised.supplier_name}.`,
        )
      }
      onSaved?.(res.data)
    } catch (err) {
      // Land server-side complaints (a duplicate SKU, say) on the field itself
      // rather than only in the toast.
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
      await api.delete(`/products/${id}/`)
      toast.success(`“${deleted}” deleted.`)
      onDeleted?.()
    } catch (err) {
      // Refusals are expected here — an ordered or stocked product is kept.
      toast.error(apiErrorMessage(err))
      setDeleting(false)
    }
  }

  const inModal = layout === 'modal'
  // A 520px dialog is narrower than the `sm` breakpoint it would be matching
  // against, so the two-column field grid — and the cells that span it — only
  // apply on the full page.
  const fieldGrid = inModal ? 'grid gap-5' : 'grid gap-5 sm:grid-cols-2'
  const span2 = inModal ? '' : 'sm:col-span-2'

  const imageSection = (
    <FormSection inModal={inModal} className="h-fit p-5">
      <ImagePicker
        compact={inModal}
        previewUrl={previewUrl}
        caption={image ? image.name : ''}
        onPick={pickImage}
        onClear={() => {
          setImage(null)
          setStoredImage('')
        }}
        disabled={saving || deleting}
      />
    </FormSection>
  )

  const detailsSection = (
    <FormSection inModal={inModal} className="p-5">
      <div className={fieldGrid}>
        <div className={span2}>
          <Field name="name" label="Product name" error={fieldErrors.name}>
            <input
              id="name"
              name="name"
              className={fieldClass(fieldErrors.name)}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Golden Cow Milk 1 L Sachet"
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
          </Field>
        </div>

        <Field
          name="sku"
          label="SKU"
          hint="Unique across the catalogue."
          error={fieldErrors.sku}
        >
          <input
            id="sku"
            name="sku"
            className={fieldClass(fieldErrors.sku)}
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder="10914"
            maxLength={32}
            aria-invalid={Boolean(fieldErrors.sku)}
            aria-describedby={fieldErrors.sku ? 'sku-error' : undefined}
          />
        </Field>

        <CategoryField
          value={form.category}
          options={categories}
          adding={addingCategory}
          error={fieldErrors.category}
          onChange={(value) => set('category', value)}
          onStartAdding={() => {
            set('category', '')
            setAddingCategory(true)
          }}
          onStopAdding={() => {
            set('category', '')
            setAddingCategory(false)
          }}
        />

        <Field name="unit" label="Unit" error={fieldErrors.unit}>
          <select
            id="unit"
            name="unit"
            className={fieldClass(fieldErrors.unit)}
            value={form.unit}
            onChange={(e) => set('unit', e.target.value)}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          name="selling_price"
          label="Selling price (₹)"
          error={fieldErrors.selling_price}
        >
          <input
            id="selling_price"
            name="selling_price"
            type="number"
            min="0"
            step="0.01"
            className={fieldClass(fieldErrors.selling_price)}
            value={form.selling_price}
            onChange={(e) => set('selling_price', e.target.value)}
            placeholder="68.00"
            aria-invalid={Boolean(fieldErrors.selling_price)}
            aria-describedby={fieldErrors.selling_price ? 'selling_price-error' : undefined}
          />
        </Field>

        <div className={span2}>
          <Field
            name="description"
            label="Description"
            hint="Optional."
            error={fieldErrors.description}
          >
            <textarea
              id="description"
              name="description"
              rows={3}
              className={fieldClass(fieldErrors.description)}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Anything staff should know when handling this product."
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldErrors.description ? 'description-error' : undefined}
            />
          </Field>
        </div>
      </div>
    </FormSection>
  )

  // Reordering lives in its own box: these three fields are what the
  // auto-reorder toggle acts on, and grouping them makes that legible.
  const reorderSection = (
    <FormSection inModal={inModal} className="p-5 lg:col-start-2">
      <div
        className={`mb-4 flex flex-wrap items-center justify-between gap-3 pb-4 ${
          inModal ? '' : 'border-b border-line'
        }`}
      >
        <div>
          <h2 className="text-base font-semibold text-ink">Reordering</h2>
          <p className="text-sm text-muted">
            Who this SKU is bought from, and when to buy more.
          </p>
        </div>
        <Toggle
          id="auto_reorder"
          label="Auto submit"
          checked={form.auto_reorder}
          disabled={saving || deleting}
          onChange={(checked) => set('auto_reorder', checked)}
        />
      </div>

      <div className={fieldGrid}>
        <div className={span2}>
          <Field
            name="supplier"
            label="Supplier"
            hint={
              suppliers.length
                ? 'The vendor this SKU is bought from.'
                : 'No suppliers yet — add one on the Suppliers page first.'
            }
            error={fieldErrors.supplier}
          >
            <select
              id="supplier"
              name="supplier"
              className={fieldClass(fieldErrors.supplier)}
              value={form.supplier}
              onChange={(e) => set('supplier', e.target.value)}
              aria-invalid={Boolean(fieldErrors.supplier)}
              aria-describedby={fieldErrors.supplier ? 'supplier-error' : undefined}
            >
              <option value="" disabled>
                Select a supplier…
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.contact_person}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          name="reorder_threshold"
          label="Reorder threshold"
          hint="Stock at or below this shows as Low Stock."
          error={fieldErrors.reorder_threshold}
        >
          <input
            id="reorder_threshold"
            name="reorder_threshold"
            type="number"
            min="0"
            step="1"
            className={fieldClass(fieldErrors.reorder_threshold)}
            value={form.reorder_threshold}
            onChange={(e) => set('reorder_threshold', e.target.value)}
            placeholder="40"
            aria-invalid={Boolean(fieldErrors.reorder_threshold)}
            aria-describedby={
              fieldErrors.reorder_threshold ? 'reorder_threshold-error' : undefined
            }
          />
        </Field>

        <Field
          name="reorder_quantity"
          label="Reorder quantity"
          hint="Units to buy when it runs low."
          error={fieldErrors.reorder_quantity}
        >
          <input
            id="reorder_quantity"
            name="reorder_quantity"
            type="number"
            min="0"
            step="1"
            className={fieldClass(fieldErrors.reorder_quantity)}
            value={form.reorder_quantity}
            onChange={(e) => set('reorder_quantity', e.target.value)}
            placeholder="100"
            aria-invalid={Boolean(fieldErrors.reorder_quantity)}
            aria-describedby={
              fieldErrors.reorder_quantity ? 'reorder_quantity-error' : undefined
            }
          />
        </Field>
      </div>

      <div
        className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          inModal ? 'bg-white/45' : 'bg-surface-muted'
        }`}
      >
        {openOrder ? (
          <p className="text-ink">
            <span className="font-semibold">Purchase order #{openOrder.id}</span> is open —{' '}
            {openOrder.quantity} units from {openOrder.supplier_name}, raised{' '}
            {fmtDateTime(openOrder.created_at)}. It closes when you receive stock for this
            product.
          </p>
        ) : form.auto_reorder ? (
          <p className="text-ink">
            Stock at or below{' '}
            <span className="font-semibold">{form.reorder_threshold || 0}</span> raises a
            purchase order for{' '}
            <span className="font-semibold">{form.reorder_quantity || 0}</span> units,
            automatically.
          </p>
        ) : (
          <p className="text-muted">
            Auto submit is off — hitting the threshold only flags the product as Low Stock.
            Turn it on to have the order raised for you.
          </p>
        )}
      </div>
    </FormSection>
  )

  return (
    // noValidate: the browser's own bubbles show one field at a time and vanish
    // on the next click, so the form reports every problem at once instead.
    <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate>
      {!inModal && (
        <PageHeader title={isEdit ? 'Edit product' : 'New product'}>
          <p className="w-full text-sm text-muted">
            {isEdit
              ? 'Change any field and save. Image and description are optional.'
              : 'Add a SKU to the catalogue. Image and description are optional.'}
          </p>
        </PageHeader>
      )}

      {!loaded && <Spinner label="Loading product…" />}

      <div
        className={`${loaded ? '' : 'hidden'} ${
          inModal ? 'grid gap-5' : 'grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'
        }`}
      >
        {/* On the page the photo leads, beside the fields. In a single column
            it would be a large empty square above the first thing to type, so
            there it goes last. */}
        {!inModal && imageSection}
        {detailsSection}
        {reorderSection}
        {inModal && imageSection}

        {/* Outside every box: these act on the whole form, not on reordering.
            In a dialog the same two live in its pinned footer instead. */}
        {!inModal && (
          <div className="flex flex-wrap items-center gap-2 lg:col-start-2">
            <button type="submit" disabled={saving || deleting} className={buttonPrimary}>
              {saving ? 'Saving…' : isEdit ? 'Update product' : 'Create product'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving || deleting}
              className={buttonSecondary}
            >
              Cancel
            </button>
            {/* Deleting takes the product's stock history with it, so it is
                owner-only — matching this app's other destructive surfaces. */}
            {isEdit && user?.role === 'owner' && (
              <DeleteProduct
                name={form.name}
                busy={saving || deleting}
                onDelete={handleDelete}
              />
            )}
          </div>
        )}
      </div>
    </form>
  )
}

/** The full-page route: create at /products/new, edit at /products/:id/edit. */
export default function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const backToList = useCallback(() => navigate('/products'), [navigate])

  return (
    <ProductFormBody
      productId={id}
      layout="page"
      onSaved={backToList}
      onDeleted={backToList}
      onCancel={backToList}
    />
  )
}
