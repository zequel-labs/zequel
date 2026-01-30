import { DatabaseDriver, TestConnectionResult } from './base'
import { emitQueryLog } from '../services/queryLog'
import { SQLiteDriver } from './sqlite'
import { MySQLDriver } from './mysql'
import { MariaDBDriver } from './mariadb'
import { PostgreSQLDriver } from './postgres'
import { ClickHouseDriver } from './clickhouse'
import { MongoDBDriver } from './mongodb'
import { RedisDriver } from './redis'
import { sshTunnelManager } from '../services/ssh-tunnel'
import { logger } from '../utils/logger'
import type { ConnectionConfig, DatabaseType } from '../types'

export class ConnectionManager {
  private connections = new Map<string, DatabaseDriver>()

  createDriver(type: DatabaseType): DatabaseDriver {
    switch (type) {
      case 'sqlite':
        return new SQLiteDriver()
      case 'mysql':
        return new MySQLDriver()
      case 'mariadb':
        return new MariaDBDriver()
      case 'postgresql':
        return new PostgreSQLDriver()
      case 'clickhouse':
        return new ClickHouseDriver()
      case 'mongodb':
        return new MongoDBDriver()
      case 'redis':
        return new RedisDriver()
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
      case 'mysql':
      case 'mariadb': {
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

      case 'postgresql': {
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

      case 'sqlite': {
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

      case 'clickhouse': {
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

      // MongoDB and Redis don't use SQL - no query logging
    }
  }

  async connect(config: ConnectionConfig): Promise<DatabaseDriver> {
    // Disconnect existing connection if any
    if (this.connections.has(config.id)) {
      await this.disconnect(config.id)
    }

    let connectionConfig = { ...config }

    // Create SSH tunnel if configured
    if (config.ssh?.enabled && config.type !== 'sqlite') {
      const remoteHost = config.host || 'localhost'
      const remotePort = config.port || (config.type === 'mysql' || config.type === 'mariadb' ? 3306 : config.type === 'redis' ? 6379 : 5432)

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

    const driver = this.createDriver(config.type)
    await driver.connect(connectionConfig)

    // Wrap underlying client to log ALL queries (user + internal)
    this.wrapDriverQueries(driver, config.id, config.type)

    this.connections.set(config.id, driver)
    return driver
  }

  async disconnect(connectionId: string): Promise<boolean> {
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

  isConnected(connectionId: string): boolean {
    const driver = this.connections.get(connectionId)
    return driver?.isConnected ?? false
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    let connectionConfig = { ...config }
    const testTunnelId = `test-${Date.now()}`

    try {
      // Create SSH tunnel if configured
      if (config.ssh?.enabled && config.type !== 'sqlite') {
        const remoteHost = config.host || 'localhost'
        const remotePort = config.port || (config.type === 'mysql' || config.type === 'mariadb' ? 3306 : config.type === 'redis' ? 6379 : 5432)

        logger.info('Creating SSH tunnel for connection test')
        const localPort = await sshTunnelManager.createTunnel(
          testTunnelId,
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

      const driver = this.createDriver(config.type)
      const result = await driver.testConnection(connectionConfig)

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
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
