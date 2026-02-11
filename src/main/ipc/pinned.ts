import { ipcMain } from 'electron'
import { pinnedService } from '../services/pinned'
import { TableObjectType } from '../types'
import { logger } from '../utils/logger'

export const registerPinnedHandlers = (): void => {
  ipcMain.handle('pinned:pin', async (_, type: TableObjectType, name: string, connectionId: string, database?: string, schema?: string) => {
    logger.debug('IPC: pinned:pin', { type, name, connectionId })
    return pinnedService.pin(type, name, connectionId, database, schema)
  })

  ipcMain.handle('pinned:unpin', async (_, id: number) => {
    logger.debug('IPC: pinned:unpin', { id })
    return pinnedService.unpin(id)
  })

  ipcMain.handle('pinned:unpinByName', async (_, type: TableObjectType, name: string, connectionId: string, schema?: string) => {
    logger.debug('IPC: pinned:unpinByName', { type, name, connectionId })
    return pinnedService.unpinByName(type, name, connectionId, schema)
  })

  ipcMain.handle('pinned:list', async (_, connectionId: string) => {
    logger.debug('IPC: pinned:list', { connectionId })
    return pinnedService.listByConnection(connectionId)
  })

  ipcMain.handle('pinned:isPinned', async (_, type: TableObjectType, name: string, connectionId: string, schema?: string) => {
    logger.debug('IPC: pinned:isPinned', { type, name, connectionId })
    return pinnedService.isPinned(type, name, connectionId, schema)
  })

  ipcMain.handle('pinned:reorder', async (_, ids: number[]) => {
    logger.debug('IPC: pinned:reorder', { ids })
    return pinnedService.reorder(ids)
  })

  ipcMain.handle('pinned:clear', async (_, connectionId: string) => {
    logger.debug('IPC: pinned:clear', { connectionId })
    return pinnedService.clearForConnection(connectionId)
  })
}
