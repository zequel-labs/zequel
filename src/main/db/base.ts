import {
  RoutineType,
  type ConnectionConfig,
  type DatabaseType,
  type QueryResult,
  type Database,
  type Table,
  type Column,
  type Index,
  type ForeignKey,
  type DataOptions,
  type DataResult,
  type Routine,
  type DatabaseUser,
  type Trigger
} from '../types'

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
  CreateTriggerRequest,
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '../types/schema-operations'

export interface TestConnectionResult {
  success: boolean
  error: string | null
  latency?: number
  serverVersion?: string
  serverInfo?: Record<string, string>
  sshSuccess?: boolean
  sshError?: string | null
}

export interface DatabaseDriver {
  readonly type: DatabaseType
  readonly isConnected: boolean

  connect(config: ConnectionConfig): Promise<void>
  disconnect(): Promise<void>
  testConnection(config: ConnectionConfig): Promise<TestConnectionResult>

  execute(sql: string, params?: unknown[]): Promise<QueryResult>

  getDatabases(): Promise<Database[]>
  getTables(database: string, schema?: string): Promise<Table[]>
  getColumns(table: string): Promise<Column[]>
  getIndexes(table: string): Promise<Index[]>
  getForeignKeys(table: string): Promise<ForeignKey[]>
  getTableDDL(table: string): Promise<string>
  getTableData(table: string, options: DataOptions): Promise<DataResult>

  // Schema editing operations
  addColumn(request: AddColumnRequest): Promise<SchemaOperationResult>
  modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult>
  dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult>
  renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult>

  createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult>
  dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult>

  addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult>
  dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult>

  createTable(request: CreateTableRequest): Promise<SchemaOperationResult>
  dropTable(request: DropTableRequest): Promise<SchemaOperationResult>
  renameTable(request: RenameTableRequest): Promise<SchemaOperationResult>

  insertRow(request: InsertRowRequest): Promise<SchemaOperationResult>
  deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult>
  updateRow(request: UpdateRowRequest): Promise<SchemaOperationResult>

  // View operations
  createView(request: CreateViewRequest): Promise<SchemaOperationResult>
  dropView(request: DropViewRequest): Promise<SchemaOperationResult>
  renameView(request: RenameViewRequest): Promise<SchemaOperationResult>
  getViewDDL(viewName: string): Promise<string>

  getDataTypes(): DataTypeInfo[]
  getPrimaryKeyColumns(table: string): Promise<string[]>

  // Routine operations (stored procedures and functions)
  getRoutines(type?: RoutineType): Promise<Routine[]>
  getRoutineDefinition(name: string, type: RoutineType): Promise<string>

  // User management operations
  getUsers(): Promise<DatabaseUser[]>
  createUser(request: CreateUserRequest): Promise<SchemaOperationResult>
  dropUser(request: DropUserRequest): Promise<SchemaOperationResult>

  // Trigger operations
  getTriggers(table?: string): Promise<Trigger[]>
  getTriggerDefinition(name: string, table?: string): Promise<string>
  createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult>
  dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult>

  // Health check
  ping(): Promise<boolean>

  // Query cancellation
  cancelQuery(): Promise<boolean>
}

export abstract class BaseDriver implements DatabaseDriver {
  abstract readonly type: DatabaseType
  protected _isConnected = false
  protected config: ConnectionConfig | null = null

  get isConnected(): boolean {
    return this._isConnected
  }

  abstract connect(config: ConnectionConfig): Promise<void>
  abstract disconnect(): Promise<void>
  abstract execute(sql: string, params?: unknown[]): Promise<QueryResult>
  abstract getDatabases(): Promise<Database[]>
  abstract getTables(database: string, schema?: string): Promise<Table[]>
  abstract getColumns(table: string): Promise<Column[]>
  abstract getIndexes(table: string): Promise<Index[]>
  abstract getForeignKeys(table: string): Promise<ForeignKey[]>
  abstract getTableDDL(table: string): Promise<string>
  abstract getTableData(table: string, options: DataOptions): Promise<DataResult>

  // Schema editing operations - abstract methods
  abstract addColumn(request: AddColumnRequest): Promise<SchemaOperationResult>
  abstract modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult>
  abstract dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult>
  abstract renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult>
  abstract createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult>
  abstract dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult>
  abstract addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult>
  abstract dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult>
  abstract createTable(request: CreateTableRequest): Promise<SchemaOperationResult>
  abstract dropTable(request: DropTableRequest): Promise<SchemaOperationResult>
  abstract renameTable(request: RenameTableRequest): Promise<SchemaOperationResult>
  abstract insertRow(request: InsertRowRequest): Promise<SchemaOperationResult>
  abstract deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult>

  async updateRow(_request: UpdateRowRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'updateRow is not supported for this database type' }
  }

  abstract createView(request: CreateViewRequest): Promise<SchemaOperationResult>
  abstract dropView(request: DropViewRequest): Promise<SchemaOperationResult>
  abstract renameView(request: RenameViewRequest): Promise<SchemaOperationResult>
  abstract getViewDDL(viewName: string): Promise<string>
  abstract getDataTypes(): DataTypeInfo[]
  abstract getPrimaryKeyColumns(table: string): Promise<string[]>
  abstract getRoutines(type?: RoutineType): Promise<Routine[]>
  abstract getRoutineDefinition(name: string, type: RoutineType): Promise<string>
  abstract getUsers(): Promise<DatabaseUser[]>
  abstract createUser(request: CreateUserRequest): Promise<SchemaOperationResult>
  abstract dropUser(request: DropUserRequest): Promise<SchemaOperationResult>
  abstract getTriggers(table?: string): Promise<Trigger[]>
  abstract getTriggerDefinition(name: string, table?: string): Promise<string>
  abstract createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult>
  abstract dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult>

  async ping(): Promise<boolean> {
    return false
  }

  async cancelQuery(): Promise<boolean> {
    return false
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start
      await this.disconnect()
      return { success: true, error: null, latency }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      try { await this.disconnect() } catch {}
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  protected ensureConnected(): void {
    if (!this._isConnected) {
      throw new Error('Not connected to database')
    }
  }

  protected buildWhereClause(options: DataOptions): { clause: string; values: unknown[] } {
    if (!options.filters || options.filters.length === 0) {
      return { clause: '', values: [] }
    }

    const conditions: string[] = []
    const values: unknown[] = []

    for (const filter of options.filters) {
      switch (filter.operator) {
        case 'IS NULL':
          conditions.push(`"${filter.column}" IS NULL`)
          break
        case 'IS NOT NULL':
          conditions.push(`"${filter.column}" IS NOT NULL`)
          break
        case 'IN':
        case 'NOT IN':
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => '?').join(', ')
            conditions.push(`"${filter.column}" ${filter.operator} (${placeholders})`)
            values.push(...filter.value)
          }
          break
        case 'LIKE':
        case 'NOT LIKE':
          conditions.push(`"${filter.column}" ${filter.operator} ?`)
          values.push(`%${filter.value}%`)
          break
        default:
          conditions.push(`"${filter.column}" ${filter.operator} ?`)
          values.push(filter.value)
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    }
  }

  protected buildOrderClause(options: DataOptions): string {
    if (!options.orderBy) return ''
    const direction = options.orderDirection || 'ASC'
    return `ORDER BY "${options.orderBy}" ${direction}`
  }

  protected buildLimitClause(options: DataOptions): string {
    const parts: string[] = []
    if (options.limit !== undefined) {
      parts.push(`LIMIT ${options.limit}`)
    }
    if (options.offset !== undefined) {
      parts.push(`OFFSET ${options.offset}`)
    }
    return parts.join(' ')
  }
}
