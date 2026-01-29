import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionConfig } from '../main/types'
import type { DataOptions } from '../main/types'
import type {
  AddColumnRequest,
  ModifyColumnRequest,
  DropColumnRequest,
  RenameColumnRequest,
  CreateIndexRequest,
  DropIndexRequest,
  AddForeignKeyRequest,
  DropForeignKeyRequest,
  CreateTableRequest,
  DropTableRequest,
  RenameTableRequest,
  InsertRowRequest,
  DeleteRowRequest,
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest
} from '../main/types/schema-operations'

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
      ipcRenderer.invoke('schema:tableData', connectionId, table, toPlain(options)),
    // Schema editing operations
    addColumn: (connectionId: string, request: AddColumnRequest) =>
      ipcRenderer.invoke('schema:addColumn', connectionId, toPlain(request)),
    modifyColumn: (connectionId: string, request: ModifyColumnRequest) =>
      ipcRenderer.invoke('schema:modifyColumn', connectionId, toPlain(request)),
    dropColumn: (connectionId: string, request: DropColumnRequest) =>
      ipcRenderer.invoke('schema:dropColumn', connectionId, toPlain(request)),
    renameColumn: (connectionId: string, request: RenameColumnRequest) =>
      ipcRenderer.invoke('schema:renameColumn', connectionId, toPlain(request)),
    createIndex: (connectionId: string, request: CreateIndexRequest) =>
      ipcRenderer.invoke('schema:createIndex', connectionId, toPlain(request)),
    dropIndex: (connectionId: string, request: DropIndexRequest) =>
      ipcRenderer.invoke('schema:dropIndex', connectionId, toPlain(request)),
    addForeignKey: (connectionId: string, request: AddForeignKeyRequest) =>
      ipcRenderer.invoke('schema:addForeignKey', connectionId, toPlain(request)),
    dropForeignKey: (connectionId: string, request: DropForeignKeyRequest) =>
      ipcRenderer.invoke('schema:dropForeignKey', connectionId, toPlain(request)),
    createTable: (connectionId: string, request: CreateTableRequest) =>
      ipcRenderer.invoke('schema:createTable', connectionId, toPlain(request)),
    dropTable: (connectionId: string, request: DropTableRequest) =>
      ipcRenderer.invoke('schema:dropTable', connectionId, toPlain(request)),
    renameTable: (connectionId: string, request: RenameTableRequest) =>
      ipcRenderer.invoke('schema:renameTable', connectionId, toPlain(request)),
    insertRow: (connectionId: string, request: InsertRowRequest) =>
      ipcRenderer.invoke('schema:insertRow', connectionId, toPlain(request)),
    deleteRow: (connectionId: string, request: DeleteRowRequest) =>
      ipcRenderer.invoke('schema:deleteRow', connectionId, toPlain(request)),
    getDataTypes: (connectionId: string) =>
      ipcRenderer.invoke('schema:getDataTypes', connectionId),
    getPrimaryKey: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:getPrimaryKey', connectionId, table),
    // View operations
    createView: (connectionId: string, request: CreateViewRequest) =>
      ipcRenderer.invoke('schema:createView', connectionId, toPlain(request)),
    dropView: (connectionId: string, request: DropViewRequest) =>
      ipcRenderer.invoke('schema:dropView', connectionId, toPlain(request)),
    renameView: (connectionId: string, request: RenameViewRequest) =>
      ipcRenderer.invoke('schema:renameView', connectionId, toPlain(request)),
    viewDDL: (connectionId: string, viewName: string) =>
      ipcRenderer.invoke('schema:viewDDL', connectionId, viewName),
    // Routine operations (stored procedures and functions)
    getRoutines: (connectionId: string, type?: 'PROCEDURE' | 'FUNCTION') =>
      ipcRenderer.invoke('schema:getRoutines', connectionId, type),
    getRoutineDefinition: (connectionId: string, name: string, type: 'PROCEDURE' | 'FUNCTION') =>
      ipcRenderer.invoke('schema:getRoutineDefinition', connectionId, name, type),
    // User management
    getUsers: (connectionId: string) =>
      ipcRenderer.invoke('schema:getUsers', connectionId),
    getUserPrivileges: (connectionId: string, username: string, host?: string) =>
      ipcRenderer.invoke('schema:getUserPrivileges', connectionId, username, host)
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
      ipcRenderer.invoke('app:showOpenDialog', toPlain(options)),
    showSaveDialog: (options: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke('app:showSaveDialog', toPlain(options)),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('app:writeFile', filePath, content),
    readFile: (filePath: string) =>
      ipcRenderer.invoke('app:readFile', filePath)
  },
  backup: {
    export: (connectionId: string) =>
      ipcRenderer.invoke('backup:export', connectionId),
    import: (connectionId: string) =>
      ipcRenderer.invoke('backup:import', connectionId)
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
