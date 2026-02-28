import { BrowserWindow, shell, app, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { is } from '@electron-toolkit/utils'

let quitting = false

const CUSTOM_SCHEME = 'syncbox-app'

/** Call this before app.quit() to allow window close instead of minimize-to-tray */
export function setQuitting(value: boolean): void {
  quitting = value
}

/**
 * Register the custom protocol scheme so Clerk gets a proper HTTP-like origin
 * instead of file://. Must be called BEFORE app.whenReady().
 */
export function registerAppProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CUSTOM_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

/**
 * Set up the protocol handler that serves renderer files.
 * Must be called AFTER app.whenReady().
 */
export function setupProtocolHandler(): void {
  protocol.handle(CUSTOM_SCHEME, (request) => {
    const url = new URL(request.url)
    // Map the request path to the renderer output directory
    let filePath = url.pathname
    if (filePath === '/' || filePath === '') {
      filePath = '/index.html'
    }
    const rendererDir = join(__dirname, '../renderer')
    const fullPath = join(rendererDir, filePath)
    return net.fetch(pathToFileURL(fullPath).toString())
  })
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
    // Load via custom protocol so Clerk SDK gets a proper origin
    void mainWindow.loadURL(`${CUSTOM_SCHEME}://app/`)
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
