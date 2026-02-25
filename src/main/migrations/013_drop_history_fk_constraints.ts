import type { Migration } from '@main/services/migrationRunner'

/**
 * Drops FOREIGN KEY constraints on query_history and saved_queries tables.
 *
 * These tables reference connections(id), but ephemeral connections (created via
 * "Connect" without "Save") only exist in memory — they are never persisted to
 * the SQLite connections table.  With foreign_keys = ON the INSERT fails silently
 * with "FOREIGN KEY constraint failed", preventing history and saved queries from
 * being recorded for ephemeral connections.
 *
 * SQLite does not support ALTER TABLE … DROP CONSTRAINT, so we recreate each
 * table without the FK and copy the data over.
 */
export const migration: Migration = {
  name: '013_drop_history_fk_constraints',
  up: (db) => {
    // --- query_history ---
    db.exec(`
      CREATE TABLE query_history_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        sql TEXT NOT NULL,
        execution_time INTEGER,
        row_count INTEGER,
        error TEXT,
        executed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      INSERT INTO query_history_new (id, connection_id, sql, execution_time, row_count, error, executed_at)
      SELECT id, connection_id, sql, execution_time, row_count, error, executed_at
      FROM query_history
    `)

    db.exec('DROP TABLE query_history')
    db.exec('ALTER TABLE query_history_new RENAME TO query_history')

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_query_history_connection
      ON query_history(connection_id, executed_at DESC)
    `)

    // --- saved_queries ---
    db.exec(`
      CREATE TABLE saved_queries_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT,
        name TEXT NOT NULL,
        sql TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      INSERT INTO saved_queries_new (id, connection_id, name, sql, description, created_at, updated_at)
      SELECT id, connection_id, name, sql, description, created_at, updated_at
      FROM saved_queries
    `)

    db.exec('DROP TABLE saved_queries')
    db.exec('ALTER TABLE saved_queries_new RENAME TO saved_queries')
  },
}
