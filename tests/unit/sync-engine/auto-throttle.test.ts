import { describe, it, expect } from 'vitest'
import { computeAutoFraction } from '../../../src/sync-engine/auto-throttle'

describe('computeAutoFraction', () => {
  it('returns 1.0 at low CPU usage', () => {
    expect(computeAutoFraction(0)).toBe(1.0)
    expect(computeAutoFraction(0.1)).toBe(1.0)
    expect(computeAutoFraction(0.3)).toBe(1.0)
  })

  it('returns 0.3 at high CPU usage', () => {
    expect(computeAutoFraction(0.7)).toBeCloseTo(0.3, 1)
    expect(computeAutoFraction(0.9)).toBeCloseTo(0.3, 1)
    expect(computeAutoFraction(1.0)).toBeCloseTo(0.3, 1)
  })

  it('linearly interpolates in the middle range', () => {
    const mid = computeAutoFraction(0.5)
    expect(mid).toBeGreaterThan(0.3)
    expect(mid).toBeLessThan(1.0)
    // At 50% CPU: 1.0 - ((0.5-0.3)/0.4) * 0.7 = 1.0 - 0.35 = 0.65
    expect(mid).toBeCloseTo(0.65, 1)
  })
})
