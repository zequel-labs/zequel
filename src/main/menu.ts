import { Menu, BrowserWindow, nativeTheme } from 'electron'

type ThemeSource = 'system' | 'light' | 'dark'

let currentTheme: ThemeSource = 'system'

export function createAppMenu(mainWindow: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    { role: 'fileMenu' },
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
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = await import('electron')
            shell.openExternal('https://zequel.dev')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function setThemeFromMenu(theme: ThemeSource, mainWindow: BrowserWindow): void {
  currentTheme = theme
  nativeTheme.themeSource = theme
  mainWindow.webContents.send('theme:changed', theme)
}

export function updateThemeFromRenderer(theme: ThemeSource, mainWindow: BrowserWindow): void {
  currentTheme = theme
  nativeTheme.themeSource = theme
  createAppMenu(mainWindow)
}
