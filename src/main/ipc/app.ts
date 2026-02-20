import { app, shell, dialog, ipcMain } from 'electron'
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { dirname } from 'path'
import { updateThemeFromRenderer, updateConnectionStatus, updateTabCount } from '@main/menu'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'

export const registerAppHandlers = (): void => {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:openExternal', (_, url: string) => {
    return shell.openExternal(url)
  })

  ipcMain.handle('app:showItemInFolder', (_, fullPath: string) => {
    if (existsSync(fullPath)) {
      shell.showItemInFolder(fullPath)
    } else {
      // File may have been renamed by compression (.sql → .zip)
      const lastDotIndex = fullPath.lastIndexOf('.')
      const basePath = lastDotIndex > fullPath.lastIndexOf('/') && lastDotIndex > fullPath.lastIndexOf('\\')
        ? fullPath.slice(0, lastDotIndex)
        : fullPath
      const zipPath = basePath + '.zip'
      if (existsSync(zipPath)) {
        shell.showItemInFolder(zipPath)
      } else {
        // Fallback: open the parent directory
        shell.openPath(dirname(fullPath))
      }
    }
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

  ipcMain.handle('theme:set', (event, theme: 'system' | 'light' | 'dark') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateThemeFromRenderer(theme, win)
    }
  })

  ipcMain.on('menu:connection-status', (event, connected: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateConnectionStatus(connected, win)
    }
  })

  ipcMain.on('menu:tab-count', (event, count: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateTabCount(count, win)
    }
  })

  ipcMain.handle('app:openInNewWindow', (_, sessionId: string, savedConnectionId: string) => {
    if (!connectionManager.getConnection(sessionId)) {
      throw new Error(`Session ${sessionId} not found`)
    }
    windowManager.openNewWindow({ adoptSessionId: sessionId, savedConnectionId })
  })

  ipcMain.handle('app:getInitData', (event) => {
    return windowManager.consumePendingInitData(event.sender.id)
  })
}
