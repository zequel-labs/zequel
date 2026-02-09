import type { Migration } from '../services/migrationRunner'

export const migration: Migration = {
  name: '003_create_saved_queries',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS saved_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT,
        name TEXT NOT NULL,
        sql TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
      )
    `)
  },
}
