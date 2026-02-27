import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron'
import { join } from 'path'
import { setQuitting } from './app-window'
import type { SyncEngine } from '../sync-engine'

let tray: Tray | null = null
let currentStatus = 'Idle'
let isPaused = false
let syncEngineRef: SyncEngine | null = null
let mainWindowRef: BrowserWindow | null = null

function buildContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Show Syncbox',
      click: () => {
        if (mainWindowRef) {
          mainWindowRef.show()
          mainWindowRef.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: `Sync Status: ${currentStatus}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isPaused ? 'Resume Sync' : 'Pause Sync',
      click: () => {
        if (!syncEngineRef) return
        if (isPaused) {
          void syncEngineRef.resume()
          isPaused = false
        } else {
          void syncEngineRef.pause()
          isPaused = true
        }
        updateContextMenu()
      },
    },
    {
      label: 'Force Sync',
      click: () => {
        if (syncEngineRef) {
          void syncEngineRef.forceSync()
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        setQuitting(true)
        app.quit()
      },
    },
  ])
}

function updateContextMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu())
    tray.setToolTip(`Syncbox - ${currentStatus}`)
  }
}

export function createTray(mainWindow: BrowserWindow): Tray {
  mainWindowRef = mainWindow

  // Try to load the real icon, fall back to an empty one
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(join(__dirname, '../../build/icon.png'))
    // Resize for tray (16x16 on most platforms)
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Syncbox')
  tray.setContextMenu(buildContextMenu())

  tray.on('click', () => {
    if (mainWindowRef) {
      mainWindowRef.show()
      mainWindowRef.focus()
    }
  })

  return tray
}

/** Wire the tray to the SyncEngine so pause/resume/force sync work */
export function setTraySyncEngine(engine: SyncEngine): void {
  syncEngineRef = engine
}

export function updateTrayStatus(status: string): void {
  currentStatus = status
  updateContextMenu()
}
