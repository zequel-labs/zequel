import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api'
import type { DuckDBValue } from '@duckdb/node-api'
import knexLib, { type Knex } from 'knex'
import DuckDBKnexClient from './knex-duckdb/client'
import { BaseDriver, TestConnectionResult } from './base'
import type { StreamResult } from './cursors/BaseCursor'
import { DuckDBCursor } from './cursors/DuckDBCursor'
import * as fs from 'fs'
import {
  DatabaseType,
  TableObjectType,
  type ConnectionConfig,
  type QueryResult,
  type Database as DatabaseInfo,
  Table,
  Column,
  Index,
  ForeignKey,
  DataOptions,
  DataResult,
  Routine,
  Trigger,
  DatabaseUser
} from '@main/types'
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
  ColumnDefinition,
  CreateTriggerRequest,
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '@main/types/schema-operations'
import { DUCKDB_DATA_TYPES } from '@main/types/schema-operations'

const knex = knexLib({
  client: DuckDBKnexClient as unknown as typeof Knex.Client,
  useNullAsDefault: true
})

export class DuckDBDriver extends BaseDriver {
  readonly type = DatabaseType.DuckDB
  protected override knex = knex
  private instance: DuckDBInstance | null = null
  private connection: DuckDBConnection | null = null
  private transactionConnection: DuckDBConnection | null = null

  override get supportsTransactions(): boolean {
    return true
  }

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const dbPath = config.filepath || config.database
      this.instance = await DuckDBInstance.create(dbPath)
      this.connection = await this.instance.connect()
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.transactionConnection) {
      try {
        await this.transactionConnection.run('ROLLBACK')
      } catch {}
      this.transactionConnection.closeSync()
      this.transactionConnection = null
      this._inTransaction = false
    }
    if (this.connection) {
      this.connection.closeSync()
      this.connection = null
    }
    if (this.instance) {
      this.instance.closeSync()
      this.instance = null
    }
    this._isConnected = false
    this.config = null
  }

  override async beginTransaction(): Promise<void> {
    this.ensureConnected()
    if (this._inTransaction) throw new Error('Transaction already active')
    this.transactionConnection = await this.instance!.connect()
    await this.transactionConnection.run('BEGIN TRANSACTION')
    this._inTransaction = true
  }

  override async commitTransaction(): Promise<void> {
    this.ensureConnected()
    if (!this._inTransaction || !this.transactionConnection) throw new Error('No active transaction')
    await this.transactionConnection.run('COMMIT')
    this.transactionConnection.closeSync()
    this.transactionConnection = null
    this._inTransaction = false
  }

  override async rollbackTransaction(): Promise<void> {
    this.ensureConnected()
    if (!this._inTransaction || !this.transactionConnection) throw new Error('No active transaction')
    try {
      await this.transactionConnection.run('ROLLBACK')
    } finally {
      this.transactionConnection.closeSync()
      this.transactionConnection = null
      this._inTransaction = false
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      const versionResult = await this.execute('SELECT version() as version')
      const serverVersion = `DuckDB ${(versionResult.rows[0]?.version as string) || 'Unknown'}`

      const serverInfo: Record<string, string> = {}
      try {
        const dbPath = config.filepath || config.database
        if (dbPath && dbPath !== ':memory:') {
          const stats = fs.statSync(dbPath)
          const sizeKB = (stats.size / 1024).toFixed(1)
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
          serverInfo['File Size'] = stats.size < 1024 * 1024 ? `${sizeKB} KB` : `${sizeMB} MB`
        }
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: this.formatError(error) }
    }
  }

  async execute(sql: string, params?: unknown[], useTransaction?: boolean): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()
    const conn = (useTransaction && this.transactionConnection) ? this.transactionConnection : this.connection!

    try {
      const result = params && params.length > 0
        ? await conn.run(sql, params as DuckDBValue[])
        : await conn.run(sql)

      const trimmedSql = sql.trim().toLowerCase()
      const isSelect = trimmedSql.startsWith('select') ||
                       trimmedSql.startsWith('pragma') ||
                       trimmedSql.startsWith('explain') ||
                       trimmedSql.startsWith('describe') ||
                       trimmedSql.startsWith('show') ||
                       trimmedSql.startsWith('with')

      if (isSelect) {
        const columnNames = result.columnNames()
        const columns = columnNames.map((name, i) => ({
          name,
          type: String(result.columnType(i)),
          nullable: true,
          primaryKey: false
        }))

        const rawRows = await result.getRowObjectsJson()
        const rows = rawRows.map((row) => {
          const obj: Record<string, unknown> = {}
          for (const name of columnNames) {
            obj[name] = row[name] ?? null
          }
          return obj
        })

        return {
          columns,
          rows,
          rowCount: rows.length,
          affectedRows: 0,
          executionTime: Date.now() - startTime
        }
      } else {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.rowsChanged,
          executionTime: Date.now() - startTime
        }
      }
    } catch (error) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        affectedRows: 0,
        executionTime: Date.now() - startTime,
        error: this.formatError(error)
      }
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    const dbPath = this.config?.filepath || this.config?.database || 'main'
    return [{ name: dbPath.split('/').pop() || 'main' }]
  }

  async getTables(_database: string, _schema?: string): Promise<Table[]> {
    this.ensureConnected()

    const result = await this.connection!.run(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'main'
        AND table_catalog NOT IN ('system', 'temp')
      ORDER BY table_name
    `)
    const rows = await result.getRowObjectsJson()

    return rows.map((row) => ({
      name: String(row.table_name),
      type: String(row.table_type) === 'VIEW' ? TableObjectType.View : TableObjectType.Table
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const result = await this.connection!.run(`
      SELECT column_name, data_type, is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_name = ? AND table_schema = 'main'
      ORDER BY ordinal_position
    `, [table])
    const rows = await result.getRowObjectsJson()

    // Get primary key info
    const pkColumns = await this.getPrimaryKeyColumns(table)

    return rows.map((row) => ({
      name: String(row.column_name),
      type: String(row.data_type),
      nullable: String(row.is_nullable) === 'YES',
      defaultValue: row.column_default ?? null,
      primaryKey: pkColumns.includes(String(row.column_name)),
      autoIncrement: false,
      unique: false
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    try {
      const result = await this.connection!.run(`
        SELECT index_name, is_unique, sql
        FROM duckdb_indexes()
        WHERE table_name = ?
      `, [table])
      const rows = await result.getRowObjectsJson()

      return rows.map((row) => {
        const sql = String(row.sql || '')
        const colMatch = sql.match(/\(([^)]+)\)\s*$/i)
        const columns = colMatch
          ? colMatch[1].split(',').map((c) => c.trim().replace(/"/g, ''))
          : []

        return {
          name: String(row.index_name),
          columns,
          unique: row.is_unique === true || row.is_unique === 'true',
          primary: false
        }
      })
    } catch {
      return []
    }
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    try {
      const result = await this.connection!.run(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ?
          AND tc.table_schema = 'main'
      `, [table])
      const rows = await result.getRowObjectsJson()

      return rows.map((row) => ({
        name: String(row.constraint_name),
        column: String(row.column_name),
        referencedTable: String(row.referenced_table),
        referencedColumn: String(row.referenced_column)
      }))
    } catch {
      return []
    }
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    try {
      const result = await this.connection!.run(
        `SELECT sql FROM duckdb_tables() WHERE table_name = ?`, [table]
      )
      const rows = await result.getRowObjectsJson()
      if (rows.length > 0 && rows[0].sql) {
        return String(rows[0].sql)
      }
      return this.getViewDDL(table)
    } catch {
      return ''
    }
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const rawColumns = await this.getColumns(table)
    const columns = this.mapColumnsToInfo(rawColumns)
    const { countSql, countBindings, dataSql, dataBindings } = this.buildTableDataQueries(table, options, undefined, rawColumns)

    let totalCount: number
    if (options.knownTotalCount !== undefined) {
      totalCount = options.knownTotalCount
    } else {
      const countResult = await this.connection!.run(countSql, countBindings as DuckDBValue[])
      const countRows = await countResult.getRowObjectsJson()
      totalCount = Number(countRows[0]?.count ?? 0)
    }

    const dataResult = await this.connection!.run(dataSql, dataBindings as DuckDBValue[])
    const rows = (await dataResult.getRowObjectsJson()) as Record<string, unknown>[]

    return {
      columns,
      rows,
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || rows.length
    }
  }

  async queryStream(sql: string, chunkSize: number): Promise<StreamResult> {
    this.ensureConnected()

    let totalRows = 0
    try {
      const countResult = await this.connection!.run(`SELECT COUNT(*) AS count FROM (${sql})`)
      const countRows = await countResult.getRowObjectsJson()
      totalRows = Number(countRows[0]?.count ?? 0)
    } catch {
      // If count fails, leave at 0
    }

    const columns = this.mapColumnsToInfo(await this.getColumnsFromQuery(sql))
    const cursor = new DuckDBCursor(this.connection!, sql, [], chunkSize)

    return { columns, totalRows, cursor }
  }

  async selectTopStream(table: string, options: DataOptions, chunkSize: number): Promise<StreamResult> {
    this.ensureConnected()

    const { countSql, countBindings, dataSql, dataBindings } = this.buildTableDataQueries(
      table,
      { ...options, limit: undefined, offset: undefined }
    )

    const countResult = await this.connection!.run(countSql, countBindings as DuckDBValue[])
    const countRows = await countResult.getRowObjectsJson()
    const totalRows = Number(countRows[0]?.count ?? 0)

    const columns = this.mapColumnsToInfo(await this.getColumns(table))
    const cursor = new DuckDBCursor(this.connection!, dataSql, dataBindings, chunkSize)

    return { columns, totalRows, cursor }
  }

  private async getColumnsFromQuery(sql: string): Promise<Column[]> {
    try {
      const result = await this.connection!.run(`SELECT * FROM (${sql}) LIMIT 0`)
      const names = result.columnNames()
      return names.map((name, i) => ({
        name,
        type: String(result.columnType(i)),
        nullable: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        unique: false
      }))
    } catch {
      return []
    }
  }

  // Schema editing operations

  private async runSchemaSQL(sql: string): Promise<SchemaOperationResult> {
    try {
      await this.connection!.run(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  getDataTypes(): DataTypeInfo[] {
    return DUCKDB_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()
    try {
      const result = await this.connection!.run(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = ?
          AND tc.table_schema = 'main'
        ORDER BY kcu.ordinal_position
      `, [table])
      const rows = await result.getRowObjectsJson()
      return rows.map((row) => String(row.column_name))
    } catch {
      return []
    }
  }

  // DuckDB doesn't support stored procedures/functions
  async getRoutines(): Promise<Routine[]> {
    return []
  }

  async getRoutineDefinition(): Promise<string> {
    return '-- DuckDB does not support stored procedures or functions'
  }

  private buildColumnDefinition(col: ColumnDefinition): string {
    let def = `"${col.name}" ${col.type}`
    if (col.length) def += `(${col.length})`
    else if (col.precision && col.scale) def += `(${col.precision},${col.scale})`
    else if (col.precision) def += `(${col.precision})`
    if (col.primaryKey) def += ' PRIMARY KEY'
    if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
    if (col.unique && !col.primaryKey) def += ' UNIQUE'
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      const defaultVal = typeof col.defaultValue === 'string'
        ? `'${col.defaultValue.replace(/'/g, "''")}'`
        : col.defaultValue
      def += ` DEFAULT ${defaultVal}`
    }
    return def
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request

    if (column.primaryKey) {
      return { success: false, error: 'DuckDB does not support adding PRIMARY KEY columns. Table must be recreated.' }
    }
    if (!column.nullable && column.defaultValue === undefined) {
      return { success: false, error: 'DuckDB requires a default value when adding NOT NULL columns' }
    }

    return this.runSchemaSQL(`ALTER TABLE "${table}" ADD COLUMN ${this.buildColumnDefinition(column)}`)
  }

  async modifyColumn(_request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'DuckDB does not support modifying column types directly. Table must be recreated.' }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    return this.runSchemaSQL(`ALTER TABLE "${request.table}" DROP COLUMN "${request.columnName}"`)
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    return this.runSchemaSQL(`ALTER TABLE "${request.table}" RENAME COLUMN "${request.oldName}" TO "${request.newName}"`)
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index } = request
    const unique = index.unique ? 'UNIQUE ' : ''
    const columns = index.columns.map((c) => `"${c}"`).join(', ')
    return this.runSchemaSQL(`CREATE ${unique}INDEX "${index.name}" ON "${table}" (${columns})`)
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    return this.runSchemaSQL(`DROP INDEX "${request.indexName}"`)
  }

  async addForeignKey(_request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'DuckDB does not support adding foreign keys to existing tables' }
  }

  async dropForeignKey(_request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'DuckDB does not support dropping foreign keys from existing tables' }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table } = request

    const columnDefs = table.columns.map((col) => this.buildColumnDefinition(col))

    if (table.primaryKey && table.primaryKey.length > 0) {
      const hasInlinePK = table.columns.some((c) => c.primaryKey)
      if (!hasInlinePK) {
        columnDefs.push(`PRIMARY KEY (${table.primaryKey.map((c) => `"${c}"`).join(', ')})`)
      }
    }

    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        columnDefs.push(
          `CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns.map((c) => `"${c}"`).join(', ')}) ` +
          `REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((c) => `"${c}"`).join(', ')})${onUpdate}${onDelete}`
        )
      }
    }

    const sql = `CREATE TABLE "${table.name}" (\n  ${columnDefs.join(',\n  ')}\n)`

    try {
      await this.connection!.run(sql)

      if (table.indexes) {
        for (const idx of table.indexes) {
          await this.createIndex({ table: table.name, index: idx })
        }
      }

      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE "${request.table}"${request.cascade ? ' CASCADE' : ''}`
    return this.runSchemaSQL(sql)
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    return this.runSchemaSQL(`ALTER TABLE "${request.oldName}" RENAME TO "${request.newName}"`)
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sql, bindings } = this.buildInsertSQL(request.table, request.values)

    try {
      const result = await this.connection!.run(sql, bindings as DuckDBValue[])
      return { success: true, sql, affectedRows: result.rowsChanged }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sql, bindings } = this.buildDeleteSQL(request.table, request.primaryKeyValues)

    try {
      const result = await this.connection!.run(sql, bindings as DuckDBValue[])
      return { success: true, sql, affectedRows: result.rowsChanged }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // View operations
  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const replace = view.replaceIfExists ? 'OR REPLACE ' : ''
    return this.runSchemaSQL(`CREATE ${replace}VIEW "${view.name}" AS ${view.selectStatement}`)
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    return this.runSchemaSQL(`DROP VIEW IF EXISTS "${request.viewName}"`)
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    try {
      const ddl = await this.getViewDDL(request.oldName)
      const selectMatch = ddl.match(/AS\s+(SELECT[\s\S]+?)(?:;?\s*$)/i)
      if (!selectMatch) {
        return { success: false, error: 'Could not parse view definition' }
      }

      const dropSql = `DROP VIEW "${request.oldName}"`
      const createSql = `CREATE VIEW "${request.newName}" AS ${selectMatch[1]}`

      await this.connection!.run(dropSql)
      await this.connection!.run(createSql)

      return { success: true, sql: `${dropSql};\n${createSql}` }
    } catch (error) {
      return { success: false, error: this.formatError(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()
    try {
      const result = await this.connection!.run(
        `SELECT sql FROM duckdb_views() WHERE view_name = ?`,
        [viewName]
      )
      const rows = await result.getRowObjectsJson()
      return rows.length > 0 ? String(rows[0].sql || '') : ''
    } catch {
      return ''
    }
  }

  // DuckDB doesn't support user management
  async getUsers(): Promise<DatabaseUser[]> {
    return []
  }

  async createUser(_request: CreateUserRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'User creation is not supported for this database type' }
  }

  async dropUser(_request: DropUserRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'User deletion is not supported for this database type' }
  }

  // DuckDB doesn't support triggers
  async getTriggers(_table?: string): Promise<Trigger[]> {
    return []
  }

  async getTriggerDefinition(_name: string, _table?: string): Promise<string> {
    return '-- DuckDB does not support triggers'
  }

  async createTrigger(_request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Trigger creation is not supported for DuckDB' }
  }

  async dropTrigger(_request: DropTriggerRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Trigger deletion is not supported for DuckDB' }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.connection) return false
      await this.connection.run('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  override async cancelQuery(): Promise<boolean> {
    try {
      if (!this.connection) return false
      this.connection.interrupt()
      return true
    } catch {
      return false
    }
  }
}
