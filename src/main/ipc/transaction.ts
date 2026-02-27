import { ipcMain } from 'electron'
import { withDriver, assertSessionOwner } from './helpers'
import { logger } from '@main/utils/logger'

export const registerTransactionHandlers = (): void => {
  ipcMain.handle('transaction:begin', async (event, connectionId: string) => {
    logger.debug('IPC: transaction:begin', { connectionId })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.beginTransaction())
  })

  ipcMain.handle('transaction:commit', async (event, connectionId: string) => {
    logger.debug('IPC: transaction:commit', { connectionId })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.commitTransaction())
  })

  ipcMain.handle('transaction:rollback', async (event, connectionId: string) => {
    logger.debug('IPC: transaction:rollback', { connectionId })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.rollbackTransaction())
  })

  ipcMain.handle('transaction:status', async (event, connectionId: string) => {
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => ({
      inTransaction: driver.inTransaction,
      supportsTransactions: driver.supportsTransactions
    }))
  })
}
