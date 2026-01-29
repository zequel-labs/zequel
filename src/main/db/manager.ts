import { DatabaseDriver, TestConnectionResult } from './base'
import { SQLiteDriver } from './sqlite'
import { MySQLDriver } from './mysql'
import { PostgreSQLDriver } from './postgres'
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

    const driver = this.createDriver(config.type)
    await driver.connect(config)
    this.connections.set(config.id, driver)
    return driver
  }

  async disconnect(connectionId: string): Promise<boolean> {
    const driver = this.connections.get(connectionId)
    if (driver) {
      await driver.disconnect()
      this.connections.delete(connectionId)
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
    const driver = this.createDriver(config.type)
    return driver.testConnection(config)
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager()
