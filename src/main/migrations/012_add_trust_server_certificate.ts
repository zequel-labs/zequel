import type { Migration } from '@main/services/migrationRunner'

export const migration: Migration = {
  name: '012_add_trust_server_certificate',
  up: (db) => {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN trust_server_certificate INTEGER DEFAULT 0`)
    } catch {
      // Column already exists
    }
  },
}
