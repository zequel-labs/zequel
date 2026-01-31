import { createClient, ClickHouseClient } from '@clickhouse/client'
import { BaseDriver, TestConnectionResult } from './base'
import type {
  ConnectionConfig,
  QueryResult,
  Database as DatabaseInfo,
  Table,
  Column,
  Index,
  ForeignKey,
  DataOptions,
  DataResult,
  ColumnInfo,
  Routine,
  DatabaseUser,
  UserPrivilege,
  Trigger
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
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest,
  SchemaOperationResult,
  DataTypeInfo,
  ColumnDefinition,
  CreateTriggerRequest,
  DropTriggerRequest
} from '../types/schema-operations'

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
  readonly type = 'clickhouse'
  private client: ClickHouseClient | null = null
  private currentDatabase: string = ''
  private currentAbortController: AbortController | null = null

  /** Escape a string value for use in ClickHouse SQL */
  private escapeValue(value: string): string {
    return value.replace(/'/g, "\\'").replace(/\\/g, '\\\\')
  }

  /** Escape an identifier for use in ClickHouse SQL */
  private escapeIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '\\`')}\``
  }

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const sslEnabled = config.ssl || (config.sslConfig?.enabled && config.sslConfig?.mode !== 'disable')
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
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async execute(sql: string, _params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    const abortController = new AbortController()
    this.currentAbortController = abortController

    try {
      const trimmedSql = sql.trim().toUpperCase()
      const isSelect = trimmedSql.startsWith('SELECT') ||
                        trimmedSql.startsWith('SHOW') ||
                        trimmedSql.startsWith('DESCRIBE') ||
                        trimmedSql.startsWith('DESC') ||
                        trimmedSql.startsWith('EXPLAIN') ||
                        trimmedSql.startsWith('EXISTS') ||
                        trimmedSql.startsWith('WITH')

      if (isSelect) {
        const resultSet = await this.client!.query({
          query: sql,
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
          query: sql,
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
        error: error instanceof Error ? error.message : String(error)
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
      type: (row.engine === 'View' || row.engine === 'MaterializedView') ? 'view' as const : 'table' as const,
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

    const { clause: whereClause } = this.buildWhereClauseClickHouse(options)
    const orderClause = this.buildOrderClauseClickHouse(options)
    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    // Get total count
    const countResult = await this.client!.query({
      query: `SELECT count() as count FROM \`${this.currentDatabase}\`.\`${table}\` ${whereClause}`,
      format: 'JSONEachRow'
    })
    const countRows = await countResult.json<{ count: string | number }>()
    const totalCount = Number(countRows[0]?.count) || 0

    // Get columns info
    const columnsInfo = await this.getColumns(table)
    const columns: ColumnInfo[] = columnsInfo.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      primaryKey: col.primaryKey,
      defaultValue: col.defaultValue,
      autoIncrement: col.autoIncrement
    }))

    // Get data
    const dataResult = await this.client!.query({
      query: `SELECT * FROM \`${this.currentDatabase}\`.\`${table}\` ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`,
      format: 'JSONEachRow'
    })
    const rows = await dataResult.json<Record<string, unknown>>()

    return {
      columns,
      rows,
      totalCount,
      offset,
      limit
    }
  }

  private buildWhereClauseClickHouse(options: DataOptions): { clause: string; values: unknown[] } {
    if (!options.filters || options.filters.length === 0) {
      return { clause: '', values: [] }
    }

    const conditions: string[] = []
    const values: unknown[] = []

    for (const filter of options.filters) {
      const col = `\`${filter.column}\``
      switch (filter.operator) {
        case 'IS NULL':
          conditions.push(`${col} IS NULL`)
          break
        case 'IS NOT NULL':
          conditions.push(`${col} IS NOT NULL`)
          break
        case 'IN':
        case 'NOT IN':
          if (Array.isArray(filter.value)) {
            const vals = filter.value.map((v) =>
              typeof v === 'string' ? `'${v.replace(/'/g, "\\'")}'` : v
            ).join(', ')
            conditions.push(`${col} ${filter.operator} (${vals})`)
          }
          break
        case 'LIKE':
        case 'NOT LIKE':
          conditions.push(`${col} ${filter.operator} '%${String(filter.value).replace(/'/g, "\\'") }%'`)
          break
        default: {
          const val = typeof filter.value === 'string'
            ? `'${filter.value.replace(/'/g, "\\'")}'`
            : filter.value
          conditions.push(`${col} ${filter.operator} ${val}`)
          values.push(filter.value)
        }
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    }
  }

  private buildOrderClauseClickHouse(options: DataOptions): string {
    if (!options.orderBy) return ''
    const direction = options.orderDirection || 'ASC'
    return `ORDER BY \`${options.orderBy}\` ${direction}`
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
        ? `'${col.defaultValue.replace(/'/g, "\\'")}'`
        : col.defaultValue
      def += ` DEFAULT ${defaultVal}`
    }

    if (col.comment) {
      def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      sql += ` COMMENT '${table.comment.replace(/'/g, "\\'")}'`
    }

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE \`${this.currentDatabase}\`.\`${request.table}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `RENAME TABLE \`${this.currentDatabase}\`.\`${request.oldName}\` TO \`${this.currentDatabase}\`.\`${request.newName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, values } = request

    const columns = Object.keys(values)
    const columnList = columns.map((c) => `\`${c}\``).join(', ')
    const valueList = columns.map((c) => {
      const val = values[c]
      if (val === null || val === undefined) return 'NULL'
      if (typeof val === 'string') return `'${val.replace(/'/g, "\\'")}'`
      return String(val)
    }).join(', ')

    const sql = `INSERT INTO \`${this.currentDatabase}\`.\`${table}\` (${columnList}) VALUES (${valueList})`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql, affectedRows: 1 }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues } = request

    // ClickHouse uses lightweight DELETE (available since 22.8)
    const conditions = Object.keys(primaryKeyValues).map((col) => {
      const val = primaryKeyValues[col]
      if (val === null || val === undefined) return `\`${col}\` IS NULL`
      if (typeof val === 'string') return `\`${col}\` = '${val.replace(/'/g, "\\'")}'`
      return `\`${col}\` = ${val}`
    }).join(' AND ')

    const sql = `ALTER TABLE \`${this.currentDatabase}\`.\`${table}\` DELETE WHERE ${conditions}`

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP VIEW IF EXISTS \`${this.currentDatabase}\`.\`${request.viewName}\``

    try {
      await this.client!.command({ query: sql })
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
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
  async getRoutines(_type?: 'PROCEDURE' | 'FUNCTION'): Promise<Routine[]> {
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
        type: 'FUNCTION' as const,
        definition: row.create_query
      }))
    } catch {
      return []
    }
  }

  async getRoutineDefinition(name: string, _type: 'PROCEDURE' | 'FUNCTION'): Promise<string> {
    this.ensureConnected()

    try {
      const resultSet = await this.client!.query({
        query: `SELECT create_query FROM system.functions WHERE name = '${this.escapeValue(name)}' AND origin = 'SQLUserDefined'`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{ create_query: string }>()

      return rows.length > 0 ? rows[0].create_query : `-- Function '${name}' not found`
    } catch (error) {
      return `-- Error getting function definition: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  // User management
  async getUsers(): Promise<DatabaseUser[]> {
    this.ensureConnected()

    try {
      const resultSet = await this.client!.query({
        query: `SELECT name FROM system.users ORDER BY name`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<{ name: string }>()

      return rows.map((row) => ({
        name: row.name,
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

  async getUserPrivileges(username: string, _host?: string): Promise<UserPrivilege[]> {
    this.ensureConnected()

    try {
      const resultSet = await this.client!.query({
        query: `SHOW GRANTS FOR '${this.escapeValue(username)}'`,
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<Record<string, string>>()

      return rows.map((row) => {
        const grant = Object.values(row)[0] || ''
        return {
          privilege: grant,
          grantee: username
        }
      })
    } catch {
      return []
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
