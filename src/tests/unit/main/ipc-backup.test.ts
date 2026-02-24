import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerBackupHandlers } from '@main/ipc/backup';
import { logger } from '@main/utils/logger';
import { backupService } from '@main/services/backup';
import { settingsService } from '@main/services/settings';
import { connectionsService } from '@main/services/connections';
import { connectionManager } from '@main/db/manager';
import { DatabaseType, BackupEntityType, type SavedConnection, type BackupConfig, type RestoreConfig, type BackupEntity } from '@main/types';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@main/services/backup', () => ({
  backupService: {
    detectBackupBinary: vi.fn(),
    detectRestoreBinary: vi.fn(),
    buildBackupCommand: vi.fn(),
    buildRestoreCommand: vi.fn(),
    executeBackup: vi.fn(),
    executeRestore: vi.fn(),
    cancelOperation: vi.fn(),
  },
}));

vi.mock('@main/services/settings', () => ({
  settingsService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@main/services/connections', () => ({
  connectionsService: {
    get: vi.fn(),
  },
}));

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
    getConnectionConfig: vi.fn(),
    getSavedConnectionId: vi.fn(),
  },
}));

vi.mock('@main/services/keychain', () => ({
  keychainService: {
    getPassword: vi.fn(),
  },
}));

vi.mock('@main/ipc/helpers', () => ({
  assertSessionOwner: vi.fn(),
}));

vi.mock('@main/services/windowManager', () => ({
  windowManager: {
    getSessionOwner: vi.fn(),
  },
}));

describe('Backup IPC Handlers', () => {
  const handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Return a distinct saved connection ID to ensure the code properly distinguishes
    // between session IDs and saved connection IDs
    vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('saved-conn-1');

    // Capture all registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = handler;
    });

    registerBackupHandlers();
  });

  describe('nativeBackup:detectBinary', () => {
    it('should detect backup binary for connection', async () => {
      const sessionId = 'session-1';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: 'testdb',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.detectBackupBinary).mockReturnValue({ path: '/usr/bin/pg_dump', found: true });

      const result = await handlers['nativeBackup:detectBinary']({}, sessionId);

      expect(connectionManager.getSavedConnectionId).toHaveBeenCalledWith(sessionId);
      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.detectBackupBinary).toHaveBeenCalledWith(DatabaseType.PostgreSQL);
      expect(result).toEqual({ path: '/usr/bin/pg_dump', found: true });
    });

    it('should throw error when connection not found', async () => {
      const connectionId = 'invalid-conn';
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:detectBinary']({}, connectionId)).rejects.toThrow('Connection not found');
      expect(backupService.detectBackupBinary).not.toHaveBeenCalled();
    });
  });

  describe('nativeBackup:getEntities', () => {
    it('should return Full Database entity for Redis', async () => {
      const sessionId = 'redis-conn';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Redis DB',
        type: DatabaseType.Redis,
        host: 'localhost',
        port: 6379,
        username: '',
        database: '0',
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
      const mockDriver = {};

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as never);

      const result = await handlers['nativeBackup:getEntities']({}, sessionId) as BackupEntity[];

      expect(connectionManager.getConnection).toHaveBeenCalledWith(sessionId);
      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(result).toEqual([
        { name: 'Full Database', type: BackupEntityType.Database },
      ]);
    });

    it('should return collections for MongoDB', async () => {
      const connectionId = 'mongo-conn';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Mongo DB',
        type: DatabaseType.MongoDB,
        host: 'localhost',
        port: 27017,
        username: 'user',
        database: 'testdb',
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
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: 'users', type: 'collection' },
          { name: 'orders', type: 'collection' },
        ]),
      };

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as never);

      const result = await handlers['nativeBackup:getEntities']({}, connectionId) as BackupEntity[];

      expect(mockDriver.getTables).toHaveBeenCalledWith('testdb', '');
      expect(result).toEqual([
        { name: 'users', type: BackupEntityType.Collection },
        { name: 'orders', type: BackupEntityType.Collection },
      ]);
    });

    it('should return tables and views for SQL databases', async () => {
      const connectionId = 'pg-conn';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Postgres DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: 'testdb',
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
      const mockDriver = {
        getTables: vi.fn().mockResolvedValue([
          { name: 'users', schema: 'public', type: 'table' },
          { name: 'orders', schema: 'public', type: 'table' },
          { name: 'user_summary', schema: 'public', type: 'view' },
        ]),
      };

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as never);

      const result = await handlers['nativeBackup:getEntities']({}, connectionId) as BackupEntity[];

      expect(mockDriver.getTables).toHaveBeenCalledWith('testdb', '');
      expect(result).toEqual([
        { name: 'users', schema: 'public', type: BackupEntityType.Table },
        { name: 'orders', schema: 'public', type: BackupEntityType.Table },
        { name: 'user_summary', schema: 'public', type: BackupEntityType.View },
      ]);
    });

    it('should throw error when driver not connected', async () => {
      const connectionId = 'pg-conn';
      vi.mocked(connectionManager.getConnection).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:getEntities']({}, connectionId)).rejects.toThrow('Not connected to database');
      expect(connectionsService.get).not.toHaveBeenCalled();
    });

    it('should throw error when connection not found', async () => {
      const connectionId = 'pg-conn';
      const mockDriver = {};

      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as never);
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:getEntities']({}, connectionId)).rejects.toThrow('Connection not found');
    });
  });

  describe('nativeBackup:buildCommand', () => {
    it('should build backup command with password from keychain', async () => {
      const config: BackupConfig = {
        connectionId: 'session-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: 'testdb',
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
      const password = 'secret123';
      const commandSpec = { binary: 'pg_dump', args: ['-h', 'localhost'], env: {}, displayCommand: 'pg_dump -h localhost' };

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.buildBackupCommand).mockResolvedValue(commandSpec);

      const { keychainService } = await import('@main/services/keychain');
      vi.mocked(keychainService.getPassword).mockResolvedValue(password);

      const result = await handlers['nativeBackup:buildCommand']({}, config);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.buildBackupCommand).toHaveBeenCalledWith(config, mockConnection, password);
      expect(result).toEqual(commandSpec);
    });

    it('should throw error when connection not found', async () => {
      const config: BackupConfig = {
        connectionId: 'invalid-conn',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:buildCommand']({}, config)).rejects.toThrow('Connection not found');
      expect(backupService.buildBackupCommand).not.toHaveBeenCalled();
    });
  });

  describe('nativeBackup:execute', () => {
    it('should execute backup and return operationId', async () => {
      const config: BackupConfig = {
        connectionId: 'session-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: 'testdb',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.executeBackup).mockReturnValue('backup-12345');

      const { keychainService } = await import('@main/services/keychain');
      vi.mocked(keychainService.getPassword).mockResolvedValue('zequel');

      const mockEvent = { sender: { id: 42 } };
      const result = await handlers['nativeBackup:execute'](mockEvent, config);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.executeBackup).toHaveBeenCalledWith(config, mockConnection, 'zequel', 42);
      expect(result).toBe('backup-12345');
    });

    it('should throw error when connection not found', async () => {
      const config: BackupConfig = {
        connectionId: 'invalid-conn',
        entities: [],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };

      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:execute']({}, config)).rejects.toThrow('Connection not found');
      expect(backupService.executeBackup).not.toHaveBeenCalled();
    });
  });

  describe('nativeBackup:cancel', () => {
    it('should cancel backup operation', async () => {
      const operationId = 'op-1';
      vi.mocked(backupService.cancelOperation).mockReturnValue(true);

      const result = await handlers['nativeBackup:cancel']({}, operationId);

      expect(backupService.cancelOperation).toHaveBeenCalledWith(operationId);
      expect(result).toBe(true);
    });
  });

  describe('nativeBackup:getBinaryPath', () => {
    it('should get binary path from settings', async () => {
      const dbType = DatabaseType.PostgreSQL;
      const path = '/usr/bin/pg_dump';

      vi.mocked(settingsService.get).mockReturnValue(path);

      const result = await handlers['nativeBackup:getBinaryPath']({}, dbType);

      expect(settingsService.get).toHaveBeenCalledWith('backup.binary.postgresql');
      expect(result).toBe(path);
    });
  });

  describe('nativeBackup:saveBinaryPath', () => {
    it('should save binary path to settings', async () => {
      const dbType = DatabaseType.MySQL;
      const path = '/usr/local/bin/mysqldump';

      vi.mocked(settingsService.set).mockReturnValue(undefined);

      const result = await handlers['nativeBackup:saveBinaryPath']({}, dbType, path);

      expect(settingsService.set).toHaveBeenCalledWith('backup.binary.mysql', path);
      expect(result).toBe(true);
    });
  });

  describe('nativeRestore:detectBinary', () => {
    it('should detect restore binary for connection', async () => {
      const connectionId = 'conn-1';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.MySQL,
        host: 'localhost',
        port: 3306,
        username: 'user',
        database: 'testdb',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.detectRestoreBinary).mockReturnValue({ path: '/usr/bin/mysql', found: true });

      const result = await handlers['nativeRestore:detectBinary']({}, connectionId);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.detectRestoreBinary).toHaveBeenCalledWith(DatabaseType.MySQL);
      expect(result).toEqual({ path: '/usr/bin/mysql', found: true });
    });

    it('should throw error when connection not found', async () => {
      const connectionId = 'invalid-conn';
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeRestore:detectBinary']({}, connectionId)).rejects.toThrow('Connection not found');
      expect(backupService.detectRestoreBinary).not.toHaveBeenCalled();
    });
  });

  describe('nativeRestore:buildCommand', () => {
    it('should build restore command with password from keychain', async () => {
      const config: RestoreConfig = {
        connectionId: 'session-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.MySQL,
        host: 'localhost',
        port: 3306,
        username: 'user',
        database: 'testdb',
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
      const password = 'secret123';
      const commandSpec = { binary: 'mysql', args: ['-h', 'localhost'], env: {}, displayCommand: 'mysql -h localhost' };

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.buildRestoreCommand).mockResolvedValue(commandSpec);

      const { keychainService } = await import('@main/services/keychain');
      vi.mocked(keychainService.getPassword).mockResolvedValue(password);

      const result = await handlers['nativeRestore:buildCommand']({}, config);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.buildRestoreCommand).toHaveBeenCalledWith(config, mockConnection, password);
      expect(result).toEqual(commandSpec);
    });

    it('should throw error when connection not found', async () => {
      const config: RestoreConfig = {
        connectionId: 'invalid-conn',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeRestore:buildCommand']({}, config)).rejects.toThrow('Connection not found');
      expect(backupService.buildRestoreCommand).not.toHaveBeenCalled();
    });
  });

  describe('nativeRestore:execute', () => {
    it('should execute restore and return operationId', async () => {
      const config: RestoreConfig = {
        connectionId: 'session-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'Test DB',
        type: DatabaseType.SQLite,
        host: null,
        port: null,
        username: null,
        database: 'test.db',
        filepath: '/tmp/test.db',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(backupService.executeRestore).mockReturnValue('restore-12345');

      const { keychainService } = await import('@main/services/keychain');
      vi.mocked(keychainService.getPassword).mockResolvedValue('zequel');

      const mockEvent = { sender: { id: 99 } };
      const result = await handlers['nativeRestore:execute'](mockEvent, config);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(backupService.executeRestore).toHaveBeenCalledWith(config, mockConnection, 'zequel', 99);
      expect(result).toBe('restore-12345');
    });

    it('should throw error when connection not found', async () => {
      const config: RestoreConfig = {
        connectionId: 'invalid-conn',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };

      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeRestore:execute']({}, config)).rejects.toThrow('Connection not found');
      expect(backupService.executeRestore).not.toHaveBeenCalled();
    });
  });

  describe('nativeRestore:cancel', () => {
    it('should cancel restore operation', async () => {
      const operationId = 'op-2';
      vi.mocked(backupService.cancelOperation).mockReturnValue(true);

      const result = await handlers['nativeRestore:cancel']({}, operationId);

      expect(backupService.cancelOperation).toHaveBeenCalledWith(operationId);
      expect(result).toBe(true);
    });
  });

  describe('nativeRestore:getBinaryPath', () => {
    it('should get restore binary path from settings', async () => {
      const dbType = DatabaseType.PostgreSQL;
      const path = '/usr/bin/psql';

      vi.mocked(settingsService.get).mockReturnValue(path);

      const result = await handlers['nativeRestore:getBinaryPath']({}, dbType);

      expect(settingsService.get).toHaveBeenCalledWith('restore.binary.postgresql');
      expect(result).toBe(path);
    });
  });

  describe('nativeRestore:saveBinaryPath', () => {
    it('should save restore binary path to settings', async () => {
      const dbType = DatabaseType.ClickHouse;
      const path = '/usr/local/bin/clickhouse-client';

      vi.mocked(settingsService.set).mockReturnValue(undefined);

      const result = await handlers['nativeRestore:saveBinaryPath']({}, dbType, path);

      expect(settingsService.set).toHaveBeenCalledWith('restore.binary.clickhouse', path);
      expect(result).toBe(true);
    });
  });

  describe('resolveConnection: saved connection without database', () => {
    it('should merge database from active connection config when saved connection has no database', async () => {
      const connectionId = 'conn-no-db';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'PG No DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: '',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue({
        type: DatabaseType.PostgreSQL,
        name: 'PG No DB',
        host: 'localhost',
        port: 5432,
        database: 'active_db',
        username: 'user',
        ssl: false,
      });
      vi.mocked(backupService.detectBackupBinary).mockReturnValue({ path: '/usr/bin/pg_dump', found: true });

      const result = await handlers['nativeBackup:detectBinary']({}, connectionId);

      expect(backupService.detectBackupBinary).toHaveBeenCalledWith(DatabaseType.PostgreSQL);
      expect(result).toEqual({ path: '/usr/bin/pg_dump', found: true });
    });

    it('should return saved connection as-is when it has no database and active config has no database', async () => {
      const connectionId = 'conn-no-db-2';
      const mockConnection: SavedConnection = {
        id: 'saved-conn-1',
        name: 'PG No DB 2',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        username: 'user',
        database: '',
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

      vi.mocked(connectionsService.get).mockReturnValue(mockConnection);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue({
        type: DatabaseType.PostgreSQL,
        name: 'PG No DB 2',
        host: 'localhost',
        port: 5432,
        database: '',
        username: 'user',
        ssl: false,
      });
      vi.mocked(backupService.detectBackupBinary).mockReturnValue({ path: '/usr/bin/pg_dump', found: true });

      const result = await handlers['nativeBackup:detectBinary']({}, connectionId);

      expect(backupService.detectBackupBinary).toHaveBeenCalledWith(DatabaseType.PostgreSQL);
      expect(result).toEqual({ path: '/usr/bin/pg_dump', found: true });
    });
  });

  describe('resolveConnection fallback', () => {
    it('should resolve from connectionManager when connectionsService returns undefined', async () => {
      const sessionId = 'unsaved-conn';
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue({
        type: DatabaseType.PostgreSQL,
        name: 'Unsaved PG',
        host: '192.168.1.10',
        port: 5432,
        database: 'mydb',
        username: 'admin',
        ssl: false,
      });
      vi.mocked(backupService.detectBackupBinary).mockReturnValue({ path: '/usr/bin/pg_dump', found: true });

      const result = await handlers['nativeBackup:detectBinary']({}, sessionId);

      expect(connectionsService.get).toHaveBeenCalledWith('saved-conn-1');
      expect(connectionManager.getConnectionConfig).toHaveBeenCalledWith(sessionId);
      expect(backupService.detectBackupBinary).toHaveBeenCalledWith(DatabaseType.PostgreSQL);
      expect(result).toEqual({ path: '/usr/bin/pg_dump', found: true });
    });

    it('should throw when neither saved connection nor config exists', async () => {
      const sessionId = 'nonexistent';
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:detectBinary']({}, sessionId)).rejects.toThrow('Connection not found');
    });
  });

  describe('input validation', () => {
    it('should throw when backup config has invalid connectionId', async () => {
      await expect(handlers['nativeBackup:buildCommand']({}, { connectionId: '', outputPath: '/tmp/out', binaryPath: '/bin/pg_dump', entities: [], compress: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid connectionId');
      await expect(handlers['nativeBackup:execute']({ sender: { id: 1 } }, { connectionId: '', outputPath: '/tmp/out', binaryPath: '/bin/pg_dump', entities: [], compress: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid connectionId');
    });

    it('should throw when backup config has invalid outputPath', async () => {
      await expect(handlers['nativeBackup:buildCommand']({}, { connectionId: 'session-1', outputPath: '', binaryPath: '/bin/pg_dump', entities: [], compress: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid outputPath');
    });

    it('should throw when backup config has invalid binaryPath', async () => {
      await expect(handlers['nativeBackup:buildCommand']({}, { connectionId: 'session-1', outputPath: '/tmp/out', binaryPath: '', entities: [], compress: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid binaryPath');
    });

    it('should throw when restore config has invalid connectionId', async () => {
      await expect(handlers['nativeRestore:buildCommand']({}, { connectionId: '', inputPath: '/tmp/in', binaryPath: '/bin/mysql', isDirectory: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid connectionId');
      await expect(handlers['nativeRestore:execute']({ sender: { id: 1 } }, { connectionId: '', inputPath: '/tmp/in', binaryPath: '/bin/mysql', isDirectory: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid connectionId');
    });

    it('should throw when restore config has invalid inputPath', async () => {
      await expect(handlers['nativeRestore:buildCommand']({}, { connectionId: 'session-1', inputPath: '', binaryPath: '/bin/mysql', isDirectory: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid inputPath');
    });

    it('should throw when restore config has invalid binaryPath', async () => {
      await expect(handlers['nativeRestore:buildCommand']({}, { connectionId: 'session-1', inputPath: '/tmp/in', binaryPath: '', isDirectory: false, customArgs: '', options: {} }))
        .rejects.toThrow('Invalid binaryPath');
    });

    it('should throw when backup config is not an object', async () => {
      await expect(handlers['nativeBackup:buildCommand']({}, null)).rejects.toThrow('Invalid backup config');
      await expect(handlers['nativeBackup:buildCommand']({}, 'string')).rejects.toThrow('Invalid backup config');
    });

    it('should throw when restore config is not an object', async () => {
      await expect(handlers['nativeRestore:buildCommand']({}, null)).rejects.toThrow('Invalid restore config');
      await expect(handlers['nativeRestore:buildCommand']({}, 'string')).rejects.toThrow('Invalid restore config');
    });

    it('should throw when cancel operationId is invalid', async () => {
      await expect(handlers['nativeBackup:cancel']({}, '')).rejects.toThrow('Invalid operation ID');
      await expect(handlers['nativeBackup:cancel']({}, 123)).rejects.toThrow('Invalid operation ID');
      await expect(handlers['nativeRestore:cancel']({}, '')).rejects.toThrow('Invalid operation ID');
      await expect(handlers['nativeRestore:cancel']({}, null)).rejects.toThrow('Invalid operation ID');
    });

    it('should throw when dbType is invalid for getBinaryPath', async () => {
      await expect(handlers['nativeBackup:getBinaryPath']({}, 'invalid-type')).rejects.toThrow('Invalid database type');
      await expect(handlers['nativeRestore:getBinaryPath']({}, 'invalid-type')).rejects.toThrow('Invalid database type');
    });

    it('should throw when dbType is invalid for saveBinaryPath', async () => {
      await expect(handlers['nativeBackup:saveBinaryPath']({}, 'invalid-type', '/bin/pg_dump')).rejects.toThrow('Invalid database type');
      await expect(handlers['nativeRestore:saveBinaryPath']({}, 'invalid-type', '/bin/mysql')).rejects.toThrow('Invalid database type');
    });

    it('should throw when saveBinaryPath has empty path', async () => {
      await expect(handlers['nativeBackup:saveBinaryPath']({}, 'postgresql', '')).rejects.toThrow('Invalid binary path');
      await expect(handlers['nativeRestore:saveBinaryPath']({}, 'postgresql', '')).rejects.toThrow('Invalid binary path');
    });
  });
});
