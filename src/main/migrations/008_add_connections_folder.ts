import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '008_add_connections_folder',
  up: (db) => {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN folder TEXT`)
    } catch {
      // Column already exists
    }
  },
}
