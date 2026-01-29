import type {
  ConnectionConfig,
  QueryResult,
  Database,
  Table,
  Column,
  Index,
  ForeignKey,
  DataOptions,
  DataResult
} from '../types'

export interface TestConnectionResult {
  success: boolean
  error: string | null
}

export interface DatabaseDriver {
  readonly type: string
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
}

export abstract class BaseDriver implements DatabaseDriver {
  abstract readonly type: string
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

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    try {
      await this.connect(config)
      await this.disconnect()
      return { success: true, error: null }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
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
