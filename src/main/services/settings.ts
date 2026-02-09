import { appDatabase } from './database'
import { logger } from '../utils/logger'

class SettingsService {
  get(key: string): string | null {
    try {
      const db = appDatabase.getDatabase()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
      return row?.value ?? null
    } catch (error) {
      logger.error('Failed to get setting', { key, error })
      return null
    }
  }

  set(key: string, value: string): void {
    try {
      const db = appDatabase.getDatabase()
      db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).run(key, value)
    } catch (error) {
      logger.error('Failed to set setting', { key, error })
      throw error
    }
  }

  delete(key: string): void {
    try {
      const db = appDatabase.getDatabase()
      db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    } catch (error) {
      logger.error('Failed to delete setting', { key, error })
      throw error
    }
  }
}

export const settingsService = new SettingsService()
