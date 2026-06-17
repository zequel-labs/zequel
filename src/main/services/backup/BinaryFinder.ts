import { execSync, execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { settingsService } from '@main/services/settings'
import { DatabaseType, type BackupBinaryInfo } from '@main/types'

export const BACKUP_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'pg_dump' },
  [DatabaseType.MySQL]: { primary: 'mysqldump' },
  [DatabaseType.MariaDB]: { primary: 'mariadb-dump', fallback: 'mysqldump' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.DuckDB]: { primary: 'duckdb' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongodump' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
  [DatabaseType.SQLServer]: { primary: 'sqlcmd' },
}

export const RESTORE_BINARY_MAP: Record<string, { primary: string; fallback?: string }> = {
  [DatabaseType.PostgreSQL]: { primary: 'psql' },
  [DatabaseType.MySQL]: { primary: 'mysql' },
  [DatabaseType.MariaDB]: { primary: 'mariadb', fallback: 'mysql' },
  [DatabaseType.SQLite]: { primary: 'sqlite3' },
  [DatabaseType.DuckDB]: { primary: 'duckdb' },
  [DatabaseType.ClickHouse]: { primary: 'clickhouse-client', fallback: 'clickhouse' },
  [DatabaseType.MongoDB]: { primary: 'mongorestore' },
  [DatabaseType.Redis]: { primary: 'redis-cli' },
  [DatabaseType.SQLServer]: { primary: 'sqlcmd' },
}

export const getSearchDirs = (): string[] => {
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA'] || 'C:\\Users\\Default\\AppData\\Local'
    return [
      'C:\\Program Files\\PostgreSQL\\17\\bin',
      'C:\\Program Files\\PostgreSQL\\16\\bin',
      'C:\\Program Files\\PostgreSQL\\15\\bin',
      'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin',
      'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin',
      'C:\\Program Files\\MariaDB 11.4\\bin',
      'C:\\Program Files\\MariaDB 10.11\\bin',
      'C:\\Program Files\\MongoDB\\Server\\8.0\\bin',
      'C:\\Program Files\\MongoDB\\Server\\7.0\\bin',
      'C:\\Program Files\\Redis\\',
      'C:\\tools\\',
      join(localAppData, 'Programs'),
      'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn',
      'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\180\\Tools\\Binn',
    ]
  }

  // macOS + Linux paths (macOS-specific like Homebrew/Herd are harmlessly skipped on Linux)
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    // Linux distribution-specific paths
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/lib/postgresql/15/bin',
    '/usr/share/clickhouse/bin',
    '/opt/homebrew/opt/postgresql/bin',
    '/opt/homebrew/opt/mysql/bin',
    '/opt/homebrew/opt/mysql-client@8.0/bin',
    '/opt/homebrew/opt/mysql-client@8.4/bin',
    '/opt/homebrew/opt/mysql-client/bin',
    '/opt/homebrew/opt/mariadb/bin',
    '/opt/homebrew/opt/sqlite/bin',
    '/opt/homebrew/opt/clickhouse/bin',
    '/opt/homebrew/opt/mongosh/bin',
    '/opt/homebrew/opt/redis/bin',
    '/Applications/Postgres.app/Contents/Versions/latest/bin',
    '/usr/local/opt/postgresql/bin',
    '/usr/local/opt/mysql/bin',
    '/usr/local/opt/mysql-client@8.0/bin',
    '/usr/local/opt/mariadb/bin',
    '/usr/local/opt/redis/bin',
    '/Applications/Herd.app/Contents/Resources/mysql/bin',
    '/Users/Shared/Herd/services/mysql/8.0/bin',
    '/Users/Shared/Herd/services/mysql/8.4/bin',
    '/Users/Shared/Herd/services/mysql/9.0/bin',
    '/Users/Shared/Herd/services/mysql/9.4/bin',
    '/Users/Shared/Herd/services/postgresql/18/bin',
    '/Users/Shared/Herd/services/postgresql/17/bin',
    '/Users/Shared/Herd/services/postgresql/16/bin',
    '/opt/mssql-tools18/bin',
    '/opt/mssql-tools/bin',
  ]
}

/** Extract the major version number from a binary's --version output. */
export const detectBinaryVersion = (binaryPath: string): string | null => {
  try {
    // Use execFileSync to avoid shell interpretation of special characters in binary paths
    const output = execFileSync(binaryPath, ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim()
    // Match patterns like "mysqldump  Ver 9.4.0" or "pg_dump (PostgreSQL) 16.2"
    const match = output.match(/(\d+\.\d+(?:\.\d+)?)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

/** MySQL-specific: check if binary version is 9.x+ and warn about mysql_native_password removal. */
export const getMysqlVersionWarning = (version: string | null): string | null => {
  if (!version) return null
  const major = parseInt(version.split('.')[0], 10)
  if (major >= 9) {
    const installHint = process.platform === 'win32'
      ? 'Install MySQL 8.x from https://dev.mysql.com/downloads/'
      : 'brew install mysql-client@8.0'
    return `mysqldump ${version} does not support mysql_native_password authentication (removed in MySQL 9.0). If your server uses this auth plugin, use mysqldump 8.x instead (${installHint}).`
  }
  return null
}

export const findBinary = (
  binaryMap: Record<string, { primary: string; fallback?: string }>,
  dbType: DatabaseType,
  settingsKeyPrefix: string
): BackupBinaryInfo => {
  const notFound: BackupBinaryInfo = { path: null, found: false, version: null, warning: null }

  // 1. Check saved path from settings
  const savedPath = settingsService.get(`${settingsKeyPrefix}${dbType}`)
  if (savedPath && existsSync(savedPath)) {
    const version = detectBinaryVersion(savedPath)
    // Only MySQL (not MariaDB) removed mysql_native_password in 9.0
    const warning = dbType === DatabaseType.MySQL ? getMysqlVersionWarning(version) : null
    return { path: savedPath, found: true, version, warning }
  }

  const mapping = binaryMap[dbType]
  if (!mapping) {
    return notFound
  }

  const binaries = [mapping.primary]
  if (mapping.fallback) binaries.push(mapping.fallback)

  const isMysql = dbType === DatabaseType.MySQL
  const ext = process.platform === 'win32' ? '.exe' : ''
  const searchDirs = getSearchDirs()

  for (const binary of binaries) {
    // 2. Scan common directories
    for (const dir of searchDirs) {
      const fullPath = join(dir, binary + ext)
      if (existsSync(fullPath)) {
        const version = detectBinaryVersion(fullPath)
        const warning = isMysql ? getMysqlVersionWarning(version) : null
        return { path: fullPath, found: true, version, warning }
      }
    }

    // 3. Fallback: which (Unix) / where (Windows)
    try {
      const cmd = process.platform === 'win32' ? `where ${binary}` : `which ${binary}`
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
      // `where` on Windows returns multiple lines — take the first match
      const result = output.split(/\r?\n/)[0].trim()
      if (result && existsSync(result)) {
        const version = detectBinaryVersion(result)
        const warning = isMysql ? getMysqlVersionWarning(version) : null
        return { path: result, found: true, version, warning }
      }
    } catch {
      // not found
    }
  }

  return notFound
}
