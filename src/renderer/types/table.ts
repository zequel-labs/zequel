export interface Database {
  name: string
  charset?: string
  collation?: string
}

export interface Schema {
  name: string
  tables: Table[]
}

export interface Table {
  name: string
  schema?: string
  type: 'table' | 'view'
  rowCount?: number
  size?: number
  comment?: string
}

export interface Column {
  name: string
  type: string
  nullable: boolean
  defaultValue: unknown
  primaryKey: boolean
  autoIncrement: boolean
  unique: boolean
  comment?: string
  length?: number
  precision?: number
  scale?: number
}

export interface Index {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
  type?: string
}

export interface ForeignKey {
  name: string
  column: string
  referencedTable: string
  referencedColumn: string
  onUpdate?: string
  onDelete?: string
}

export interface Routine {
  name: string
  type: 'PROCEDURE' | 'FUNCTION'
  schema?: string
  returnType?: string
  language?: string
  definition?: string
  parameters?: RoutineParameter[]
  createdAt?: string
  modifiedAt?: string
}

export interface RoutineParameter {
  name: string
  type: string
  mode: 'IN' | 'OUT' | 'INOUT'
  defaultValue?: string
}

export interface DatabaseUser {
  name: string
  host?: string
  superuser?: boolean
  createRole?: boolean
  createDb?: boolean
  login?: boolean
  replication?: boolean
  connectionLimit?: number
  validUntil?: string
  roles?: string[]
}

export interface UserPrivilege {
  privilege: string
  grantee: string
  objectType?: string
  objectName?: string
  grantor?: string
  isGrantable?: boolean
}

export interface DataOptions {
  offset?: number
  limit?: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
  filters?: DataFilter[]
}

export interface DataFilter {
  column: string
  operator: FilterOperator
  value: unknown
}

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'

export interface DataResult {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  totalCount: number
  offset: number
  limit: number
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  defaultValue?: unknown
}

export interface TableTab {
  id: string
  connectionId: string
  tableName: string
  database?: string
  schema?: string
  activeView: 'data' | 'structure' | 'ddl'
}
