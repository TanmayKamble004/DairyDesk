/**
 * Tiny change signal for inventory data.
 *
 * Disposing stock on the Inventory page also invalidates the 3D shelf on the
 * Dashboard. Rather than lifting inventory state into a global store, writers
 * bump a version here and readers re-run their fetch when it changes.
 */
import { useSyncExternalStore } from 'react'

let version = 0
const listeners = new Set()

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return version
}

/** Call after any write that changes stock levels. */
export function notifyInventoryChanged() {
  version += 1
  for (const listener of listeners) listener()
}

/** Re-renders the caller whenever inventory changes; use it as an effect dep. */
export function useInventoryVersion() {
  return useSyncExternalStore(subscribe, getSnapshot)
}
