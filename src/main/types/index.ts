// Connection Types
export enum DatabaseType {
  SQLite = 'sqlite',
  MySQL = 'mysql',
  PostgreSQL = 'postgresql',
  MariaDB = 'mariadb',
  ClickHouse = 'clickhouse',
  MongoDB = 'mongodb',
  Redis = 'redis',
}

export type ConnectionEnvironment = 'production' | 'staging' | 'development' | 'testing' | 'local'

export enum TableObjectType {
  Table = 'table',
  View = 'view',
}

export enum RoutineType {
  Procedure = 'PROCEDURE',
  Function = 'FUNCTION',
}

export enum RoutineParameterMode {
  In = 'IN',
  Out = 'OUT',
  InOut = 'INOUT',
}

export enum EventStatus {
  Enabled = 'ENABLED',
  Disabled = 'DISABLED',
  SlavesideDisabled = 'SLAVESIDE_DISABLED',
}

export enum SortDirection {
  Asc = 'ASC',
  Desc = 'DESC',
}

export enum ItemType {
  Table = 'table',
  View = 'view',
  Query = 'query',
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  [DatabaseType.SQLite]: 0,
  [DatabaseType.MySQL]: 3306,
  [DatabaseType.MariaDB]: 3306,
  [DatabaseType.PostgreSQL]: 5432,
  [DatabaseType.ClickHouse]: 8123,
  [DatabaseType.MongoDB]: 27017,
  [DatabaseType.Redis]: 6379,
}

export enum SSLMode {
  Disable = 'disable',
  Prefer = 'prefer',
  Require = 'require',
  VerifyCA = 'verify-ca',
  VerifyFull = 'verify-full'
}

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
  // Custom color for UI
  color?: string
  // Environment label
  environment?: ConnectionEnvironment
  // Folder/group for organizing connections
  folder?: string
}

export interface SSLConfig {
  enabled?: boolean
  mode?: SSLMode
  ca?: string
  cert?: string
  key?: string
  rejectUnauthorized?: boolean
  minVersion?: string
  serverName?: string
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
  color: string | null
  environment: ConnectionEnvironment | null
  folder: string | null
  sortOrder: number
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

export interface MultiQueryResult {
  results: QueryResult[]
  totalExecutionTime: number
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  defaultValue?: unknown
  autoIncrement?: boolean
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
  type: TableObjectType
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
  referencedSchema?: string
  referencedTable: string
  referencedColumn: string
  onUpdate?: string
  onDelete?: string
}

// Routine types for stored procedures and functions
export interface Routine {
  name: string
  type: RoutineType
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
  mode: RoutineParameterMode
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
  bypassRls?: boolean
  hasPassword?: boolean
  connectionLimit?: number
  validUntil?: string
  roles?: string[]
}

// Trigger types
export interface Trigger {
  name: string
  table: string
  event: 'INSERT' | 'UPDATE' | 'DELETE' | string
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF' | string
  schema?: string
  enabled?: boolean
  definition?: string
  createdAt?: string
}

// PostgreSQL-specific types

// Sequence type
export interface Sequence {
  name: string
  schema: string
  dataType: string
  startValue: string
  minValue: string
  maxValue: string
  increment: string
  cycled: boolean
  cacheSize: string
  lastValue?: string
  owner?: string
}

export interface SequenceDefinition {
  name: string
  schema?: string
  dataType?: string
  startWith?: number
  increment?: number
  minValue?: number
  maxValue?: number
  cycle?: boolean
  cache?: number
  ownedBy?: string // table.column
}

// Materialized View type
export interface MaterializedView {
  name: string
  schema: string
  definition: string
  owner?: string
  tablespace?: string
  hasIndexes?: boolean
  isPopulated?: boolean
}

// Extension type
export interface Extension {
  name: string
  version: string
  schema?: string
  description?: string
  relocatable?: boolean
}

// Schema type
export interface DatabaseSchema {
  name: string
  owner?: string
  isSystem?: boolean
  tableCount?: number
}

// Enum type
export interface EnumType {
  name: string
  schema: string
  values: string[]
}

// MySQL-specific types

export interface CharsetInfo {
  charset: string
  description: string
  defaultCollation: string
  maxLength: number
}

export interface CollationInfo {
  collation: string
  charset: string
  id: number
  isDefault: boolean
  isCompiled: boolean
  sortLength: number
}

export interface PartitionInfo {
  partitionName: string
  subpartitionName?: string
  partitionOrdinalPosition: number
  subpartitionOrdinalPosition?: number
  partitionMethod: string
  subpartitionMethod?: string
  partitionExpression: string
  subpartitionExpression?: string
  partitionDescription?: string
  tableRows: number
  avgRowLength: number
  dataLength: number
  indexLength: number
  partitionComment?: string
}

export interface MySQLEvent {
  name: string
  database: string
  definer: string
  timeZone: string
  eventType: 'ONE TIME' | 'RECURRING'
  executeAt?: string
  intervalValue?: number
  intervalField?: string
  sqlMode: string
  starts?: string
  ends?: string
  status: EventStatus
  onCompletion: 'NOT PRESERVE' | 'PRESERVE'
  created: string
  lastAltered: string
  lastExecuted?: string
  eventComment?: string
  originator: number
  characterSetClient: string
  collationConnection: string
  databaseCollation: string
}

// Process monitoring types
export interface DatabaseProcess {
  id: number | string
  user: string
  host: string
  database: string | null
  command: string
  time: number
  state: string | null
  info: string | null
  progress?: number
  backendType?: string
}

export interface ServerStatus {
  variables: Record<string, string>
  status: Record<string, string>
}

// Data Options
export interface DataOptions {
  offset?: number
  limit?: number
  orderBy?: string
  orderDirection?: SortDirection
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
  'connection:connectWithConfig': (config: ConnectionConfig) => Promise<boolean>
  'connection:disconnect': (id: string) => Promise<boolean>

  // Query channels
  'query:execute': (connectionId: string, sql: string) => Promise<QueryResult>
  'query:executeMultiple': (connectionId: string, sql: string) => Promise<MultiQueryResult>
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
