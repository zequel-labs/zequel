import { ipcMain } from 'electron'
import { appDatabase } from '../services/database'
import { logger } from '../utils/logger'

export function registerTabHandlers(): void {
  ipcMain.handle('tabs:save', async (_, connectionId: string, database: string, tabsJson: string, activeTabId: string | null) => {
    try {
      logger.debug('IPC: tabs:save', { connectionId, database, activeTabId })
      const db = appDatabase.getDatabase()
      db.prepare(`
        INSERT INTO tab_sessions (connection_id, database_name, tabs_json, active_tab_id, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(connection_id, database_name) DO UPDATE SET
          tabs_json = excluded.tabs_json,
          active_tab_id = excluded.active_tab_id,
          updated_at = datetime('now')
      `).run(connectionId, database, tabsJson, activeTabId)
      return true
    } catch (error) {
      logger.error('Failed to save tab session', error)
      return false
    }
  })

  ipcMain.handle('tabs:load', async (_, connectionId: string, database: string) => {
    try {
      logger.debug('IPC: tabs:load', { connectionId, database })
      const db = appDatabase.getDatabase()
      const row = db.prepare('SELECT * FROM tab_sessions WHERE connection_id = ? AND database_name = ?').get(connectionId, database)
      return row || null
    } catch (error) {
      logger.error('Failed to load tab session', error)
      return null
    }
  })

  ipcMain.handle('tabs:delete', async (_, connectionId: string, database: string) => {
    try {
      logger.debug('IPC: tabs:delete', { connectionId, database })
      const db = appDatabase.getDatabase()
      db.prepare('DELETE FROM tab_sessions WHERE connection_id = ? AND database_name = ?').run(connectionId, database)
      return true
    } catch (error) {
      logger.error('Failed to delete tab session', error)
      return false
    }
  })
}
