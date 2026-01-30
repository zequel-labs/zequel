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
  RenameViewRequest,
  CreateSequenceRequest,
  DropSequenceRequest,
  AlterSequenceRequest,
  RefreshMaterializedViewRequest,
  CreateExtensionRequest,
  DropExtensionRequest,
  CreateTriggerRequest,
  DropTriggerRequest
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
    disconnect: (id: string) => ipcRenderer.invoke('connection:disconnect', id),
    updateFolder: (id: string, folder: string | null) => ipcRenderer.invoke('connection:updateFolder', id, folder),
    getFolders: () => ipcRenderer.invoke('connection:getFolders'),
    renameFolder: (oldName: string, newName: string) => ipcRenderer.invoke('connection:renameFolder', oldName, newName),
    deleteFolder: (folder: string) => ipcRenderer.invoke('connection:deleteFolder', folder),
    updatePositions: (positions: { id: string; sortOrder: number; folder: string | null }[]) =>
      ipcRenderer.invoke('connection:updatePositions', toPlain(positions))
  },
  query: {
    execute: (connectionId: string, sql: string, params?: unknown[]) =>
      ipcRenderer.invoke('query:execute', connectionId, sql, params ? toPlain(params) : undefined),
    executeMultiple: (connectionId: string, sql: string) =>
      ipcRenderer.invoke('query:executeMultiple', connectionId, sql),
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
      ipcRenderer.invoke('schema:getUserPrivileges', connectionId, username, host),
    // PostgreSQL-specific: Schemas
    getSchemas: (connectionId: string) =>
      ipcRenderer.invoke('schema:getSchemas', connectionId),
    setCurrentSchema: (connectionId: string, schema: string) =>
      ipcRenderer.invoke('schema:setCurrentSchema', connectionId, schema),
    getCurrentSchema: (connectionId: string) =>
      ipcRenderer.invoke('schema:getCurrentSchema', connectionId),
    // PostgreSQL-specific: Sequences
    getSequences: (connectionId: string, schema?: string) =>
      ipcRenderer.invoke('schema:getSequences', connectionId, schema),
    getSequenceDetails: (connectionId: string, sequenceName: string, schema?: string) =>
      ipcRenderer.invoke('schema:getSequenceDetails', connectionId, sequenceName, schema),
    createSequence: (connectionId: string, request: CreateSequenceRequest) =>
      ipcRenderer.invoke('schema:createSequence', connectionId, toPlain(request)),
    dropSequence: (connectionId: string, request: DropSequenceRequest) =>
      ipcRenderer.invoke('schema:dropSequence', connectionId, toPlain(request)),
    alterSequence: (connectionId: string, request: AlterSequenceRequest) =>
      ipcRenderer.invoke('schema:alterSequence', connectionId, toPlain(request)),
    // PostgreSQL-specific: Materialized Views
    getMaterializedViews: (connectionId: string, schema?: string) =>
      ipcRenderer.invoke('schema:getMaterializedViews', connectionId, schema),
    refreshMaterializedView: (connectionId: string, request: RefreshMaterializedViewRequest) =>
      ipcRenderer.invoke('schema:refreshMaterializedView', connectionId, toPlain(request)),
    getMaterializedViewDDL: (connectionId: string, viewName: string, schema?: string) =>
      ipcRenderer.invoke('schema:getMaterializedViewDDL', connectionId, viewName, schema),
    // PostgreSQL-specific: Extensions
    getExtensions: (connectionId: string) =>
      ipcRenderer.invoke('schema:getExtensions', connectionId),
    getAvailableExtensions: (connectionId: string) =>
      ipcRenderer.invoke('schema:getAvailableExtensions', connectionId),
    createExtension: (connectionId: string, request: CreateExtensionRequest) =>
      ipcRenderer.invoke('schema:createExtension', connectionId, toPlain(request)),
    dropExtension: (connectionId: string, request: DropExtensionRequest) =>
      ipcRenderer.invoke('schema:dropExtension', connectionId, toPlain(request)),
    // PostgreSQL-specific: Enums
    getEnums: (connectionId: string, schema?: string) =>
      ipcRenderer.invoke('schema:getEnums', connectionId, schema),
    getAllEnums: (connectionId: string) =>
      ipcRenderer.invoke('schema:getAllEnums', connectionId),
    // MySQL-specific: Charset and Collation operations
    getCharsets: (connectionId: string) =>
      ipcRenderer.invoke('schema:getCharsets', connectionId),
    getCollations: (connectionId: string, charset?: string) =>
      ipcRenderer.invoke('schema:getCollations', connectionId, charset),
    setTableCharset: (connectionId: string, table: string, charset: string, collation?: string) =>
      ipcRenderer.invoke('schema:setTableCharset', connectionId, table, charset, collation),
    setDatabaseCharset: (connectionId: string, database: string, charset: string, collation?: string) =>
      ipcRenderer.invoke('schema:setDatabaseCharset', connectionId, database, charset, collation),
    // MySQL-specific: Partition operations
    getPartitions: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:getPartitions', connectionId, table),
    createPartition: (
      connectionId: string,
      table: string,
      partitionName: string,
      partitionType: 'RANGE' | 'LIST' | 'HASH' | 'KEY',
      expression: string,
      values?: string
    ) =>
      ipcRenderer.invoke('schema:createPartition', connectionId, table, partitionName, partitionType, expression, values),
    dropPartition: (connectionId: string, table: string, partitionName: string) =>
      ipcRenderer.invoke('schema:dropPartition', connectionId, table, partitionName),
    // MySQL-specific: Event (Scheduler) operations
    getEvents: (connectionId: string) =>
      ipcRenderer.invoke('schema:getEvents', connectionId),
    getEventDefinition: (connectionId: string, eventName: string) =>
      ipcRenderer.invoke('schema:getEventDefinition', connectionId, eventName),
    createEvent: (
      connectionId: string,
      eventName: string,
      schedule: string,
      body: string,
      options?: {
        onCompletion?: 'PRESERVE' | 'NOT PRESERVE'
        status?: 'ENABLED' | 'DISABLED'
        comment?: string
      }
    ) =>
      ipcRenderer.invoke('schema:createEvent', connectionId, eventName, schedule, body, options ? toPlain(options) : undefined),
    dropEvent: (connectionId: string, eventName: string) =>
      ipcRenderer.invoke('schema:dropEvent', connectionId, eventName),
    alterEvent: (
      connectionId: string,
      eventName: string,
      options: {
        schedule?: string
        body?: string
        newName?: string
        onCompletion?: 'PRESERVE' | 'NOT PRESERVE'
        status?: 'ENABLED' | 'DISABLED'
        comment?: string
      }
    ) =>
      ipcRenderer.invoke('schema:alterEvent', connectionId, eventName, toPlain(options)),
    // Trigger operations
    getTriggers: (connectionId: string, table?: string) =>
      ipcRenderer.invoke('schema:getTriggers', connectionId, table),
    getTriggerDefinition: (connectionId: string, name: string, table?: string) =>
      ipcRenderer.invoke('schema:getTriggerDefinition', connectionId, name, table),
    createTrigger: (connectionId: string, request: CreateTriggerRequest) =>
      ipcRenderer.invoke('schema:createTrigger', connectionId, toPlain(request)),
    dropTrigger: (connectionId: string, request: DropTriggerRequest) =>
      ipcRenderer.invoke('schema:dropTrigger', connectionId, toPlain(request))
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
  },
  import: {
    preview: (format: 'csv' | 'json') =>
      ipcRenderer.invoke('import:preview', format),
    reparse: (filePath: string, format: 'csv' | 'json', options: { hasHeaders?: boolean; delimiter?: string }) =>
      ipcRenderer.invoke('import:reparse', filePath, format, toPlain(options)),
    execute: (
      connectionId: string,
      tableName: string,
      filePath: string,
      format: 'csv' | 'json',
      columnMappings: Array<{ sourceColumn: string; targetColumn: string; targetType: string }>,
      options: { hasHeaders?: boolean; delimiter?: string; truncateTable?: boolean; batchSize?: number }
    ) =>
      ipcRenderer.invoke('import:execute', connectionId, tableName, filePath, format, toPlain(columnMappings), toPlain(options)),
    getTableColumns: (connectionId: string, tableName: string) =>
      ipcRenderer.invoke('import:getTableColumns', connectionId, tableName)
  },
  export: {
    toFile: (options: {
      format: 'csv' | 'json' | 'sql' | 'xlsx'
      columns: { name: string; type: string }[]
      rows: Record<string, unknown>[]
      tableName?: string
      includeHeaders?: boolean
      delimiter?: string
    }) =>
      ipcRenderer.invoke('export:toFile', toPlain(options)),
    toClipboard: (options: {
      format: 'csv' | 'json' | 'sql'
      columns: { name: string; type: string }[]
      rows: Record<string, unknown>[]
      tableName?: string
      includeHeaders?: boolean
      delimiter?: string
    }) =>
      ipcRenderer.invoke('export:toClipboard', toPlain(options))
  },
  monitoring: {
    getProcessList: (connectionId: string) =>
      ipcRenderer.invoke('monitoring:getProcessList', connectionId),
    killProcess: (connectionId: string, processId: number | string, force?: boolean) =>
      ipcRenderer.invoke('monitoring:killProcess', connectionId, processId, force),
    getServerStatus: (connectionId: string) =>
      ipcRenderer.invoke('monitoring:getServerStatus', connectionId)
  },
  bookmarks: {
    add: (type: 'table' | 'view' | 'query', name: string, connectionId: string, database?: string, schema?: string, sql?: string, folder?: string) =>
      ipcRenderer.invoke('bookmarks:add', type, name, connectionId, database, schema, sql, folder),
    list: (connectionId?: string) =>
      ipcRenderer.invoke('bookmarks:list', connectionId),
    listByType: (type: 'table' | 'view' | 'query', connectionId?: string) =>
      ipcRenderer.invoke('bookmarks:listByType', type, connectionId),
    folders: (connectionId?: string) =>
      ipcRenderer.invoke('bookmarks:folders', connectionId),
    update: (id: number, updates: { name?: string; folder?: string; sql?: string }) =>
      ipcRenderer.invoke('bookmarks:update', id, toPlain(updates)),
    remove: (id: number) =>
      ipcRenderer.invoke('bookmarks:remove', id),
    isBookmarked: (type: 'table' | 'view' | 'query', name: string, connectionId: string) =>
      ipcRenderer.invoke('bookmarks:isBookmarked', type, name, connectionId),
    clear: (connectionId?: string) =>
      ipcRenderer.invoke('bookmarks:clear', connectionId)
  },
  recents: {
    add: (type: 'table' | 'view' | 'query', name: string, connectionId: string, database?: string, schema?: string, sql?: string) =>
      ipcRenderer.invoke('recents:add', type, name, connectionId, database, schema, sql),
    list: (limit?: number) =>
      ipcRenderer.invoke('recents:list', limit),
    listByConnection: (connectionId: string, limit?: number) =>
      ipcRenderer.invoke('recents:listByConnection', connectionId, limit),
    listByType: (type: 'table' | 'view' | 'query', limit?: number) =>
      ipcRenderer.invoke('recents:listByType', type, limit),
    remove: (id: number) =>
      ipcRenderer.invoke('recents:remove', id),
    clear: () =>
      ipcRenderer.invoke('recents:clear'),
    clearForConnection: (connectionId: string) =>
      ipcRenderer.invoke('recents:clearForConnection', connectionId)
  },
  tabs: {
    save: (connectionId: string, database: string, tabsJson: string, activeTabId: string | null) =>
      ipcRenderer.invoke('tabs:save', connectionId, database, tabsJson, activeTabId),
    load: (connectionId: string, database: string) =>
      ipcRenderer.invoke('tabs:load', connectionId, database),
    delete: (connectionId: string, database: string) =>
      ipcRenderer.invoke('tabs:delete', connectionId, database)
  },
  theme: {
    set: (theme: 'system' | 'light' | 'dark') =>
      ipcRenderer.invoke('theme:set', theme),
    onChange: (callback: (theme: 'system' | 'light' | 'dark') => void) => {
      ipcRenderer.on('theme:changed', (_, theme) => callback(theme))
    }
  },
  queryLog: {
    onEntry: (callback: (entry: { connectionId: string; sql: string; timestamp: string; executionTime?: number }) => void) => {
      ipcRenderer.on('query-log', (_, entry) => callback(entry))
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('query-log')
    }
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
