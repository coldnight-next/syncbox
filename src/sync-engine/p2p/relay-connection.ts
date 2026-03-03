import { WebSocket } from 'ws'
import type { PeerMessage } from '../../shared/types/peer'
import type { Logger } from '../logger'

export interface RelayConnectionOptions {
  relayUrl: string
  token: string
  deviceId: string
  logger: Logger
  getToken?: () => string | null
  onPeerJoined: (deviceId: string) => void
  onPeerLeft: (deviceId: string) => void
  onMessage: (msg: PeerMessage) => void
  onClose: () => void
}

const BASE_RECONNECT_MS = 5_000
const MAX_RECONNECT_MS = 300_000 // 5 minutes
const MAX_AUTH_FAILURES = 5

export class RelayConnection {
  private ws: WebSocket | null = null
  private options: RelayConnectionOptions
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = false
  private reconnectDelay = BASE_RECONNECT_MS
  private authFailures = 0

  constructor(options: RelayConnectionOptions) {
    this.options = options
  }

  connect(): void {
    this.stopped = false

    const token = this.options.getToken?.() ?? this.options.token
    if (!token) {
      this.options.logger.warn('No valid token for relay, will retry later')
      this.scheduleReconnect()
      return
    }

    const url = `${this.options.relayUrl}?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(this.options.deviceId)}`

    this.options.logger.info('Connecting to relay', { url: this.options.relayUrl })

    this.ws = new WebSocket(url)

    this.ws.on('open', () => {
      this.options.logger.info('Connected to relay server')
      // Reset backoff on successful connection
      this.reconnectDelay = BASE_RECONNECT_MS
      this.authFailures = 0
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

    this.ws.on('close', (_code: number) => {
      this.options.logger.info('Relay connection closed')
      this.options.onClose()
      this.scheduleReconnect()
    })

    this.ws.on('error', (err) => {
      const errStr = String(err)
      // Track auth failures for backoff
      if (errStr.includes('401')) {
        this.authFailures++
      }
      this.options.logger.error('Relay connection error', { error: errStr })
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

    if (this.authFailures >= MAX_AUTH_FAILURES) {
      this.options.logger.warn('Relay auth failed too many times, stopping reconnect', {
        failures: this.authFailures,
      })
      return
    }

    // Exponential backoff with jitter
    const jitter = Math.random() * 1000
    const delay = Math.min(this.reconnectDelay + jitter, MAX_RECONNECT_MS)
    this.options.logger.info('Relay reconnect scheduled', { delayMs: Math.round(delay) })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)

    // Increase delay for next attempt
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_MS)
  }
}
