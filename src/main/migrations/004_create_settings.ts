import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '004_create_settings',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  },
}
