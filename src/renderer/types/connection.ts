export type DatabaseType = 'sqlite' | 'mysql' | 'postgresql' | 'mariadb' | 'clickhouse' | 'mongodb' | 'redis'

export type ConnectionEnvironment = 'production' | 'staging' | 'development' | 'testing' | 'local'

export interface SSHConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  authMethod: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  privateKeyPassphrase?: string
}

export interface ConnectionConfig {
  id: string
  name: string
  type: DatabaseType
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
  ssh?: SSHConfig
  filepath?: string
  color?: string
  environment?: ConnectionEnvironment
  folder?: string
}

export interface SavedConnection {
  id: string
  name: string
  type: DatabaseType
  host: string | null
  port: number | null
  database: string
  username: string | null
  filepath: string | null
  ssl: boolean
  sslConfig?: any | null
  ssh: SSHConfig | null
  color?: string | null
  environment?: ConnectionEnvironment | null
  folder?: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  lastConnectedAt: string | null
}

export interface ConnectionState {
  id: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  error?: string
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  sqlite: 0,
  mysql: 3306,
  mariadb: 3306,
  postgresql: 5432,
  clickhouse: 8123,
  mongodb: 27017,
  redis: 6379
}
