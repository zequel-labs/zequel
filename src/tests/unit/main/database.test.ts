import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/fake/user/data'),
    isPackaged: false,
  },
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Track mock DB instances
const mockPragma = vi.fn((arg: string) => {
  // Return column info array for table_info pragma calls
  if (typeof arg === 'string' && arg.includes('table_info')) {
    return [{ name: 'id' }, { name: 'connection_id' }, { name: 'database_name' }];
  }
  return undefined;
});
const mockExec = vi.fn();
const mockPrepare = vi.fn();
const mockClose = vi.fn();

const createMockDb = () => ({
  pragma: mockPragma,
  exec: mockExec,
  prepare: mockPrepare,
  close: mockClose,
});

// Must use a function() constructor for `new Database(...)` to work
vi.mock('better-sqlite3', () => {
  const MockDatabase = vi.fn(function (this: ReturnType<typeof createMockDb>) {
    const db = createMockDb();
    Object.assign(this, db);
  });
  return { default: MockDatabase };
});

describe('AppDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset modules so each test gets a fresh AppDatabase singleton
    vi.resetModules();
    // Re-apply prepare mock to return a get() that simulates no existing table
    mockPrepare.mockReturnValue({
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
      run: vi.fn(),
    });
  });

  const loadAppDatabase = async () => {
    const mod = await import('@main/services/database');
    return mod.appDatabase;
  };

  describe('constructor', () => {
    it('should set dbPath using electron userData path', async () => {
      const { existsSync } = await import('fs');
      const { join } = await import('path');

      await loadAppDatabase();

      expect(existsSync).toHaveBeenCalledWith('/fake/user/data');
      expect(join).toHaveBeenCalledWith('/fake/user/data', 'zequel.db');
    });

    it('should create userData directory if it does not exist', async () => {
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValueOnce(false);

      await loadAppDatabase();

      expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/user/data', { recursive: true });
    });
  });

  describe('initialize', () => {
    it('should create a new Database instance with the correct path', async () => {
      const Database = (await import('better-sqlite3')).default;
      const appDb = await loadAppDatabase();

      appDb.initialize();

      expect(Database).toHaveBeenCalledWith('/fake/user/data/zequel.db');
    });

    it('should enable WAL journal mode', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('should enable foreign keys', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should call createTables during initialization', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      // createTables calls db.exec multiple times for various tables
      expect(mockExec).toHaveBeenCalled();
    });

    it('should throw and log error if initialization fails', async () => {
      const Database = (await import('better-sqlite3')).default;
      const { logger } = await import('@main/utils/logger');
      vi.mocked(Database).mockImplementationOnce(() => {
        throw new Error('DB open failed');
      });
      const appDb = await loadAppDatabase();

      expect(() => appDb.initialize()).toThrow('DB open failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize app database', expect.any(Error));
    });
  });

  describe('getDatabase', () => {
    it('should return the database instance after initialization', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();
      const db = appDb.getDatabase();

      expect(db).toBeDefined();
    });

    it('should throw if database is not initialized', async () => {
      const appDb = await loadAppDatabase();

      expect(() => appDb.getDatabase()).toThrow('Database not initialized');
    });
  });

  describe('close', () => {
    it('should close the database and set it to null', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();
      appDb.close();

      expect(mockClose).toHaveBeenCalled();
      expect(() => appDb.getDatabase()).toThrow('Database not initialized');
    });

    it('should be a no-op if database is not initialized', async () => {
      const appDb = await loadAppDatabase();

      // Should not throw
      appDb.close();

      expect(mockClose).not.toHaveBeenCalled();
    });

    it('should log when database is closed', async () => {
      const { logger } = await import('@main/utils/logger');
      const appDb = await loadAppDatabase();

      appDb.initialize();
      appDb.close();

      expect(logger.info).toHaveBeenCalledWith('App database closed');
    });
  });

  describe('createTables (via initialize)', () => {
    it('should create connections table when it does not exist', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      // Should call exec with CREATE TABLE IF NOT EXISTS connections
      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const connectionsCreate = execCalls.find(
        (sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS connections') && !sql.includes('connections_new')
      );
      expect(connectionsCreate).toBeDefined();
    });

    it('should create query_history table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const historyCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS query_history'));
      expect(historyCreate).toBeDefined();
    });

    it('should create saved_queries table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const savedQueriesCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS saved_queries'));
      expect(savedQueriesCreate).toBeDefined();
    });

    it('should create settings table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const settingsCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS settings'));
      expect(settingsCreate).toBeDefined();
    });

    it('should create recents table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const recentsCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS recents'));
      expect(recentsCreate).toBeDefined();
    });

    it('should create bookmarks table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const bookmarksCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS bookmarks'));
      expect(bookmarksCreate).toBeDefined();
    });

    it('should create tab_sessions table', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const tabSessionsCreate = execCalls.find((sql: string) => sql.includes('CREATE TABLE IF NOT EXISTS tab_sessions'));
      expect(tabSessionsCreate).toBeDefined();
    });

    it('should create indexes for query_history', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const indexCreate = execCalls.find((sql: string) => sql.includes('idx_query_history_connection'));
      expect(indexCreate).toBeDefined();
    });

    it('should create unique index for recents', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const uniqueIndex = execCalls.find((sql: string) => sql.includes('idx_recents_unique'));
      expect(uniqueIndex).toBeDefined();
    });

    it('should attempt column migrations silently ignoring errors', async () => {
      // ALTER TABLE ADD COLUMN will throw if column already exists
      mockExec.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('ALTER TABLE connections ADD COLUMN')) {
          throw new Error('duplicate column');
        }
      });
      const appDb = await loadAppDatabase();

      // Should not throw even though ALTER TABLE throws
      expect(() => appDb.initialize()).not.toThrow();
    });

    it('should migrate connections table when missing mariadb in type check', async () => {
      // Simulate an existing table that does NOT include 'mariadb'
      mockPrepare.mockReturnValue({
        get: vi.fn(() => ({ sql: "CREATE TABLE connections (type TEXT CHECK(type IN ('sqlite','mysql','postgresql')))" })),
        all: vi.fn(() => []),
        run: vi.fn(),
      });

      const appDb = await loadAppDatabase();
      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const migrationCreate = execCalls.find((sql: string) => typeof sql === 'string' && sql.includes('connections_new'));
      expect(migrationCreate).toBeDefined();
    });

    it('should create bookmarks index on connection_id', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const bookmarkIdx = execCalls.find((sql: string) => sql.includes('idx_bookmarks_connection'));
      expect(bookmarkIdx).toBeDefined();
    });

    it('should create tab_sessions unique index on connection_id and database_name', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const tabIdx = execCalls.find((sql: string) => sql.includes('idx_tab_sessions_connection_db'));
      expect(tabIdx).toBeDefined();
    });

    it('should drop recents table before recreating', async () => {
      const appDb = await loadAppDatabase();

      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const dropRecents = execCalls.find((sql: string) => sql.includes('DROP TABLE IF EXISTS recents'));
      expect(dropRecents).toBeDefined();
    });

    it('should add database_name column to tab_sessions when it is missing', async () => {
      // Simulate table_info returning columns WITHOUT database_name
      mockPragma.mockImplementation((arg: string) => {
        if (typeof arg === 'string' && arg.includes('table_info(tab_sessions)')) {
          return [{ name: 'id' }, { name: 'connection_id' }];
        }
        if (typeof arg === 'string' && arg.includes('table_info')) {
          return [{ name: 'id' }, { name: 'connection_id' }, { name: 'database_name' }];
        }
        return undefined;
      });

      const appDb = await loadAppDatabase();
      appDb.initialize();

      const execCalls = mockExec.mock.calls.map((c: unknown[]) => c[0] as string);
      const addDbNameCol = execCalls.find(
        (sql: string) => typeof sql === 'string' && sql.includes('ALTER TABLE tab_sessions ADD COLUMN database_name')
      );
      expect(addDbNameCol).toBeDefined();
    });

    it('should handle DROP TABLE IF EXISTS recents error silently', async () => {
      const originalExec = mockExec.getMockImplementation();
      mockExec.mockImplementation((sql: string) => {
        if (typeof sql === 'string' && sql.includes('DROP TABLE IF EXISTS recents')) {
          throw new Error('Cannot drop table');
        }
        if (originalExec) return originalExec(sql);
      });

      const appDb = await loadAppDatabase();

      // Should not throw
      expect(() => appDb.initialize()).not.toThrow();
    });
  });
});
