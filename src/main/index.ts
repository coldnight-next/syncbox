import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow, setQuitting } from './app-window'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray, setTraySyncEngine, updateTrayStatus } from './tray'
import { createAppMenu } from './menu'
import { initLogging, createLogger } from './logging'
import { initAutoUpdater } from './auto-updater'
import { AuthManager, getDeviceId, getPublicKeyHex, sign, verifySignature, getDeviceName } from './auth'
import { createPeerManager, registerPeerHandlers } from './p2p-bridge'
import { SyncEngine } from '../sync-engine'
import type { PeerManager } from '../sync-engine/p2p/peer-manager'
import type { SyncEvent, SyncStatus } from '../shared/types/sync'
import type { AuthState, AuthEvent } from '../shared/types/auth'
import Store from 'electron-store'

initLogging()
const logger = createLogger('main')

// Persist sync folder paths across restarts
const settingsStore = new Store<{ syncFolder?: string; syncFolders?: string[] }>({ name: 'syncbox-settings' })

let mainWindow: BrowserWindow | null = null
let syncEngine: SyncEngine | null = null
let authManager: AuthManager | null = null
let peerManager: PeerManager | null = null

// Migrate legacy single-folder setting to array
const legacySingle = settingsStore.get('syncFolder') ?? null
const storedFolders = settingsStore.get('syncFolders') ?? []
let currentSyncFolders: string[] = storedFolders.length > 0
  ? storedFolders
  : legacySingle ? [legacySingle] : []

// Register syncbox:// protocol for OAuth callback in production
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('syncbox', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('syncbox')
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function startPeerSync(userId: string): void {
  if (peerManager) return // already running

  const deviceId = getDeviceId()
  const publicKeyHex = getPublicKeyHex()
  const deviceName = getDeviceName()
  const peerLogger = createLogger('p2p')

  if (!syncEngine) return

  peerManager = createPeerManager({
    deviceId,
    publicKeyHex,
    userId,
    deviceName,
    logger: peerLogger,
    signFn: sign,
    verifyFn: verifySignature,
    getMainWindow,
    onMessage: (_fromDeviceId, msg) => {
      syncEngine?.handlePeerMessage(_fromDeviceId, msg)
    },
  })

  syncEngine.setPeerManager(peerManager)
  registerPeerHandlers(peerManager, getMainWindow)
  peerManager.start()
  logger.info('PeerManager started', { deviceId, userId })
}

function stopPeerSync(): void {
  if (peerManager) {
    peerManager.stop()
    peerManager = null
    logger.info('PeerManager stopped')
  }
}

function persistFolders(): void {
  settingsStore.set('syncFolders', currentSyncFolders)
}

async function addSyncFolder(folderPath: string): Promise<void> {
  if (currentSyncFolders.includes(folderPath)) return
  currentSyncFolders.push(folderPath)
  persistFolders()
  logger.info('Sync folder added', { folderPath, total: currentSyncFolders.length })

  if (syncEngine) {
    await syncEngine.stop()
    syncEngine.setWatchPaths(currentSyncFolders)
    await syncEngine.start()
  }
}

async function removeSyncFolder(folderPath: string): Promise<void> {
  currentSyncFolders = currentSyncFolders.filter((f) => f !== folderPath)
  persistFolders()
  logger.info('Sync folder removed', { folderPath, total: currentSyncFolders.length })

  if (syncEngine) {
    await syncEngine.stop()
    syncEngine.setWatchPaths(currentSyncFolders)
    if (currentSyncFolders.length > 0) {
      await syncEngine.start()
    }
  }
}

void app.whenReady().then(async () => {
  logger.info('App ready')
  electronApp.setAppUserModelId('com.syncbox.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createAppWindow()
  createAppMenu()
  createTray(mainWindow)

  // If launched with --hidden (auto-start), don't show the window
  if (process.argv.includes('--hidden')) {
    mainWindow.hide()
  }

  // Init Auto-Updater
  if (process.env.MAIN_AUTO_UPDATE === 'true') {
    initAutoUpdater(mainWindow)
    logger.info('Auto-updater initialized')
  }

  // Init Auth — electron-vite exposes MAIN_VITE_* env vars via import.meta.env
  const publishableKey = import.meta.env.MAIN_VITE_CLERK_PUBLISHABLE_KEY ?? ''
  const secretKey = import.meta.env.MAIN_VITE_CLERK_SECRET_KEY ?? ''
  const redirectUri = import.meta.env.MAIN_VITE_CLERK_REDIRECT_URI ?? 'http://127.0.0.1:19876/callback'

  if (publishableKey && secretKey) {
    authManager = new AuthManager({
      publishableKey,
      secretKey,
      redirectUri,
      logger: createLogger('auth'),
      onEvent: (event: AuthEvent) => {
        sendToRenderer('auth:event', event)
      },
      onStateChange: (state: AuthState) => {
        sendToRenderer('auth:state-changed', state)
      },
    })
    await authManager.initialize()
    logger.info('AuthManager initialized')
  } else {
    logger.warn('Clerk keys not configured, auth disabled')
  }

  // Init Sync Engine
  const userDataPath = app.getPath('userData')

  syncEngine = new SyncEngine({
    watchPaths: currentSyncFolders,
    dbPath: `${userDataPath}/syncbox-metadata.db`,
    deviceId: getDeviceId(),
    config: {
      debounceMs: 500,
      windowMs: 2000,
      maxPendingEvents: 10000,
      ignoredPatterns: ['*.tmp', '.git/**', 'node_modules/**', '.syncbox/**'],
      immediatePatterns: [],
    },
    conflictStrategy: 'ask',
    logger: createLogger('sync-engine'),
    onEvent: (event: SyncEvent) => {
      sendToRenderer('sync:event', event)
    },
    onStatusChange: (status: SyncStatus) => {
      sendToRenderer('sync:status', status)
      updateTrayStatus(status.state === 'syncing' ? 'Syncing...' : status.state === 'paused' ? 'Paused' : 'Idle')
    },
  })

  setTraySyncEngine(syncEngine)

  // Auto-start sync engine if folders are already configured
  if (currentSyncFolders.length > 0) {
    await syncEngine.start()
    logger.info('SyncEngine auto-started', { folders: currentSyncFolders })
  }

  registerIpcHandlers(syncEngine, authManager ?? undefined, {
    onUserAuthenticated: (userId) => {
      startPeerSync(userId)
    },
    onUserSignedOut: () => {
      stopPeerSync()
    },
    onSyncFolderChanged: (folderPath) => {
      void addSyncFolder(folderPath)
    },
    onSyncFolderAdded: (folderPath) => {
      void addSyncFolder(folderPath)
    },
    onSyncFolderRemoved: (folderPath) => {
      void removeSyncFolder(folderPath)
    },
    getSyncFolder: () => currentSyncFolders[0] ?? null,
    getSyncFolders: () => currentSyncFolders,
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createAppWindow()
    }
  })
})

// 'before-quit' fires when the app is truly quitting (Quit from tray, etc.)
app.on('before-quit', () => {
  setQuitting(true)
  stopPeerSync()
  void syncEngine?.stop()
  authManager?.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // The app stays alive in the tray. Quit is handled by the tray menu.
  }
})
