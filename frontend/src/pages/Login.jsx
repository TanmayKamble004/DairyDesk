import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { ErrorAlert, buttonPrimary, inputClass } from '../components/ui'
import FarmScene from '../components/login/FarmScene'

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
    <div className="farm-shell relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-800">🥛 DairyDesk</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="username"
              className={inputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <ErrorAlert message={error} />
          <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full`}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
      <FarmScene />
    </div>
  )
}
