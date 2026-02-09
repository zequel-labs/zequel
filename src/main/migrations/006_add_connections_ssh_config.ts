import type { Migration } from '../services/migrationRunner'

export const migration: Migration = {
  name: '006_add_connections_ssh_config',
  up: (db) => {
    try {
      db.exec(`ALTER TABLE connections ADD COLUMN ssh_config TEXT`)
    } catch {
      // Column already exists
    }
  },
}
