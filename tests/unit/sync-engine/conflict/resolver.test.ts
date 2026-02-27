import { describe, it, expect, vi } from 'vitest'
import { ConflictResolver, type ConflictContext } from '../../../../src/sync-engine/conflict/resolver'

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

function makeContext(overrides?: Partial<ConflictContext>): ConflictContext {
  return {
    relativePath: 'docs/readme.md',
    localChecksum: 'abc123',
    remoteChecksum: 'def456',
    localDeviceId: 'device-a',
    remoteDeviceId: 'device-b',
    localClock: { 'device-a': 2 },
    remoteClock: { 'device-b': 2 },
    localModifiedAt: 1000,
    remoteModifiedAt: 2000,
    conflictType: 'content',
    ...overrides,
  }
}

describe('ConflictResolver', () => {
  describe('keep-newest strategy', () => {
    it('should keep remote when it is newer', () => {
      const resolver = new ConflictResolver('keep-newest', logger)
      const result = resolver.resolve(makeContext({ localModifiedAt: 1000, remoteModifiedAt: 2000 }))
      expect(result).toEqual({ action: 'keep-remote' })
    })

    it('should keep local when it is newer', () => {
      const resolver = new ConflictResolver('keep-newest', logger)
      const result = resolver.resolve(makeContext({ localModifiedAt: 3000, remoteModifiedAt: 2000 }))
      expect(result).toEqual({ action: 'keep-local' })
    })

    it('should tie-break by deviceId when timestamps equal', () => {
      const resolver = new ConflictResolver('keep-newest', logger)
      const result = resolver.resolve(makeContext({
        localModifiedAt: 2000,
        remoteModifiedAt: 2000,
        localDeviceId: 'aaa',
        remoteDeviceId: 'bbb',
      }))
      expect(result).toEqual({ action: 'keep-local' })
    })

    it('should keep remote on tie when remote deviceId is lower', () => {
      const resolver = new ConflictResolver('keep-newest', logger)
      const result = resolver.resolve(makeContext({
        localModifiedAt: 2000,
        remoteModifiedAt: 2000,
        localDeviceId: 'zzz',
        remoteDeviceId: 'aaa',
      }))
      expect(result).toEqual({ action: 'keep-remote' })
    })
  })

  describe('keep-both strategy', () => {
    it('should always create a conflict copy', () => {
      const resolver = new ConflictResolver('keep-both', logger)
      const result = resolver.resolve(makeContext())
      expect(result.action).toBe('keep-both')
      if (result.action === 'keep-both') {
        expect(result.conflictFilename).toContain('sync-conflict')
        expect(result.conflictFilename).toContain('device-b')
      }
    })

    it('should produce a filename with the correct extension', () => {
      const resolver = new ConflictResolver('keep-both', logger)
      const result = resolver.resolve(makeContext({ relativePath: 'photos/sunset.jpg' }))
      if (result.action === 'keep-both') {
        expect(result.conflictFilename).toMatch(/\.jpg$/)
        expect(result.conflictFilename).toContain('photos/sunset.sync-conflict')
      }
    })

    it('should handle files without extension', () => {
      const resolver = new ConflictResolver('keep-both', logger)
      const result = resolver.resolve(makeContext({ relativePath: 'Makefile' }))
      if (result.action === 'keep-both') {
        expect(result.conflictFilename).toContain('Makefile.sync-conflict')
      }
    })
  })

  describe('ask strategy', () => {
    it('should queue conflict for user resolution', () => {
      const resolver = new ConflictResolver('ask', logger)
      const result = resolver.resolve(makeContext())
      expect(result.action).toBe('ask')
      if (result.action === 'ask') {
        expect(result.conflictId).toBeTruthy()
      }
    })

    it('should store pending conflicts', () => {
      const resolver = new ConflictResolver('ask', logger)
      resolver.resolve(makeContext())
      expect(resolver.getPendingConflicts().size).toBe(1)
    })

    it('should allow manual resolution', () => {
      const resolver = new ConflictResolver('ask', logger)
      const result = resolver.resolve(makeContext())
      if (result.action === 'ask') {
        const manual = resolver.resolveManual(result.conflictId, 'keep-local')
        expect(manual).toEqual({ action: 'keep-local' })
        expect(resolver.getPendingConflicts().size).toBe(0)
      }
    })

    it('should return null for unknown conflict ID', () => {
      const resolver = new ConflictResolver('ask', logger)
      expect(resolver.resolveManual('nonexistent', 'keep-local')).toBeNull()
    })
  })
})
