import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '011_remove_type_check_constraint',
  up: (db) => {
    // Remove the CHECK constraint on `type` so new database types don't require migrations.
    // Validation is handled in application code instead.
    db.exec(`
      CREATE TABLE connections_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
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
        last_connected_at TEXT,
        environment TEXT,
        folder TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO connections_new SELECT * FROM connections;

      DROP TABLE connections;

      ALTER TABLE connections_new RENAME TO connections;
    `)
  },
}
