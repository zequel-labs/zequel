import * as mssql from 'mssql'
import knexLib from 'knex'
import { BaseDriver, TestConnectionResult } from './base'
import type { StreamResult } from './cursors/BaseCursor'
import { SQLServerCursor } from './cursors/SQLServerCursor'
import { logger } from '@main/utils/logger'
import {
  DatabaseType,
  TableObjectType,
  RoutineType,
  RoutineParameterMode,
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
  type RoutineParameter,
  type Trigger,
  type DatabaseUser,
  type DatabaseSchema
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
} from '@main/types/schema-operations'
import { SQLSERVER_DATA_TYPES } from '@main/types/schema-operations'
const knex = knexLib({ client: 'mssql' })

interface MssqlColumnMeta {
  type?: ((() => mssql.ISqlType) | mssql.ISqlType) & { declaration?: string }
  nullable?: boolean
}

export class SQLServerDriver extends BaseDriver {
  readonly type = DatabaseType.SQLServer
  protected override knex = knex
  private pool: mssql.ConnectionPool | null = null
  private transaction: mssql.Transaction | null = null
  private currentDatabase: string = ''
  private currentSchema: string = 'dbo'
  private currentRequest: mssql.Request | null = null

  override get supportsTransactions(): boolean {
    return true
  }

  /** Quote a SQL Server identifier with square brackets */
  private quoteIdentifier(name: string): string {
    if (name === '*') return '*'
    return `[${name.replace(/\]/g, ']]')}]`
  }

  /** Build a schema-qualified table reference */
  private qualifiedName(name: string, schema?: string): string {
    const s = schema || this.currentSchema
    return `${this.quoteIdentifier(s)}.${this.quoteIdentifier(name)}`
  }

  /** Convert Knex ? placeholders to mssql @p0, @p1, … named params */
  private toNamedParams(sql: string): string {
    let idx = 0
    return sql.replace(/\?/g, () => `@p${idx++}`)
  }

  /** Escape a string literal (double single quotes) */
  private escapeLiteral(value: string): string {
    return value.replace(/'/g, "''")
  }

  /** Quote and join column names for SQL */
  private quotedColumns(columns: string[]): string {
    return columns.map((c) => this.quoteIdentifier(c)).join(', ')
  }

  async connect(config: ConnectionConfig): Promise<void> {
    logger.info('SQLServer connect', {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      hasPassword: !!config.password,
      sshEnabled: !!config.ssh?.enabled
    })

    try {
      const host = config.host || 'localhost'
      const [server, instanceName] = host.split('\\')

      const mssqlConfig: mssql.config = {
        server,
        port: config.port || 1433,
        database: config.database || 'master',
        user: config.username,
        password: config.password,
        requestTimeout: 300000,
        connectionTimeout: 15000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          encrypt: config.ssl ?? false,
          trustServerCertificate: config.trustServerCertificate ?? !config.ssl,
          appName: 'Zequel',
          enableArithAbort: true
        }
      }

      if (instanceName) {
        mssqlConfig.options!.instanceName = instanceName
        // When using named instances, port is determined by SQL Browser
        delete (mssqlConfig as unknown as Record<string, unknown>).port
      }

      // SSL configuration
      if (config.ssl && config.sslConfig) {
        const cryptoCredentialsDetails: Record<string, string> = {}
        if (config.sslConfig.ca) cryptoCredentialsDetails.ca = config.sslConfig.ca
        if (config.sslConfig.cert) cryptoCredentialsDetails.cert = config.sslConfig.cert
        if (config.sslConfig.key) cryptoCredentialsDetails.key = config.sslConfig.key
        if (Object.keys(cryptoCredentialsDetails).length > 0) {
          mssqlConfig.options!.cryptoCredentialsDetails = cryptoCredentialsDetails
        }
      }

      this.pool = new mssql.ConnectionPool(mssqlConfig)
      await this.pool.connect()

      this.currentDatabase = config.database || 'master'
      this.config = config
      this._isConnected = true
      logger.info('SQLServer connected')
    } catch (error) {
      this._isConnected = false
      const errMsg = this.formatError(error)
      logger.error('SQLServer connect failed', { error: errMsg })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.transaction) {
      try {
        await this.transaction.rollback()
      } catch {}
      this.transaction = null
      this._inTransaction = false
    }
    if (this.pool) {
      await this.pool.close()
      this.pool = null
    }
    this._isConnected = false
    this.config = null
  }

  override async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      const versionResult = await this.execute('SELECT @@VERSION AS version')
      const serverVersion = (versionResult.rows[0]?.version as string) || 'Unknown'

      const serverInfo: Record<string, string> = {}
      try {
        const editionResult = await this.execute("SELECT SERVERPROPERTY('Edition') AS edition")
        serverInfo['Edition'] = (editionResult.rows[0]?.edition as string) || ''
        const productResult = await this.execute("SELECT SERVERPROPERTY('ProductVersion') AS version")
        serverInfo['Product Version'] = (productResult.rows[0]?.version as string) || ''
        serverInfo['Server Name'] = (await this.execute('SELECT @@SERVERNAME AS name')).rows[0]?.name as string || ''
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: this.formatError(error) }
    }
  }

  override async beginTransaction(): Promise<void> {
    this.ensureConnected()
    if (this._inTransaction) throw new Error('Transaction already active')
    this.transaction = new mssql.Transaction(this.pool!)
    await this.transaction.begin()
    this._inTransaction = true
  }

  override async commitTransaction(): Promise<void> {
    this.ensureConnected()
    if (!this._inTransaction || !this.transaction) throw new Error('No active transaction')
    try {
      await this.transaction.commit()
    } finally {
      this.transaction = null
      this._inTransaction = false
    }
  }

  override async rollbackTransaction(): Promise<void> {
    this.ensureConnected()
    if (!this._inTransaction || !this.transaction) throw new Error('No active transaction')
    try {
      await this.transaction.rollback()
    } finally {
      this.transaction = null
      this._inTransaction = false
    }
  }

  override async ping(): Promise<boolean> {
    try {
      if (!this.pool) return false
      const request = new mssql.Request(this.pool)
      await request.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  override async cancelQuery(): Promise<boolean> {
    try {
      if (this.currentRequest) {
        this.currentRequest.cancel()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async execute(sql: string, params?: unknown[], useTransaction?: boolean): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const request = (useTransaction && this.transaction)
        ? new mssql.Request(this.transaction)
        : new mssql.Request(this.pool!)
      this.currentRequest = request

      // Bind parameters if provided
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          request.input(`p${index}`, param)
        })
        sql = this.toNamedParams(sql)
      }

      const result = await request.query(sql)
      this.currentRequest = null

      // mssql can return multiple recordsets; use the first one
      const recordset = result.recordset || (result.recordsets as mssql.IRecordSet<Record<string, unknown>>[])?.[0] || []
      const columns: ColumnInfo[] = recordset.columns
        ? Object.entries(recordset.columns).map(([name, meta]: [string, MssqlColumnMeta]) => ({
            name,
            type: meta.type?.declaration || 'UNKNOWN',
            nullable: meta.nullable ?? true,
            primaryKey: false
          }))
        : []

      if (columns.length > 0 || recordset.length > 0) {
        return {
          columns,
          rows: recordset as Record<string, unknown>[],
          rowCount: recordset.length,
          affectedRows: 0,
          executionTime: Date.now() - startTime
        }
      } else {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.rowsAffected?.reduce((a, b) => a + b, 0) || 0,
          executionTime: Date.now() - startTime
        }
      }
    } catch (error) {
      this.currentRequest = null
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

  // ─── Schema Introspection ─────────────────────────────────────────

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    const request = new mssql.Request(this.pool!)
    const result = await request.query(`
      SELECT name FROM sys.databases
      WHERE database_id > 4
      ORDER BY name
    `)
    return result.recordset.map((row) => ({ name: row.name }))
  }

  async getSchemas(_includeEmpty?: boolean): Promise<DatabaseSchema[]> {
    this.ensureConnected()
    const request = new mssql.Request(this.pool!)
    const result = await request.query(`
      SELECT
        s.name,
        s.principal_id,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES t WHERE t.TABLE_SCHEMA = s.name) AS table_count
      FROM sys.schemas s
      WHERE s.schema_id < 16384
        AND s.name NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
      ORDER BY
        CASE WHEN s.name = 'dbo' THEN 0 ELSE 1 END,
        s.name
    `)
    return result.recordset.map((row) => ({
      name: row.name,
      tableCount: row.table_count
    }))
  }

  setCurrentSchema(schema: string): void {
    this.currentSchema = schema
  }

  getCurrentSchema(): string {
    return this.currentSchema
  }

  async getTables(_database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()
    const targetSchema = schema || this.currentSchema

    const request = new mssql.Request(this.pool!)
    request.input('schema', mssql.NVarChar, targetSchema)

    const result = await request.query(`
      SELECT
        t.TABLE_NAME AS name,
        t.TABLE_TYPE AS type
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE t.TABLE_SCHEMA = @schema
      ORDER BY t.TABLE_NAME
    `)

    return result.recordset.map((row) => ({
      name: row.name,
      schema: targetSchema,
      type: row.type === 'VIEW' ? TableObjectType.View : TableObjectType.Table
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    request.input('table', mssql.NVarChar, table)
    request.input('schema', mssql.NVarChar, this.currentSchema)

    const result = await request.query(`
      SELECT
        c.COLUMN_NAME AS name,
        c.ORDINAL_POSITION,
        c.COLUMN_DEFAULT AS defaultValue,
        c.IS_NULLABLE AS nullable,
        CASE
          WHEN c.CHARACTER_MAXIMUM_LENGTH IS NOT NULL AND c.CHARACTER_MAXIMUM_LENGTH > 0
            THEN c.DATA_TYPE + '(' + CAST(c.CHARACTER_MAXIMUM_LENGTH AS VARCHAR(16)) + ')'
          WHEN c.CHARACTER_MAXIMUM_LENGTH = -1
            THEN c.DATA_TYPE + '(max)'
          WHEN c.NUMERIC_PRECISION IS NOT NULL AND c.DATA_TYPE IN ('decimal', 'numeric')
            THEN c.DATA_TYPE + '(' + CAST(c.NUMERIC_PRECISION AS VARCHAR(16)) + ',' + CAST(ISNULL(c.NUMERIC_SCALE, 0) AS VARCHAR(16)) + ')'
          ELSE c.DATA_TYPE
        END AS type,
        c.CHARACTER_MAXIMUM_LENGTH AS length,
        c.NUMERIC_PRECISION AS precision,
        c.NUMERIC_SCALE AS scale
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_NAME = @table AND c.TABLE_SCHEMA = @schema
      ORDER BY c.ORDINAL_POSITION
    `)

    // Get primary key columns
    const pkRequest = new mssql.Request(this.pool!)
    pkRequest.input('table', mssql.NVarChar, table)
    pkRequest.input('schema', mssql.NVarChar, this.currentSchema)
    const pkResult = await pkRequest.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        AND kcu.TABLE_NAME = @table
        AND kcu.TABLE_SCHEMA = @schema
    `)
    const pkColumns = new Set(pkResult.recordset.map((r) => r.COLUMN_NAME))

    // Get unique columns
    const uniqueRequest = new mssql.Request(this.pool!)
    uniqueRequest.input('table', mssql.NVarChar, table)
    uniqueRequest.input('schema', mssql.NVarChar, this.currentSchema)
    const uniqueResult = await uniqueRequest.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
        AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
      WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
        AND kcu.TABLE_NAME = @table
        AND kcu.TABLE_SCHEMA = @schema
    `)
    const uniqueColumns = new Set(uniqueResult.recordset.map((r) => r.COLUMN_NAME))

    // Get identity columns
    const identityRequest = new mssql.Request(this.pool!)
    identityRequest.input('table', mssql.NVarChar, table)
    identityRequest.input('schema', mssql.NVarChar, this.currentSchema)
    const identityResult = await identityRequest.query(`
      SELECT c.name
      FROM sys.columns c
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = @table AND s.name = @schema AND c.is_identity = 1
    `)
    const identityColumns = new Set(identityResult.recordset.map((r) => r.name))

    // Get column comments (extended properties)
    const commentRequest = new mssql.Request(this.pool!)
    commentRequest.input('table', mssql.NVarChar, table)
    commentRequest.input('schema', mssql.NVarChar, this.currentSchema)
    const commentResult = await commentRequest.query(`
      SELECT
        c.name AS column_name,
        CAST(ep.value AS NVARCHAR(MAX)) AS comment
      FROM sys.columns c
      JOIN sys.tables t ON c.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      LEFT JOIN sys.extended_properties ep
        ON ep.major_id = t.object_id
        AND ep.minor_id = c.column_id
        AND ep.name = 'MS_Description'
      WHERE t.name = @table AND s.name = @schema AND ep.value IS NOT NULL
    `)
    const commentMap = new Map<string, string>()
    for (const row of commentResult.recordset) {
      commentMap.set(row.column_name, row.comment)
    }

    return result.recordset.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable === 'YES',
      defaultValue: row.defaultValue,
      primaryKey: pkColumns.has(row.name),
      autoIncrement: identityColumns.has(row.name),
      unique: uniqueColumns.has(row.name),
      comment: commentMap.get(row.name),
      length: row.length > 0 ? row.length : undefined,
      precision: row.precision ?? undefined,
      scale: row.scale ?? undefined
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    request.input('table', mssql.NVarChar, table)
    request.input('schema', mssql.NVarChar, this.currentSchema)

    const result = await request.query(`
      SELECT
        ind.name AS index_name,
        ind.is_unique,
        ind.is_primary_key,
        col.name AS column_name,
        ic.key_ordinal,
        ind.type_desc AS index_type
      FROM sys.indexes ind
      INNER JOIN sys.index_columns ic ON ind.object_id = ic.object_id AND ind.index_id = ic.index_id
      INNER JOIN sys.columns col ON ic.object_id = col.object_id AND ic.column_id = col.column_id
      INNER JOIN sys.tables t ON ind.object_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = @table AND s.name = @schema
        AND ind.name IS NOT NULL
        AND t.is_ms_shipped = 0
      ORDER BY ind.name, ic.key_ordinal
    `)

    // Group by index name
    const indexMap = new Map<string, { columns: string[]; unique: boolean; primary: boolean; type: string }>()
    for (const row of result.recordset) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          columns: [],
          unique: row.is_unique,
          primary: row.is_primary_key,
          type: row.index_type
        })
      }
      indexMap.get(row.index_name)!.columns.push(row.column_name)
    }

    return Array.from(indexMap.entries()).map(([name, info]) => ({
      name,
      columns: info.columns,
      unique: info.unique,
      primary: info.primary,
      type: info.type
    }))
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    request.input('table', mssql.NVarChar, table)
    request.input('schema', mssql.NVarChar, this.currentSchema)

    const result = await request.query(`
      SELECT
        FK.CONSTRAINT_NAME AS name,
        CU.COLUMN_NAME AS [column],
        PK.TABLE_SCHEMA AS referencedSchema,
        PK.TABLE_NAME AS referencedTable,
        PT.COLUMN_NAME AS referencedColumn,
        C.UPDATE_RULE AS onUpdate,
        C.DELETE_RULE AS onDelete
      FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS C
      INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS FK
        ON C.CONSTRAINT_NAME = FK.CONSTRAINT_NAME AND C.CONSTRAINT_SCHEMA = FK.CONSTRAINT_SCHEMA
      INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS PK
        ON C.UNIQUE_CONSTRAINT_NAME = PK.CONSTRAINT_NAME AND C.UNIQUE_CONSTRAINT_SCHEMA = PK.CONSTRAINT_SCHEMA
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU
        ON C.CONSTRAINT_NAME = CU.CONSTRAINT_NAME AND C.CONSTRAINT_SCHEMA = CU.CONSTRAINT_SCHEMA
      INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE PT
        ON PT.ORDINAL_POSITION = CU.ORDINAL_POSITION
        AND PT.CONSTRAINT_NAME = PK.CONSTRAINT_NAME
        AND PT.CONSTRAINT_SCHEMA = PK.CONSTRAINT_SCHEMA
      WHERE FK.TABLE_NAME = @table AND FK.TABLE_SCHEMA = @schema
      ORDER BY FK.CONSTRAINT_NAME, CU.ORDINAL_POSITION
    `)

    return result.recordset.map((row) => ({
      name: row.name,
      column: row.column,
      referencedSchema: row.referencedSchema,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
      onUpdate: row.onUpdate,
      onDelete: row.onDelete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const columns = await this.getColumns(table)
    const indexes = await this.getIndexes(table)
    const fks = await this.getForeignKeys(table)
    const qualified = this.qualifiedName(table)

    const columnDefs = columns.map((col) => {
      let def = `  ${this.quoteIdentifier(col.name)} ${col.type.toUpperCase()}`
      if (col.autoIncrement) def += ' IDENTITY(1,1)'
      if (!col.nullable) def += ' NOT NULL'
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
      return def
    })

    const pkColumnNames = columns.filter((c) => c.primaryKey).map((c) => c.name)
    if (pkColumnNames.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${this.quotedColumns(pkColumnNames)})`)
    }

    for (const fk of fks) {
      const refQualified = this.qualifiedName(fk.referencedTable, fk.referencedSchema)
      columnDefs.push(
        `  CONSTRAINT ${this.quoteIdentifier(fk.name)} FOREIGN KEY (${this.quoteIdentifier(fk.column)}) ` +
        `REFERENCES ${refQualified} (${this.quoteIdentifier(fk.referencedColumn)})` +
        (fk.onUpdate && fk.onUpdate !== 'NO ACTION' ? ` ON UPDATE ${fk.onUpdate}` : '') +
        (fk.onDelete && fk.onDelete !== 'NO ACTION' ? ` ON DELETE ${fk.onDelete}` : '')
      )
    }

    let ddl = `CREATE TABLE ${qualified} (\n${columnDefs.join(',\n')}\n);`

    for (const idx of indexes) {
      if (!idx.primary) {
        const uniqueKw = idx.unique ? 'UNIQUE ' : ''
        const cols = this.quotedColumns(idx.columns)
        ddl += `\n\nCREATE ${uniqueKw}INDEX ${this.quoteIdentifier(idx.name)} ON ${qualified} (${cols});`
      }
    }

    return ddl
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const rawColumns = await this.getColumns(table)
    const columns = this.mapColumnsToInfo(rawColumns)
    const { countSql, countBindings, dataSql, dataBindings } = this.buildTableDataQueries(table, options, this.currentSchema, rawColumns)

    let totalCount: number
    if (options.knownTotalCount !== undefined) {
      totalCount = options.knownTotalCount
    } else {
      const countResult = await this.execute(countSql, countBindings)
      totalCount = parseInt(String(countResult.rows[0]?.count ?? 0), 10)
    }

    const dataResult = await this.execute(dataSql, dataBindings)

    return {
      columns,
      rows: dataResult.rows,
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || dataResult.rows.length
    }
  }

  // ─── Streaming Cursors ──────────────────────────────────────────

  async queryStream(sql: string, chunkSize: number): Promise<StreamResult> {
    this.ensureConnected()

    let totalRows = 0
    try {
      const countRequest = new mssql.Request(this.pool!)
      const countResult = await countRequest.query(`SELECT COUNT(*) AS count FROM (${sql}) AS __stream_count`)
      totalRows = countResult.recordset[0]?.count || 0
    } catch {
      // If count fails (e.g. DDL statement), leave at 0
    }

    const columns = this.mapColumnsToInfo(await this.getColumnsFromQuery(sql))
    const cursor = new SQLServerCursor(this.pool!, sql, [], chunkSize)

    return { columns, totalRows, cursor }
  }

  async selectTopStream(table: string, options: DataOptions, chunkSize: number): Promise<StreamResult> {
    this.ensureConnected()

    const { countSql, countBindings, dataSql, dataBindings } = this.buildTableDataQueries(
      table,
      { ...options, limit: undefined, offset: undefined },
      this.currentSchema
    )

    const countResult = await this.execute(countSql, countBindings)
    const totalRows = parseInt(String(countResult.rows[0]?.count ?? 0), 10)

    const columns = this.mapColumnsToInfo(await this.getColumns(table))
    const cursor = new SQLServerCursor(this.pool!, this.toNamedParams(dataSql), dataBindings, chunkSize)

    return { columns, totalRows, cursor }
  }

  private async getColumnsFromQuery(sql: string): Promise<Column[]> {
    try {
      const request = new mssql.Request(this.pool!)
      const result = await request.query(`SELECT TOP 0 * FROM (${sql}) AS __cols`)
      if (result.recordset.columns) {
        return Object.entries(result.recordset.columns).map(([name, meta]: [string, MssqlColumnMeta]) => ({
          name,
          type: meta.type?.declaration || 'UNKNOWN',
          nullable: meta.nullable ?? true,
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

  // ─── Schema Editing Operations ────────────────────────────────────

  getDataTypes(): DataTypeInfo[] {
    return SQLSERVER_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()
    const columns = await this.getColumns(table)
    return columns.filter((col) => col.primaryKey).map((col) => col.name)
  }

  private buildColumnType(col: ColumnDefinition): string {
    const typeUpper = col.type.toUpperCase()
    let type = col.type

    const lengthTypes = ['VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'VARBINARY', 'BINARY']
    if (col.length && lengthTypes.includes(typeUpper)) {
      type += `(${col.length})`
    }

    const precisionTypes = ['NUMERIC', 'DECIMAL']
    if (precisionTypes.includes(typeUpper)) {
      if (col.precision !== undefined && col.scale !== undefined) type += `(${col.precision},${col.scale})`
      else if (col.precision !== undefined) type += `(${col.precision})`
    }

    return type
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request
    const qualified = this.qualifiedName(table)

    let columnDef = `${this.quoteIdentifier(column.name)} ${this.buildColumnType(column)}`
    if (column.autoIncrement) columnDef += ' IDENTITY(1,1)'
    if (!column.nullable) columnDef += ' NOT NULL'
    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      const defaultVal = typeof column.defaultValue === 'string'
        ? `'${this.escapeLiteral(column.defaultValue)}'`
        : column.defaultValue
      columnDef += ` DEFAULT ${defaultVal}`
    }
    if (column.unique && !column.primaryKey) columnDef += ' UNIQUE'

    const sql = `ALTER TABLE ${qualified} ADD ${columnDef}`

    try {
      await this.executeRaw(sql)

      if (column.comment) {
        await this.setExtendedProperty(table, column.name, column.comment)
      }

      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newDefinition } = request
    const qualified = this.qualifiedName(table)
    const sqls: string[] = []

    try {
      // Rename column if needed (must use sp_rename)
      if (oldName !== newDefinition.name) {
        const renameReq = new mssql.Request(this.pool!)
        renameReq.input('objname', mssql.NVarChar, `${this.currentSchema}.${table}.${oldName}`)
        renameReq.input('newname', mssql.NVarChar, newDefinition.name)
        const renameSql = `EXEC sp_rename @objname, @newname, 'COLUMN'`
        await renameReq.query(renameSql)
        sqls.push(renameSql)
      }

      const columnName = this.quoteIdentifier(newDefinition.name)

      // Drop existing default constraint before altering
      await this.dropDefaultConstraint(table, newDefinition.name)

      // Alter column type and nullability
      const nullability = newDefinition.nullable ? 'NULL' : 'NOT NULL'
      const alterSql = `ALTER TABLE ${qualified} ALTER COLUMN ${columnName} ${this.buildColumnType(newDefinition)} ${nullability}`
      await this.executeRaw(alterSql)
      sqls.push(alterSql)

      // Set new default if provided
      if (newDefinition.defaultValue !== undefined && newDefinition.defaultValue !== null) {
        const defaultVal = typeof newDefinition.defaultValue === 'string'
          ? `'${this.escapeLiteral(newDefinition.defaultValue)}'`
          : newDefinition.defaultValue
        const defaultSql = `ALTER TABLE ${qualified} ADD DEFAULT ${defaultVal} FOR ${columnName}`
        await this.executeRaw(defaultSql)
        sqls.push(defaultSql)
      }

      // Update column comment
      if (newDefinition.comment !== undefined) {
        if (newDefinition.comment === null || newDefinition.comment === '') {
          await this.dropExtendedProperty(table, newDefinition.name)
        } else {
          await this.setExtendedProperty(table, newDefinition.name, newDefinition.comment)
        }
      }

      return { success: true, sql: sqls.join(';\n') }
    } catch (error) {
      return { success: false, sql: sqls.join(';\n'), error: this.formatError(error) }
    }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, columnName } = request
    const qualified = this.qualifiedName(table)

    // Must drop default constraint first
    await this.dropDefaultConstraint(table, columnName)

    const sql = `ALTER TABLE ${qualified} DROP COLUMN ${this.quoteIdentifier(columnName)}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newName } = request
    const req = new mssql.Request(this.pool!)
    req.input('objname', mssql.NVarChar, `${this.currentSchema}.${table}.${oldName}`)
    req.input('newname', mssql.NVarChar, newName)
    const sql = `EXEC sp_rename @objname, @newname, 'COLUMN'`

    try {
      await req.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index, schema } = request
    const qualified = this.qualifiedName(table, schema)
    const uniqueKw = index.unique ? 'UNIQUE ' : ''
    const columns = this.quotedColumns(index.columns)
    const sql = `CREATE ${uniqueKw}INDEX ${this.quoteIdentifier(index.name)} ON ${qualified} (${columns})`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, indexName } = request
    const qualified = this.qualifiedName(table)

    // Check if it's a primary key or unique constraint
    const checkRequest = new mssql.Request(this.pool!)
    checkRequest.input('indexName', mssql.NVarChar, indexName)
    checkRequest.input('table', mssql.NVarChar, table)
    checkRequest.input('schema', mssql.NVarChar, this.currentSchema)

    const constraintCheck = await checkRequest.query(`
      SELECT type_desc
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE i.name = @indexName AND t.name = @table AND s.name = @schema
    `)

    const isConstraint = constraintCheck.recordset[0]?.type_desc === 'CLUSTERED' &&
      await this.isIndexPrimaryKey(indexName, table)

    const sql = isConstraint
      ? `ALTER TABLE ${qualified} DROP CONSTRAINT ${this.quoteIdentifier(indexName)}`
      : `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${qualified}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  private async isIndexPrimaryKey(indexName: string, table: string): Promise<boolean> {
    const request = new mssql.Request(this.pool!)
    request.input('indexName', mssql.NVarChar, indexName)
    request.input('table', mssql.NVarChar, table)
    request.input('schema', mssql.NVarChar, this.currentSchema)
    const result = await request.query(`
      SELECT i.is_primary_key
      FROM sys.indexes i
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE i.name = @indexName AND t.name = @table AND s.name = @schema
    `)
    return result.recordset[0]?.is_primary_key === true
  }

  async addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, foreignKey } = request

    const columns = this.quotedColumns(foreignKey.columns)
    const refColumns = this.quotedColumns(foreignKey.referencedColumns)
    const onUpdate = foreignKey.onUpdate ? ` ON UPDATE ${foreignKey.onUpdate}` : ''
    const onDelete = foreignKey.onDelete ? ` ON DELETE ${foreignKey.onDelete}` : ''

    const qualified = this.qualifiedName(table)
    const refSchema = foreignKey.referencedSchema || this.currentSchema
    const refQualified = this.qualifiedName(foreignKey.referencedTable, refSchema)
    const sql = `ALTER TABLE ${qualified} ADD CONSTRAINT ${this.quoteIdentifier(foreignKey.name)} ` +
      `FOREIGN KEY (${columns}) REFERENCES ${refQualified} (${refColumns})${onUpdate}${onDelete}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, constraintName } = request
    const qualified = this.qualifiedName(table)
    const sql = `ALTER TABLE ${qualified} DROP CONSTRAINT ${this.quoteIdentifier(constraintName)}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, schema } = request
    const qualified = this.qualifiedName(table.name, schema)

    const columnDefs: string[] = []

    for (const col of table.columns) {
      let def = `${this.quoteIdentifier(col.name)} ${this.buildColumnType(col)}`
      if (col.primaryKey && col.autoIncrement) {
        def = `${this.quoteIdentifier(col.name)} ${col.type.toUpperCase() === 'BIGINT' ? 'BIGINT' : 'INT'} IDENTITY(1,1)`
      }
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
      if (col.defaultValue !== undefined && col.defaultValue !== null && !col.autoIncrement) {
        const defaultVal = typeof col.defaultValue === 'string'
          ? `'${this.escapeLiteral(col.defaultValue)}'`
          : col.defaultValue
        def += ` DEFAULT ${defaultVal}`
      }
      if (col.unique && !col.primaryKey) def += ' UNIQUE'
      columnDefs.push(def)
    }

    // Primary key constraint
    const pkColumnNames = table.columns.filter((c) => c.primaryKey).map((c) => c.name)
    if (pkColumnNames.length > 0) {
      columnDefs.push(`PRIMARY KEY (${this.quotedColumns(pkColumnNames)})`)
    } else if (table.primaryKey && table.primaryKey.length > 0) {
      columnDefs.push(`PRIMARY KEY (${this.quotedColumns(table.primaryKey)})`)
    }

    // Foreign keys
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const columns = this.quotedColumns(fk.columns)
        const refColumns = this.quotedColumns(fk.referencedColumns)
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        const refSchema = fk.referencedSchema || schema || this.currentSchema
        const refQualified = this.qualifiedName(fk.referencedTable, refSchema)
        columnDefs.push(
          `CONSTRAINT ${this.quoteIdentifier(fk.name)} FOREIGN KEY (${columns}) ` +
          `REFERENCES ${refQualified} (${refColumns})${onUpdate}${onDelete}`
        )
      }
    }

    const sql = `CREATE TABLE ${qualified} (\n  ${columnDefs.join(',\n  ')}\n)`

    try {
      await this.executeRaw(sql)

      if (table.indexes) {
        for (const idx of table.indexes) {
          await this.createIndex({ table: table.name, index: idx, schema })
        }
      }

      if (table.comment) {
        await this.setExtendedProperty(table.name, null, table.comment)
      }

      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const qualified = this.qualifiedName(request.table)
    const sql = `DROP TABLE ${qualified}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const req = new mssql.Request(this.pool!)
    req.input('objname', mssql.NVarChar, `${this.currentSchema}.${request.oldName}`)
    req.input('newname', mssql.NVarChar, request.newName)
    const sql = `EXEC sp_rename @objname, @newname`

    try {
      await req.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  override async updateTableComment(table: string, comment: string | null): Promise<SchemaOperationResult> {
    this.ensureConnected()

    try {
      if (comment === null || comment === '') {
        await this.dropExtendedProperty(table, null)
      } else {
        await this.setExtendedProperty(table, null, comment)
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: this.formatError(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sql, bindings } = this.buildInsertSQL(request.table, request.values, this.currentSchema)

    try {
      const result = await this.execute(sql, bindings)
      if (result.error) return { success: false, sql, error: result.error }
      return { success: true, sql, affectedRows: result.affectedRows }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sql, bindings } = this.buildDeleteSQL(request.table, request.primaryKeyValues, this.currentSchema)

    try {
      const result = await this.execute(sql, bindings)
      if (result.error) return { success: false, sql, error: result.error }
      return { success: true, sql, affectedRows: result.affectedRows }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  override async updateRow(request: UpdateRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues, values } = request

    let builder = this.knex!(table).withSchema(this.currentSchema)
    builder = builder.where(primaryKeyValues).update(values)
    const { sql, bindings } = this.compileQuery(builder)

    try {
      const result = await this.execute(sql, bindings)
      if (result.error) return { success: false, sql, error: result.error }
      return { success: true, sql, affectedRows: result.affectedRows }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // ─── View Operations ──────────────────────────────────────────────

  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const qualified = this.qualifiedName(view.name)
    // SQL Server requires CREATE VIEW to be the first statement in a batch,
    // so drop and create must be executed as separate statements
    const createSql = `CREATE VIEW ${qualified} AS ${view.selectStatement}`

    try {
      if (view.replaceIfExists) {
        const dropSql = `IF OBJECT_ID(N'${this.currentSchema}.${view.name}', 'V') IS NOT NULL DROP VIEW ${qualified}`
        await this.executeRaw(dropSql)
      }
      await this.executeRaw(createSql)
      return { success: true, sql: createSql }
    } catch (error) {
      return { success: false, sql: createSql, error: this.formatError(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const qualified = this.qualifiedName(request.viewName)
    const sql = `DROP VIEW IF EXISTS ${qualified}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const req = new mssql.Request(this.pool!)
    req.input('objname', mssql.NVarChar, `${this.currentSchema}.${request.oldName}`)
    req.input('newname', mssql.NVarChar, request.newName)
    const sql = `EXEC sp_rename @objname, @newname`

    try {
      await req.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    request.input('viewName', mssql.NVarChar, `${this.currentSchema}.${viewName}`)
    const result = await request.query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID(@viewName)) AS definition
    `)

    return result.recordset[0]?.definition || `-- View '${viewName}' definition not found`
  }

  // ─── Routines ─────────────────────────────────────────────────────

  async getRoutines(type?: RoutineType): Promise<Routine[]> {
    this.ensureConnected()

    let typeFilter = ''
    if (type === RoutineType.Procedure) typeFilter = "AND r.ROUTINE_TYPE = 'PROCEDURE'"
    else if (type === RoutineType.Function) typeFilter = "AND r.ROUTINE_TYPE = 'FUNCTION'"

    const request = new mssql.Request(this.pool!)
    const result = await request.query(`
      SELECT
        r.ROUTINE_NAME AS name,
        r.ROUTINE_TYPE AS type,
        r.ROUTINE_SCHEMA AS [schema],
        r.DATA_TYPE AS returnType
      FROM INFORMATION_SCHEMA.ROUTINES r
      WHERE r.ROUTINE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
      ${typeFilter}
      ORDER BY r.ROUTINE_SCHEMA, r.ROUTINE_NAME
    `)

    // Fetch parameters for each routine
    const routines: Routine[] = []
    for (const row of result.recordset) {
      const paramRequest = new mssql.Request(this.pool!)
      paramRequest.input('schema', mssql.NVarChar, row.schema)
      paramRequest.input('name', mssql.NVarChar, row.name)
      const paramResult = await paramRequest.query(`
        SELECT
          p.PARAMETER_NAME AS name,
          p.DATA_TYPE AS type,
          p.PARAMETER_MODE AS mode
        FROM INFORMATION_SCHEMA.PARAMETERS p
        WHERE p.SPECIFIC_SCHEMA = @schema
          AND p.SPECIFIC_NAME = @name
          AND p.PARAMETER_NAME != ''
        ORDER BY p.ORDINAL_POSITION
      `)

      const parameters: RoutineParameter[] = paramResult.recordset.map((p) => ({
        name: p.name.replace(/^@/, ''),
        type: p.type,
        mode: p.mode === 'IN' ? RoutineParameterMode.In
          : p.mode === 'OUT' ? RoutineParameterMode.Out
          : RoutineParameterMode.InOut
      }))

      routines.push({
        name: row.name,
        type: row.type === 'PROCEDURE' ? RoutineType.Procedure : RoutineType.Function,
        schema: row.schema,
        returnType: row.returnType || undefined,
        parameters
      })
    }

    return routines
  }

  async getRoutineDefinition(name: string, _type: RoutineType): Promise<string> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    request.input('name', mssql.NVarChar, `${this.currentSchema}.${name}`)
    const result = await request.query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID(@name)) AS definition
    `)

    return result.recordset[0]?.definition || `-- Routine '${name}' definition not found`
  }

  // ─── Users ────────────────────────────────────────────────────────

  async getUsers(): Promise<DatabaseUser[]> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)
    const result = await request.query(`
      SELECT
        sp.name,
        sp.type_desc,
        sp.is_disabled,
        sp.default_database_name,
        sp.create_date,
        sp.modify_date,
        CAST(IS_SRVROLEMEMBER('sysadmin', sp.name) AS BIT) AS is_sysadmin
      FROM sys.server_principals sp
      WHERE sp.type IN ('S', 'U', 'G')
        AND sp.name NOT LIKE '##%'
        AND sp.name NOT IN ('sa')
      ORDER BY sp.name
    `)

    return result.recordset.map((row) => ({
      name: row.name,
      superuser: row.is_sysadmin === true,
      login: !row.is_disabled,
      roles: []
    }))
  }

  async createUser(request: CreateUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { user } = request
    const quotedName = this.quoteIdentifier(user.name)
    const displaySql = `CREATE LOGIN ${quotedName} WITH PASSWORD = '****'`

    try {
      const loginReq = new mssql.Request(this.pool!)
      loginReq.input('password', mssql.NVarChar, user.password || '')
      await loginReq.query(
        `DECLARE @sql NVARCHAR(MAX) = N'CREATE LOGIN ${quotedName} WITH PASSWORD = ' + QUOTENAME(@password, '''');\n` +
        `EXEC sp_executesql @sql`
      )

      await this.executeRaw(`CREATE USER ${quotedName} FOR LOGIN ${quotedName}`)
      return { success: true, sql: displaySql }
    } catch (error) {
      return { success: false, sql: displaySql, error: this.formatError(error) }
    }
  }

  async dropUser(request: DropUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const quotedName = this.quoteIdentifier(request.name)
    const sql = `DROP LOGIN ${quotedName}`

    try {
      try {
        await this.executeRaw(`DROP USER ${quotedName}`)
      } catch {}
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // ─── Triggers ─────────────────────────────────────────────────────

  async getTriggers(table?: string): Promise<Trigger[]> {
    this.ensureConnected()

    const request = new mssql.Request(this.pool!)

    let whereClause = "WHERE s.name NOT IN ('sys', 'INFORMATION_SCHEMA')"
    if (table) {
      request.input('table', mssql.NVarChar, table)
      whereClause += ' AND t.name = @table'
    }

    const result = await request.query(`
      SELECT
        tr.name AS trigger_name,
        t.name AS table_name,
        s.name AS schema_name,
        tr.is_disabled,
        CASE
          WHEN OBJECTPROPERTY(tr.object_id, 'ExecIsAfterTrigger') = 1 THEN 'AFTER'
          WHEN OBJECTPROPERTY(tr.object_id, 'ExecIsInsteadOfTrigger') = 1 THEN 'INSTEAD OF'
          ELSE 'AFTER'
        END AS timing,
        STUFF((
          SELECT ', ' + te.type_desc
          FROM sys.trigger_events te
          WHERE te.object_id = tr.object_id
          FOR XML PATH('')
        ), 1, 2, '') AS event
      FROM sys.triggers tr
      INNER JOIN sys.tables t ON tr.parent_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      ${whereClause}
      ORDER BY s.name, t.name, tr.name
    `)

    return result.recordset.map((row) => ({
      name: row.trigger_name,
      table: row.table_name,
      schema: row.schema_name,
      timing: row.timing,
      event: row.event,
      enabled: !row.is_disabled
    }))
  }

  async getTriggerDefinition(name: string, _table?: string): Promise<string> {
    this.ensureConnected()

    const qualifiedName = `${this.currentSchema}.${name}`
    const request = new mssql.Request(this.pool!)
    request.input('name', mssql.NVarChar, qualifiedName)
    const result = await request.query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID(@name)) AS definition
    `)

    return result.recordset[0]?.definition || `-- Trigger '${name}' definition not found`
  }

  async createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { trigger } = request
    const schema = trigger.schema || this.currentSchema
    const qualified = this.qualifiedName(trigger.table, schema)
    const triggerName = this.qualifiedName(trigger.name, schema)

    const sql = `CREATE TRIGGER ${triggerName}\nON ${qualified}\n${trigger.timing} ${trigger.event}\nAS\nBEGIN\n${trigger.body}\nEND`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  async dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { triggerName, schema } = request
    const targetSchema = schema || this.currentSchema
    const qualified = this.qualifiedName(triggerName, targetSchema)
    const sql = `DROP TRIGGER IF EXISTS ${qualified}`

    try {
      await this.executeRaw(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: this.formatError(error) }
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /** Execute raw SQL without parameter binding (for DDL) */
  private async executeRaw(sql: string): Promise<mssql.IResult<Record<string, unknown>>> {
    const request = this.transaction
      ? new mssql.Request(this.transaction)
      : new mssql.Request(this.pool!)
    return request.query(sql)
  }

  /** Drop a default constraint on a column (required before ALTER COLUMN) */
  private async dropDefaultConstraint(table: string, columnName: string): Promise<void> {
    const request = new mssql.Request(this.pool!)
    request.input('table', mssql.NVarChar, table)
    request.input('schema', mssql.NVarChar, this.currentSchema)
    request.input('column', mssql.NVarChar, columnName)

    const result = await request.query(`
      SELECT dc.name AS constraint_name
      FROM sys.default_constraints dc
      INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      INNER JOIN sys.tables t ON c.object_id = t.object_id
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE t.name = @table AND s.name = @schema AND c.name = @column
    `)

    for (const row of result.recordset) {
      const qualified = this.qualifiedName(table)
      await this.executeRaw(`ALTER TABLE ${qualified} DROP CONSTRAINT ${this.quoteIdentifier(row.constraint_name)}`)
    }
  }

  /** Set or update an extended property (MS_Description) for table or column comment */
  private async setExtendedProperty(table: string, column: string | null, value: string): Promise<void> {
    const req = new mssql.Request(this.pool!)
    req.input('value', mssql.NVarChar, value)
    req.input('schema', mssql.NVarChar, this.currentSchema)
    req.input('table', mssql.NVarChar, table)

    if (column) {
      req.input('column', mssql.NVarChar, column)
      try {
        await req.query(`
          IF EXISTS (
            SELECT 1 FROM sys.extended_properties ep
            INNER JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
            INNER JOIN sys.tables t ON c.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE ep.name = 'MS_Description' AND t.name = @table AND s.name = @schema AND c.name = @column
          )
          EXEC sp_updateextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table,
            @level2type = N'COLUMN', @level2name = @column
          ELSE
          EXEC sp_addextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table,
            @level2type = N'COLUMN', @level2name = @column
        `)
      } catch {
        const addReq = new mssql.Request(this.pool!)
        addReq.input('value', mssql.NVarChar, value)
        addReq.input('schema', mssql.NVarChar, this.currentSchema)
        addReq.input('table', mssql.NVarChar, table)
        addReq.input('column', mssql.NVarChar, column)
        await addReq.query(`
          EXEC sp_addextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table,
            @level2type = N'COLUMN', @level2name = @column
        `)
      }
    } else {
      try {
        await req.query(`
          IF EXISTS (
            SELECT 1 FROM sys.extended_properties ep
            INNER JOIN sys.tables t ON ep.major_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE ep.name = 'MS_Description' AND ep.minor_id = 0 AND t.name = @table AND s.name = @schema
          )
          EXEC sp_updateextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table
          ELSE
          EXEC sp_addextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table
        `)
      } catch {
        const addReq = new mssql.Request(this.pool!)
        addReq.input('value', mssql.NVarChar, value)
        addReq.input('schema', mssql.NVarChar, this.currentSchema)
        addReq.input('table', mssql.NVarChar, table)
        await addReq.query(`
          EXEC sp_addextendedproperty
            @name = N'MS_Description', @value = @value,
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table
        `)
      }
    }
  }

  /** Drop an extended property (MS_Description) */
  private async dropExtendedProperty(table: string, column: string | null): Promise<void> {
    try {
      const req = new mssql.Request(this.pool!)
      req.input('schema', mssql.NVarChar, this.currentSchema)
      req.input('table', mssql.NVarChar, table)

      if (column) {
        req.input('column', mssql.NVarChar, column)
        await req.query(`
          EXEC sp_dropextendedproperty
            @name = N'MS_Description',
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table,
            @level2type = N'COLUMN', @level2name = @column
        `)
      } else {
        await req.query(`
          EXEC sp_dropextendedproperty
            @name = N'MS_Description',
            @level0type = N'SCHEMA', @level0name = @schema,
            @level1type = N'TABLE', @level1name = @table
        `)
      }
    } catch {
      // Property may not exist — ignore
    }
  }
}
