import type { Migration } from '../services/migrationRunner'

export const migration: Migration = {
  name: '002_create_query_history',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        sql TEXT NOT NULL,
        execution_time INTEGER,
        row_count INTEGER,
        error TEXT,
        executed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_query_history_connection
      ON query_history(connection_id, executed_at DESC)
    `)
  },
}
