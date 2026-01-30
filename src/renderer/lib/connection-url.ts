import type { DatabaseType } from '@/types/connection'
import { DEFAULT_PORTS } from '@/types/connection'

const SUPPORTED_SCHEMES: Set<string> = new Set([
  'postgresql',
  'mysql',
  'mariadb',
  'mongodb',
  'mongodb+srv',
  'clickhouse',
  'redis',
])

export interface ParsedConnectionUrl {
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
}

export function parseConnectionUrl(url: string): ParsedConnectionUrl {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error('URL is empty')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Invalid URL format')
  }

  const scheme = parsed.protocol.replace(/:$/, '')

  if (!SUPPORTED_SCHEMES.has(scheme)) {
    throw new Error(`Unsupported scheme "${scheme}". Supported: ${[...SUPPORTED_SCHEMES].join(', ')}`)
  }

  const type: DatabaseType = scheme === 'mongodb+srv' ? 'mongodb' : (scheme as DatabaseType)

  // For MongoDB, store the raw URL as the database field
  if (type === 'mongodb') {
    return {
      type,
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : DEFAULT_PORTS.mongodb,
      database: trimmed,
      username: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
    }
  }

  const host = parsed.hostname || 'localhost'
  const port = parsed.port ? Number(parsed.port) : DEFAULT_PORTS[type]
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const username = decodeURIComponent(parsed.username || '')
  const password = decodeURIComponent(parsed.password || '')

  return { type, host, port, database, username, password }
}
