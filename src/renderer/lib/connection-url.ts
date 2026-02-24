import { DatabaseType, DEFAULT_PORTS, SSLMode } from '@/types/connection'

const SUPPORTED_SCHEMES: Set<string> = new Set([
  'postgresql',
  'postgres',
  'mysql',
  'mariadb',
  'mongodb',
  'mongodb+srv',
  'clickhouse',
  'redis',
  'rediss',
  'mssql',
  'sqlserver',
])

export interface ParsedSSLConfig {
  enabled: boolean
  mode: SSLMode
  rejectUnauthorized: boolean
}

export interface ParsedConnectionUrl {
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  sslConfig: ParsedSSLConfig | null
  trustServerCertificate: boolean
}

const parseBooleanParam = (value: string): boolean => {
  return ['true', '1', 'yes'].includes(value.toLowerCase())
}

const POSTGRES_SSL_MODE_MAP: Record<string, SSLMode> = {
  'disable': SSLMode.Disable,
  'allow': SSLMode.Prefer,
  'prefer': SSLMode.Prefer,
  'require': SSLMode.Require,
  'verify-ca': SSLMode.VerifyCA,
  'verify-full': SSLMode.VerifyFull,
}

const MYSQL_SSL_MODE_MAP: Record<string, SSLMode> = {
  'disabled': SSLMode.Disable,
  'preferred': SSLMode.Prefer,
  'required': SSLMode.Require,
  'verify_ca': SSLMode.VerifyCA,
  'verify_identity': SSLMode.VerifyFull,
}

const parsePostgresSSLMode = (value: string): SSLMode | null => {
  return POSTGRES_SSL_MODE_MAP[value.toLowerCase()] ?? null
}

const parseMySQLSSLMode = (value: string): SSLMode | null => {
  return MYSQL_SSL_MODE_MAP[value.toLowerCase()] ?? null
}

const parseSSLFromParams = (
  type: DatabaseType,
  scheme: string,
  params: URLSearchParams
): { ssl: boolean; sslConfig: ParsedSSLConfig | null; trustServerCertificate: boolean } => {
  let ssl = false
  let sslConfig: ParsedSSLConfig | null = null
  let trustServerCertificate = false

  if (type === DatabaseType.PostgreSQL) {
    const sslmode = params.get('sslmode')
    if (sslmode) {
      const mode = parsePostgresSSLMode(sslmode)
      if (mode !== null) {
        ssl = mode !== SSLMode.Disable
        sslConfig = {
          enabled: ssl,
          mode,
          rejectUnauthorized: mode === SSLMode.VerifyCA || mode === SSLMode.VerifyFull,
        }
      }
    }
  } else if (type === DatabaseType.MySQL || type === DatabaseType.MariaDB) {
    const sslMode = params.get('ssl-mode')
    const sslParam = params.get('ssl')
    if (sslMode) {
      const mode = parseMySQLSSLMode(sslMode)
      if (mode !== null) {
        ssl = mode !== SSLMode.Disable
        sslConfig = {
          enabled: ssl,
          mode,
          rejectUnauthorized: mode === SSLMode.VerifyCA || mode === SSLMode.VerifyFull,
        }
      }
    } else if (sslParam) {
      const enabled = parseBooleanParam(sslParam)
      ssl = enabled
      sslConfig = {
        enabled,
        mode: enabled ? SSLMode.Require : SSLMode.Disable,
        rejectUnauthorized: false,
      }
    }
  } else if (type === DatabaseType.MongoDB) {
    const tlsParam = params.get('tls')
    const sslParam = params.get('ssl')
    const tlsValue = tlsParam ?? sslParam
    if (tlsValue) {
      const enabled = parseBooleanParam(tlsValue)
      ssl = enabled
      const tlsAllowInvalid = params.get('tlsAllowInvalidCertificates')
      const rejectUnauthorized = tlsAllowInvalid ? !parseBooleanParam(tlsAllowInvalid) : true
      sslConfig = {
        enabled,
        mode: enabled ? SSLMode.Require : SSLMode.Disable,
        rejectUnauthorized,
      }
    }
  } else if (type === DatabaseType.Redis) {
    if (scheme === 'rediss') {
      ssl = true
      sslConfig = {
        enabled: true,
        mode: SSLMode.Require,
        rejectUnauthorized: true,
      }
    }
  } else if (type === DatabaseType.ClickHouse) {
    const secure = params.get('secure')
    if (secure) {
      const enabled = parseBooleanParam(secure)
      ssl = enabled
      sslConfig = {
        enabled,
        mode: enabled ? SSLMode.Require : SSLMode.Disable,
        rejectUnauthorized: false,
      }
    }
  } else if (type === DatabaseType.SQLServer) {
    const encrypt = params.get('encrypt')
    if (encrypt) {
      const enabled = parseBooleanParam(encrypt)
      ssl = enabled
      sslConfig = {
        enabled,
        mode: enabled ? SSLMode.Require : SSLMode.Disable,
        rejectUnauthorized: false,
      }
    }
    const tsc = params.get('trustServerCertificate')
    if (tsc) {
      trustServerCertificate = parseBooleanParam(tsc)
    }
  }

  // Generic fallback: if no DB-specific SSL was detected, check for sslmode param
  if (!sslConfig && params.has('sslmode') && type !== DatabaseType.PostgreSQL) {
    const sslmode = params.get('sslmode')!
    const mode = parsePostgresSSLMode(sslmode)
    if (mode !== null) {
      ssl = mode !== SSLMode.Disable
      sslConfig = {
        enabled: ssl,
        mode,
        rejectUnauthorized: mode === SSLMode.VerifyCA || mode === SSLMode.VerifyFull,
      }
    }
  }

  return { ssl, sslConfig, trustServerCertificate }
}

export const parseConnectionUrl = (url: string): ParsedConnectionUrl => {
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

  const type: DatabaseType = scheme === 'mongodb+srv'
    ? DatabaseType.MongoDB
    : scheme === 'mssql' || scheme === 'sqlserver'
      ? DatabaseType.SQLServer
      : scheme === 'postgres'
        ? DatabaseType.PostgreSQL
        : scheme === 'rediss'
          ? DatabaseType.Redis
          : (scheme as DatabaseType)

  const { ssl, sslConfig, trustServerCertificate } = parseSSLFromParams(type, scheme, parsed.searchParams)

  // For MongoDB, store the raw URL as the database field
  if (type === DatabaseType.MongoDB) {
    return {
      type,
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : DEFAULT_PORTS[DatabaseType.MongoDB],
      database: trimmed,
      username: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      ssl,
      sslConfig,
      trustServerCertificate,
    }
  }

  const host = parsed.hostname || 'localhost'
  const port = parsed.port ? Number(parsed.port) : DEFAULT_PORTS[type]
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const username = decodeURIComponent(parsed.username || '')
  const password = decodeURIComponent(parsed.password || '')

  return { type, host, port, database, username, password, ssl, sslConfig, trustServerCertificate }
}
