/**
 * Owner-only staff roster: who can sign in, as what, and when they last did.
 *
 * Nobody is ever deleted here. A staff member's name is attached to the orders
 * and invoices they handled, so a leaver is switched off instead — the account
 * stops authenticating and the history stays intact. Adding, editing, resetting
 * a password and switching someone off all live on the form behind each card,
 * the same shape Suppliers uses.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { AddMenu, Badge, Card, LoadFailed, PageHeader, Spinner } from '../components/ui'
import { fmtDate, fmtDateTime } from '../data/storeMock'

// Fixed palette indexed by id, so a person's avatar keeps its colour.
const AVATAR_COLORS = ['#1677d2', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium text-ink">{children}</dd>
    </div>
  )
}

export default function Staff() {
  const toast = useToast()
  const { user } = useAuth()
  const [members, setMembers] = useState(null)
  const [failed, setFailed] = useState(false)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    api
      .get('/staff/')
      .then((res) => {
        setMembers(res.data)
        setFailed(false)
      })
      .catch((err) => {
        // Toasts fade, so a failed load also leaves something on the page.
        setFailed(true)
        toast.error(`Could not load staff. ${apiErrorMessage(err)}`)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloads])

  const list = members ?? []
  const activeCount = list.filter((m) => m.is_active).length

  return (
    <>
      <PageHeader title="Staff">
        <AddMenu
          label="Add"
          icon="👤"
          title="Add staff"
          description="Create an account and the password they sign in with."
          to="/staff/new"
        />
        <p className="w-full text-sm text-muted">
          Everyone who can sign in to this store.
          {members && ` ${activeCount} of ${list.length} active.`} Nobody is deleted — past
          orders and invoices carry their name.
        </p>
      </PageHeader>

      {failed && <LoadFailed what="staff" onRetry={() => setReloads((n) => n + 1)} />}
      {!failed && !members && <Spinner label="Loading staff…" />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((m) => (
          <Card key={m.id} className={`flex flex-col p-5 ${m.is_active ? '' : 'opacity-75'}`}>
            <Link
              to={`/staff/${m.id}/edit`}
              className="flex items-center gap-3 hover:text-brand"
              title={`Edit ${m.full_name}`}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: AVATAR_COLORS[m.id % AVATAR_COLORS.length] }}
                aria-hidden="true"
              >
                {initials(m.full_name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink underline-offset-4 hover:underline">
                  {m.full_name}
                  {m.username === user?.username && (
                    <span className="ml-2 text-xs font-normal text-muted">(you)</span>
                  )}
                </div>
                {/* full_name falls back to the username on an account that
                    predates real names — don't print it twice. */}
                {m.full_name !== m.username && (
                  <div className="truncate text-sm text-muted">{m.username}</div>
                )}
              </div>
            </Link>

            <dl className="mt-4 divide-y divide-line border-t border-line">
              <Row label="Email">
                <a href={`mailto:${m.email}`} className="text-brand hover:text-brand-hover">
                  {m.email}
                </a>
              </Row>
              <Row label="Role">
                <span className="capitalize">{m.role}</span>
              </Row>
              <Row label="Last login">
                <span title={m.last_login ?? 'Has never signed in'}>
                  {m.last_login ? fmtDateTime(m.last_login) : 'Never'}
                </span>
              </Row>
              <Row label="Added">{fmtDate(m.date_joined)}</Row>
            </dl>

            <div className="mt-4">
              <Badge value={m.is_active ? 'active' : 'disabled'} />
            </div>
          </Card>
        ))}
      </div>

      {members?.length === 0 && (
        <Card className="p-10 text-center">
          <div className="text-2xl text-empty" aria-hidden="true">
            ∅
          </div>
          <div className="mt-1 text-sm font-medium text-muted">No staff yet</div>
          <div className="mt-0.5 text-xs text-muted">
            Use the + button to create the first account.
          </div>
        </Card>
      )}
    </>
  )
}
