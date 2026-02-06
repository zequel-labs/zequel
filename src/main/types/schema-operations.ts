// Schema Operation Types for Database Editing

// Reference action types for foreign keys
export type ReferenceAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION'

// Column Definition
export interface ColumnDefinition {
  name: string
  type: string
  length?: number
  precision?: number
  scale?: number
  nullable: boolean
  defaultValue?: string | number | null
  primaryKey?: boolean
  autoIncrement?: boolean
  unique?: boolean
  comment?: string
  afterColumn?: string // MySQL: FIRST/AFTER positioning
}

// Column Operation Requests
export interface AddColumnRequest {
  table: string
  column: ColumnDefinition
}

export interface ModifyColumnRequest {
  table: string
  oldName: string
  newDefinition: ColumnDefinition
}

export interface DropColumnRequest {
  table: string
  columnName: string
}

export interface RenameColumnRequest {
  table: string
  oldName: string
  newName: string
}

// Index Definition
export interface IndexDefinition {
  name: string
  columns: string[]
  unique?: boolean
  type?: string // BTREE, HASH, etc.
}

// Index Operation Requests
export interface CreateIndexRequest {
  table: string
  index: IndexDefinition
  schema?: string
}

export interface DropIndexRequest {
  table: string
  indexName: string
}

// Foreign Key Definition
export interface ForeignKeyDefinition {
  name: string
  columns: string[]
  referencedTable: string
  referencedSchema?: string
  referencedColumns: string[]
  onUpdate?: ReferenceAction
  onDelete?: ReferenceAction
}

// Foreign Key Operation Requests
export interface AddForeignKeyRequest {
  table: string
  foreignKey: ForeignKeyDefinition
}

export interface DropForeignKeyRequest {
  table: string
  constraintName: string
}

// Table Definition for creation
export interface TableDefinition {
  name: string
  columns: ColumnDefinition[]
  primaryKey?: string[]
  indexes?: IndexDefinition[]
  foreignKeys?: ForeignKeyDefinition[]
  comment?: string
}

// Table Operation Requests
export interface CreateTableRequest {
  table: TableDefinition
  schema?: string
}

export interface DropTableRequest {
  table: string
}

export interface RenameTableRequest {
  oldName: string
  newName: string
}

// Row Operation Requests
export interface InsertRowRequest {
  table: string
  values: Record<string, unknown>
}

export interface DeleteRowRequest {
  table: string
  primaryKeyValues: Record<string, unknown>
}

// View Definition
export interface ViewDefinition {
  name: string
  selectStatement: string
  replaceIfExists?: boolean
}

// View Operation Requests
export interface CreateViewRequest {
  view: ViewDefinition
}

export interface DropViewRequest {
  viewName: string
  cascade?: boolean
}

export interface RenameViewRequest {
  oldName: string
  newName: string
}

// Trigger Definition
export interface TriggerDefinition {
  name: string
  table: string
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  body: string
  schema?: string
  // PostgreSQL: function name to call
  functionName?: string
  // MySQL: FOR EACH ROW is implicit, this is the statement
  forEachRow?: boolean
  // Condition for WHEN clause (PostgreSQL)
  condition?: string
}

// Trigger Operation Requests
export interface CreateTriggerRequest {
  trigger: TriggerDefinition
}

export interface DropTriggerRequest {
  triggerName: string
  table?: string
  schema?: string
  cascade?: boolean
}

// Operation Result
export interface SchemaOperationResult {
  success: boolean
  sql?: string
  error?: string
  affectedRows?: number
}

// Data Type Information for UI
export interface DataTypeInfo {
  name: string
  category: 'numeric' | 'string' | 'datetime' | 'binary' | 'json' | 'boolean' | 'other'
  hasLength?: boolean
  hasPrecision?: boolean
  defaultLength?: number
  defaultPrecision?: number
  defaultScale?: number
}

// Database-specific data types
export const SQLITE_DATA_TYPES: DataTypeInfo[] = [
  { name: 'INTEGER', category: 'numeric' },
  { name: 'REAL', category: 'numeric' },
  { name: 'TEXT', category: 'string' },
  { name: 'BLOB', category: 'binary' },
  { name: 'NUMERIC', category: 'numeric', hasPrecision: true }
]

export const MYSQL_DATA_TYPES: DataTypeInfo[] = [
  // Numeric
  { name: 'TINYINT', category: 'numeric', hasLength: true, defaultLength: 4 },
  { name: 'SMALLINT', category: 'numeric', hasLength: true, defaultLength: 6 },
  { name: 'MEDIUMINT', category: 'numeric', hasLength: true, defaultLength: 9 },
  { name: 'INT', category: 'numeric', hasLength: true, defaultLength: 11 },
  { name: 'BIGINT', category: 'numeric', hasLength: true, defaultLength: 20 },
  { name: 'DECIMAL', category: 'numeric', hasPrecision: true, defaultPrecision: 10, defaultScale: 0 },
  { name: 'FLOAT', category: 'numeric' },
  { name: 'DOUBLE', category: 'numeric' },
  // String
  { name: 'CHAR', category: 'string', hasLength: true, defaultLength: 1 },
  { name: 'VARCHAR', category: 'string', hasLength: true, defaultLength: 255 },
  { name: 'TINYTEXT', category: 'string' },
  { name: 'TEXT', category: 'string' },
  { name: 'MEDIUMTEXT', category: 'string' },
  { name: 'LONGTEXT', category: 'string' },
  // Binary
  { name: 'BINARY', category: 'binary', hasLength: true, defaultLength: 1 },
  { name: 'VARBINARY', category: 'binary', hasLength: true, defaultLength: 255 },
  { name: 'TINYBLOB', category: 'binary' },
  { name: 'BLOB', category: 'binary' },
  { name: 'MEDIUMBLOB', category: 'binary' },
  { name: 'LONGBLOB', category: 'binary' },
  // DateTime
  { name: 'DATE', category: 'datetime' },
  { name: 'TIME', category: 'datetime' },
  { name: 'DATETIME', category: 'datetime' },
  { name: 'TIMESTAMP', category: 'datetime' },
  { name: 'YEAR', category: 'datetime' },
  // Other
  { name: 'JSON', category: 'json' },
  { name: 'ENUM', category: 'other' },
  { name: 'SET', category: 'other' }
]

export const POSTGRESQL_DATA_TYPES: DataTypeInfo[] = [
  // Numeric
  { name: 'SMALLINT', category: 'numeric' },
  { name: 'INTEGER', category: 'numeric' },
  { name: 'BIGINT', category: 'numeric' },
  { name: 'DECIMAL', category: 'numeric', hasPrecision: true, defaultPrecision: 10, defaultScale: 0 },
  { name: 'NUMERIC', category: 'numeric', hasPrecision: true, defaultPrecision: 10, defaultScale: 0 },
  { name: 'REAL', category: 'numeric' },
  { name: 'DOUBLE PRECISION', category: 'numeric' },
  { name: 'SERIAL', category: 'numeric' },
  { name: 'BIGSERIAL', category: 'numeric' },
  // String
  { name: 'CHAR', category: 'string', hasLength: true, defaultLength: 1 },
  { name: 'VARCHAR', category: 'string', hasLength: true, defaultLength: 255 },
  { name: 'TEXT', category: 'string' },
  // Binary
  { name: 'BYTEA', category: 'binary' },
  // Boolean
  { name: 'BOOLEAN', category: 'boolean' },
  // DateTime
  { name: 'DATE', category: 'datetime' },
  { name: 'TIME', category: 'datetime' },
  { name: 'TIMESTAMP', category: 'datetime' },
  { name: 'TIMESTAMPTZ', category: 'datetime' },
  { name: 'INTERVAL', category: 'datetime' },
  // JSON
  { name: 'JSON', category: 'json' },
  { name: 'JSONB', category: 'json' },
  // Other
  { name: 'UUID', category: 'other' },
  { name: 'INET', category: 'other' },
  { name: 'CIDR', category: 'other' },
  { name: 'MACADDR', category: 'other' }
]

// PostgreSQL-specific operation types

// Sequence operations
export interface CreateSequenceRequest {
  sequence: {
    name: string
    schema?: string
    dataType?: string
    startWith?: number
    increment?: number
    minValue?: number
    maxValue?: number
    cycle?: boolean
    cache?: number
    ownedBy?: string
  }
}

export interface DropSequenceRequest {
  sequenceName: string
  schema?: string
  cascade?: boolean
}

export interface AlterSequenceRequest {
  sequenceName: string
  schema?: string
  restartWith?: number
  increment?: number
  minValue?: number | null
  maxValue?: number | null
  cycle?: boolean
  cache?: number
  ownedBy?: string | null
}

// Materialized view operations
export interface RefreshMaterializedViewRequest {
  viewName: string
  schema?: string
  concurrently?: boolean
  withData?: boolean
}

// Extension operations
export interface CreateExtensionRequest {
  name: string
  schema?: string
  version?: string
  cascade?: boolean
}

export interface DropExtensionRequest {
  name: string
  cascade?: boolean
}
