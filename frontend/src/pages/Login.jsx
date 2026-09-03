import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorAlert } from '../components/ui'
import FarmScene from '../components/login/FarmScene'

const fieldClass =
  'w-full rounded-xl border border-white/60 bg-white/55 px-3.5 py-2.5 text-sm text-slate-800 ' +
  'transition duration-200 outline-none placeholder:text-slate-400 ' +
  'focus:border-farm-accent/60 focus:bg-white/80 focus:ring-2 focus:ring-farm-accent/35 ' +
  'dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:focus:bg-white/10'

const submitClass =
  'w-full rounded-xl bg-farm-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm ' +
  'transition duration-200 hover:-translate-y-0.5 hover:bg-farm-accent-hover hover:shadow-md ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-farm-accent ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0'

const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(username, password)
      navigate(location.state?.from ?? '/', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <FarmScene />
      <div className="relative z-10 w-full max-w-[400px] rounded-[20px] border border-white/45 bg-white/70 p-9 shadow-[0_24px_70px_-20px_rgb(30_40_25_/_0.45)] backdrop-blur-xl backdrop-saturate-150 dark:border-white/10 dark:bg-slate-950/60">
        <h1 className="text-center text-2xl font-bold text-slate-800 dark:text-slate-50">🥛 DairyDesk</h1>
        <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-300">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="username" className={labelClass}>
              Username
            </label>
            <input
              id="username"
              className={fieldClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <ErrorAlert message={error} />
          <button type="submit" disabled={submitting} className={submitClass}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
