import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PeerInfo } from '../../../../src/shared/types/peer'

// Mock bonjour-service
const mockPublish = vi.fn()
const mockUnpublishAll = vi.fn()
const mockDestroy = vi.fn()
const mockBrowserOn = vi.fn()
const mockBrowserStop = vi.fn()
const mockFindCallback = vi.fn()

vi.mock('bonjour-service', () => {
  return {
    default: class MockBonjour {
      publish = mockPublish
      unpublishAll = mockUnpublishAll
      destroy = mockDestroy
      find(_opts: unknown, cb: (service: unknown) => void) {
        mockFindCallback.mockImplementation(cb)
        return {
          on: mockBrowserOn,
          stop: mockBrowserStop,
        }
      }
    },
  }
})

let Discovery: typeof import('../../../../src/sync-engine/p2p/discovery').Discovery

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  const mod = await import('../../../../src/sync-engine/p2p/discovery')
  Discovery = mod.Discovery
})

describe('Discovery', () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  it('should publish mDNS service on start', () => {
    const discovered: PeerInfo[] = []
    const discovery = new Discovery({
      deviceId: 'device-a',
      userId: 'user-1',
      port: 19877,
      deviceName: 'Test PC',
      logger,
      onPeerDiscovered: (p) => discovered.push(p),
      onPeerLost: vi.fn(),
    })

    discovery.start()

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'syncbox-device-a',
        type: 'syncbox',
        port: 19877,
        txt: expect.objectContaining({ deviceId: 'device-a', userId: 'user-1' }),
      }),
    )
  })

  it('should filter peers by userId', () => {
    const discovered: PeerInfo[] = []
    const discovery = new Discovery({
      deviceId: 'device-a',
      userId: 'user-1',
      port: 19877,
      deviceName: 'Test PC',
      logger,
      onPeerDiscovered: (p) => discovered.push(p),
      onPeerLost: vi.fn(),
    })

    discovery.start()

    // Simulate discovery of a peer with same userId
    mockFindCallback({
      txt: { deviceId: 'device-b', userId: 'user-1', deviceName: 'Other PC' },
      host: '192.168.1.100',
      port: 19877,
      name: 'syncbox-device-b',
    })

    expect(discovered).toHaveLength(1)
    expect(discovered[0].deviceId).toBe('device-b')

    // Simulate discovery of a peer with different userId - should be ignored
    mockFindCallback({
      txt: { deviceId: 'device-c', userId: 'user-2', deviceName: 'Stranger' },
      host: '192.168.1.200',
      port: 19877,
      name: 'syncbox-device-c',
    })

    expect(discovered).toHaveLength(1)
  })

  it('should ignore self-discovery', () => {
    const discovered: PeerInfo[] = []
    const discovery = new Discovery({
      deviceId: 'device-a',
      userId: 'user-1',
      port: 19877,
      deviceName: 'Test PC',
      logger,
      onPeerDiscovered: (p) => discovered.push(p),
      onPeerLost: vi.fn(),
    })

    discovery.start()

    mockFindCallback({
      txt: { deviceId: 'device-a', userId: 'user-1', deviceName: 'Test PC' },
      host: '127.0.0.1',
      port: 19877,
      name: 'syncbox-device-a',
    })

    expect(discovered).toHaveLength(0)
  })

  it('should stop cleanly', () => {
    const discovery = new Discovery({
      deviceId: 'device-a',
      userId: 'user-1',
      port: 19877,
      deviceName: 'Test PC',
      logger,
      onPeerDiscovered: vi.fn(),
      onPeerLost: vi.fn(),
    })

    discovery.start()
    discovery.stop()

    expect(mockBrowserStop).toHaveBeenCalled()
    expect(mockUnpublishAll).toHaveBeenCalled()
    expect(mockDestroy).toHaveBeenCalled()
    expect(discovery.getDiscoveredPeers()).toEqual([])
  })
})
