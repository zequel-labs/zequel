import { ipcMain } from 'electron'
import { logger } from '../utils/logger'
import type { DataOptions } from '../types'
import { withDriver } from './helpers'
import { toPlainObject } from '../utils/serialize'

export const registerSchemaHandlers = (): void => {
  ipcMain.handle('schema:databases', async (_, connectionId: string) => {
    logger.debug('IPC: schema:databases', { connectionId })
    return withDriver(connectionId, (driver) => driver.getDatabases())
  })

  ipcMain.handle('schema:tables', async (_, connectionId: string, database: string, schema?: string) => {
    logger.debug('IPC: schema:tables', { connectionId, database, schema })
    return withDriver(connectionId, (driver) => driver.getTables(database, schema))
  })

  ipcMain.handle('schema:columns', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:columns', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getColumns(table))
  })

  ipcMain.handle('schema:indexes', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:indexes', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getIndexes(table))
  })

  ipcMain.handle('schema:foreignKeys', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:foreignKeys', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getForeignKeys(table))
  })

  ipcMain.handle('schema:tableDDL', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:tableDDL', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getTableDDL(table))
  })

  ipcMain.handle('schema:tableData', async (_, connectionId: string, table: string, options: DataOptions) => {
    logger.debug('IPC: schema:tableData', { connectionId, table, options })
    return withDriver(connectionId, async (driver) => {
      const result = await driver.getTableData(table, options)
      return toPlainObject(result)
    })
  })
}
