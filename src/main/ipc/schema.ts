import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { logger } from '../utils/logger'
import type { DataOptions } from '../types'

export function registerSchemaHandlers(): void {
  ipcMain.handle('schema:databases', async (_, connectionId: string) => {
    logger.debug('IPC: schema:databases', { connectionId })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getDatabases()
  })

  ipcMain.handle('schema:tables', async (_, connectionId: string, database: string, schema?: string) => {
    logger.debug('IPC: schema:tables', { connectionId, database, schema })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getTables(database, schema)
  })

  ipcMain.handle('schema:columns', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:columns', { connectionId, table })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getColumns(table)
  })

  ipcMain.handle('schema:indexes', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:indexes', { connectionId, table })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getIndexes(table)
  })

  ipcMain.handle('schema:foreignKeys', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:foreignKeys', { connectionId, table })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getForeignKeys(table)
  })

  ipcMain.handle('schema:tableDDL', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:tableDDL', { connectionId, table })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getTableDDL(table)
  })

  ipcMain.handle('schema:tableData', async (_, connectionId: string, table: string, options: DataOptions) => {
    logger.debug('IPC: schema:tableData', { connectionId, table, options })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    const result = await driver.getTableData(table, options)
    return JSON.parse(JSON.stringify(result))
  })
}
