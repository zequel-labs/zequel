import type { ConnectionConfig, SavedConnection } from './connection'
import type { QueryResult, QueryHistoryItem } from './query'
import type { Database, Table, Column, Index, ForeignKey, DataOptions, DataResult, Routine, DatabaseUser, UserPrivilege } from './table'
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
  DataTypeInfo
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
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
