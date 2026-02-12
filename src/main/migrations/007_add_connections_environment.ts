import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '007_add_connections_environment',
  up: (db) => {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN environment TEXT`)
    } catch {
      // Column already exists
    }
  },
}
