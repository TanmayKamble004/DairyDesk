import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import Logo from '../components/Logo'
import { buttonPrimary } from '../components/ui'

/**
 * Served from `public/` alongside the logo, so the path is stable at runtime
 * and does not depend on the bundler hashing an import.
 */
const LOGIN_BACKDROP = '/login-cows.jpg'

/**
 * Glass is only as legible as what happens to be behind it, and an 18% pane
 * over a photograph is the hardest case there is: measured on the rendered
 * page, the ground under this panel runs rgb(104,114,131) to rgb(249,249,250),
 * a mid-tone band that punishes white text (1.98:1) and dark text alike. The
 * fix is in `login-glass` — the backdrop filter flattens that band before any
 * text lands on it. This halo is the second half: it lifts the glyph edges off
 * whatever cloud happens to sit behind them.
 */
const TEXT_SHADOW = '[text-shadow:0_1px_2px_rgba(255,255,255,0.7)]'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const signedIn = await login(username, password)
      toast.success(`Signed in as ${signedIn.username}.`)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      {/* The photograph, as the page's own ground. `fixed` rather than
          `absolute` so it covers the whole viewport even when the panel is
          shorter than the screen or the page scrolls on a small phone; the
          negative z-index puts it behind the panel without the panel needing
          a stacking context of its own. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${LOGIN_BACKDROP})` }}
      />
      {/* A thin cool wash — just enough to settle the sky's brightness under
          the panel's shadow. Deliberately light: the cows stay the picture. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-[rgba(10,40,70,0.15)]" />
      <div className="login-glass w-full max-w-sm rounded-3xl p-7 sm:p-9">
        <div className="flex justify-center">
          <Logo className="h-12" />
        </div>
        <p className={`mt-4 text-center text-sm text-glass-ink-dim ${TEXT_SHADOW}`}>Sign in to continue</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="username"
              className={`mb-1 block text-sm font-semibold text-glass-ink ${TEXT_SHADOW}`}
            >
              Username
            </label>
            <input
              id="username"
              className="login-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className={`mb-1 block text-sm font-semibold text-glass-ink ${TEXT_SHADOW}`}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="login-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            /* Only the shadow *colour* is set at rest: an appended `shadow-lg` loses to
               the `shadow-sm` already in `buttonPrimary` (same specificity, sheet order
               decides), so it would be dead code. The hover variant does win, and lifts. */
            className={`${buttonPrimary} w-full shadow-brand-deep/30 hover:shadow-lg hover:shadow-brand-deep/40`}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
