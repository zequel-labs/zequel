import { ipcMain } from 'electron'
import { bookmarksService, type BookmarkType } from '../services/bookmarks'
import { logger } from '../utils/logger'

export const registerBookmarkHandlers = (): void => {
  ipcMain.handle('bookmarks:add', async (_, type: BookmarkType, name: string, connectionId: string, database?: string, schema?: string, sql?: string, folder?: string) => {
    logger.debug('IPC: bookmarks:add', { type, name, connectionId })
    return bookmarksService.addBookmark(type, name, connectionId, database, schema, sql, folder)
  })

  ipcMain.handle('bookmarks:list', async (_, connectionId?: string) => {
    logger.debug('IPC: bookmarks:list', { connectionId })
    return bookmarksService.getBookmarks(connectionId)
  })

  ipcMain.handle('bookmarks:listByType', async (_, type: BookmarkType, connectionId?: string) => {
    logger.debug('IPC: bookmarks:listByType', { type, connectionId })
    return bookmarksService.getBookmarksByType(type, connectionId)
  })

  ipcMain.handle('bookmarks:folders', async (_, connectionId?: string) => {
    logger.debug('IPC: bookmarks:folders', { connectionId })
    return bookmarksService.getFolders(connectionId)
  })

  ipcMain.handle('bookmarks:update', async (_, id: number, updates: { name?: string; folder?: string; sql?: string }) => {
    logger.debug('IPC: bookmarks:update', { id, updates })
    return bookmarksService.updateBookmark(id, updates)
  })

  ipcMain.handle('bookmarks:remove', async (_, id: number) => {
    logger.debug('IPC: bookmarks:remove', { id })
    return bookmarksService.removeBookmark(id)
  })

  ipcMain.handle('bookmarks:isBookmarked', async (_, type: BookmarkType, name: string, connectionId: string) => {
    return bookmarksService.isBookmarked(type, name, connectionId)
  })

  ipcMain.handle('bookmarks:clear', async (_, connectionId?: string) => {
    logger.debug('IPC: bookmarks:clear', { connectionId })
    return bookmarksService.clearBookmarks(connectionId)
  })
}
