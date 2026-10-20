import type { RowTransferProgress } from '@main/services/row-transfer'
import { ConnectionStatus } from './connection'
import type { ConnectionConfig, SavedConnection } from './connection'
import type { QueryResult, MultiQueryResult, QueryHistoryItem } from './query'
import { type RoutineType, type ItemType, type TableObjectType, ExportFormat } from './table'
import type {
  Database,
  Table,
  Column,
  Index,
  ForeignKey,
  DataOptions,
  DataResult,
  Routine,
  DatabaseUser,
  DatabaseProcess,
  ServerStatus,
  Sequence,
  MaterializedView,
  Extension,
  DatabaseSchema,
  EnumType,
  PgEncodingInfo,
  PgCollationInfo,
  CharsetInfo,
  CollationInfo,
  PartitionInfo,
  MySQLEvent,
  Trigger,
  TableProperties
} from './table'
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
  SchemaOperationResult,
  DataTypeInfo,
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
} from './schema-operations'

export interface SavedQuery {
  id: number
  connectionId?: string
  name: string
  sql: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface ElectronAPI {
  platform: 'darwin' | 'win32' | 'linux'
  connections: {
    list(): Promise<SavedConnection[]>
    get(id: string): Promise<SavedConnection | null>
    save(config: ConnectionConfig): Promise<SavedConnection>
    delete(id: string): Promise<boolean>
    test(config: ConnectionConfig): Promise<{ success: boolean; error: string | null; latency?: number; serverVersion?: string; serverInfo?: Record<string, string>; sshSuccess?: boolean; sshError?: string | null }>
    connect(id: string): Promise<string>
    connectWithConfig(config: ConnectionConfig): Promise<string>
    connectWithDatabase(sessionId: string, database: string): Promise<string>
    disconnect(id: string): Promise<boolean>
    reconnect(id: string): Promise<boolean>
    getServerVersion(connectionId: string): Promise<string>
    updateFolder(id: string, folder: string | null): Promise<boolean>
    getFolders(): Promise<string[]>
    renameFolder(oldName: string, newName: string): Promise<boolean>
    deleteFolder(folder: string): Promise<boolean>
    updatePositions(positions: { id: string; sortOrder: number; folder: string | null }[]): Promise<boolean>
  }
  query: {
    execute(connectionId: string, sql: string, params?: unknown[], useTransaction?: boolean): Promise<QueryResult>
    executeMultiple(connectionId: string, sql: string, useTransaction?: boolean): Promise<MultiQueryResult>
    cancel(connectionId: string): Promise<boolean>
  }
  stream: {
    queryStart(connectionId: string, sql: string, chunkSize: number): Promise<{ cursorId: string; columns: Column[]; totalRows: number }>
    tableStart(connectionId: string, table: string, options: DataOptions, chunkSize: number): Promise<{ cursorId: string; columns: Column[]; totalRows: number }>
    read(cursorId: string): Promise<Record<string, unknown>[]>
    cancel(cursorId: string): Promise<boolean>
  }
  schema: {
    databases(connectionId: string): Promise<Database[]>
    tables(connectionId: string, database: string, schema?: string): Promise<Table[]>
    columns(connectionId: string, table: string): Promise<Column[]>
    indexes(connectionId: string, table: string): Promise<Index[]>
    foreignKeys(connectionId: string, table: string): Promise<ForeignKey[]>
    tableDDL(connectionId: string, table: string): Promise<string>
    tableData(connectionId: string, table: string, options: DataOptions): Promise<DataResult>
    // Schema editing operations
    addColumn(connectionId: string, request: AddColumnRequest): Promise<SchemaOperationResult>
    modifyColumn(connectionId: string, request: ModifyColumnRequest): Promise<SchemaOperationResult>
    dropColumn(connectionId: string, request: DropColumnRequest): Promise<SchemaOperationResult>
    renameColumn(connectionId: string, request: RenameColumnRequest): Promise<SchemaOperationResult>
    createIndex(connectionId: string, request: CreateIndexRequest): Promise<SchemaOperationResult>
    dropIndex(connectionId: string, request: DropIndexRequest): Promise<SchemaOperationResult>
    addForeignKey(connectionId: string, request: AddForeignKeyRequest): Promise<SchemaOperationResult>
    dropForeignKey(connectionId: string, request: DropForeignKeyRequest): Promise<SchemaOperationResult>
    createTable(connectionId: string, request: CreateTableRequest): Promise<SchemaOperationResult>
    dropTable(connectionId: string, request: DropTableRequest): Promise<SchemaOperationResult>
    renameTable(connectionId: string, request: RenameTableRequest): Promise<SchemaOperationResult>
    insertRow(connectionId: string, request: InsertRowRequest): Promise<SchemaOperationResult>
    deleteRow(connectionId: string, request: DeleteRowRequest): Promise<SchemaOperationResult>
    updateRow(connectionId: string, request: UpdateRowRequest): Promise<SchemaOperationResult>
    getDataTypes(connectionId: string): Promise<DataTypeInfo[]>
    getPrimaryKey(connectionId: string, table: string): Promise<string[]>
    // Table comment
    updateTableComment(connectionId: string, table: string, comment: string | null): Promise<SchemaOperationResult>
    // View operations
    createView(connectionId: string, request: CreateViewRequest): Promise<SchemaOperationResult>
    dropView(connectionId: string, request: DropViewRequest): Promise<SchemaOperationResult>
    renameView(connectionId: string, request: RenameViewRequest): Promise<SchemaOperationResult>
    viewDDL(connectionId: string, viewName: string): Promise<string>
    // Routine operations (stored procedures and functions)
    getRoutines(connectionId: string, type?: RoutineType): Promise<Routine[]>
    getRoutineDefinition(connectionId: string, name: string, type: RoutineType): Promise<string>
    // User management
    getUsers(connectionId: string): Promise<DatabaseUser[]>
    createUser(connectionId: string, request: CreateUserRequest): Promise<SchemaOperationResult>
    dropUser(connectionId: string, request: DropUserRequest): Promise<SchemaOperationResult>
    // PostgreSQL-specific: Encoding and Collation operations
    getPgEncodings(connectionId: string): Promise<PgEncodingInfo[]>
    getPgCollations(connectionId: string): Promise<PgCollationInfo[]>
    // MySQL-specific: Charset and Collation operations
    getCharsets(connectionId: string): Promise<CharsetInfo[]>
    getCollations(connectionId: string, charset?: string): Promise<CollationInfo[]>
    setTableCharset(connectionId: string, table: string, charset: string, collation?: string): Promise<SchemaOperationResult>
    setDatabaseCharset(connectionId: string, database: string, charset: string, collation?: string): Promise<SchemaOperationResult>
    // MySQL-specific: Partition operations
    getPartitions(connectionId: string, table: string): Promise<PartitionInfo[]>
    createPartition(
      connectionId: string,
      table: string,
      partitionName: string,
      partitionType: 'RANGE' | 'LIST' | 'HASH' | 'KEY',
      expression: string,
      values?: string
    ): Promise<SchemaOperationResult>
    dropPartition(connectionId: string, table: string, partitionName: string): Promise<SchemaOperationResult>
    // MySQL-specific: Event (Scheduler) operations
    getEvents(connectionId: string): Promise<MySQLEvent[]>
    getEventDefinition(connectionId: string, eventName: string): Promise<string>
    createEvent(
      connectionId: string,
      eventName: string,
      schedule: string,
      body: string,
      options?: {
        onCompletion?: 'PRESERVE' | 'NOT PRESERVE'
        status?: 'ENABLED' | 'DISABLED'
        comment?: string
      }
    ): Promise<SchemaOperationResult>
    dropEvent(connectionId: string, eventName: string): Promise<SchemaOperationResult>
    alterEvent(
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
    ): Promise<SchemaOperationResult>
    // PostgreSQL-specific: Schemas
    getSchemas(connectionId: string, includeEmpty?: boolean): Promise<DatabaseSchema[]>
    setCurrentSchema(connectionId: string, schema: string): Promise<boolean>
    getCurrentSchema(connectionId: string): Promise<string>
    createSchema(connectionId: string, name: string): Promise<void>
    // PostgreSQL-specific: Sequences
    getSequences(connectionId: string, schema?: string): Promise<Sequence[]>
    getSequenceDetails(connectionId: string, sequenceName: string, schema?: string): Promise<Sequence | null>
    createSequence(connectionId: string, request: CreateSequenceRequest): Promise<SchemaOperationResult>
    dropSequence(connectionId: string, request: DropSequenceRequest): Promise<SchemaOperationResult>
    alterSequence(connectionId: string, request: AlterSequenceRequest): Promise<SchemaOperationResult>
    // PostgreSQL-specific: Materialized Views
    getMaterializedViews(connectionId: string, schema?: string): Promise<MaterializedView[]>
    refreshMaterializedView(connectionId: string, request: RefreshMaterializedViewRequest): Promise<SchemaOperationResult>
    getMaterializedViewDDL(connectionId: string, viewName: string, schema?: string): Promise<string>
    // PostgreSQL-specific: Extensions
    getExtensions(connectionId: string): Promise<Extension[]>
    getAvailableExtensions(connectionId: string): Promise<{ name: string; version: string; description: string }[]>
    createExtension(connectionId: string, request: CreateExtensionRequest): Promise<SchemaOperationResult>
    dropExtension(connectionId: string, request: DropExtensionRequest): Promise<SchemaOperationResult>
    // PostgreSQL-specific: Enums
    getEnums(connectionId: string, schema?: string): Promise<EnumType[]>
    getAllEnums(connectionId: string): Promise<EnumType[]>
    // Trigger operations
    getTriggers(connectionId: string, table?: string): Promise<Trigger[]>
    getTriggerDefinition(connectionId: string, name: string, table?: string): Promise<string>
    createTrigger(connectionId: string, request: CreateTriggerRequest): Promise<SchemaOperationResult>
    dropTrigger(connectionId: string, request: DropTriggerRequest): Promise<SchemaOperationResult>
    // Table properties
    getTableProperties(connectionId: string, tableName: string, tableType: TableObjectType, schema?: string): Promise<TableProperties>
  }
  history: {
    list(connectionId?: string, limit?: number, offset?: number): Promise<QueryHistoryItem[]>
    add(connectionId: string, sql: string, executionTime?: number, rowCount?: number, error?: string): Promise<QueryHistoryItem>
    clear(connectionId?: string): Promise<number>
    delete(id: number): Promise<boolean>
  }
  savedQueries: {
    list(connectionId?: string): Promise<SavedQuery[]>
    get(id: number): Promise<SavedQuery | null>
    save(name: string, sql: string, connectionId?: string, description?: string): Promise<SavedQuery>
    update(id: number, updates: { name?: string; sql?: string; description?: string }): Promise<SavedQuery | null>
    delete(id: number): Promise<boolean>
  }
  app: {
    getVersion(): Promise<string>
    openExternal(url: string): Promise<void>
    showItemInFolder(fullPath: string): Promise<void>
    showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>
    showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue>
    writeFile(filePath: string, content: string): Promise<boolean>
    readFile(filePath: string): Promise<string>
    openInNewWindow(sessionId: string, savedConnectionId: string, serializedTabs?: unknown[], activeTabIndex?: number, activeDatabase?: string, activeSchema?: string, sidebarState?: { expandedTables: string[]; expandedSchemas: string[]; collapsedCategories: string[]; activeSidebarTab: string }, safeMode?: boolean, privacyMode?: boolean): Promise<void>
    getInitData(): Promise<{ adoptSessionId: string; savedConnectionId: string; serializedTabs?: unknown[]; activeTabIndex?: number; activeDatabase?: string; activeSchema?: string; sidebarState?: { expandedTables: string[]; expandedSchemas: string[]; collapsedCategories: string[]; activeSidebarTab: string }; safeMode?: boolean; privacyMode?: boolean } | null>
  }
  rowTransfer: {
    get(id: string): Promise<RowTransferProgress | undefined>
    cancel(id: string): Promise<void>
  }
  import: {
    preview(format: 'csv' | 'json'): Promise<{
      preview: {
        columns: { name: string; sampleValues: unknown[]; detectedType: string }[]
        rows: Record<string, unknown>[]
        totalRows: number | null
        hasHeaders: boolean
      } | null
      filePath: string | null
      error?: string
    }>
    reparse(filePath: string, format: 'csv' | 'json', options: { hasHeaders?: boolean; delimiter?: string; nullToken?: string }): Promise<{
      preview: {
        columns: { name: string; sampleValues: unknown[]; detectedType: string }[]
        rows: Record<string, unknown>[]
        totalRows: number | null
        hasHeaders: boolean
      } | null
      error?: string
    }>
    execute(
      connectionId: string,
      tableName: string,
      filePath: string,
      format: 'csv' | 'json',
      columnMappings: Array<{ sourceColumn: string; targetColumn: string; targetType: string }>,
      options: { hasHeaders?: boolean; delimiter?: string; nullToken?: string; truncateTable?: boolean; batchSize?: number; schema?: string; operationId?: string }
    ): Promise<{ success: boolean; insertedRows?: number; cancelled?: boolean; errors?: string[]; filePath?: string }>
    getTableColumns(connectionId: string, tableName: string, schema?: string): Promise<{
      columns: { name: string; type: string; nullable: boolean }[]
      error?: string
    }>
  }
  export: {
    toFile(options: {
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
      operationId?: string
    }): Promise<{ success: boolean; filePath?: string; error?: string }>
    toClipboard(options: {
      format: ExportFormat
      columns: { name: string; type: string }[]
      rows: Record<string, unknown>[]
      tableName?: string
      includeHeaders?: boolean
      delimiter?: string
      includeSchema?: boolean
      schema?: string
    }): Promise<{ success: boolean; error?: string }>
    tableToFile(
      connectionId: string,
      tableName: string,
      filePath: string,
      options: { format: ExportFormat; delimiter?: string; includeHeaders?: boolean; nullAsEmpty?: boolean; prettyPrint?: boolean; schema?: string; includeSchema?: boolean; createTable?: boolean; operationId?: string }
    ): Promise<{ success: boolean; filePath?: string; error?: string }>
  }
  monitoring: {
    getProcessList(connectionId: string): Promise<DatabaseProcess[]>
    killProcess(connectionId: string, processId: number | string, force?: boolean): Promise<{ success: boolean; error?: string }>
    getServerStatus(connectionId: string): Promise<ServerStatus>
  }
  recents: {
    add(type: ItemType, name: string, connectionId: string, database?: string, schema?: string, sql?: string): Promise<RecentItem>
    list(limit?: number): Promise<RecentItem[]>
    listByConnection(connectionId: string, limit?: number): Promise<RecentItem[]>
    listByType(type: ItemType, limit?: number): Promise<RecentItem[]>
    remove(id: number): Promise<boolean>
    clear(): Promise<number>
    clearForConnection(connectionId: string): Promise<number>
  }
  pinned: {
    pin(type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string): Promise<PinnedEntity>
    unpin(id: number): Promise<boolean>
    unpinByName(type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string): Promise<boolean>
    list(connectionId: string): Promise<PinnedEntity[]>
    isPinned(type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string): Promise<boolean>
    reorder(ids: number[]): Promise<void>
    clear(connectionId: string): Promise<number>
  }
  theme: {
    set(theme: 'system' | 'light' | 'dark'): Promise<void>
    onChange(callback: (theme: 'system' | 'light' | 'dark') => void): () => void
  }
  queryLog: {
    onEntry(callback: (entry: { connectionId: string; sql: string; timestamp: string; executionTime?: number }) => void): void
    removeListener(): void
  }
  connectionStatus: {
    onChange(callback: (event: { connectionId: string; status: ConnectionStatus; attempt?: number; error?: string }) => void): void
    removeListener(): void
  }
  updater: {
    checkForUpdates(): Promise<void>
    downloadUpdate(): Promise<void>
    installUpdate(): Promise<void>
    getChannel(): Promise<string>
    setChannel(channel: string): Promise<void>
    onStatus(callback: (event: { status: string; version?: string; progress?: number; error?: string }) => void): void
    removeListener(): void
  }
  transaction: {
    begin(connectionId: string): Promise<void>
    commit(connectionId: string): Promise<void>
    rollback(connectionId: string): Promise<void>
    status(connectionId: string): Promise<{ inTransaction: boolean; supportsTransactions: boolean }>
  }
  transfers: {
    rows(): Promise<RowTransferProgress[]>
    cancelRow(id: string): Promise<void>
    createDatabase(id: string, name: string): Promise<void>
    open(mode: 'backup' | 'restore', id?: string, database?: string): Promise<void>
    databases(id: string): Promise<{ name: string }[]>
    tool(id: string, mode: 'backup' | 'restore'): Promise<import('@main/types').BackupBinaryInfo>
    list(): Promise<import('@main/types').BackupProgress[]>
    get(id: string): Promise<import('@main/types').BackupProgress | undefined>
    start(request: import('@main/types').TransferRequest): Promise<string>
    cancel(id: string): Promise<boolean>
  }
  menu: {
    sendWindowState(connected: boolean): void
    onToggleSidebar(callback: () => void): () => void
    onToggleBottomPanel(callback: () => void): () => void
    onToggleRightPanel(callback: () => void): () => void
    onToggleShortcutsDialog(callback: () => void): () => void
    onToggleCommandPalette(callback: () => void): () => void
    onOpenUsers(callback: () => void): () => void
    onOpenMonitoring(callback: () => void): () => void
    onCloseConnection(callback: () => void): () => void
  }
}

export interface RecentItem {
  id: number
  type: ItemType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sql?: string
  accessedAt: string
}

export interface PinnedEntity {
  id: number
  type: TableObjectType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sortOrder: number
  createdAt: string
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
