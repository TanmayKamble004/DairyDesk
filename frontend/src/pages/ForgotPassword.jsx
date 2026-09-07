import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage, fetchSecurityQuestion, resetPasswordWithAnswer } from '../api/client'
import { useToast } from '../components/Toast'
import Logo from '../components/Logo'
import { buttonPrimary } from '../components/ui'

/** The same ground as the sign-in page — this is the same doorway. */
const LOGIN_BACKDROP = '/login-cows.jpg'
const TEXT_SHADOW = '[text-shadow:0_1px_2px_rgba(255,255,255,0.7)]'

/**
 * Three stages, one panel:
 *
 *   username    — who is locked out
 *   answer      — their question, their answer, and the new password
 *   unavailable — no recovery on this account; go and find an owner
 *
 * `unavailable` deliberately covers an unknown username as well as an account
 * with no question set. The API answers those two identically so it cannot be
 * used to discover who has an account here, and the page must not undo that by
 * wording them differently.
 */
export default function ForgotPassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const [stage, setStage] = useState('username')
  const [username, setUsername] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLookup(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const found = await fetchSecurityQuestion(username)
      if (found) {
        setQuestion(found)
        setStage('answer')
      } else {
        setStage('unavailable')
      }
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    // Caught here rather than at the API: the new password is typed twice
    // precisely because nobody can see it, and a mismatch is a slip to correct
    // on the spot, not a request worth spending one of five attempts on.
    if (password !== confirm) {
      toast.error('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await resetPasswordWithAnswer({ username, answer, password })
      toast.success('Password updated. Sign in with it now.')
      navigate('/login', { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err))
      // Wrong answers are capped at five an hour, so clearing the field is a
      // nudge to think rather than retype the same thing faster.
      setAnswer('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${LOGIN_BACKDROP})` }}
      />
      <div aria-hidden="true" className="fixed inset-0 -z-10 bg-[rgba(10,40,70,0.15)]" />

      <div className="login-glass w-full max-w-sm rounded-3xl p-7 sm:p-9">
        <div className="flex justify-center">
          <Logo className="h-12" />
        </div>

        {stage === 'username' && (
          <>
            <p className={`mt-4 text-center text-sm text-glass-ink-dim ${TEXT_SHADOW}`}>
              Forgotten your password?
            </p>
            <form onSubmit={handleLookup} className="mt-6 space-y-4">
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
              <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full`}>
                {submitting ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </>
        )}

        {stage === 'answer' && (
          <>
            <p className={`mt-4 text-center text-sm text-glass-ink-dim ${TEXT_SHADOW}`}>
              Answer your security question to set a new password
            </p>
            <form onSubmit={handleReset} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="answer"
                  className={`mb-1 block text-sm font-semibold text-glass-ink ${TEXT_SHADOW}`}
                >
                  {question}
                </label>
                <input
                  id="answer"
                  className="login-field"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  required
                />
                <p className={`mt-1 text-xs text-glass-ink-dim ${TEXT_SHADOW}`}>
                  Capitals and extra spaces do not matter.
                </p>
              </div>
              <div>
                <label
                  htmlFor="password"
                  className={`mb-1 block text-sm font-semibold text-glass-ink ${TEXT_SHADOW}`}
                >
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  className="login-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="confirm"
                  className={`mb-1 block text-sm font-semibold text-glass-ink ${TEXT_SHADOW}`}
                >
                  New password again
                </label>
                <input
                  id="confirm"
                  type="password"
                  className="login-field"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" disabled={submitting} className={`${buttonPrimary} w-full`}>
                {submitting ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        {stage === 'unavailable' && (
          <>
            <p className={`mt-4 text-center text-sm text-glass-ink-dim ${TEXT_SHADOW}`}>
              No security question is set for that username.
            </p>
            <p className={`mt-3 text-center text-sm text-glass-ink ${TEXT_SHADOW}`}>
              An owner can set a new password for you from the Staff page. Check the
              spelling of your username first — it is easy to mistype.
            </p>
            <button
              type="button"
              onClick={() => setStage('username')}
              className={`${buttonPrimary} mt-6 w-full`}
            >
              Try another username
            </button>
          </>
        )}

        <p className={`mt-6 text-center text-sm text-glass-ink-dim ${TEXT_SHADOW}`}>
          <Link to="/login" className="font-semibold text-glass-ink underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
