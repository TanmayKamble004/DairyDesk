import { Component, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import { api, apiErrorMessage } from '../api/client'
import { Card, Spinner } from './ui'

/**
 * The 3D inventory shelf (Phase 4). One stack of crates per product from
 * GET /api/inventory/; crate count scales with available quantity, colour
 * follows the worst expiry status among the product's batches.
 */

const STATUS_COLORS = {
  fresh: '#22c55e',
  ageing: '#f59e0b',
  expired: '#ef4444',
  none: '#94a3b8', // product with no live batches
}

const MAX_CRATES = 8 // visual cap — the detail panel carries the exact quantity
const CRATE = { w: 1.35, h: 0.62, d: 1.35, gap: 0.07 }
const SPACING = 2.7 // centre-to-centre distance between stacks

// Deterministic pseudo-random in [-0.5, 0.5) so crates sit slightly askew but
// don't jump around between renders.
function jitter(seed) {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  return (s - Math.floor(s)) - 0.5
}

function crateCountFor(quantity, unitsPerCrate) {
  return Math.max(1, Math.min(MAX_CRATES, Math.ceil(quantity / unitsPerCrate)))
}

function CrateStack({ product, x, unitsPerCrate, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const color = STATUS_COLORS[product.worst_status] ?? STATUS_COLORS.none
  const count = crateCountFor(product.available_quantity, unitsPerCrate)
  const topY = count * (CRATE.h + CRATE.gap)
  const highlight = hovered || isSelected

  return (
    <group
      position={[x, 0, 0]}
      scale={hovered ? 1.05 : 1}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(product)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {Array.from({ length: count }, (_, i) => (
        <RoundedBox
          key={i}
          args={[CRATE.w, CRATE.h, CRATE.d]}
          radius={0.07}
          smoothness={4}
          castShadow
          receiveShadow
          position={[
            jitter(product.id * 31 + i) * 0.12,
            CRATE.h / 2 + i * (CRATE.h + CRATE.gap),
            jitter(product.id * 17 + i * 7) * 0.12,
          ]}
          rotation={[0, jitter(product.id * 53 + i * 3) * 0.16, 0]}
        >
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.05}
            emissive={highlight ? color : '#000000'}
            emissiveIntensity={0.28}
          />
        </RoundedBox>
      ))}
      <Html
        position={[0, topY + 0.55, 0]}
        center
        distanceFactor={8.5}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
          {product.name}
        </div>
      </Html>
    </group>
  )
}

function ShelfScene({ products, selectedId, onSelect }) {
  // Divisor chosen from the largest stock so the tallest stack is exactly
  // MAX_CRATES and the rest keep their relative heights.
  const unitsPerCrate = useMemo(() => {
    const maxQty = Math.max(...products.map((p) => p.available_quantity), 1)
    return Math.max(1, Math.ceil(maxQty / MAX_CRATES))
  }, [products])

  const rowWidth = (products.length - 1) * SPACING
  const shadowSpan = rowWidth / 2 + 4

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[6, 10, 7]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-shadowSpan}
        shadow-camera-right={shadowSpan}
        shadow-camera-top={10}
        shadow-camera-bottom={-shadowSpan}
      />
      {/* Floor disc the stacks sit on — soft edge against the card gradient */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[rowWidth / 2 + 3.5, 64]} />
        <meshStandardMaterial color="#f4f7fb" roughness={0.95} transparent opacity={0.55} />
      </mesh>
      <group position={[-rowWidth / 2, 0, 0]}>
        {products.map((product, i) => (
          <CrateStack
            key={product.id}
            product={product}
            x={i * SPACING}
            unitsPerCrate={unitsPerCrate}
            isSelected={product.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </group>
      <OrbitControls
        makeDefault
        target={[0, 1.6, 0]}
        enablePan={false}
        minDistance={5}
        maxDistance={rowWidth + 18}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
    </>
  )
}

function StatusDot({ status }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: STATUS_COLORS[status] }}
    />
  )
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-4 z-40 flex gap-4 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
      {['fresh', 'ageing', 'expired'].map((status) => (
        <span key={status} className="flex items-center gap-1.5 capitalize">
          <StatusDot status={status} />
          {status}
        </span>
      ))}
    </div>
  )
}

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

function DetailPanel({ product, onClose }) {
  const batchRows = [
    ['fresh', 'Fresh batches'],
    ['ageing', 'Ageing batches'],
    ['expired', 'Expired batches'],
  ]
  return (
    <div className="absolute right-4 top-4 z-50 w-64 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-800">{product.name}</div>
          <div className="text-xs capitalize text-slate-500">{product.category}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="-mr-1 -mt-1 rounded p-1 text-lg leading-none text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Available</dt>
          <dd className="font-semibold text-slate-800">
            {product.available_quantity} {product.unit}
          </dd>
        </div>
        {batchRows.map(([status, label]) => (
          <div key={status} className="flex items-center justify-between">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <StatusDot status={status} />
              {label}
            </dt>
            <dd className="font-medium text-slate-700">{product.batch_counts[status]}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Nearest expiry</dt>
          <dd className="font-medium text-slate-700">{formatDate(product.nearest_expiry)}</dd>
        </div>
      </dl>
    </div>
  )
}

function ShelfMessage({ title, detail }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="font-medium text-slate-500">{title}</div>
        {detail && <div className="mt-1 text-sm text-slate-400">{detail}</div>}
      </div>
    </div>
  )
}

// If WebGL is unavailable or the scene throws, show a fallback instead of
// taking the whole Dashboard down with it.
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
          detail="The shelf couldn't render in this browser. Inventory data is still available on the Inventory page."
        />
      )
    }
    return this.props.children
  }
}

export default function InventoryShelf() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api
      .get('/inventory/')
      .then((res) => setProducts(res.data))
      .catch((err) => setError(apiErrorMessage(err)))
  }, [])

  const rowWidth = products?.length ? (products.length - 1) * SPACING : 0
  const cameraZ = Math.max(9, rowWidth * 0.85 + 6)

  return (
    <Card className="relative h-96 overflow-hidden bg-gradient-to-b from-sky-50 to-slate-100">
      {error && (
        <ShelfMessage title="Couldn't load the inventory shelf" detail={error} />
      )}
      {!error && !products && (
        <div className="flex h-full items-center justify-center">
          <Spinner label="Loading inventory…" />
        </div>
      )}
      {!error && products?.length === 0 && (
        <ShelfMessage
          title="No products yet"
          detail="Add products and stock batches to see them on the shelf."
        />
      )}
      {!error && products?.length > 0 && (
        <>
          <CanvasErrorBoundary>
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={{ position: [0, 5.5, cameraZ], fov: 42 }}
              onPointerMissed={() => setSelected(null)}
            >
              <ShelfScene
                products={products}
                selectedId={selected?.id}
                onSelect={setSelected}
              />
            </Canvas>
          </CanvasErrorBoundary>
          <Legend />
          <div className="pointer-events-none absolute bottom-3 right-4 z-40 text-[11px] text-slate-400">
            drag to rotate · scroll to zoom · click a stack for details
          </div>
          {selected && <DetailPanel product={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </Card>
  )
}
