import { describe, it, expect } from 'vitest'
import {
  createClock,
  incrementClock,
  mergeClock,
  compareClock,
} from '../../../../src/sync-engine/conflict/vector-clock'

describe('vector-clock', () => {
  describe('createClock', () => {
    it('should create an empty clock', () => {
      expect(createClock()).toEqual({})
    })
  })

  describe('incrementClock', () => {
    it('should increment a new device entry', () => {
      const clock = createClock()
      const updated = incrementClock(clock, 'device-a')
      expect(updated).toEqual({ 'device-a': 1 })
    })

    it('should increment an existing entry', () => {
      const clock = { 'device-a': 3 }
      const updated = incrementClock(clock, 'device-a')
      expect(updated).toEqual({ 'device-a': 4 })
    })

    it('should not mutate the original clock', () => {
      const clock = { 'device-a': 1 }
      incrementClock(clock, 'device-a')
      expect(clock).toEqual({ 'device-a': 1 })
    })
  })

  describe('mergeClock', () => {
    it('should take max of each key', () => {
      const a = { 'device-a': 3, 'device-b': 1 }
      const b = { 'device-a': 1, 'device-b': 5 }
      expect(mergeClock(a, b)).toEqual({ 'device-a': 3, 'device-b': 5 })
    })

    it('should include keys from both clocks', () => {
      const a = { 'device-a': 2 }
      const b = { 'device-b': 4 }
      expect(mergeClock(a, b)).toEqual({ 'device-a': 2, 'device-b': 4 })
    })

    it('should handle empty clocks', () => {
      expect(mergeClock({}, { 'device-a': 1 })).toEqual({ 'device-a': 1 })
      expect(mergeClock({ 'device-a': 1 }, {})).toEqual({ 'device-a': 1 })
    })
  })

  describe('compareClock', () => {
    it('should return equal for identical clocks', () => {
      const clock = { 'device-a': 2, 'device-b': 3 }
      expect(compareClock(clock, { ...clock })).toBe('equal')
    })

    it('should return equal for two empty clocks', () => {
      expect(compareClock({}, {})).toBe('equal')
    })

    it('should return after when a is strictly greater', () => {
      const a = { 'device-a': 3, 'device-b': 2 }
      const b = { 'device-a': 2, 'device-b': 1 }
      expect(compareClock(a, b)).toBe('after')
    })

    it('should return before when b is strictly greater', () => {
      const a = { 'device-a': 1 }
      const b = { 'device-a': 3 }
      expect(compareClock(a, b)).toBe('before')
    })

    it('should return concurrent when neither dominates', () => {
      const a = { 'device-a': 3, 'device-b': 1 }
      const b = { 'device-a': 1, 'device-b': 3 }
      expect(compareClock(a, b)).toBe('concurrent')
    })

    it('should handle missing keys as zero', () => {
      const a = { 'device-a': 1 }
      const b = { 'device-b': 1 }
      expect(compareClock(a, b)).toBe('concurrent')
    })

    it('should return after when a has extra keys beyond b', () => {
      const a = { 'device-a': 1, 'device-b': 1 }
      const b = { 'device-a': 1 }
      expect(compareClock(a, b)).toBe('after')
    })
  })
})
