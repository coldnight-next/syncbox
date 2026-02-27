import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from 'electron-log'

let mainWindow: BrowserWindow | null = null

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win
  autoUpdater.logger = log
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version)
    sendToRenderer('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('No update available')
  })

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`)
    sendToRenderer('update:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded, will install on quit')
    sendToRenderer('update:downloaded', {})
  })

  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error)
  })
}

export function checkForUpdates(): void {
  void autoUpdater.checkForUpdates()
}

export function downloadUpdate(): void {
  void autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
