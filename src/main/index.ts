import { app, shell, BrowserWindow, session } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { connectionManager } from './db/manager'
import { appDatabase } from './services/database'
import { logger } from './utils/logger'
import { createAppMenu, cleanupWindowMenuState, refreshMenuForFocusedWindow } from './menu'
import { initAutoUpdater, checkForUpdates } from './services/autoUpdater'
import { windowManager, type WindowInitData } from './services/windowManager'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,Autofill')

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox')
}

const isMac = process.platform === 'darwin'

const getWindowOptions = (): BrowserWindowConstructorOptions => {
  const base: BrowserWindowConstructorOptions = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      v8CacheOptions: 'bypassHeatCheck'
    }
  }

  if (isMac) {
    return {
      ...base,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 12 },
      vibrancy: 'sidebar',
      visualEffectState: 'active'
    }
  }

  return base
}

const createWindow = (initData?: WindowInitData): void => {
  const win = new BrowserWindow(getWindowOptions())
  windowManager.add(win)

  const webContentsId = win.webContents.id

  if (initData) {
    windowManager.setPendingInitData(webContentsId, initData)
  }

  win.on('ready-to-show', () => {
    if (!process.env.E2E) {
      win.show()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // DevTools available via F12 / Cmd+Option+I (handled by optimizer.watchWindowShortcuts)
  // Not auto-opened to avoid ~1s startup penalty

  // Rebuild menu when this window gains focus (per-window state)
  win.on('focus', () => {
    refreshMenuForFocusedWindow()
  })

  win.on('closed', () => {
    cleanupWindowMenuState(webContentsId)
    windowManager.cleanupForWindow(webContentsId)
    windowManager.remove(win)
  })

  // Create app menu for the first window (macOS menu is app-global)
  if (windowManager.count() === 1) {
    createAppMenu(win)
  }
}

// Register with windowManager so IPC handlers can open windows without circular imports
windowManager.registerCreateWindow(createWindow)

app.whenReady().then(() => {
  logger.info('App starting')

  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.zequel')

  // Configure the native About panel
  app.setAboutPanelOptions({
    applicationName: 'Zequel',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: `© ${new Date().getFullYear()} Zequel`
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const scriptSrc = is.dev
      ? "script-src 'self' 'unsafe-eval' blob:;"
      : "script-src 'self' blob:;"
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; ${scriptSrc} style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:;`
        ]
      }
    })
  })

  // Initialize database first (IPC handlers depend on it)
  appDatabase.initialize()

  // Register IPC handlers before window loads (must be ready when renderer requests)
  registerAllHandlers()

  // Create window after backend is fully ready
  createWindow()

  // Initialize auto-updater (production only, deferred)
  if (!is.dev) {
    initAutoUpdater()
    setTimeout(() => {
      checkForUpdates()
    }, 5000)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (windowManager.count() === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('will-quit', async () => {
  logger.info('App quitting, cleaning up connections')
  await connectionManager.disconnectAll()
  appDatabase.close()
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason)
})
