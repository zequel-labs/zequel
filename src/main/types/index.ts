// Connection Types
export type DatabaseType = 'sqlite' | 'mysql' | 'postgresql'

export interface ConnectionConfig {
  id: string
  name: string
  type: DatabaseType
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
  sslConfig?: SSLConfig
  // SSH tunneling
  ssh?: SSHConfig
  // SQLite specific
  filepath?: string
}

export interface SSLConfig {
  ca?: string
  cert?: string
  key?: string
  rejectUnauthorized?: boolean
}

export interface SSHConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  authMethod: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  privateKeyPassphrase?: string
}

export interface SavedConnection {
  id: string
  name: string
  type: DatabaseType
  host: string | null
  port: number | null
  database: string
  username: string | null
  filepath: string | null
  ssl: boolean
  sslConfig: SSLConfig | null
  ssh: SSHConfig | null
  createdAt: string
  updatedAt: string
  lastConnectedAt: string | null
}

// Query Types
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
}

// Schema Types
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

// Routine types for stored procedures and functions
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

// User management types
export interface DatabaseUser {
  name: string
  host?: string // MySQL specific
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

// Data Options
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

// IPC Channel Types
export interface IPCChannels {
  // Connection channels
  'connection:list': () => Promise<SavedConnection[]>
  'connection:get': (id: string) => Promise<SavedConnection | null>
  'connection:save': (config: ConnectionConfig) => Promise<SavedConnection>
  'connection:delete': (id: string) => Promise<boolean>
  'connection:test': (config: ConnectionConfig) => Promise<boolean>
  'connection:connect': (id: string) => Promise<boolean>
  'connection:disconnect': (id: string) => Promise<boolean>

  // Query channels
  'query:execute': (connectionId: string, sql: string) => Promise<QueryResult>
  'query:cancel': (connectionId: string) => Promise<boolean>

  // Schema channels
  'schema:databases': (connectionId: string) => Promise<Database[]>
  'schema:tables': (connectionId: string, database: string, schema?: string) => Promise<Table[]>
  'schema:columns': (connectionId: string, table: string) => Promise<Column[]>
  'schema:indexes': (connectionId: string, table: string) => Promise<Index[]>
  'schema:foreignKeys': (connectionId: string, table: string) => Promise<ForeignKey[]>
  'schema:tableDDL': (connectionId: string, table: string) => Promise<string>
  'schema:tableData': (connectionId: string, table: string, options: DataOptions) => Promise<DataResult>
}
