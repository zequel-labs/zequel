import { DatabaseDriver, TestConnectionResult } from './base'
import { emitQueryLog } from '@main/services/queryLog'
import { emitConnectionStatus, ConnectionStatusType } from '@main/services/connectionStatus'
import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { logger } from '@main/utils/logger'
import { DatabaseType, DEFAULT_PORTS, type ConnectionConfig } from '@main/types'

const HEALTH_CHECK_INTERVAL = 30_000
const MAX_RECONNECT_ATTEMPTS = 5
const SKIP_HEALTH_CHECK_TYPES: DatabaseType[] = [DatabaseType.SQLite, DatabaseType.ClickHouse, DatabaseType.DuckDB]

export class ConnectionManager {
  private connections = new Map<string, DatabaseDriver>()
  private configs = new Map<string, ConnectionConfig>()
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>()
  private reconnectInProgress = new Set<string>()

  async createDriver(type: DatabaseType): Promise<DatabaseDriver> {
    switch (type) {
      case DatabaseType.SQLite: {
        const { SQLiteDriver } = await import('./sqlite')
        return new SQLiteDriver()
      }
      case DatabaseType.MySQL: {
        const { MySQLDriver } = await import('./mysql')
        return new MySQLDriver()
      }
      case DatabaseType.MariaDB: {
        const { MariaDBDriver } = await import('./mariadb')
        return new MariaDBDriver()
      }
      case DatabaseType.PostgreSQL: {
        const { PostgreSQLDriver } = await import('./postgres')
        return new PostgreSQLDriver()
      }
      case DatabaseType.ClickHouse: {
        const { ClickHouseDriver } = await import('./clickhouse')
        return new ClickHouseDriver()
      }
      case DatabaseType.MongoDB: {
        const { MongoDBDriver } = await import('./mongodb')
        return new MongoDBDriver()
      }
      case DatabaseType.Redis: {
        const { RedisDriver } = await import('./redis')
        return new RedisDriver()
      }
      case DatabaseType.DuckDB: {
        const { DuckDBDriver } = await import('./duckdb')
        return new DuckDBDriver()
      }
      default:
        throw new Error(`Unsupported database type: ${type}`)
    }
  }

  /**
   * Wraps the underlying database client's query methods to log ALL SQL queries,
   * including internal ones (getDatabases, getTables, getColumns, etc.)
   */
  private wrapDriverQueries(driver: DatabaseDriver, connectionId: string, type: DatabaseType) {
    const driverAny = driver as any

    switch (type) {
      case DatabaseType.MySQL:
      case DatabaseType.MariaDB: {
        const conn = driverAny.connection
        if (!conn) break

        const origQuery = conn.query.bind(conn)
        conn.query = async function (...args: any[]) {
          const sql = typeof args[0] === 'string' ? args[0] : ''
          const startTime = Date.now()
          try {
            const result = await origQuery(...args)
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            return result
          } catch (error) {
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            throw error
          }
        }

        const origExecute = conn.execute.bind(conn)
        conn.execute = async function (...args: any[]) {
          const sql = typeof args[0] === 'string' ? args[0] : ''
          const startTime = Date.now()
          try {
            const result = await origExecute(...args)
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            return result
          } catch (error) {
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            throw error
          }
        }
        break
      }

      case DatabaseType.PostgreSQL: {
        const client = driverAny.client
        if (!client) break

        const origQuery = client.query.bind(client)
        client.query = async function (...args: any[]) {
          const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text || ''
          const startTime = Date.now()
          try {
            const result = await origQuery(...args)
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            return result
          } catch (error) {
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            throw error
          }
        }
        break
      }

      case DatabaseType.SQLite: {
        const db = driverAny.db
        if (!db) break

        const origPrepare = db.prepare.bind(db)
        db.prepare = function (sql: string) {
          const stmt = origPrepare(sql)

          const origAll = stmt.all.bind(stmt)
          const origGet = stmt.get.bind(stmt)
          const origRun = stmt.run.bind(stmt)

          stmt.all = function (...args: any[]) {
            const startTime = Date.now()
            try {
              const result = origAll(...args)
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              return result
            } catch (error) {
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              throw error
            }
          }

          stmt.get = function (...args: any[]) {
            const startTime = Date.now()
            try {
              const result = origGet(...args)
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              return result
            } catch (error) {
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              throw error
            }
          }

          stmt.run = function (...args: any[]) {
            const startTime = Date.now()
            try {
              const result = origRun(...args)
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              return result
            } catch (error) {
              emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
              throw error
            }
          }

          return stmt
        }
        break
      }

      case DatabaseType.ClickHouse: {
        const client = driverAny.client
        if (!client) break

        const origQuery = client.query.bind(client)
        client.query = async function (params: any) {
          const sql = params?.query || ''
          const startTime = Date.now()
          try {
            const result = await origQuery(params)
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            return result
          } catch (error) {
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            throw error
          }
        }
        break
      }

      case DatabaseType.DuckDB: {
        const duckConn = driverAny.connection
        if (!duckConn) break

        const origRun = duckConn.run.bind(duckConn)
        duckConn.run = async function (...args: any[]) {
          const sql = typeof args[0] === 'string' ? args[0] : ''
          const startTime = Date.now()
          try {
            const result = await origRun(...args)
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            return result
          } catch (error) {
            emitQueryLog({ connectionId, sql, timestamp: new Date().toISOString(), executionTime: Date.now() - startTime })
            throw error
          }
        }
        break
      }

      // MongoDB and Redis don't use SQL - no query logging
    }
  }

  private startHealthCheck(id: string, type: DatabaseType): void {
    if (SKIP_HEALTH_CHECK_TYPES.includes(type)) return
    this.stopHealthCheck(id)

    const interval = setInterval(async () => {
      if (this.reconnectInProgress.has(id)) return

      const driver = this.connections.get(id)
      if (!driver) {
        this.stopHealthCheck(id)
        return
      }

      try {
        const alive = await driver.ping()
        if (!alive) {
          this.handleConnectionLost(id)
        }
      } catch {
        this.handleConnectionLost(id)
      }
    }, HEALTH_CHECK_INTERVAL)

    this.healthCheckIntervals.set(id, interval)
  }

  private stopHealthCheck(id: string): void {
    const interval = this.healthCheckIntervals.get(id)
    if (interval) {
      clearInterval(interval)
      this.healthCheckIntervals.delete(id)
    }
  }

  private handleConnectionLost(id: string): void {
    if (this.reconnectInProgress.has(id)) return
    logger.warn(`Connection lost for ${id}, attempting reconnect`)
    emitConnectionStatus({ connectionId: id, status: ConnectionStatusType.Reconnecting, attempt: 1 })
    this.reconnect(id)
  }

  async reconnect(id: string): Promise<boolean> {
    if (this.reconnectInProgress.has(id)) return false

    const config = this.configs.get(id)
    if (!config) {
      logger.error(`Cannot reconnect ${id}: no stored config`)
      emitConnectionStatus({ connectionId: id, status: ConnectionStatusType.Error, error: 'Connection configuration not found' })
      return false
    }

    this.reconnectInProgress.add(id)
    this.stopHealthCheck(id)

    for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      emitConnectionStatus({ connectionId: id, status: ConnectionStatusType.Reconnecting, attempt })
      logger.info(`Reconnect attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS} for ${id}`)

      try {
        // Disconnect old driver silently
        const oldDriver = this.connections.get(id)
        if (oldDriver) {
          try { await oldDriver.disconnect() } catch {}
          this.connections.delete(id)
        }

        // Re-create SSH tunnel if needed
        if (sshTunnelManager.hasTunnel(id)) {
          sshTunnelManager.closeTunnel(id)
        }

        let connectionConfig = { ...config }
        if (config.ssh?.enabled && config.type !== DatabaseType.SQLite && config.type !== DatabaseType.DuckDB) {
          const remoteHost = config.host || 'localhost'
          const remotePort = config.port || DEFAULT_PORTS[config.type]

          const localPort = await sshTunnelManager.createTunnel(
            id,
            config.ssh,
            remoteHost,
            remotePort
          )

          connectionConfig = { ...config, host: '127.0.0.1', port: localPort }
        }

        // Create new driver and connect
        const driver = await this.createDriver(config.type)
        await driver.connect(connectionConfig)
        this.wrapDriverQueries(driver, id, config.type)
        this.connections.set(id, driver)

        // Success
        this.reconnectInProgress.delete(id)
        emitConnectionStatus({ connectionId: id, status: ConnectionStatusType.Connected })
        this.startHealthCheck(id, config.type)
        logger.info(`Reconnected ${id} on attempt ${attempt}`)
        return true
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.warn(`Reconnect attempt ${attempt} failed for ${id}: ${errorMsg}`)

        if (attempt < MAX_RECONNECT_ATTEMPTS) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = Math.pow(2, attempt - 1) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    // All attempts failed
    this.reconnectInProgress.delete(id)
    emitConnectionStatus({
      connectionId: id,
      status: ConnectionStatusType.Error,
      error: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`
    })
    return false
  }

  async connect(config: ConnectionConfig): Promise<DatabaseDriver> {
    // Disconnect existing connection if any
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }

    let connectionConfig = { ...config }

    // Create SSH tunnel if configured
    if (config.ssh?.enabled && config.type !== DatabaseType.SQLite && config.type !== DatabaseType.DuckDB) {
      const remoteHost = config.host || 'localhost'
      const remotePort = config.port || DEFAULT_PORTS[config.type]

      logger.info(`Creating SSH tunnel for connection ${config.id}`)
      const localPort = await sshTunnelManager.createTunnel(
        config.id,
        config.ssh,
        remoteHost,
        remotePort
      )

      // Update connection config to use tunnel
      connectionConfig = {
        ...config,
        host: '127.0.0.1',
        port: localPort
      }
    }

    const driver = await this.createDriver(config.type)
    await driver.connect(connectionConfig)

    // Wrap underlying client to log ALL queries (user + internal)
    this.wrapDriverQueries(driver, config.id, config.type)

    this.connections.set(config.id, driver)
    this.configs.set(config.id, config)
    this.startHealthCheck(config.id, config.type)
    return driver
  }

  async disconnect(connectionId: string): Promise<boolean> {
    this.stopHealthCheck(connectionId)
    this.configs.delete(connectionId)
    this.reconnectInProgress.delete(connectionId)

    const driver = this.connections.get(connectionId)
    if (driver) {
      await driver.disconnect()
      this.connections.delete(connectionId)

      // Close SSH tunnel if exists
      if (sshTunnelManager.hasTunnel(connectionId)) {
        sshTunnelManager.closeTunnel(connectionId)
      }

      return true
    }
    return false
  }

  async disconnectAll(): Promise<void> {
    for (const [id] of this.connections) {
      await this.disconnect(id)
    }
  }

  getConnection(connectionId: string): DatabaseDriver | undefined {
    return this.connections.get(connectionId)
  }

  getConnectionConfig(connectionId: string): ConnectionConfig | undefined {
    return this.configs.get(connectionId)
  }

  isConnected(connectionId: string): boolean {
    const driver = this.connections.get(connectionId)
    return driver?.isConnected ?? false
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    let connectionConfig = { ...config }
    const testTunnelId = `test-${Date.now()}`
    const useSSH = config.ssh?.enabled && config.type !== DatabaseType.SQLite && config.type !== DatabaseType.DuckDB

    try {
      // Step 1: Create SSH tunnel if configured
      if (useSSH) {
        const remoteHost = config.host || 'localhost'
        const remotePort = config.port || DEFAULT_PORTS[config.type]

        logger.info('Creating SSH tunnel for connection test', {
          sshHost: config.ssh!.host,
          sshPort: config.ssh!.port,
          sshUser: config.ssh!.username,
          authMethod: config.ssh!.authMethod,
          hasPrivateKey: !!config.ssh!.privateKey,
          privateKeyLength: config.ssh!.privateKey?.length || 0,
          remoteHost,
          remotePort
        })
        let localPort: number
        try {
          localPort = await sshTunnelManager.createTunnel(
            testTunnelId,
            config.ssh!,
            remoteHost,
            remotePort
          )
        } catch (sshError) {
          const sshErrorMsg = sshError instanceof Error ? sshError.message : String(sshError)
          logger.error('SSH tunnel creation failed', sshErrorMsg)
          return {
            success: false,
            error: `SSH connection failed: ${sshErrorMsg}`,
            sshSuccess: false,
            sshError: sshErrorMsg
          }
        }

        // Update connection config to use tunnel
        connectionConfig = {
          ...config,
          host: '127.0.0.1',
          port: localPort
        }
      }

      // Step 2: Test database connection (through tunnel if SSH)
      const driver = await this.createDriver(config.type)
      const result = await driver.testConnection(connectionConfig)

      if (useSSH) {
        result.sshSuccess = true
        result.sshError = null
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        ...(useSSH ? { sshSuccess: true, sshError: null } : {})
      }
    } finally {
      // Clean up test tunnel
      if (sshTunnelManager.hasTunnel(testTunnelId)) {
        sshTunnelManager.closeTunnel(testTunnelId)
      }
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager()
