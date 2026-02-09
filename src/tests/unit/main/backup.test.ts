import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { join } from 'path';

// Use vi.hoisted to declare mocks before vi.mock factories (which are hoisted)
const {
  mockExistsSync,
  mockCreateReadStream,
  mockCreateWriteStream,
  mockExecSync,
  mockSpawn,
  mockSettingsGet,
  mockConnectionsGet,
  mockGetPassword,
  mockHasTunnel,
  mockGetLocalPort,
  mockUnlink,
  mockRename,
  mockStat,
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
    mockSpawn: vi.fn(),
    mockSettingsGet: vi.fn(() => null as string | null),
    mockConnectionsGet: vi.fn(),
    mockGetPassword: vi.fn(() => Promise.resolve(null as string | null)),
    mockHasTunnel: vi.fn(() => false),
    mockGetLocalPort: vi.fn(() => null as number | null),
    mockUnlink: vi.fn(() => Promise.resolve()),
    mockRename: vi.fn(() => Promise.resolve()),
    mockStat: vi.fn(() => Promise.resolve({ isDirectory: () => false })),
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
  type SavedConnection,
  type BackupConfig,
  type RestoreConfig,
} from '@main/types';

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
  });

  // ─── Binary Detection Tests ────────────────────────────────────────────

  describe('detectBackupBinary', () => {
    it('should return saved path from settings when it exists', () => {
      const savedPath = '/custom/path/pg_dump';
      mockSettingsGet.mockReturnValue(savedPath);
      mockExistsSync.mockReturnValue(true);

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(mockSettingsGet).toHaveBeenCalledWith('backup.binary.postgresql');
      expect(result).toEqual({ path: savedPath, found: true });
    });

    it('should return not found when saved path does not exist', () => {
      mockSettingsGet.mockReturnValue('/nonexistent/pg_dump');
      mockExistsSync.mockReturnValue(false);

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result.found).toBe(false);
    });

    it('should scan common directories and find binary', () => {
      const expected = join('/opt/homebrew/bin', 'pg_dump');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result).toEqual({ path: expected, found: true });
    });

    it('should fallback to which command when binary not in common dirs', () => {
      // Return a path that is NOT in COMMON_SEARCH_DIRS so the scan doesn't short-circuit
      const whichResult = '/some/unusual/path/pg_dump'
      mockExecSync.mockReturnValue(whichResult + '\n');
      mockExistsSync.mockImplementation((path: string) => {
        return path === whichResult;
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(mockExecSync).toHaveBeenCalledWith('which pg_dump', { encoding: 'utf-8', timeout: 5000 });
      expect(result).toEqual({ path: whichResult, found: true });
    });

    it('should return not found when which command fails', () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = backupService.detectBackupBinary(DatabaseType.PostgreSQL);

      expect(result).toEqual({ path: null, found: false });
    });

    it('should detect MySQL binary', () => {
      const expected = join('/usr/local/bin', 'mysqldump');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.MySQL);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect SQLite binary', () => {
      const expected = join('/usr/bin', 'sqlite3');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.SQLite);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect MongoDB binary', () => {
      const expected = join('/opt/homebrew/bin', 'mongodump');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.MongoDB);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect ClickHouse binary with fallback', () => {
      const expected = join('/usr/local/bin', 'clickhouse');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectBackupBinary(DatabaseType.ClickHouse);

      expect(result.found).toBe(true);
    });

    it('should detect MariaDB binary with fallback to mysqldump', () => {
      const expected = join('/usr/local/bin', 'mysqldump');
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
      expect(result).toEqual({ path: savedPath, found: true });
    });

    it('should scan common directories for psql', () => {
      const expected = join('/Applications/Postgres.app/Contents/Versions/latest/bin', 'psql');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectRestoreBinary(DatabaseType.PostgreSQL);

      expect(result.found).toBe(true);
    });

    it('should detect mysql restore binary', () => {
      const expected = join('/usr/local/bin', 'mysql');
      mockExistsSync.mockImplementation((p: string) => {
        return p === expected;
      });

      const result = backupService.detectRestoreBinary(DatabaseType.MySQL);

      expect(result.path).toBe(expected);
      expect(result.found).toBe(true);
    });

    it('should detect mongorestore binary', () => {
      const expected = join('/opt/homebrew/bin', 'mongorestore');
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
        expect(result.args).toContain('--dbname');
        expect(result.args).toContain('testdb');
      });

      it('should include table filtering with schema qualification', async () => {
        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockPostgresConnection, null);

        expect(result.args).toContain('--table=public.users');
        expect(result.args).toContain('--table=public.orders');
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

      it('should include password argument when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, 'chpass');

        expect(result.args).toContain('--password');
        expect(result.args).toContain('chpass');
      });

      it('should mask password in displayCommand', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, 'chpass');

        expect(result.displayCommand).toContain('--password ********');
        expect(result.displayCommand).not.toContain('chpass');
      });

      it('should include query with TabSeparatedWithNames format and backtick-quoted table', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildBackupCommand(backupConfig, mockClickHouseConnection, null);

        expect(result.args).toContain('--query');
        const queryIndex = result.args.indexOf('--query');
        expect(result.args[queryIndex + 1]).toContain('SELECT * FROM `events` FORMAT TabSeparatedWithNames');
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
        expect(result.args).toContain('--dbname');
        expect(result.args).toContain('testdb');
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

      it('should add restore options', async () => {
        const configWithOptions: RestoreConfig = {
          ...restoreConfig,
          options: {
            'no-owner': true,
            'no-privileges': true,
            'clean': true,
            'create': true,
            'data-only': true,
            'schema-only': false,
            'verbose': true,
            'single-transaction': true,
          },
        };

        mockConnectionsGet.mockReturnValue(mockPostgresConnection);

        const result = await backupService.buildRestoreCommand(configWithOptions, mockPostgresConnection, null);

        expect(result.args).toContain('--no-owner');
        expect(result.args).toContain('--no-privileges');
        expect(result.args).toContain('--clean');
        expect(result.args).toContain('--create');
        expect(result.args).toContain('--data-only');
        expect(result.args).not.toContain('--schema-only');
        expect(result.args).toContain('--verbose');
        expect(result.args).toContain('--single-transaction');
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

      it('should include password argument when provided', async () => {
        mockConnectionsGet.mockReturnValue(mockClickHouseConnection);

        const result = await backupService.buildRestoreCommand(restoreConfig, mockClickHouseConnection, 'chpass');

        expect(result.args).toContain('--password');
        expect(result.args).toContain('chpass');
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
    ws.end = vi.fn();
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

      expect(operationId).toMatch(/^backup-\d+$/);
    });

    it('should return a string containing a numeric timestamp', () => {
      const operationId = backupService.executeBackup(backupConfig, mockPostgresConnection);
      const timestamp = operationId.replace('backup-', '');

      expect(Number(timestamp)).toBeGreaterThan(0);
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

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/tmp/backup.sql');
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

      expect(mockCreateWriteStream).toHaveBeenCalledWith('/tmp/backup.tsv');
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

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return an operationId starting with restore-', () => {
      const operationId = backupService.executeRestore(restoreConfig, mockPostgresConnection);

      expect(operationId).toMatch(/^restore-\d+$/);
    });

    it('should return a string containing a numeric timestamp', () => {
      const operationId = backupService.executeRestore(restoreConfig, mockPostgresConnection);
      const timestamp = operationId.replace('restore-', '');

      expect(Number(timestamp)).toBeGreaterThan(0);
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

      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 64 * 1024 });
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

      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/dump.rdb', { highWaterMark: 64 * 1024 });
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
      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 64 * 1024 });
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
      expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/backup.sql', { highWaterMark: 64 * 1024 });
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
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
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
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
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
      expect(progress.stdout).toContain('Compressed to /tmp/backup.zip');
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

      expect(mockUnlink).toHaveBeenCalledWith('/tmp/mongodump');
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
      expect(mockRename).toHaveBeenCalledWith('/tmp/backup.sql.zip', '/tmp/backup.zip');
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
});
