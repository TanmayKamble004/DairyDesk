import { useEffect, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export default function App() {
  // status: 'loading' | 'ok' | 'error'
  const [status, setStatus] = useState('loading')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false

    async function checkHealth() {
      try {
        const res = await fetch(`${API_URL}/api/health/`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        if (data.status === 'ok') {
          setStatus('ok')
        } else {
          setStatus('error')
          setDetail(`Unexpected response: ${JSON.stringify(data)}`)
        }
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setDetail(err.message)
      }
    }

    checkHealth()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-slate-50 text-slate-800">
      <h1 className="text-3xl font-semibold">DairyDesk</h1>
      <p className="text-slate-500">Phase 0 — connectivity check</p>

      {status === 'loading' && (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-4 text-slate-500 shadow-sm">
          Checking backend…
        </div>
      )}

      {status === 'ok' && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-6 py-4 font-medium text-green-700 shadow-sm">
          Backend: ok
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-6 py-4 font-medium text-red-700 shadow-sm">
          <div>Backend: unreachable</div>
          {detail && <div className="mt-1 text-sm font-normal text-red-500">{detail}</div>}
        </div>
      )}

      <p className="text-xs text-slate-400">API: {API_URL}</p>
    </div>
  )
}
