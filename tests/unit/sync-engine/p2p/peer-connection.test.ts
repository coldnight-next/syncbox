import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'

// Create a mock WebSocket class
class MockWebSocket extends EventEmitter {
  static OPEN = 1
  readyState = 1
  sent: Buffer[] = []

  send(data: Buffer) {
    this.sent.push(data)
  }

  close() {
    this.emit('close')
  }
}

vi.mock('ws', () => ({
  WebSocket: MockWebSocket,
}))

let PeerConnection: typeof import('../../../../src/sync-engine/p2p/peer-connection').PeerConnection

beforeEach(async () => {
  vi.resetModules()
  const mod = await import('../../../../src/sync-engine/p2p/peer-connection')
  PeerConnection = mod.PeerConnection
})

describe('PeerConnection handshake', () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }

  function createKeyPair() {
    const kp = crypto.generateKeyPairSync('ed25519')
    const pubHex = Buffer.from(kp.publicKey.export({ format: 'der', type: 'spki' })).toString('hex')
    return {
      publicKeyHex: pubHex,
      sign: (data: Buffer | string) => crypto.sign(null, Buffer.from(data), kp.privateKey),
      verify: (data: Buffer | string, sig: Buffer, pkhex: string) => {
        const pk = crypto.createPublicKey({ key: Buffer.from(pkhex, 'hex'), format: 'der', type: 'spki' })
        return crypto.verify(null, Buffer.from(data), pk, sig)
      },
    }
  }

  it('should complete mutual handshake between initiator and responder', () => {
    const kpA = createKeyPair()
    const kpB = createKeyPair()

    const wsA = new MockWebSocket()
    const wsB = new MockWebSocket()

    const authenticatedA: string[] = []
    const authenticatedB: string[] = []

    const connA = new PeerConnection({
      ws: wsA as unknown as import('ws').WebSocket,
      localDeviceId: 'device-a',
      localPublicKeyHex: kpA.publicKeyHex,
      localUserId: 'user-1',
      signFn: kpA.sign,
      verifyFn: kpA.verify,
      logger,
      onAuthenticated: (id) => authenticatedA.push(id),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    const connB = new PeerConnection({
      ws: wsB as unknown as import('ws').WebSocket,
      localDeviceId: 'device-b',
      localPublicKeyHex: kpB.publicKeyHex,
      localUserId: 'user-1',
      signFn: kpB.sign,
      verifyFn: kpB.verify,
      logger,
      onAuthenticated: (id) => authenticatedB.push(id),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    // Step 1: A initiates handshake
    connA.initiateHandshake()
    expect(wsA.sent).toHaveLength(1)

    // Relay A's handshake to B
    wsB.emit('message', wsA.sent[0])
    expect(wsB.sent).toHaveLength(1)

    // Step 2: Relay B's response back to A
    wsA.emit('message', wsB.sent[0])

    // A should have sent the final ack
    expect(wsA.sent).toHaveLength(2)
    expect(authenticatedA).toEqual(['device-b'])

    // Step 3: Relay A's ack to B
    wsB.emit('message', wsA.sent[1])
    expect(authenticatedB).toEqual(['device-a'])

    // Both should be authenticated
    expect(connA.isAuthenticated()).toBe(true)
    expect(connB.isAuthenticated()).toBe(true)
    expect(connA.getRemoteDeviceId()).toBe('device-b')
    expect(connB.getRemoteDeviceId()).toBe('device-a')
  })

  it('should reject handshake from different user', () => {
    const kpA = createKeyPair()
    const kpB = createKeyPair()

    const wsA = new MockWebSocket()
    const wsB = new MockWebSocket()
    const closeSpy = vi.spyOn(wsB, 'close')

    new PeerConnection({
      ws: wsA as unknown as import('ws').WebSocket,
      localDeviceId: 'device-a',
      localPublicKeyHex: kpA.publicKeyHex,
      localUserId: 'user-1',
      signFn: kpA.sign,
      verifyFn: kpA.verify,
      logger,
      onAuthenticated: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    new PeerConnection({
      ws: wsB as unknown as import('ws').WebSocket,
      localDeviceId: 'device-b',
      localPublicKeyHex: kpB.publicKeyHex,
      localUserId: 'user-2', // Different user
      signFn: kpB.sign,
      verifyFn: kpB.verify,
      logger,
      onAuthenticated: vi.fn(),
      onMessage: vi.fn(),
      onClose: vi.fn(),
    })

    // A initiates with user-1
    const msg = JSON.stringify({
      type: 'handshake',
      id: 'test',
      payload: {
        deviceId: 'device-a',
        publicKeyHex: kpA.publicKeyHex,
        userId: 'user-1',
        challenge: 'abc',
      },
    })

    wsB.emit('message', Buffer.from(msg))
    expect(closeSpy).toHaveBeenCalled()
  })
})
