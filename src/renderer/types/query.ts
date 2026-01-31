export interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  rowCount: number
  affectedRows?: number
  executionTime: number
  error?: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  defaultValue?: unknown
  autoIncrement?: boolean
}

export interface MultiQueryResult {
  results: QueryResult[]
  totalExecutionTime: number
}

export interface QueryHistoryItem {
  id: number
  connectionId: string
  sql: string
  executedAt: string
  executionTime?: number
  rowCount?: number
  error?: string
}

export interface QueryTab {
  id: string
  connectionId: string
  title: string
  sql: string
  result?: QueryResult
  isExecuting: boolean
  isDirty: boolean
}

export interface CellChange {
  rowIndex: number
  column: string
  originalValue: unknown
  newValue: unknown
}
