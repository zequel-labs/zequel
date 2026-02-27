import { BrowserWindow } from 'electron'
import { windowManager } from '@main/services/windowManager'

export interface QueryLogEntry {
  connectionId: string
  sql: string
  timestamp: string
  executionTime?: number
}

export const emitQueryLog = (entry: QueryLogEntry) => {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      const sessions = windowManager.getSessionsForWindow(win.webContents.id)
      if (sessions.includes(entry.connectionId)) {
        win.webContents.send('query:log', entry)
        return
      }
    }
  }
  // Fallback: broadcast if no owner found (e.g., during transfer)
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('query:log', entry)
    }
  }
}
