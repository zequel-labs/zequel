import { BrowserWindow } from 'electron'

export interface QueryLogEntry {
  connectionId: string
  sql: string
  timestamp: string
  executionTime?: number
}

export const emitQueryLog = (entry: QueryLogEntry) => {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('query:log', entry)
  }
}
