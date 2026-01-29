import Database from 'better-sqlite3'
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

export class SQLiteDriver extends BaseDriver {
  readonly type = 'sqlite'
  private db: Database.Database | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const dbPath = config.filepath || config.database
      this.db = new Database(dbPath, { readonly: false })
      this.db.pragma('journal_mode = WAL')
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this._isConnected = false
    this.config = null
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const trimmedSql = sql.trim().toLowerCase()
      const isSelect = trimmedSql.startsWith('select') ||
                       trimmedSql.startsWith('pragma') ||
                       trimmedSql.startsWith('explain')

      if (isSelect) {
        const stmt = this.db!.prepare(sql)
        const rows = params && params.length > 0
          ? stmt.all(...params) as Record<string, unknown>[]
          : stmt.all() as Record<string, unknown>[]
        const columns = stmt.columns().map((col) => ({
          name: col.name,
          type: col.type || 'unknown',
          nullable: true,
          primaryKey: false
        }))

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime
        }
      } else {
        const stmt = this.db!.prepare(sql)
        const result = params && params.length > 0
          ? stmt.run(...params)
          : stmt.run()

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.changes,
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

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    // SQLite only has one database per file
    const dbPath = this.config?.filepath || this.config?.database || 'main'
    return [{ name: dbPath.split('/').pop() || 'main' }]
  }

  async getTables(database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()

    const tables = this.db!.prepare(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string; type: string }[]

    return tables.map((t) => ({
      name: t.name,
      type: t.type === 'view' ? 'view' : 'table'
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const columns = this.db!.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }[]

    return columns.map((col) => ({
      name: col.name,
      type: col.type || 'TEXT',
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      primaryKey: col.pk > 0,
      autoIncrement: col.pk > 0 && col.type.toUpperCase() === 'INTEGER',
      unique: false
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const indexes = this.db!.prepare(`PRAGMA index_list("${table}")`).all() as {
      seq: number
      name: string
      unique: number
      origin: string
    }[]

    const result: Index[] = []

    for (const idx of indexes) {
      const columns = this.db!.prepare(`PRAGMA index_info("${idx.name}")`).all() as {
        seqno: number
        cid: number
        name: string
      }[]

      result.push({
        name: idx.name,
        columns: columns.map((c) => c.name),
        unique: idx.unique === 1,
        primary: idx.origin === 'pk'
      })
    }

    return result
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const fks = this.db!.prepare(`PRAGMA foreign_key_list("${table}")`).all() as {
      id: number
      seq: number
      table: string
      from: string
      to: string
      on_update: string
      on_delete: string
    }[]

    return fks.map((fk) => ({
      name: `fk_${table}_${fk.from}`,
      column: fk.from,
      referencedTable: fk.table,
      referencedColumn: fk.to,
      onUpdate: fk.on_update,
      onDelete: fk.on_delete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const result = this.db!.prepare(`
      SELECT sql FROM sqlite_master WHERE name = ? AND type IN ('table', 'view')
    `).get(table) as { sql: string } | undefined

    return result?.sql || ''
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { clause: whereClause, values } = this.buildWhereClause(options)
    const orderClause = this.buildOrderClause(options)
    const limitClause = this.buildLimitClause(options)

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`
    const countResult = this.db!.prepare(countSql).get(...values) as { count: number }
    const totalCount = countResult.count

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
    const dataSql = `SELECT * FROM "${table}" ${whereClause} ${orderClause} ${limitClause}`
    const rows = this.db!.prepare(dataSql).all(...values) as Record<string, unknown>[]

    return {
      columns,
      rows,
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || rows.length
    }
  }
}
