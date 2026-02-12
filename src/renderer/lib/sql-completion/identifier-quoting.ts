import type { SqlDialect } from '@/lib/sql-formatter'
import { DatabaseType } from '@/types/connection'

// Reserved words that should be quoted when used as identifiers
const RESERVED_WORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'in', 'like', 'order',
  'group', 'having', 'limit', 'offset', 'join', 'on', 'as', 'set', 'update',
  'insert', 'into', 'delete', 'create', 'alter', 'drop', 'table', 'index',
  'view', 'values', 'default', 'null', 'true', 'false', 'between', 'exists',
  'case', 'when', 'then', 'else', 'end', 'union', 'intersect', 'except',
  'distinct', 'all', 'any', 'some', 'cross', 'full', 'inner', 'left',
  'right', 'outer', 'natural', 'using', 'primary', 'foreign', 'key',
  'references', 'unique', 'check', 'constraint', 'cascade', 'restrict',
  'user', 'role', 'grant', 'revoke', 'column', 'database', 'schema',
  'trigger', 'function', 'procedure', 'begin', 'commit', 'rollback',
  'transaction', 'with', 'recursive', 'window', 'over', 'partition',
  'fetch', 'for', 'do', 'if', 'type', 'desc', 'asc',
])

/**
 * Check whether an identifier name needs quoting.
 * Returns true if the name contains spaces, special characters,
 * starts with a digit, or is a reserved word.
 */
export const needsQuoting = (name: string): boolean => {
  if (!name) return false
  // Starts with a digit
  if (/^\d/.test(name)) return true
  // Contains anything other than letters, digits, underscores
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return true
  // Is a reserved word
  if (RESERVED_WORDS.has(name.toLowerCase())) return true
  return false
}

/**
 * Quote an identifier using the dialect-appropriate quoting style.
 * Only applies quoting when needsQuoting() is true — simple identifiers
 * like `users` are left unquoted.
 *
 * - PostgreSQL/SQLite: "name" (double quotes)
 * - MySQL/MariaDB: `name` (backticks)
 * - ClickHouse: "name" (double quotes)
 */
export const quoteIdentifier = (name: string, dialect: SqlDialect): string => {
  if (!needsQuoting(name)) return name

  switch (dialect) {
    case DatabaseType.PostgreSQL:
    case DatabaseType.SQLite:
    case DatabaseType.DuckDB:
      return `"${name.replace(/"/g, '""')}"`
    case DatabaseType.MySQL:
    case DatabaseType.MariaDB:
      return `\`${name.replace(/`/g, '``')}\``
    case DatabaseType.ClickHouse:
      return `"${name.replace(/"/g, '""')}"`
    default:
      return name
  }
}
