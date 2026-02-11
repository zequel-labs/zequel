import type { Migration } from '../services/migrationRunner'

export const migration: Migration = {
  name: '010_create_pinned_entities',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pinned_entities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('table', 'view')),
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        database TEXT,
        schema TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pinned_unique
      ON pinned_entities(type, name, connection_id, COALESCE(database, ''), COALESCE(schema, ''))
    `)
  },
}
