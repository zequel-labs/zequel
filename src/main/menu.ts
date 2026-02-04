import { app, shell, Menu, BrowserWindow, nativeTheme } from 'electron'
import { is } from '@electron-toolkit/utils'
import { checkForUpdatesFromMenu } from './services/autoUpdater'

type ThemeSource = 'system' | 'light' | 'dark'

const isMac = process.platform === 'darwin'

let currentTheme: ThemeSource = 'system'
let hasActiveConnection = false
let storedMainWindow: BrowserWindow | null = null
let updaterLabel = 'Check for Updates...'
let updaterEnabled = !is.dev

export const setUpdaterMenuState = (label: string, enabled: boolean): void => {
  updaterLabel = label
  updaterEnabled = enabled
  if (storedMainWindow) {
    createAppMenu(storedMainWindow)
  }
}

export const updateConnectionStatus = (connected: boolean, mainWindow: BrowserWindow): void => {
  hasActiveConnection = connected
  createAppMenu(mainWindow)
}

export const createAppMenu = (mainWindow: BrowserWindow): void => {
  storedMainWindow = mainWindow
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
              { role: 'toggleDevTools' as const },
            ]
          : []),
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
          label: 'Releases',
          click: () => shell.openExternal('https://github.com/zequel-labs/zequel/releases')
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

const setThemeFromMenu = (theme: ThemeSource, mainWindow: BrowserWindow): void => {
  currentTheme = theme
  nativeTheme.themeSource = theme
  mainWindow.webContents.send('theme:changed', theme)
}

export const updateThemeFromRenderer = (theme: ThemeSource, mainWindow: BrowserWindow): void => {
  currentTheme = theme
  nativeTheme.themeSource = theme
  createAppMenu(mainWindow)
}
