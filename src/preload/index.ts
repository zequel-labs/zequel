import { contextBridge, ipcRenderer } from 'electron'
import type { ConnectionConfig, DataOptions, BackupConfig, RestoreConfig, DatabaseType, ExportFormat } from '@main/types'
import { type ItemType, type RoutineType, type TableObjectType } from '@main/types'
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
  UpdateRowRequest,
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
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '@main/types/schema-operations'

// Helper to convert Vue proxy objects to plain objects
const toPlain = <T>(obj: T): T => JSON.parse(JSON.stringify(obj))

// API exposed to renderer
const api = {
  platform: process.platform as 'darwin' | 'win32' | 'linux',
  connections: {
    list: () => ipcRenderer.invoke('connection:list'),
    get: (id: string) => ipcRenderer.invoke('connection:get', id),
    save: (config: ConnectionConfig) => ipcRenderer.invoke('connection:save', toPlain(config)),
    delete: (id: string) => ipcRenderer.invoke('connection:delete', id),
    test: (config: ConnectionConfig) => ipcRenderer.invoke('connection:test', toPlain(config)),
    connect: (id: string) => ipcRenderer.invoke('connection:connect', id),
    connectWithConfig: (config: ConnectionConfig) => ipcRenderer.invoke('connection:connectWithConfig', toPlain(config)),
    connectWithDatabase: (id: string, database: string) => ipcRenderer.invoke('connection:connectWithDatabase', id, database),
    disconnect: (id: string) => ipcRenderer.invoke('connection:disconnect', id),
    reconnect: (id: string) => ipcRenderer.invoke('connection:reconnect', id),
    getServerVersion: (connectionId: string) => ipcRenderer.invoke('connection:getServerVersion', connectionId),
    updateFolder: (id: string, folder: string | null) => ipcRenderer.invoke('connection:updateFolder', id, folder),
    getFolders: () => ipcRenderer.invoke('connection:getFolders'),
    renameFolder: (oldName: string, newName: string) => ipcRenderer.invoke('connection:renameFolder', oldName, newName),
    deleteFolder: (folder: string) => ipcRenderer.invoke('connection:deleteFolder', folder),
    updatePositions: (positions: { id: string; sortOrder: number; folder: string | null }[]) =>
      ipcRenderer.invoke('connection:updatePositions', toPlain(positions))
  },
  query: {
    execute: (connectionId: string, sql: string, params?: unknown[], useTransaction?: boolean) =>
      ipcRenderer.invoke('query:execute', connectionId, sql, params ? toPlain(params) : undefined, useTransaction),
    executeMultiple: (connectionId: string, sql: string, useTransaction?: boolean) =>
      ipcRenderer.invoke('query:executeMultiple', connectionId, sql, useTransaction),
    cancel: (connectionId: string) => ipcRenderer.invoke('query:cancel', connectionId)
  },
  stream: {
    queryStart: (connectionId: string, sql: string, chunkSize: number) =>
      ipcRenderer.invoke('stream:queryStart', connectionId, sql, chunkSize),
    tableStart: (connectionId: string, table: string, options: DataOptions, chunkSize: number) =>
      ipcRenderer.invoke('stream:tableStart', connectionId, table, toPlain(options), chunkSize),
    read: (cursorId: string) =>
      ipcRenderer.invoke('stream:read', cursorId),
    cancel: (cursorId: string) =>
      ipcRenderer.invoke('stream:cancel', cursorId)
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
    updateRow: (connectionId: string, request: UpdateRowRequest) =>
      ipcRenderer.invoke('schema:updateRow', connectionId, toPlain(request)),
    getDataTypes: (connectionId: string) =>
      ipcRenderer.invoke('schema:getDataTypes', connectionId),
    getPrimaryKey: (connectionId: string, table: string) =>
      ipcRenderer.invoke('schema:getPrimaryKey', connectionId, table),
    // Table comment
    updateTableComment: (connectionId: string, table: string, comment: string | null) =>
      ipcRenderer.invoke('schema:updateTableComment', connectionId, table, comment),
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
    getRoutines: (connectionId: string, type?: RoutineType) =>
      ipcRenderer.invoke('schema:getRoutines', connectionId, type),
    getRoutineDefinition: (connectionId: string, name: string, type: RoutineType) =>
      ipcRenderer.invoke('schema:getRoutineDefinition', connectionId, name, type),
    // User management
    getUsers: (connectionId: string) =>
      ipcRenderer.invoke('schema:getUsers', connectionId),
    createUser: (connectionId: string, request: CreateUserRequest) =>
      ipcRenderer.invoke('schema:createUser', connectionId, toPlain(request)),
    dropUser: (connectionId: string, request: DropUserRequest) =>
      ipcRenderer.invoke('schema:dropUser', connectionId, toPlain(request)),
    // PostgreSQL-specific: Schemas
    getSchemas: (connectionId: string, includeEmpty?: boolean) =>
      ipcRenderer.invoke('schema:getSchemas', connectionId, includeEmpty),
    setCurrentSchema: (connectionId: string, schema: string) =>
      ipcRenderer.invoke('schema:setCurrentSchema', connectionId, schema),
    getCurrentSchema: (connectionId: string) =>
      ipcRenderer.invoke('schema:getCurrentSchema', connectionId),
    createSchema: (connectionId: string, name: string) =>
      ipcRenderer.invoke('schema:createSchema', connectionId, name),
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
    // PostgreSQL-specific: Encoding and Collation operations
    getPgEncodings: (connectionId: string) =>
      ipcRenderer.invoke('schema:getPgEncodings', connectionId),
    getPgCollations: (connectionId: string) =>
      ipcRenderer.invoke('schema:getPgCollations', connectionId),
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
      ipcRenderer.invoke('schema:dropTrigger', connectionId, toPlain(request)),
    // Table properties
    getTableProperties: (connectionId: string, tableName: string, tableType: TableObjectType, schema?: string) =>
      ipcRenderer.invoke('schema:getTableProperties', connectionId, tableName, tableType, schema)
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
    showItemInFolder: (fullPath: string) => ipcRenderer.invoke('app:showItemInFolder', fullPath),
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
      format: ExportFormat
      columns: { name: string; type: string }[]
      rows: Record<string, unknown>[]
      tableName?: string
      includeHeaders?: boolean
      delimiter?: string
      filePath?: string
      nullAsEmpty?: boolean
      prettyPrint?: boolean
      includeSchema?: boolean
      createTable?: boolean
      schema?: string
      ddl?: string
    }) =>
      ipcRenderer.invoke('export:toFile', toPlain(options)),
    toClipboard: (options: {
      format: ExportFormat
      columns: { name: string; type: string }[]
      rows: Record<string, unknown>[]
      tableName?: string
      includeHeaders?: boolean
      delimiter?: string
      includeSchema?: boolean
      schema?: string
    }) =>
      ipcRenderer.invoke('export:toClipboard', toPlain(options)),
    tableToFile: (
      connectionId: string,
      tableName: string,
      filePath: string,
      options: { format: ExportFormat; delimiter?: string; includeHeaders?: boolean; nullAsEmpty?: boolean; prettyPrint?: boolean; schema?: string; includeSchema?: boolean; createTable?: boolean }
    ) =>
      ipcRenderer.invoke('export:tableToFile', connectionId, tableName, filePath, toPlain(options))
  },
  monitoring: {
    getProcessList: (connectionId: string) =>
      ipcRenderer.invoke('monitoring:getProcessList', connectionId),
    killProcess: (connectionId: string, processId: number | string, force?: boolean) =>
      ipcRenderer.invoke('monitoring:killProcess', connectionId, processId, force),
    getServerStatus: (connectionId: string) =>
      ipcRenderer.invoke('monitoring:getServerStatus', connectionId)
  },
  recents: {
    add: (type: ItemType, name: string, connectionId: string, database?: string, schema?: string, sql?: string) =>
      ipcRenderer.invoke('recents:add', type, name, connectionId, database, schema, sql),
    list: (limit?: number) =>
      ipcRenderer.invoke('recents:list', limit),
    listByConnection: (connectionId: string, limit?: number) =>
      ipcRenderer.invoke('recents:listByConnection', connectionId, limit),
    listByType: (type: ItemType, limit?: number) =>
      ipcRenderer.invoke('recents:listByType', type, limit),
    remove: (id: number) =>
      ipcRenderer.invoke('recents:remove', id),
    clear: () =>
      ipcRenderer.invoke('recents:clear'),
    clearForConnection: (connectionId: string) =>
      ipcRenderer.invoke('recents:clearForConnection', connectionId)
  },
  pinned: {
    pin: (type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string) =>
      ipcRenderer.invoke('pinned:pin', type, name, connectionId, database, schema),
    unpin: (id: number) =>
      ipcRenderer.invoke('pinned:unpin', id),
    unpinByName: (type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string) =>
      ipcRenderer.invoke('pinned:unpinByName', type, name, connectionId, database, schema),
    list: (connectionId: string) =>
      ipcRenderer.invoke('pinned:list', connectionId),
    isPinned: (type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string) =>
      ipcRenderer.invoke('pinned:isPinned', type, name, connectionId, database, schema),
    reorder: (ids: number[]) =>
      ipcRenderer.invoke('pinned:reorder', ids),
    clear: (connectionId: string) =>
      ipcRenderer.invoke('pinned:clear', connectionId),
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
      ipcRenderer.on('query:log', (_, entry) => callback(entry))
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('query:log')
    }
  },
  connectionStatus: {
    onChange: (callback: (event: { connectionId: string; status: 'reconnecting' | 'connected' | 'error'; attempt?: number; error?: string }) => void) => {
      ipcRenderer.on('connection:status', (_, event) => callback(event))
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('connection:status')
    }
  },
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download'),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    getChannel: () => ipcRenderer.invoke('updater:getChannel'),
    setChannel: (channel: string) => ipcRenderer.invoke('updater:setChannel', channel),
    onStatus: (callback: (event: { status: string; version?: string; progress?: number; error?: string }) => void) => {
      ipcRenderer.on('updater:status', (_, event) => callback(event))
    },
    removeListener: () => {
      ipcRenderer.removeAllListeners('updater:status')
    }
  },
  nativeBackup: {
    detectBinary: (connectionId: string) =>
      ipcRenderer.invoke('nativeBackup:detectBinary', connectionId),
    getEntities: (connectionId: string) =>
      ipcRenderer.invoke('nativeBackup:getEntities', connectionId),
    buildCommand: (config: BackupConfig) =>
      ipcRenderer.invoke('nativeBackup:buildCommand', toPlain(config)),
    execute: (config: BackupConfig) =>
      ipcRenderer.invoke('nativeBackup:execute', toPlain(config)),
    cancel: (operationId: string) =>
      ipcRenderer.invoke('nativeBackup:cancel', operationId),
    getBinaryPath: (dbType: DatabaseType) =>
      ipcRenderer.invoke('nativeBackup:getBinaryPath', dbType),
    saveBinaryPath: (dbType: DatabaseType, path: string) =>
      ipcRenderer.invoke('nativeBackup:saveBinaryPath', dbType, path),
    onOutput: (callback: (progress: { backupId: string; status: string; stdout: string; stderr: string; exitCode?: number }) => void) => {
      ipcRenderer.on('backup:output', (_, progress) => callback(progress))
    },
    removeOutputListener: () => {
      ipcRenderer.removeAllListeners('backup:output')
    }
  },
  transaction: {
    begin: (connectionId: string) => ipcRenderer.invoke('transaction:begin', connectionId),
    commit: (connectionId: string) => ipcRenderer.invoke('transaction:commit', connectionId),
    rollback: (connectionId: string) => ipcRenderer.invoke('transaction:rollback', connectionId),
    status: (connectionId: string) => ipcRenderer.invoke('transaction:status', connectionId),
  },
  nativeRestore: {
    detectBinary: (connectionId: string) =>
      ipcRenderer.invoke('nativeRestore:detectBinary', connectionId),
    buildCommand: (config: RestoreConfig) =>
      ipcRenderer.invoke('nativeRestore:buildCommand', toPlain(config)),
    execute: (config: RestoreConfig) =>
      ipcRenderer.invoke('nativeRestore:execute', toPlain(config)),
    cancel: (operationId: string) =>
      ipcRenderer.invoke('nativeRestore:cancel', operationId),
    getBinaryPath: (dbType: DatabaseType) =>
      ipcRenderer.invoke('nativeRestore:getBinaryPath', dbType),
    saveBinaryPath: (dbType: DatabaseType, path: string) =>
      ipcRenderer.invoke('nativeRestore:saveBinaryPath', dbType, path),
    onOutput: (callback: (progress: { backupId: string; status: string; stdout: string; stderr: string; exitCode?: number }) => void) => {
      ipcRenderer.on('restore:output', (_, progress) => callback(progress))
    },
    removeOutputListener: () => {
      ipcRenderer.removeAllListeners('restore:output')
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
