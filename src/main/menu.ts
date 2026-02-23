import { app, shell, Menu, BrowserWindow, nativeTheme, dialog } from 'electron'
import { is } from '@electron-toolkit/utils'
import { checkForUpdatesFromMenu, getUpdateChannel, setUpdateChannel } from './services/autoUpdater'
import { appDatabase } from './services/database'
import { windowManager } from './services/windowManager'
import { UpdateChannel } from './types'

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
  if (storedMainWindow && !storedMainWindow.isDestroyed() && storedMainWindow.webContents.id === webContentsId) {
    storedMainWindow = null
  }
}

export const refreshMenuForFocusedWindow = (): void => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    createAppMenu(win)
  }
}

export const createAppMenu = (mainWindow: BrowserWindow): void => {
  storedMainWindow = mainWindow
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
          label: 'Close Connection',
          accelerator: isMac ? 'Cmd+W' : 'Ctrl+W',
          enabled: hasActiveConnection,
          click: () => {
            const win = BrowserWindow.getFocusedWindow()
            if (win) win.webContents.send('menu:close-connection')
          }
        },
        {
          label: 'Close Window',
          accelerator: isMac ? 'Cmd+Shift+W' : 'Ctrl+Shift+W',
          role: 'close'
        }
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
              click: () => setThemeFromMenu('system', mainWindow)
            },
            {
              label: 'Light',
              type: 'radio',
              checked: currentTheme === 'light',
              click: () => setThemeFromMenu('light', mainWindow)
            },
            {
              label: 'Dark',
              type: 'radio',
              checked: currentTheme === 'dark',
              click: () => setThemeFromMenu('dark', mainWindow)
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
              click: () => setChannelFromMenu(UpdateChannel.Stable, mainWindow)
            },
            {
              label: 'Beta',
              type: 'radio' as const,
              checked: getUpdateChannel() === UpdateChannel.Beta,
              click: () => setChannelFromMenu(UpdateChannel.Beta, mainWindow)
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
          click: () => resetAppData(mainWindow)
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

const setChannelFromMenu = (channel: UpdateChannel, mainWindow: BrowserWindow): void => {
  setUpdateChannel(channel)
  createAppMenu(mainWindow)
}

const setThemeFromMenu = (theme: ThemeSource, mainWindow: BrowserWindow): void => {
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
  dialogPromise.then(({ response: restartResponse }) => {
    if (restartResponse === 0) {
      app.relaunch()
      app.quit()
    }
  })
}
