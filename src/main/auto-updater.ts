import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'
import log from 'electron-log'

let mainWindow: BrowserWindow | null = null
let periodicCheckTimer: ReturnType<typeof setInterval> | null = null

// Check every 4 hours
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win
  autoUpdater.logger = log

  // Fully automatic: download immediately when available, install on quit
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Point at Vercel-hosted releases instead of GitHub
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://syncbox.vercel.app/releases',
  })

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

  autoUpdater.on('update-not-available', (info) => {
    log.info('No update available, current is latest:', info.version)
    sendToRenderer('update:not-available', {
      version: info.version,
    })
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

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded, will install on restart:', info.version)
    sendToRenderer('update:downloaded', {})
  })

  autoUpdater.on('error', (error) => {
    const raw = error?.message ?? 'Unknown error'
    // Provide a friendlier message for common network errors
    let message = raw
    if (raw.includes('net::ERR_') || raw.includes('ENOTFOUND') || raw.includes('ECONNREFUSED') || raw.includes('getaddrinfo')) {
      message = 'Could not reach the update server. Check your internet connection.'
    } else if (raw.includes('404') || raw.includes('Not Found')) {
      message = 'Update server not configured yet.'
    } else if (raw.includes('YAML') || raw.includes('yml')) {
      message = 'Invalid update manifest. The update server may not be set up.'
    }
    log.error('Auto-updater error:', raw)
    sendToRenderer('update:error', { message })
  })

  // Auto-check on startup after a short delay (let the app settle)
  // Wrap in try/catch so startup check never crashes the app
  setTimeout(() => {
    log.info('Running startup update check')
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('Startup update check failed (non-fatal):', err)
    })
  }, 10_000)

  // Periodic check every 4 hours
  periodicCheckTimer = setInterval(() => {
    log.info('Running periodic update check')
    autoUpdater.checkForUpdates().catch((err) => {
      log.warn('Periodic update check failed (non-fatal):', err)
    })
  }, CHECK_INTERVAL_MS)
}

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((err) => {
    log.warn('Manual update check failed:', err)
  })
}

export function downloadUpdate(): void {
  void autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}

export function disposeAutoUpdater(): void {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer)
    periodicCheckTimer = null
  }
}
