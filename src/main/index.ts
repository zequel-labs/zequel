import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { connectionManager } from './db/manager'
import { appDatabase } from './services/database'
import { logger } from './utils/logger'
import { createAppMenu, updateThemeFromRenderer } from './menu'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0a0a0f',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

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

// App handlers
ipcMain.handle('app:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('app:openExternal', (_, url: string) => {
  return shell.openExternal(url)
})

ipcMain.handle('app:showOpenDialog', (_, options: Electron.OpenDialogOptions) => {
  return dialog.showOpenDialog(options)
})

ipcMain.handle('app:showSaveDialog', (_, options: Electron.SaveDialogOptions) => {
  return dialog.showSaveDialog(options)
})

ipcMain.handle('app:writeFile', async (_, filePath: string, content: string) => {
  const fs = await import('fs/promises')
  await fs.writeFile(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('app:readFile', async (_, filePath: string) => {
  const fs = await import('fs/promises')
  return await fs.readFile(filePath, 'utf-8')
})

ipcMain.handle('theme:set', (_, theme: 'system' | 'light' | 'dark') => {
  if (mainWindow) {
    updateThemeFromRenderer(theme, mainWindow)
  }
})

app.whenReady().then(() => {
  logger.info('App starting')

  // Initialize app database (SQLite for storing connections, history, etc.)
  appDatabase.initialize()

  // Set app user model id for windows
  electronApp.setAppUserModelId('dev.zequel')

  // Configure the native About panel
  app.setAboutPanelOptions({
    applicationName: 'Zequel',
    copyright: '© 2025 Zequel',
    credits: 'https://zequel.dev\nhttps://github.com/zequelhq'
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerAllHandlers()

  // Create window
  createWindow()

  // Set up native application menu
  if (mainWindow) {
    createAppMenu(mainWindow)
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
