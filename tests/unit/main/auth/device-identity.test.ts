import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

vi.mock('electron-store', () => {
  const storage = new Map<string, unknown>()
  return {
    default: class MockStore {
      get(key: string) { return storage.get(key) }
      set(key: string, value: unknown) { storage.set(key, value) }
      delete(key: string) { storage.delete(key) }
      static _storage = storage
    },
  }
})

let mod: typeof import('../../../../src/main/auth/device-identity')

beforeEach(async () => {
  vi.resetModules()
  // Clear the mock storage
  const { default: MockStore } = await import('electron-store') as unknown as {
    default: { _storage: Map<string, unknown> }
  }
  MockStore._storage.clear()
  mod = await import('../../../../src/main/auth/device-identity')
})

describe('device-identity', () => {
  it('should generate a consistent device ID', () => {
    const id1 = mod.getDeviceId()
    const id2 = mod.getDeviceId()
    expect(id1).toBe(id2)
    expect(id1).toHaveLength(16)
    expect(id1).toMatch(/^[0-9a-f]+$/)
  })

  it('should produce a public key hex', () => {
    const hex = mod.getPublicKeyHex()
    expect(hex).toMatch(/^[0-9a-f]+$/)
    expect(hex.length).toBeGreaterThan(32)
  })

  it('should sign and verify round-trip', () => {
    const data = 'test-challenge-data'
    const signature = mod.sign(data)
    const publicKeyHex = mod.getPublicKeyHex()

    expect(signature).toBeInstanceOf(Buffer)
    expect(signature.length).toBeGreaterThan(0)

    const isValid = mod.verifySignature(data, signature, publicKeyHex)
    expect(isValid).toBe(true)
  })

  it('should reject invalid signatures', () => {
    const data = 'test-challenge-data'
    const signature = mod.sign(data)
    const publicKeyHex = mod.getPublicKeyHex()

    // Corrupt the signature
    const corrupted = Buffer.from(signature)
    corrupted[0] = corrupted[0] ^ 0xff

    const isValid = mod.verifySignature(data, corrupted, publicKeyHex)
    expect(isValid).toBe(false)
  })

  it('should reject signature with wrong public key', () => {
    const data = 'test-challenge-data'
    const signature = mod.sign(data)

    // Generate a different keypair
    const otherKeyPair = crypto.generateKeyPairSync('ed25519')
    const otherPubHex = Buffer.from(
      otherKeyPair.publicKey.export({ format: 'der', type: 'spki' }),
    ).toString('hex')

    const isValid = mod.verifySignature(data, signature, otherPubHex)
    expect(isValid).toBe(false)
  })

  it('should persist keypair across reloads', async () => {
    const id1 = mod.getDeviceId()
    const pubKey1 = mod.getPublicKeyHex()

    // Reset module cache but keep storage
    vi.resetModules()
    const mod2 = await import('../../../../src/main/auth/device-identity')

    expect(mod2.getDeviceId()).toBe(id1)
    expect(mod2.getPublicKeyHex()).toBe(pubKey1)
  })
})
