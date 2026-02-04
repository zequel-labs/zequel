import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { logger } from '../utils/logger'

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

      this.createTables()

      logger.info('App database initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize app database', error)
      throw error
    }
  }

  private createTables(): void {
    // Connections table - v2 with mariadb support
    // Check if we need to migrate the table (add mariadb to type constraint)
    const tableInfo = this.db!.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='connections'").get() as { sql: string } | undefined

    if (tableInfo && (!tableInfo.sql.includes('mariadb') || !tableInfo.sql.includes('clickhouse') || !tableInfo.sql.includes('mongodb') || !tableInfo.sql.includes('redis'))) {
      // Migrate: SQLite doesn't support ALTER CHECK, so we recreate the table
      logger.info('Migrating connections table to support MariaDB, ClickHouse, MongoDB, and Redis...')

      this.db!.exec(`
        CREATE TABLE IF NOT EXISTS connections_new (
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

      this.db!.exec(`
        INSERT INTO connections_new (id, name, type, host, port, database, username, filepath, ssl, ssl_config, ssh_config, created_at, updated_at, last_connected_at)
        SELECT id, name, type, host, port, database, username, filepath, ssl, ssl_config, ssh_config, created_at, updated_at, last_connected_at
        FROM connections
      `)

      this.db!.exec(`DROP TABLE connections`)
      this.db!.exec(`ALTER TABLE connections_new RENAME TO connections`)

      logger.info('Connections table migrated successfully')
    } else if (!tableInfo) {
      // Create new table
      this.db!.exec(`
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
    }

    // Migration: Add ssh_config column if it doesn't exist
    try {
      this.db!.exec(`ALTER TABLE connections ADD COLUMN ssh_config TEXT`)
      logger.debug('Added ssh_config column to connections table')
    } catch {
      // Column already exists, ignore
    }

    // Migration: Add environment column if it doesn't exist
    try {
      this.db!.exec(`ALTER TABLE connections ADD COLUMN environment TEXT`)
      logger.debug('Added environment column to connections table')
    } catch {
      // Column already exists, ignore
    }

    // Migration: Add folder column if it doesn't exist
    try {
      this.db!.exec(`ALTER TABLE connections ADD COLUMN folder TEXT`)
      logger.debug('Added folder column to connections table')
    } catch {
      // Column already exists, ignore
    }

    // Migration: Add sort_order column if it doesn't exist
    try {
      this.db!.exec(`ALTER TABLE connections ADD COLUMN sort_order INTEGER DEFAULT 0`)
      logger.debug('Added sort_order column to connections table')
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

    // Bookmarks table
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('table', 'view', 'query')),
        name TEXT NOT NULL,
        connection_id TEXT NOT NULL,
        database TEXT,
        schema TEXT,
        sql TEXT,
        folder TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    this.db!.exec(`
      CREATE INDEX IF NOT EXISTS idx_bookmarks_connection
      ON bookmarks(connection_id)
    `)

    // Tab sessions table for persisting open tabs across restarts
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS tab_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        connection_id TEXT NOT NULL,
        database_name TEXT NOT NULL DEFAULT '',
        tabs_json TEXT NOT NULL,
        active_tab_id TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    // Migrate: add database_name column if missing (existing installs)
    const tabSessionsCols = this.db!.pragma('table_info(tab_sessions)') as { name: string }[]
    if (!tabSessionsCols.some(c => c.name === 'database_name')) {
      this.db!.exec(`ALTER TABLE tab_sessions ADD COLUMN database_name TEXT NOT NULL DEFAULT ''`)
    }

    // Migrate: drop old unique index on connection_id only, create composite one
    this.db!.exec(`DROP INDEX IF EXISTS idx_tab_sessions_connection`)

    this.db!.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tab_sessions_connection_db
      ON tab_sessions(connection_id, database_name)
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
