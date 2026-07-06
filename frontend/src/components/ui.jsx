/** Small shared UI pieces — keep pages focused on data flow. */

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center gap-3 py-10 justify-center text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
      {label}
    </div>
  )
}

export function ErrorAlert({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="font-bold text-red-400 hover:text-red-600">
          ×
        </button>
      )}
    </div>
  )
}

const BADGE_STYLES = {
  // Expiry statuses
  fresh: 'bg-green-100 text-green-700',
  ageing: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  // Order statuses
  pending: 'bg-slate-100 text-slate-600',
  processed: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  // Invoice statuses
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}

export function Badge({ value }) {
  if (!value) return <span className="text-slate-400">—</span>
  const style = BADGE_STYLES[value] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}>
      {value}
    </span>
  )
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}>
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }) {
  return (
    <td className={`px-4 py-3 text-sm text-slate-700 ${className}`} {...rest}>
      {children}
    </td>
  )
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export const buttonPrimary =
  'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
