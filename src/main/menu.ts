import { app, shell, Menu, BrowserWindow, nativeTheme, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { checkForUpdatesFromMenu, getUpdateChannel, setUpdateChannel } from './services/autoUpdater'
import { appDatabase } from './services/database'
import { windowManager } from './services/windowManager'
import { UpdateChannel } from './types'
import { logger } from '@main/utils/logger'

type ThemeSource = 'system' | 'light' | 'dark'

const isMac = process.platform === 'darwin'

let currentTheme: ThemeSource = 'system'
let storedMainWindow: BrowserWindow | null = null
let updaterLabel = 'Check for Updates...'
let updaterEnabled = !is.dev

// Per-window connection state (keyed by webContents.id)
const windowConnectionStatus = new Map<number, boolean>()

const getStateForWindow = (win: BrowserWindow): { hasActiveConnection: boolean } => {
  const id = win.webContents.id
  return {
    hasActiveConnection: windowConnectionStatus.get(id) ?? false
  }
}

export const setUpdaterMenuState = (label: string, enabled: boolean): void => {
  updaterLabel = label
  updaterEnabled = enabled
  if (storedMainWindow && !storedMainWindow.isDestroyed()) {
    createAppMenu(storedMainWindow)
  }
}

export const updateWindowState = (connected: boolean, mainWindow: BrowserWindow): void => {
  windowConnectionStatus.set(mainWindow.webContents.id, connected)
  createAppMenu(mainWindow)
}

export const cleanupWindowMenuState = (webContentsId: number): void => {
  windowConnectionStatus.delete(webContentsId)
  if (storedMainWindow && !storedMainWindow.isDestroyed() && storedMainWindow.webContents?.id === webContentsId) {
    storedMainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((w: Electron.BrowserWindow) => !w.isDestroyed()) ?? null
  }
}

export const refreshMenuForFocusedWindow = (): void => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    createAppMenu(win)
  }
}

export const createAppMenu = (mainWindow: BrowserWindow): void => {
  if (!storedMainWindow || storedMainWindow.isDestroyed()) {
    storedMainWindow = mainWindow
  }
  const { hasActiveConnection } = getStateForWindow(mainWindow)
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS: app menu with name, services, hide/unhide
    // Windows/Linux: File menu with quit
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            {
              label: 'Website',
              click: () => shell.openExternal('https://zequel.dev')
            },
            {
              label: 'GitHub',
              click: () => shell.openExternal('https://github.com/zequel-labs')
            },
            {
              label: updaterLabel,
              enabled: updaterEnabled,
              click: () => checkForUpdatesFromMenu()
            },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: isMac ? 'Cmd+Shift+N' : 'Ctrl+Shift+N',
          click: () => windowManager.openNewWindow()
        },
        { type: 'separator' },
        {
          label: hasActiveConnection ? 'Close Connection' : 'Close Window',
          accelerator: isMac ? 'Cmd+W' : 'Ctrl+W',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (!win) return
            const { hasActiveConnection: isConnected } = getStateForWindow(win)
            if (isConnected) {
              win.webContents.send('menu:close-connection')
            } else {
              win.close()
            }
          }
        },
        ...(hasActiveConnection
          ? [{
              label: 'Close Window',
              accelerator: isMac ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
              role: 'close' as const
            }]
          : [])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Appearance',
          submenu: [
            {
              label: 'System',
              type: 'radio',
              checked: currentTheme === 'system',
              click: () => setThemeFromMenu('system')
            },
            {
              label: 'Light',
              type: 'radio',
              checked: currentTheme === 'light',
              click: () => setThemeFromMenu('light')
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: currentTheme === 'dark',
              click: () => setThemeFromMenu('dark')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Panels',
          enabled: hasActiveConnection,
          submenu: [
            {
              label: 'Toggle Sidebar',
              accelerator: isMac ? 'Cmd+B' : 'Ctrl+B',
              click: () => {
                const win = BrowserWindow.getFocusedWindow()
                if (win) win.webContents.send('menu:toggle-sidebar')
              }
            },
            {
              label: 'Toggle Bottom Panel',
              accelerator: isMac ? 'Cmd+J' : 'Ctrl+J',
              click: () => {
                const win = BrowserWindow.getFocusedWindow()
                if (win) win.webContents.send('menu:toggle-bottom-panel')
              }
            },
            {
              label: 'Toggle Right Panel',
              accelerator: isMac ? 'Cmd+Shift+B' : 'Ctrl+Shift+B',
              click: () => {
                const win = BrowserWindow.getFocusedWindow()
                if (win) win.webContents.send('menu:toggle-right-panel')
              }
            }
          ]
        },
        ...(is.dev
          ? [
              { type: 'separator' as const },
              { role: 'reload' as const },
              { role: 'forceReload' as const },
            ]
          : []),
        { type: 'separator' },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'User Management',
          enabled: hasActiveConnection,
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:open-users')
          }
        },
        {
          label: 'Process List',
          enabled: hasActiveConnection,
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:open-monitoring')
          }
        },
        { type: 'separator' },
        {
          label: 'Search',
          enabled: hasActiveConnection,
          accelerator: isMac ? 'Cmd+P' : 'Ctrl+P',
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:toggle-command-palette')
          }
        }
      ]
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        ...(!isMac
          ? [{ role: 'about' as const }, { type: 'separator' as const }]
          : []),
        {
          label: 'Update Channel',
          submenu: [
            {
              label: 'Stable',
              type: 'radio' as const,
              checked: getUpdateChannel() === UpdateChannel.Stable,
              click: () => setChannelFromMenu(UpdateChannel.Stable)
            },
            {
              label: 'Beta',
              type: 'radio' as const,
              checked: getUpdateChannel() === UpdateChannel.Beta,
              click: () => setChannelFromMenu(UpdateChannel.Beta)
            }
          ]
        },
        { type: 'separator' as const },
        {
          label: 'Releases',
          click: () => shell.openExternal('https://github.com/zequel-labs/zequel/releases')
        },
        { type: 'separator' },
        {
          label: 'Reset App Data...',
          click: () => {
            const win = getActiveWindow()
            if (win) resetAppData(win)
          }
        },
        { type: 'separator' },
        {
          label: 'Report a Bug',
          click: () => shell.openExternal('https://github.com/zequel-labs/zequel/issues')
        },
        {
          label: 'Discussions',
          click: () => shell.openExternal('https://github.com/zequel-labs/zequel/discussions')
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

const getActiveWindow = (): BrowserWindow | null =>
  BrowserWindow.getFocusedWindow() ?? (storedMainWindow && !storedMainWindow.isDestroyed() ? storedMainWindow : null)

const setChannelFromMenu = (channel: UpdateChannel): void => {
  setUpdateChannel(channel)
  const win = getActiveWindow()
  if (win) createAppMenu(win)
}

const setThemeFromMenu = (theme: ThemeSource): void => {
  currentTheme = theme
  nativeTheme.themeSource = theme
  // Broadcast to all windows so theme is consistent
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('theme:changed', theme)
    }
  }
}

export const updateThemeFromRenderer = (theme: ThemeSource, mainWindow: BrowserWindow): void => {
  currentTheme = theme
  nativeTheme.themeSource = theme
  // Broadcast to all windows so theme is consistent
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('theme:changed', theme)
    }
  }
  createAppMenu(mainWindow)
}

const resetAppData = async (mainWindow: BrowserWindow): Promise<void> => {
  if (mainWindow.isDestroyed()) return
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Reset App Data',
    message: 'Are you sure you want to reset all app data?',
    detail: 'This will delete all saved connections, query history, settings, and recent items. This action cannot be undone.',
    buttons: ['Cancel', 'Reset'],
    defaultId: 0,
    cancelId: 0,
  })

  if (response !== 1) return

  appDatabase.fresh()
  // Broadcast to all windows
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('app:data-reset')
    }
  }

  const targetWindow = mainWindow.isDestroyed() ? (BrowserWindow.getFocusedWindow() ?? undefined) : mainWindow
  const dialogPromise = targetWindow
    ? dialog.showMessageBox(targetWindow, {
        type: 'info',
        title: 'App Data Reset',
        message: 'App data has been reset successfully.',
        detail: 'Restart the app for changes to take full effect.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
    : dialog.showMessageBox({
        type: 'info',
        title: 'App Data Reset',
        message: 'App data has been reset successfully.',
        detail: 'Restart the app for changes to take full effect.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
  dialogPromise.then(async ({ response: restartResponse }) => {
    if (restartResponse === 0) {
      app.relaunch()
      app.quit()
    }
  }).catch((err: unknown) => {
    logger.error('resetAppData dialog error:', err)
  })
}
