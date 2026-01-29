import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionConfig } from '../main/types'
import type { DataOptions } from '../main/types'

// Helper to convert Vue proxy objects to plain objects
const toPlain = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

// API exposed to renderer
const api = {
  connections: {
    list: () => ipcRenderer.invoke('connection:list'),
    get: (id: string) => ipcRenderer.invoke('connection:get', id),
    save: (config: ConnectionConfig) => ipcRenderer.invoke('connection:save', toPlain(config)),
    delete: (id: string) => ipcRenderer.invoke('connection:delete', id),
    test: (config: ConnectionConfig) => ipcRenderer.invoke('connection:test', toPlain(config)),
    connect: (id: string) => ipcRenderer.invoke('connection:connect', id),
    disconnect: (id: string) => ipcRenderer.invoke('connection:disconnect', id)
  },
  query: {
    execute: (connectionId: string, sql: string, params?: unknown[]) =>
      ipcRenderer.invoke('query:execute', connectionId, sql, params ? toPlain(params) : undefined),
    cancel: (connectionId: string) => ipcRenderer.invoke('query:cancel', connectionId)
  },
  schema: {
    databases: (connectionId: string) => ipcRenderer.invoke('schema:databases', connectionId),
    tables: (connectionId: string, database: string, schema?: string) =>
      ipcRenderer.invoke('schema:tables', connectionId, database, schema),
    columns: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:columns', connectionId, table),
    indexes: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:indexes', connectionId, table),
    foreignKeys: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:foreignKeys', connectionId, table),
    tableDDL: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:tableDDL', connectionId, table),
    tableData: (connectionId: string, table: string, options: DataOptions) =>
      ipcRenderer.invoke('schema:tableData', connectionId, table, toPlain(options))
  },
  history: {
    list: (connectionId?: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('history:list', connectionId, limit, offset),
    add: (connectionId: string, sql: string, executionTime?: number, rowCount?: number, error?: string) =>
      ipcRenderer.invoke('history:add', connectionId, sql, executionTime, rowCount, error),
    clear: (connectionId?: string) => ipcRenderer.invoke('history:clear', connectionId),
    delete: (id: number) => ipcRenderer.invoke('history:delete', id)
  },
  savedQueries: {
    list: (connectionId?: string) => ipcRenderer.invoke('savedQueries:list', connectionId),
    get: (id: number) => ipcRenderer.invoke('savedQueries:get', id),
    save: (name: string, sql: string, connectionId?: string, description?: string) =>
      ipcRenderer.invoke('savedQueries:save', name, sql, connectionId, description),
    update: (id: number, updates: { name?: string; sql?: string; description?: string }) =>
      ipcRenderer.invoke('savedQueries:update', id, toPlain(updates)),
    delete: (id: number) => ipcRenderer.invoke('savedQueries:delete', id)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    showOpenDialog: (options: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('app:showOpenDialog', toPlain(options))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
