import { WebSocket, WebSocketServer } from 'ws'
import { Discovery } from './discovery'
import { PeerConnection } from './peer-connection'
import type { PeerInfo, PeerEvent, PeerMessage } from '../../shared/types/peer'
import type { Logger } from '../logger'

const PEER_PORT = 19877

export interface PeerManagerOptions {
  deviceId: string
  publicKeyHex: string
  userId: string
  deviceName: string
  logger: Logger
  signFn: (data: Buffer | string) => Buffer
  verifyFn: (data: Buffer | string, signature: Buffer, publicKeyHex: string) => boolean
  onEvent: (event: PeerEvent) => void
  onMessage: (deviceId: string, msg: PeerMessage) => void
}

export class PeerManager {
  private options: PeerManagerOptions
  private discovery: Discovery
  private wss: WebSocketServer | null = null
  private connections = new Map<string, PeerConnection>()
  private discoveredPeers = new Map<string, PeerInfo>()

  constructor(options: PeerManagerOptions) {
    this.options = options

    this.discovery = new Discovery({
      deviceId: options.deviceId,
      userId: options.userId,
      port: PEER_PORT,
      deviceName: options.deviceName,
      logger: options.logger,
      onPeerDiscovered: (peer) => {
        this.discoveredPeers.set(peer.deviceId, peer)
        options.onEvent({ type: 'peer-discovered', peer })
        this.maybeConnect(peer)
      },
      onPeerLost: (deviceId) => {
        this.discoveredPeers.delete(deviceId)
        options.onEvent({ type: 'peer-lost', deviceId })
      },
    })
  }

  start(): void {
    this.wss = new WebSocketServer({ port: PEER_PORT })

    this.wss.on('connection', (ws: WebSocket) => {
      this.createConnection(ws, false)
    })

    this.wss.on('error', (err) => {
      this.options.logger.error('WebSocket server error', { error: String(err) })
    })

    this.options.logger.info('Peer WebSocket server started', { port: PEER_PORT })

    this.discovery.start()
  }

  stop(): void {
    this.discovery.stop()

    for (const conn of this.connections.values()) {
      conn.close()
    }
    this.connections.clear()
    this.discoveredPeers.clear()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    this.options.logger.info('PeerManager stopped')
  }

  getDiscoveredPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values())
  }

  getConnectedPeers(): PeerInfo[] {
    const connected: PeerInfo[] = []
    for (const [deviceId, conn] of this.connections) {
      if (conn.isAuthenticated()) {
        const peer = this.discoveredPeers.get(deviceId)
        if (peer) connected.push(peer)
      }
    }
    return connected
  }

  connectTo(deviceId: string): void {
    const peer = this.discoveredPeers.get(deviceId)
    if (!peer) {
      this.options.logger.warn('Cannot connect: peer not discovered', { deviceId })
      return
    }
    this.initiateConnection(peer)
  }

  disconnectFrom(deviceId: string): void {
    const conn = this.connections.get(deviceId)
    if (conn) {
      conn.close()
      this.connections.delete(deviceId)
    }
  }

  sendTo(deviceId: string, msg: PeerMessage): void {
    const conn = this.connections.get(deviceId)
    if (conn?.isAuthenticated()) {
      conn.send(msg)
    }
  }

  broadcast(msg: PeerMessage): void {
    for (const conn of this.connections.values()) {
      if (conn.isAuthenticated()) {
        conn.send(msg)
      }
    }
  }

  private maybeConnect(peer: PeerInfo): void {
    // Lower deviceId initiates the connection
    if (this.options.deviceId < peer.deviceId && !this.connections.has(peer.deviceId)) {
      this.initiateConnection(peer)
    }
  }

  private initiateConnection(peer: PeerInfo): void {
    if (this.connections.has(peer.deviceId)) return

    const ws = new WebSocket(`ws://${peer.host}:${peer.port}`)

    ws.on('open', () => {
      const conn = this.createConnection(ws, true)
      conn.initiateHandshake()
    })

    ws.on('error', (err) => {
      this.options.logger.error('Connection failed', {
        deviceId: peer.deviceId,
        error: String(err),
      })
      this.options.onEvent({
        type: 'peer-error',
        deviceId: peer.deviceId,
        error: String(err),
      })
    })
  }

  private createConnection(ws: WebSocket, isInitiator: boolean): PeerConnection {
    const conn = new PeerConnection({
      ws,
      localDeviceId: this.options.deviceId,
      localPublicKeyHex: this.options.publicKeyHex,
      localUserId: this.options.userId,
      signFn: this.options.signFn,
      verifyFn: this.options.verifyFn,
      logger: this.options.logger,
      onAuthenticated: (remoteDeviceId) => {
        this.connections.set(remoteDeviceId, conn)
        this.options.onEvent({ type: 'peer-authenticated', deviceId: remoteDeviceId })
        this.options.onEvent({ type: 'peer-connected', deviceId: remoteDeviceId })
      },
      onMessage: (msg) => {
        const remoteId = conn.getRemoteDeviceId()
        if (remoteId) {
          this.options.onMessage(remoteId, msg)
        }
      },
      onClose: (remoteDeviceId) => {
        this.connections.delete(remoteDeviceId)
        this.options.onEvent({ type: 'peer-disconnected', deviceId: remoteDeviceId })
      },
    })

    if (isInitiator) {
      // Will call initiateHandshake from the open handler
    }

    return conn
  }
}
