import { BrowserWindow } from 'electron'
import { windowManager } from '@main/services/windowManager'

export enum ConnectionStatusType {
  Reconnecting = 'reconnecting',
  Connected = 'connected',
  Error = 'error'
}

export interface ConnectionStatusEvent {
  connectionId: string
  status: ConnectionStatusType
  attempt?: number
  error?: string
}

export const emitConnectionStatus = (event: ConnectionStatusEvent) => {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      const sessions = windowManager.getSessionsForWindow(win.webContents.id)
      if (sessions.includes(event.connectionId)) {
        win.webContents.send('connection:status', event)
        return
      }
    }
  }
  // Fallback: broadcast if no owner found (e.g., during transfer)
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('connection:status', event)
    }
  }
}
