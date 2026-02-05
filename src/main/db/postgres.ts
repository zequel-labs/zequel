import { Pool, PoolClient } from 'pg'
import { BaseDriver, TestConnectionResult } from './base'
import { logger } from '../utils/logger'
import {
  DatabaseType,
  SSLMode,
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
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest,
  SchemaOperationResult,
  DataTypeInfo,
  ColumnDefinition,
  CreateSequenceRequest,
  DropSequenceRequest,
  AlterSequenceRequest,
  RefreshMaterializedViewRequest,
  CreateExtensionRequest,
  DropExtensionRequest,
  CreateTriggerRequest,
  DropTriggerRequest
} from '../types/schema-operations'
import type {
  Sequence,
  MaterializedView,
  Extension,
  DatabaseSchema,
  EnumType
} from '../types'
import { POSTGRESQL_DATA_TYPES } from '../types/schema-operations'

export class PostgreSQLDriver extends BaseDriver {
  readonly type = DatabaseType.PostgreSQL
  private pool: Pool | null = null
  private client: PoolClient | null = null
  private currentDatabase: string = ''
  private currentSchema: string = 'public'
  private currentQueryPid: number | null = null

  private buildSSLOptions(config: ConnectionConfig): any {
    const sslEnabled = config.ssl || config.sslConfig?.enabled
    const mode = config.sslConfig?.mode ?? SSLMode.Disable

    if (!sslEnabled || mode === SSLMode.Disable) return undefined

    // For 'prefer' mode: try SSL but don't reject on invalid certs
    const rejectUnauthorized = mode === SSLMode.Prefer
      ? false
      : (mode === SSLMode.VerifyCA || mode === SSLMode.VerifyFull)
        ? true
        : (config.sslConfig?.rejectUnauthorized ?? false)

    return {
      rejectUnauthorized,
      ...(config.sslConfig?.ca ? { ca: config.sslConfig.ca } : {}),
      ...(config.sslConfig?.cert ? { cert: config.sslConfig.cert } : {}),
      ...(config.sslConfig?.key ? { key: config.sslConfig.key } : {}),
      ...(config.sslConfig?.serverName ? { servername: config.sslConfig.serverName } : {}),
      ...(config.sslConfig?.minVersion ? { minVersion: config.sslConfig.minVersion } : {})
    }
  }

  private buildPoolConfig(config: ConnectionConfig, ssl: any) {
    const targetDatabase = config.database || 'postgres'
    return {
      host: config.host || 'localhost',
      port: config.port || 5432,
      user: config.username,
      password: config.password,
      database: targetDatabase,
      ssl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    }
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const mode = config.sslConfig?.mode ?? SSLMode.Disable
    const sslOptions = this.buildSSLOptions(config)

    logger.info('PostgreSQL connect', {
      host: config.host,
      port: config.port,
      database: config.database || 'postgres',
      user: config.username,
      hasPassword: !!config.password,
      sslMode: mode,
      sslEnabled: !!sslOptions,
      sshEnabled: !!config.ssh?.enabled
    })

    try {
      this.pool = new Pool(this.buildPoolConfig(config, sslOptions))
      logger.info('PostgreSQL pool created, acquiring client...')
      this.client = await this.pool.connect()
      logger.info('PostgreSQL client acquired, connected!')
      this.currentDatabase = config.database || ''
      this.config = config
      this._isConnected = true
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error('PostgreSQL connect failed', { error: errMsg, sslMode: mode })

      // For 'prefer' mode: if SSL fails, retry without SSL
      if (mode === SSLMode.Prefer && sslOptions) {
        logger.info('PostgreSQL retrying without SSL (prefer mode fallback)')
        try {
          if (this.client) { this.client.release(); this.client = null }
          if (this.pool) { await this.pool.end(); this.pool = null }
        } catch {}

        try {
          this.pool = new Pool(this.buildPoolConfig(config, undefined))
          this.client = await this.pool.connect()
          logger.info('PostgreSQL connected without SSL (fallback)')
          this.currentDatabase = config.database || ''
          this.config = config
          this._isConnected = true
          return
        } catch (fallbackError) {
          const fbMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          logger.error('PostgreSQL fallback also failed', { error: fbMsg })
          this._isConnected = false
          throw fallbackError
        }
      }
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release()
      this.client = null
    }
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
    this._isConnected = false
    this.config = null
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false
      await this.client.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  async cancelQuery(): Promise<boolean> {
    const pid = this.currentQueryPid
    if (!pid || !this.pool) {
      return false
    }

    let cancelClient: PoolClient | null = null
    try {
      // Use a separate connection from the pool to cancel the running query
      cancelClient = await this.pool.connect()
      const result = await cancelClient.query('SELECT pg_cancel_backend($1) AS cancelled', [pid])
      return result.rows[0]?.cancelled === true
    } catch {
      return false
    } finally {
      if (cancelClient) {
        cancelClient.release()
      }
    }
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      const versionResult = await this.execute('SELECT version()')
      const serverVersion = (versionResult.rows[0]?.version as string) || 'Unknown'

      const serverInfo: Record<string, string> = {}
      try {
        const encodingResult = await this.execute('SHOW server_encoding')
        serverInfo['Encoding'] = (encodingResult.rows[0]?.server_encoding as string) || ''
        const tzResult = await this.execute('SHOW timezone')
        serverInfo['Timezone'] = (tzResult.rows[0]?.TimeZone as string) || ''
        const maxConnResult = await this.execute('SHOW max_connections')
        serverInfo['Max Connections'] = (maxConnResult.rows[0]?.max_connections as string) || ''
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      // Get the backend PID before running the query so it can be cancelled
      const pidResult = await this.client!.query('SELECT pg_backend_pid() AS pid')
      this.currentQueryPid = pidResult.rows[0]?.pid ?? null

      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let pgSql = sql
      if (params && params.length > 0) {
        let paramIndex = 1
        pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
      }

      const result = await this.client!.query(pgSql, params)
      this.currentQueryPid = null

      const columns: ColumnInfo[] = result.fields?.map((field) => ({
        name: field.name,
        type: this.mapPgType(field.dataTypeID),
        nullable: true,
        primaryKey: false
      })) || []

      if (result.rows) {
        return {
          columns,
          rows: result.rows as Record<string, unknown>[],
          rowCount: result.rowCount || 0,
          executionTime: Date.now() - startTime
        }
      } else {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.rowCount || 0,
          executionTime: Date.now() - startTime
        }
      }
    } catch (error) {
      this.currentQueryPid = null
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private mapPgType(oid: number): string {
    const types: Record<number, string> = {
      16: 'BOOLEAN',
      17: 'BYTEA',
      18: 'CHAR',
      19: 'NAME',
      20: 'BIGINT',
      21: 'SMALLINT',
      23: 'INTEGER',
      25: 'TEXT',
      26: 'OID',
      114: 'JSON',
      142: 'XML',
      600: 'POINT',
      700: 'REAL',
      701: 'DOUBLE PRECISION',
      790: 'MONEY',
      829: 'MACADDR',
      869: 'INET',
      1042: 'CHAR',
      1043: 'VARCHAR',
      1082: 'DATE',
      1083: 'TIME',
      1114: 'TIMESTAMP',
      1184: 'TIMESTAMPTZ',
      1186: 'INTERVAL',
      1700: 'NUMERIC',
      2950: 'UUID',
      3802: 'JSONB'
    }
    return types[oid] || 'UNKNOWN'
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()

    const result = await this.client!.query(`
      SELECT datname as name
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `)

    return result.rows.map((row) => ({ name: row.name }))
  }

  async getTables(database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const result = await this.client!.query(`
      SELECT
        t.table_name as name,
        t.table_type as type,
        pg_stat.n_live_tup as row_count,
        pg_size.size,
        obj_description(pc.oid) as comment
      FROM information_schema.tables t
      LEFT JOIN pg_class pc ON pc.relname = t.table_name
      LEFT JOIN pg_stat_user_tables pg_stat ON pg_stat.relname = t.table_name
      LEFT JOIN (
        SELECT tablename, pg_total_relation_size(quote_ident(tablename)::regclass) as size
        FROM pg_tables
        WHERE schemaname = $1
      ) pg_size ON pg_size.tablename = t.table_name
      WHERE t.table_schema = $1
      ORDER BY t.table_name
    `, [targetSchema])

    return result.rows.map((row) => ({
      name: row.name,
      schema: targetSchema,
      type: row.type === 'VIEW' ? TableObjectType.View : TableObjectType.Table,
      rowCount: row.row_count ? parseInt(row.row_count, 10) : undefined,
      size: row.size ? parseInt(row.size, 10) : undefined,
      comment: row.comment
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const result = await this.client!.query(`
      SELECT
        c.column_name as name,
        c.data_type as type,
        c.is_nullable as nullable,
        c.column_default as "defaultValue",
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as "primaryKey",
        CASE WHEN c.column_default LIKE 'nextval%' THEN true ELSE false END as "autoIncrement",
        CASE WHEN u.column_name IS NOT NULL THEN true ELSE false END as "unique",
        c.character_maximum_length as length,
        c.numeric_precision as precision,
        c.numeric_scale as scale,
        pd.description as comment
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON ku.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
      ) pk ON pk.column_name = c.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON ku.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = $1
      ) u ON u.column_name = c.column_name
      LEFT JOIN pg_catalog.pg_description pd ON pd.objsubid = c.ordinal_position
        AND pd.objoid = (SELECT oid FROM pg_class WHERE relname = $1)
      WHERE c.table_name = $1 AND c.table_schema = $2
      ORDER BY c.ordinal_position
    `, [table, this.currentSchema])

    return result.rows.map((row) => ({
      name: row.name,
      type: row.type.toUpperCase(),
      nullable: row.nullable === 'YES',
      defaultValue: row.defaultValue,
      primaryKey: row.primaryKey,
      autoIncrement: row.autoIncrement,
      unique: row.unique,
      comment: row.comment,
      length: row.length,
      precision: row.precision,
      scale: row.scale
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const result = await this.client!.query(`
      SELECT
        i.relname as name,
        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
        ix.indisunique as unique,
        ix.indisprimary as primary,
        am.amname as type
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      JOIN pg_am am ON am.oid = i.relam
      WHERE t.relname = $1
      GROUP BY i.relname, ix.indisunique, ix.indisprimary, am.amname
    `, [table])

    return result.rows.map((row) => ({
      name: row.name,
      columns: row.columns,
      unique: row.unique,
      primary: row.primary,
      type: row.type
    }))
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const result = await this.client!.query(`
      SELECT
        tc.constraint_name as name,
        kcu.column_name as column,
        ccu.table_name as "referencedTable",
        ccu.column_name as "referencedColumn",
        rc.update_rule as "onUpdate",
        rc.delete_rule as "onDelete"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [table])

    return result.rows.map((row) => ({
      name: row.name,
      column: row.column,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
      onUpdate: row.onUpdate,
      onDelete: row.onDelete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    // PostgreSQL doesn't have a direct SHOW CREATE TABLE equivalent
    // We need to construct it from metadata
    const columns = await this.getColumns(table)
    const indexes = await this.getIndexes(table)
    const fks = await this.getForeignKeys(table)

    const columnDefs = columns.map((col) => {
      let def = `  "${col.name}" ${col.type}`
      if (col.length) def += `(${col.length})`
      if (col.precision && col.scale) def += `(${col.precision}, ${col.scale})`
      if (!col.nullable) def += ' NOT NULL'
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`
      return def
    })

    const pkColumns = columns.filter((c) => c.primaryKey).map((c) => `"${c.name}"`)
    if (pkColumns.length > 0) {
      columnDefs.push(`  PRIMARY KEY (${pkColumns.join(', ')})`)
    }

    for (const fk of fks) {
      columnDefs.push(
        `  CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") ` +
        `REFERENCES "${fk.referencedTable}" ("${fk.referencedColumn}")` +
        (fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '') +
        (fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '')
      )
    }

    let ddl = `CREATE TABLE "${table}" (\n${columnDefs.join(',\n')}\n);`

    // Add index definitions
    for (const idx of indexes) {
      if (!idx.primary) {
        ddl += `\n\nCREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX "${idx.name}" ON "${table}" (${idx.columns.map((c) => `"${c}"`).join(', ')});`
      }
    }

    return ddl
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { clause: whereClause, values } = this.buildWhereClausePg(options)
    const orderClause = this.buildOrderClause(options)
    const limitClause = this.buildLimitClause(options)

    // Get total count
    const countResult = await this.client!.query(
      `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`,
      values
    )
    const totalCount = parseInt(countResult.rows[0].count, 10)

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
    const dataResult = await this.client!.query(
      `SELECT * FROM "${table}" ${whereClause} ${orderClause} ${limitClause}`,
      values
    )

    return {
      columns,
      rows: dataResult.rows as Record<string, unknown>[],
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || dataResult.rows.length
    }
  }

  private buildWhereClausePg(options: DataOptions): { clause: string; values: unknown[] } {
    if (!options.filters || options.filters.length === 0) {
      return { clause: '', values: [] }
    }

    const conditions: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

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
            const placeholders = filter.value.map(() => `$${paramIndex++}`).join(', ')
            conditions.push(`"${filter.column}" ${filter.operator} (${placeholders})`)
            values.push(...filter.value)
          }
          break
        case 'LIKE':
        case 'NOT LIKE':
          conditions.push(`"${filter.column}" ${filter.operator} $${paramIndex++}`)
          values.push(`%${filter.value}%`)
          break
        default:
          conditions.push(`"${filter.column}" ${filter.operator} $${paramIndex++}`)
          values.push(filter.value)
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    }
  }

  // Schema editing operations

  getDataTypes(): DataTypeInfo[] {
    return POSTGRESQL_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()
    const columns = await this.getColumns(table)
    return columns.filter((col) => col.primaryKey).map((col) => col.name)
  }

  async getRoutines(type?: RoutineType): Promise<Routine[]> {
    this.ensureConnected()

    let sql = `
      SELECT
        p.proname as name,
        CASE
          WHEN p.prokind = 'p' THEN 'PROCEDURE'
          ELSE 'FUNCTION'
        END as type,
        n.nspname as schema,
        pg_get_function_result(p.oid) as return_type,
        l.lanname as language
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    `

    if (type) {
      sql += type === RoutineType.Procedure
        ? ` AND p.prokind = 'p'`
        : ` AND p.prokind != 'p'`
    }

    sql += ` ORDER BY n.nspname, p.proname`

    const result = await this.client!.query(sql)

    return result.rows.map(row => ({
      name: row.name,
      type: row.type as RoutineType,
      schema: row.schema,
      returnType: row.return_type,
      language: row.language
    }))
  }

  async getRoutineDefinition(name: string, type: RoutineType): Promise<string> {
    this.ensureConnected()

    const sql = `
      SELECT pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = $1
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      LIMIT 1
    `

    const result = await this.client!.query(sql, [name])

    if (result.rows.length > 0) {
      return result.rows[0].definition
    }

    return `-- ${type} '${name}' not found`
  }

  private buildColumnType(col: ColumnDefinition): string {
    let type = col.type
    if (col.length) type += `(${col.length})`
    else if (col.precision !== undefined && col.scale !== undefined) type += `(${col.precision},${col.scale})`
    else if (col.precision !== undefined) type += `(${col.precision})`
    return type
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request

    let columnDef = `"${column.name}" ${this.buildColumnType(column)}`
    if (!column.nullable) columnDef += ' NOT NULL'
    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      const defaultVal = typeof column.defaultValue === 'string'
        ? `'${column.defaultValue.replace(/'/g, "''")}'`
        : column.defaultValue
      columnDef += ` DEFAULT ${defaultVal}`
    }
    if (column.unique && !column.primaryKey) columnDef += ' UNIQUE'

    const sql = `ALTER TABLE "${table}" ADD COLUMN ${columnDef}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newDefinition } = request

    const sqls: string[] = []

    try {
      // Rename column if needed
      if (oldName !== newDefinition.name) {
        const renameSql = `ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${newDefinition.name}"`
        await this.client!.query(renameSql)
        sqls.push(renameSql)
      }

      const columnName = newDefinition.name

      // Change type
      const typeSql = `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" TYPE ${this.buildColumnType(newDefinition)}`
      await this.client!.query(typeSql)
      sqls.push(typeSql)

      // Change nullability
      const nullSql = newDefinition.nullable
        ? `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" DROP NOT NULL`
        : `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" SET NOT NULL`
      await this.client!.query(nullSql)
      sqls.push(nullSql)

      // Change default
      if (newDefinition.defaultValue !== undefined) {
        if (newDefinition.defaultValue === null) {
          const dropDefaultSql = `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" DROP DEFAULT`
          await this.client!.query(dropDefaultSql)
          sqls.push(dropDefaultSql)
        } else {
          const defaultVal = typeof newDefinition.defaultValue === 'string'
            ? `'${newDefinition.defaultValue.replace(/'/g, "''")}'`
            : newDefinition.defaultValue
          const setDefaultSql = `ALTER TABLE "${table}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultVal}`
          await this.client!.query(setDefaultSql)
          sqls.push(setDefaultSql)
        }
      }

      return { success: true, sql: sqls.join(';\n') }
    } catch (error) {
      return { success: false, sql: sqls.join(';\n'), error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, columnName } = request

    const sql = `ALTER TABLE "${table}" DROP COLUMN "${columnName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newName } = request

    const sql = `ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${newName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index } = request

    const uniqueKeyword = index.unique ? 'UNIQUE ' : ''
    const columns = index.columns.map((c) => `"${c}"`).join(', ')
    const indexType = index.type ? ` USING ${index.type}` : ''
    const sql = `CREATE ${uniqueKeyword}INDEX "${index.name}" ON "${table}"${indexType} (${columns})`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { indexName } = request

    const sql = `DROP INDEX "${indexName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, foreignKey } = request

    const columns = foreignKey.columns.map((c) => `"${c}"`).join(', ')
    const refColumns = foreignKey.referencedColumns.map((c) => `"${c}"`).join(', ')
    const onUpdate = foreignKey.onUpdate ? ` ON UPDATE ${foreignKey.onUpdate}` : ''
    const onDelete = foreignKey.onDelete ? ` ON DELETE ${foreignKey.onDelete}` : ''

    const sql = `ALTER TABLE "${table}" ADD CONSTRAINT "${foreignKey.name}" ` +
      `FOREIGN KEY (${columns}) REFERENCES "${foreignKey.referencedTable}" (${refColumns})${onUpdate}${onDelete}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, constraintName } = request

    const sql = `ALTER TABLE "${table}" DROP CONSTRAINT "${constraintName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table } = request

    const columnDefs: string[] = []

    for (const col of table.columns) {
      let def = `"${col.name}" ${this.buildColumnType(col)}`
      if (col.primaryKey && col.autoIncrement) {
        // Use SERIAL for auto-increment primary keys
        if (col.type.toUpperCase() === 'INTEGER') {
          def = `"${col.name}" SERIAL`
        } else {
          def = `"${col.name}" BIGSERIAL`
        }
      }
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
      if (col.defaultValue !== undefined && col.defaultValue !== null && !col.autoIncrement) {
        const defaultVal = typeof col.defaultValue === 'string'
          ? `'${col.defaultValue.replace(/'/g, "''")}'`
          : col.defaultValue
        def += ` DEFAULT ${defaultVal}`
      }
      if (col.unique && !col.primaryKey) def += ' UNIQUE'
      columnDefs.push(def)
    }

    // Add primary key constraint
    const pkColumns = table.columns.filter((c) => c.primaryKey).map((c) => `"${c.name}"`)
    if (pkColumns.length > 0) {
      columnDefs.push(`PRIMARY KEY (${pkColumns.join(', ')})`)
    } else if (table.primaryKey && table.primaryKey.length > 0) {
      columnDefs.push(`PRIMARY KEY (${table.primaryKey.map((c) => `"${c}"`).join(', ')})`)
    }

    // Add foreign keys
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const columns = fk.columns.map((c) => `"${c}"`).join(', ')
        const refColumns = fk.referencedColumns.map((c) => `"${c}"`).join(', ')
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        columnDefs.push(
          `CONSTRAINT "${fk.name}" FOREIGN KEY (${columns}) ` +
          `REFERENCES "${fk.referencedTable}" (${refColumns})${onUpdate}${onDelete}`
        )
      }
    }

    const sql = `CREATE TABLE "${table.name}" (\n  ${columnDefs.join(',\n  ')}\n)`

    try {
      await this.client!.query(sql)

      // Create indexes separately
      if (table.indexes) {
        for (const idx of table.indexes) {
          await this.createIndex({ table: table.name, index: idx })
        }
      }

      // Add comment if present
      if (table.comment) {
        const commentSql = `COMMENT ON TABLE "${table.name}" IS '${table.comment.replace(/'/g, "''")}'`
        await this.client!.query(commentSql)
      }

      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE "${request.table}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `ALTER TABLE "${request.oldName}" RENAME TO "${request.newName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, values } = request

    const columns = Object.keys(values)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const columnList = columns.map((c) => `"${c}"`).join(', ')
    const sql = `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})`
    const params = Object.values(values)

    try {
      const result = await this.client!.query(sql, params)
      return { success: true, sql, affectedRows: result.rowCount || 0 }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues } = request

    const columns = Object.keys(primaryKeyValues)
    const conditions = columns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ')
    const sql = `DELETE FROM "${table}" WHERE ${conditions}`
    const params = Object.values(primaryKeyValues)

    try {
      const result = await this.client!.query(sql, params)
      return { success: true, sql, affectedRows: result.rowCount || 0 }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // View operations
  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const createOrReplace = view.replaceIfExists ? 'CREATE OR REPLACE VIEW' : 'CREATE VIEW'
    const sql = `${createOrReplace} "${view.name}" AS ${view.selectStatement}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const cascade = request.cascade ? ' CASCADE' : ''
    const sql = `DROP VIEW IF EXISTS "${request.viewName}"${cascade}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `ALTER VIEW "${request.oldName}" RENAME TO "${request.newName}"`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()
    const result = await this.client!.query(
      `SELECT pg_get_viewdef($1, true) as definition`,
      [viewName]
    )
    const definition = result.rows[0]?.definition || ''
    return `CREATE OR REPLACE VIEW "${viewName}" AS\n${definition}`
  }

  // User management
  async getUsers(): Promise<import('../types').DatabaseUser[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        rolname as name,
        rolsuper as superuser,
        rolcreaterole as create_role,
        rolcreatedb as create_db,
        rolcanlogin as login,
        rolreplication as replication,
        rolconnlimit as connection_limit,
        rolvaliduntil as valid_until,
        ARRAY(
          SELECT b.rolname
          FROM pg_catalog.pg_auth_members m
          JOIN pg_catalog.pg_roles b ON (m.roleid = b.oid)
          WHERE m.member = r.oid
        ) as roles
      FROM pg_catalog.pg_roles r
      WHERE rolname NOT LIKE 'pg_%'
      ORDER BY rolname
    `

    const result = await this.client!.query(sql)

    return result.rows.map((row) => ({
      name: row.name,
      superuser: row.superuser,
      createRole: row.create_role,
      createDb: row.create_db,
      login: row.login,
      replication: row.replication,
      connectionLimit: row.connection_limit === -1 ? undefined : row.connection_limit,
      validUntil: row.valid_until?.toISOString(),
      roles: row.roles || []
    }))
  }

  async getUserPrivileges(username: string): Promise<import('../types').UserPrivilege[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        privilege_type as privilege,
        grantee,
        table_catalog || '.' || table_schema || '.' || table_name as object_name,
        'TABLE' as object_type,
        grantor,
        is_grantable = 'YES' as is_grantable
      FROM information_schema.table_privileges
      WHERE grantee = $1
      UNION ALL
      SELECT
        privilege_type as privilege,
        grantee,
        table_catalog || '.' || table_schema || '.' || table_name || '.' || column_name as object_name,
        'COLUMN' as object_type,
        grantor,
        is_grantable = 'YES' as is_grantable
      FROM information_schema.column_privileges
      WHERE grantee = $1
      UNION ALL
      SELECT
        privilege_type as privilege,
        grantee,
        specific_catalog || '.' || specific_schema || '.' || routine_name as object_name,
        'ROUTINE' as object_type,
        grantor,
        is_grantable = 'YES' as is_grantable
      FROM information_schema.routine_privileges
      WHERE grantee = $1
      ORDER BY object_type, object_name, privilege
    `

    const result = await this.client!.query(sql, [username])

    return result.rows.map((row) => ({
      privilege: row.privilege,
      grantee: row.grantee,
      objectName: row.object_name,
      objectType: row.object_type,
      grantor: row.grantor,
      isGrantable: row.is_grantable
    }))
  }

  // ============================================
  // PostgreSQL-specific methods
  // ============================================

  // Schemas
  async getSchemas(): Promise<DatabaseSchema[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        schema_name as name,
        schema_owner as owner,
        CASE WHEN schema_name IN ('pg_catalog', 'information_schema', 'pg_toast')
             OR schema_name LIKE 'pg_temp%' OR schema_name LIKE 'pg_toast_temp%'
             THEN true ELSE false END as is_system
      FROM information_schema.schemata
      ORDER BY
        CASE WHEN schema_name = 'public' THEN 0 ELSE 1 END,
        schema_name
    `

    const result = await this.client!.query(sql)

    return result.rows.map((row) => ({
      name: row.name,
      owner: row.owner,
      isSystem: row.is_system
    }))
  }

  async createSchema(name: string): Promise<void> {
    this.ensureConnected()
    await this.client!.query(`CREATE SCHEMA "${name}"`)
  }

  setCurrentSchema(schema: string): void {
    this.currentSchema = schema
  }

  getCurrentSchema(): string {
    return this.currentSchema
  }

  // Sequences
  async getSequences(schema?: string): Promise<Sequence[]> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const sql = `
      SELECT
        s.sequencename as name,
        s.schemaname as schema,
        s.data_type as data_type,
        s.start_value::text as start_value,
        s.min_value::text as min_value,
        s.max_value::text as max_value,
        s.increment_by::text as increment,
        s.cycle as cycled,
        s.cache_size::text as cache_size,
        s.last_value::text as last_value,
        pg_get_userbyid(c.relowner) as owner
      FROM pg_sequences s
      JOIN pg_class c ON c.relname = s.sequencename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
      WHERE s.schemaname = $1
      ORDER BY s.sequencename
    `

    const result = await this.client!.query(sql, [targetSchema])

    return result.rows.map((row) => ({
      name: row.name,
      schema: row.schema,
      dataType: row.data_type,
      startValue: row.start_value,
      minValue: row.min_value,
      maxValue: row.max_value,
      increment: row.increment,
      cycled: row.cycled,
      cacheSize: row.cache_size,
      lastValue: row.last_value,
      owner: row.owner
    }))
  }

  async getSequenceDetails(sequenceName: string, schema?: string): Promise<Sequence | null> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const sql = `
      SELECT
        s.sequencename as name,
        s.schemaname as schema,
        s.data_type as data_type,
        s.start_value::text as start_value,
        s.min_value::text as min_value,
        s.max_value::text as max_value,
        s.increment_by::text as increment,
        s.cycle as cycled,
        s.cache_size::text as cache_size,
        s.last_value::text as last_value,
        pg_get_userbyid(c.relowner) as owner
      FROM pg_sequences s
      JOIN pg_class c ON c.relname = s.sequencename
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
      WHERE s.schemaname = $1 AND s.sequencename = $2
    `

    const result = await this.client!.query(sql, [targetSchema, sequenceName])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      name: row.name,
      schema: row.schema,
      dataType: row.data_type,
      startValue: row.start_value,
      minValue: row.min_value,
      maxValue: row.max_value,
      increment: row.increment,
      cycled: row.cycled,
      cacheSize: row.cache_size,
      lastValue: row.last_value,
      owner: row.owner
    }
  }

  async createSequence(request: CreateSequenceRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sequence } = request

    const schema = sequence.schema || this.currentSchema
    const fullName = `"${schema}"."${sequence.name}"`

    let sql = `CREATE SEQUENCE ${fullName}`

    if (sequence.dataType) {
      sql += ` AS ${sequence.dataType}`
    }
    if (sequence.startWith !== undefined) {
      sql += ` START WITH ${sequence.startWith}`
    }
    if (sequence.increment !== undefined) {
      sql += ` INCREMENT BY ${sequence.increment}`
    }
    if (sequence.minValue !== undefined) {
      sql += ` MINVALUE ${sequence.minValue}`
    }
    if (sequence.maxValue !== undefined) {
      sql += ` MAXVALUE ${sequence.maxValue}`
    }
    if (sequence.cycle !== undefined) {
      sql += sequence.cycle ? ' CYCLE' : ' NO CYCLE'
    }
    if (sequence.cache !== undefined) {
      sql += ` CACHE ${sequence.cache}`
    }
    if (sequence.ownedBy) {
      sql += ` OWNED BY ${sequence.ownedBy}`
    }

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropSequence(request: DropSequenceRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sequenceName, schema, cascade } = request

    const targetSchema = schema || this.currentSchema
    const fullName = `"${targetSchema}"."${sequenceName}"`
    const cascadeClause = cascade ? ' CASCADE' : ''

    const sql = `DROP SEQUENCE IF EXISTS ${fullName}${cascadeClause}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async alterSequence(request: AlterSequenceRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { sequenceName, schema, restartWith, increment, minValue, maxValue, cycle, cache, ownedBy } = request

    const targetSchema = schema || this.currentSchema
    const fullName = `"${targetSchema}"."${sequenceName}"`

    const alterClauses: string[] = []

    if (restartWith !== undefined) {
      alterClauses.push(`RESTART WITH ${restartWith}`)
    }
    if (increment !== undefined) {
      alterClauses.push(`INCREMENT BY ${increment}`)
    }
    if (minValue !== undefined) {
      alterClauses.push(minValue === null ? 'NO MINVALUE' : `MINVALUE ${minValue}`)
    }
    if (maxValue !== undefined) {
      alterClauses.push(maxValue === null ? 'NO MAXVALUE' : `MAXVALUE ${maxValue}`)
    }
    if (cycle !== undefined) {
      alterClauses.push(cycle ? 'CYCLE' : 'NO CYCLE')
    }
    if (cache !== undefined) {
      alterClauses.push(`CACHE ${cache}`)
    }
    if (ownedBy !== undefined) {
      alterClauses.push(ownedBy === null ? 'OWNED BY NONE' : `OWNED BY ${ownedBy}`)
    }

    if (alterClauses.length === 0) {
      return { success: true, sql: '-- No changes specified' }
    }

    const sql = `ALTER SEQUENCE ${fullName} ${alterClauses.join(' ')}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Materialized Views
  async getMaterializedViews(schema?: string): Promise<MaterializedView[]> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const sql = `
      SELECT
        m.matviewname as name,
        m.schemaname as schema,
        m.definition,
        m.matviewowner as owner,
        m.tablespace,
        m.hasindexes as has_indexes,
        m.ispopulated as is_populated
      FROM pg_matviews m
      WHERE m.schemaname = $1
      ORDER BY m.matviewname
    `

    const result = await this.client!.query(sql, [targetSchema])

    return result.rows.map((row) => ({
      name: row.name,
      schema: row.schema,
      definition: row.definition,
      owner: row.owner,
      tablespace: row.tablespace,
      hasIndexes: row.has_indexes,
      isPopulated: row.is_populated
    }))
  }

  async refreshMaterializedView(request: RefreshMaterializedViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { viewName, schema, concurrently, withData } = request

    const targetSchema = schema || this.currentSchema
    const fullName = `"${targetSchema}"."${viewName}"`
    const concurrentlyClause = concurrently ? ' CONCURRENTLY' : ''
    const dataClause = withData === false ? ' WITH NO DATA' : ''

    const sql = `REFRESH MATERIALIZED VIEW${concurrentlyClause} ${fullName}${dataClause}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getMaterializedViewDDL(viewName: string, schema?: string): Promise<string> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const result = await this.client!.query(
      `SELECT definition FROM pg_matviews WHERE schemaname = $1 AND matviewname = $2`,
      [targetSchema, viewName]
    )

    const definition = result.rows[0]?.definition || ''
    return `CREATE MATERIALIZED VIEW "${targetSchema}"."${viewName}" AS\n${definition}`
  }

  // Extensions
  async getExtensions(): Promise<Extension[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        e.extname as name,
        e.extversion as version,
        n.nspname as schema,
        c.description,
        e.extrelocatable as relocatable
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      LEFT JOIN pg_description c ON c.objoid = e.oid AND c.classoid = 'pg_extension'::regclass
      ORDER BY e.extname
    `

    const result = await this.client!.query(sql)

    return result.rows.map((row) => ({
      name: row.name,
      version: row.version,
      schema: row.schema,
      description: row.description,
      relocatable: row.relocatable
    }))
  }

  async getAvailableExtensions(): Promise<{ name: string; version: string; description: string }[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        name,
        default_version as version,
        comment as description
      FROM pg_available_extensions
      WHERE installed_version IS NULL
      ORDER BY name
    `

    const result = await this.client!.query(sql)

    return result.rows.map((row) => ({
      name: row.name,
      version: row.version || '',
      description: row.description || ''
    }))
  }

  async createExtension(request: CreateExtensionRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { name, schema, version, cascade } = request

    let sql = `CREATE EXTENSION IF NOT EXISTS "${name}"`

    if (schema) {
      sql += ` SCHEMA "${schema}"`
    }
    if (version) {
      sql += ` VERSION '${version}'`
    }
    if (cascade) {
      sql += ' CASCADE'
    }

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropExtension(request: DropExtensionRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { name, cascade } = request

    const cascadeClause = cascade ? ' CASCADE' : ''
    const sql = `DROP EXTENSION IF EXISTS "${name}"${cascadeClause}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Enums
  async getEnums(schema?: string): Promise<EnumType[]> {
    this.ensureConnected()

    const targetSchema = schema || this.currentSchema

    const sql = `
      SELECT
        t.typname as name,
        n.nspname as schema,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = $1
      GROUP BY t.typname, n.nspname
      ORDER BY t.typname
    `

    const result = await this.client!.query(sql, [targetSchema])

    return result.rows.map((row) => ({
      name: row.name,
      schema: row.schema,
      values: row.values
    }))
  }

  async getAllEnums(): Promise<EnumType[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        t.typname as name,
        n.nspname as schema,
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      GROUP BY t.typname, n.nspname
      ORDER BY n.nspname, t.typname
    `

    const result = await this.client!.query(sql)

    return result.rows.map((row) => ({
      name: row.name,
      schema: row.schema,
      values: row.values
    }))
  }

  // Trigger operations
  async getTriggers(table?: string): Promise<Trigger[]> {
    this.ensureConnected()

    let sql = `
      SELECT
        t.tgname as name,
        c.relname as table_name,
        n.nspname as schema,
        t.tgenabled != 'D' as enabled,
        CASE
          WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
          WHEN t.tgtype & 2 = 0 AND t.tgtype & 64 = 64 THEN 'INSTEAD OF'
          ELSE 'AFTER'
        END as timing,
        ARRAY_TO_STRING(ARRAY[
          CASE WHEN t.tgtype & 4 = 4 THEN 'INSERT' END,
          CASE WHEN t.tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN t.tgtype & 16 = 16 THEN 'UPDATE' END
        ], ' OR ') as event,
        pg_get_triggerdef(t.oid) as definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE NOT t.tgisinternal
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    `

    const params: string[] = []

    if (table) {
      sql += ` AND c.relname = $1`
      params.push(table)
    }

    sql += ` ORDER BY n.nspname, c.relname, t.tgname`

    const result = await this.client!.query(sql, params)

    return result.rows.map((row) => ({
      name: row.name,
      table: row.table_name,
      schema: row.schema,
      timing: row.timing,
      event: row.event,
      enabled: row.enabled,
      definition: row.definition
    }))
  }

  async getTriggerDefinition(name: string, table?: string): Promise<string> {
    this.ensureConnected()

    let sql = `
      SELECT pg_get_triggerdef(t.oid, true) as definition
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE t.tgname = $1
        AND NOT t.tgisinternal
    `

    const params: string[] = [name]

    if (table) {
      sql += ` AND c.relname = $2`
      params.push(table)
    }

    sql += ` LIMIT 1`

    const result = await this.client!.query(sql, params)

    if (result.rows.length > 0) {
      return result.rows[0].definition
    }

    return `-- Trigger '${name}' not found`
  }

  async createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { trigger } = request

    // PostgreSQL trigger syntax requires a function
    // CREATE TRIGGER name
    // {BEFORE | AFTER | INSTEAD OF} {event [OR ...]}
    // ON table_name
    // [FOR [EACH] {ROW | STATEMENT}]
    // [WHEN (condition)]
    // EXECUTE {FUNCTION | PROCEDURE} function_name()

    if (!trigger.functionName) {
      return {
        success: false,
        error: 'PostgreSQL triggers require a function name. Create a trigger function first.'
      }
    }

    const schema = trigger.schema || this.currentSchema
    let sql = `CREATE TRIGGER "${trigger.name}"\n`
    sql += `${trigger.timing} ${trigger.event}\n`
    sql += `ON "${schema}"."${trigger.table}"\n`
    sql += `FOR EACH ROW\n`
    if (trigger.condition) {
      sql += `WHEN (${trigger.condition})\n`
    }
    sql += `EXECUTE FUNCTION ${trigger.functionName}()`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { triggerName, table, schema, cascade } = request

    if (!table) {
      return {
        success: false,
        error: 'PostgreSQL requires the table name to drop a trigger'
      }
    }

    const targetSchema = schema || this.currentSchema
    const cascadeClause = cascade ? ' CASCADE' : ''
    const sql = `DROP TRIGGER IF EXISTS "${triggerName}" ON "${targetSchema}"."${table}"${cascadeClause}`

    try {
      await this.client!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
