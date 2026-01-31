import { DatabaseType } from '@/types/connection'
import type { SavedConnection } from '@/types/connection'

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
  if (connection.type === DatabaseType.SQLite && connection.filepath) {
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
