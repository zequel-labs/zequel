import { app, shell, Menu, BrowserWindow, nativeTheme } from 'electron'
import { is } from '@electron-toolkit/utils'
import { checkForUpdates } from './services/autoUpdater'

type ThemeSource = 'system' | 'light' | 'dark'

const isMac = process.platform === 'darwin'

let currentTheme: ThemeSource = 'system'

export const createAppMenu = (mainWindow: BrowserWindow): void => {
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
              click: () => shell.openExternal('https://github.com/zequelhq')
            },
            {
              label: 'Check for Updates...',
              enabled: !is.dev,
              click: () => checkForUpdates()
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
        ...(!isMac
          ? [
              {
                label: 'Check for Updates...',
                enabled: !is.dev,
                click: () => checkForUpdates()
              },
              { type: 'separator' as const }
            ]
          : []),
        isMac ? { role: 'close' as const } : { role: 'quit' as const }
      ]
    },
    { role: 'editMenu' },
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
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
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
          label: 'Website',
          click: () => shell.openExternal('https://zequel.dev')
        },
        {
          label: 'GitHub',
          click: () => shell.openExternal('https://github.com/zequelhq')
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
