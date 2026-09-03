import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Card, PageHeader, buttonPrimary, inputClass } from '../components/ui'
import {
  DEFAULT_THRESHOLDS,
  THRESHOLD_KEY,
  buildAlerts,
  fmtTime,
} from '../data/storeMock'

const SEVERITY = {
  Critical: {
    row: 'border-expired/40 bg-expired-soft',
    pill: 'bg-expired-soft text-expired-ink',
    dot: 'bg-expired',
    icon: 'text-expired-ink',
  },
  Warning: {
    row: 'border-ageing/40 bg-ageing-soft',
    pill: 'bg-ageing-soft text-ageing-ink',
    dot: 'bg-ageing',
    icon: 'text-ageing-ink',
  },
  Info: {
    row: 'border-line bg-surface',
    pill: 'bg-info-soft text-info-ink',
    dot: 'bg-brand',
    icon: 'text-info-ink',
  },
}

const GLYPH = { ban: '⊘', warn: '⚠', down: '↓', box: '▣', clock: '◷', check: '✓' }

const FIELDS = [
  { key: 'lowStock', label: 'Low stock threshold (units)' },
  { key: 'reorderPoint', label: 'Reorder point (units)' },
  { key: 'overstockLimit', label: 'Overstock limit (units)' },
  { key: 'criticalStock', label: 'Critical stock level (units)' },
]

function loadThresholds() {
  try {
    const saved = JSON.parse(localStorage.getItem(THRESHOLD_KEY))
    return saved ? { ...DEFAULT_THRESHOLDS, ...saved } : DEFAULT_THRESHOLDS
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

function Stat({ label, children }) {
  return (
    <Card className="p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-ink">{children}</div>
    </Card>
  )
}

export default function Alerts() {
  const { user } = useAuth()
  const canEdit = user?.role === 'owner'

  const [thresholds, setThresholds] = useState(loadThresholds)
  const [draft, setDraft] = useState(thresholds)
  const [saved, setSaved] = useState(false)
  const [checkedAt] = useState(() => new Date())

  const alerts = useMemo(() => buildAlerts(thresholds), [thresholds])
  const active = alerts.filter((a) => a.sev !== 'Info').length
  const highest = alerts.find((a) => a.sev === 'Critical')
    ? 'Critical'
    : alerts.find((a) => a.sev === 'Warning')
      ? 'Warning'
      : 'Normal'

  // Clear the "saved" confirmation once the user starts editing again.
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2600)
    return () => clearTimeout(t)
  }, [saved])

  function save() {
    const next = { ...draft }
    for (const f of FIELDS) {
      const n = Number(next[f.key])
      next[f.key] = Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLDS[f.key]
    }
    setThresholds(next)
    setDraft(next)
    try {
      localStorage.setItem(THRESHOLD_KEY, JSON.stringify(next))
    } catch {
      // Private mode or blocked storage — the values still apply this session.
    }
    setSaved(true)
  }

  return (
    <>
      <PageHeader title="Alerts & settings">
        <p className="w-full text-sm text-muted">
          Warnings raised from live stock levels, with thresholds you control.
        </p>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Active alerts">{active}</Stat>
        <Stat label="Highest severity">{highest}</Stat>
        <Stat label="Last check">{fmtTime(checkedAt)}</Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-ink">Inventory alerts</h2>
          <p className="text-sm text-muted">Raised from stock levels, reorder points and order status.</p>

          <ul className="mt-4 space-y-2.5">
            {alerts.map((a, i) => {
              const s = SEVERITY[a.sev]
              return (
                <li
                  key={`${a.title}-${i}`}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${s.row}`}
                >
                  <span className={`mt-0.5 text-lg leading-none ${s.icon}`} aria-hidden="true">
                    {GLYPH[a.icon] ?? '•'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{a.title}</div>
                    <div className="mt-0.5 text-sm text-muted">{a.desc}</div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.pill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                    {a.sev}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-semibold text-ink">Threshold settings</h2>
          <p className="text-sm text-muted">Change the values that decide when an alert appears.</p>

          <div className="mt-4 space-y-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label
                  htmlFor={f.key}
                  className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted"
                >
                  {f.label}
                </label>
                <input
                  id={f.key}
                  type="number"
                  min="0"
                  className={inputClass}
                  value={draft[f.key]}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {canEdit ? (
            <>
              <button onClick={save} className={`${buttonPrimary} mt-5 w-full`}>
                Save thresholds
              </button>
              <p className="mt-3 text-xs text-muted" role="status">
                {saved
                  ? 'Saved — the alert list above has been re-evaluated.'
                  : 'Thresholds are saved in this browser and applied immediately to the alert list.'}
              </p>
            </>
          ) : (
            <p className="mt-5 text-xs text-muted">
              Alert thresholds are an owner setting. Sign in as an owner to change them.
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
