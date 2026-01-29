export interface SqlSnippet {
  id: string
  name: string
  prefix: string
  body: string
  description?: string
  dialect?: 'all' | 'postgresql' | 'mysql' | 'sqlite' | 'mariadb'
  category: 'select' | 'insert' | 'update' | 'delete' | 'create' | 'alter' | 'join' | 'function' | 'custom'
  isBuiltin?: boolean
}

// Built-in SQL snippets
export const BUILTIN_SNIPPETS: SqlSnippet[] = [
  // SELECT snippets
  {
    id: 'select-all',
    name: 'Select All',
    prefix: 'sel',
    body: 'SELECT * FROM ${1:table_name};',
    description: 'Select all columns from a table',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-columns',
    name: 'Select Columns',
    prefix: 'selc',
    body: 'SELECT ${1:column1}, ${2:column2}\nFROM ${3:table_name}\nWHERE ${4:condition};',
    description: 'Select specific columns with WHERE clause',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-top',
    name: 'Select Top N',
    prefix: 'selt',
    body: 'SELECT * FROM ${1:table_name}\nORDER BY ${2:column}\nLIMIT ${3:10};',
    description: 'Select top N rows',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-count',
    name: 'Select Count',
    prefix: 'selcount',
    body: 'SELECT COUNT(*) AS total FROM ${1:table_name}\nWHERE ${2:condition};',
    description: 'Count rows in a table',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-distinct',
    name: 'Select Distinct',
    prefix: 'seld',
    body: 'SELECT DISTINCT ${1:column}\nFROM ${2:table_name}\nORDER BY ${1:column};',
    description: 'Select distinct values',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-group',
    name: 'Select with Group By',
    prefix: 'selg',
    body: 'SELECT ${1:column}, COUNT(*) AS count\nFROM ${2:table_name}\nGROUP BY ${1:column}\nHAVING COUNT(*) > ${3:1}\nORDER BY count DESC;',
    description: 'Select with GROUP BY and HAVING',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-case',
    name: 'Select with CASE',
    prefix: 'selcase',
    body: 'SELECT ${1:column},\n  CASE\n    WHEN ${2:condition1} THEN ${3:result1}\n    WHEN ${4:condition2} THEN ${5:result2}\n    ELSE ${6:default}\n  END AS ${7:alias}\nFROM ${8:table_name};',
    description: 'Select with CASE statement',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },
  {
    id: 'select-subquery',
    name: 'Select with Subquery',
    prefix: 'selsub',
    body: 'SELECT *\nFROM ${1:table_name}\nWHERE ${2:column} IN (\n  SELECT ${2:column}\n  FROM ${3:other_table}\n  WHERE ${4:condition}\n);',
    description: 'Select with subquery in WHERE',
    dialect: 'all',
    category: 'select',
    isBuiltin: true
  },

  // JOIN snippets
  {
    id: 'inner-join',
    name: 'Inner Join',
    prefix: 'ij',
    body: 'SELECT ${1:a}.*, ${2:b}.*\nFROM ${3:table1} ${1:a}\nINNER JOIN ${4:table2} ${2:b} ON ${1:a}.${5:id} = ${2:b}.${6:foreign_id};',
    description: 'Inner join two tables',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },
  {
    id: 'left-join',
    name: 'Left Join',
    prefix: 'lj',
    body: 'SELECT ${1:a}.*, ${2:b}.*\nFROM ${3:table1} ${1:a}\nLEFT JOIN ${4:table2} ${2:b} ON ${1:a}.${5:id} = ${2:b}.${6:foreign_id};',
    description: 'Left join two tables',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },
  {
    id: 'right-join',
    name: 'Right Join',
    prefix: 'rj',
    body: 'SELECT ${1:a}.*, ${2:b}.*\nFROM ${3:table1} ${1:a}\nRIGHT JOIN ${4:table2} ${2:b} ON ${1:a}.${5:id} = ${2:b}.${6:foreign_id};',
    description: 'Right join two tables',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },
  {
    id: 'full-join',
    name: 'Full Outer Join',
    prefix: 'fj',
    body: 'SELECT ${1:a}.*, ${2:b}.*\nFROM ${3:table1} ${1:a}\nFULL OUTER JOIN ${4:table2} ${2:b} ON ${1:a}.${5:id} = ${2:b}.${6:foreign_id};',
    description: 'Full outer join two tables',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },
  {
    id: 'cross-join',
    name: 'Cross Join',
    prefix: 'cj',
    body: 'SELECT ${1:a}.*, ${2:b}.*\nFROM ${3:table1} ${1:a}\nCROSS JOIN ${4:table2} ${2:b};',
    description: 'Cross join two tables',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },
  {
    id: 'self-join',
    name: 'Self Join',
    prefix: 'sj',
    body: 'SELECT ${1:a}.${2:column1}, ${3:b}.${4:column2}\nFROM ${5:table_name} ${1:a}\nINNER JOIN ${5:table_name} ${3:b} ON ${1:a}.${6:id} = ${3:b}.${7:parent_id};',
    description: 'Self join a table',
    dialect: 'all',
    category: 'join',
    isBuiltin: true
  },

  // INSERT snippets
  {
    id: 'insert-single',
    name: 'Insert Single Row',
    prefix: 'ins',
    body: 'INSERT INTO ${1:table_name} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2});',
    description: 'Insert a single row',
    dialect: 'all',
    category: 'insert',
    isBuiltin: true
  },
  {
    id: 'insert-multiple',
    name: 'Insert Multiple Rows',
    prefix: 'insm',
    body: 'INSERT INTO ${1:table_name} (${2:column1}, ${3:column2})\nVALUES\n  (${4:value1}, ${5:value2}),\n  (${6:value3}, ${7:value4});',
    description: 'Insert multiple rows',
    dialect: 'all',
    category: 'insert',
    isBuiltin: true
  },
  {
    id: 'insert-select',
    name: 'Insert from Select',
    prefix: 'inss',
    body: 'INSERT INTO ${1:target_table} (${2:column1}, ${3:column2})\nSELECT ${4:source_col1}, ${5:source_col2}\nFROM ${6:source_table}\nWHERE ${7:condition};',
    description: 'Insert from a SELECT query',
    dialect: 'all',
    category: 'insert',
    isBuiltin: true
  },

  // UPDATE snippets
  {
    id: 'update-simple',
    name: 'Update Simple',
    prefix: 'upd',
    body: 'UPDATE ${1:table_name}\nSET ${2:column1} = ${3:value1}\nWHERE ${4:condition};',
    description: 'Update rows in a table',
    dialect: 'all',
    category: 'update',
    isBuiltin: true
  },
  {
    id: 'update-multiple',
    name: 'Update Multiple Columns',
    prefix: 'updm',
    body: 'UPDATE ${1:table_name}\nSET\n  ${2:column1} = ${3:value1},\n  ${4:column2} = ${5:value2}\nWHERE ${6:condition};',
    description: 'Update multiple columns',
    dialect: 'all',
    category: 'update',
    isBuiltin: true
  },

  // DELETE snippets
  {
    id: 'delete-simple',
    name: 'Delete Simple',
    prefix: 'del',
    body: 'DELETE FROM ${1:table_name}\nWHERE ${2:condition};',
    description: 'Delete rows from a table',
    dialect: 'all',
    category: 'delete',
    isBuiltin: true
  },
  {
    id: 'delete-all',
    name: 'Delete All (Truncate)',
    prefix: 'trunc',
    body: 'TRUNCATE TABLE ${1:table_name};',
    description: 'Delete all rows (truncate)',
    dialect: 'all',
    category: 'delete',
    isBuiltin: true
  },

  // CREATE snippets
  {
    id: 'create-table',
    name: 'Create Table',
    prefix: 'ct',
    body: 'CREATE TABLE ${1:table_name} (\n  id ${2:SERIAL} PRIMARY KEY,\n  ${3:column1} ${4:VARCHAR(255)} NOT NULL,\n  ${5:column2} ${6:INTEGER},\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);',
    description: 'Create a new table',
    dialect: 'all',
    category: 'create',
    isBuiltin: true
  },
  {
    id: 'create-index',
    name: 'Create Index',
    prefix: 'ci',
    body: 'CREATE INDEX ${1:idx_name} ON ${2:table_name} (${3:column1}, ${4:column2});',
    description: 'Create an index',
    dialect: 'all',
    category: 'create',
    isBuiltin: true
  },
  {
    id: 'create-unique-index',
    name: 'Create Unique Index',
    prefix: 'cui',
    body: 'CREATE UNIQUE INDEX ${1:idx_name} ON ${2:table_name} (${3:column});',
    description: 'Create a unique index',
    dialect: 'all',
    category: 'create',
    isBuiltin: true
  },
  {
    id: 'create-view',
    name: 'Create View',
    prefix: 'cv',
    body: 'CREATE VIEW ${1:view_name} AS\nSELECT ${2:columns}\nFROM ${3:table_name}\nWHERE ${4:condition};',
    description: 'Create a view',
    dialect: 'all',
    category: 'create',
    isBuiltin: true
  },

  // ALTER snippets
  {
    id: 'alter-add-column',
    name: 'Alter Add Column',
    prefix: 'aac',
    body: 'ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:VARCHAR(255)} ${4:NOT NULL};',
    description: 'Add a column to a table',
    dialect: 'all',
    category: 'alter',
    isBuiltin: true
  },
  {
    id: 'alter-drop-column',
    name: 'Alter Drop Column',
    prefix: 'adc',
    body: 'ALTER TABLE ${1:table_name}\nDROP COLUMN ${2:column_name};',
    description: 'Drop a column from a table',
    dialect: 'all',
    category: 'alter',
    isBuiltin: true
  },
  {
    id: 'alter-rename-column',
    name: 'Alter Rename Column',
    prefix: 'arc',
    body: 'ALTER TABLE ${1:table_name}\nRENAME COLUMN ${2:old_name} TO ${3:new_name};',
    description: 'Rename a column',
    dialect: 'all',
    category: 'alter',
    isBuiltin: true
  },
  {
    id: 'alter-add-fk',
    name: 'Alter Add Foreign Key',
    prefix: 'aafk',
    body: 'ALTER TABLE ${1:table_name}\nADD CONSTRAINT ${2:fk_name}\nFOREIGN KEY (${3:column})\nREFERENCES ${4:ref_table} (${5:ref_column})\nON DELETE ${6:CASCADE};',
    description: 'Add a foreign key constraint',
    dialect: 'all',
    category: 'alter',
    isBuiltin: true
  },

  // Function snippets
  {
    id: 'coalesce',
    name: 'COALESCE',
    prefix: 'coal',
    body: 'COALESCE(${1:column}, ${2:default_value})',
    description: 'Return first non-null value',
    dialect: 'all',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'concat',
    name: 'CONCAT',
    prefix: 'conc',
    body: 'CONCAT(${1:value1}, ${2:value2})',
    description: 'Concatenate strings',
    dialect: 'all',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'date-format',
    name: 'Date Format',
    prefix: 'dformat',
    body: "TO_CHAR(${1:date_column}, '${2:YYYY-MM-DD}')",
    description: 'Format date (PostgreSQL)',
    dialect: 'postgresql',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'date-format-mysql',
    name: 'Date Format MySQL',
    prefix: 'dformat',
    body: "DATE_FORMAT(${1:date_column}, '${2:%Y-%m-%d}')",
    description: 'Format date (MySQL)',
    dialect: 'mysql',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'substring',
    name: 'SUBSTRING',
    prefix: 'substr',
    body: 'SUBSTRING(${1:column}, ${2:start}, ${3:length})',
    description: 'Extract substring',
    dialect: 'all',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'cast',
    name: 'CAST',
    prefix: 'cast',
    body: 'CAST(${1:value} AS ${2:type})',
    description: 'Cast value to type',
    dialect: 'all',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'json-extract-pg',
    name: 'JSON Extract (PostgreSQL)',
    prefix: 'jext',
    body: "${1:json_column}->>'${2:key}'",
    description: 'Extract JSON value (PostgreSQL)',
    dialect: 'postgresql',
    category: 'function',
    isBuiltin: true
  },
  {
    id: 'json-extract-mysql',
    name: 'JSON Extract (MySQL)',
    prefix: 'jext',
    body: "JSON_EXTRACT(${1:json_column}, '$.${2:key}')",
    description: 'Extract JSON value (MySQL)',
    dialect: 'mysql',
    category: 'function',
    isBuiltin: true
  }
]

/**
 * Get all snippets filtered by dialect
 */
export function getSnippetsForDialect(
  dialect: 'postgresql' | 'mysql' | 'sqlite' | 'mariadb',
  customSnippets: SqlSnippet[] = []
): SqlSnippet[] {
  const builtinForDialect = BUILTIN_SNIPPETS.filter(
    (s) => s.dialect === 'all' || s.dialect === dialect
  )

  const customForDialect = customSnippets.filter(
    (s) => s.dialect === 'all' || s.dialect === dialect
  )

  return [...builtinForDialect, ...customForDialect]
}

/**
 * Convert snippet body to Monaco snippet format
 * ${1:placeholder} is already Monaco format
 */
export function toMonacoSnippet(snippet: SqlSnippet): string {
  return snippet.body
}

/**
 * Get snippet categories
 */
export function getSnippetCategories(): Array<{ value: SqlSnippet['category']; label: string }> {
  return [
    { value: 'select', label: 'SELECT' },
    { value: 'insert', label: 'INSERT' },
    { value: 'update', label: 'UPDATE' },
    { value: 'delete', label: 'DELETE' },
    { value: 'create', label: 'CREATE' },
    { value: 'alter', label: 'ALTER' },
    { value: 'join', label: 'JOIN' },
    { value: 'function', label: 'Functions' },
    { value: 'custom', label: 'Custom' }
  ]
}
