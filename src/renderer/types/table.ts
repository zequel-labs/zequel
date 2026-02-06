export enum TabType {
  Query = 'query',
  Table = 'table',
  View = 'view',
  ERDiagram = 'er-diagram',
  Routine = 'routine',
  Users = 'users',
  Monitoring = 'monitoring',
  Trigger = 'trigger',
  Event = 'event',
  Sequence = 'sequence',
  MaterializedView = 'materialized-view',
  Extensions = 'extensions',
  Enums = 'enums',
  CreateTable = 'create-table',
}

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

export enum StructureTab {
  Columns = 'columns',
  Indexes = 'indexes',
  ForeignKeys = 'foreignKeys',
  Triggers = 'triggers',
}

export enum ColumnChangeStatus {
  Unchanged = 'unchanged',
  Added = 'added',
  Modified = 'modified',
  Dropped = 'dropped',
}

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

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  primaryKey?: boolean
  defaultValue?: unknown
  autoIncrement?: boolean
}

export interface TableTab {
  id: string
  connectionId: string
  tableName: string
  database?: string
  schema?: string
  activeView: 'data' | 'structure'
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

// PostgreSQL-specific types

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

export interface MaterializedView {
  name: string
  schema: string
  definition: string
  owner?: string
  tablespace?: string
  hasIndexes?: boolean
  isPopulated?: boolean
}

export interface Extension {
  name: string
  version: string
  schema?: string
  description?: string
  relocatable?: boolean
}

export interface DatabaseSchema {
  name: string
  owner?: string
  isSystem?: boolean
}

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
