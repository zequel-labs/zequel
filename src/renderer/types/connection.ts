export enum DatabaseType {
  SQLite = 'sqlite',
  MySQL = 'mysql',
  PostgreSQL = 'postgresql',
  MariaDB = 'mariadb',
  ClickHouse = 'clickhouse',
  MongoDB = 'mongodb',
  Redis = 'redis',
}

export type ConnectionEnvironment = 'production' | 'staging' | 'development' | 'testing' | 'local'

export enum SSLMode {
  Disable = 'disable',
  Prefer = 'prefer',
  Require = 'require',
  VerifyCA = 'verify-ca',
  VerifyFull = 'verify-full'
}

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
  sslConfig?: any
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

export enum ConnectionStatus {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error'
}

export interface ConnectionState {
  id: string
  status: ConnectionStatus
  error?: string
  reconnectAttempt?: number
}

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  [DatabaseType.SQLite]: 0,
  [DatabaseType.MySQL]: 3306,
  [DatabaseType.MariaDB]: 3306,
  [DatabaseType.PostgreSQL]: 5432,
  [DatabaseType.ClickHouse]: 8123,
  [DatabaseType.MongoDB]: 27017,
  [DatabaseType.Redis]: 6379,
}
