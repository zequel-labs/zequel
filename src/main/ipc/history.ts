import { ipcMain } from 'electron'
import { queryHistoryService } from '../services/queryHistory'
import { logger } from '../utils/logger'

export const registerHistoryHandlers = (): void => {
  // Query History
  ipcMain.handle('history:list', async (_, connectionId?: string, limit?: number, offset?: number) => {
    logger.debug('IPC: history:list', { connectionId, limit, offset })
    if (connectionId) {
      return queryHistoryService.getHistory(connectionId, limit, offset)
    }
    return queryHistoryService.getAllHistory(limit, offset)
  })

  ipcMain.handle('history:add', async (_, connectionId: string, sql: string, executionTime?: number, rowCount?: number, error?: string) => {
    logger.debug('IPC: history:add', { connectionId })
    return queryHistoryService.addToHistory(connectionId, sql, executionTime, rowCount, error)
  })

  ipcMain.handle('history:clear', async (_, connectionId?: string) => {
    logger.debug('IPC: history:clear', { connectionId })
    return queryHistoryService.clearHistory(connectionId)
  })

  ipcMain.handle('history:delete', async (_, id: number) => {
    logger.debug('IPC: history:delete', { id })
    return queryHistoryService.deleteHistoryItem(id)
  })

  // Saved Queries
  ipcMain.handle('savedQueries:list', async (_, connectionId?: string) => {
    logger.debug('IPC: savedQueries:list', { connectionId })
    return queryHistoryService.listSavedQueries(connectionId)
  })

  ipcMain.handle('savedQueries:get', async (_, id: number) => {
    logger.debug('IPC: savedQueries:get', { id })
    return queryHistoryService.getSavedQuery(id)
  })

  ipcMain.handle('savedQueries:save', async (_, name: string, sql: string, connectionId?: string, description?: string) => {
    logger.debug('IPC: savedQueries:save', { name, connectionId })
    return queryHistoryService.saveQuery(name, sql, connectionId, description)
  })

  ipcMain.handle('savedQueries:update', async (_, id: number, updates: { name?: string; sql?: string; description?: string }) => {
    logger.debug('IPC: savedQueries:update', { id })
    return queryHistoryService.updateSavedQuery(id, updates)
  })

  ipcMain.handle('savedQueries:delete', async (_, id: number) => {
    logger.debug('IPC: savedQueries:delete', { id })
    return queryHistoryService.deleteSavedQuery(id)
  })
}
