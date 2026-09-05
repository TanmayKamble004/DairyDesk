import { useState } from 'react'

/**
 * The Dairy Desk logo.
 *
 * The artwork is served from `public/` rather than imported from `src/assets/`
 * on purpose: Vite resolves `src` imports at build time, so a missing file would
 * break the build, while a public path simply 404s and lands on the wordmark
 * fallback below. Drop the supplied PNG at `frontend/public/dairy-desk-logo.png`
 * and it appears everywhere this component is used, with no code change.
 *
 * `w-auto` against a fixed height keeps the supplied aspect ratio exactly — the
 * artwork is never stretched, recoloured or redrawn.
 */
const LOGO_SRC = '/dairy-desk-logo.png'

export default function Logo({ className = 'h-9', onDark = false }) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    // Only until the asset is in place — never a replacement for the real logo.
    return (
      <span
        className={`text-lg font-bold tracking-tight ${
          onDark ? 'text-white' : 'text-brand'
        }`}
      >
        Dairy<span className={onDark ? 'text-white/70' : 'text-coral-ink'}>desk</span>
      </span>
    )
  }

  return (
    <img
      src={LOGO_SRC}
      alt="Dairy Desk"
      onError={() => setMissing(true)}
      className={`${className} w-auto shrink-0 select-none`}
    />
  )
}
