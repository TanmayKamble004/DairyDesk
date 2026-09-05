/**
 * Glass dialog shell.
 *
 * Presentational only: it owns the overlay, the open/close animation, focus,
 * the scroll lock and Escape, and knows nothing about what is inside it. Pages
 * hold the open/closed flag themselves and pass their own form in as children,
 * so opening one of these is a state change, not a navigation.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Kept in step with `--modal-out` in index.css. The panel is unmounted only
 *  once its exit transition has run, so closing never blinks. */
const EXIT_MS = 180

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Skips anything `display: none` — a collapsed field must not swallow a Tab. */
function focusableIn(root) {
  if (!root) return []
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

export default function GlassModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  /** Dismissing by overlay or Escape asks first. The caller's own Cancel
   *  button bypasses this by setting its state directly — an explicit
   *  "discard" should never be second-guessed. */
  confirmClose = false,
  confirmMessage = 'This form has unsaved changes. Discard them?',
  /** Where focus goes on close. Falls back to whatever was focused when the
   *  dialog opened, which is wrong when that element was itself a menu item
   *  that has since unmounted — hence the explicit escape hatch. */
  returnFocusRef,
}) {
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)
  const panelRef = useRef(null)
  const bodyRef = useRef(null)
  const titleId = useId()
  const subtitleId = useId()

  const requestClose = useCallback(() => {
    if (confirmClose && !window.confirm(confirmMessage)) return
    onClose()
  }, [confirmClose, confirmMessage, onClose])

  // Mount on open; on close, start the exit and unmount only after it lands.
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      return undefined
    }
    if (!mounted) return undefined
    setEntered(false)
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [isOpen, mounted])

  // Two frames, not one: the panel has to paint in its closed state before the
  // transition to open has anything to animate from.
  useEffect(() => {
    if (!mounted || !isOpen) return undefined
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [mounted, isOpen])

  // Scroll lock. The padding replaces the width the scrollbar gave up, so the
  // page underneath does not jump sideways as the dialog opens.
  useEffect(() => {
    if (!mounted) return undefined
    const { body } = document
    const previousOverflow = body.style.overflow
    const previousPadding = body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${gap}px`
    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPadding
    }
  }, [mounted])

  // Escape closes; Tab cycles inside the panel. Capture phase, so a page that
  // listens for Escape itself (the + menu does) never sees it first.
  useEffect(() => {
    if (!mounted) return undefined

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        requestClose()
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const items = focusableIn(panel)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [mounted, requestClose])

  // Focus lands in the body first, so a form opens on its first field rather
  // than on the close button that happens to precede it in the markup.
  useEffect(() => {
    if (!mounted) return undefined
    const previous = document.activeElement
    // Read at open time, not in the cleanup: the + button is stable for the
    // page's lifetime, while `previous` is often a menu item that will have
    // unmounted by the time the dialog closes.
    const trigger = returnFocusRef?.current ?? null
    const target =
      focusableIn(bodyRef.current)[0] ?? focusableIn(panelRef.current)[0] ?? panelRef.current
    target?.focus()
    return () => {
      const fallback =
        previous instanceof HTMLElement && previous.isConnected ? previous : null
      const back = trigger?.isConnected ? trigger : fallback
      back?.focus()
    }
  }, [mounted, returnFocusRef])

  if (!mounted) return null

  const state = entered ? 'open' : 'closed'

  return createPortal(
    // Above the z-50 sidebar rail, which would otherwise stay bright while the
    // rest of the page dims, and below the z-60 toast stack, because a save
    // that fails has to report itself over the dialog still on screen.
    <div className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center">
      <div
        data-state={state}
        onClick={requestClose}
        aria-hidden="true"
        className="modal-scrim absolute inset-0"
      />

      <div
        ref={panelRef}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className="modal-panel relative flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-[22px] focus:outline-none"
      >
        <div className="flex items-start gap-3 border-b border-modal-divider px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {subtitle && (
              <p id={subtitleId} className="mt-1 text-sm text-muted">
                {subtitle}
              </p>
            )}
          </div>
          {/* A dismissal like the overlay, not a Cancel — so it asks too. */}
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition-colors hover:bg-white/60 hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* scroll-pt: focusing a field scrolls it into view, and without
            headroom the browser parks it flush against the header and slices
            the label off above it. */}
        <div ref={bodyRef} className="min-h-0 flex-1 scroll-pt-6 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-modal-divider px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
