import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Note: better-sqlite3 is a native module compiled for Electron's Node version
// These tests will only work when run in the Electron context or with matching Node version

describe('SQLite Driver Integration', () => {
  let Database: typeof import('better-sqlite3') | null = null
  let db: import('better-sqlite3').Database | null = null
  let moduleError: string | null = null

  beforeAll(async () => {
    try {
      // Dynamic import to catch module loading errors
      const module = await import('better-sqlite3')
      Database = module.default

      // Use in-memory database for tests
      db = new Database(':memory:')

      // Create a test table
      db.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Insert some test data
      db.exec(`
        INSERT INTO users (name, email) VALUES
          ('John Doe', 'john@example.com'),
          ('Jane Smith', 'jane@example.com'),
          ('Bob Wilson', 'bob@example.com')
      `)
    } catch (error) {
      moduleError = error instanceof Error ? error.message : String(error)
      console.warn('SQLite module not available:', moduleError)
    }
  })

  afterAll(() => {
    if (db) {
      db.close()
    }
  })

  it('should connect to SQLite database', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    expect(db).not.toBeNull()
    expect(db!.open).toBe(true)
  })

  it('should list tables', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const tables = db!.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all()

    expect(Array.isArray(tables)).toBe(true)
    expect(tables.length).toBeGreaterThan(0)
    expect(tables.some((t: any) => t.name === 'users')).toBe(true)
  })

  it('should execute SELECT query', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const rows = db!.prepare('SELECT * FROM users').all()

    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(3)
  })

  it('should get column info', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const columns = db!.prepare('PRAGMA table_info(users)').all()

    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBe(4)
    expect(columns.map((c: any) => c.name)).toContain('id')
    expect(columns.map((c: any) => c.name)).toContain('name')
    expect(columns.map((c: any) => c.name)).toContain('email')
  })

  it('should execute INSERT query', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const result = db!.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Test User', 'test@example.com')

    expect(result.changes).toBe(1)
    expect(result.lastInsertRowid).toBeGreaterThan(0)
  })

  it('should execute UPDATE query', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const result = db!.prepare('UPDATE users SET name = ? WHERE email = ?').run('Updated Name', 'test@example.com')

    expect(result.changes).toBe(1)
  })

  it('should execute DELETE query', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    const result = db!.prepare('DELETE FROM users WHERE email = ?').run('test@example.com')

    expect(result.changes).toBe(1)
  })

  it('should handle invalid query gracefully', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    expect(() => {
      db!.prepare('SELECT * FROM non_existent_table').all()
    }).toThrow()
  })

  it('should create and query indexes', () => {
    if (!db) {
      console.warn('Skipping test - SQLite module not available')
      return
    }
    db!.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')

    const indexes = db!.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'index' AND tbl_name = 'users'
    `).all()

    expect(indexes.some((i: any) => i.name === 'idx_users_email')).toBe(true)
  })
})
