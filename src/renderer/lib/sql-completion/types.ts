export interface SchemaMetadata {
  tables: Array<{
    name: string
    schema?: string
    columns: Array<{
      name: string
      type: string
    }>
  }>
  views?: Array<{
    name: string
    schema?: string
    columns?: Array<{
      name: string
      type: string
    }>
  }>
  procedures?: Array<{
    name: string
  }>
  functions?: Array<{
    name: string
  }>
}

export type SqlContext =
  | 'select'
  | 'from'
  | 'where'
  | 'join_on'
  | 'insert_columns'
  | 'update_set'
  | 'order_by'
  | 'group_by'
  | 'having'
  | 'general'

export interface SqlContextInfo {
  context: SqlContext
  tableAliases: Map<string, string>  // alias (lowercase) -> tableName
  referencedTables: string[]         // table names referenced in FROM/JOIN
  cteNames: string[]                 // CTE names from WITH ... AS (...)
}
