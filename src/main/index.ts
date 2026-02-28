import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createAppWindow, setQuitting, registerAppProtocol, setupProtocolHandler } from './app-window'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray, setTraySyncEngine, updateTrayStatus } from './tray'
import { createAppMenu } from './menu'
import { initLogging, createLogger } from './logging'
import { initAutoUpdater, disposeAutoUpdater } from './auto-updater'
import { AuthManager, getDeviceId, getPublicKeyHex, sign, verifySignature, getDeviceName } from './auth'
import { createPeerManager, registerPeerHandlers } from './p2p-bridge'
import { SyncEngine } from '../sync-engine'
import type { PeerManager } from '../sync-engine/p2p/peer-manager'
import type { SyncEvent, SyncStatus } from '../shared/types/sync'
import type { AuthState, AuthEvent } from '../shared/types/auth'
import Store from 'electron-store'
import type { AppConfig } from '../shared/types/config'
import { DEFAULT_APP_CONFIG } from '../shared/types/config'
import { IPC_EVENTS } from '../shared/constants/channels'

initLogging()
const logger = createLogger('main')

// Persist settings across restarts
const settingsStore = new Store<{ syncFolder?: string; syncFolders?: string[]; config?: AppConfig }>({ name: 'syncbox-settings' })

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

  // Start relay connection if configured
  const config = getAppConfig()
  const relayUrl = config.relayUrl || (import.meta.env.MAIN_VITE_RELAY_URL ?? '')
  if (relayUrl && authManager) {
    const token = authManager.getAccessToken()
    if (token) {
      peerManager.startRelay(relayUrl, token)
      logger.info('Relay connection started', { relayUrl })
    }
  }
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

function getAppConfig(): AppConfig {
  return settingsStore.get('config') ?? { ...DEFAULT_APP_CONFIG }
}

function setAppConfig(partial: Partial<AppConfig>): void {
  const current = getAppConfig()
  const updated = { ...current, ...partial }
  settingsStore.set('config', updated)
  syncEngine?.updateConfig(updated)
}

let statsTimer: ReturnType<typeof setInterval> | null = null

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

// Must register custom protocol BEFORE app is ready
registerAppProtocol()

void app.whenReady().then(async () => {
  logger.info('App ready')
  electronApp.setAppUserModelId('com.syncbox.app')

  // Set up protocol handler to serve renderer files via syncbox-app://
  setupProtocolHandler()

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

  // Init Auto-Updater (always enabled — checks on startup + every 4 hours)
  initAutoUpdater(mainWindow)
  logger.info('Auto-updater initialized')

  // Init Auth — electron-vite exposes MAIN_VITE_* env vars via import.meta.env
  const publishableKey = import.meta.env.MAIN_VITE_CLERK_PUBLISHABLE_KEY ?? ''
  const secretKey = import.meta.env.MAIN_VITE_CLERK_SECRET_KEY ?? ''
  const oauthClientId = import.meta.env.MAIN_VITE_CLERK_OAUTH_CLIENT_ID ?? ''
  const redirectUri = import.meta.env.MAIN_VITE_CLERK_REDIRECT_URI ?? 'http://127.0.0.1:19876/callback'

  if (publishableKey && secretKey && oauthClientId) {
    authManager = new AuthManager({
      publishableKey,
      secretKey,
      oauthClientId,
      redirectUri,
      logger: createLogger('auth'),
      onEvent: (event: AuthEvent) => {
        sendToRenderer('auth:event', event)
        // Auto-start P2P when user signs in (via PKCE flow)
        if (event.type === 'signed-in') {
          startPeerSync(event.userId)
        }
        if (event.type === 'signed-out') {
          stopPeerSync()
        }
      },
      onStateChange: (state: AuthState) => {
        sendToRenderer('auth:state-changed', state)
      },
    })
    await authManager.initialize()
    logger.info('AuthManager initialized')

    // If AuthManager restored a session, start P2P immediately
    const restoredState = authManager.getState()
    if (restoredState.isAuthenticated && restoredState.userId) {
      logger.info('Restored auth session, starting P2P', { userId: restoredState.userId })
      startPeerSync(restoredState.userId)
    }
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
    getConfig: getAppConfig,
    setConfig: setAppConfig,
  })

  // Push realtime stats to renderer every 5 seconds
  statsTimer = setInterval(() => {
    if (syncEngine) {
      const point = syncEngine.getRealtimePoint()
      sendToRenderer(IPC_EVENTS.STATS_REALTIME_UPDATE, point)
    }
  }, 5000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createAppWindow()
    }
  })
})

// 'before-quit' fires when the app is truly quitting (Quit from tray, etc.)
app.on('before-quit', () => {
  setQuitting(true)
  disposeAutoUpdater()
  if (statsTimer) {
    clearInterval(statsTimer)
    statsTimer = null
  }
  stopPeerSync()
  void syncEngine?.stop()
  authManager?.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // The app stays alive in the tray. Quit is handled by the tray menu.
  }
})
