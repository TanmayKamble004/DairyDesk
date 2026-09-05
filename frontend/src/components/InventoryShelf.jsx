import { Component, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import { api, apiErrorMessage } from '../api/client'
import { EXPIRY_ORDER, EXPIRY_STATUS } from '../data/expiryStatus'
import { Card, Spinner } from './ui'

/**
 * The 3D inventory shelf — three stacks, one per expiry status.
 *
 * It used to render a stack per product. That was legible at seven products and
 * a thicket at fifty-eight: a field of crates whose colours had to be counted by
 * eye to answer the only question the dashboard asks of it, which is how much
 * stock is at risk right now. Three stacks answer it at a glance, and each one
 * is the way in to the batches behind it.
 *
 * Fed by GET /api/inventory/status-summary/. Clicking a stack opens that
 * status's page; the expired one is where stock gets written off.
 */

// Visual cap on the tallest stack — the label carries the exact quantity.
// Seven, not ten: at ten the top crate and its label climb out of the default
// camera frame, and a stack you have to scroll out to read is worse than a
// shorter one that is fully in shot.
const MAX_CRATES = 7
const CRATE = { w: 2.05, h: 0.72, d: 2.05, gap: 0.08 }
const SPACING = 3.5 // centre-to-centre distance between the three stacks

// Deterministic pseudo-random in [-0.5, 0.5), so crates sit slightly askew but
// don't jump around between renders.
function jitter(seed) {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  return s - Math.floor(s) - 0.5
}

/**
 * The pad every stack stands on.
 *
 * It is what an *empty* bucket is made of: "nothing expired" is one of the more
 * useful things this shelf can say, and a bucket that rendered as thin air
 * would leave a hole in the row instead of saying it. It doubles as the click
 * target that a zero-crate stack would otherwise not have.
 */
function Pad({ color, highlight }) {
  return (
    <RoundedBox
      args={[CRATE.w + 0.75, 0.14, CRATE.d + 0.75]}
      radius={0.06}
      smoothness={4}
      position={[0, 0.07, 0]}
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0}
        transparent
        opacity={highlight ? 0.5 : 0.28}
      />
    </RoundedBox>
  )
}

function StatusStack({ bucket, x, unitsPerCrate, hovered, onHover, onOpen }) {
  useCursor(hovered)

  const { label, color, blurb } = EXPIRY_STATUS[bucket.status]
  const crates =
    bucket.quantity > 0
      ? Math.max(1, Math.min(MAX_CRATES, Math.ceil(bucket.quantity / unitsPerCrate)))
      : 0
  const topY = 0.2 + crates * (CRATE.h + CRATE.gap)
  const empty = crates === 0

  return (
    <group
      position={[x, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(true)
      }}
      onPointerOut={() => onHover(false)}
    >
      <Pad color={color} highlight={hovered} />

      {/* The stack lifts a little on hover rather than scaling: three stacks
          this size grow into each other when scaled, and the lift reads as the
          same invitation without the collision. */}
      <group position={[0, hovered ? 0.28 : 0, 0]}>
        {Array.from({ length: crates }, (_, i) => (
          <RoundedBox
            key={i}
            args={[CRATE.w, CRATE.h, CRATE.d]}
            radius={0.09}
            smoothness={4}
            castShadow
            receiveShadow
            position={[
              jitter(x * 31 + i) * 0.14,
              0.2 + CRATE.h / 2 + i * (CRATE.h + CRATE.gap),
              jitter(x * 17 + i * 7) * 0.14,
            ]}
            rotation={[0, jitter(x * 53 + i * 3) * 0.14, 0]}
          >
            <meshStandardMaterial
              color={color}
              roughness={0.5}
              metalness={0.05}
              emissive={hovered ? color : '#000000'}
              emissiveIntensity={0.3}
            />
          </RoundedBox>
        ))}
      </group>

      {/* The label is a real <button>, not decoration: it is how this shelf is
          reached by keyboard, and how it stays operable for anyone who cannot
          use a pointer on a canvas. The 3D group's own onClick is the same
          navigation for everyone else.
          No distanceFactor — labels keep a constant screen size instead of
          shrinking once the camera-distance scale kicks in on first drag. */}
      <Html position={[0, topY + 0.7, 0]} center zIndexRange={[20, 0]}>
        <button
          type="button"
          onClick={onOpen}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
          title={blurb}
          className={`w-36 cursor-pointer rounded-xl border bg-white/95 px-2.5 py-2 text-center shadow-sm backdrop-blur transition-colors ${
            hovered ? 'border-transparent' : 'border-slate-200'
          }`}
          style={hovered ? { borderColor: color } : undefined}
        >
          <span className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {label}
          </span>
          <span className="mt-1 block text-lg font-bold leading-none tabular-nums text-slate-800">
            {empty ? '—' : bucket.quantity.toLocaleString('en-IN')}
          </span>
          <span className="mt-1 block text-[10px] font-medium text-slate-500">
            {empty
              ? 'Nothing here'
              : `units · ${bucket.batch_count} batch${bucket.batch_count === 1 ? '' : 'es'}`}
          </span>
        </button>
      </Html>
    </group>
  )
}

function ShelfScene({ buckets, hoveredStatus, onHover, onOpen }) {
  // Divisor chosen from the biggest bucket, so the tallest stack is exactly
  // MAX_CRATES and the other two keep their heights relative to it.
  const unitsPerCrate = useMemo(() => {
    const peak = Math.max(...buckets.map((b) => b.quantity), 1)
    return Math.max(1, Math.ceil(peak / MAX_CRATES))
  }, [buckets])

  const width = (buckets.length - 1) * SPACING

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[6, 11, 7]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={10}
        shadow-camera-bottom={-9}
      />
      {/* Floor disc the stacks sit on — soft edge against the card gradient */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[width / 2 + 3.2, 64]} />
        <meshStandardMaterial color="#f4f7fb" roughness={0.95} transparent opacity={0.6} />
      </mesh>

      <group position={[-width / 2, 0, 0]}>
        {buckets.map((bucket, i) => (
          <StatusStack
            key={bucket.status}
            bucket={bucket}
            x={i * SPACING}
            unitsPerCrate={unitsPerCrate}
            hovered={hoveredStatus === bucket.status}
            onHover={(on) => onHover(on ? bucket.status : null)}
            onOpen={() => onOpen(bucket.status)}
          />
        ))}
      </group>

      {/* Aimed above the floor rather than at it: the labels sit on top of the
          stacks, so the thing worth framing is the upper half of the scene. */}
      <OrbitControls
        makeDefault
        target={[0, 2.2, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={24}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  )
}

function ShelfMessage({ title, detail, children }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="font-medium text-slate-500">{title}</div>
        {detail && <div className="mt-1 text-sm text-slate-400">{detail}</div>}
        {children}
      </div>
    </div>
  )
}

/** The three destinations as plain links — the shelf's fallback, not its shape. */
function StatusLinks() {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {EXPIRY_ORDER.map((status) => (
        <Link
          key={status}
          to={EXPIRY_STATUS[status].path}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800"
        >
          <span
            className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ backgroundColor: EXPIRY_STATUS[status].color }}
            aria-hidden="true"
          />
          {EXPIRY_STATUS[status].label}
        </Link>
      ))}
    </div>
  )
}

/**
 * If WebGL is unavailable or the scene throws, fall back rather than taking the
 * whole Dashboard down. The fallback keeps the three links: the shelf is now
 * navigation, and disposing of expired stock must not depend on a working GPU.
 */
class CanvasErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <ShelfMessage
          title="3D view unavailable"
          detail="The shelf couldn't render in this browser. The stock behind it is still here:"
        >
          <StatusLinks />
        </ShelfMessage>
      )
    }
    return this.props.children
  }
}

export default function InventoryShelf() {
  const navigate = useNavigate()
  const [buckets, setBuckets] = useState(null)
  const [error, setError] = useState('')
  const [hoveredStatus, setHoveredStatus] = useState(null)

  useEffect(() => {
    api
      .get('/inventory/status-summary/')
      .then((res) => setBuckets(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  // Fresh → ageing → expired, whatever order the API sent them in.
  const ordered = useMemo(() => {
    if (!buckets) return null
    const byStatus = new Map(buckets.map((b) => [b.status, b]))
    return EXPIRY_ORDER.map((status) => byStatus.get(status)).filter(Boolean)
  }, [buckets])

  const openStatus = (status) => navigate(EXPIRY_STATUS[status].path)

  return (
    <Card className="relative h-96 overflow-hidden bg-gradient-to-b from-sky-50 to-slate-100">
      {error && <ShelfMessage title="Couldn't load the inventory shelf" detail={error} />}

      {!error && !ordered && (
        <div className="flex h-full items-center justify-center">
          <Spinner label="Loading inventory…" />
        </div>
      )}

      {!error && ordered && (
        <>
          <CanvasErrorBoundary>
            {/* Far enough back that a full seven-crate stack and its label are
                both in frame before anyone touches the controls. */}
            <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 5.5, 14], fov: 42 }}>
              <ShelfScene
                buckets={ordered}
                hoveredStatus={hoveredStatus}
                onHover={setHoveredStatus}
                onOpen={openStatus}
              />
            </Canvas>
          </CanvasErrorBoundary>
          <div className="pointer-events-none absolute bottom-3 left-4 right-4 z-40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="rounded-full bg-white/85 px-3 py-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
              Stock by expiry status
            </span>
            <span>drag to rotate · scroll to zoom · click a stack to open it</span>
          </div>
        </>
      )}
    </Card>
  )
}
