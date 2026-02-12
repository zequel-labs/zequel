import Database from 'better-sqlite3'
import { logger } from '@main/utils/logger'

interface TableRow {
  name: string
}

export interface Migration {
  name: string
  up: (db: Database.Database) => void
}

export const runMigrations = (db: Database.Database, migrations: readonly Migration[]): void => {
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, run_at TEXT)')

  const rows = db.prepare('SELECT name FROM migrations').all() as TableRow[]
  const completed = new Set(rows.map((row) => row.name))

  const record = db.prepare('INSERT INTO migrations (name, run_at) VALUES (?, ?)')

  for (const migration of migrations) {
    if (completed.has(migration.name)) {
      continue
    }

    logger.info(`Running migration: ${migration.name}`)

    db.transaction(() => {
      migration.up(db)
      record.run(migration.name, new Date().toISOString())
    })()

    logger.info(`Migration completed: ${migration.name}`)
  }
}

export const freshMigrations = (db: Database.Database, migrations: readonly Migration[]): void => {
  logger.info('Running migrate:fresh — dropping all tables')

  db.pragma('foreign_keys = OFF')

  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  ).all() as TableRow[]

  for (const { name } of tables) {
    db.exec(`DROP TABLE IF EXISTS "${name}"`)
    logger.info(`Dropped table: ${name}`)
  }

  db.pragma('foreign_keys = ON')

  runMigrations(db, migrations)

  logger.info('migrate:fresh completed')
}
