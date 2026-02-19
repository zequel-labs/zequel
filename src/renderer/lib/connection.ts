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
