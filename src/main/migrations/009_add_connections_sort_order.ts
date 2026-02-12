import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '009_add_connections_sort_order',
  up: (db) => {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN sort_order INTEGER DEFAULT 0`)
    } catch {
      // Column already exists
    }
  },
}
