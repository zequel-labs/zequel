import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { logger } from '../utils/logger'

export function registerQueryHandlers(): void {
  ipcMain.handle('query:execute', async (_, connectionId: string, sql: string, params?: unknown[]) => {
    logger.debug('IPC: query:execute', { connectionId, sql: sql.substring(0, 100), paramsCount: params?.length })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    const result = await driver.execute(sql, params)
    return JSON.parse(JSON.stringify(result))
  })

  ipcMain.handle('query:cancel', async (_, connectionId: string) => {
    logger.debug('IPC: query:cancel', { connectionId })
    // Note: Query cancellation is complex and depends on the database driver
    // For now, we return false as this is not fully implemented
    return false
  })
}
