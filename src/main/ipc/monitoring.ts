import { ipcMain } from 'electron'
import { connectionManager } from '@main/db/manager'
import { DatabaseType } from '@main/types'
import type { DatabaseProcess, ServerStatus } from '@main/types'
import type { MySQLDriver } from '@main/db/mysql'
import type { PostgreSQLDriver } from '@main/db/postgres'
import type { SQLiteDriver } from '@main/db/sqlite'
import type { ClickHouseDriver } from '@main/db/clickhouse'
import type { MongoDBDriver } from '@main/db/mongodb'
import type { RedisDriver } from '@main/db/redis'
import type { DuckDBDriver } from '@main/db/duckdb'
import type { SQLServerDriver } from '@main/db/sqlserver'

export const registerMonitoringHandlers = (): void => {
  // Get process list (active connections/queries)
  ipcMain.handle(
    'monitoring:getProcessList',
    async (_, connectionId: string): Promise<DatabaseProcess[]> => {
      const driver = connectionManager.getConnection(connectionId)
      if (!driver) {
        throw new Error('Connection not found')
      }

      if (driver.type === DatabaseType.MySQL || driver.type === DatabaseType.MariaDB) {
        return getMySQLProcessList(driver as MySQLDriver)
      } else if (driver.type === DatabaseType.PostgreSQL) {
        return getPostgreSQLProcessList(driver as PostgreSQLDriver)
      } else if (driver.type === DatabaseType.ClickHouse) {
        return getClickHouseProcessList(driver as ClickHouseDriver)
      } else if (driver.type === DatabaseType.MongoDB) {
        return getMongoDBProcessList(driver as MongoDBDriver)
      } else if (driver.type === DatabaseType.Redis) {
        return getRedisProcessList(driver as RedisDriver)
      } else if (driver.type === DatabaseType.SQLite) {
        // SQLite is single-connection, return empty
        return []
      } else if (driver.type === DatabaseType.DuckDB) {
        // DuckDB is in-process, return empty
        return []
      } else if (driver.type === DatabaseType.SQLServer) {
        return getSQLServerProcessList(driver as SQLServerDriver)
      }

      return []
    }
  )

  // Kill a process/query
  ipcMain.handle(
    'monitoring:killProcess',
    async (_, connectionId: string, processId: number | string, force?: boolean): Promise<{ success: boolean; error?: string }> => {
      const driver = connectionManager.getConnection(connectionId)
      if (!driver) {
        throw new Error('Connection not found')
      }

      if (driver.type === DatabaseType.MySQL || driver.type === DatabaseType.MariaDB) {
        return killMySQLProcess(driver as MySQLDriver, processId as number)
      } else if (driver.type === DatabaseType.PostgreSQL) {
        return killPostgreSQLProcess(driver as PostgreSQLDriver, processId as number, force)
      } else if (driver.type === DatabaseType.ClickHouse) {
        return killClickHouseQuery(driver as ClickHouseDriver, processId as string)
      } else if (driver.type === DatabaseType.MongoDB) {
        return killMongoDBProcess(driver as MongoDBDriver, processId)
      } else if (driver.type === DatabaseType.Redis) {
        return killRedisProcess(driver as RedisDriver, processId)
      } else if (driver.type === DatabaseType.SQLite) {
        return { success: false, error: 'SQLite does not support process management' }
      } else if (driver.type === DatabaseType.DuckDB) {
        return { success: false, error: 'DuckDB does not support process management' }
      } else if (driver.type === DatabaseType.SQLServer) {
        return killSQLServerProcess(driver as SQLServerDriver, processId as number)
      }

      return { success: false, error: 'Unsupported database type' }
    }
  )

  // Get server status/variables
  ipcMain.handle(
    'monitoring:getServerStatus',
    async (_, connectionId: string): Promise<ServerStatus> => {
      const driver = connectionManager.getConnection(connectionId)
      if (!driver) {
        throw new Error('Connection not found')
      }

      if (driver.type === DatabaseType.MySQL || driver.type === DatabaseType.MariaDB) {
        return getMySQLServerStatus(driver as MySQLDriver)
      } else if (driver.type === DatabaseType.PostgreSQL) {
        return getPostgreSQLServerStatus(driver as PostgreSQLDriver)
      } else if (driver.type === DatabaseType.ClickHouse) {
        return getClickHouseServerStatus(driver as ClickHouseDriver)
      } else if (driver.type === DatabaseType.MongoDB) {
        return getMongoDBServerStatus(driver as MongoDBDriver)
      } else if (driver.type === DatabaseType.Redis) {
        return getRedisServerStatus(driver as RedisDriver)
      } else if (driver.type === DatabaseType.SQLite) {
        return getSQLiteServerStatus(driver as SQLiteDriver)
      } else if (driver.type === DatabaseType.DuckDB) {
        return getDuckDBServerStatus(driver as DuckDBDriver)
      } else if (driver.type === DatabaseType.SQLServer) {
        return getSQLServerServerStatus(driver as SQLServerDriver)
      }

      return { variables: {}, status: {} }
    }
  )
}

// MySQL implementation
const getMySQLProcessList = async (driver: MySQLDriver): Promise<DatabaseProcess[]> => {
  const result = await driver.execute('SHOW FULL PROCESSLIST')

  if (result.error) {
    throw new Error(result.error)
  }

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.Id as number,
    user: row.User as string,
    host: row.Host as string,
    database: row.db as string | null,
    command: row.Command as string,
    time: row.Time as number,
    state: row.State as string | null,
    info: row.Info as string | null,
    progress: row.Progress as number | undefined
  }))
}

const killMySQLProcess = async (driver: MySQLDriver, processId: number): Promise<{ success: boolean; error?: string }> => {
  const id = Number(processId)
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: 'Invalid process ID' }
  }
  try {
    await driver.execute(`KILL ${id}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getMySQLServerStatus = async (driver: MySQLDriver): Promise<ServerStatus> => {
  const [variablesResult, statusResult] = await Promise.all([
    driver.execute('SHOW GLOBAL VARIABLES'),
    driver.execute('SHOW GLOBAL STATUS')
  ])

  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  if (!variablesResult.error) {
    for (const row of variablesResult.rows) {
      variables[row.Variable_name as string] = row.Value as string
    }
  }

  if (!statusResult.error) {
    for (const row of statusResult.rows) {
      status[row.Variable_name as string] = row.Value as string
    }
  }

  return { variables, status }
}

// PostgreSQL implementation
const getPostgreSQLProcessList = async (driver: PostgreSQLDriver): Promise<DatabaseProcess[]> => {
  const result = await driver.execute(`
    SELECT
      pid,
      usename as user,
      client_addr as host,
      datname as database,
      state as command,
      EXTRACT(EPOCH FROM (now() - query_start))::integer as time,
      wait_event_type || ': ' || wait_event as state,
      query as info,
      backend_type
    FROM pg_stat_activity
    WHERE pid != pg_backend_pid()
    ORDER BY query_start DESC NULLS LAST
  `)

  if (result.error) {
    throw new Error(result.error)
  }

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.pid as number,
    user: row.user as string,
    host: (row.host as string) || 'local',
    database: row.database as string | null,
    command: row.command as string || 'idle',
    time: row.time as number || 0,
    state: row.state as string | null,
    info: row.info as string | null,
    backendType: row.backend_type as string | undefined
  }))
}

const killPostgreSQLProcess = async (
  driver: PostgreSQLDriver,
  pid: number,
  force?: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    // pg_terminate_backend = force kill, pg_cancel_backend = graceful cancel
    const fn = force ? 'pg_terminate_backend' : 'pg_cancel_backend'
    const result = await driver.execute(`SELECT ${fn}($1)`, [pid])

    if (result.error) {
      return { success: false, error: result.error }
    }

    const success = result.rows[0]?.[fn] === true
    return {
      success,
      error: success ? undefined : 'Failed to terminate backend'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getPostgreSQLServerStatus = async (driver: PostgreSQLDriver): Promise<ServerStatus> => {
  const [settingsResult, statResult] = await Promise.all([
    driver.execute('SELECT name, setting FROM pg_settings'),
    driver.execute(`
      SELECT
        'connections' as name,
        (SELECT count(*) FROM pg_stat_activity)::text as value
      UNION ALL
      SELECT
        'max_connections' as name,
        (SELECT setting FROM pg_settings WHERE name = 'max_connections') as value
      UNION ALL
      SELECT
        'server_version' as name,
        version() as value
    `)
  ])

  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  if (!settingsResult.error) {
    for (const row of settingsResult.rows) {
      variables[row.name as string] = row.setting as string
    }
  }

  if (!statResult.error) {
    for (const row of statResult.rows) {
      status[row.name as string] = row.value as string
    }
  }

  return { variables, status }
}

// ClickHouse implementation
const getClickHouseProcessList = async (driver: ClickHouseDriver): Promise<DatabaseProcess[]> => {
  const result = await driver.execute(`
    SELECT
      query_id,
      user,
      client_hostname as host,
      current_database as database,
      query_kind as command,
      elapsed as time,
      query as info,
      read_rows,
      memory_usage
    FROM system.processes
    ORDER BY elapsed DESC
  `)

  if (result.error) {
    throw new Error(result.error)
  }

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.query_id as string,
    user: row.user as string,
    host: (row.host as string) || 'local',
    database: row.database as string | null,
    command: (row.command as string) || 'SELECT',
    time: Math.round(row.time as number),
    state: null,
    info: row.info as string | null
  }))
}

const killClickHouseQuery = async (driver: ClickHouseDriver, queryId: string): Promise<{ success: boolean; error?: string }> => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(queryId)) {
    return { success: false, error: 'Invalid query ID format' }
  }
  try {
    const result = await driver.execute(`KILL QUERY WHERE query_id = '${queryId}'`)
    if (result.error) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getClickHouseServerStatus = async (driver: ClickHouseDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  try {
    const settingsResult = await driver.execute('SELECT name, value FROM system.settings WHERE changed = 1 ORDER BY name')
    if (!settingsResult.error) {
      for (const row of settingsResult.rows) {
        variables[row.name as string] = String(row.value)
      }
    }
  } catch {
    // Ignore
  }

  try {
    const metricsResult = await driver.execute(`
      SELECT 'version' as name, version() as value
      UNION ALL
      SELECT 'uptime', toString(uptime())
      UNION ALL
      SELECT 'current_queries', toString((SELECT count() FROM system.processes))
      UNION ALL
      SELECT 'databases', toString((SELECT count() FROM system.databases))
      UNION ALL
      SELECT 'tables', toString((SELECT count() FROM system.tables))
    `)
    if (!metricsResult.error) {
      for (const row of metricsResult.rows) {
        status[row.name as string] = String(row.value)
      }
    }
  } catch {
    // Ignore
  }

  return { variables, status }
}

// MongoDB implementation
const getMongoDBProcessList = async (driver: MongoDBDriver): Promise<DatabaseProcess[]> => {
  const client = driver.getClient()
  const adminDb = client.db('admin')
  const result = await adminDb.command({ currentOp: 1, $all: true })

  return ((result.inprog || []) as Record<string, unknown>[]).map((op) => ({
    id: op.opid != null ? op.opid as number : 0,
    user: typeof op.client === 'string' ? (op.client as string).split(':')[0] : '-',
    host: (op.client as string) || 'local',
    database: typeof op.ns === 'string' ? (op.ns as string).split('.')[0] : null,
    command: (op.op as string) || 'unknown',
    time: (op.secs_running as number) || 0,
    state: (op.desc as string) || null,
    info: op.command ? JSON.stringify(op.command) : null
  }))
}

const killMongoDBProcess = async (driver: MongoDBDriver, opId: number | string): Promise<{ success: boolean; error?: string }> => {
  try {
    const client = driver.getClient()
    const adminDb = client.db('admin')
    await adminDb.command({ killOp: 1, op: opId })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getMongoDBServerStatus = async (driver: MongoDBDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  try {
    const client = driver.getClient()
    const adminDb = client.db('admin')
    const serverStatus = await adminDb.command({ serverStatus: 1 })

    // Variables (configuration-like values)
    if (serverStatus.host) variables['host'] = String(serverStatus.host)
    if (serverStatus.version) variables['version'] = String(serverStatus.version)
    if (serverStatus.process) variables['process'] = String(serverStatus.process)
    if (serverStatus.pid) variables['pid'] = String(serverStatus.pid)
    if (serverStatus.storageEngine?.name) variables['storageEngine'] = String(serverStatus.storageEngine.name)

    // Status (runtime metrics)
    if (serverStatus.uptime) status['uptime_seconds'] = String(serverStatus.uptime)
    if (serverStatus.connections) {
      status['connections_current'] = String(serverStatus.connections.current ?? 0)
      status['connections_available'] = String(serverStatus.connections.available ?? 0)
      status['connections_totalCreated'] = String(serverStatus.connections.totalCreated ?? 0)
    }
    if (serverStatus.opcounters) {
      status['opcounters_insert'] = String(serverStatus.opcounters.insert ?? 0)
      status['opcounters_query'] = String(serverStatus.opcounters.query ?? 0)
      status['opcounters_update'] = String(serverStatus.opcounters.update ?? 0)
      status['opcounters_delete'] = String(serverStatus.opcounters.delete ?? 0)
      status['opcounters_command'] = String(serverStatus.opcounters.command ?? 0)
    }
    if (serverStatus.mem) {
      status['mem_resident_mb'] = String(serverStatus.mem.resident ?? 0)
      status['mem_virtual_mb'] = String(serverStatus.mem.virtual ?? 0)
    }
    if (serverStatus.network) {
      status['network_bytesIn'] = String(serverStatus.network.bytesIn ?? 0)
      status['network_bytesOut'] = String(serverStatus.network.bytesOut ?? 0)
      status['network_numRequests'] = String(serverStatus.network.numRequests ?? 0)
    }
  } catch {
    // Ignore errors (may not have admin access)
  }

  return { variables, status }
}

// Redis implementation
const getRedisProcessList = async (driver: RedisDriver): Promise<DatabaseProcess[]> => {
  const client = driver.getClient()
  const result = await (client as unknown as { call: (...args: string[]) => Promise<string> }).call('CLIENT', 'LIST')

  return result.split('\n').filter((line: string) => line.trim()).map((line: string) => {
    const fields = new Map<string, string>()
    for (const part of line.split(' ')) {
      const eqIdx = part.indexOf('=')
      if (eqIdx > 0) {
        fields.set(part.substring(0, eqIdx), part.substring(eqIdx + 1))
      }
    }

    return {
      id: fields.get('id') || '0',
      user: fields.get('user') || 'default',
      host: fields.get('addr') || 'local',
      database: fields.get('db') || null,
      command: fields.get('cmd') || 'unknown',
      time: parseInt(fields.get('age') || '0', 10),
      state: fields.get('flags') || null,
      info: fields.get('cmd') || null
    }
  })
}

const killRedisProcess = async (driver: RedisDriver, clientId: number | string): Promise<{ success: boolean; error?: string }> => {
  try {
    const client = driver.getClient()
    await (client as unknown as { call: (...args: string[]) => Promise<unknown> }).call('CLIENT', 'KILL', 'ID', String(clientId))
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getRedisServerStatus = async (driver: RedisDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  const variableKeys = new Set([
    'redis_version', 'redis_mode', 'os', 'arch_bits', 'tcp_port',
    'config_file', 'maxmemory', 'maxmemory_policy', 'maxclients'
  ])

  const statusKeys = new Set([
    'connected_clients', 'blocked_clients', 'used_memory_human',
    'used_memory_peak_human', 'total_connections_received',
    'total_commands_processed', 'instantaneous_ops_per_sec',
    'keyspace_hits', 'keyspace_misses', 'uptime_in_seconds',
    'uptime_in_days', 'used_cpu_sys', 'used_cpu_user',
    'connected_slaves', 'expired_keys', 'evicted_keys',
    'role', 'loading', 'rdb_last_save_time'
  ])

  try {
    const client = driver.getClient()
    const info = await client.info()

    // Parse INFO response: "key:value\r\n" format
    for (const line of info.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const colonIdx = trimmed.indexOf(':')
      if (colonIdx <= 0) continue

      const key = trimmed.substring(0, colonIdx)
      const value = trimmed.substring(colonIdx + 1)

      if (variableKeys.has(key)) {
        variables[key] = value
      } else if (statusKeys.has(key)) {
        status[key] = value
      }
    }
  } catch {
    // Ignore errors
  }

  return { variables, status }
}

// DuckDB implementation (limited info, similar to SQLite)
const getDuckDBServerStatus = async (driver: DuckDBDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  try {
    const versionResult = await driver.execute('SELECT version() as version')
    if (!versionResult.error && versionResult.rows.length > 0) {
      variables['version'] = String((versionResult.rows[0] as Record<string, unknown>).version)
    }
  } catch {
    // Ignore
  }

  try {
    const settings = ['memory_limit', 'threads', 'default_order']
    for (const setting of settings) {
      const result = await driver.execute(`SELECT current_setting('${setting}') as value`)
      if (!result.error && result.rows.length > 0) {
        variables[setting] = String((result.rows[0] as Record<string, unknown>).value)
      }
    }
  } catch {
    // Ignore
  }

  return { variables, status }
}

// SQL Server implementation
const getSQLServerProcessList = async (driver: SQLServerDriver): Promise<DatabaseProcess[]> => {
  const result = await driver.execute(`
    SELECT
      s.session_id AS pid,
      s.login_name AS [user],
      s.host_name AS host,
      DB_NAME(s.database_id) AS [database],
      s.status AS command,
      DATEDIFF(SECOND, s.last_request_start_time, GETDATE()) AS time,
      s.status AS state,
      (SELECT TOP 1 text FROM sys.dm_exec_sql_text(c.most_recent_sql_handle)) AS info
    FROM sys.dm_exec_sessions s
    LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
    WHERE s.is_user_process = 1
    ORDER BY s.last_request_start_time DESC
  `)

  if (result.error) {
    throw new Error(result.error)
  }

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.pid as number,
    user: (row.user as string) || '',
    host: (row.host as string) || 'local',
    database: row.database as string | null,
    command: (row.command as string) || 'sleeping',
    time: (row.time as number) || 0,
    state: row.state as string | null,
    info: row.info as string | null
  }))
}

const killSQLServerProcess = async (driver: SQLServerDriver, sessionId: number): Promise<{ success: boolean; error?: string }> => {
  const id = Number(sessionId)
  if (!Number.isInteger(id) || id <= 0) {
    return { success: false, error: 'Invalid session ID' }
  }
  try {
    const result = await driver.execute(`KILL ${id}`)
    if (result.error) {
      return { success: false, error: result.error }
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

const getSQLServerServerStatus = async (driver: SQLServerDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  try {
    const versionResult = await driver.execute('SELECT @@VERSION AS version')
    if (!versionResult.error && versionResult.rows.length > 0) {
      variables['version'] = String((versionResult.rows[0] as Record<string, unknown>).version)
    }
  } catch {}

  try {
    const editionResult = await driver.execute("SELECT SERVERPROPERTY('Edition') AS edition, SERVERPROPERTY('ProductVersion') AS product_version, @@SERVERNAME AS server_name")
    if (!editionResult.error && editionResult.rows.length > 0) {
      const row = editionResult.rows[0] as Record<string, unknown>
      variables['edition'] = String(row.edition || '')
      variables['product_version'] = String(row.product_version || '')
      variables['server_name'] = String(row.server_name || '')
    }
  } catch {}

  try {
    const connResult = await driver.execute("SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1")
    if (!connResult.error && connResult.rows.length > 0) {
      status['active_connections'] = String((connResult.rows[0] as Record<string, unknown>).cnt)
    }
  } catch {}

  try {
    const uptimeResult = await driver.execute('SELECT sqlserver_start_time FROM sys.dm_os_sys_info')
    if (!uptimeResult.error && uptimeResult.rows.length > 0) {
      status['start_time'] = String((uptimeResult.rows[0] as Record<string, unknown>).sqlserver_start_time)
    }
  } catch {}

  return { variables, status }
}

// SQLite implementation (limited info)
const getSQLiteServerStatus = async (driver: SQLiteDriver): Promise<ServerStatus> => {
  const variables: Record<string, string> = {}
  const status: Record<string, string> = {}

  // Get some PRAGMA values
  const pragmas = ['journal_mode', 'synchronous', 'cache_size', 'page_size', 'wal_autocheckpoint']

  for (const pragma of pragmas) {
    try {
      const result = await driver.execute(`PRAGMA ${pragma}`)
      if (!result.error && result.rows.length > 0) {
        const value = Object.values(result.rows[0])[0]
        variables[pragma] = String(value)
      }
    } catch {
      // Ignore errors for individual pragmas
    }
  }

  // Get database info
  try {
    const result = await driver.execute('PRAGMA database_list')
    if (!result.error) {
      status['databases'] = String(result.rows.length)
    }
  } catch {
    // Ignore
  }

  return { variables, status }
}
