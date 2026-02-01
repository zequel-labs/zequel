import { app, shell, BrowserWindow, session } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { connectionManager } from './db/manager'
import { appDatabase } from './services/database'
import { logger } from './utils/logger'
import { createAppMenu } from './menu'
import { initAutoUpdater, checkForUpdates } from './services/autoUpdater'

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,Autofill')

const isMac = process.platform === 'darwin'

let mainWindow: BrowserWindow | null = null

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
      nodeIntegration: false
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

const createWindow = (): void => {
  mainWindow = new BrowserWindow(getWindowOptions())

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in development
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  logger.info('App starting')

  // Initialize app database (SQLite for storing connections, history, etc.)
  appDatabase.initialize()

  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.zequel')

  // Configure the native About panel
  app.setAboutPanelOptions({
    applicationName: 'Zequel',
    applicationVersion: app.getVersion(),
    version: '',
    copyright: '© 2025 Zequel',
    credits: 'https://zequel.dev\nhttps://github.com/zequel-labs'
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

  // Register IPC handlers
  registerAllHandlers()

  // Create window
  createWindow()

  // Set up native application menu
  if (mainWindow) {
    createAppMenu(mainWindow)
  }

  // Initialize auto-updater (production only)
  if (!is.dev) {
    initAutoUpdater()
    setTimeout(() => {
      checkForUpdates()
    }, 3000)
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
