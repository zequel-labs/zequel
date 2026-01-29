import { MySQLDriver } from './mysql'
import type { ConnectionConfig, QueryResult } from '../types'

/**
 * MariaDB Driver - extends MySQLDriver since MariaDB is MySQL-compatible
 *
 * MariaDB uses the same protocol as MySQL and most features are compatible.
 * This driver inherits all MySQL functionality and can be extended with
 * MariaDB-specific features in the future (e.g., sequences, system versioning).
 */
export class MariaDBDriver extends MySQLDriver {
  readonly type = 'mariadb'

  async connect(config: ConnectionConfig): Promise<void> {
    // MariaDB uses the same connection parameters as MySQL
    // The mysql2 driver is compatible with MariaDB
    await super.connect({
      ...config,
      port: config.port || 3306
    })
  }

  /**
   * Get MariaDB server version info
   */
  async getServerVersion(): Promise<string> {
    this.ensureConnected()
    const result = await this.execute('SELECT VERSION() as version')
    if (result.rows.length > 0) {
      return result.rows[0].version as string
    }
    return 'Unknown'
  }

  /**
   * Check if server is MariaDB (vs MySQL)
   */
  async isMariaDB(): Promise<boolean> {
    const version = await this.getServerVersion()
    return version.toLowerCase().includes('mariadb')
  }

  /**
   * Get MariaDB-specific system variables
   */
  async getSystemVariables(): Promise<Record<string, string>> {
    this.ensureConnected()
    const result = await this.execute('SHOW VARIABLES')
    const variables: Record<string, string> = {}
    for (const row of result.rows) {
      variables[row.Variable_name as string] = row.Value as string
    }
    return variables
  }

  /**
   * Get MariaDB-specific status variables
   */
  async getStatusVariables(): Promise<Record<string, string>> {
    this.ensureConnected()
    const result = await this.execute('SHOW STATUS')
    const status: Record<string, string> = {}
    for (const row of result.rows) {
      status[row.Variable_name as string] = row.Value as string
    }
    return status
  }

  // Future MariaDB-specific features can be added here:
  // - Sequences (MariaDB 10.3+)
  // - System versioning (MariaDB 10.3+)
  // - JSON table functions (MariaDB 10.6+)
  // - Oracle compatibility mode
}
