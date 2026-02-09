import type { Migration } from '../services/migrationRunner'

export const migration: Migration = {
  name: '001_create_connections',
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('sqlite', 'mysql', 'postgresql', 'mariadb', 'clickhouse', 'mongodb', 'redis')),
        host TEXT,
        port INTEGER,
        database TEXT NOT NULL,
        username TEXT,
        filepath TEXT,
        ssl INTEGER DEFAULT 0,
        ssl_config TEXT,
        ssh_config TEXT,
        color TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_connected_at TEXT
      )
    `)
  },
}
