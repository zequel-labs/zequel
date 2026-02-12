import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '005_create_recents',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS recents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('table', 'view', 'query')),
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        database TEXT,
        schema TEXT,
        sql TEXT,
        accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_recents_accessed
      ON recents(accessed_at DESC)
    `)

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recents_unique
      ON recents(type, name, connection_id)
    `)
  },
}
