import { describe, it, expect } from 'vitest'
import {
  isValidSyncFolder,
  isValidConflictResolution,
  isValidTheme,
  isValidConcurrency,
} from '../../../src/shared/utils/validation'

describe('isValidSyncFolder', () => {
  it('rejects empty string', () => {
    expect(isValidSyncFolder('')).toBe(false)
  })

  it('rejects whitespace-only string', () => {
    expect(isValidSyncFolder('   ')).toBe(false)
  })

  it('rejects system root paths', () => {
    expect(isValidSyncFolder('/')).toBe(false)
    expect(isValidSyncFolder('C:\\')).toBe(false)
    expect(isValidSyncFolder('C:/')).toBe(false)
  })

  it('rejects paths that are too long', () => {
    expect(isValidSyncFolder('a'.repeat(1025))).toBe(false)
  })

  it('accepts valid folder paths', () => {
    expect(isValidSyncFolder('/home/user/sync')).toBe(true)
    expect(isValidSyncFolder('C:/Users/user/Syncbox')).toBe(true)
    expect(isValidSyncFolder('/Users/test/Documents/sync')).toBe(true)
  })
})

describe('isValidConflictResolution', () => {
  it('accepts valid resolutions', () => {
    expect(isValidConflictResolution('keep-local')).toBe(true)
    expect(isValidConflictResolution('keep-remote')).toBe(true)
    expect(isValidConflictResolution('keep-both')).toBe(true)
    expect(isValidConflictResolution('skip')).toBe(true)
  })

  it('rejects invalid resolutions', () => {
    expect(isValidConflictResolution('invalid')).toBe(false)
    expect(isValidConflictResolution('')).toBe(false)
  })
})

describe('isValidTheme', () => {
  it('accepts valid themes', () => {
    expect(isValidTheme('light')).toBe(true)
    expect(isValidTheme('dark')).toBe(true)
    expect(isValidTheme('system')).toBe(true)
  })

  it('rejects invalid themes', () => {
    expect(isValidTheme('neon')).toBe(false)
  })
})

describe('isValidConcurrency', () => {
  it('accepts values 1-32', () => {
    expect(isValidConcurrency(1)).toBe(true)
    expect(isValidConcurrency(4)).toBe(true)
    expect(isValidConcurrency(32)).toBe(true)
  })

  it('rejects 0 and negative numbers', () => {
    expect(isValidConcurrency(0)).toBe(false)
    expect(isValidConcurrency(-1)).toBe(false)
  })

  it('rejects numbers above 32', () => {
    expect(isValidConcurrency(33)).toBe(false)
  })

  it('rejects non-integers', () => {
    expect(isValidConcurrency(1.5)).toBe(false)
  })
})
