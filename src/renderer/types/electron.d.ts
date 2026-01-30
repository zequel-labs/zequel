import type { ConnectionConfig, SavedConnection } from './connection'
import type { QueryResult, MultiQueryResult, QueryHistoryItem } from './query'
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
  UserPrivilege,
  DatabaseProcess,
  ServerStatus,
  Sequence,
  MaterializedView,
  Extension,
  DatabaseSchema,
  EnumType,
  CharsetInfo,
  CollationInfo,
  PartitionInfo,
  MySQLEvent,
  Trigger
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
  DropTriggerRequest
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
  connections: {
    list(): Promise<SavedConnection[]>
    get(id: string): Promise<SavedConnection | null>
    save(config: ConnectionConfig): Promise<SavedConnection>
    delete(id: string): Promise<boolean>
    test(config: ConnectionConfig): Promise<{ success: boolean; error: string | null }>
    connect(id: string): Promise<boolean>
    disconnect(id: string): Promise<boolean>
  }
  query: {
    execute(connectionId: string, sql: string, params?: unknown[]): Promise<QueryResult>
    executeMultiple(connectionId: string, sql: string): Promise<MultiQueryResult>
    cancel(connectionId: string): Promise<boolean>
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
    getDataTypes(connectionId: string): Promise<DataTypeInfo[]>
    getPrimaryKey(connectionId: string, table: string): Promise<string[]>
    // View operations
    createView(connectionId: string, request: CreateViewRequest): Promise<SchemaOperationResult>
    dropView(connectionId: string, request: DropViewRequest): Promise<SchemaOperationResult>
    renameView(connectionId: string, request: RenameViewRequest): Promise<SchemaOperationResult>
    viewDDL(connectionId: string, viewName: string): Promise<string>
    // Routine operations (stored procedures and functions)
    getRoutines(connectionId: string, type?: 'PROCEDURE' | 'FUNCTION'): Promise<Routine[]>
    getRoutineDefinition(connectionId: string, name: string, type: 'PROCEDURE' | 'FUNCTION'): Promise<string>
    // User management
    getUsers(connectionId: string): Promise<DatabaseUser[]>
    getUserPrivileges(connectionId: string, username: string, host?: string): Promise<UserPrivilege[]>
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
    getSchemas(connectionId: string): Promise<DatabaseSchema[]>
    setCurrentSchema(connectionId: string, schema: string): Promise<boolean>
    getCurrentSchema(connectionId: string): Promise<string>
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
    showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>
    showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue>
    writeFile(filePath: string, content: string): Promise<boolean>
    readFile(filePath: string): Promise<string>
  }
  backup: {
    export(connectionId: string): Promise<{ success: boolean; filePath?: string; error?: string }>
    import(connectionId: string): Promise<{ success: boolean; statements: number; errors: string[]; filePath?: string }>
  }
  monitoring: {
    getProcessList(connectionId: string): Promise<DatabaseProcess[]>
    killProcess(connectionId: string, processId: number | string, force?: boolean): Promise<{ success: boolean; error?: string }>
    getServerStatus(connectionId: string): Promise<ServerStatus>
  }
  recents: {
    add(type: 'table' | 'view' | 'query', name: string, connectionId: string, database?: string, schema?: string, sql?: string): Promise<RecentItem>
    list(limit?: number): Promise<RecentItem[]>
    listByConnection(connectionId: string, limit?: number): Promise<RecentItem[]>
    listByType(type: 'table' | 'view' | 'query', limit?: number): Promise<RecentItem[]>
    remove(id: number): Promise<boolean>
    clear(): Promise<number>
    clearForConnection(connectionId: string): Promise<number>
  }
  tabs: {
    save(connectionId: string, database: string, tabsJson: string, activeTabId: string | null): Promise<boolean>
    load(connectionId: string, database: string): Promise<TabSession | null>
    delete(connectionId: string, database: string): Promise<boolean>
  }
  theme: {
    set(theme: 'system' | 'light' | 'dark'): Promise<void>
    onChange(callback: (theme: 'system' | 'light' | 'dark') => void): void
  }
}

export interface RecentItem {
  id: number
  type: 'table' | 'view' | 'query'
  name: string
  connectionId: string
  database?: string
  schema?: string
  sql?: string
  accessedAt: string
}

export interface TabSession {
  id: number
  connection_id: string
  database_name: string
  tabs_json: string
  active_tab_id: string | null
  updated_at: string
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
