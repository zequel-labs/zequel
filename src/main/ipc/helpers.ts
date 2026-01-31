import { connectionManager } from '../db/manager'
import { DatabaseType } from '../types'
import type { DatabaseDriver } from '../db/base'
import { MySQLDriver } from '../db/mysql'

export const withDriver = async <T>(
  connectionId: string,
  fn: (driver: DatabaseDriver) => T | Promise<T>
): Promise<T> => {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  return fn(driver)
}

export const withMySQLDriver = async <T>(
  connectionId: string,
  featureName: string,
  fn: (driver: MySQLDriver) => Promise<T>
): Promise<T> => {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  if (driver.type !== DatabaseType.MySQL && driver.type !== DatabaseType.MariaDB) {
    throw new Error(`${featureName} is only supported for MySQL/MariaDB connections`)
  }
  return fn(driver as unknown as MySQLDriver)
}
