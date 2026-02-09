import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Migration } from '@main/services/migrationRunner'

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/fake/user/data'),
    isPackaged: false,
  },
}))

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}))

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('runMigrations', () => {
  let runMigrations: typeof import('@main/services/migrationRunner').runMigrations
  let freshMigrations: typeof import('@main/services/migrationRunner').freshMigrations

  const createMockDb = (completedMigrations: string[] = [], existingTables: string[] = []) => {
    const mockRecordRun = vi.fn()
    const mockAll = vi.fn(() => completedMigrations.map((name) => ({ name })))

    const mockPrepare = vi.fn((sql: string) => {
      if (sql === 'SELECT name FROM migrations') {
        return { all: mockAll }
      }
      if (sql.includes('sqlite_master')) {
        return { all: vi.fn(() => existingTables.map((name) => ({ name }))) }
      }
      return { run: mockRecordRun }
    })

    const mockExec = vi.fn()
    const mockPragma = vi.fn()

    const mockTransaction = vi.fn((fn: () => void) => {
      return () => fn()
    })

    return {
      exec: mockExec,
      prepare: mockPrepare,
      pragma: mockPragma,
      transaction: mockTransaction,
      mockRecordRun,
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@main/services/migrationRunner')
    runMigrations = mod.runMigrations
    freshMigrations = mod.freshMigrations
  })

  it('should create the migrations table', () => {
    const db = createMockDb()

    runMigrations(db as never, [])

    expect(db.exec).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, run_at TEXT)'
    )
  })

  it('should run pending migrations in order', () => {
    const db = createMockDb()
    const order: string[] = []

    const m1: Migration = { name: 'mig_1', up: () => { order.push('mig_1') } }
    const m2: Migration = { name: 'mig_2', up: () => { order.push('mig_2') } }

    runMigrations(db as never, [m1, m2])

    expect(order).toEqual(['mig_1', 'mig_2'])
  })

  it('should skip already-completed migrations', () => {
    const db = createMockDb(['mig_1'])
    const upFn = vi.fn()

    const m1: Migration = { name: 'mig_1', up: upFn }
    const m2: Migration = { name: 'mig_2', up: vi.fn() }

    runMigrations(db as never, [m1, m2])

    expect(upFn).not.toHaveBeenCalled()
    expect(m2.up).toHaveBeenCalled()
  })

  it('should record each migration after success', () => {
    const db = createMockDb()
    const m1: Migration = { name: 'mig_1', up: vi.fn() }

    runMigrations(db as never, [m1])

    expect(db.mockRecordRun).toHaveBeenCalledWith('mig_1', expect.any(String))
  })

  it('should wrap each migration in a transaction', () => {
    const db = createMockDb()
    const m1: Migration = { name: 'mig_1', up: vi.fn() }

    runMigrations(db as never, [m1])

    expect(db.transaction).toHaveBeenCalledTimes(1)
  })

  it('should propagate errors from migration up()', () => {
    const db = createMockDb()
    const m1: Migration = {
      name: 'mig_1',
      up: () => { throw new Error('migration failed') },
    }

    expect(() => runMigrations(db as never, [m1])).toThrow('migration failed')
  })

  it('should be a no-op for empty migrations array', () => {
    const db = createMockDb()

    runMigrations(db as never, [])

    // Only the CREATE TABLE call for the migrations table itself
    expect(db.exec).toHaveBeenCalledTimes(1)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('should log each migration run', async () => {
    const { logger } = await import('@main/utils/logger')
    const db = createMockDb()
    const m1: Migration = { name: 'mig_1', up: vi.fn() }

    runMigrations(db as never, [m1])

    expect(logger.info).toHaveBeenCalledWith('Running migration: mig_1')
    expect(logger.info).toHaveBeenCalledWith('Migration completed: mig_1')
  })

  describe('freshMigrations', () => {
    it('should disable foreign keys before dropping tables', () => {
      const db = createMockDb([], ['connections', 'settings'])

      freshMigrations(db as never, [])

      expect(db.pragma).toHaveBeenCalledWith('foreign_keys = OFF')
      expect(db.pragma).toHaveBeenCalledWith('foreign_keys = ON')

      const pragmaCalls = db.pragma.mock.calls.map((c: unknown[]) => c[0])
      expect(pragmaCalls.indexOf('foreign_keys = OFF')).toBeLessThan(
        pragmaCalls.indexOf('foreign_keys = ON')
      )
    })

    it('should drop all existing tables', () => {
      const db = createMockDb([], ['connections', 'query_history', 'migrations'])

      freshMigrations(db as never, [])

      expect(db.exec).toHaveBeenCalledWith('DROP TABLE IF EXISTS "connections"')
      expect(db.exec).toHaveBeenCalledWith('DROP TABLE IF EXISTS "query_history"')
      expect(db.exec).toHaveBeenCalledWith('DROP TABLE IF EXISTS "migrations"')
    })

    it('should re-run all migrations after dropping tables', () => {
      const db = createMockDb([], ['connections'])
      const order: string[] = []

      const m1: Migration = { name: 'mig_1', up: () => { order.push('mig_1') } }
      const m2: Migration = { name: 'mig_2', up: () => { order.push('mig_2') } }

      freshMigrations(db as never, [m1, m2])

      expect(order).toEqual(['mig_1', 'mig_2'])
    })

    it('should work with no existing tables', () => {
      const db = createMockDb([], [])
      const m1: Migration = { name: 'mig_1', up: vi.fn() }

      freshMigrations(db as never, [m1])

      expect(m1.up).toHaveBeenCalled()
    })

    it('should log each dropped table', async () => {
      const { logger } = await import('@main/utils/logger')
      const db = createMockDb([], ['connections', 'settings'])

      freshMigrations(db as never, [])

      expect(logger.info).toHaveBeenCalledWith('Running migrate:fresh — dropping all tables')
      expect(logger.info).toHaveBeenCalledWith('Dropped table: connections')
      expect(logger.info).toHaveBeenCalledWith('Dropped table: settings')
      expect(logger.info).toHaveBeenCalledWith('migrate:fresh completed')
    })
  })
})
