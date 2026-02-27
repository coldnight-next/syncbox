import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../shared/constants/channels'
import type { SyncEngine } from '../sync-engine'
import type { AuthManager } from './auth'
import { checkForUpdates, downloadUpdate, installUpdate } from './auto-updater'
import { writeLogEntry, createLogger } from './logging'
import type { StructuredLogEntry } from '../shared/types/logging'

const logger = createLogger('ipc')

export function registerIpcHandlers(
  syncEngine: SyncEngine,
  authManager?: AuthManager,
  callbacks?: {
    onUserAuthenticated?: (userId: string) => void
    onUserSignedOut?: () => void
    onSyncFolderChanged?: (folderPath: string) => void
    onSyncFolderAdded?: (folderPath: string) => void
    onSyncFolderRemoved?: (folderPath: string) => void
    getSyncFolder?: () => string | null
    getSyncFolders?: () => string[]
  },
): void {
  // Logging
  ipcMain.handle(IPC_CHANNELS.LOG_WRITE, (_event, entry: StructuredLogEntry) => {
    writeLogEntry(entry)
  })

  // Sync
  ipcMain.handle(IPC_CHANNELS.SYNC_START, async () => {
    await syncEngine.start()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_STOP, async () => {
    await syncEngine.stop()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_FORCE, async (_event, filePath?: string) => {
    await syncEngine.forceSync(filePath)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, () => {
    return syncEngine.getStatus()
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_CONFLICTS, () => {
    return syncEngine.getConflicts()
  })

  ipcMain.handle(
    IPC_CHANNELS.SYNC_RESOLVE_CONFLICT,
    async (_event, id: string, resolution: string) => {
      await syncEngine.resolveConflict(
        id,
        resolution as 'keep-local' | 'keep-remote' | 'keep-both' | 'skip',
      )
    },
  )

  ipcMain.handle(IPC_CHANNELS.SYNC_SET_FOLDER, async (_event, folderPath: string) => {
    logger.info('Sync folder set', { folderPath })
    callbacks?.onSyncFolderChanged?.(folderPath)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_FOLDER, () => {
    return callbacks?.getSyncFolder?.() ?? null
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_ADD_FOLDER, (_event, folderPath: string) => {
    logger.info('Sync folder added', { folderPath })
    callbacks?.onSyncFolderAdded?.(folderPath)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_REMOVE_FOLDER, (_event, folderPath: string) => {
    logger.info('Sync folder removed', { folderPath })
    callbacks?.onSyncFolderRemoved?.(folderPath)
  })

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_FOLDERS, () => {
    return callbacks?.getSyncFolders?.() ?? []
  })

  // Config
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => {
    return {
      syncFolder: callbacks?.getSyncFolder?.() ?? '',
      maxConcurrentTransfers: 4,
      conflictStrategy: 'ask',
      enableNotifications: true,
      autoStart: false,
      theme: 'system',
    }
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, _config: Record<string, unknown>) => {
    // TODO: persist config via electron-store
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Sync Folder',
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // Auth
  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_IN, async () => {
    // No-op: sign-in is handled by Clerk React in the renderer.
    // Use auth:set-user to notify main of the authenticated user.
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SET_USER, (_event, userId: string) => {
    logger.info('User authenticated via Clerk', { userId })
    callbacks?.onUserAuthenticated?.(userId)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SIGN_OUT, async () => {
    callbacks?.onUserSignedOut?.()
    await authManager?.signOut()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_STATE, () => {
    return authManager?.getState() ?? {
      isAuthenticated: false,
      userId: null,
      email: null,
      displayName: null,
      avatarUrl: null,
      devices: [],
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_REFRESH, async () => {
    // Handled automatically by AuthManager
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_DEVICE_ID, () => {
    return authManager?.getDeviceId() ?? ''
  })

  // Devices
  ipcMain.handle(IPC_CHANNELS.DEVICE_PAIR, async (_event, deviceId: string) => {
    await authManager?.pairDevice(deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.DEVICE_UNPAIR, async (_event, deviceId: string) => {
    await authManager?.unpairDevice(deviceId)
  })

  ipcMain.handle(IPC_CHANNELS.DEVICE_GET_PAIRED, async () => {
    return (await authManager?.getPairedDevices()) ?? []
  })

  ipcMain.handle(IPC_CHANNELS.DEVICE_RENAME, async (_event, deviceId: string, name: string) => {
    await authManager?.renameDevice(deviceId, name)
  })

  // Updates
  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, () => {
    checkForUpdates()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, () => {
    downloadUpdate()
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_INSTALL, () => {
    installUpdate()
  })
}
