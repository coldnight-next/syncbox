import Bonjour, { type Service } from 'bonjour-service'
import type { PeerInfo } from '../../shared/types/peer'
import type { Logger } from '../logger'

const SERVICE_TYPE = 'syncbox'
const SERVICE_PROTOCOL = 'tcp'

export interface DiscoveryOptions {
  deviceId: string
  userId: string
  port: number
  deviceName: string
  logger: Logger
  onPeerDiscovered: (peer: PeerInfo) => void
  onPeerLost: (deviceId: string) => void
}

export class Discovery {
  private bonjour: InstanceType<typeof Bonjour> | null = null
  private browser: ReturnType<InstanceType<typeof Bonjour>['find']> | null = null
  private options: DiscoveryOptions
  private discoveredPeers = new Map<string, PeerInfo>()

  constructor(options: DiscoveryOptions) {
    this.options = options
  }

  start(): void {
    try {
      this.bonjour = new Bonjour()

      // Advertise this device
      this.bonjour.publish({
        name: `syncbox-${this.options.deviceId}`,
        type: SERVICE_TYPE,
        protocol: SERVICE_PROTOCOL,
        port: this.options.port,
        txt: {
          deviceId: this.options.deviceId,
          userId: this.options.userId,
          deviceName: this.options.deviceName,
        },
      })

      this.options.logger.info('mDNS service published', {
        deviceId: this.options.deviceId,
        port: this.options.port,
      })

      // Browse for other devices
      this.browser = this.bonjour.find(
        { type: SERVICE_TYPE, protocol: SERVICE_PROTOCOL },
        (service: Service) => this.handleServiceUp(service),
      )

      this.browser.on('down', (service: Service) => this.handleServiceDown(service))
    } catch (err) {
      this.options.logger.warn('mDNS discovery failed to start (LAN discovery unavailable)', {
        error: String(err),
      })
    }
  }

  stop(): void {
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
    if (this.bonjour) {
      this.bonjour.unpublishAll()
      this.bonjour.destroy()
      this.bonjour = null
    }
    this.discoveredPeers.clear()
    this.options.logger.info('mDNS discovery stopped')
  }

  getDiscoveredPeers(): PeerInfo[] {
    return Array.from(this.discoveredPeers.values())
  }

  private handleServiceUp(service: Service): void {
    const txt = service.txt as Record<string, string> | undefined
    if (!txt) return

    const deviceId = txt.deviceId
    const userId = txt.userId

    // Ignore self
    if (deviceId === this.options.deviceId) return

    // Only discover peers with the same userId
    if (userId !== this.options.userId) return

    const peer: PeerInfo = {
      deviceId,
      name: txt.deviceName ?? service.name,
      host: service.host ?? service.referer?.address ?? '127.0.0.1',
      port: service.port,
      userId,
    }

    this.discoveredPeers.set(deviceId, peer)
    this.options.logger.info('Peer discovered', { deviceId, name: peer.name })
    this.options.onPeerDiscovered(peer)
  }

  private handleServiceDown(service: Service): void {
    const txt = service.txt as Record<string, string> | undefined
    if (!txt?.deviceId) return

    const deviceId = txt.deviceId
    if (this.discoveredPeers.has(deviceId)) {
      this.discoveredPeers.delete(deviceId)
      this.options.logger.info('Peer lost', { deviceId })
      this.options.onPeerLost(deviceId)
    }
  }
}
