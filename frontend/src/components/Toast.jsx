/**
 * Bottom-right toasts for the outcome of an action — saved, updated, deleted,
 * or refused. Colour carries the tone, but never alone: each toast also has an
 * icon and says in words what happened.
 *
 * State lives above the router, so a toast raised just before `navigate()`
 * survives the page change and lands on the page the user arrives at.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

// Errors linger: a success is a confirmation you already expected, an error is
// something you have to read and act on.
const SUCCESS_MS = 4000
const ERROR_MS = 9000

const TONES = {
  success: {
    // The thick left edge plus the icon carry the meaning without colour.
    box: 'border-fresh bg-fresh-soft text-fresh-ink',
    ring: 'bg-fresh text-white',
    icon: '✓',
    role: 'status',
  },
  error: {
    box: 'border-expired bg-expired-soft text-expired-ink',
    ring: 'bg-expired text-white',
    icon: '⚠',
    role: 'alert',
  },
}

let nextId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (tone, message, ttl) => {
      if (!message) return
      const id = ++nextId
      setToasts((prev) => [...prev, { id, tone, message }])
      setTimeout(() => dismiss(id), ttl)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      success: (message) => push('success', message, SUCCESS_MS),
      error: (message) => push('error', message, ERROR_MS),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        // pointer-events-none on the stack so dismissed-but-animating toasts
        // never swallow clicks on the page underneath.
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(28rem,calc(100vw-3rem))] flex-col gap-3"
      >
        {toasts.map((t) => {
          const tone = TONES[t.tone]
          return (
            <div
              key={t.id}
              role={tone.role}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-l-[6px] px-5 py-4 shadow-xl animate-toast-in ${tone.box}`}
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${tone.ring}`}
              >
                {tone.icon}
              </span>
              <span className="flex-1 text-[0.9375rem] font-semibold leading-snug">
                {t.message}
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 shrink-0 px-1 text-lg font-bold leading-none opacity-60 transition-opacity hover:opacity-100"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
