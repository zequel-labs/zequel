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
  },
}));

vi.mock('@main/services/keychain', () => ({
  keychainService: {
    getPassword: vi.fn(),
  },
}));

describe('Backup IPC Handlers', () => {
  const handlers: Record<string, (event: unknown, ...args: unknown[]) => Promise<unknown>> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Capture all registered handlers
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = handler;
    });

    registerBackupHandlers();
  });

  describe('nativeBackup:detectBinary', () => {
    it('should detect backup binary for connection', async () => {
      const connectionId = 'conn-1';
      const mockConnection: SavedConnection = {
        id: connectionId,
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

      const result = await handlers['nativeBackup:detectBinary']({}, connectionId);

      expect(connectionsService.get).toHaveBeenCalledWith(connectionId);
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
      const connectionId = 'redis-conn';
      const mockConnection: SavedConnection = {
        id: connectionId,
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

      const result = await handlers['nativeBackup:getEntities']({}, connectionId) as BackupEntity[];

      expect(connectionManager.getConnection).toHaveBeenCalledWith(connectionId);
      expect(connectionsService.get).toHaveBeenCalledWith(connectionId);
      expect(result).toEqual([
        { name: 'Full Database', type: BackupEntityType.Database },
      ]);
    });

    it('should return collections for MongoDB', async () => {
      const connectionId = 'mongo-conn';
      const mockConnection: SavedConnection = {
        id: connectionId,
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
        id: connectionId,
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
        connectionId: 'conn-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'conn-1',
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

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
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
        connectionId: 'conn-1',
        entities: [{ name: 'users', type: BackupEntityType.Table }],
        outputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/pg_dump',
        compress: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'conn-1',
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

      const result = await handlers['nativeBackup:execute']({}, config);

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(backupService.executeBackup).toHaveBeenCalledWith(config, mockConnection);
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
        id: connectionId,
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

      expect(connectionsService.get).toHaveBeenCalledWith(connectionId);
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
        connectionId: 'conn-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/mysql',
        isDirectory: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'conn-1',
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

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
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
        connectionId: 'conn-1',
        inputPath: '/tmp/backup.sql',
        binaryPath: '/usr/bin/sqlite3',
        isDirectory: false,
        customArgs: '',
        options: {},
      };
      const mockConnection: SavedConnection = {
        id: 'conn-1',
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

      const result = await handlers['nativeRestore:execute']({}, config);

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(backupService.executeRestore).toHaveBeenCalledWith(config, mockConnection);
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

  describe('resolveConnection fallback', () => {
    it('should resolve from connectionManager when connectionsService returns undefined', async () => {
      const connectionId = 'unsaved-conn';
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

      const result = await handlers['nativeBackup:detectBinary']({}, connectionId);

      expect(connectionsService.get).toHaveBeenCalledWith(connectionId);
      expect(connectionManager.getConnectionConfig).toHaveBeenCalledWith(connectionId);
      expect(backupService.detectBackupBinary).toHaveBeenCalledWith(DatabaseType.PostgreSQL);
      expect(result).toEqual({ path: '/usr/bin/pg_dump', found: true });
    });

    it('should throw when neither saved connection nor config exists', async () => {
      const connectionId = 'nonexistent';
      vi.mocked(connectionsService.get).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue(undefined);

      await expect(handlers['nativeBackup:detectBinary']({}, connectionId)).rejects.toThrow('Connection not found');
    });
  });
});
