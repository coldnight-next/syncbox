import { WebSocket } from 'ws'
import type { PeerMessage } from '../../shared/types/peer'
import type { Logger } from '../logger'

export interface RelayConnectionOptions {
  relayUrl: string
  token: string
  deviceId: string
  logger: Logger
  onPeerJoined: (deviceId: string) => void
  onPeerLeft: (deviceId: string) => void
  onMessage: (msg: PeerMessage) => void
  onClose: () => void
}

export class RelayConnection {
  private ws: WebSocket | null = null
  private options: RelayConnectionOptions
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false

  constructor(options: RelayConnectionOptions) {
    this.options = options
  }

  connect(): void {
    this.stopped = false
    const url = `${this.options.relayUrl}?token=${encodeURIComponent(this.options.token)}&deviceId=${encodeURIComponent(this.options.deviceId)}`

    this.options.logger.info('Connecting to relay', { url: this.options.relayUrl })

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.options.logger.info('Connected to relay server')
    })

    this.ws.on('message', (raw: Buffer | string) => {
      try {
        const text = typeof raw === 'string' ? raw : raw.toString('utf-8')
        const parsed = JSON.parse(text) as Record<string, unknown>

        // Handle relay control messages
        if (parsed.type === 'relay:peer-joined') {
          this.options.onPeerJoined(parsed.deviceId as string)
          return
        }
        if (parsed.type === 'relay:peer-left') {
          this.options.onPeerLeft(parsed.deviceId as string)
          return
        }

        // Forward as PeerMessage
        this.options.onMessage(parsed as unknown as PeerMessage)
      } catch (err) {
        this.options.logger.error('Failed to parse relay message', { error: String(err) })
      }
    })

    this.ws.on('close', () => {
      this.options.logger.info('Relay connection closed')
      this.options.onClose()
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      this.options.logger.error('Relay connection error', { error: String(err) })
    })
  }

  send(msg: PeerMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
      return true
    }
    return false
  }

  close(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 5000)
  }
}
