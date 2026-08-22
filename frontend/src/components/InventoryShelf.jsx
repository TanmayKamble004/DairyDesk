import { Component, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import { api, apiErrorMessage } from '../api/client'
import { useInventoryVersion } from '../api/inventoryEvents'
import { Card, Spinner, StatusIndicator } from './ui'

/**
 * The 3D inventory shelf. One stack of crates per product from
 * GET /api/inventory/; crate count scales with available quantity, colour
 * follows the worst expiry status among the product's batches.
 *
 * Products are laid out as a grid of shelf rows, one row per category. A
 * single row stopped working once the catalogue passed a handful of items:
 * the row grew wider than the camera could frame, so everything shrank and
 * the name labels collapsed into an unreadable pile. Grouping by category
 * keeps the footprint roughly square however many products exist, and only
 * category names are drawn permanently — a product's name appears when you
 * point at it, so labels can never overlap.
 */

// Mirrors the --color-fresh / --color-ageing / --color-expired tokens in
// index.css. WebGL can't read CSS custom properties, so the hexes live here.
const STATUS_COLORS = {
  fresh: '#059669',
  ageing: '#D97706',
  expired: '#DC2626',
  none: '#94A3B8', // product with no live batches
}

const MAX_CRATES = 6 // visual cap — the detail panel carries the exact quantity
const CRATE = { w: 1.0, h: 0.46, d: 1.0, gap: 0.06 }
const COL_SPACING = 1.5 // between products inside a category row
const ROW_SPACING = 2.3 // between category rows
const SHELF_HEIGHT = 0.14
const LABEL_GUTTER = 1.6 // space reserved left of the grid for category names

// Deterministic pseudo-random in [-0.5, 0.5) so crates sit slightly askew but
// don't jump around between renders.
function jitter(seed) {
  const s = Math.sin(seed * 12.9898) * 43758.5453
  return s - Math.floor(s) - 0.5
}

function crateCountFor(quantity, unitsPerCrate) {
  return Math.max(1, Math.min(MAX_CRATES, Math.ceil(quantity / unitsPerCrate)))
}

/** Group products into one row per category, and measure the resulting grid. */
function buildLayout(products) {
  const byCategory = new Map()
  for (const product of products) {
    const key = product.category || 'Uncategorised'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key).push(product)
  }

  // Widest row first keeps the silhouette pyramid-ish rather than ragged.
  const rows = [...byCategory.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([category, items]) => ({ category, items }))

  const columns = Math.max(...rows.map((r) => r.items.length), 1)
  const width = columns * COL_SPACING
  const depth = rows.length * ROW_SPACING
  const maxQuantity = Math.max(...products.map((p) => p.available_quantity), 1)

  return {
    rows,
    width,
    depth,
    // Divisor from the largest stock so the tallest stack is exactly
    // MAX_CRATES and every other stack keeps its height relative to it.
    unitsPerCrate: Math.max(1, Math.ceil(maxQuantity / MAX_CRATES)),
  }
}

function CrateStack({ product, position, unitsPerCrate, isSelected, onSelect }) {
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)

  const color = STATUS_COLORS[product.worst_status] ?? STATUS_COLORS.none
  const isEmpty = product.available_quantity === 0
  const count = isEmpty ? 1 : crateCountFor(product.available_quantity, unitsPerCrate)
  // An out-of-stock product gets a flat plate instead of a crate, so an empty
  // slot reads as empty rather than as "one crate of something".
  const crateHeight = isEmpty ? 0.1 : CRATE.h
  const topY = count * (crateHeight + CRATE.gap)
  const highlight = hovered || isSelected

  return (
    <group
      position={position}
      scale={highlight ? 1.06 : 1}
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
          args={[CRATE.w, crateHeight, CRATE.d]}
          radius={0.05}
          smoothness={4}
          castShadow
          receiveShadow
          position={[
            jitter(product.id * 31 + i) * 0.08,
            crateHeight / 2 + i * (crateHeight + CRATE.gap),
            jitter(product.id * 17 + i * 7) * 0.08,
          ]}
          rotation={[0, jitter(product.id * 53 + i * 3) * 0.14, 0]}
        >
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.05}
            emissive={highlight ? color : '#000000'}
            emissiveIntensity={0.3}
          />
        </RoundedBox>
      ))}

      {/* Only the pointed-at product is named, so labels can never collide. */}
      {highlight && (
        <Html position={[0, topY + 0.5, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-lg bg-shell px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
            {product.name}
            <span className="ml-1.5 font-normal text-slate-300">
              {product.available_quantity} {product.unit}
            </span>
          </div>
        </Html>
      )}
    </group>
  )
}

/** The plank each category's products stand on. */
function ShelfRow({ row, z, width }) {
  const rowWidth = row.items.length * COL_SPACING
  return (
    <>
      <mesh position={[0, -SHELF_HEIGHT / 2, z]} receiveShadow castShadow>
        <boxGeometry args={[rowWidth, SHELF_HEIGHT, CRATE.d + 0.5]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.9} />
      </mesh>
      {/* Category name in a fixed left-hand gutter, so the names line up. */}
      <Html
        position={[-width / 2 - LABEL_GUTTER, 0.1, z]}
        center
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
          {row.category}
          <span className="ml-1.5 font-normal text-slate-400">{row.items.length}</span>
        </div>
      </Html>
    </>
  )
}

function ShelfScene({ layout, selectedId, onSelect }) {
  const { rows, width, depth, unitsPerCrate } = layout
  const span = Math.max(width, depth)

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.25} />

      {rows.map((row, rowIndex) => {
        const z = (rowIndex - (rows.length - 1) / 2) * ROW_SPACING
        return (
          <group key={row.category}>
            <ShelfRow row={row} z={z} width={width} />
            {row.items.map((product, colIndex) => (
              <CrateStack
                key={product.id}
                product={product}
                position={[
                  (colIndex - (row.items.length - 1) / 2) * COL_SPACING,
                  0,
                  z,
                ]}
                unitsPerCrate={unitsPerCrate}
                isSelected={product.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </group>
        )
      })}

      <OrbitControls
        makeDefault
        target={[0, 0.8, 0]}
        enablePan={false}
        minDistance={span * 0.5}
        maxDistance={span * 2.2}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2 - 0.12}
      />
    </>
  )
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-3 left-4 z-40 flex flex-wrap gap-4 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-medium shadow-sm ring-1 ring-slate-200 backdrop-blur">
      {['fresh', 'ageing', 'expired'].map((status) => (
        <StatusIndicator key={status} status={status} />
      ))}
      <span className="inline-flex items-center gap-1.5 text-empty">
        <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5 fill-current">
          <rect x="0.8" y="4" width="8.4" height="2" rx="1" />
        </svg>
        no stock
      </span>
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
          className="-mr-1 -mt-1 rounded p-1 text-lg leading-none text-empty hover:text-slate-600"
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
        {product.expired_quantity > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Awaiting disposal</dt>
            <dd className="font-semibold text-expired-ink">
              {product.expired_quantity} {product.unit}
            </dd>
          </div>
        )}
        {batchRows.map(([status, label]) => (
          <div key={status} className="flex items-center justify-between">
            <dt>
              <StatusIndicator status={status} label={label} />
            </dt>
            <dd className="font-medium text-slate-800">{product.batch_counts[status]}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">Nearest expiry</dt>
          <dd className="font-medium text-slate-800">{formatDate(product.nearest_expiry)}</dd>
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
        {detail && <div className="mt-1 text-sm text-empty">{detail}</div>}
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
  // Track the id, not the row: after a refetch the derived row is the fresh
  // one, so an open detail panel can't show pre-disposal numbers.
  const [selectedId, setSelectedId] = useState(null)
  const inventoryVersion = useInventoryVersion()

  useEffect(() => {
    api
      .get('/inventory/')
      .then((res) => {
        setProducts(res.data)
        setError('')
      })
      .catch((err) => setError(apiErrorMessage(err)))
  }, [inventoryVersion])

  const selected = products?.find((p) => p.id === selectedId) ?? null
  const layout = useMemo(
    () => (products?.length ? buildLayout(products) : null),
    [products],
  )

  // Frame the whole grid whatever its size, viewed from a front-left corner
  // so the rows read as depth rather than stacking on top of each other.
  const camera = useMemo(() => {
    if (!layout) return { position: [0, 6, 12], fov: 45 }
    const span = Math.max(layout.width, layout.depth)
    return { position: [span * 0.28, span * 0.62, span * 0.95], fov: 45 }
  }, [layout])

  return (
    <Card className="relative h-96 overflow-hidden bg-gradient-to-b from-white to-slate-100 lg:h-[30rem]">
      {error && <ShelfMessage title="Couldn't load the inventory shelf" detail={error} />}
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
      {!error && layout && (
        <>
          <CanvasErrorBoundary>
            <Canvas
              shadows
              dpr={[1, 2]}
              camera={camera}
              onPointerMissed={() => setSelectedId(null)}
            >
              <ShelfScene
                layout={layout}
                selectedId={selectedId}
                onSelect={(product) => setSelectedId(product.id)}
              />
            </Canvas>
          </CanvasErrorBoundary>
          <Legend />
          <div className="pointer-events-none absolute bottom-3 right-4 z-40 text-[11px] text-slate-400">
            drag to rotate · scroll to zoom · hover to name · click for details
          </div>
          {selected && <DetailPanel product={selected} onClose={() => setSelectedId(null)} />}
        </>
      )}
    </Card>
  )
}
