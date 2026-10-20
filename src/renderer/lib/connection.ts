import { DatabaseType } from '@/types/connection'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import { generateId } from '@/lib/utils'

export const getEnvironmentTextClass = (env: string): string => {
  switch (env) {
    case 'production': return 'text-destructive'
    case 'staging': return 'text-orange-500'
    case 'development': return 'text-blue-500'
    case 'testing': return 'text-violet-500'
    case 'local': return 'text-emerald-500'
    default: return 'text-muted-foreground'
  }
}

/** Tinted pill for an environment label, as in TablePlus's connection lists. */
export const getEnvironmentBadgeClass = (env: string): string => {
  switch (env) {
    case 'production': return 'bg-red-500/15 text-red-600 dark:text-red-400'
    case 'staging': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
    case 'development': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
    case 'testing': return 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
    case 'local': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

const DATABASE_AVATARS: Record<DatabaseType, { name: string; label: string; className: string }> = {
  [DatabaseType.PostgreSQL]: { name: 'PostgreSQL', label: 'Pg', className: 'bg-[#3a7bd5] text-white' },
  [DatabaseType.MySQL]: { name: 'MySQL', label: 'Ms', className: 'bg-[#e8912d] text-white' },
  [DatabaseType.MariaDB]: { name: 'MariaDB', label: 'Ma', className: 'bg-[#b46a4b] text-white' },
  [DatabaseType.SQLite]: { name: 'SQLite', label: 'Sl', className: 'bg-[#2c8ad0] text-white' },
  [DatabaseType.DuckDB]: { name: 'DuckDB', label: 'Dk', className: 'bg-[#f2c94c] text-neutral-900' },
  [DatabaseType.ClickHouse]: { name: 'ClickHouse', label: 'Ch', className: 'bg-[#d6b33a] text-white' },
  [DatabaseType.MongoDB]: { name: 'MongoDB', label: 'Mg', className: 'bg-[#2f9e5b] text-white' },
  [DatabaseType.Redis]: { name: 'Redis', label: 'Re', className: 'bg-[#a3271b] text-white' },
  [DatabaseType.SQLServer]: { name: 'SQL Server', label: 'Ss', className: 'bg-[#b8323b] text-white' },
}

/** Two-letter, colored avatar for a database engine. */
export const getDatabaseAvatar = (type: DatabaseType): { name: string; label: string; className: string } =>
  DATABASE_AVATARS[type] ?? { name: type, label: '?', className: 'bg-muted text-muted-foreground' }

export const getConnectionSubtitle = (connection: SavedConnection): string => {
  if ((connection.type === DatabaseType.SQLite || connection.type === DatabaseType.DuckDB) && connection.filepath) {
    return connection.filepath.split('/').pop() || connection.filepath
  }
  if (connection.type === DatabaseType.MongoDB && connection.database?.startsWith('mongodb')) {
    return connection.database
  }

  const parts: string[] = []

  if (connection.ssh?.enabled) {
    parts.push('SSH')
  } else {
    const host = connection.host || 'localhost'
    parts.push(connection.port ? `${host}:${connection.port}` : host)
  }

  if (connection.database) {
    parts.push(connection.database)
  }

  return parts.join(' \u00B7 ')
}

export const buildDuplicateConnectionConfig = (conn: SavedConnection): ConnectionConfig => ({
  id: generateId(),
  name: `${conn.name} (copy)`,
  type: conn.type,
  database: conn.database ?? '',
  host: conn.host ?? undefined,
  port: conn.port ?? undefined,
  username: conn.username ?? undefined,
  filepath: conn.filepath ?? undefined,
  ssl: conn.ssl,
  sslConfig: conn.sslConfig ?? undefined,
  ssh: conn.ssh ?? undefined,
  color: conn.color ?? undefined,
  environment: conn.environment ?? undefined,
  folder: conn.folder ?? undefined,
  trustServerCertificate: conn.trustServerCertificate ?? undefined,
})
