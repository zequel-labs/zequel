import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { DatabaseType } from '@main/types'
import type { DatabaseDriver } from '@main/db/base'
import { MySQLDriver } from '@main/db/mysql'
import { PostgreSQLDriver } from '@main/db/postgres'

/** Assert that the IPC caller owns (or may access) the given session. */
export const assertSessionOwner = (event: Electron.IpcMainInvokeEvent, connectionId: string): void => {
  const ownerId = windowManager.getSessionOwner(connectionId)
  if (ownerId !== undefined && ownerId !== event.sender.id) {
    throw new Error('Not authorized to access this connection')
  }
}

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

export const withPostgresDriver = async <T>(
  connectionId: string,
  featureName: string,
  fn: (driver: PostgreSQLDriver) => Promise<T>
): Promise<T> => {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  if (driver.type !== DatabaseType.PostgreSQL) {
    throw new Error(`${featureName} is only supported for PostgreSQL connections`)
  }
  return fn(driver as unknown as PostgreSQLDriver)
}
