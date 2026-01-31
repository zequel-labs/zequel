import { ipcMain } from 'electron'
import { recentsService, type RecentItemType } from '../services/recents'
import { logger } from '../utils/logger'

export const registerRecentsHandlers = (): void => {
  ipcMain.handle('recents:add', async (_, type: RecentItemType, name: string, connectionId: string, database?: string, schema?: string, sql?: string) => {
    logger.debug('IPC: recents:add', { type, name, connectionId })
    return recentsService.addRecent(type, name, connectionId, database, schema, sql)
  })

  ipcMain.handle('recents:list', async (_, limit?: number) => {
    logger.debug('IPC: recents:list', { limit })
    return recentsService.getRecents(limit)
  })

  ipcMain.handle('recents:listByConnection', async (_, connectionId: string, limit?: number) => {
    logger.debug('IPC: recents:listByConnection', { connectionId, limit })
    return recentsService.getRecentsByConnection(connectionId, limit)
  })

  ipcMain.handle('recents:listByType', async (_, type: RecentItemType, limit?: number) => {
    logger.debug('IPC: recents:listByType', { type, limit })
    return recentsService.getRecentsByType(type, limit)
  })

  ipcMain.handle('recents:remove', async (_, id: number) => {
    logger.debug('IPC: recents:remove', { id })
    return recentsService.removeRecent(id)
  })

  ipcMain.handle('recents:clear', async () => {
    logger.debug('IPC: recents:clear')
    return recentsService.clearRecents()
  })

  ipcMain.handle('recents:clearForConnection', async (_, connectionId: string) => {
    logger.debug('IPC: recents:clearForConnection', { connectionId })
    return recentsService.clearRecentsForConnection(connectionId)
  })
}
