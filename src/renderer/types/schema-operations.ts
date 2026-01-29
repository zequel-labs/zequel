// Schema Operation Types for Database Editing (Renderer-side)

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
  type?: string
}

// Index Operation Requests
export interface CreateIndexRequest {
  table: string
  index: IndexDefinition
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

// Trigger operations
export interface TriggerDefinition {
  name: string
  table: string
  timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  event: 'INSERT' | 'UPDATE' | 'DELETE'
  body: string
  schema?: string
  functionName?: string // PostgreSQL only
  forEachRow?: boolean
  condition?: string
}

export interface CreateTriggerRequest {
  trigger: TriggerDefinition
}

export interface DropTriggerRequest {
  triggerName: string
  table?: string
  schema?: string
  cascade?: boolean
}
