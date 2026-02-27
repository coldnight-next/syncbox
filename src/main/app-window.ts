import { BrowserWindow, shell, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let quitting = false

/** Call this before app.quit() to allow window close instead of minimize-to-tray */
export function setQuitting(value: boolean): void {
  quitting = value
}

export function createAppWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    minWidth: 600,
    minHeight: 400,
    show: false,
    title: 'Syncbox',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'bottom' })
    }
  })

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

/** Configure the app to launch on system startup (Windows / macOS / Linux) */
export function setAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    args: ['--hidden'],
  })
}

/** Check if auto-launch is enabled */
export function getAutoLaunch(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
