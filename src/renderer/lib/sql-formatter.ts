import { format, type SqlLanguage } from 'sql-formatter'
import { DatabaseType } from '@/types/connection'

export type SqlDialect = 'postgresql' | 'mysql' | 'sqlite' | 'mariadb'

interface FormatOptions {
  dialect?: SqlDialect
  tabWidth?: number
  useTabs?: boolean
  keywordCase?: 'upper' | 'lower' | 'preserve'
  indentStyle?: 'standard' | 'tabularLeft' | 'tabularRight'
  logicalOperatorNewline?: 'before' | 'after'
  expressionWidth?: number
}

const dialectMap: Record<SqlDialect, SqlLanguage> = {
  [DatabaseType.PostgreSQL]: 'postgresql',
  [DatabaseType.MySQL]: 'mysql',
  [DatabaseType.MariaDB]: 'mariadb',
  [DatabaseType.SQLite]: 'sqlite'
}

export const formatSql = (sql: string, options: FormatOptions = {}): string => {
  const {
    dialect = DatabaseType.PostgreSQL,
    tabWidth = 2,
    useTabs = false,
    keywordCase = 'upper',
    indentStyle = 'standard',
    logicalOperatorNewline = 'before',
    expressionWidth = 50
  } = options

  try {
    return format(sql, {
      language: dialectMap[dialect] ?? ('sql' as SqlLanguage),
      tabWidth,
      useTabs,
      keywordCase,
      indentStyle,
      logicalOperatorNewline,
      expressionWidth
    })
  } catch (error) {
    // If formatting fails, return original SQL
    console.error('SQL formatting failed:', error)
    return sql
  }
}

export const minifySql = (sql: string): string => {
  // Remove comments
  let result = sql
    .replace(/--.*$/gm, '') // Single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments

  // Collapse whitespace
  result = result
    .replace(/\s+/g, ' ')
    .trim()

  return result
}
