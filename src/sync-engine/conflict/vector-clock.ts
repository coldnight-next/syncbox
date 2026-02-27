import type { VectorClock } from '../../shared/types/peer'

export type ClockComparison = 'before' | 'after' | 'concurrent' | 'equal'

export function createClock(): VectorClock {
  return {}
}

export function incrementClock(clock: VectorClock, deviceId: string): VectorClock {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] ?? 0) + 1,
  }
}

export function mergeClock(a: VectorClock, b: VectorClock): VectorClock {
  const merged: VectorClock = { ...a }
  for (const [key, value] of Object.entries(b)) {
    merged[key] = Math.max(merged[key] ?? 0, value)
  }
  return merged
}

export function compareClock(a: VectorClock, b: VectorClock): ClockComparison {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  let aGreater = false
  let bGreater = false

  for (const key of allKeys) {
    const av = a[key] ?? 0
    const bv = b[key] ?? 0

    if (av > bv) aGreater = true
    if (bv > av) bGreater = true
  }

  if (!aGreater && !bGreater) return 'equal'
  if (aGreater && !bGreater) return 'after'
  if (!aGreater && bGreater) return 'before'
  return 'concurrent'
}
