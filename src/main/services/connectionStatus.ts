import { BrowserWindow } from 'electron'

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
    win.webContents.send('connection:status', event)
  }
}
