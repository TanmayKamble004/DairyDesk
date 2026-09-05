/**
 * Add a staff member, or manage an existing one: details, role, a new password
 * when they forget theirs, and the switch that stops them signing in.
 *
 * Three separate writes rather than one save button, because they are three
 * different decisions with three different consequences. Details go through
 * PATCH; the password has its own endpoint (it is never readable, only
 * replaceable); disabling is its own confirmed action.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import {
  Badge,
  Card,
  PageHeader,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from '../components/ui'
import { fmtDateTime } from '../data/storeMock'

const EMPTY = {
  first_name: '',
  last_name: '',
  username: '',
  email: '',
  role: 'staff',
}

// Labels as they appear on screen, so an error names the field the user sees.
// Last name is the one detail somebody may genuinely not have.
const FIELD_LABELS = {
  first_name: 'First name',
  last_name: 'Last name',
  username: 'Username',
  email: 'Email',
  role: 'Role',
  password: 'Password',
  confirm_password: 'Confirm password',
}

const REQUIRED = ['first_name', 'username', 'email']

// Mirrors Django's MinimumLengthValidator. The server runs the full set of
// validators — this only saves an obvious round trip.
const MIN_PASSWORD = 8

const labelClass = 'mb-1 block text-sm font-medium text-ink'
const hintClass = 'mt-1 text-xs text-muted'

/** Red halo on an invalid field — a ring, not a border, so it cannot lose to
 *  `border-line` on stylesheet order. */
const fieldClass = (error) => `${inputClass}${error ? ' ring-1 ring-expired' : ''}`

function validateDetails(form) {
  const errors = {}

  for (const field of REQUIRED) {
    if (!form[field].trim()) errors[field] = `${FIELD_LABELS[field]} is required.`
  }

  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address, like sneha@dairydesk.local.'
  }

  if (!errors.username && !/^[\w.@+-]+$/.test(form.username.trim())) {
    // Django's own username rule, caught before the round trip.
    errors.username = 'Letters, digits and . @ + - _ only, with no spaces.'
  }

  return errors
}

function validatePassword(password, confirm) {
  const errors = {}
  if (password.length < MIN_PASSWORD) {
    errors.password = `Use at least ${MIN_PASSWORD} characters.`
  }
  if (password !== confirm) {
    errors.confirm_password = 'The two passwords do not match.'
  }
  return errors
}

/** Map a DRF error body back onto the fields it names. */
function serverFieldErrors(error) {
  const data = error.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const mapped = {}
  for (const [field, messages] of Object.entries(data)) {
    if (field in FIELD_LABELS) {
      mapped[field] = Array.isArray(messages) ? messages.join(' ') : String(messages)
    }
  }
  return mapped
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

/** Section heading inside the edit page's lower cards. */
function SectionCard({ title, description, children }) {
  return (
    <Card className="mt-6 max-w-3xl p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

/**
 * Setting a new password. Folded away behind a button because it is not part
 * of a routine detail edit — you come here on purpose.
 */
function PasswordSection({ staffId, name }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setPassword('')
    setConfirm('')
    setErrors({})
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validatePassword(password, confirm)
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }

    setSaving(true)
    try {
      await api.post(`/staff/${staffId}/set-password/`, { password })
      toast.success(`New password set for ${name}. Tell them in person, not by email.`)
      close()
    } catch (err) {
      setErrors(serverFieldErrors(err))
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <SectionCard
        title="Password"
        description="Stored passwords are hashed, so a forgotten one cannot be recovered — only replaced."
      >
        <button type="button" onClick={() => setOpen(true)} className={buttonSecondary}>
          Set a new password
        </button>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Password"
      description={`Choose a new password for ${name} and hand it to them directly.`}
    >
      {/* Its own form element: submitting here must not save the details above. */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="password"
            label="New password"
            hint={`At least ${MIN_PASSWORD} characters, and not their own name.`}
            error={errors.password}
          >
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={fieldClass(errors.password)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setErrors({})
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
          </Field>
          <Field
            name="confirm_password"
            label="Confirm new password"
            error={errors.confirm_password}
          >
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              className={fieldClass(errors.confirm_password)}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setErrors({})
              }}
              aria-invalid={Boolean(errors.confirm_password)}
              aria-describedby={errors.confirm_password ? 'confirm_password-error' : undefined}
            />
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className={buttonPrimary}>
            {saving ? 'Setting…' : 'Set password'}
          </button>
          <button type="button" onClick={close} disabled={saving} className={buttonSecondary}>
            Cancel
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

/**
 * The off switch. Disabling ends a session that may be open on the shop floor
 * right now, so it confirms first; re-enabling is the undo and goes straight
 * through.
 */
function AccessSection({ staff, isSelf, onChanged }) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  async function setActive(active) {
    setBusy(true)
    try {
      await api.patch(`/staff/${staff.id}/`, { is_active: active })
      toast.success(
        active
          ? `${staff.full_name} can sign in again.`
          : `${staff.full_name} can no longer sign in. Their history is untouched.`,
      )
      setConfirming(false)
      onChanged()
    } catch (err) {
      // Refusals are expected here — the last active owner is kept.
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SectionCard
      title="Account access"
      description="Someone who quits or goes on leave is switched off, never deleted: their name is attached to past orders and invoices."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge value={staff.is_active ? 'active' : 'disabled'} />
        <span className="text-sm text-muted">
          {staff.last_login
            ? `Last signed in ${fmtDateTime(staff.last_login).toLowerCase()}.`
            : 'Has never signed in.'}
        </span>
      </div>

      <div className="mt-4">
        {isSelf ? (
          <p className="text-sm text-muted">
            You cannot switch off your own account — you would lose this page along with it.
            Another owner can do it for you.
          </p>
        ) : !staff.is_active ? (
          <button
            type="button"
            onClick={() => setActive(true)}
            disabled={busy}
            className={buttonPrimary}
          >
            {busy ? 'Re-enabling…' : 'Re-enable account'}
          </button>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink">
              Stop {staff.full_name} signing in? They are signed out immediately.
            </span>
            <button
              type="button"
              onClick={() => setActive(false)}
              disabled={busy}
              className="rounded-xl bg-expired px-4 py-2 text-sm font-medium text-white hover:bg-expired/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Disabling…' : 'Yes, disable'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className={buttonSecondary}
            >
              Keep them active
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-expired/40 bg-expired-soft px-4 py-2 text-sm font-medium text-expired-ink hover:bg-expired-soft/70"
          >
            Disable account
          </button>
        )}
      </div>
    </SectionCard>
  )
}

export default function StaffForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const isEdit = Boolean(id)
  const formRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [staff, setStaff] = useState(null)
  const [loaded, setLoaded] = useState(!isEdit)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    if (!isEdit) return
    api
      .get(`/staff/${id}/`)
      .then((res) => {
        setStaff(res.data)
        setForm({
          first_name: res.data.first_name,
          last_name: res.data.last_name,
          username: res.data.username,
          email: res.data.email,
          role: res.data.role,
        })
        setLoaded(true)
      })
      .catch((err) => {
        toast.error(`Could not load this staff member. ${apiErrorMessage(err)}`)
        setLoaded(true)
      })
    // `toast` is stable for the provider's lifetime; listing it would only
    // re-run the fetch on unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, reloads])

  const isSelf = isEdit && staff?.username === user?.username

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

    const errors = validateDetails(form)
    // A new account needs a password here; an existing one changes it in its
    // own section below, so this form never carries one on edit.
    if (!isEdit) Object.assign(errors, validatePassword(password, confirm))

    const missing = Object.keys(errors).length
    if (missing) {
      showErrors(
        errors,
        missing === 1
          ? 'One field still needs attention — see below.'
          : `${missing} fields still need attention — see below.`,
      )
      return
    }

    setFieldErrors({})
    setSaving(true)

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
    }
    if (!isEdit) payload.password = password

    try {
      // PATCH, not PUT: `is_active` belongs to the section below, and a full
      // replacement would carry whatever this form last knew about it.
      const saved = isEdit
        ? await api.patch(`/staff/${id}/`, payload)
        : await api.post('/staff/', payload)
      toast.success(
        isEdit
          ? `${saved.data.full_name}'s details updated.`
          : `${saved.data.full_name} can now sign in as ${saved.data.username}.`,
      )
      navigate('/staff')
    } catch (err) {
      // Land server-side complaints on the field itself, not only in the toast.
      showErrors(serverFieldErrors(err), apiErrorMessage(err))
      setSaving(false)
    }
  }

  const describedBy = (field) => (fieldErrors[field] ? `${field}-error` : undefined)

  const input = (field, props = {}) => (
    <input
      id={field}
      name={field}
      className={fieldClass(fieldErrors[field])}
      value={form[field]}
      onChange={(e) => set(field, e.target.value)}
      aria-invalid={Boolean(fieldErrors[field])}
      aria-describedby={describedBy(field)}
      {...props}
    />
  )

  return (
    <>
      {/* noValidate: the browser's own bubbles show one field at a time and
          vanish on the next click, so the form reports every problem at once. */}
      <form ref={formRef} onSubmit={handleSubmit} noValidate>
        <PageHeader title={isEdit ? staff?.full_name || 'Edit staff' : 'Add staff'}>
          <p className="w-full text-sm text-muted">
            {isEdit
              ? 'Change their details or role. Passwords and access are below.'
              : 'Create an account and the password this person signs in with.'}
          </p>
        </PageHeader>

        {!loaded && <Spinner label="Loading staff member…" />}

        <Card className={`max-w-3xl p-5 ${loaded ? '' : 'hidden'}`}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="first_name" label="First name" error={fieldErrors.first_name}>
              {input('first_name', { placeholder: 'Sneha', maxLength: 150 })}
            </Field>

            <Field
              name="last_name"
              label="Last name"
              hint="Optional."
              error={fieldErrors.last_name}
            >
              {input('last_name', { placeholder: 'Patil', maxLength: 150 })}
            </Field>

            <Field
              name="username"
              label="Username"
              hint="What they type to sign in."
              error={fieldErrors.username}
            >
              {input('username', { placeholder: 'sneha', maxLength: 150, autoComplete: 'off' })}
            </Field>

            <Field name="email" label="Email" error={fieldErrors.email}>
              {input('email', { type: 'email', placeholder: 'sneha@dairydesk.local' })}
            </Field>

            <Field
              name="role"
              label="Role"
              hint={
                form.role === 'owner'
                  ? 'Owners see costs, invoices, reports and this page.'
                  : 'Staff run the shop floor but see no financial data.'
              }
              error={fieldErrors.role}
            >
              <select
                id="role"
                name="role"
                className={fieldClass(fieldErrors.role)}
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                aria-invalid={Boolean(fieldErrors.role)}
                aria-describedby={describedBy('role')}
              >
                <option value="staff">Staff</option>
                <option value="owner">Owner</option>
              </select>
            </Field>
          </div>

          {!isEdit && (
            <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <Field
                name="password"
                label="Password"
                hint={`At least ${MIN_PASSWORD} characters, and not their own name.`}
                error={fieldErrors.password}
              >
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass(fieldErrors.password)}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldErrors(({ password: _p, ...rest }) => rest)
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={describedBy('password')}
                />
              </Field>

              <Field
                name="confirm_password"
                label="Confirm password"
                error={fieldErrors.confirm_password}
              >
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  className={fieldClass(fieldErrors.confirm_password)}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value)
                    setFieldErrors(({ confirm_password: _c, ...rest }) => rest)
                  }}
                  aria-invalid={Boolean(fieldErrors.confirm_password)}
                  aria-describedby={describedBy('confirm_password')}
                />
              </Field>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <button type="submit" disabled={saving} className={buttonPrimary}>
              {saving ? 'Saving…' : isEdit ? 'Save details' : 'Add staff'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/staff')}
              disabled={saving}
              className={buttonSecondary}
            >
              Cancel
            </button>
          </div>
        </Card>
      </form>

      {/* Outside the details form: each of these is its own write, and neither
          should be triggered by pressing Enter in a name field. */}
      {isEdit && staff && (
        <>
          <PasswordSection staffId={staff.id} name={staff.full_name} />
          <AccessSection
            staff={staff}
            isSelf={isSelf}
            onChanged={() => setReloads((n) => n + 1)}
          />
        </>
      )}
    </>
  )
}
