import { describe, it, expect, vi, beforeEach } from 'vitest'

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

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}))

// Mock electron-toolkit
vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true },
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

// Mock migrationRunner
const mockRunMigrations = vi.fn()
const mockFreshMigrations = vi.fn()
vi.mock('@main/services/migrationRunner', () => ({
  runMigrations: mockRunMigrations,
  freshMigrations: mockFreshMigrations,
}))

// Mock migrations
const mockMigrations = [{ name: 'test_migration', up: vi.fn() }]
vi.mock('@main/migrations', () => ({
  migrations: mockMigrations,
}))

// Track mock DB instances
const mockPragma = vi.fn()
const mockExec = vi.fn()
const mockPrepare = vi.fn()
const mockClose = vi.fn()

const createMockDb = () => ({
  pragma: mockPragma,
  exec: mockExec,
  prepare: mockPrepare,
  close: mockClose,
})

// Must use a function() constructor for `new Database(...)` to work
vi.mock('better-sqlite3', () => {
  const MockDatabase = vi.fn(function (this: ReturnType<typeof createMockDb>) {
    const db = createMockDb()
    Object.assign(this, db)
  })
  return { default: MockDatabase }
})

describe('AppDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  const loadAppDatabase = async () => {
    const mod = await import('@main/services/database')
    return mod.appDatabase
  }

  describe('constructor', () => {
    it('should set dbPath using electron userData path', async () => {
      const { existsSync } = await import('fs')
      const { join } = await import('path')

      await loadAppDatabase()

      expect(existsSync).toHaveBeenCalledWith('/fake/user/data')
      expect(join).toHaveBeenCalledWith('/fake/user/data', 'zequel-dev.db')
    })

    it('should create userData directory if it does not exist', async () => {
      const fs = await import('fs')
      vi.mocked(fs.existsSync).mockReturnValueOnce(false)

      await loadAppDatabase()

      expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/user/data', { recursive: true })
    })
  })

  describe('initialize', () => {
    it('should create a new Database instance with the correct path', async () => {
      const Database = (await import('better-sqlite3')).default
      const appDb = await loadAppDatabase()

      appDb.initialize()

      expect(Database).toHaveBeenCalledWith('/fake/user/data/zequel-dev.db')
    })

    it('should enable WAL journal mode', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()

      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL')
    })

    it('should enable foreign keys', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()

      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON')
    })

    it('should call runMigrations with the database and migrations', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()

      expect(mockRunMigrations).toHaveBeenCalledTimes(1)
      expect(mockRunMigrations).toHaveBeenCalledWith(
        expect.objectContaining({ pragma: expect.any(Function) }),
        mockMigrations
      )
    })

    it('should throw and log error if initialization fails', async () => {
      const Database = (await import('better-sqlite3')).default
      const { logger } = await import('@main/utils/logger')
      vi.mocked(Database).mockImplementationOnce(() => {
        throw new Error('DB open failed')
      })
      const appDb = await loadAppDatabase()

      expect(() => appDb.initialize()).toThrow('DB open failed')
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize app database', expect.any(Error))
    })

    it('should propagate migration errors', async () => {
      mockRunMigrations.mockImplementationOnce(() => {
        throw new Error('migration failed')
      })
      const appDb = await loadAppDatabase()

      expect(() => appDb.initialize()).toThrow('migration failed')
    })
  })

  describe('fresh', () => {
    it('should call freshMigrations with the database and migrations', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()
      appDb.fresh()

      expect(mockFreshMigrations).toHaveBeenCalledTimes(1)
      expect(mockFreshMigrations).toHaveBeenCalledWith(
        expect.objectContaining({ pragma: expect.any(Function) }),
        mockMigrations
      )
    })

    it('should throw if database is not initialized', async () => {
      const appDb = await loadAppDatabase()

      expect(() => appDb.fresh()).toThrow('Database not initialized')
    })
  })

  describe('getDatabase', () => {
    it('should return the database instance after initialization', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()
      const db = appDb.getDatabase()

      expect(db).toBeDefined()
    })

    it('should throw if database is not initialized', async () => {
      const appDb = await loadAppDatabase()

      expect(() => appDb.getDatabase()).toThrow('Database not initialized')
    })
  })

  describe('close', () => {
    it('should close the database and set it to null', async () => {
      const appDb = await loadAppDatabase()

      appDb.initialize()
      appDb.close()

      expect(mockClose).toHaveBeenCalled()
      expect(() => appDb.getDatabase()).toThrow('Database not initialized')
    })

    it('should be a no-op if database is not initialized', async () => {
      const appDb = await loadAppDatabase()

      // Should not throw
      appDb.close()

      expect(mockClose).not.toHaveBeenCalled()
    })

    it('should log when database is closed', async () => {
      const { logger } = await import('@main/utils/logger')
      const appDb = await loadAppDatabase()

      appDb.initialize()
      appDb.close()

      expect(logger.info).toHaveBeenCalledWith('App database closed')
    })
  })
})
