import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { join } from 'path';

// Use vi.hoisted to declare mocks before vi.mock factories (which are hoisted)
const {
  mockExistsSync,
  mockCreateReadStream,
  mockCreateWriteStream,
  mockExecSync,
  mockExecFileSync,
  mockSpawn,
  mockSettingsGet,
  mockConnectionsGet,
  mockGetPassword,
  mockHasTunnel,
  mockGetLocalPort,
  mockUnlink,
  mockRename,
  mockStat,
  mockWriteFile,
  mockMkdtemp,
  mockRm,
  mockRmdir,
  mockArchiverInstance,
  mockArchiver,
} = vi.hoisted(() => {
  const archiverInstance = {
    on: vi.fn(),
    pipe: vi.fn(),
    directory: vi.fn(),
    file: vi.fn(),
    finalize: vi.fn(),
  };
  return {
    mockExistsSync: vi.fn(),
    mockCreateReadStream: vi.fn(),
    mockCreateWriteStream: vi.fn(),
    mockExecSync: vi.fn(),
    mockExecFileSync: vi.fn(),
    mockSpawn: vi.fn(),
    mockSettingsGet: vi.fn(() => null as string | null),
    mockConnectionsGet: vi.fn(),
    mockGetPassword: vi.fn(() => Promise.resolve(null as string | null)),
    mockHasTunnel: vi.fn(() => false),
    mockGetLocalPort: vi.fn(() => null as number | null),
    mockUnlink: vi.fn(() => Promise.resolve()),
    mockRename: vi.fn(() => Promise.resolve()),
    mockStat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
    mockWriteFile: vi.fn(() => Promise.resolve()),
    mockMkdtemp: vi.fn(() => Promise.resolve('/tmp/zequel-ssl-abc123')),
    mockRm: vi.fn(() => Promise.resolve()),
    mockRmdir: vi.fn(() => Promise.resolve()),
    mockArchiverInstance: archiverInstance,
    mockArchiver: vi.fn(() => archiverInstance),
  };
});

// Mock electron
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]),
  },
}));

// Mock child_process
vi.mock('child_process', () => ({
  spawn: mockSpawn,
  execSync: mockExecSync,
  execFileSync: mockExecFileSync,
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  createReadStream: mockCreateReadStream,
  createWriteStream: mockCreateWriteStream,
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  unlink: mockUnlink,
  rename: mockRename,
  stat: mockStat,
  writeFile: mockWriteFile,
  mkdtemp: mockMkdtemp,
  rm: mockRm,
  rmdir: mockRmdir,
}));

// Mock archiver
vi.mock('archiver', () => ({
  default: mockArchiver,
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

// Mock settings service
vi.mock('@main/services/settings', () => ({
  settingsService: {
    get: mockSettingsGet,
  },
}));

// Mock connections service
vi.mock('@main/services/connections', () => ({
  connectionsService: {
    get: mockConnectionsGet,
  },
}));

// Mock keychain service
vi.mock('@main/services/keychain', () => ({
  keychainService: {
    getPassword: mockGetPassword,
  },
}));

// Mock SSH tunnel manager
vi.mock('@main/services/ssh-tunnel', () => ({
  sshTunnelManager: {
    hasTunnel: mockHasTunnel,
    getLocalPort: mockGetLocalPort,
  },
}));

import { backupService } from '@main/services/backup';
import {
  DatabaseType,
  BackupEntityType,
  BackupStatus,
  SSLMode,
  type SavedConnection,
  type BackupConfig,
  type RestoreConfig,
} from '@main/types';

// ── Platform-aware helpers for cross-platform test assertions ──────────────
const isWin = process.platform === 'win32';
const binExt = isWin ? '.exe' : '';
const killSignal = isWin ? 'SIGKILL' : 'SIGTERM';
const whichCmd = (bin: string) => isWin ? `where ${bin}` : `which ${bin}`;

/** First search dir per platform — used to build expected paths in binary detection tests. */
const SEARCH_DIRS: Record<string, string> = isWin
  ? {
    pg: 'C:\\Program Files\\PostgreSQL\\17\\bin',
    mysql: 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin',
    sqlite: 'C:\\Program Files\\PostgreSQL\\17\\bin',  // sqlite3 ships with PG on Windows
    clickhouse: 'C:\\tools\\',
    mongodb: 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin',
    redis: 'C:\\Program Files\\Redis\\',
    mariadb: 'C:\\Program Files\\MariaDB 11.4\\bin',
    sqlserver: 'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn',
    duckdb: 'C:\\tools\\',
  }
  : {
    pg: '/opt/homebrew/bin',
    mysql: '/usr/local/bin',
    sqlite: '/usr/bin',
    clickhouse: '/usr/local/bin',
    mongodb: '/opt/homebrew/bin',
    redis: '/opt/homebrew/bin',
    mariadb: '/opt/homebrew/bin',
    sqlserver: '/opt/mssql-tools18/bin',
    duckdb: '/opt/homebrew/bin',
  };

describe('BackupService', () => {
  const mockPostgresConnection: SavedConnection = {
    id: 'conn-pg-1',
    name: 'Test PostgreSQL',
    type: DatabaseType.PostgreSQL,
    host: 'localhost',
    port: 5432,
    database: 'testdb',
    username: 'testuser',
    filepath: null,
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  const mockMySQLConnection: SavedConnection = {
    id: 'conn-mysql-1',
    name: 'Test MySQL',
    type: DatabaseType.MySQL,
    host: 'localhost',
    port: 3306,
    database: 'testdb',
    username: 'testuser',
    filepath: null,
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  const mockSQLiteConnection: SavedConnection = {
    id: 'conn-sqlite-1',
    name: 'Test SQLite',
    type: DatabaseType.SQLite,
    host: null,
    port: null,
    database: 'test.db',
    username: null,
    filepath: '/path/to/test.db',
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  const mockClickHouseConnection: SavedConnection = {
    id: 'conn-clickhouse-1',
    name: 'Test ClickHouse',
    type: DatabaseType.ClickHouse,
    host: 'localhost',
    port: 8123,
    database: 'testdb',
    username: 'testuser',
    filepath: null,
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  const mockMongoDBConnection: SavedConnection = {
    id: 'conn-mongodb-1',
    name: 'Test MongoDB',
    type: DatabaseType.MongoDB,
    host: 'localhost',
    port: 27017,
    database: 'testdb',
    username: 'testuser',
    filepath: null,
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  const mockRedisConnection: SavedConnection = {
    id: 'conn-redis-1',
    name: 'Test Redis',
    type: DatabaseType.Redis,
    host: 'localhost',
    port: 6379,
    database: '0',
    username: null,
    filepath: null,
    ssl: false,
    sslConfig: null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    sortOrder: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastConnectedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsGet.mockReturnValue(null);
    mockConnectionsGet.mockReturnValue(null);
    mockGetPassword.mockResolvedValue(null);
    mockHasTunnel.mockReturnValue(false);
    mockGetLocalPort.mockReturnValue(null);
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockReset();
    mockExecFileSync.mockReset();
  });

  // ─── Binary Detection Tests ────────────────────────────────────────────

  describe('detectBackupBinary', () => {
    it('should return saved path from settings when it exists', () => {
      const savedPath = '/custom/path/pg_dump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(mockSettingsGet).toHaveBeenCalledWith('backup.binary.postgresql');
      expect(result).toEqual({ path: savedPath, found: true, version: null, warning: null });
    });

    it('should return not found when saved path does not exist', () => {
      mockSettingsGet.mockReturnValue('/nonexistent/pg_dump');
      mockExistsSync.mockReturnValue(false);

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result.found).toBe(false);
    });

    it('should scan common directories and find binary', () => {
      const expected = join(SEARCH_DIRS.pg, `pg_dump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result).toEqual({ path: expected, found: true, version: null, warning: null });
    });

    it('should fallback to which/where command when binary not in common dirs', () => {
      // Return a path that is NOT in search dirs so the scan doesn't short-circuit
      const whichResult = isWin ? 'D:\\custom\\pg_dump.exe' : '/some/unusual/path/pg_dump';
      mockExecSync.mockReturnValue(whichResult + (isWin ? '\r\n' : '\n'));
      mockExistsSync.mockImplementation((path: string) => {
        return path === whichResult;
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(mockExecSync).toHaveBeenCalledWith(whichCmd('pg_dump'), { encoding: 'utf-8', timeout: 5000 });
      expect(result).toEqual({ path: whichResult, found: true, version: null, warning: null });
    });

    it('should return not found when which command fails', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result).toEqual({ path: null, found: false, version: null, warning: null });
    });

    it('should detect version from binary --version output', () => {
      const savedPath = '/opt/homebrew/bin/pg_dump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue('pg_dump (PostgreSQL) 16.2\n');

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result).toEqual({ path: savedPath, found: true, version: '16.2', warning: null });
    });

    it('should return warning for MySQL 9.x binary', () => {
      const savedPath = '/opt/homebrew/bin/mysqldump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue('mysqldump  Ver 9.4.0 for macos14 on arm64\n');

      const result = backupService.detectBackupBinary(DatabaseType.MySQL);

      expect(result.found).toBe(true);
      expect(result.version).toBe('9.4.0');
      expect(result.warning).toContain('mysql_native_password');
    });

    it('should not return warning for MySQL 8.x binary', () => {
      const savedPath = '/opt/homebrew/bin/mysqldump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue('mysqldump  Ver 8.0.39 for macos14 on arm64\n');

      const result = backupService.detectBackupBinary(DatabaseType.MySQL);

      expect(result.found).toBe(true);
      expect(result.version).toBe('8.0.39');
      expect(result.warning).toBeNull();
    });

    it('should detect MySQL binary', () => {
      const expected = join(SEARCH_DIRS.mysql, `mysqldump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.MySQL);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect SQLite binary', () => {
      const expected = join(SEARCH_DIRS.sqlite, `sqlite3${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.SQLite);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect MongoDB binary', () => {
      const expected = join(SEARCH_DIRS.mongodb, `mongodump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.MongoDB);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect ClickHouse binary with fallback', () => {
      const expected = join(SEARCH_DIRS.clickhouse, `clickhouse${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.ClickHouse);

      expect(result.found).toBe(true);
    });

    it('should detect MariaDB binary with fallback to mysqldump', () => {
      const expected = join(SEARCH_DIRS.mariadb, `mysqldump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.MariaDB);

      expect(result.found).toBe(true);
    });
  });

  describe('detectRestoreBinary', () => {
    it('should return saved path from settings when it exists', () => {
      const savedPath = '/custom/path/psql';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);

      const result = backupService.detectRestoreBinary(DatabaseType.PostgreSQL);

      expect(mockSettingsGet).toHaveBeenCalledWith('restore.binary.postgresql');
      expect(result).toEqual({ path: savedPath, found: true, version: null, warning: null });
    });

    it('should scan common directories for psql', () => {
      const expected = join(SEARCH_DIRS.pg, `psql${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectRestoreBinary(DatabaseType.PostgreSQL);

      expect(result.found).toBe(true);
    });

    it('should detect mysql restore binary', () => {
      const expected = join(SEARCH_DIRS.mysql, `mysql${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectRestoreBinary(DatabaseType.MySQL);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect mongorestore binary', () => {
      const expected = join(SEARCH_DIRS.mongodb, `mongorestore${binExt}`);
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectRestoreBinary(DatabaseType.MongoDB);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should return not found for unsupported database type', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = backupService.detectRestoreBinary(DatabaseType.SQLite);

      expect(result.found).toBe(false);
    });
  });

  // ─── Backup Command Building Tests ────────────────────────────────────

  describe('buildBackupCommand', () => {
    describe('PostgreSQL', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [
          { name: 'users', schema: 'public', type: BackupEntityType.Table },
          { name: 'orders', schema: 'public', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build pg_dump command with host, port, username, and database', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.binary).toBe('/usr/bin/pg_dump');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('5432');
        expect(result.args).toContain('--username');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('--dbname=testdb');
      });

      it('should include table filtering with schema qualification', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--table="public"."users"');
        expect(result.args).toContain('--table="public"."orders"');
      });

      it('should throw when database name is empty', async () => {
        const connWithoutDb = { ...mockPostgresConnection, database: '' };
        await expect(backupService.buildBackupCommand(backupConfig, connWithoutDb, null))
          .rejects.toThrow('Database name is required');
      });

      it('should set PGPASSWORD environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, 'secret123');

        expect(result.env['PGPASSWORD']).toBe('secret123');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, 'secret123');

        expect(result.displayCommand).toContain('PGPASSWORD=********');
        expect(result.displayCommand).not.toContain('secret123');
      });

      it('should include format and file arguments', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--format=plain');
        expect(result.args).toContain('--file=/tmp/backup.sql');
      });

      it('should add options flags when specified', async () => {
        const configWithOptions: BackupConfig = {
          ...backupConfig,
          options: {
            'inserts': true,
            'no-owner': true,
            'no-privileges': true,
            'clean': true,
            'create': true,
            'data-only': true,
            'schema-only': false,
            'verbose': true,
          },
        };

        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(configWithOptions, mockPostgresConnection, null);

        expect(result.args).toContain('--inserts');
        expect(result.args).toContain('--no-owner');
        expect(result.args).toContain('--no-privileges');
        expect(result.args).toContain('--clean');
        expect(result.args).toContain('--create');
        expect(result.args).toContain('--data-only');
        expect(result.args).not.toContain('--schema-only');
        expect(result.args).toContain('--verbose');
      });

      it('should append custom arguments', async () => {
        const configWithCustomArgs: BackupConfig = {
          ...backupConfig,
          customArgs: '--exclude-table=logs --lock-wait-timeout=10',
        };

        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(configWithCustomArgs, mockPostgresConnection, null);

        expect(result.args).toContain('--exclude-table=logs');
        expect(result.args).toContain('--lock-wait-timeout=10');
      });
    });

    describe('MySQL', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [
          { name: 'users', type: BackupEntityType.Table },
          { name: 'orders', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build mysqldump command with host, port, user, and database', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMySQLConnection, null);

        expect(result.binary).toBe('/usr/bin/mysqldump');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('3306');
        expect(result.args).toContain('--user');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('testdb');
      });

      it('should include result-file argument', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMySQLConnection, null);

        expect(result.args).toContain('--result-file=/tmp/backup.sql');
      });

      it('should include tables when entities specified', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMySQLConnection, null);

        expect(result.args).toContain('--tables');
        expect(result.args).toContain('users');
        expect(result.args).toContain('orders');
      });

      it('should throw when database name is empty', async () => {
        const connWithoutDb = { ...mockMySQLConnection, database: '' };
        await expect(backupService.buildBackupCommand(backupConfig, connWithoutDb, null))
          .rejects.toThrow('Database name is required');
      });

      it('should set MYSQL_PWD environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMySQLConnection, 'mypassword');

        expect(result.env['MYSQL_PWD']).toBe('mypassword');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMySQLConnection, 'mypassword');

        expect(result.displayCommand).toContain('MYSQL_PWD=********');
        expect(result.displayCommand).not.toContain('mypassword');
      });

      it('should add MySQL-specific options', async () => {
        const configWithOptions: BackupConfig = {
          ...backupConfig,
          options: {
            'single-transaction': true,
            'routines': true,
            'triggers': true,
            'events': true,
            'add-drop-table': true,
            'no-create-info': true,
            'no-data': false,
          },
        };

        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildBackupCommand(configWithOptions, mockMySQLConnection, null);

        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--routines');
        expect(result.args).toContain('--triggers');
        expect(result.args).toContain('--events');
        expect(result.args).toContain('--add-drop-table');
        expect(result.args).toContain('--no-create-info');
        expect(result.args).not.toContain('--no-data');
      });

      it('should place --tables after database name and all options', async () => {
        const configWithEntitiesAndOptions: BackupConfig = {
          connectionId: 'conn-mysql-1',
          entities: [
            { name: 'users', type: BackupEntityType.Table },
            { name: 'orders', type: BackupEntityType.Table },
          ],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/mysqldump',
          compress: false,
          customArgs: '',
          options: {
            'single-transaction': true,
            'routines': true,
          },
        };

        const result = await backupService.buildBackupCommand(configWithEntitiesAndOptions, mockMySQLConnection, null);

        const dbIdx = result.args.indexOf('testdb');
        const tablesIdx = result.args.indexOf('--tables');
        const singleTxIdx = result.args.indexOf('--single-transaction');
        const routinesIdx = result.args.indexOf('--routines');

        // All flags must come BEFORE the database name
        expect(singleTxIdx).toBeLessThan(dbIdx);
        expect(routinesIdx).toBeLessThan(dbIdx);
        // --tables must come after the database name
        expect(tablesIdx).toBeGreaterThan(dbIdx);
        // Table names must be the very last args
        expect(result.args.slice(tablesIdx + 1)).toEqual(['users', 'orders']);
      });
    });

    describe('SQLite', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [
          { name: 'users', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build sqlite3 dump command with filepath', async () => {
        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockSQLiteConnection, null);

        expect(result.binary).toBe('/usr/bin/sqlite3');
        expect(result.args[0]).toBe('/path/to/test.db');
      });

      it('should include .dump command for specific tables', async () => {
        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockSQLiteConnection, null);

        expect(result.args[1]).toBe('.dump "users"');
      });

      it('should use .dump for all tables when no entities specified', async () => {
        const configNoEntities: BackupConfig = {
          ...backupConfig,
          entities: [],
        };

        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildBackupCommand(configNoEntities, mockSQLiteConnection, null);

        expect(result.args[1]).toBe('.dump');
      });

      it('should include output path in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockSQLiteConnection, null);

        expect(result.displayCommand).toContain('> "/tmp/backup.sql"');
      });
    });

    describe('ClickHouse', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [
          { name: 'events', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build clickhouse-client command with host and native TCP port', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, null);

        expect(result.binary).toBe('/usr/bin/clickhouse-client');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        // HTTP port 8123 is converted to native TCP port 9000 for CLI
        expect(result.args).toContain('9000');
      });

      it('should pass password via CLICKHOUSE_PASSWORD env var when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, 'chpass');

        expect(result.env).toHaveProperty('CLICKHOUSE_PASSWORD', 'chpass');
        expect(result.args).not.toContain('--password');
        expect(result.args).not.toContain('chpass');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, 'chpass');

        expect(result.displayCommand).toContain('CLICKHOUSE_PASSWORD=********');
        expect(result.displayCommand).not.toContain('chpass');
      });

      it('should include DDL from system.tables and SELECT FORMAT SQLInsert for each entity', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, null);

        expect(result.args).toContain('--query');
        expect(result.args).toContain('--multiquery');
        const queryIndex = result.args.indexOf('--query');
        const query = result.args[queryIndex + 1];
        expect(query).toContain("system.tables WHERE database = currentDatabase() AND name = 'events'");
        expect(query).toContain('FORMAT TabSeparatedRaw');
        expect(query).toContain('SELECT * FROM `events` FORMAT SQLInsert');
      });

      it('should query system.tables with currentDatabase() when no entities specified', async () => {
        const configNoEntities: BackupConfig = {
          ...backupConfig,
          entities: [],
        };

        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(configNoEntities, mockClickHouseConnection, null);

        const queryIndex = result.args.indexOf('--query');
        expect(result.args[queryIndex + 1]).toContain('system.tables');
        expect(result.args[queryIndex + 1]).toContain('currentDatabase()');
      });
    });

    describe('MongoDB', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [
          { name: 'users', type: BackupEntityType.Collection },
        ],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build mongodump command with host, port, and database', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMongoDBConnection, null);

        expect(result.binary).toBe('/usr/bin/mongodump');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('27017');
        expect(result.args).toContain('--db');
        expect(result.args).toContain('testdb');
      });

      it('should include username and password when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMongoDBConnection, 'mongopass');

        expect(result.args).toContain('--username');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('--password');
        expect(result.args).toContain('mongopass');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMongoDBConnection, 'mongopass');

        expect(result.displayCommand).toContain('--password ********');
        expect(result.displayCommand).not.toContain('mongopass');
      });

      it('should include collection when single entity specified', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMongoDBConnection, null);

        expect(result.args).toContain('--collection');
        expect(result.args).toContain('users');
      });

      it('should not include collection when multiple entities specified', async () => {
        const configMultipleEntities: BackupConfig = {
          ...backupConfig,
          entities: [
            { name: 'users', type: BackupEntityType.Collection },
            { name: 'orders', type: BackupEntityType.Collection },
          ],
        };

        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(configMultipleEntities, mockMongoDBConnection, null);

        expect(result.args).not.toContain('--collection');
      });

      it('should include output path', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockMongoDBConnection, null);

        expect(result.args).toContain('--out=/tmp/mongodump');
      });
    });

    describe('Redis', () => {
      const backupConfig: BackupConfig = {
        connectionId: 'conn-redis-1',
        entities: [],
        outputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should build redis-cli command with host and port', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockRedisConnection, null);

        expect(result.binary).toBe('/usr/bin/redis-cli');
        expect(result.args).toContain('-h');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('-p');
        expect(result.args).toContain('6379');
      });

      it('should include --rdb argument', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockRedisConnection, null);

        expect(result.args).toContain('--rdb');
        expect(result.args).toContain('/tmp/dump.rdb');
      });

      it('should set REDISCLI_AUTH environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockRedisConnection, 'redispass');

        expect(result.env['REDISCLI_AUTH']).toBe('redispass');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockRedisConnection, 'redispass');

        expect(result.displayCommand).toContain('REDISCLI_AUTH=********');
        expect(result.displayCommand).not.toContain('redispass');
      });
    });

    describe('SSH tunnel support', () => {
      it('should use SSH tunnel host and port when tunnel is active', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);
        mockHasTunnel.mockReturnValue(true);
        mockGetLocalPort.mockReturnValue(54321);

        const backupConfig: BackupConfig = {
          connectionId: 'conn-pg-1',
          entities: [],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/pg_dump',
          compress: false,
          customArgs: '',
          options: {},
        };

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--host');
        expect(result.args).toContain('127.0.0.1');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('54321');
      });

      it('should use original host when tunnel exists but port is null', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);
        mockHasTunnel.mockReturnValue(true);
        mockGetLocalPort.mockReturnValue(null);

        const backupConfig: BackupConfig = {
          connectionId: 'conn-pg-1',
          entities: [],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/pg_dump',
          compress: false,
          customArgs: '',
          options: {},
        };

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('5432');
      });
    });
  });

  // ─── Restore Command Building Tests ────────────────────────────────────

  describe('buildRestoreCommand', () => {
    describe('PostgreSQL', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should build psql command with host, port, username, and database', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockPostgresConnection, null);

        expect(result.binary).toBe('/usr/bin/psql');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('5432');
        expect(result.args).toContain('--username');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('--dbname=testdb');
      });

      it('should throw when database name is empty', async () => {
        const connWithoutDb = { ...mockPostgresConnection, database: '' };
        await expect(backupService.buildRestoreCommand(restoreConfig, connWithoutDb, null))
          .rejects.toThrow('Database name is required');
      });

      it('should include -f flag with input path', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockPostgresConnection, null);

        expect(result.args).toContain('-f');
        expect(result.args).toContain('/tmp/backup.sql');
      });

      it('should set PGPASSWORD environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockPostgresConnection, 'secret123');

        expect(result.env['PGPASSWORD']).toBe('secret123');
      });

      it('should add valid psql restore options (single-transaction and echo-all only)', async () => {
        const configWithOptions: RestoreConfig = {
          ...restoreConfig,
          options: {
            'no-owner': true,       // NOT a psql flag — should be ignored
            'no-privileges': true,   // NOT a psql flag — should be ignored
            'clean': true,           // NOT a psql flag — should be ignored
            'create': true,          // NOT a psql flag — should be ignored
            'data-only': true,       // NOT a psql flag — should be ignored
            'schema-only': false,
            'verbose': true,         // mapped to --echo-all for psql
            'single-transaction': true,
          },
        };

        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildRestoreCommand(configWithOptions, mockPostgresConnection, null);

        // Only psql-compatible flags should be present
        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--echo-all');
        // pg_restore flags must NOT be passed to psql
        expect(result.args).not.toContain('--no-owner');
        expect(result.args).not.toContain('--no-privileges');
        expect(result.args).not.toContain('--clean');
        expect(result.args).not.toContain('--create');
        expect(result.args).not.toContain('--data-only');
        expect(result.args).not.toContain('--verbose');
      });
    });

    describe('MySQL', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should build mysql command with host, port, user, and database', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMySQLConnection, null);

        expect(result.binary).toBe('/usr/bin/mysql');
        expect(result.args).toContain('--host');
        expect(result.args).toContain('localhost');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('3306');
        expect(result.args).toContain('--user');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('testdb');
      });

      it('should not include -f flag (uses stdin)', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMySQLConnection, null);

        expect(result.args).not.toContain('-f');
      });

      it('should indicate stdin redirection in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMySQLConnection, null);

        expect(result.displayCommand).toContain('< "/tmp/backup.sql"');
      });

      it('should set MYSQL_PWD environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockMySQLConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMySQLConnection, 'mypassword');

        expect(result.env['MYSQL_PWD']).toBe('mypassword');
      });
    });

    describe('SQLite', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should build sqlite3 command with filepath', async () => {
        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockSQLiteConnection, null);

        expect(result.binary).toBe('/usr/bin/sqlite3');
        expect(result.args[0]).toBe('/path/to/test.db');
      });

      it('should indicate stdin redirection in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockSQLiteConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockSQLiteConnection, null);

        expect(result.displayCommand).toContain('< "/tmp/backup.sql"');
      });
    });

    describe('ClickHouse', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should build clickhouse-client command with --multiquery flag', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockClickHouseConnection, null);

        expect(result.binary).toBe('/usr/bin/clickhouse-client');
        expect(result.args).toContain('--multiquery');
      });

      it('should pass password via CLICKHOUSE_PASSWORD env var when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockClickHouseConnection, 'chpass');

        expect(result.env).toHaveProperty('CLICKHOUSE_PASSWORD', 'chpass');
        expect(result.args).not.toContain('--password');
        expect(result.args).not.toContain('chpass');
      });

      it('should indicate stdin redirection in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockClickHouseConnection, null);

        expect(result.displayCommand).toContain('< "/tmp/backup.sql"');
      });
    });

    describe('MongoDB', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: true,
        customArgs: '',
        options: {},
      };

      it('should build mongorestore command with directory path', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMongoDBConnection, null);

        expect(result.binary).toBe('/usr/bin/mongorestore');
        expect(result.args).toContain('/tmp/mongodump');
      });

      it('should use --archive flag when isDirectory is false', async () => {
        const archiveConfig: RestoreConfig = {
          ...restoreConfig,
          inputPath: '/tmp/backup.archive',
          isDirectory: false,
        };

        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildRestoreCommand(archiveConfig, mockMongoDBConnection, null);

        expect(result.args).toContain('--archive=/tmp/backup.archive');
      });

      it('should include username and password when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMongoDBConnection, 'mongopass');

        expect(result.args).toContain('--username');
        expect(result.args).toContain('testuser');
        expect(result.args).toContain('--password');
        expect(result.args).toContain('mongopass');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockMongoDBConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockMongoDBConnection, 'mongopass');

        expect(result.displayCommand).toContain('--password ********');
        expect(result.displayCommand).not.toContain('mongopass');
      });
    });

    describe('Redis', () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should build redis-cli command with --pipe flag', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockRedisConnection, null);

        expect(result.binary).toBe('/usr/bin/redis-cli');
        expect(result.args).toContain('--pipe');
      });

      it('should set REDISCLI_AUTH environment variable when password provided', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockRedisConnection, 'redispass');

        expect(result.env['REDISCLI_AUTH']).toBe('redispass');
      });

      it('should indicate stdin redirection in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockRedisConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockRedisConnection, null);

        expect(result.displayCommand).toContain('< "/tmp/dump.rdb"');
      });
    });

    describe('SSH tunnel support', () => {
      it('should use SSH tunnel host and port when tunnel is active', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);
        mockHasTunnel.mockReturnValue(true);
        mockGetLocalPort.mockReturnValue(54321);

        const restoreConfig: RestoreConfig = {
          connectionId: 'conn-pg-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/psql',
          isDirectory: false,
          customArgs: '',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(restoreConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--host');
        expect(result.args).toContain('127.0.0.1');
        expect(result.args).toContain('--port');
        expect(result.args).toContain('54321');
      });
    });
  });

  // ─── Execution Tests ────────────────────────────────────────────────────

  /** Creates a mock ChildProcess EventEmitter with stdout/stderr as EventEmitters */
  const createMockProc = (): EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & { end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
    pid: number;
  } => {
    const proc = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: EventEmitter & { end: ReturnType<typeof vi.fn> };
      kill: ReturnType<typeof vi.fn>;
      pid: number;
    };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    const stdin = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn> };
    stdin.end = vi.fn();
    proc.stdin = stdin;
    proc.kill = vi.fn();
    proc.pid = 12345;
    return proc;
  };

  /** Creates a mock writable stream EventEmitter */
  const createMockWriteStream = (): EventEmitter & { end: ReturnType<typeof vi.fn> } => {
    const ws = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn> };
    ws.end = vi.fn(() => { process.nextTick(() => ws.emit('finish')); });
    return ws;
  };

  /** Creates a mock readable stream EventEmitter with pipe and destroy */
  const createMockReadStream = (): EventEmitter & {
    pipe: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  } => {
    const rs = new EventEmitter() as EventEmitter & {
      pipe: ReturnType<typeof vi.fn>;
      destroy: ReturnType<typeof vi.fn>;
    };
    rs.pipe = vi.fn();
    rs.destroy = vi.fn();
    return rs;
  };

  describe('executeBackup', () => {
    const backupConfig: BackupConfig = {
      connectionId: 'conn-pg-1',
      entities: [],
      outputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/pg_dump',
      compress: false,
      customArgs: '',
      options: {},
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return an operationId starting with backup-', () => {
      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

      expect(operationId).toMatch(/^backup-[0-9a-f-]{36}$/);
    });

    it('should return a string containing a UUID', () => {
      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);
      const uuid = operationId.replace('backup-', '');

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should complete backup successfully when process exits with code 0', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

      // Allow the async runBackup to start (it awaits getPassword + buildBackupCommand)
      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Emit some stdout data
      proc.stdout.emit('data', Buffer.from('backup in progress...'));

      // Complete the process successfully
      proc.emit('close', 0);

      // Wait for the finally block to execute
      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            status: BackupStatus.Completed,
          })
        );
      });
    });

    it('should set error status when process exits with non-zero code', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.stderr.emit('data', Buffer.from('pg_dump: error'));
      proc.emit('close', 1);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            status: BackupStatus.Error,
          })
        );
      });
    });

    it('should set error status when process emits an error event', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.emit('error', new Error('ENOENT: spawn failed'));

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            stderr: expect.stringContaining('ENOENT: spawn failed'),
          })
        );
      });
    });

    it('should pipe stdout to write stream for SQLite backup', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      // Give proc.stdout a pipe method
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const sqliteBackupConfig: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(sqliteBackupConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      expect((proc.stdout as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe).toHaveBeenCalledWith(ws);

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should pipe stdout to write stream for ClickHouse backup', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const clickhouseBackupConfig: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(clickhouseBackupConfig, mockClickHouseConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/tmp/backup.tsv', { highWaterMark: 256 * 1024 });
      expect((proc.stdout as EventEmitter & { pipe: ReturnType<typeof vi.fn> }).pipe).toHaveBeenCalledWith(ws);

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should compress output when compress option is true and backup completes', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      // Set up archiver mock to simulate compression
      const outputWs = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(outputWs);
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockUnlink.mockResolvedValue(undefined);

      // Make archiver.pipe and archive.on work to trigger close
      let archiveErrorCb: ((err: Error) => void) | null = null;
      mockArchiverInstance.on.mockImplementation((event: string, cb: (err: Error) => void) => {
        if (event === 'error') archiveErrorCb = cb;
        return mockArchiverInstance;
      });
      mockArchiverInstance.pipe.mockReturnValue(undefined);
      mockArchiverInstance.file.mockReturnValue(undefined);
      mockArchiverInstance.finalize.mockReturnValue(undefined);

      const compressConfig: BackupConfig = {
        ...backupConfig,
        compress: true,
      };

      backupService.executeBackup(compressConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.emit('close', 0);

      // Wait for compression to start
      await vi.waitFor(() => {
        expect(mockArchiver).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });
      });

      // Simulate the output stream close event (compression complete)
      // The 'close' handler on the output write stream triggers the rename/unlink
      const outputCloseHandlers = outputWs.listeners('close');
      if (outputCloseHandlers.length > 0) {
        await (outputCloseHandlers[0] as () => Promise<void>)();
      }

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should handle ClickHouse output stream error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const clickhouseBackupConfig: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(clickhouseBackupConfig, mockClickHouseConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger the output stream error for ClickHouse path
      ws.emit('error', new Error('no space left on device'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            stderr: expect.stringContaining('Output stream error: no space left on device'),
          })
        );
      });
    });

    it('should handle error status when buildBackupCommand throws', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      mockGetPassword.mockRejectedValue(new Error('keychain access denied'));

      backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            stderr: expect.stringContaining('keychain access denied'),
          })
        );
      });
    });

    it('should handle SQLite output stream error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const sqliteBackupConfig: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(sqliteBackupConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger the output stream error
      ws.emit('error', new Error('disk full'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({
            stderr: expect.stringContaining('Output stream error: disk full'),
          })
        );
      });
    });
  });

  describe('executeRestore', () => {
    const restoreConfig: RestoreConfig = {
      connectionId: 'conn-pg-1',
      inputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/psql',
      isDirectory: false,
      customArgs: '',
      options: {},
    };

    beforeEach(() => {
      // inputPath must exist for restore to proceed past validation
      mockExistsSync.mockReturnValue(true);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return an operationId starting with restore-', () => {
      const operationId = backupService.executeRestore(restoreConfig, mockPostgresConnection);

      expect(operationId).toMatch(/^restore-[0-9a-f-]{36}$/);
    });

    it('should return a string containing a UUID', () => {
      const operationId = backupService.executeRestore(restoreConfig, mockPostgresConnection);
      const uuid = operationId.replace('restore-', '');

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should complete restore successfully when process exits with code 0 (PostgreSQL with -f flag)', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should pipe stdin for SQLite restore', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      expect(rs.pipe).toHaveBeenCalled();

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });

      // Verify the input stream is destroyed on close
      expect(rs.destroy).toHaveBeenCalled();
    });

    it('should handle SQLite restore input stream error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger input stream error
      rs.emit('error', new Error('file not found'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            stderr: expect.stringContaining('Input file error: file not found'),
          })
        );
      });
    });

    it('should log warning for SQLite restore stdin non-EPIPE error', async () => {
      const { logger } = await import('@main/utils/logger');
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger a non-EPIPE stdin error — should be logged as warning
      proc.stdin.emit('error', new Error('ECONNRESET'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('Restore stdin error: ECONNRESET');
      });
    });

    it('should handle SQLite restore stdin EPIPE error gracefully', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger stdin EPIPE error — should be silently ignored
      proc.stdin.emit('error', new Error('write EPIPE'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should spawn process directly for MongoDB restore (no stdin piping)', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const mongoRestoreConfig: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: true,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(mongoRestoreConfig, mockMongoDBConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // MongoDB restore does not use createReadStream
      expect(mockCreateReadStream).not.toHaveBeenCalled();

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should pipe stdin for Redis restore', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const redisRestoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(redisRestoreConfig, mockRedisConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/dump.rdb', { highWaterMark: 256 * 1024 });
      expect(rs.pipe).toHaveBeenCalled();

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should handle Redis restore input stream error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const redisRestoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(redisRestoreConfig, mockRedisConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      rs.emit('error', new Error('read error'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            stderr: expect.stringContaining('Input file error: read error'),
          })
        );
      });
    });

    it('should handle Redis restore stdin EPIPE error gracefully', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const redisRestoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(redisRestoreConfig, mockRedisConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // EPIPE error on stdin should be silently ignored
      proc.stdin.emit('error', new Error('write EPIPE'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should log warning for Redis restore stdin non-EPIPE error', async () => {
      const { logger } = await import('@main/utils/logger');
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const redisRestoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(redisRestoreConfig, mockRedisConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Non-EPIPE stdin error should be logged as warning
      proc.stdin.emit('error', new Error('ECONNRESET'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('Restore stdin error: ECONNRESET');
      });
    });

    it('should pipe stdin for MySQL restore (no -f flag)', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const mysqlRestoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(mysqlRestoreConfig, mockMySQLConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // MySQL restore does not use -f flag, so it pipes stdin
      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      expect(rs.pipe).toHaveBeenCalled();

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });

      // Verify destroy called on close
      expect(rs.destroy).toHaveBeenCalled();
    });

    it('should handle MySQL restore stdin input error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const mysqlRestoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(mysqlRestoreConfig, mockMySQLConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      rs.emit('error', new Error('permission denied'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            stderr: expect.stringContaining('Input file error: permission denied'),
          })
        );
      });
    });

    it('should log warning for MySQL restore stdin non-EPIPE error', async () => {
      const { logger } = await import('@main/utils/logger');
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const mysqlRestoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(mysqlRestoreConfig, mockMySQLConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Non-EPIPE stdin error should be logged as warning
      proc.stdin.emit('error', new Error('ECONNRESET'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(logger.warn).toHaveBeenCalledWith('Restore stdin error: ECONNRESET');
      });
    });

    it('should handle MySQL restore stdin EPIPE error gracefully', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const mysqlRestoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(mysqlRestoreConfig, mockMySQLConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // EPIPE should be ignored
      proc.stdin.emit('error', new Error('write EPIPE'));

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });

    it('should set error status when restore process exits with non-zero code', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.emit('close', 1);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            exitCode: 1,
          })
        );
      });
    });

    it('should set error status when restore process emits error', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      proc.emit('error', new Error('ENOENT'));

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            stderr: expect.stringContaining('ENOENT'),
          })
        );
      });
    });

    it('should handle error when getPassword fails during restore', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      mockGetPassword.mockRejectedValue(new Error('keychain locked'));

      backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            stderr: expect.stringContaining('keychain locked'),
          })
        );
      });
    });

    it('should handle ClickHouse restore stdin piping', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);

      const clickhouseRestoreConfig: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(clickhouseRestoreConfig, mockClickHouseConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // ClickHouse restore does not use -f flag, so stdin piping is used
      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      expect(rs.pipe).toHaveBeenCalled();

      proc.emit('close', 0);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({ status: BackupStatus.Completed })
        );
      });
    });
  });

  describe('cancelOperation', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false for unknown operationId', () => {
      const result = backupService.cancelOperation('backup-unknown');

      expect(result).toBe(false);
    });

    it('should return false for non-existent operationId', () => {
      const result = backupService.cancelOperation('restore-99999999');

      expect(result).toBe(false);
    });

    it('should kill process and set cancelled status for running backup', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const backupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      const result = backupService.cancelOperation(operationId);

      expect(result).toBe(true);
      expect(proc.kill).toHaveBeenCalledWith(killSignal);
      expect(mockSend).toHaveBeenCalledWith(
        'backup:output',
        expect.objectContaining({
          status: BackupStatus.Cancelled,
          stderr: expect.stringContaining('Operation cancelled by user'),
        })
      );

      // Simulate the process closing after being killed
      proc.emit('close', null);
    });

    it('should kill process and set cancelled status for running restore', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);
      mockExistsSync.mockReturnValue(true);

      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const operationId = backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      const result = backupService.cancelOperation(operationId);

      expect(result).toBe(true);
      expect(proc.kill).toHaveBeenCalledWith(killSignal);
      expect(mockSend).toHaveBeenCalledWith(
        'restore:output',
        expect.objectContaining({
          status: BackupStatus.Cancelled,
          stderr: expect.stringContaining('Operation cancelled by user'),
        })
      );

      // Simulate the process closing after cancel
      proc.emit('close', null);
    });

    it('should use SIGKILL on Windows instead of SIGTERM', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      try {
        const mockSend = vi.fn();
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

        const proc = createMockProc();
        mockSpawn.mockReturnValue(proc);
        mockGetPassword.mockResolvedValue(null);

        const backupConfig: BackupConfig = {
          connectionId: 'conn-pg-1',
          entities: [],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/pg_dump',
          compress: false,
          customArgs: '',
          options: {},
        };

        const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

        await vi.waitFor(() => {
          expect(mockSpawn).toHaveBeenCalled();
        });

        backupService.cancelOperation(operationId);

        expect(proc.kill).toHaveBeenCalledWith('SIGKILL');

        proc.emit('close', null);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should not override cancelled status when process closes after cancellation', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const backupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      backupService.cancelOperation(operationId);

      // Process closes with a non-zero code after cancellation
      proc.emit('close', 137);

      // The final status should remain Cancelled, not Error
      await vi.waitFor(() => {
        const cancelledCalls = mockSend.mock.calls.filter(
          (call: unknown[]) => call[0] === 'backup:output' && (call[1] as { status: string }).status === BackupStatus.Cancelled
        );
        expect(cancelledCalls.length).toBeGreaterThan(0);
      });
    });

    it('should resolve without error when cancelled process emits error event', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const backupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      backupService.cancelOperation(operationId);

      // The process error handler should resolve (not reject) when cancelled
      proc.emit('error', new Error('process was killed'));
      proc.emit('close', null);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({ status: BackupStatus.Cancelled })
        );
      });
    });
  });

  // ─── Throttled Emit Tests ─────────────────────────────────────────────────

  describe('throttledEmit', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should throttle multiple stdout emissions', async () => {
      vi.useFakeTimers();
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const backupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(backupConfig, mockPostgresConnection);

      // Resolve the getPassword promise
      await vi.advanceTimersByTimeAsync(0);
      // Allow buildBackupCommand to complete
      await vi.advanceTimersByTimeAsync(0);

      // Clear the initial emit calls
      mockSend.mockClear();

      // Emit many stdout chunks rapidly
      proc.stdout.emit('data', Buffer.from('chunk1'));
      proc.stdout.emit('data', Buffer.from('chunk2'));
      proc.stdout.emit('data', Buffer.from('chunk3'));

      // Only one timer should be scheduled; no emit yet
      expect(mockSend).not.toHaveBeenCalled();

      // Advance past the throttle interval
      vi.advanceTimersByTime(200);

      // Now the throttled emit should have fired
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Clean up
      proc.emit('close', 0);
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  // ─── Flush Emit Tests ────────────────────────────────────────────────────

  describe('flushEmit', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear pending timer and emit immediately', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as {
        flushEmit: (id: string, progress: Record<string, unknown>) => void;
        throttledEmit: (id: string, progress: Record<string, unknown>) => void;
        emitTimers: Map<string, NodeJS.Timeout>;
      };

      const progress = { backupId: 'backup-flush-test', status: 'running', stdout: '', stderr: '' };

      // Schedule a throttled emit
      service.throttledEmit('backup-flush-test', progress);

      // Should have a pending timer
      expect(service.emitTimers.has('backup-flush-test')).toBe(true);

      // Flush should clear the timer and emit immediately
      service.flushEmit('backup-flush-test', progress);

      expect(service.emitTimers.has('backup-flush-test')).toBe(false);
      expect(mockSend).toHaveBeenCalledWith('backup:output', expect.objectContaining({ backupId: 'backup-flush-test' }));
    });

    it('should emit even when no pending timer exists', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as {
        flushEmit: (id: string, progress: Record<string, unknown>) => void;
      };

      const progress = { backupId: 'backup-no-timer', status: 'completed', stdout: 'done', stderr: '' };

      service.flushEmit('backup-no-timer', progress);

      expect(mockSend).toHaveBeenCalledWith('backup:output', expect.objectContaining({ backupId: 'backup-no-timer' }));
    });
  });

  // ─── Schedule Cleanup Tests ───────────────────────────────────────────────

  describe('scheduleCleanup', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should remove progress from map after 30 seconds', async () => {
      vi.useFakeTimers();

      const service = backupService as unknown as {
        progressMap: Map<string, Record<string, unknown>>;
        scheduleCleanup: (id: string) => void;
      };

      service.progressMap.set('backup-cleanup-test', {
        backupId: 'backup-cleanup-test',
        status: 'completed',
        stdout: '',
        stderr: '',
      });

      service.scheduleCleanup('backup-cleanup-test');

      // Progress should still exist before 30s
      expect(service.progressMap.has('backup-cleanup-test')).toBe(true);

      // Advance past 30 seconds
      vi.advanceTimersByTime(31_000);

      expect(service.progressMap.has('backup-cleanup-test')).toBe(false);
    });
  });

  // ─── Compress Output Tests ────────────────────────────────────────────────

  describe('compressOutput', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create zip archive for a regular file', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockUnlink.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      // Reset archiver mock
      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.directory.mockReset();
      mockArchiverInstance.finalize.mockReset();

      // Make archiver.on capture the error handler
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      // Make stat resolve with isDirectory() = false, and trigger archive operations
      // The stat().then() call will call archive.file() and archive.finalize()

      const progress = { backupId: 'backup-compress', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/backup.sql', 'backup-compress', progress);

      // Wait for stat to resolve and archive.file to be called
      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalledWith('/tmp/backup.sql', { name: 'backup.sql' });
      });

      expect(mockArchiverInstance.finalize).toHaveBeenCalled();

      // Simulate the output write stream 'close' event (compression done)
      ws.emit('close');

      await compressPromise;

      expect(mockUnlink).toHaveBeenCalledWith('/tmp/backup.sql');
      expect(progress.stdout).toContain(`Compressed to ${join('/tmp', 'backup.zip')}`);
    });

    it('should create zip archive for a directory', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);
      mockStat.mockResolvedValue({ isDirectory: () => true });
      mockUnlink.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.directory.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      const progress = { backupId: 'backup-compress-dir', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/mongodump', 'backup-compress-dir', progress);

      await vi.waitFor(() => {
        expect(mockArchiverInstance.directory).toHaveBeenCalledWith('/tmp/mongodump', false);
      });

      expect(mockArchiverInstance.finalize).toHaveBeenCalled();

      ws.emit('close');

      await compressPromise;

      // Directories use rm() with recursive instead of unlink()
      expect(mockRm).toHaveBeenCalledWith('/tmp/mongodump', { recursive: true, force: true });
    });

    it('should handle zip path rename when extension needs replacing', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockUnlink.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.directory.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      const progress = { backupId: 'backup-compress-rename', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/backup.sql', 'backup-compress-rename', progress);

      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalled();
      });

      ws.emit('close');

      await compressPromise;

      // The zip path is /tmp/backup.sql.zip, final path should be /tmp/backup.zip
      // So rename should be called
      expect(mockRename).toHaveBeenCalledWith('/tmp/backup.sql.zip', join('/tmp', 'backup.zip'));
    });

    it('should reject when output stream error occurs', async () => {
      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);
      mockStat.mockResolvedValue({ isDirectory: () => false });

      const progress = { backupId: 'backup-compress-err', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/backup.sql', 'backup-compress-err', progress);

      // Wait for stat to resolve
      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalled();
      });

      // Trigger output stream error
      ws.emit('error', new Error('disk full'));

      await expect(compressPromise).rejects.toThrow('disk full');
    });

    it('should reject when archive emits error', async () => {
      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.finalize.mockReset();

      let archiveErrorCb: ((err: Error) => void) | null = null;
      mockArchiverInstance.on.mockImplementation((event: string, cb: (err: Error) => void) => {
        if (event === 'error') archiveErrorCb = cb;
        return mockArchiverInstance;
      });
      mockStat.mockResolvedValue({ isDirectory: () => false });

      const progress = { backupId: 'backup-compress-arch-err', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/backup.sql', 'backup-compress-arch-err', progress);

      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalled();
      });

      // Trigger archive error
      if (archiveErrorCb) {
        archiveErrorCb(new Error('archive corrupted'));
      }

      await expect(compressPromise).rejects.toThrow('archive corrupted');
    });

    it('should reject when rename fails in close handler', async () => {
      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockRename.mockRejectedValue(new Error('EACCES: permission denied'));

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      const progress = { backupId: 'backup-compress-rename-err', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/backup.sql', 'backup-compress-rename-err', progress);

      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalled();
      });

      // Trigger close event which will call rename, which will fail
      ws.emit('close');

      await expect(compressPromise).rejects.toThrow('EACCES: permission denied');
    });

    it('should not call rename when zip path matches final path (no extension in filename)', async () => {
      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);
      mockStat.mockResolvedValue({ isDirectory: () => false });
      mockUnlink.mockResolvedValue(undefined);
      mockRename.mockResolvedValue(undefined);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      const progress = { backupId: 'backup-compress-no-ext', status: 'completed', stdout: '', stderr: '' };

      // When outputPath has no extension, zipPath = outputPath + '.zip' and
      // finalPath = outputPath + '.zip' (same), so rename should NOT be called
      const compressPromise = service.compressOutput('/tmp/mongodump_output', 'backup-compress-no-ext', progress);

      await vi.waitFor(() => {
        expect(mockArchiverInstance.file).toHaveBeenCalled();
      });

      ws.emit('close');

      await compressPromise;

      // zipPath is '/tmp/mongodump_output.zip', finalPath is also '/tmp/mongodump_output.zip'
      // So rename should not be called since they match
      expect(mockRename).not.toHaveBeenCalled();
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/mongodump_output');
    });

    it('should reject when stat fails', async () => {
      const service = backupService as unknown as {
        compressOutput: (outputPath: string, operationId: string, progress: Record<string, unknown>) => Promise<void>;
      };

      const ws = createMockWriteStream();
      mockCreateWriteStream.mockReturnValue(ws);

      mockArchiver.mockClear();
      mockArchiverInstance.on.mockReset();
      mockArchiverInstance.pipe.mockReset();
      mockArchiverInstance.file.mockReset();
      mockArchiverInstance.finalize.mockReset();
      mockArchiverInstance.on.mockImplementation(() => mockArchiverInstance);

      mockStat.mockRejectedValue(new Error('ENOENT: no such file'));

      const progress = { backupId: 'backup-compress-stat-err', status: 'completed', stdout: '', stderr: '' };

      const compressPromise = service.compressOutput('/tmp/nonexistent.sql', 'backup-compress-stat-err', progress);

      await expect(compressPromise).rejects.toThrow('ENOENT: no such file');
    });
  });

  describe('IPC channel routing', () => {
    it('backup operationId should use backup:output channel', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as { emitOutputNow: (id: string, progress: Record<string, unknown>) => void };
      service.emitOutputNow('backup-123', { backupId: 'backup-123', status: 'running', stdout: '', stderr: '' });

      expect(mockSend).toHaveBeenCalledWith('backup:output', expect.objectContaining({ backupId: 'backup-123' }));
    });

    it('restore operationId should use restore:output channel', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const service = backupService as unknown as { emitOutputNow: (id: string, progress: Record<string, unknown>) => void };
      service.emitOutputNow('restore-456', { backupId: 'restore-456', status: 'running', stdout: '', stderr: '' });

      expect(mockSend).toHaveBeenCalledWith('restore:output', expect.objectContaining({ backupId: 'restore-456' }));
    });
  });

  // ─── Unsupported Database Type Tests ───────────────────────────────────

  describe('unsupported database type', () => {
    it('should throw for unsupported database type in buildBackupCommand', async () => {
      const unsupportedConn: SavedConnection = {
        ...mockPostgresConnection,
        type: 'unsupported' as DatabaseType,
      };

      const backupConfig: BackupConfig = {
        connectionId: 'conn-unsupported',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/unknown',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(backupConfig, unsupportedConn, null)).rejects.toThrow(
        'Unsupported database type for backup: unsupported'
      );
    });

    it('should throw for unsupported database type in buildRestoreCommand', async () => {
      const unsupportedConn: SavedConnection = {
        ...mockPostgresConnection,
        type: 'unsupported' as DatabaseType,
      };

      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-unsupported',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/unknown',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildRestoreCommand(restoreConfig, unsupportedConn, null)).rejects.toThrow(
        'Unsupported database type for restore: unsupported'
      );
    });
  });

  // ─── MariaDB Restore Tests ────────────────────────────────────────────────

  describe('buildRestoreCommand MariaDB', () => {
    it('should build mariadb restore command with host, port, user, and database', async () => {
      const mariaDBConnection: SavedConnection = {
        ...mockMySQLConnection,
        id: 'conn-mariadb-1',
        type: DatabaseType.MariaDB,
      };

      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-mariadb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mariaDBConnection, 'mariadbpass');

      expect(result.binary).toBe('/usr/bin/mariadb');
      expect(result.args).toContain('--host');
      expect(result.args).toContain('localhost');
      expect(result.args).toContain('--port');
      expect(result.args).toContain('3306');
      expect(result.args).toContain('--user');
      expect(result.args).toContain('testuser');
      expect(result.args).toContain('testdb');
      expect(result.env['MYSQL_PWD']).toBe('mariadbpass');
    });
  });

  // ─── Custom Args in Restore Commands ──────────────────────────────────────

  describe('buildRestoreCommand with customArgs', () => {
    it('should append custom args to PostgreSQL restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '--set ON_ERROR_STOP=1',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockPostgresConnection, null);

      expect(result.args).toContain('--set');
      expect(result.args).toContain('ON_ERROR_STOP=1');
    });

    it('should append custom args to MySQL restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '--force --max_allowed_packet=1G',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockMySQLConnection, null);

      expect(result.args).toContain('--force');
      expect(result.args).toContain('--max_allowed_packet=1G');
    });

    it('should append custom args to SQLite restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '-bail',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockSQLiteConnection, null);

      expect(result.args).toContain('-bail');
    });

    it('should append custom args to ClickHouse restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '--max_insert_block_size=100000',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockClickHouseConnection, null);

      expect(result.args).toContain('--max_insert_block_size=100000');
    });

    it('should append custom args to MongoDB restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: true,
        customArgs: '--drop --numInsertionWorkersPerCollection=4',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockMongoDBConnection, null);

      expect(result.args).toContain('--drop');
      expect(result.args).toContain('--numInsertionWorkersPerCollection=4');
    });

    it('should append custom args to Redis restore command', async () => {
      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '--pipe-timeout 30',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(restoreConfig, mockRedisConnection, null);

      expect(result.args).toContain('--pipe-timeout');
      expect(result.args).toContain('30');
    });
  });

  // ─── Individual Option Tests ──────────────────────────────────────────

  describe('PostgreSQL backup individual options', () => {
    const baseConfig: BackupConfig = {
      connectionId: 'conn-pg-1',
      entities: [{ name: 'users', type: BackupEntityType.Table }],
      outputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/pg_dump',
      compress: false,
      customArgs: '',
      options: {},
    };

    const pgOptions = ['inserts', 'no-owner', 'no-privileges', 'clean', 'create', 'data-only', 'schema-only', 'verbose'] as const;

    for (const opt of pgOptions) {
      it(`should include --${opt} when enabled`, async () => {
        const config: BackupConfig = { ...baseConfig, options: { [opt]: true } };
        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);
        expect(result.args).toContain(`--${opt}`);
      });

      it(`should exclude --${opt} when disabled`, async () => {
        const config: BackupConfig = { ...baseConfig, options: { [opt]: false } };
        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);
        expect(result.args).not.toContain(`--${opt}`);
      });
    }

    it('should not include any option flags when options is empty', async () => {
      const result = await backupService.buildBackupCommand(baseConfig, mockPostgresConnection, null);
      for (const opt of pgOptions) {
        expect(result.args).not.toContain(`--${opt}`);
      }
    });
  });

  describe('MySQL backup individual options', () => {
    const baseConfig: BackupConfig = {
      connectionId: 'conn-mysql-1',
      entities: [{ name: 'users', type: BackupEntityType.Table }],
      outputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/mysqldump',
      compress: false,
      customArgs: '',
      options: {},
    };

    const mysqlOptions = ['single-transaction', 'routines', 'triggers', 'events', 'add-drop-table', 'no-create-info', 'no-data'] as const;

    for (const opt of mysqlOptions) {
      it(`should include --${opt} when enabled`, async () => {
        const config: BackupConfig = { ...baseConfig, options: { [opt]: true } };
        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);
        expect(result.args).toContain(`--${opt}`);
      });

      it(`should exclude --${opt} when disabled`, async () => {
        const config: BackupConfig = { ...baseConfig, options: { [opt]: false } };
        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);
        expect(result.args).not.toContain(`--${opt}`);
      });
    }

    it('should not include any option flags when options is empty', async () => {
      const result = await backupService.buildBackupCommand(baseConfig, mockMySQLConnection, null);
      for (const opt of mysqlOptions) {
        expect(result.args).not.toContain(`--${opt}`);
      }
    });
  });

  describe('PostgreSQL restore individual options', () => {
    const baseConfig: RestoreConfig = {
      connectionId: 'conn-pg-1',
      inputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/psql',
      isDirectory: false,
      customArgs: '',
      options: {},
    };

    // Only these two options are valid for psql (the restore binary):
    // - single-transaction → --single-transaction
    // - verbose → --echo-all (psql equivalent)
    it('should include --single-transaction when enabled', async () => {
      const config: RestoreConfig = { ...baseConfig, options: { 'single-transaction': true } };
      const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);
      expect(result.args).toContain('--single-transaction');
    });

    it('should exclude --single-transaction when disabled', async () => {
      const config: RestoreConfig = { ...baseConfig, options: { 'single-transaction': false } };
      const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);
      expect(result.args).not.toContain('--single-transaction');
    });

    it('should include --echo-all when verbose is enabled', async () => {
      const config: RestoreConfig = { ...baseConfig, options: { 'verbose': true } };
      const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);
      expect(result.args).toContain('--echo-all');
    });

    it('should exclude --echo-all when verbose is disabled', async () => {
      const config: RestoreConfig = { ...baseConfig, options: { 'verbose': false } };
      const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);
      expect(result.args).not.toContain('--echo-all');
    });

    // pg_restore flags must NOT be passed to psql (they would cause immediate errors)
    const invalidPgRestoreFlags = ['no-owner', 'no-privileges', 'clean', 'create', 'data-only', 'schema-only'] as const;
    for (const opt of invalidPgRestoreFlags) {
      it(`should NOT pass --${opt} to psql even when enabled`, async () => {
        const config: RestoreConfig = { ...baseConfig, options: { [opt]: true } };
        const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);
        expect(result.args).not.toContain(`--${opt}`);
      });
    }

    it('should not include any option flags when options is empty', async () => {
      const result = await backupService.buildRestoreCommand(baseConfig, mockPostgresConnection, null);
      expect(result.args).not.toContain('--single-transaction');
      expect(result.args).not.toContain('--echo-all');
    });
  });

  // ─── Missing customArgs tests for backup ──────────────────────────────

  describe('buildBackupCommand with customArgs', () => {
    it('should append custom args to MySQL backup command', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '--max_allowed_packet=64M --skip-comments',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

      expect(result.args).toContain('--max_allowed_packet=64M');
      expect(result.args).toContain('--skip-comments');
    });

    it('should append custom args to SQLite backup command', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '-header -csv',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      expect(result.args).toContain('-header');
      expect(result.args).toContain('-csv');
    });

    it('should append custom args to ClickHouse backup command', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '--max_threads=4 --connect_timeout=10',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      expect(result.args).toContain('--max_threads=4');
      expect(result.args).toContain('--connect_timeout=10');
    });

    it('should append custom args to MongoDB backup command', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '--gzip --numParallelCollections=4',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(result.args).toContain('--gzip');
      expect(result.args).toContain('--numParallelCollections=4');
    });

    it('should append custom args to Redis backup command', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-redis-1',
        entities: [{ name: 'Full Database', type: BackupEntityType.Database }],
        outputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        compress: false,
        customArgs: '--tls --cacert /path/to/ca.crt',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockRedisConnection, null);

      expect(result.args).toContain('--tls');
      expect(result.args).toContain('--cacert');
      expect(result.args).toContain('/path/to/ca.crt');
    });

    it('should handle empty customArgs gracefully', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);
      const argsBefore = result.args.length;

      const config2: BackupConfig = { ...config, customArgs: '   ' };
      const result2 = await backupService.buildBackupCommand(config2, mockPostgresConnection, null);

      // Whitespace-only customArgs should not add empty args
      expect(result2.args.length).toBe(argsBefore);
    });
  });

  // ─── Entity edge cases ────────────────────────────────────────────────

  describe('entity edge cases', () => {
    it('should handle PostgreSQL entities with schema qualification', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [
          { name: 'users', schema: 'public', type: BackupEntityType.Table },
          { name: 'audit_log', schema: 'analytics', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--table="public"."users"');
      expect(result.args).toContain('--table="analytics"."audit_log"');
    });

    it('should handle PostgreSQL entities without schema', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--table="users"');
    });

    it('should handle SQLite table names with double quotes (escaped)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [{ name: 'table"name', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      // Double quotes in table name should be doubled for escaping
      expect(result.args[1]).toBe('.dump "table""name"');
    });

    it('should strip newlines from SQLite table names to prevent dot-command injection', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [{ name: 'users\n.shell rm -rf /', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      // Newlines must be stripped so injected dot-commands cannot appear on their own line
      expect(result.args[1]).toBe('.dump "users.shell rm -rf /"');
      expect(result.args[1]).not.toContain('\n');
      expect(result.args[1]).not.toContain('\r');
    });

    it('should strip carriage returns from SQLite table names', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [{ name: 'table\r\nname', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      expect(result.args[1]).toBe('.dump "tablename"');
    });

    it('should handle multiple SQLite tables in dump commands', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [
          { name: 'users', type: BackupEntityType.Table },
          { name: 'orders', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      expect(result.args[1]).toContain('.dump "users"');
      expect(result.args[1]).toContain('.dump "orders"');
    });

    it('should handle MongoDB single collection backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [{ name: 'users', type: BackupEntityType.Collection }],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(result.args).toContain('--collection');
      expect(result.args).toContain('users');
    });

    it('should not include --collection for multiple MongoDB collections', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [
          { name: 'users', type: BackupEntityType.Collection },
          { name: 'orders', type: BackupEntityType.Collection },
        ],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(result.args).not.toContain('--collection');
    });

    it('should log warning when multiple MongoDB collections are selected', async () => {
      const { logger } = await import('@main/utils/logger');

      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [
          { name: 'users', type: BackupEntityType.Collection },
          { name: 'orders', type: BackupEntityType.Collection },
        ],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(logger.warn).toHaveBeenCalledWith(
        'MongoDB backup: multiple collections selected — dumping entire database instead',
        expect.objectContaining({ requested: 2, database: 'testdb' })
      );
    });

    it('should handle MySQL empty entities (dump entire database)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

      expect(result.args).not.toContain('--tables');
    });

    it('should handle ClickHouse empty entities (dumps system.tables list)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      expect(queryIdx).toBeGreaterThan(-1);
      expect(result.args[queryIdx + 1]).toContain('system.tables');
    });
  });

  // ─── SSH tunnel tests for non-PostgreSQL databases ────────────────────

  describe('SSH tunnel with non-PostgreSQL databases', () => {
    beforeEach(() => {
      mockHasTunnel.mockReturnValue(true);
      mockGetLocalPort.mockReturnValue(13306);
    });

    it('should use tunnel host/port for MySQL backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

      expect(result.args).toContain('127.0.0.1');
      expect(result.args).toContain('13306');
    });

    it('should use tunnel host/port for MySQL restore', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMySQLConnection, null);

      expect(result.args).toContain('127.0.0.1');
      expect(result.args).toContain('13306');
    });

    it('should use tunnel host/port for MongoDB backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(result.args).toContain('127.0.0.1');
      expect(result.args).toContain('13306');
    });

    it('should use tunnel host/port for Redis backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-redis-1',
        entities: [{ name: 'Full Database', type: BackupEntityType.Database }],
        outputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockRedisConnection, null);

      expect(result.args).toContain('127.0.0.1');
      expect(result.args).toContain('13306');
    });

    it('should reject ClickHouse backup through SSH tunnel', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(config, mockClickHouseConnection, null))
        .rejects.toThrow('ClickHouse backup through SSH tunnels is not supported');
    });
  });

  // ─── No password scenarios ────────────────────────────────────────────

  describe('no password scenarios', () => {
    it('should not set PGPASSWORD env when no password provided', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.env).not.toHaveProperty('PGPASSWORD');
    });

    it('should not set MYSQL_PWD env when no password provided', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

      expect(result.env).not.toHaveProperty('MYSQL_PWD');
    });

    it('should not set REDISCLI_AUTH env when no password provided', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-redis-1',
        entities: [{ name: 'Full Database', type: BackupEntityType.Database }],
        outputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockRedisConnection, null);

      expect(result.env).not.toHaveProperty('REDISCLI_AUTH');
    });

    it('should not set CLICKHOUSE_PASSWORD env var when no password', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      expect(result.env).not.toHaveProperty('CLICKHOUSE_PASSWORD');
    });

    it('should not include --password arg for MongoDB when no password', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

      expect(result.args).not.toContain('--password');
    });
  });

  // ─── Password masking in displayCommand ───────────────────────────────

  describe('password masking in displayCommand', () => {
    it('should mask ClickHouse password in displayCommand via env var', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, 'secret');

      expect(result.displayCommand).toContain('CLICKHOUSE_PASSWORD=********');
      expect(result.displayCommand).not.toContain('secret');
    });

    it('should mask MongoDB password in displayCommand', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, 'mongopass');

      expect(result.displayCommand).toContain('********');
      expect(result.displayCommand).not.toContain('mongopass');
    });

    it('should mask PostgreSQL restore password in displayCommand', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, 'pgpass');

      expect(result.displayCommand).toContain('PGPASSWORD=********');
      expect(result.displayCommand).not.toContain('pgpass');
    });

    it('should mask ClickHouse restore password in displayCommand via env var', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockClickHouseConnection, 'chpass');

      expect(result.displayCommand).toContain('CLICKHOUSE_PASSWORD=********');
      expect(result.displayCommand).not.toContain('chpass');
    });

    it('should mask MongoDB restore password in displayCommand', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: true,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMongoDBConnection, 'mongopass');

      expect(result.displayCommand).toContain('********');
      expect(result.displayCommand).not.toContain('mongopass');
    });

    it('should mask Redis restore password in displayCommand', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-redis-1',
        inputPath: '/tmp/dump.rdb',
        binaryPath: '/usr/bin/redis-cli',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockRedisConnection, 'redispass');

      expect(result.displayCommand).toContain('REDISCLI_AUTH=********');
      expect(result.displayCommand).not.toContain('redispass');
    });
  });

  // ─── No username scenarios ────────────────────────────────────────────

  describe('no username scenarios', () => {
    it('should not include --username for PostgreSQL when username is null', async () => {
      const connNoUser: SavedConnection = { ...mockPostgresConnection, username: null };
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connNoUser, null);

      expect(result.args).not.toContain('--username');
    });

    it('should not include --user for MySQL when username is null', async () => {
      const connNoUser: SavedConnection = { ...mockMySQLConnection, username: null };
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connNoUser, null);

      expect(result.args).not.toContain('--user');
    });

    it('should not include --username for MongoDB when username is null', async () => {
      const connNoUser: SavedConnection = { ...mockMongoDBConnection, username: null };
      const config: BackupConfig = {
        connectionId: 'conn-mongodb-1',
        entities: [],
        outputPath: '/tmp/mongodump',
        binaryPath: '/usr/bin/mongodump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connNoUser, null);

      expect(result.args).not.toContain('--username');
    });

    it('should not include --user for ClickHouse when username is null', async () => {
      const connNoUser: SavedConnection = { ...mockClickHouseConnection, username: null };
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connNoUser, null);

      expect(result.args).not.toContain('--user');
    });
  });

  // ─── MongoDB restore with file vs directory ───────────────────────────

  describe('MongoDB restore file vs directory', () => {
    it('should pass directory path directly for directory input', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump/testdb',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: true,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMongoDBConnection, null);

      expect(result.args).toContain('/tmp/mongodump/testdb');
      expect(result.args).not.toContain('--archive=/tmp/mongodump/testdb');
    });

    it('should use --archive flag for file input', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mongodb-1',
        inputPath: '/tmp/mongodump.archive',
        binaryPath: '/usr/bin/mongorestore',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMongoDBConnection, null);

      expect(result.args).toContain('--archive=/tmp/mongodump.archive');
    });
  });

  // ─── ClickHouse port mapping ──────────────────────────────────────────

  describe('ClickHouse port mapping', () => {
    it('should map default HTTP port 8123 to native TCP port 9000 for backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      expect(result.args).toContain('9000');
      expect(result.args).not.toContain('8123');
    });

    it('should use custom port as-is when not default', async () => {
      const connCustomPort: SavedConnection = { ...mockClickHouseConnection, port: 19000 };
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connCustomPort, null);

      expect(result.args).toContain('19000');
    });

    it('should map default HTTP port 8123 to native TCP port 9000 for restore', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockClickHouseConnection, null);

      expect(result.args).toContain('9000');
      expect(result.args).not.toContain('8123');
    });
  });

  // ─── MariaDB fallback binary detection ────────────────────────────────

  describe('MariaDB fallback binary', () => {
    it('should try mariadb-dump first then mysqldump for backup', () => {
      const mariadbDumpPath = join(SEARCH_DIRS.mariadb, `mysqldump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => p === mariadbDumpPath);

      const result = backupService.detectBackupBinary(DatabaseType.MariaDB);

      expect(result.found).toBe(true);
      expect(result.path).toBe(mariadbDumpPath);
    });

    it('should try mariadb first then mysql for restore', () => {
      const mysqlPath = join(SEARCH_DIRS.mariadb, `mysql${binExt}`);
      mockExistsSync.mockImplementation((p: string) => p === mysqlPath);

      const result = backupService.detectRestoreBinary(DatabaseType.MariaDB);

      expect(result.found).toBe(true);
      expect(result.path).toBe(mysqlPath);
    });
  });

  // ─── SQLite filepath fallback ─────────────────────────────────────────

  describe('SQLite filepath fallback', () => {
    it('should use filepath when available for backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

      expect(result.args).toContain('/path/to/test.db');
    });

    it('should use database field when filepath is null for backup', async () => {
      const connNoPath: SavedConnection = { ...mockSQLiteConnection, filepath: null };
      const config: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connNoPath, null);

      expect(result.args).toContain('test.db');
    });

    it('should use filepath when available for restore', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockSQLiteConnection, null);

      expect(result.args).toContain('/path/to/test.db');
    });

    it('should use database field when filepath is null for restore', async () => {
      const connNoPath: SavedConnection = { ...mockSQLiteConnection, filepath: null };
      const config: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, connNoPath, null);

      expect(result.args).toContain('test.db');
    });
  });

  // ─── Empty Database Validation Tests (All Drivers) ───────────────────────

  describe('empty database validation', () => {
    describe('backup', () => {
      it('should throw when SQLite filepath and database are both empty', async () => {
        const conn: SavedConnection = { ...mockSQLiteConnection, filepath: null, database: '' };
        const config: BackupConfig = {
          connectionId: 'conn-sqlite-1',
          entities: [],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/sqlite3',
          compress: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildBackupCommand(config, conn, null))
          .rejects.toThrow('Database file path is required for SQLite backup');
      });

      it('should throw when ClickHouse database name is empty', async () => {
        const conn: SavedConnection = { ...mockClickHouseConnection, database: '' };
        const config: BackupConfig = {
          connectionId: 'conn-clickhouse-1',
          entities: [],
          outputPath: '/tmp/backup.tsv',
          binaryPath: '/usr/bin/clickhouse-client',
          compress: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildBackupCommand(config, conn, null))
          .rejects.toThrow('Database name is required for ClickHouse backup');
      });

      it('should throw when MongoDB database name is empty', async () => {
        const conn: SavedConnection = { ...mockMongoDBConnection, database: '' };
        const config: BackupConfig = {
          connectionId: 'conn-mongodb-1',
          entities: [],
          outputPath: '/tmp/mongodump',
          binaryPath: '/usr/bin/mongodump',
          compress: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildBackupCommand(config, conn, null))
          .rejects.toThrow('Database name is required for MongoDB backup');
      });
    });

    describe('restore', () => {
      it('should throw when SQLite filepath and database are both empty', async () => {
        const conn: SavedConnection = { ...mockSQLiteConnection, filepath: null, database: '' };
        const config: RestoreConfig = {
          connectionId: 'conn-sqlite-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/sqlite3',
          isDirectory: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildRestoreCommand(config, conn, null))
          .rejects.toThrow('Database file path is required for SQLite restore');
      });

      it('should throw when MySQL database name is empty for restore', async () => {
        const conn: SavedConnection = { ...mockMySQLConnection, database: '' };
        const config: RestoreConfig = {
          connectionId: 'conn-mysql-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/mysql',
          isDirectory: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildRestoreCommand(config, conn, null))
          .rejects.toThrow('Database name is required for MySQL restore');
      });

      it('should throw when ClickHouse database name is empty for restore', async () => {
        const conn: SavedConnection = { ...mockClickHouseConnection, database: '' };
        const config: RestoreConfig = {
          connectionId: 'conn-clickhouse-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/clickhouse-client',
          isDirectory: false,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildRestoreCommand(config, conn, null))
          .rejects.toThrow('Database name is required for ClickHouse restore');
      });

      it('should throw when MongoDB database name is empty for restore', async () => {
        const conn: SavedConnection = { ...mockMongoDBConnection, database: '' };
        const config: RestoreConfig = {
          connectionId: 'conn-mongodb-1',
          inputPath: '/tmp/mongodump',
          binaryPath: '/usr/bin/mongorestore',
          isDirectory: true,
          customArgs: '',
          options: {},
        };

        await expect(backupService.buildRestoreCommand(config, conn, null))
          .rejects.toThrow('Database name is required for MongoDB restore');
      });
    });
  });

  // ─── Option Combinations Tests ────────────────────────────────────────────

  describe('option combinations', () => {
    describe('PostgreSQL backup options', () => {
      const pgBackupConfig: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [{ name: 'users', schema: 'public', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should produce correct command with no options enabled', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: {
            'inserts': false,
            'no-owner': false,
            'no-privileges': false,
            'clean': false,
            'create': false,
            'data-only': false,
            'schema-only': false,
            'verbose': false,
          },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).not.toContain('--inserts');
        expect(result.args).not.toContain('--no-owner');
        expect(result.args).not.toContain('--no-privileges');
        expect(result.args).not.toContain('--clean');
        expect(result.args).not.toContain('--create');
        expect(result.args).not.toContain('--data-only');
        expect(result.args).not.toContain('--schema-only');
        expect(result.args).not.toContain('--verbose');
      });

      it('should produce correct command with all options enabled', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: {
            'inserts': true,
            'no-owner': true,
            'no-privileges': true,
            'clean': true,
            'create': true,
            'data-only': true,
            'schema-only': true,
            'verbose': true,
          },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--inserts');
        expect(result.args).toContain('--no-owner');
        expect(result.args).toContain('--no-privileges');
        expect(result.args).toContain('--clean');
        expect(result.args).toContain('--create');
        expect(result.args).toContain('--data-only');
        expect(result.args).toContain('--schema-only');
        expect(result.args).toContain('--verbose');
      });

      it('should handle data-only without schema-only', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: { 'data-only': true, 'schema-only': false },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--data-only');
        expect(result.args).not.toContain('--schema-only');
      });

      it('should handle schema-only without data-only', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: { 'schema-only': true, 'data-only': false },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--schema-only');
        expect(result.args).not.toContain('--data-only');
      });

      it('should handle inserts with clean and create', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: { 'inserts': true, 'clean': true, 'create': true },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--inserts');
        expect(result.args).toContain('--clean');
        expect(result.args).toContain('--create');
      });

      it('should include custom args alongside options', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: { 'verbose': true, 'no-owner': true },
          customArgs: '--exclude-table=audit_logs --jobs=4',
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--verbose');
        expect(result.args).toContain('--no-owner');
        expect(result.args).toContain('--exclude-table=audit_logs');
        expect(result.args).toContain('--jobs=4');
      });

      it('should include password env along with options', async () => {
        const config: BackupConfig = {
          ...pgBackupConfig,
          options: { 'inserts': true },
        };

        const result = await backupService.buildBackupCommand(config, mockPostgresConnection, 'secret');

        expect(result.env['PGPASSWORD']).toBe('secret');
        expect(result.args).toContain('--inserts');
        expect(result.displayCommand).toContain('PGPASSWORD=********');
      });
    });

    describe('PostgreSQL restore options (psql)', () => {
      const pgRestoreConfig: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should produce correct command with no options enabled', async () => {
        const config: RestoreConfig = {
          ...pgRestoreConfig,
          options: {
            'verbose': false,
            'single-transaction': false,
          },
        };

        const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);

        expect(result.args).not.toContain('--echo-all');
        expect(result.args).not.toContain('--single-transaction');
      });

      it('should produce correct command with all valid psql options enabled', async () => {
        const config: RestoreConfig = {
          ...pgRestoreConfig,
          options: {
            'verbose': true,
            'single-transaction': true,
          },
        };

        const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--echo-all');
        expect(result.args).toContain('--single-transaction');
        // pg_restore flags must NOT appear
        expect(result.args).not.toContain('--no-owner');
        expect(result.args).not.toContain('--no-privileges');
      });

      it('should include custom args alongside restore options', async () => {
        const config: RestoreConfig = {
          ...pgRestoreConfig,
          options: { 'single-transaction': true, 'verbose': true },
          customArgs: '--set ON_ERROR_STOP=1',
        };

        const result = await backupService.buildRestoreCommand(config, mockPostgresConnection, null);

        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--echo-all');
        expect(result.args).toContain('--set');
        expect(result.args).toContain('ON_ERROR_STOP=1');
      });
    });

    describe('MySQL backup options', () => {
      const mysqlBackupConfig: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      it('should produce correct command with no options enabled', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: {
            'single-transaction': false,
            'routines': false,
            'triggers': false,
            'events': false,
            'add-drop-table': false,
            'no-create-info': false,
            'no-data': false,
          },
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

        expect(result.args).not.toContain('--single-transaction');
        expect(result.args).not.toContain('--routines');
        expect(result.args).not.toContain('--triggers');
        expect(result.args).not.toContain('--events');
        expect(result.args).not.toContain('--add-drop-table');
        expect(result.args).not.toContain('--no-create-info');
        expect(result.args).not.toContain('--no-data');
      });

      it('should produce correct command with all options enabled', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: {
            'single-transaction': true,
            'routines': true,
            'triggers': true,
            'events': true,
            'add-drop-table': true,
            'no-create-info': true,
            'no-data': true,
          },
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--routines');
        expect(result.args).toContain('--triggers');
        expect(result.args).toContain('--events');
        expect(result.args).toContain('--add-drop-table');
        expect(result.args).toContain('--no-create-info');
        expect(result.args).toContain('--no-data');
      });

      it('should handle single-transaction with routines and triggers', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: { 'single-transaction': true, 'routines': true, 'triggers': true },
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--routines');
        expect(result.args).toContain('--triggers');
      });

      it('should handle no-data with add-drop-table', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: { 'no-data': true, 'add-drop-table': true },
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

        expect(result.args).toContain('--no-data');
        expect(result.args).toContain('--add-drop-table');
      });

      it('should include custom args alongside MySQL options', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: { 'single-transaction': true },
          customArgs: '--max-allowed-packet=64M --quick',
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

        expect(result.args).toContain('--single-transaction');
        expect(result.args).toContain('--max-allowed-packet=64M');
        expect(result.args).toContain('--quick');
      });

      it('should include password env along with MySQL options', async () => {
        const config: BackupConfig = {
          ...mysqlBackupConfig,
          options: { 'routines': true, 'events': true },
        };

        const result = await backupService.buildBackupCommand(config, mockMySQLConnection, 'mysqlpass');

        expect(result.env['MYSQL_PWD']).toBe('mysqlpass');
        expect(result.args).toContain('--routines');
        expect(result.args).toContain('--events');
        expect(result.displayCommand).toContain('MYSQL_PWD=********');
      });
    });

    describe('SQLite backup with custom args', () => {
      it('should prepend custom args before filepath', async () => {
        const config: BackupConfig = {
          connectionId: 'conn-sqlite-1',
          entities: [{ name: 'users', type: BackupEntityType.Table }],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/sqlite3',
          compress: false,
          customArgs: '-header -csv',
          options: {},
        };

        const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

        expect(result.binary).toBe('/usr/bin/sqlite3');
        // Custom args should precede filepath
        const headerIdx = result.args.indexOf('-header');
        const pathIdx = result.args.indexOf('/path/to/test.db');
        expect(headerIdx).toBeLessThan(pathIdx);
        expect(result.args).toContain('-csv');
      });

      it('should handle multiple table dump', async () => {
        const config: BackupConfig = {
          connectionId: 'conn-sqlite-1',
          entities: [
            { name: 'users', type: BackupEntityType.Table },
            { name: 'orders', type: BackupEntityType.Table },
          ],
          outputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/sqlite3',
          compress: false,
          customArgs: '',
          options: {},
        };

        const result = await backupService.buildBackupCommand(config, mockSQLiteConnection, null);

        // Should produce multi-table dump commands separated by newline
        const dumpArg = result.args.find(a => a.includes('.dump'));
        expect(dumpArg).toContain('.dump "users"');
        expect(dumpArg).toContain('.dump "orders"');
      });
    });

    describe('ClickHouse backup with custom args', () => {
      it('should include custom args', async () => {
        const config: BackupConfig = {
          connectionId: 'conn-clickhouse-1',
          entities: [{ name: 'events', type: BackupEntityType.Table }],
          outputPath: '/tmp/backup.tsv',
          binaryPath: '/usr/bin/clickhouse-client',
          compress: false,
          customArgs: '--max_threads=4',
          options: {},
        };

        const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

        expect(result.args).toContain('--max_threads=4');
      });
    });

    describe('ClickHouse restore with custom args', () => {
      it('should include custom args alongside multiquery', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-clickhouse-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/clickhouse-client',
          isDirectory: false,
          customArgs: '--max_threads=4 --max_memory_usage=1000000000',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockClickHouseConnection, null);

        expect(result.args).toContain('--multiquery');
        expect(result.args).toContain('--max_threads=4');
        expect(result.args).toContain('--max_memory_usage=1000000000');
      });
    });

    describe('MongoDB backup with custom args', () => {
      it('should include custom args', async () => {
        const config: BackupConfig = {
          connectionId: 'conn-mongodb-1',
          entities: [],
          outputPath: '/tmp/mongodump',
          binaryPath: '/usr/bin/mongodump',
          compress: false,
          customArgs: '--gzip --numParallelCollections=4',
          options: {},
        };

        const result = await backupService.buildBackupCommand(config, mockMongoDBConnection, null);

        expect(result.args).toContain('--gzip');
        expect(result.args).toContain('--numParallelCollections=4');
      });
    });

    describe('MongoDB restore with custom args', () => {
      it('should include custom args for directory restore', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-mongodb-1',
          inputPath: '/tmp/mongodump',
          binaryPath: '/usr/bin/mongorestore',
          isDirectory: true,
          customArgs: '--drop --gzip',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockMongoDBConnection, null);

        expect(result.args).toContain('--drop');
        expect(result.args).toContain('--gzip');
        expect(result.args).toContain('/tmp/mongodump');
      });

      it('should include custom args for archive restore', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-mongodb-1',
          inputPath: '/tmp/backup.archive',
          binaryPath: '/usr/bin/mongorestore',
          isDirectory: false,
          customArgs: '--drop',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockMongoDBConnection, null);

        expect(result.args).toContain('--drop');
        expect(result.args).toContain('--archive=/tmp/backup.archive');
      });
    });

    describe('MySQL restore with custom args', () => {
      it('should include custom args', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-mysql-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/mysql',
          isDirectory: false,
          customArgs: '--max-allowed-packet=64M --force',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockMySQLConnection, null);

        expect(result.args).toContain('--max-allowed-packet=64M');
        expect(result.args).toContain('--force');
      });

      it('should include password env with custom args', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-mysql-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/mysql',
          isDirectory: false,
          customArgs: '--force',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockMySQLConnection, 'mypass');

        expect(result.env['MYSQL_PWD']).toBe('mypass');
        expect(result.args).toContain('--force');
        expect(result.displayCommand).toContain('MYSQL_PWD=********');
      });
    });

    describe('Redis backup with custom args', () => {
      it('should include custom args', async () => {
        const config: BackupConfig = {
          connectionId: 'conn-redis-1',
          entities: [],
          outputPath: '/tmp/dump.rdb',
          binaryPath: '/usr/bin/redis-cli',
          compress: false,
          customArgs: '--tls --cacert /path/to/ca.crt',
          options: {},
        };

        const result = await backupService.buildBackupCommand(config, mockRedisConnection, null);

        expect(result.args).toContain('--tls');
        expect(result.args).toContain('--cacert');
        expect(result.args).toContain('/path/to/ca.crt');
      });
    });

    describe('Redis restore with custom args', () => {
      it('should include custom args', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-redis-1',
          inputPath: '/tmp/dump.rdb',
          binaryPath: '/usr/bin/redis-cli',
          isDirectory: false,
          customArgs: '--tls',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockRedisConnection, null);

        expect(result.args).toContain('--tls');
        expect(result.args).toContain('--pipe');
      });
    });

    describe('SQLite restore with custom args', () => {
      it('should include custom args', async () => {
        const config: RestoreConfig = {
          connectionId: 'conn-sqlite-1',
          inputPath: '/tmp/backup.sql',
          binaryPath: '/usr/bin/sqlite3',
          isDirectory: false,
          customArgs: '-bail',
          options: {},
        };

        const result = await backupService.buildRestoreCommand(config, mockSQLiteConnection, null);

        expect(result.args).toContain('-bail');
        expect(result.args).toContain('/path/to/test.db');
      });
    });
  });

  // ─── MariaDB Tests ──────────────────────────────────────────────────────

  describe('MariaDB (uses MySQL builders)', () => {
    const mockMariaDBConnection: SavedConnection = {
      id: 'conn-mariadb-1',
      name: 'Test MariaDB',
      type: DatabaseType.MariaDB,
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      username: 'testuser',
      filepath: null,
      ssl: false,
      sslConfig: null,
      ssh: null,
      color: null,
      environment: null,
      folder: null,
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastConnectedAt: null,
    };

    it('should build backup command for MariaDB (uses mysqldump path)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mariadb-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb-dump',
        compress: false,
        customArgs: '',
        options: { 'single-transaction': true, 'routines': true },
      };

      const result = await backupService.buildBackupCommand(config, mockMariaDBConnection, null);

      expect(result.binary).toBe('/usr/bin/mariadb-dump');
      expect(result.args).toContain('testdb');
      expect(result.args).toContain('--single-transaction');
      expect(result.args).toContain('--routines');
    });

    it('should throw when MariaDB database name is empty for backup', async () => {
      const conn: SavedConnection = { ...mockMariaDBConnection, database: '' };
      const config: BackupConfig = {
        connectionId: 'conn-mariadb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb-dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(config, conn, null))
        .rejects.toThrow('Database name is required for MySQL backup');
    });

    it('should build restore command for MariaDB', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mariadb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMariaDBConnection, null);

      expect(result.binary).toBe('/usr/bin/mariadb');
      expect(result.args).toContain('testdb');
    });

    it('should throw when MariaDB database name is empty for restore', async () => {
      const conn: SavedConnection = { ...mockMariaDBConnection, database: '' };
      const config: RestoreConfig = {
        connectionId: 'conn-mariadb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildRestoreCommand(config, conn, null))
        .rejects.toThrow('Database name is required for MySQL restore');
    });
  });

  // ─── Multiple Entity Combinations ────────────────────────────────────────

  describe('entity combinations', () => {
    it('should handle PostgreSQL backup with mixed schemas', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [
          { name: 'users', schema: 'public', type: BackupEntityType.Table },
          { name: 'audit_log', schema: 'audit', type: BackupEntityType.Table },
          { name: 'user_summary', schema: 'public', type: BackupEntityType.View },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--table="public"."users"');
      expect(result.args).toContain('--table="audit"."audit_log"');
      expect(result.args).toContain('--table="public"."user_summary"');
    });

    it('should handle PostgreSQL backup with no entities (full database)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).not.toContain('--table=');
      // Should still have core args
      expect(result.args).toContain('--dbname=testdb');
      expect(result.args).toContain('--format=plain');
    });

    it('should handle MySQL backup with no entities (full database)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mysql-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysqldump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMySQLConnection, null);

      expect(result.args).not.toContain('--tables');
      expect(result.args).toContain('testdb');
    });

    it('should handle ClickHouse backup with multiple tables', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [
          { name: 'events', type: BackupEntityType.Table },
          { name: 'metrics', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      expect(query).toContain("name = 'events'");
      expect(query).toContain('SELECT * FROM `events` FORMAT SQLInsert');
      expect(query).toContain("name = 'metrics'");
      expect(query).toContain('SELECT * FROM `metrics` FORMAT SQLInsert');
    });
  });

  // ─── SQL Server backup/restore tests ─────────────────────────────────

  describe('SQL Server backup/restore', () => {
    const mockSQLServerConnection: SavedConnection = {
      id: 'conn-sqlserver-1',
      name: 'Test SQL Server',
      type: DatabaseType.SQLServer,
      host: 'localhost',
      port: 1433,
      database: 'testdb',
      username: 'sa',
      filepath: null,
      ssl: false,
      sslConfig: null,
      ssh: null,
      color: null,
      environment: null,
      folder: null,
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastConnectedAt: null,
    };

    it('should build sqlcmd backup command with password via env var', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLServerConnection, 'mypassword');

      expect(result.binary).toBe('/opt/mssql-tools18/bin/sqlcmd');
      expect(result.args).toContain('-S');
      expect(result.args).toContain('localhost,1433');
      expect(result.args).toContain('-U');
      expect(result.args).toContain('sa');
      expect(result.env).toHaveProperty('SQLCMDPASSWORD', 'mypassword');
      expect(result.args).not.toContain('-P');
      expect(result.args).not.toContain('mypassword');
      expect(result.args).toContain('-Q');
      const queryIdx = result.args.indexOf('-Q');
      expect(result.args[queryIdx + 1]).toContain('BACKUP DATABASE [testdb]');
      expect(result.args[queryIdx + 1]).toContain('/tmp/backup.bak');
    });

    it('should mask password in display command via SQLCMDPASSWORD env var', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLServerConnection, 'secretpwd');

      expect(result.displayCommand).toContain('SQLCMDPASSWORD=********');
      expect(result.displayCommand).not.toContain('secretpwd');
    });

    it('should escape bracket in database name for backup', async () => {
      const conn: SavedConnection = { ...mockSQLServerConnection, database: 'test]db' };
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, conn, null);

      const queryIdx = result.args.indexOf('-Q');
      expect(result.args[queryIdx + 1]).toContain('[test]]db]');
    });

    it('should build sqlcmd restore command with password via env var', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-sqlserver-1',
        inputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockSQLServerConnection, 'mypassword');

      expect(result.binary).toBe('/opt/mssql-tools18/bin/sqlcmd');
      expect(result.env).toHaveProperty('SQLCMDPASSWORD', 'mypassword');
      expect(result.args).not.toContain('-P');
      const queryIdx = result.args.indexOf('-Q');
      expect(result.args[queryIdx + 1]).toContain('RESTORE DATABASE [testdb]');
      expect(result.args[queryIdx + 1]).toContain('/tmp/backup.bak');
    });

    it('should throw when database name is empty for backup', async () => {
      const conn: SavedConnection = { ...mockSQLServerConnection, database: '' };
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(config, conn, null))
        .rejects.toThrow('Database name is required for SQL Server backup');
    });

    it('should throw when database name is empty for restore', async () => {
      const conn: SavedConnection = { ...mockSQLServerConnection, database: '' };
      const config: RestoreConfig = {
        connectionId: 'conn-sqlserver-1',
        inputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildRestoreCommand(config, conn, null))
        .rejects.toThrow('Database name is required for SQL Server restore');
    });

    it('should include -C flag when trustServerCertificate is set', async () => {
      const conn: SavedConnection = { ...mockSQLServerConnection, trustServerCertificate: true };
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, conn, null);

      expect(result.args).toContain('-C');
    });

    it('should escape single quotes in output path for backup (N-string)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [],
        outputPath: "/tmp/O'Brien's backup.bak",
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockSQLServerConnection, null);

      const queryIdx = result.args.indexOf('-Q');
      const query = result.args[queryIdx + 1];
      expect(query).toContain("N'/tmp/O''Brien''s backup.bak'");
      expect(query).not.toContain("O'B");
    });

    it('should escape single quotes in input path for restore (N-string)', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-sqlserver-1',
        inputPath: "/tmp/O'Brien's backup.bak",
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockSQLServerConnection, null);

      const queryIdx = result.args.indexOf('-Q');
      const query = result.args[queryIdx + 1];
      expect(query).toContain("N'/tmp/O''Brien''s backup.bak'");
      expect(query).not.toContain("O'B");
    });

    it('should escape bracket in database name for restore', async () => {
      const conn: SavedConnection = { ...mockSQLServerConnection, database: 'test]db' };
      const config: RestoreConfig = {
        connectionId: 'conn-sqlserver-1',
        inputPath: '/tmp/backup.bak',
        binaryPath: '/opt/mssql-tools18/bin/sqlcmd',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, conn, null);

      const queryIdx = result.args.indexOf('-Q');
      expect(result.args[queryIdx + 1]).toContain('[test]]db]');
    });
  });

  // ─── DuckDB backup/restore tests ─────────────────────────────────────

  describe('DuckDB backup/restore', () => {
    const mockDuckDBConnection: SavedConnection = {
      id: 'conn-duckdb-1',
      name: 'Test DuckDB',
      type: DatabaseType.DuckDB,
      host: null,
      port: null,
      database: 'test.duckdb',
      username: null,
      filepath: '/path/to/test.duckdb',
      ssl: false,
      sslConfig: null,
      ssh: null,
      color: null,
      environment: null,
      folder: null,
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastConnectedAt: null,
    };

    it('should detect duckdb binary', () => {
      const expected = join(SEARCH_DIRS.duckdb, `duckdb${binExt}`);
      mockExistsSync.mockImplementation((p: string) => p === expected);

      const result = backupService.detectBackupBinary(DatabaseType.DuckDB);

      expect(result.found).toBe(true);
      expect(result.path).toBe(expected);
    });

    it('should build duckdb dump command with filepath', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-duckdb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/opt/homebrew/bin/duckdb',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockDuckDBConnection, null);

      expect(result.args).toContain('/path/to/test.duckdb');
      expect(result.args).toContain('.dump');
    });

    it('should build duckdb dump command ignoring specific tables (DuckDB .dump does not support table names)', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-duckdb-1',
        entities: [
          { name: 'users', type: BackupEntityType.Table },
          { name: 'orders', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/opt/homebrew/bin/duckdb',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockDuckDBConnection, null);

      // DuckDB .dump does not support table-name arguments — always full dump
      const dumpCmd = result.args[result.args.length - 1];
      expect(dumpCmd).toBe('.dump');
    });

    it('should throw when filepath and database are both empty', async () => {
      const conn: SavedConnection = { ...mockDuckDBConnection, filepath: null, database: '' };
      const config: BackupConfig = {
        connectionId: 'conn-duckdb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/opt/homebrew/bin/duckdb',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(config, conn, null))
        .rejects.toThrow('Database file path is required for DuckDB backup');
    });

    it('should build duckdb restore command', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-duckdb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/opt/homebrew/bin/duckdb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockDuckDBConnection, null);

      expect(result.args).toContain('/path/to/test.duckdb');
    });

    it('should throw when filepath and database are both empty for restore', async () => {
      const conn: SavedConnection = { ...mockDuckDBConnection, filepath: null, database: '' };
      const config: RestoreConfig = {
        connectionId: 'conn-duckdb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/opt/homebrew/bin/duckdb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildRestoreCommand(config, conn, null))
        .rejects.toThrow('Database file path is required for DuckDB restore');
    });
  });

  // ─── PostgreSQL identifier quoting ───────────────────────────────────

  describe('PostgreSQL identifier quoting', () => {
    it('should quote table names with special characters in pg_dump', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [
          { name: 'my table', schema: 'public', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--table="public"."my table"');
    });

    it('should escape double quotes in identifiers for pg_dump', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [
          { name: 'my"table', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--table="my""table"');
    });
  });

  // ─── Custom args parsing ─────────────────────────────────────────────

  describe('custom args parsing', () => {
    it('should handle quoted values with spaces', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '--config="/path with spaces/config.ini" --verbose',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--config=/path with spaces/config.ini');
      expect(result.args).toContain('--verbose');
    });

    it('should handle single-quoted values', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: "--where='id > 100'",
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockPostgresConnection, null);

      expect(result.args).toContain('--where=id > 100');
    });
  });

  // ─── ClickHouse SSH tunnel rejection ─────────────────────────────────

  describe('ClickHouse SSH tunnel rejection', () => {
    it('should throw when backup is attempted through SSH tunnel', async () => {
      mockHasTunnel.mockReturnValue(true);
      mockGetLocalPort.mockReturnValue(18123);

      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildBackupCommand(config, mockClickHouseConnection, null))
        .rejects.toThrow('ClickHouse backup through SSH tunnels is not supported');
    });

    it('should throw when restore is attempted through SSH tunnel', async () => {
      mockHasTunnel.mockReturnValue(true);
      mockGetLocalPort.mockReturnValue(18123);

      const config: RestoreConfig = {
        connectionId: 'conn-clickhouse-1',
        inputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      await expect(backupService.buildRestoreCommand(config, mockClickHouseConnection, null))
        .rejects.toThrow('ClickHouse restore through SSH tunnels is not supported');
    });
  });

  // ─── MariaDB version warning ─────────────────────────────────────────

  describe('MariaDB version warning', () => {
    it('should not return mysql_native_password warning for MariaDB binary', () => {
      const savedPath = '/opt/homebrew/bin/mariadb-dump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockReturnValue('mariadb-dump  Ver 11.4.2-MariaDB\n');

      const result = backupService.detectBackupBinary(DatabaseType.MariaDB);

      expect(result.found).toBe(true);
      expect(result.version).toBe('11.4.2');
      expect(result.warning).toBeNull();
    });
  });

  // ─── ClickHouse backtick escaping ────────────────────────────────────

  describe('ClickHouse backtick escaping', () => {
    it('should double backticks in table names', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [
          { name: 'my`table', type: BackupEntityType.Table },
        ],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      expect(query).toContain('`my``table`');
    });
  });

  // ─── SSL/TLS Support Tests ──────────────────────────────────────────────

  describe('SSL/TLS backup and restore commands', () => {
    const sslConfig = {
      enabled: true,
      mode: SSLMode.VerifyFull,
      ca: '-----BEGIN CERTIFICATE-----\nCA_CERT\n-----END CERTIFICATE-----',
      cert: '-----BEGIN CERTIFICATE-----\nCLIENT_CERT\n-----END CERTIFICATE-----',
      key: '-----BEGIN RSA PRIVATE KEY-----\nCLIENT_KEY\n-----END RSA PRIVATE KEY-----',
      rejectUnauthorized: true,
    };

    const backupConfig: BackupConfig = {
      connectionId: 'conn-pg-1',
      entities: [],
      outputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/pg_dump',
      compress: false,
      customArgs: '',
      options: {},
    };

    const restoreConfig: RestoreConfig = {
      connectionId: 'conn-pg-1',
      inputPath: '/tmp/backup.sql',
      binaryPath: '/usr/bin/psql',
      isDirectory: false,
      customArgs: '',
      options: {},
    };

    // Use join() for expected paths so assertions work on both Unix and Windows
    const sslDir = '/tmp/zequel-ssl-abc123';
    const sslCaPath = join(sslDir, 'ca.pem');
    const sslCertPath = join(sslDir, 'cert.pem');
    const sslKeyPath = join(sslDir, 'key.pem');

    describe('PostgreSQL SSL', () => {
      const pgSslConn: SavedConnection = {
        ...mockPostgresConnection,
        ssl: true,
        sslConfig,
      };

      it('should set PGSSLMODE env var for backup', async () => {
        const result = await backupService.buildBackupCommand(backupConfig, pgSslConn, null);
        expect(result.env['PGSSLMODE']).toBe('verify-full');
      });

      it('should write SSL temp files and set PGSSLROOTCERT, PGSSLCERT, PGSSLKEY', async () => {
        const result = await backupService.buildBackupCommand(backupConfig, pgSslConn, null);
        expect(mockMkdtemp).toHaveBeenCalled();
        expect(mockWriteFile).toHaveBeenCalledTimes(3);
        expect(result.env['PGSSLROOTCERT']).toBe(sslCaPath);
        expect(result.env['PGSSLCERT']).toBe(sslCertPath);
        expect(result.env['PGSSLKEY']).toBe(sslKeyPath);
      });

      it('should track temp files for cleanup', async () => {
        const result = await backupService.buildBackupCommand(backupConfig, pgSslConn, null);
        expect(result.tempFiles).toContain(sslCaPath);
        expect(result.tempFiles).toContain(sslCertPath);
        expect(result.tempFiles).toContain(sslKeyPath);
      });

      it('should set PGSSLMODE to require when mode is Require', async () => {
        const conn: SavedConnection = {
          ...pgSslConn,
          sslConfig: { ...sslConfig, mode: SSLMode.Require },
        };
        const result = await backupService.buildBackupCommand(backupConfig, conn, null);
        expect(result.env['PGSSLMODE']).toBe('require');
      });

      it('should default PGSSLMODE to require when no mode specified', async () => {
        const conn: SavedConnection = {
          ...pgSslConn,
          sslConfig: { enabled: true },
        };
        const result = await backupService.buildBackupCommand(backupConfig, conn, null);
        expect(result.env['PGSSLMODE']).toBe('require');
      });

      it('should set PGSSLMODE for restore', async () => {
        const result = await backupService.buildRestoreCommand(restoreConfig, pgSslConn, null);
        expect(result.env['PGSSLMODE']).toBe('verify-full');
        expect(result.env['PGSSLROOTCERT']).toBe(sslCaPath);
      });

      it('should handle SSL with only CA cert', async () => {
        const conn: SavedConnection = {
          ...pgSslConn,
          sslConfig: { enabled: true, ca: sslConfig.ca },
        };
        const result = await backupService.buildBackupCommand(backupConfig, conn, null);
        expect(result.env['PGSSLROOTCERT']).toBe(sslCaPath);
        expect(result.env['PGSSLCERT']).toBeUndefined();
        expect(result.env['PGSSLKEY']).toBeUndefined();
      });

      it('should not set SSL env vars when ssl is false', async () => {
        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);
        expect(result.env['PGSSLMODE']).toBeUndefined();
        expect(result.env['PGSSLROOTCERT']).toBeUndefined();
      });
    });

    describe('MySQL SSL', () => {
      const mysqlSslConn: SavedConnection = {
        ...mockMySQLConnection,
        ssl: true,
        sslConfig,
      };

      const mysqlBackupConfig: BackupConfig = {
        ...backupConfig,
        connectionId: 'conn-mysql-1',
        binaryPath: '/usr/bin/mysqldump',
      };

      const mysqlRestoreConfig: RestoreConfig = {
        ...restoreConfig,
        connectionId: 'conn-mysql-1',
        binaryPath: '/usr/bin/mysql',
      };

      it('should add --ssl-mode matching sslConfig.mode for backup', async () => {
        const result = await backupService.buildBackupCommand(mysqlBackupConfig, mysqlSslConn, null);
        // sslConfig has mode: SSLMode.VerifyFull → VERIFY_IDENTITY
        expect(result.args).toContain('--ssl-mode=VERIFY_IDENTITY');
      });

      it('should add SSL cert flags for backup', async () => {
        const result = await backupService.buildBackupCommand(mysqlBackupConfig, mysqlSslConn, null);
        expect(result.args).toContain(`--ssl-ca=${sslCaPath}`);
        expect(result.args).toContain(`--ssl-cert=${sslCertPath}`);
        expect(result.args).toContain(`--ssl-key=${sslKeyPath}`);
      });

      it('should add SSL flags for restore', async () => {
        const result = await backupService.buildRestoreCommand(mysqlRestoreConfig, mysqlSslConn, null);
        // sslConfig has mode: SSLMode.VerifyFull → VERIFY_IDENTITY
        expect(result.args).toContain('--ssl-mode=VERIFY_IDENTITY');
        expect(result.args).toContain(`--ssl-ca=${sslCaPath}`);
      });

      it('should not add SSL flags when ssl is false', async () => {
        const result = await backupService.buildBackupCommand(mysqlBackupConfig, mockMySQLConnection, null);
        expect(result.args.join(' ')).not.toContain('--ssl');
      });

      it('should handle SSL with only CA cert', async () => {
        const conn: SavedConnection = {
          ...mysqlSslConn,
          sslConfig: { enabled: true, ca: sslConfig.ca },
        };
        const result = await backupService.buildBackupCommand(mysqlBackupConfig, conn, null);
        expect(result.args).toContain('--ssl-mode=REQUIRED');
        expect(result.args).toContain(`--ssl-ca=${sslCaPath}`);
        expect(result.args.join(' ')).not.toContain('--ssl-cert');
        expect(result.args.join(' ')).not.toContain('--ssl-key');
      });

      it('should track temp files for cleanup', async () => {
        const result = await backupService.buildBackupCommand(mysqlBackupConfig, mysqlSslConn, null);
        expect(result.tempFiles).toHaveLength(3);
      });
    });

    describe('ClickHouse SSL', () => {
      const chSslConn: SavedConnection = {
        ...mockClickHouseConnection,
        ssl: true,
        sslConfig: { enabled: true },
      };

      const chBackupConfig: BackupConfig = {
        ...backupConfig,
        connectionId: 'conn-clickhouse-1',
        binaryPath: '/usr/bin/clickhouse-client',
      };

      const chRestoreConfig: RestoreConfig = {
        ...restoreConfig,
        connectionId: 'conn-clickhouse-1',
        binaryPath: '/usr/bin/clickhouse-client',
      };

      it('should add --secure flag for backup', async () => {
        const result = await backupService.buildBackupCommand(chBackupConfig, chSslConn, null);
        expect(result.args).toContain('--secure');
      });

      it('should add --secure flag for restore', async () => {
        const result = await backupService.buildRestoreCommand(chRestoreConfig, chSslConn, null);
        expect(result.args).toContain('--secure');
      });

      it('should not add --secure when ssl is false', async () => {
        const result = await backupService.buildBackupCommand(chBackupConfig, mockClickHouseConnection, null);
        expect(result.args).not.toContain('--secure');
      });
    });

    describe('MongoDB SSL', () => {
      const mongoSslConn: SavedConnection = {
        ...mockMongoDBConnection,
        ssl: true,
        sslConfig: {
          enabled: true,
          ca: sslConfig.ca,
          cert: sslConfig.cert,
          rejectUnauthorized: false,
        },
      };

      const mongoBackupConfig: BackupConfig = {
        ...backupConfig,
        connectionId: 'conn-mongodb-1',
        binaryPath: '/usr/bin/mongodump',
        outputPath: '/tmp/mongodump',
      };

      const mongoRestoreConfig: RestoreConfig = {
        ...restoreConfig,
        connectionId: 'conn-mongodb-1',
        binaryPath: '/usr/bin/mongorestore',
        inputPath: '/tmp/mongodump',
      };

      it('should add --tls flag for backup', async () => {
        const result = await backupService.buildBackupCommand(mongoBackupConfig, mongoSslConn, null);
        expect(result.args).toContain('--tls');
      });

      it('should add --tlsInsecure when rejectUnauthorized is false', async () => {
        const result = await backupService.buildBackupCommand(mongoBackupConfig, mongoSslConn, null);
        expect(result.args).toContain('--tlsInsecure');
      });

      it('should not add --tlsInsecure when rejectUnauthorized is true', async () => {
        const conn: SavedConnection = {
          ...mongoSslConn,
          sslConfig: { ...mongoSslConn.sslConfig!, rejectUnauthorized: true },
        };
        const result = await backupService.buildBackupCommand(mongoBackupConfig, conn, null);
        expect(result.args).not.toContain('--tlsInsecure');
      });

      it('should add TLS cert file flags for backup', async () => {
        const result = await backupService.buildBackupCommand(mongoBackupConfig, mongoSslConn, null);
        expect(result.args.some(a => a.startsWith('--tlsCAFile='))).toBe(true);
        expect(result.args.some(a => a.startsWith('--tlsCertificateKeyFile='))).toBe(true);
      });

      it('should add --tls flag for restore', async () => {
        const result = await backupService.buildRestoreCommand(mongoRestoreConfig, mongoSslConn, null);
        expect(result.args).toContain('--tls');
      });

      it('should not add TLS flags when ssl is false', async () => {
        const result = await backupService.buildBackupCommand(mongoBackupConfig, mockMongoDBConnection, null);
        expect(result.args).not.toContain('--tls');
      });
    });

    describe('Redis SSL', () => {
      const redisSslConn: SavedConnection = {
        ...mockRedisConnection,
        ssl: true,
        sslConfig: {
          enabled: true,
          ca: sslConfig.ca,
          cert: sslConfig.cert,
          key: sslConfig.key,
        },
      };

      const redisBackupConfig: BackupConfig = {
        ...backupConfig,
        connectionId: 'conn-redis-1',
        binaryPath: '/usr/bin/redis-cli',
        outputPath: '/tmp/dump.rdb',
      };

      const redisRestoreConfig: RestoreConfig = {
        ...restoreConfig,
        connectionId: 'conn-redis-1',
        binaryPath: '/usr/bin/redis-cli',
        inputPath: '/tmp/dump.rdb',
      };

      it('should add --tls flag for backup', async () => {
        const result = await backupService.buildBackupCommand(redisBackupConfig, redisSslConn, null);
        expect(result.args).toContain('--tls');
      });

      it('should add SSL cert flags for backup', async () => {
        const result = await backupService.buildBackupCommand(redisBackupConfig, redisSslConn, null);
        const argsStr = result.args.join(' ');
        expect(argsStr).toContain('--cacert');
        expect(argsStr).toContain('--cert');
        expect(argsStr).toContain('--key');
      });

      it('should add --tls flag for restore', async () => {
        const result = await backupService.buildRestoreCommand(redisRestoreConfig, redisSslConn, null);
        expect(result.args).toContain('--tls');
      });

      it('should not add TLS flags when ssl is false', async () => {
        const result = await backupService.buildBackupCommand(redisBackupConfig, mockRedisConnection, null);
        expect(result.args).not.toContain('--tls');
      });
    });

    describe('SQL Server SSL', () => {
      const sqlServerSslConn: SavedConnection = {
        id: 'conn-sqlserver-1',
        name: 'Test SQL Server',
        type: DatabaseType.SQLServer,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        username: 'sa',
        filepath: null,
        ssl: true,
        sslConfig: { enabled: true },
        ssh: null,
        color: null,
        environment: null,
        folder: null,
        sortOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastConnectedAt: null,
      };

      const sqlServerBackupConfig: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [{ name: 'testdb', type: BackupEntityType.Database }],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/usr/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const sqlServerRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlserver-1',
        inputPath: '/tmp/backup.bak',
        binaryPath: '/usr/bin/sqlcmd',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      it('should add -N flag for backup when ssl is true', async () => {
        const result = await backupService.buildBackupCommand(sqlServerBackupConfig, sqlServerSslConn, 'password');
        expect(result.args).toContain('-N');
      });

      it('should add -N flag for restore when ssl is true', async () => {
        const result = await backupService.buildRestoreCommand(sqlServerRestoreConfig, sqlServerSslConn, 'password');
        expect(result.args).toContain('-N');
      });

      it('should not add -N flag when ssl is false', async () => {
        const conn: SavedConnection = { ...sqlServerSslConn, ssl: false };
        const result = await backupService.buildBackupCommand(sqlServerBackupConfig, conn, 'password');
        expect(result.args).not.toContain('-N');
      });
    });

    describe('temp file cleanup', () => {
      it('should write SSL temp files with secure permissions', async () => {
        const pgSslConn: SavedConnection = {
          ...mockPostgresConnection,
          ssl: true,
          sslConfig,
        };

        await backupService.buildBackupCommand(backupConfig, pgSslConn, null);

        // Check that writeFile was called with mode 0o600 for secure file permissions
        for (const call of mockWriteFile.mock.calls) {
          expect(call[2]).toEqual({ mode: 0o600 });
        }
      });

      it('should cleanup temp files after backup completes', async () => {
        const mockSend = vi.fn();
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

        const pgSslConn: SavedConnection = {
          ...mockPostgresConnection,
          ssl: true,
          sslConfig,
        };

        const proc = createMockProc();
        mockSpawn.mockReturnValue(proc);
        mockGetPassword.mockResolvedValue(null);

        backupService.executeBackup(backupConfig, pgSslConn);

        await vi.waitFor(() => {
          expect(mockSpawn).toHaveBeenCalled();
        });

        // Complete the process
        proc.emit('close', 0);

        await vi.waitFor(() => {
          // Temp files should be cleaned up via unlink
          expect(mockUnlink).toHaveBeenCalled();
        });
      });

      it('should cleanup temp directory when SSL file write partially fails', async () => {
        // Simulate: mkdtemp succeeds, first writeFile succeeds, second writeFile throws
        let writeCount = 0;
        mockWriteFile.mockImplementation(() => {
          writeCount++;
          if (writeCount === 2) return Promise.reject(new Error('ENOSPC: no space left'));
          return Promise.resolve();
        });

        const pgSslConn: SavedConnection = {
          ...mockPostgresConnection,
          ssl: true,
          sslConfig: {
            ca: '-----CA-----',
            cert: '-----CERT-----',
            key: '-----KEY-----',
          },
        };

        await expect(backupService.buildBackupCommand(backupConfig, pgSslConn, null))
          .rejects.toThrow('ENOSPC');

        // The temp directory should be cleaned up via rm(dir, { recursive: true })
        expect(mockRm).toHaveBeenCalledWith(
          expect.stringContaining('zequel-ssl-'),
          { recursive: true, force: true }
        );
      });
    });
  });

  // ─── Stream Error Handling Tests ────────────────────────────────────────

  describe('stream error handling', () => {
    it('should kill backup process when WriteStream errors', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const sqliteBackupConfig: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(sqliteBackupConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger WriteStream error (e.g. disk full)
      ws.emit('error', new Error('ENOSPC: no space left on device'));

      // Process should be killed
      expect(proc.kill).toHaveBeenCalled();
    });

    it('should kill restore process when ReadStream errors', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);
      mockExistsSync.mockReturnValue(true);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Trigger ReadStream error
      rs.emit('error', new Error('ENOENT: no such file'));

      // Process should be killed
      expect(proc.kill).toHaveBeenCalled();
    });

    it('should use 256KB highWaterMark for backup WriteStream', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const ws = createMockWriteStream();
      (proc.stdout as EventEmitter & { pipe?: ReturnType<typeof vi.fn> }).pipe = vi.fn();

      mockSpawn.mockReturnValue(proc);
      mockCreateWriteStream.mockReturnValue(ws);
      mockGetPassword.mockResolvedValue(null);

      const sqliteBackupConfig: BackupConfig = {
        connectionId: 'conn-sqlite-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(sqliteBackupConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockCreateWriteStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      });

      proc.emit('close', 0);
    });

    it('should use 256KB highWaterMark for restore ReadStream', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      const rs = createMockReadStream();

      mockSpawn.mockReturnValue(proc);
      mockCreateReadStream.mockReturnValue(rs);
      mockGetPassword.mockResolvedValue(null);
      mockExistsSync.mockReturnValue(true);

      const sqliteRestoreConfig: RestoreConfig = {
        connectionId: 'conn-sqlite-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(sqliteRestoreConfig, mockSQLiteConnection);

      await vi.waitFor(() => {
        expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 256 * 1024 });
      });

      proc.emit('close', 0);
    });
  });

  // ─── Security Tests ─────────────────────────────────────────────────────

  describe('security', () => {
    it('should use env var for ClickHouse password instead of CLI args', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.tsv',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, 'clickpass');
      expect(result.env['CLICKHOUSE_PASSWORD']).toBe('clickpass');
      expect(result.args).not.toContain('clickpass');
      expect(result.args.join(' ')).not.toContain('--password');
    });

    it('should use env var for SQL Server password instead of CLI args', async () => {
      const sqlServerConn: SavedConnection = {
        id: 'conn-sqlserver-1',
        name: 'Test SQL Server',
        type: DatabaseType.SQLServer,
        host: 'localhost',
        port: 1433,
        database: 'testdb',
        username: 'sa',
        filepath: null,
        ssl: false,
        sslConfig: null,
        ssh: null,
        color: null,
        environment: null,
        folder: null,
        sortOrder: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        lastConnectedAt: null,
      };

      const config: BackupConfig = {
        connectionId: 'conn-sqlserver-1',
        entities: [{ name: 'testdb', type: BackupEntityType.Database }],
        outputPath: '/tmp/backup.bak',
        binaryPath: '/usr/bin/sqlcmd',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, sqlServerConn, 'sqlpass');
      expect(result.env['SQLCMDPASSWORD']).toBe('sqlpass');
      expect(result.args).not.toContain('sqlpass');
      expect(result.args.join(' ')).not.toContain('-P');
    });

    it('should use execFileSync for version detection (no shell injection)', async () => {
      const expectedBinary = join(SEARCH_DIRS.pg, `pg_dump${binExt}`);
      mockExistsSync.mockImplementation((p: string) => p === expectedBinary);

      backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(mockExecFileSync).toHaveBeenCalledWith(
        expectedBinary,
        ['--version'],
        expect.objectContaining({ encoding: 'utf-8', timeout: 5000 })
      );
      // execSync should NOT be used for version detection
      expect(mockExecSync).not.toHaveBeenCalledWith(
        expect.stringContaining('--version'),
        expect.anything()
      );
    });

    it('should validate restore input path exists before spawning', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      mockGetPassword.mockResolvedValue(null);
      mockExistsSync.mockReturnValue(false);

      const restoreConfig: RestoreConfig = {
        connectionId: 'conn-pg-1',
        inputPath: '/nonexistent/backup.sql',
        binaryPath: '/usr/bin/psql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      backupService.executeRestore(restoreConfig, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'restore:output',
          expect.objectContaining({
            status: BackupStatus.Error,
            stderr: expect.stringContaining('Restore input path does not exist'),
          })
        );
      });

      // spawn should NOT have been called
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it('should not spread full process.env into spawn', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(config, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // The env passed to spawn should NOT contain all process.env keys
      const spawnCall = mockSpawn.mock.calls[0];
      const spawnEnv = spawnCall[2]?.env as Record<string, string> | undefined;
      expect(spawnEnv).toBeDefined();

      // It should have PATH but not random env vars
      if (process.env['PATH']) {
        expect(spawnEnv!['PATH']).toBe(process.env['PATH']);
      }

      // It should NOT have leaked secrets from process.env
      // (buildSpawnEnv only passes a curated allowlist of env vars)
      const allowedKeys = new Set([
        'PATH', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP',
        'LANG', 'LC_ALL', 'SystemRoot',
        'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'DYLD_FALLBACK_LIBRARY_PATH',
        'PGPASSWORD',
      ]);
      for (const key of Object.keys(spawnEnv!)) {
        expect(allowedKeys.has(key)).toBe(true);
      }

      proc.emit('close', 0);
    });
  });

  // ─── MariaDB SSL tests ───────────────────────────────────────────────

  describe('MariaDB SSL backup and restore', () => {
    const mockMariaDBConnection: SavedConnection = {
      id: 'conn-mariadb-1',
      name: 'Test MariaDB',
      type: DatabaseType.MariaDB,
      host: 'localhost',
      port: 3306,
      database: 'testdb',
      username: 'testuser',
      filepath: null,
      ssl: true,
      sslConfig: {
        enabled: true,
        mode: SSLMode.VerifyFull,
        ca: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
      },
      ssh: null,
      color: null,
      environment: null,
      folder: null,
      sortOrder: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      lastConnectedAt: null,
    };

    it('should use --ssl flag (not --ssl-mode) for MariaDB backup', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mariadb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb-dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMariaDBConnection, null);

      expect(result.args).toContain('--ssl');
      expect(result.args).toContain('--ssl-verify-server-cert');
      // Must NOT use MySQL-style --ssl-mode flag
      expect(result.args.join(' ')).not.toContain('--ssl-mode');
    });

    it('should use --ssl flag (not --ssl-mode) for MariaDB restore', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mariadb-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildRestoreCommand(config, mockMariaDBConnection, null);

      expect(result.args).toContain('--ssl');
      expect(result.args).toContain('--ssl-verify-server-cert');
      expect(result.args.join(' ')).not.toContain('--ssl-mode');
    });

    it('should not add --ssl-verify-server-cert for MariaDB with SSLMode.Require', async () => {
      const conn: SavedConnection = {
        ...mockMariaDBConnection,
        sslConfig: { enabled: true, mode: SSLMode.Require },
      };

      const config: BackupConfig = {
        connectionId: 'conn-mariadb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb-dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, conn, null);

      expect(result.args).toContain('--ssl');
      expect(result.args).not.toContain('--ssl-verify-server-cert');
    });

    it('should add --ssl-ca flag for MariaDB with CA cert', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-mariadb-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mariadb-dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockMariaDBConnection, null);

      expect(result.args).toContain(`--ssl-ca=${join('/tmp/zequel-ssl-abc123', 'ca.pem')}`);
    });
  });

  // ─── MySQL restore force option ──────────────────────────────────────

  describe('MySQL restore force option', () => {
    it('should add --force when force option is enabled', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: { 'force': true },
      };

      const result = await backupService.buildRestoreCommand(config, mockMySQLConnection, null);

      expect(result.args).toContain('--force');
    });

    it('should not add --force when force option is disabled', async () => {
      const config: RestoreConfig = {
        connectionId: 'conn-mysql-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: { 'force': false },
      };

      const result = await backupService.buildRestoreCommand(config, mockMySQLConnection, null);

      expect(result.args).not.toContain('--force');
    });
  });

  // ─── appendLog truncation ────────────────────────────────────────────

  describe('appendLog truncation', () => {
    // Access the private appendLog via the module — we test it indirectly
    // by generating enough stderr data to trigger truncation in runBackup.
    // Instead, we test the behavior through the public API by checking
    // that large outputs don't grow unbounded.
    it('should handle very large stderr without crashing', async () => {
      const mockSend = vi.fn();
      const { BrowserWindow } = await import('electron');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([{ webContents: { send: mockSend } } as never]);

      const proc = createMockProc();
      mockSpawn.mockReturnValue(proc);
      mockGetPassword.mockResolvedValue(null);

      const config: BackupConfig = {
        connectionId: 'conn-pg-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      backupService.executeBackup(config, mockPostgresConnection);

      await vi.waitFor(() => {
        expect(mockSpawn).toHaveBeenCalled();
      });

      // Emit 1MB of stderr data (exceeds MAX_LOG_BYTES of 512KB)
      const chunk = Buffer.from('x'.repeat(100_000));
      for (let i = 0; i < 12; i++) {
        proc.stderr.emit('data', chunk);
      }

      proc.emit('close', 1);

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(
          'backup:output',
          expect.objectContaining({ status: BackupStatus.Error })
        );
      });

      // Verify stderr was captured and truncated (not the full 1.2MB)
      const lastCall = mockSend.mock.calls[mockSend.mock.calls.length - 1];
      const progress = lastCall[1] as { stderr: string };
      expect(progress.stderr.length).toBeLessThan(600_000);
      expect(progress.stderr).toContain('...(truncated)');
    });
  });

  // ─── ClickHouse backup format (SQLInsert) ────────────────────────────

  describe('ClickHouse backup SQLInsert format', () => {
    it('should use FORMAT SQLInsert for restorable data', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      expect(query).toContain('FORMAT SQLInsert');
      expect(query).not.toContain('FORMAT Native');
    });

    it('should query system.tables for DDL with semicolons', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'events', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      // DDL should come from system.tables with semicolons appended
      expect(query).toContain("concat(create_table_query, ';");
      expect(query).toContain('FORMAT TabSeparatedRaw');
    });

    it('should use full-database DDL dump when no entities selected', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      expect(query).toContain('system.tables');
      expect(query).toContain('currentDatabase()');
      expect(query).toContain("concat(create_table_query, ';");
    });

    it('should escape single quotes in table names for ClickHouse string literals', async () => {
      const connWithQuote: SavedConnection = { ...mockClickHouseConnection };
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: "table'name", type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, connWithQuote, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      // Single quote should be escaped with backslash for ClickHouse string literals
      expect(query).toContain("table\\'name");
    });

    it('should escape backslashes in table names for ClickHouse string literals', async () => {
      const config: BackupConfig = {
        connectionId: 'conn-clickhouse-1',
        entities: [{ name: 'table\\name', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/clickhouse-client',
        compress: false,
        customArgs: '',
        options: {},
      };

      const result = await backupService.buildBackupCommand(config, mockClickHouseConnection, null);

      const queryIdx = result.args.indexOf('--query');
      const query = result.args[queryIdx + 1];
      // Backslash should be doubled for ClickHouse string literals
      expect(query).toContain('table\\\\name');
    });
  });
});
