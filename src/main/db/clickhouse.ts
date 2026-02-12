import { createClient, ClickHouseClient } from '@clickhouse/client'
import knexLib, { type Knex } from 'knex'
import { BaseDriver, TestConnectionResult } from './base'
import type { StreamResult } from './cursors/BaseCursor'
import { ClickHouseCursor } from './cursors/ClickHouseCursor'
import {
  DatabaseType,
  TableObjectType,
  RoutineType,
  type ConnectionConfig,
  type QueryResult,
  type Database as DatabaseInfo,
  type Table,
  type Column,
  type Index,
  type ForeignKey,
  type DataOptions,
  type DataResult,
  type ColumnInfo,
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
  ColumnDefinition,
  CreateTriggerRequest,
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '../types/schema-operations'

const knex = knexLib({ client: 'mysql2' })

// ClickHouse data types
const CLICKHOUSE_DATA_TYPES: DataTypeInfo[] = [
  // Numeric - Integer
  { name: 'Int8', category: 'numeric' },
  { name: 'Int16', category: 'numeric' },
  { name: 'Int32', category: 'numeric' },
  { name: 'Int64', category: 'numeric' },
  { name: 'Int128', category: 'numeric' },
  { name: 'Int256', category: 'numeric' },
  { name: 'UInt8', category: 'numeric' },
  { name: 'UInt16', category: 'numeric' },
  { name: 'UInt32', category: 'numeric' },
  { name: 'UInt64', category: 'numeric' },
  { name: 'UInt128', category: 'numeric' },
  { name: 'UInt256', category: 'numeric' },
  // Numeric - Float
  { name: 'Float32', category: 'numeric' },
  { name: 'Float64', category: 'numeric' },
  { name: 'Decimal', category: 'numeric', hasPrecision: true, defaultPrecision: 10, defaultScale: 0 },
  { name: 'Decimal32', category: 'numeric', hasPrecision: true, defaultPrecision: 9, defaultScale: 0 },
  { name: 'Decimal64', category: 'numeric', hasPrecision: true, defaultPrecision: 18, defaultScale: 0 },
  { name: 'Decimal128', category: 'numeric', hasPrecision: true, defaultPrecision: 38, defaultScale: 0 },
  // String
  { name: 'String', category: 'string' },
  { name: 'FixedString', category: 'string', hasLength: true, defaultLength: 16 },
  // DateTime
  { name: 'Date', category: 'datetime' },
  { name: 'Date32', category: 'datetime' },
  { name: 'DateTime', category: 'datetime' },
  { name: 'DateTime64', category: 'datetime' },
  // Boolean
  { name: 'Bool', category: 'boolean' },
  // JSON
  { name: 'JSON', category: 'json' },
  // Other
  { name: 'UUID', category: 'other' },
  { name: 'IPv4', category: 'other' },
  { name: 'IPv6', category: 'other' },
  { name: 'Enum8', category: 'other' },
  { name: 'Enum16', category: 'other' },
  { name: 'Array', category: 'other' },
  { name: 'Map', category: 'other' },
  { name: 'Tuple', category: 'other' },
  { name: 'Nullable', category: 'other' },
  { name: 'LowCardinality', category: 'other' }
]

export class ClickHouseDriver extends BaseDriver {
  readonly type = DatabaseType.ClickHouse
  protected override knex = knex
  private client: ClickHouseClient | null = null
  private currentDatabase: string = ''
  private currentAbortController: AbortController | null = null

  protected override compileQuery(builder: Knex.QueryBuilder): { sql: string; bindings: unknown[] } {
    return { sql: builder.toQuery(), bindings: [] }
  }

  protected override applyILike(builder: Knex.QueryBuilder, column: string, value: unknown): Knex.QueryBuilder {
    return builder.whereRaw('?? ILIKE ?', [column, value])
  }

  protected override applyNotILike(builder: Knex.QueryBuilder, column: string, value: unknown): Knex.QueryBuilder {
    return builder.whereRaw('?? NOT ILIKE ?', [column, value])
  }

  /** Escape a string value for use in ClickHouse SQL */
  private escapeValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  }

  /** Interpolate `?` placeholders with escaped parameter values */
  private interpolateParams(sql: string, params?: unknown[]): string {
    if (!params || params.length === 0) return sql
    let idx = 0
    return sql.replace(/\?/g, () => {
      if (idx >= params.length) return '?'
      const val = params[idx++]
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'number') return String(val)
      if (typeof val === 'boolean') return val ? '1' : '0'
      return `'${this.escapeValue(String(val))}'`
    })
  }

  /** Format a value for inline SQL (insertRow, updateRow, deleteRow) */
  private formatValue(val: unknown): string {
    if (val === null || val === undefined) return 'NULL'
    if (typeof val === 'number') return String(val)
    if (typeof val === 'boolean') return val ? '1' : '0'
    return `'${this.escapeValue(String(val))}'`
  }

  /** Escape an identifier for use in ClickHouse SQL */
  private escapeIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '\\`')}\``
  }

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const sslEnabled = config.ssl || config.sslConfig?.enabled
      const protocol = sslEnabled ? 'https' : 'http'
      const host = config.host || 'localhost'
      const port = config.port || 8123
      const url = `${protocol}://${host}:${port}`

      this.client = createClient({
        url,
        username: config.username || 'default',
        password: config.password || '',
        database: config.database || 'default',
        request_timeout: 30000
      })

      // Test the connection with a simple query
      await this.client.query({ query: 'SELECT 1', format: 'JSONEachRow' })

      this.currentDatabase = config.database || 'default'
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this._isConnected = false
    this.config = null
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false
      const result = await this.client.ping()
      return result.success
    } catch {
      return false
    }
  }

  async cancelQuery(): Promise<boolean> {
    const controller = this.currentAbortController
    if (!controller) {
      return false
    }

    try {
      controller.abort()
      this.currentAbortController = null
      return true
    } catch {
      return false
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      const versionResult = await this.execute('SELECT version() as version')
      const serverVersion = (versionResult.rows[0]?.version as string) || 'Unknown'

      const serverInfo: Record<string, string> = {}
      try {
        const tzResult = await this.execute('SELECT timezone() as tz')
        serverInfo['Timezone'] = (tzResult.rows[0]?.tz as string) || ''
        const uptimeResult = await this.execute('SELECT uptime() as uptime')
        const uptime = uptimeResult.rows[0]?.uptime
        if (uptime !== undefined) serverInfo['Uptime'] = `${uptime}s`
        const dbCountResult = await this.execute('SELECT count() as cnt FROM system.databases')
        const cnt = dbCountResult.rows[0]?.cnt
        if (cnt !== undefined) serverInfo['Databases'] = String(cnt)
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: this.formatError(error) }
    }
  }

  async execute(sql: string, params?: unknown[], _useTransaction?: boolean): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    const interpolatedSql = this.interpolateParams(sql, params)

    const abortController = new AbortController()
    this.currentAbortController = abortController

    try {
      const trimmedSql = interpolatedSql.trim().toUpperCase()
      const isSelect = trimmedSql.startsWith('SELECT') ||
                        trimmedSql.startsWith('SHOW') ||
                        trimmedSql.startsWith('DESCRIBE') ||
                        trimmedSql.startsWith('DESC') ||
                        trimmedSql.startsWith('EXPLAIN') ||
                        trimmedSql.startsWith('EXISTS') ||
                        trimmedSql.startsWith('WITH')

      if (isSelect) {
        const resultSet = await this.client!.query({
          query: interpolatedSql,
          format: 'JSONEachRow',
          abort_signal: abortController.signal as AbortSignal
        })
        const rows = await resultSet.json<Record<string, unknown>>()
        this.currentAbortController = null

        const columns: ColumnInfo[] = []
        if (rows.length > 0) {
          for (const key of Object.keys(rows[0])) {
            columns.push({
              name: key,
              type: typeof rows[0][key] === 'number' ? 'Number' :
                    typeof rows[0][key] === 'boolean' ? 'Boolean' : 'String',
              nullable: true
            })
          }
        }

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime
        }
      } else {
        await this.client!.command({
          query: interpolatedSql,
          abort_signal: abortController.signal as AbortSignal
        })
        this.currentAbortController = null
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: 0,
          executionTime: Date.now() - startTime
        }
      }
    } catch (error) {
      this.currentAbortController = null
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: this.formatError(error)
      }
    }
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: 'SHOW DATABASES',
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{ name: string }>()

    return rows.map((row) => ({
      name: row.name
    }))
  }

  async getTables(database: string, _schema?: string): Promise<Table[]> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `
        SELECT
          name,
          engine,
          total_rows,
          total_bytes,
          comment
        FROM system.tables
        WHERE database = '${this.escapeValue(database)}'
        ORDER BY name
      `,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{
      name: string
      engine: string
      total_rows: string | number
      total_bytes: string | number
      comment: string
    }>()

    return rows.map((row) => ({
      name: row.name,
      type: (row.engine === 'View' || row.engine === 'MaterializedView') ? TableObjectType.View : TableObjectType.Table,
      rowCount: Number(row.total_rows) || 0,
      size: Number(row.total_bytes) || 0,
      comment: row.comment || undefined
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `
        SELECT
          name,
          type,
          default_kind,
          default_expression,
          comment,
          is_in_primary_key,
          is_in_sorting_key
        FROM system.columns
        WHERE database = '${this.escapeValue(this.currentDatabase)}'
          AND table = '${this.escapeValue(table)}'
        ORDER BY position
      `,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{
      name: string
      type: string
      default_kind: string
      default_expression: string
      comment: string
      is_in_primary_key: number
      is_in_sorting_key: number
    }>()

    return rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.type.startsWith('Nullable'),
      defaultValue: row.default_expression || null,
      primaryKey: row.is_in_primary_key === 1,
      autoIncrement: false, // ClickHouse does not have auto-increment
      unique: false, // ClickHouse does not have unique constraints
      comment: row.comment || undefined
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    try {
      // Get primary key info from system.tables
      const resultSet = await this.client!.query({
        query: `
          SELECT
            primary_key,
            sorting_key
          FROM system.tables
          WHERE database = '${this.escapeValue(this.currentDatabase)}'
            AND name = '${this.escapeValue(table)}'
        `,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{
        primary_key: string
        sorting_key: string
      }>()

      const indexes: Index[] = []

      if (rows.length > 0) {
        const row = rows[0]

        if (row.primary_key) {
          indexes.push({
            name: 'PRIMARY',
            columns: row.primary_key.split(',').map((c: string) => c.trim()),
            unique: true,
            primary: true,
            type: 'PRIMARY KEY'
          })
        }

        if (row.sorting_key && row.sorting_key !== row.primary_key) {
          indexes.push({
            name: 'ORDER BY',
            columns: row.sorting_key.split(',').map((c: string) => c.trim()),
            unique: false,
            primary: false,
            type: 'SORTING KEY'
          })
        }
      }

      // Get data-skipping indexes
      try {
        const skipIdxResult = await this.client!.query({
          query: `
            SELECT
              name,
              expr,
              type
            FROM system.data_skipping_indices
            WHERE database = '${this.escapeValue(this.currentDatabase)}'
              AND table = '${this.escapeValue(table)}'
          `,
          format: 'JSONEachRow'
        })
        const skipIdxRows = await skipIdxResult.json<{
          name: string
          expr: string
          type: string
        }>()

        for (const idx of skipIdxRows) {
          indexes.push({
            name: idx.name,
            columns: idx.expr.split(',').map((c: string) => c.trim()),
            unique: false,
            primary: false,
            type: idx.type
          })
        }
      } catch {
        // data_skipping_indices may not be available in all versions
      }

      return indexes
    } catch {
      return []
    }
  }

  async getForeignKeys(_table: string): Promise<ForeignKey[]> {
    // ClickHouse does not support foreign keys
    return []
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `SHOW CREATE TABLE \`${this.currentDatabase}\`.\`${table}\``,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{ statement: string }>()

    return rows.length > 0 ? rows[0].statement : ''
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { countSql, dataSql } = this.buildTableDataQueries(table, options, this.currentDatabase)

    let totalCount: number
    if (options.knownTotalCount !== undefined) {
      totalCount = options.knownTotalCount
    } else {
      const countResult = await this.client!.query({ query: countSql, format: 'JSONEachRow' })
      const countRows = await countResult.json<{ count: string | number }>()
      totalCount = Number(countRows[0]?.count) || 0
    }

    const columns = this.mapColumnsToInfo(await this.getColumns(table))
    const dataResult = await this.client!.query({ query: dataSql, format: 'JSONEachRow' })
    const rows = await dataResult.json<Record<string, unknown>>()

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
      const countResult = await this.client!.query({ query: `SELECT COUNT(*) AS count FROM (${sql})`, format: 'JSONEachRow' })
      const countRows = await countResult.json<{ count: string | number }>()
      totalRows = Number(countRows[0]?.count) || 0
    } catch {
      // If count fails, leave at 0
    }

    const columns = this.mapColumnsToInfo(await this.getColumnsFromQuery(sql))
    const cursor = new ClickHouseCursor(this.client!, sql, chunkSize)

    return { columns, totalRows, cursor }
  }

  async selectTopStream(table: string, options: DataOptions, chunkSize: number): Promise<StreamResult> {
    this.ensureConnected()

    const { countSql, dataSql } = this.buildTableDataQueries(
      table,
      { ...options, limit: undefined, offset: undefined },
      this.currentDatabase
    )

    const countResult = await this.client!.query({ query: countSql, format: 'JSONEachRow' })
    const countRows = await countResult.json<{ count: string | number }>()
    const totalRows = Number(countRows[0]?.count) || 0

    const columns = this.mapColumnsToInfo(await this.getColumns(table))
    const cursor = new ClickHouseCursor(this.client!, dataSql, chunkSize)

    return { columns, totalRows, cursor }
  }

  private async getColumnsFromQuery(sql: string): Promise<Column[]> {
    try {
      const resultSet = await this.client!.query({ query: `${sql} LIMIT 1`, format: 'JSONEachRow' })
      const rows = await resultSet.json<Record<string, unknown>>()
      if (rows.length > 0) {
        return Object.keys(rows[0]).map((key) => ({
          name: key,
          type: 'String',
          nullable: true,
          defaultValue: null,
          primaryKey: false,
          autoIncrement: false,
          unique: false
        }))
      }
      return []
    } catch {
      return []
    }
  }

  // Schema editing operations

  getDataTypes(): DataTypeInfo[] {
    return CLICKHOUSE_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `
        SELECT primary_key
        FROM system.tables
        WHERE database = '${this.escapeValue(this.currentDatabase)}'
          AND name = '${this.escapeValue(table)}'
      `,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{ primary_key: string }>()

    if (rows.length > 0 && rows[0].primary_key) {
      return rows[0].primary_key.split(',').map((c: string) => c.trim())
    }
    return []
  }

  private buildColumnDefinition(col: ColumnDefinition): string {
    let typeDef = col.type
    if (col.length) typeDef = `${col.type}(${col.length})`
    else if (col.precision !== undefined && col.scale !== undefined) typeDef = `${col.type}(${col.precision}, ${col.scale})`
    else if (col.precision !== undefined) typeDef = `${col.type}(${col.precision})`

    if (col.nullable) typeDef = `Nullable(${typeDef})`

    let def = `\`${col.name}\` ${typeDef}`

    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      const defaultVal = typeof col.defaultValue === 'string'
        ? `'${this.escapeValue(col.defaultValue)}'`
        : col.defaultValue
      def += ` DEFAULT ${defaultVal}`
    }

    if (col.comment !== undefined) {
      def += ` COMMENT '${this.escapeValue(col.comment || '')}'`
    }

    return def
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request

    const columnDef = this.buildColumnDefinition(column)
    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` ADD COLUMN ${columnDef}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newDefinition } = request

    // ClickHouse supports MODIFY COLUMN for type changes
    // and RENAME COLUMN for name changes
    const statements: string[] = []

    if (oldName !== newDefinition.name) {
      statements.push(`ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` RENAME COLUMN \`${oldName}\` TO \`${newDefinition.name}\``)
    }

    const columnDef = this.buildColumnDefinition(newDefinition)
    statements.push(`ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` MODIFY COLUMN ${columnDef}`)

    const sql = statements.join(';\n')

    try {
      for (const stmt of statements) {
        await this.client!.command({ query: stmt })
      }
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, columnName } = request

    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` DROP COLUMN \`${columnName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newName } = request

    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` RENAME COLUMN \`${oldName}\` TO \`${newName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index } = request

    // ClickHouse uses data-skipping indexes
    const columns = index.columns.map((c) => `\`${c}\``).join(', ')
    const indexType = index.type || 'minmax'
    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` ADD INDEX \`${index.name}\` (${columns}) TYPE ${indexType} GRANULARITY 4`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, indexName } = request

    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` DROP INDEX \`${indexName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async addForeignKey(_request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'ClickHouse does not support foreign keys'
    }
  }

  async dropForeignKey(_request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'ClickHouse does not support foreign keys'
    }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table } = request

    const columnDefs = table.columns.map((col) => this.buildColumnDefinition(col))

    // Build the CREATE TABLE statement
    let sql = `CREATE TABLE \`${this.currentDatabase}\`.\`${table.name}\` (\n  ${columnDefs.join(',\n  ')}\n)`

    // Determine engine - default to MergeTree
    sql += ` ENGINE = MergeTree()`

    // Add ORDER BY using primary key columns or first column
    const pkColumns = table.columns.filter((c) => c.primaryKey).map((c) => `\`${c.name}\``)
    if (pkColumns.length > 0) {
      sql += ` ORDER BY (${pkColumns.join(', ')})`
      sql += ` PRIMARY KEY (${pkColumns.join(', ')})`
    } else if (table.primaryKey && table.primaryKey.length > 0) {
      const pkCols = table.primaryKey.map((c) => `\`${c}\``).join(', ')
      sql += ` ORDER BY (${pkCols})`
      sql += ` PRIMARY KEY (${pkCols})`
    } else {
      // MergeTree requires ORDER BY; use tuple() for no ordering
      sql += ` ORDER BY tuple()`
    }

    if (table.comment) {
      sql += ` COMMENT '${this.escapeValue(table.comment)}'`
    }

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE \`${this.currentDatabase}\`.\`${request.table}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `RENAME TABLE \`${this.currentDatabase}\`.\`${request.oldName}\` TO \`${this.currentDatabase}\`.\`${request.newName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async updateTableComment(table: string, comment: string | null): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const commentValue = comment === null || comment === ''
      ? "''"
      : `'${this.escapeValue(comment)}'`
    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` MODIFY COMMENT ${commentValue}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sql } = this.buildInsertSQL(request.table, request.values, this.currentDatabase)

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql, affectedRows: 1 }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async updateRow(request: UpdateRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues, values } = request

    const setClauses = Object.keys(values).map((col) =>
      `${this.escapeIdentifier(col)} = ${this.formatValue(values[col])}`
    ).join(', ')

    const conditions = Object.keys(primaryKeyValues).map((col) => {
      const val = primaryKeyValues[col]
      if (val === null || val === undefined) return `${this.escapeIdentifier(col)} IS NULL`
      return `${this.escapeIdentifier(col)} = ${this.formatValue(val)}`
    }).join(' AND ')

    const sql = `ALTER TABLE ${this.escapeIdentifier(this.currentDatabase)}.${this.escapeIdentifier(table)} UPDATE ${setClauses} WHERE ${conditions}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql, affectedRows: 1 }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues } = request

    const conditions = Object.keys(primaryKeyValues).map((col) => {
      const val = primaryKeyValues[col]
      if (val === null || val === undefined) return `${this.escapeIdentifier(col)} IS NULL`
      return `${this.escapeIdentifier(col)} = ${this.formatValue(val)}`
    }).join(' AND ')

    const sql = `ALTER TABLE ${this.escapeIdentifier(this.currentDatabase)}.${this.escapeIdentifier(table)} DELETE WHERE ${conditions}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql, affectedRows: 1 }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // View operations
  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const createOrReplace = view.replaceIfExists ? 'CREATE OR REPLACE VIEW' : 'CREATE VIEW'
    const sql = `${createOrReplace} \`${this.currentDatabase}\`.\`${view.name}\` AS ${view.selectStatement}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP VIEW IF EXISTS \`${this.currentDatabase}\`.\`${request.viewName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    // ClickHouse does not have RENAME VIEW; must drop and recreate
    const sql = `RENAME TABLE \`${this.currentDatabase}\`.\`${request.oldName}\` TO \`${this.currentDatabase}\`.\`${request.newName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `SHOW CREATE TABLE \`${this.currentDatabase}\`.\`${viewName}\``,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{ statement: string }>()

    return rows.length > 0 ? rows[0].statement : ''
  }

  // Routine operations - ClickHouse does not support stored procedures/functions in the traditional sense
  async getRoutines(_type?: RoutineType): Promise<Routine[]> {
    this.ensureConnected()

    try {
      // ClickHouse has user-defined functions (UDFs)
      const resultSet = await this.client!.query({
        query: `SELECT name, create_query FROM system.functions WHERE origin = 'SQLUserDefined' ORDER BY name`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{ name: string; create_query: string }>()

      return rows.map((row) => ({
        name: row.name,
        type: RoutineType.Function,
        definition: row.create_query
      }))
    } catch {
      return []
    }
  }

  async getRoutineDefinition(name: string, _type: RoutineType): Promise<string> {
    this.ensureConnected()

    try {
      const resultSet = await this.client!.query({
        query: `SELECT create_query FROM system.functions WHERE name = '${this.escapeValue(name)}' AND origin = 'SQLUserDefined'`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{ create_query: string }>()

      return rows.length > 0 ? rows[0].create_query : `-- Function '${name}' not found`
    } catch (error) {
      return `-- Error getting function definition: ${this.formatError(error)}`
    }
  }

  // User management
  async getUsers(): Promise<DatabaseUser[]> {
    this.ensureConnected()

    try {
      const resultSet = await this.client!.query({
        query: `SELECT name, auth_type FROM system.users ORDER BY name`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{ name: string; auth_type: string }>()

      return rows.map((row) => ({
        name: row.name,
        hasPassword: row.auth_type !== 'no_password',
        login: true
      }))
    } catch {
      // Fallback if system.users is not accessible
      try {
        const resultSet = await this.client!.query({
          query: `SELECT currentUser() as user`,
          format: 'JSONEachRow'
        })
        const rows = await resultSet.json<{ user: string }>()
        return [{
          name: rows[0]?.user || 'default',
          login: true
        }]
      } catch {
        return []
      }
    }
  }

  async createUser(request: CreateUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { name, password } = request.user

    let sql: string
    let displaySql: string

    if (password) {
      sql = `CREATE USER ${this.escapeIdentifier(name)} IDENTIFIED BY '${this.escapeValue(password)}'`
      displaySql = `CREATE USER ${this.escapeIdentifier(name)} IDENTIFIED BY '****'`
    } else {
      sql = `CREATE USER ${this.escapeIdentifier(name)} IDENTIFIED WITH no_password`
      displaySql = sql
    }

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql: displaySql }
    } catch (error) {
      return { success: false, sql: displaySql, error: this.formatError(error) }
    }
  }

  async dropUser(request: DropUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP USER ${this.escapeIdentifier(request.name)}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // Trigger operations - ClickHouse does not support triggers
  async getTriggers(_table?: string): Promise<Trigger[]> {
    return []
  }

  async getTriggerDefinition(_name: string, _table?: string): Promise<string> {
    return '-- ClickHouse does not support triggers'
  }

  async createTrigger(_request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'ClickHouse does not support triggers'
    }
  }

  async dropTrigger(_request: DropTriggerRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'ClickHouse does not support triggers'
    }
  }

  // ClickHouse-specific: Get partition information
  async getPartitions(table: string): Promise<{
    partition: string
    name: string
    rows: number
    bytesOnDisk: number
    dataCompressedBytes: number
    dataUncompressedBytes: number
    engine: string
  }[]> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `
        SELECT
          partition,
          name,
          rows,
          bytes_on_disk,
          data_compressed_bytes,
          data_uncompressed_bytes,
          engine
        FROM system.parts
        WHERE database = '${this.escapeValue(this.currentDatabase)}'
          AND table = '${this.escapeValue(table)}'
          AND active = 1
        ORDER BY partition, name
      `,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{
      partition: string
      name: string
      rows: string | number
      bytes_on_disk: string | number
      data_compressed_bytes: string | number
      data_uncompressed_bytes: string | number
      engine: string
    }>()

    return rows.map((row) => ({
      partition: row.partition,
      name: row.name,
      rows: Number(row.rows),
      bytesOnDisk: Number(row.bytes_on_disk),
      dataCompressedBytes: Number(row.data_compressed_bytes),
      dataUncompressedBytes: Number(row.data_uncompressed_bytes),
      engine: row.engine
    }))
  }

  // ClickHouse-specific: Get MergeTree engine info
  async getEngineInfo(table: string): Promise<{
    engine: string
    engineFull: string
    partitionKey: string
    sortingKey: string
    primaryKey: string
    samplingKey: string
  } | null> {
    this.ensureConnected()

    const resultSet = await this.client!.query({
      query: `
        SELECT
          engine,
          engine_full,
          partition_key,
          sorting_key,
          primary_key,
          sampling_key
        FROM system.tables
        WHERE database = '${this.escapeValue(this.currentDatabase)}'
          AND name = '${this.escapeValue(table)}'
      `,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<{
      engine: string
      engine_full: string
      partition_key: string
      sorting_key: string
      primary_key: string
      sampling_key: string
    }>()

    if (rows.length === 0) return null

    return {
      engine: rows[0].engine,
      engineFull: rows[0].engine_full,
      partitionKey: rows[0].partition_key,
      sortingKey: rows[0].sorting_key,
      primaryKey: rows[0].primary_key,
      samplingKey: rows[0].sampling_key
    }
  }
}
