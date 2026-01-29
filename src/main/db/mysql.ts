import mysql from 'mysql2/promise'
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

export class MySQLDriver extends BaseDriver {
  readonly type = 'mysql'
  private connection: mysql.Connection | null = null
  private currentDatabase: string = ''

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl
          ? {
              rejectUnauthorized: config.sslConfig?.rejectUnauthorized ?? true
            }
          : undefined
      })
      this.currentDatabase = config.database
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
    this._isConnected = false
    this.config = null
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const [result, fields] = params && params.length > 0
        ? await this.connection!.query(sql, params)
        : await this.connection!.query(sql)

      if (Array.isArray(result)) {
        const columns: ColumnInfo[] = (fields as mysql.FieldPacket[])?.map((field) => ({
          name: field.name,
          type: this.mapMySQLType(field.type),
          nullable: true,
          primaryKey: (field.flags & 2) !== 0
        })) || []

        return {
          columns,
          rows: result as Record<string, unknown>[],
          rowCount: result.length,
          executionTime: Date.now() - startTime
        }
      } else {
        const resultSetHeader = result as mysql.ResultSetHeader
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: resultSetHeader.affectedRows,
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

  private mapMySQLType(typeId: number | undefined): string {
    const types: Record<number, string> = {
      0: 'DECIMAL',
      1: 'TINYINT',
      2: 'SMALLINT',
      3: 'INT',
      4: 'FLOAT',
      5: 'DOUBLE',
      6: 'NULL',
      7: 'TIMESTAMP',
      8: 'BIGINT',
      9: 'MEDIUMINT',
      10: 'DATE',
      11: 'TIME',
      12: 'DATETIME',
      13: 'YEAR',
      14: 'NEWDATE',
      15: 'VARCHAR',
      16: 'BIT',
      245: 'JSON',
      246: 'NEWDECIMAL',
      247: 'ENUM',
      248: 'SET',
      249: 'TINY_BLOB',
      250: 'MEDIUM_BLOB',
      251: 'LONG_BLOB',
      252: 'BLOB',
      253: 'VAR_STRING',
      254: 'STRING',
      255: 'GEOMETRY'
    }
    return types[typeId || 0] || 'UNKNOWN'
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    const [rows] = await this.connection!.query('SHOW DATABASES')
    return (rows as { Database: string }[]).map((row) => ({
      name: row.Database
    }))
  }

  async getTables(database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()

    if (database !== this.currentDatabase) {
      await this.connection!.query(`USE \`${database}\``)
      this.currentDatabase = database
    }

    const [rows] = await this.connection!.query(`
      SELECT TABLE_NAME as name, TABLE_TYPE as type, TABLE_ROWS as row_count,
             DATA_LENGTH + INDEX_LENGTH as size, TABLE_COMMENT as comment
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [database])

    return (rows as any[]).map((row) => ({
      name: row.name,
      type: row.type === 'VIEW' ? 'view' : 'table',
      rowCount: row.row_count,
      size: row.size,
      comment: row.comment
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`
      SELECT
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as defaultValue,
        COLUMN_KEY as columnKey,
        EXTRA as extra,
        CHARACTER_MAXIMUM_LENGTH as length,
        NUMERIC_PRECISION as \`precision\`,
        NUMERIC_SCALE as scale,
        COLUMN_COMMENT as comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [this.currentDatabase, table])

    return (rows as any[]).map((row) => ({
      name: row.name,
      type: row.type.toUpperCase(),
      nullable: row.nullable === 'YES',
      defaultValue: row.defaultValue,
      primaryKey: row.columnKey === 'PRI',
      autoIncrement: row.extra?.includes('auto_increment') || false,
      unique: row.columnKey === 'UNI',
      comment: row.comment,
      length: row.length,
      precision: row.precision,
      scale: row.scale
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`SHOW INDEX FROM \`${table}\``)

    const indexMap = new Map<string, Index>()

    for (const row of rows as any[]) {
      const existing = indexMap.get(row.Key_name)
      if (existing) {
        existing.columns.push(row.Column_name)
      } else {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [row.Column_name],
          unique: row.Non_unique === 0,
          primary: row.Key_name === 'PRIMARY',
          type: row.Index_type
        })
      }
    }

    return Array.from(indexMap.values())
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`
      SELECT
        CONSTRAINT_NAME as name,
        COLUMN_NAME as \`column\`,
        REFERENCED_TABLE_NAME as referencedTable,
        REFERENCED_COLUMN_NAME as referencedColumn
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [this.currentDatabase, table])

    // Get ON UPDATE/DELETE actions
    const [refRows] = await this.connection!.query(`
      SELECT
        CONSTRAINT_NAME as name,
        UPDATE_RULE as onUpdate,
        DELETE_RULE as onDelete
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ?
        AND TABLE_NAME = ?
    `, [this.currentDatabase, table])

    const refMap = new Map<string, { onUpdate: string; onDelete: string }>()
    for (const row of refRows as any[]) {
      refMap.set(row.name, { onUpdate: row.onUpdate, onDelete: row.onDelete })
    }

    return (rows as any[]).map((row) => ({
      name: row.name,
      column: row.column,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
      onUpdate: refMap.get(row.name)?.onUpdate,
      onDelete: refMap.get(row.name)?.onDelete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`SHOW CREATE TABLE \`${table}\``)
    const row = (rows as any[])[0]
    return row['Create Table'] || row['Create View'] || ''
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { clause: whereClause, values } = this.buildWhereClauseMysql(options)
    const orderClause = this.buildOrderClauseMysql(options)
    const limitClause = this.buildLimitClause(options)

    // Get total count
    const [countRows] = await this.connection!.query(
      `SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`,
      values
    )
    const totalCount = (countRows as any[])[0].count

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
    const [rows] = await this.connection!.query(
      `SELECT * FROM \`${table}\` ${whereClause} ${orderClause} ${limitClause}`,
      values
    )

    return {
      columns,
      rows: rows as Record<string, unknown>[],
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || (rows as any[]).length
    }
  }

  private buildWhereClauseMysql(options: DataOptions): { clause: string; values: unknown[] } {
    if (!options.filters || options.filters.length === 0) {
      return { clause: '', values: [] }
    }

    const conditions: string[] = []
    const values: unknown[] = []

    for (const filter of options.filters) {
      switch (filter.operator) {
        case 'IS NULL':
          conditions.push(`\`${filter.column}\` IS NULL`)
          break
        case 'IS NOT NULL':
          conditions.push(`\`${filter.column}\` IS NOT NULL`)
          break
        case 'IN':
        case 'NOT IN':
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => '?').join(', ')
            conditions.push(`\`${filter.column}\` ${filter.operator} (${placeholders})`)
            values.push(...filter.value)
          }
          break
        case 'LIKE':
        case 'NOT LIKE':
          conditions.push(`\`${filter.column}\` ${filter.operator} ?`)
          values.push(`%${filter.value}%`)
          break
        default:
          conditions.push(`\`${filter.column}\` ${filter.operator} ?`)
          values.push(filter.value)
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    }
  }

  private buildOrderClauseMysql(options: DataOptions): string {
    if (!options.orderBy) return ''
    const direction = options.orderDirection || 'ASC'
    return `ORDER BY \`${options.orderBy}\` ${direction}`
  }
}
