import { ipcMain } from 'electron'
import { withDriver } from './helpers'
import { logger } from '@main/utils/logger'

export const registerTransactionHandlers = (): void => {
  ipcMain.handle('transaction:begin', async (_, connectionId: string) => {
    logger.debug('IPC: transaction:begin', { connectionId })
    return withDriver(connectionId, (driver) => driver.beginTransaction())
  })

  ipcMain.handle('transaction:commit', async (_, connectionId: string) => {
    logger.debug('IPC: transaction:commit', { connectionId })
    return withDriver(connectionId, (driver) => driver.commitTransaction())
  })

  ipcMain.handle('transaction:rollback', async (_, connectionId: string) => {
    logger.debug('IPC: transaction:rollback', { connectionId })
    return withDriver(connectionId, (driver) => driver.rollbackTransaction())
  })

  ipcMain.handle('transaction:status', async (_, connectionId: string) => {
    return withDriver(connectionId, (driver) => ({
      inTransaction: driver.inTransaction,
      supportsTransactions: driver.supportsTransactions
    }))
  })
}
