import { app, shell, dialog, ipcMain } from 'electron'
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { dirname } from 'path'
import { updateThemeFromRenderer, updateWindowState } from '@main/menu'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { isPathAllowed } from '@main/utils/pathValidation'

export const registerAppHandlers = (): void => {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:openExternal', (_, url: string) => {
    if (typeof url !== 'string') throw new Error('URL must be a string')
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid URL')
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only HTTP(S) URLs are allowed')
    }
    return shell.openExternal(url)
  })

  ipcMain.handle('app:showItemInFolder', (_, fullPath: string) => {
    if (typeof fullPath !== 'string') throw new Error('Path must be a string')
    if (!isPathAllowed(fullPath)) {
      throw new Error('File path is not in an allowed directory')
    }
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
        // Fallback: open the parent directory (re-validate since openPath can execute files)
        const parentDir = dirname(fullPath)
        if (isPathAllowed(parentDir)) {
          shell.openPath(parentDir)
        }
      }
    }
  })

  ipcMain.handle('app:showOpenDialog', (event, options: Electron.OpenDialogOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
  })

  ipcMain.handle('app:showSaveDialog', (event, options: Electron.SaveDialogOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options)
  })

  ipcMain.handle('app:writeFile', async (_, filePath: string, content: string) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('File path is not in an allowed directory')
    }
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, content, 'utf-8')
    return true
  })

  ipcMain.handle('app:readFile', async (_, filePath: string) => {
    // No path restriction: the user selects the file via the native OS dialog
    // (the trust boundary). SSL certs, SSH keys, etc. live outside allowed dirs.
    const fs = await import('fs/promises')
    return await fs.readFile(filePath, 'utf-8')
  })

  ipcMain.handle('theme:set', (event, theme: 'system' | 'light' | 'dark') => {
    if (!['system', 'light', 'dark'].includes(theme)) {
      throw new Error('Invalid theme value')
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateThemeFromRenderer(theme, win)
    }
  })

  ipcMain.on('menu:window-state', (event, connected: boolean) => {
    if (typeof connected !== 'boolean') return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      updateWindowState(connected, win)
    }
  })

  ipcMain.handle('app:openInNewWindow', (event, sessionId: string, savedConnectionId: string, serializedTabs?: unknown[], activeTabIndex?: number) => {
    if (typeof sessionId !== 'string' || !sessionId) {
      throw new Error('Invalid session ID')
    }
    if (!connectionManager.getConnection(sessionId)) {
      throw new Error(`Session ${sessionId} not found`)
    }
    if (typeof savedConnectionId !== 'string' || !savedConnectionId) {
      throw new Error('Invalid saved connection ID')
    }
    // Verify the sender owns this session
    const ownerId = windowManager.getSessionOwner(sessionId)
    if (ownerId !== undefined && ownerId !== event.sender.id) {
      throw new Error('Not authorized to transfer this session')
    }
    // Prevent double-transfer (e.g. rapid double-click)
    if (windowManager.isSessionInTransfer(sessionId)) {
      throw new Error('Session is already being transferred')
    }
    // Validate optional tab serialization parameters
    const MAX_SERIALIZED_TABS = 100
    const validTabs = Array.isArray(serializedTabs) && serializedTabs.length <= MAX_SERIALIZED_TABS
      ? serializedTabs
      : undefined
    const validIndex = typeof activeTabIndex === 'number' && Number.isInteger(activeTabIndex) && activeTabIndex >= 0 ? activeTabIndex : undefined
    // Mark session as in-transfer to prevent the source window's close handler
    // from killing this session during the handoff
    windowManager.markSessionInTransfer(sessionId)
    try {
      windowManager.openNewWindow({ adoptSessionId: sessionId, savedConnectionId, serializedTabs: validTabs, activeTabIndex: validIndex })
    } catch (err) {
      windowManager.clearSessionTransfer(sessionId)
      throw err
    }
    setTimeout(() => {
      if (windowManager.isSessionInTransfer(sessionId)) {
        windowManager.clearSessionTransfer(sessionId)
        // Clean up any stale pending init data for this session
        windowManager.cleanupPendingInitDataForSession(sessionId)
        // If session still has no owner, disconnect to prevent orphan
        if (windowManager.getSessionOwner(sessionId) === undefined) {
          connectionManager.disconnect(sessionId).catch(() => {})
        }
      }
    }, 30000)
  })

  ipcMain.handle('app:getInitData', (event) => {
    const data = windowManager.consumePendingInitData(event.sender.id)
    if (data) {
      // Session may have been disconnected before this window loaded
      if (!connectionManager.getConnection(data.adoptSessionId)) {
        windowManager.clearSessionTransfer(data.adoptSessionId)
        return null
      }
      // Transfer session ownership from the source window to this new window
      windowManager.transferSession(data.adoptSessionId, event.sender.id)
      windowManager.clearSessionTransfer(data.adoptSessionId)
    }
    return data
  })
}
