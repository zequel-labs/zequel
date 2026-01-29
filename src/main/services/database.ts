import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { logger } from '../utils/logger'

class AppDatabase {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }
    this.dbPath = join(userDataPath, 'db-studio.db')
  }

  initialize(): void {
    try {
      logger.info('Initializing app database', { path: this.dbPath })

      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')

      this.createTables()

      logger.info('App database initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize app database', error)
      throw error
    }
  }

  private createTables(): void {
    // Connections table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('sqlite', 'mysql', 'postgresql')),
        host TEXT,
        port INTEGER,
        database TEXT NOT NULL,
        username TEXT,
        filepath TEXT,
        ssl INTEGER DEFAULT 0,
        ssl_config TEXT,
        ssh_config TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_connected_at TEXT
      )
    `)

    // Migration: Add ssh_config column if it doesn't exist
    try {
      this.db!.exec(`ALTER TABLE connections ADD COLUMN ssh_config TEXT`)
      logger.debug('Added ssh_config column to connections table')
    } catch {
      // Column already exists, ignore
    }

    // Query history table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        sql TEXT NOT NULL,
        execution_time INTEGER,
        row_count INTEGER,
        error TEXT,
        executed_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )
    `)

    // Create index for faster query history lookups
    this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_query_history_connection
      ON query_history(connection_id, executed_at DESC)
    `)

    // Saved queries (favorites)
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS saved_queries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT,
        name TEXT NOT NULL,
        sql TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE SET NULL
      )
    `)

    // App settings table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Recent items table (recreate without foreign key for flexibility)
    try {
      this.db!.exec(`DROP TABLE IF EXISTS recents`)
    } catch {
      // Ignore if table doesn't exist
    }

    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS recents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('table', 'view', 'query')),
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        database TEXT,
        schema TEXT,
        sql TEXT,
        accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Create index for faster recent lookups
    this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_recents_accessed
      ON recents(accessed_at DESC)
    `)

    // Create unique index to prevent duplicates
    this.db!.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_recents_unique
      ON recents(type, name, connection_id)
    `)

    logger.debug('Database tables created/verified')
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
