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

describe('migrations', () => {
  let migrations: Migration[]

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    const mod = await import('@main/migrations/index')
    migrations = mod.migrations
  })

  it('should have unique names', () => {
    const names = migrations.map((m) => m.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })

  it('should be ordered sequentially by numeric prefix', () => {
    const names = migrations.map((m) => m.name)
    const prefixes = names.map((name) => parseInt(name.split('_')[0], 10))

    for (let i = 1; i < prefixes.length; i++) {
      expect(prefixes[i]).toBeGreaterThan(prefixes[i - 1])
    }
  })

  it('should export exactly 11 migrations', () => {
    expect(migrations).toHaveLength(11)
  })

  describe('001_create_connections', () => {
    it('should create the connections table', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[0].up(db)

      expect(mockExec).toHaveBeenCalledTimes(1)
      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS connections')
      expect(sql).toContain("'mariadb'")
      expect(sql).toContain("'clickhouse'")
      expect(sql).toContain("'mongodb'")
      expect(sql).toContain("'redis'")
    })
  })

  describe('002_create_query_history', () => {
    it('should create query_history table and index', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[1].up(db)

      expect(mockExec).toHaveBeenCalledTimes(2)
      expect(mockExec.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS query_history')
      expect(mockExec.mock.calls[1][0]).toContain('idx_query_history_connection')
    })
  })

  describe('003_create_saved_queries', () => {
    it('should create saved_queries table', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[2].up(db)

      expect(mockExec).toHaveBeenCalledTimes(1)
      expect(mockExec.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS saved_queries')
    })
  })

  describe('004_create_settings', () => {
    it('should create settings table', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[3].up(db)

      expect(mockExec).toHaveBeenCalledTimes(1)
      expect(mockExec.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS settings')
    })
  })

  describe('005_create_recents', () => {
    it('should create recents table and indexes without dropping', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[4].up(db)

      expect(mockExec).toHaveBeenCalledTimes(3)
      expect(mockExec.mock.calls[0][0]).toContain('CREATE TABLE IF NOT EXISTS recents')
      expect(mockExec.mock.calls[1][0]).toContain('idx_recents_accessed')
      expect(mockExec.mock.calls[2][0]).toContain('idx_recents_unique')

      // Verify no DROP TABLE
      const allSql = mockExec.mock.calls.map((c: unknown[]) => c[0] as string).join(' ')
      expect(allSql).not.toContain('DROP TABLE')
    })
  })

  describe('006_add_connections_ssh_config', () => {
    it('should add ssh_config column', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[5].up(db)

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE connections ADD COLUMN ssh_config TEXT')
    })

    it('should not throw if column already exists', () => {
      const mockExec = vi.fn(() => { throw new Error('duplicate column') })
      const db = { exec: mockExec } as never

      expect(() => migrations[5].up(db)).not.toThrow()
    })
  })

  describe('007_add_connections_environment', () => {
    it('should add environment column', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[6].up(db)

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE connections ADD COLUMN environment TEXT')
    })

    it('should not throw if column already exists', () => {
      const mockExec = vi.fn(() => { throw new Error('duplicate column') })
      const db = { exec: mockExec } as never

      expect(() => migrations[6].up(db)).not.toThrow()
    })
  })

  describe('008_add_connections_folder', () => {
    it('should add folder column', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[7].up(db)

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE connections ADD COLUMN folder TEXT')
    })

    it('should not throw if column already exists', () => {
      const mockExec = vi.fn(() => { throw new Error('duplicate column') })
      const db = { exec: mockExec } as never

      expect(() => migrations[7].up(db)).not.toThrow()
    })
  })

  describe('009_add_connections_sort_order', () => {
    it('should add sort_order column', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[8].up(db)

      expect(mockExec).toHaveBeenCalledWith('ALTER TABLE connections ADD COLUMN sort_order INTEGER DEFAULT 0')
    })

    it('should not throw if column already exists', () => {
      const mockExec = vi.fn(() => { throw new Error('duplicate column') })
      const db = { exec: mockExec } as never

      expect(() => migrations[8].up(db)).not.toThrow()
    })
  })

  describe('011_remove_type_check_constraint', () => {
    it('should recreate connections table without CHECK constraint on type', () => {
      const mockExec = vi.fn()
      const db = { exec: mockExec } as never

      migrations[10].up(db)

      expect(mockExec).toHaveBeenCalledTimes(1)
      const sql = mockExec.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE connections_new')
      expect(sql).toContain('type TEXT NOT NULL')
      expect(sql).not.toContain('CHECK')
      expect(sql).toContain('INSERT INTO connections_new SELECT * FROM connections')
      expect(sql).toContain('DROP TABLE connections')
      expect(sql).toContain('ALTER TABLE connections_new RENAME TO connections')
    })
  })
})
