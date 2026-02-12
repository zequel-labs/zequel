import type { Knex } from 'knex'
import {
  RoutineType,
  type ConnectionConfig,
  type DatabaseType,
  type QueryResult,
  type Database,
  type Table,
  type Column,
  type ColumnInfo,
  type Index,
  type ForeignKey,
  type DataOptions,
  type DataResult,
  type Routine,
  type DatabaseUser,
  type Trigger
} from '@main/types'
import type { StreamResult } from './cursors/BaseCursor'

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
} from '@main/types/schema-operations'

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

  execute(sql: string, params?: unknown[], useTransaction?: boolean): Promise<QueryResult>

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

  // Table comment
  updateTableComment(table: string, comment: string | null): Promise<SchemaOperationResult>

  // Transaction support
  readonly supportsTransactions: boolean
  readonly inTransaction: boolean
  beginTransaction(): Promise<void>
  commitTransaction(): Promise<void>
  rollbackTransaction(): Promise<void>

  // Health check
  ping(): Promise<boolean>

  // Query cancellation
  cancelQuery(): Promise<boolean>

  // Cursor streaming
  queryStream(sql: string, chunkSize: number): Promise<StreamResult>
  selectTopStream(table: string, options: DataOptions, chunkSize: number): Promise<StreamResult>
}

export abstract class BaseDriver implements DatabaseDriver {
  abstract readonly type: DatabaseType
  protected _isConnected = false
  protected _inTransaction = false
  protected config: ConnectionConfig | null = null
  protected knex: Knex | null = null

  get isConnected(): boolean {
    return this._isConnected
  }

  get supportsTransactions(): boolean {
    return false
  }

  get inTransaction(): boolean {
    return this._inTransaction
  }

  async beginTransaction(): Promise<void> {
    throw new Error('Transactions not supported for this database type')
  }

  async commitTransaction(): Promise<void> {
    throw new Error('No active transaction')
  }

  async rollbackTransaction(): Promise<void> {
    throw new Error('No active transaction')
  }

  abstract connect(config: ConnectionConfig): Promise<void>
  abstract disconnect(): Promise<void>
  abstract execute(sql: string, params?: unknown[], useTransaction?: boolean): Promise<QueryResult>
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

  async updateTableComment(_table: string, _comment: string | null): Promise<SchemaOperationResult> {
    return { success: false, error: 'Table comments are not supported for this database type' }
  }

  async ping(): Promise<boolean> {
    return false
  }

  async cancelQuery(): Promise<boolean> {
    return false
  }

  async queryStream(_sql: string, _chunkSize: number): Promise<StreamResult> {
    throw new Error('queryStream is not supported for this database type')
  }

  async selectTopStream(_table: string, _options: DataOptions, _chunkSize: number): Promise<StreamResult> {
    throw new Error('selectTopStream is not supported for this database type')
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start
      await this.disconnect()
      return { success: true, error: null, latency }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return {
        success: false,
        error: this.formatError(error)
      }
    }
  }

  protected ensureConnected(): void {
    if (!this._isConnected) {
      throw new Error('Not connected to database')
    }
  }

  protected formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  // ─── Knex-based SQL generation ───────────────────────────────────────

  protected applyFilters(
    builder: Knex.QueryBuilder,
    options: DataOptions,
    whereOnly = false
  ): Knex.QueryBuilder {
    if (options.filters) {
      for (const filter of options.filters) {
        switch (filter.operator) {
          case 'IS NULL':
            builder = builder.whereNull(filter.column)
            break
          case 'IS NOT NULL':
            builder = builder.whereNotNull(filter.column)
            break
          case 'IN':
            if (Array.isArray(filter.value)) {
              builder = builder.whereIn(filter.column, filter.value)
            }
            break
          case 'NOT IN':
            if (Array.isArray(filter.value)) {
              builder = builder.whereNotIn(filter.column, filter.value)
            }
            break
          case 'BETWEEN':
            if (Array.isArray(filter.value) && filter.value.length >= 2) {
              builder = builder.whereBetween(filter.column, [filter.value[0], filter.value[1]])
            }
            break
          case 'NOT BETWEEN':
            if (Array.isArray(filter.value) && filter.value.length >= 2) {
              builder = builder.whereNotBetween(filter.column, [filter.value[0], filter.value[1]])
            }
            break
          case 'LIKE':
            builder = builder.where(filter.column, 'like', filter.value as string)
            break
          case 'ILIKE':
            builder = this.applyILike(builder, filter.column, filter.value)
            break
          case 'Contains':
            builder = builder.where(filter.column, 'like', `%${filter.value}%`)
            break
          case 'Not contains':
            builder = builder.where(filter.column, 'not like', `%${filter.value}%`)
            break
          case 'Contains - Case insensitive':
            builder = this.applyILike(builder, filter.column, `%${filter.value}%`)
            break
          case 'Not contains - Case insensitive':
            builder = this.applyNotILike(builder, filter.column, `%${filter.value}%`)
            break
          case 'Has prefix':
            builder = builder.where(filter.column, 'like', `${filter.value}%`)
            break
          case 'Has suffix':
            builder = builder.where(filter.column, 'like', `%${filter.value}`)
            break
          case 'Has prefix - Case insensitive':
            builder = this.applyILike(builder, filter.column, `${filter.value}%`)
            break
          case 'Has suffix - Case insensitive':
            builder = this.applyILike(builder, filter.column, `%${filter.value}`)
            break
          default: {
            const allowedOps = ['=', '<>', '<', '>', '<=', '>=']
            const op = allowedOps.includes(filter.operator) ? filter.operator : '='
            builder = builder.where(filter.column, op, filter.value as string | number | boolean)
          }
        }
      }
    }

    if (whereOnly) return builder

    if (options.orderBy) {
      const direction = options.orderDirection?.toUpperCase() === 'DESC' ? 'desc' : 'asc'
      builder = builder.orderBy(options.orderBy, direction)
    }
    if (options.limit !== undefined) builder = builder.limit(options.limit)
    if (options.offset !== undefined) builder = builder.offset(options.offset)

    return builder
  }

  protected applyILike(builder: Knex.QueryBuilder, column: string, value: unknown): Knex.QueryBuilder {
    return builder.whereRaw('LOWER(??) LIKE LOWER(?)', [column, value])
  }

  protected applyNotILike(builder: Knex.QueryBuilder, column: string, value: unknown): Knex.QueryBuilder {
    return builder.whereRaw('LOWER(??) NOT LIKE LOWER(?)', [column, value])
  }

  protected compileQuery(builder: Knex.QueryBuilder): { sql: string; bindings: unknown[] } {
    const compiled = builder.toSQL()
    return { sql: compiled.sql, bindings: compiled.bindings as unknown[] }
  }

  protected buildInsertSQL(
    table: string,
    values: Record<string, unknown>,
    schema?: string
  ): { sql: string; bindings: unknown[] } {
    let builder = this.knex!(table)
    if (schema) builder = builder.withSchema(schema)
    return this.compileQuery(builder.insert(values))
  }

  protected buildDeleteSQL(
    table: string,
    where: Record<string, unknown>,
    schema?: string
  ): { sql: string; bindings: unknown[] } {
    let builder = this.knex!(table)
    if (schema) builder = builder.withSchema(schema)
    return this.compileQuery(builder.where(where).delete())
  }

  protected buildTableDataQueries(
    table: string,
    options: DataOptions,
    schema?: string
  ): { countSql: string; countBindings: unknown[]; dataSql: string; dataBindings: unknown[] } {
    let baseTable = this.knex!(table)
    if (schema) baseTable = baseTable.withSchema(schema)
    const { sql: countSql, bindings: countBindings } = this.compileQuery(
      this.applyFilters(baseTable.clone().count('* as count'), options, true)
    )
    const { sql: dataSql, bindings: dataBindings } = this.compileQuery(
      this.applyFilters(baseTable.clone().select('*'), options)
    )
    return { countSql, countBindings, dataSql, dataBindings }
  }

  protected mapColumnsToInfo(columns: Column[]): ColumnInfo[] {
    return columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      primaryKey: col.primaryKey,
      defaultValue: col.defaultValue,
      autoIncrement: col.autoIncrement
    }))
  }
}
