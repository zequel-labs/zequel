import { DatabaseDriver, TestConnectionResult } from './base'
import { SQLiteDriver } from './sqlite'
import { MySQLDriver } from './mysql'
import { PostgreSQLDriver } from './postgres'
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
      case 'postgresql':
        return new PostgreSQLDriver()
      default:
        throw new Error(`Unsupported database type: ${type}`)
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
      const remotePort = config.port || (config.type === 'mysql' ? 3306 : 5432)

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
        const remotePort = config.port || (config.type === 'mysql' ? 3306 : 5432)

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
