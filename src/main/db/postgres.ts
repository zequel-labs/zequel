import { Pool, PoolClient } from 'pg'
import { BaseDriver } from './base'
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
  ColumnInfo
} from '../types'

export class PostgreSQLDriver extends BaseDriver {
  readonly type = 'postgresql'
  private pool: Pool | null = null
  private client: PoolClient | null = null
  private currentDatabase: string = ''
  private currentSchema: string = 'public'

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.pool = new Pool({
        host: config.host || 'localhost',
        port: config.port || 5432,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl
          ? {
              rejectUnauthorized: config.sslConfig?.rejectUnauthorized ?? true
            }
          : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      })

      this.client = await this.pool.connect()
      this.currentDatabase = config.database
      this.config = config
      this._isConnected = true
    } catch (error) {
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

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      // Convert ? placeholders to $1, $2, etc. for PostgreSQL
      let pgSql = sql
      if (params && params.length > 0) {
        let paramIndex = 1
        pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`)
      }

      const result = await this.client!.query(pgSql, params)

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
      type: row.type === 'VIEW' ? 'view' : 'table',
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
      defaultValue: col.defaultValue
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
}
