import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/channels'
import { PeerManager } from '../sync-engine/p2p/peer-manager'
import type { PeerEvent, PeerMessage } from '../shared/types/peer'
import type { Logger } from '../sync-engine/logger'

export function registerPeerHandlers(
  peerManager: PeerManager,
  _getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(IPC_CHANNELS.PEER_GET_DISCOVERED, () => {
    return peerManager.getDiscoveredPeers()
  })

  ipcMain.handle(IPC_CHANNELS.PEER_CONNECT, (_event, deviceId: string) => {
    peerManager.connectTo(deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.PEER_DISCONNECT, (_event, deviceId: string) => {
    peerManager.disconnectFrom(deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.PEER_GET_CONNECTED, () => {
    return peerManager.getConnectedPeers()
  })
}

export function createPeerManager(options: {
  deviceId: string
  publicKeyHex: string
  userId: string
  deviceName: string
  logger: Logger
  signFn: (data: Buffer | string) => Buffer
  verifyFn: (data: Buffer | string, signature: Buffer, publicKeyHex: string) => boolean
  getMainWindow: () => BrowserWindow | null
  onMessage: (deviceId: string, msg: PeerMessage) => void
  onPeerAuthenticated?: (deviceId: string) => void
}): PeerManager {
  const manager = new PeerManager({
    deviceId: options.deviceId,
    publicKeyHex: options.publicKeyHex,
    userId: options.userId,
    deviceName: options.deviceName,
    logger: options.logger,
    signFn: options.signFn,
    verifyFn: options.verifyFn,
    onEvent: (event: PeerEvent) => {
      const win = options.getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('peer:event', event)
        win.webContents.send('peer:list-updated', manager.getDiscoveredPeers())
      }
      if (event.type === 'peer-authenticated' && options.onPeerAuthenticated) {
        options.onPeerAuthenticated(event.deviceId)
      }
    },
    onMessage: options.onMessage,
  })

  return manager
}
