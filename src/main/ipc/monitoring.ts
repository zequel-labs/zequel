import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import type { DatabaseProcess, ServerStatus } from '../types'
import { MySQLDriver } from '../db/mysql'
import { PostgreSQLDriver } from '../db/postgres'
import { SQLiteDriver } from '../db/sqlite'

export const registerMonitoringHandlers = (): void => {
  // Get process list (active connections/queries)
  ipcMain.handle(
    'monitoring:getProcessList',
    async (_, connectionId: string): Promise<DatabaseProcess[]> => {
      const driver = connectionManager.getConnection(connectionId)
      if (!driver) {
        throw new Error('Connection not found')
      }

      if (driver instanceof MySQLDriver) {
        return getMySQLProcessList(driver)
      } else if (driver instanceof PostgreSQLDriver) {
        return getPostgreSQLProcessList(driver)
      } else if (driver instanceof SQLiteDriver) {
        // SQLite is single-connection, return empty
        return []
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

      if (driver instanceof MySQLDriver) {
        return killMySQLProcess(driver, processId as number)
      } else if (driver instanceof PostgreSQLDriver) {
        return killPostgreSQLProcess(driver, processId as number, force)
      } else if (driver instanceof SQLiteDriver) {
        return { success: false, error: 'SQLite does not support process management' }
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

      if (driver instanceof MySQLDriver) {
        return getMySQLServerStatus(driver)
      } else if (driver instanceof PostgreSQLDriver) {
        return getPostgreSQLServerStatus(driver)
      } else if (driver instanceof SQLiteDriver) {
        return getSQLiteServerStatus(driver)
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
  try {
    await driver.execute(`KILL ${processId}`)
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
