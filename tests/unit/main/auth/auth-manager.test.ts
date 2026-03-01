import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthState, AuthEvent } from '@shared/types/auth'

// Mock electron modules
vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
}))

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

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    users: {
      getUser: vi.fn().mockResolvedValue({
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
        imageUrl: 'https://example.com/avatar.jpg',
        publicMetadata: { pairedDevices: [] },
      }),
      updateUser: vi.fn().mockResolvedValue({}),
    },
  }),
}))

vi.mock('../../../../src/main/auth/device-identity', () => ({
  getDeviceId: () => 'abc123def456',
  getDeviceName: () => 'Test-PC',
  getPublicKeyHex: () => 'deadbeef',
}))

vi.mock('../../../../src/main/auth/callback-server', () => ({
  startCallbackServer: vi.fn(),
}))

let AuthManager: typeof import('../../../../src/main/auth/auth-manager').AuthManager

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../../../src/main/auth/auth-manager')
  AuthManager = mod.AuthManager
  // Clear storage
  const { default: MockStore } = await import('electron-store') as unknown as {
    default: { _storage: Map<string, unknown> }
  }
  MockStore._storage.clear()
})

describe('AuthManager', () => {
  function createManager() {
    const events: AuthEvent[] = []
    const states: AuthState[] = []
    const manager = new AuthManager({
      publishableKey: 'pk_test_example.clerk.accounts.dev',
      secretKey: 'sk_test_secret',
      oauthClientId: 'client_test_123',
      oauthClientSecret: 'secret_test_456',
      redirectUri: 'http://127.0.0.1:19876/callback',
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      onEvent: (e) => events.push(e),
      onStateChange: (s) => states.push(s),
    })
    return { manager, events, states }
  }

  it('should start with unauthenticated state', () => {
    const { manager } = createManager()
    const state = manager.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.userId).toBeNull()
  })

  it('should return device ID', () => {
    const { manager } = createManager()
    expect(manager.getDeviceId()).toBe('abc123def456')
  })

  it('should return empty devices when not authenticated', async () => {
    const { manager } = createManager()
    const devices = await manager.getPairedDevices()
    expect(devices).toEqual([])
  })

  it('should emit signed-out event on signOut', async () => {
    const { manager, events, states } = createManager()
    await manager.signOut()
    expect(events).toContainEqual({ type: 'signed-out' })
    expect(states[states.length - 1].isAuthenticated).toBe(false)
  })

  it('should clean up on dispose', () => {
    const { manager } = createManager()
    expect(() => manager.dispose()).not.toThrow()
  })
})
