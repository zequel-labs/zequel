import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { logger } from '@main/utils/logger'
import { runMigrations, freshMigrations } from './migrationRunner'
import { migrations } from '@main/migrations'

class AppDatabase {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    const dbName = is.dev ? 'zequel-dev.db' : 'zequel.db'
    this.dbPath = join(userDataPath, dbName)
  }

  initialize(): void {
    try {
      logger.info('Initializing app database', { path: this.dbPath })

      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')

      runMigrations(this.db, migrations)

      logger.info('App database initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize app database', error)
      throw error
    }
  }

  fresh(): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    freshMigrations(this.db, migrations)
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized')
    }
    return this.db
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      logger.info('App database closed')
    }
  }
}

export const appDatabase = new AppDatabase()
