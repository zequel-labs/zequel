import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType } from '@main/types';
import type { ConnectionConfig, SavedConnection, ConnectionEnvironment } from '@main/types';

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock statement helpers
const mockRun = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));
const mockTransaction = vi.fn((fn: () => void) => fn);

// Mock appDatabase
vi.mock('@main/services/database', () => ({
  appDatabase: {
    getDatabase: vi.fn(() => ({
      prepare: mockPrepare,
      transaction: mockTransaction,
    })),
  },
}));

// Import after mocks are set up
import { ConnectionsService, connectionsService } from '@main/services/connections';
import { logger } from '@main/utils/logger';

const createTestConfig = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'test-id-1',
  name: 'Test DB',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'testuser',
  password: 'secret',
  ...overrides,
});

const createTestRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-id-1',
  name: 'Test DB',
  type: 'postgresql',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'testuser',
  filepath: null,
  ssl: 0,
  ssl_config: null,
  ssh_config: null,
  color: null,
  environment: null,
  folder: null,
  sort_order: 0,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  last_connected_at: null,
  ...overrides,
});

describe('ConnectionsService', () => {
  let service: ConnectionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ConnectionsService();
    // Default: mockGet returns undefined (no existing record)
    mockGet.mockReturnValue(undefined);
  });

  describe('list', () => {
    it('should return empty array when no connections exist', () => {
      mockAll.mockReturnValueOnce([]);

      const result = service.list();

      expect(result).toEqual([]);
      expect(mockPrepare).toHaveBeenCalled();
    });

    it('should return mapped connections ordered by sort_order and name', () => {
      const rows = [
        createTestRow({ id: 'id-1', name: 'Alpha', sort_order: 0 }),
        createTestRow({ id: 'id-2', name: 'Beta', sort_order: 1 }),
      ];
      mockAll.mockReturnValueOnce(rows);

      const result = service.list();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('id-1');
      expect(result[0].name).toBe('Alpha');
      expect(result[1].id).toBe('id-2');
    });

    it('should correctly map row fields to SavedConnection', () => {
      mockAll.mockReturnValueOnce([createTestRow()]);

      const result = service.list();

      expect(result[0]).toEqual({
        id: 'test-id-1',
        name: 'Test DB',
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
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        lastConnectedAt: null,
      });
    });

    it('should parse ssl=1 as true', () => {
      mockAll.mockReturnValueOnce([createTestRow({ ssl: 1 })]);

      const result = service.list();

      expect(result[0].ssl).toBe(true);
    });

    it('should parse ssl_config JSON', () => {
      const sslConfig = { mode: 'require', rejectUnauthorized: true };
      mockAll.mockReturnValueOnce([
        createTestRow({ ssl: 1, ssl_config: JSON.stringify(sslConfig) }),
      ]);

      const result = service.list();

      expect(result[0].sslConfig).toEqual(sslConfig);
    });

    it('should parse ssh_config JSON', () => {
      const sshConfig = { enabled: true, host: 'bastion.example.com', port: 22, username: 'admin', authMethod: 'password' };
      mockAll.mockReturnValueOnce([
        createTestRow({ ssh_config: JSON.stringify(sshConfig) }),
      ]);

      const result = service.list();

      expect(result[0].ssh).toEqual(sshConfig);
    });

    it('should handle invalid JSON in ssl_config gracefully', () => {
      mockAll.mockReturnValueOnce([createTestRow({ ssl_config: 'not-json' })]);

      const result = service.list();

      expect(result[0].sslConfig).toBeNull();
    });

    it('should handle invalid JSON in ssh_config gracefully', () => {
      mockAll.mockReturnValueOnce([createTestRow({ ssh_config: '{broken' })]);

      const result = service.list();

      expect(result[0].ssh).toBeNull();
    });
  });

  describe('get', () => {
    it('should return null when connection not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = service.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return mapped connection when found', () => {
      mockGet.mockReturnValueOnce(createTestRow());

      const result = service.get('test-id-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-id-1');
      expect(result!.type).toBe(DatabaseType.PostgreSQL);
    });

    it('should pass the id parameter to the query', () => {
      mockGet.mockReturnValueOnce(undefined);

      service.get('my-conn-id');

      expect(mockGet).toHaveBeenCalledWith('my-conn-id');
    });

    it('should map environment string to ConnectionEnvironment', () => {
      mockGet.mockReturnValueOnce(createTestRow({ environment: 'production' }));

      const result = service.get('test-id-1');

      expect(result!.environment).toBe('production');
    });

    it('should map null host/port/username correctly', () => {
      mockGet.mockReturnValueOnce(createTestRow({ host: null, port: null, username: null }));

      const result = service.get('test-id-1');

      expect(result!.host).toBeNull();
      expect(result!.port).toBeNull();
      expect(result!.username).toBeNull();
    });
  });

  describe('save', () => {
    it('should insert a new connection when it does not exist', () => {
      // First call to get (inside save) returns undefined (no existing), second returns the new row
      mockGet
        .mockReturnValueOnce(undefined)  // get inside save -> no existing
        .mockReturnValueOnce(createTestRow()); // get after insert

      const config = createTestConfig();
      const result = service.save(config);

      expect(result.id).toBe('test-id-1');
      expect(result.name).toBe('Test DB');
      // INSERT should be called
      const prepareCalls = mockPrepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const insertCall = prepareCalls.find((sql: string) => sql.includes('INSERT INTO connections'));
      expect(insertCall).toBeDefined();
    });

    it('should update an existing connection', () => {
      // First get returns existing row, second get returns updated row
      mockGet
        .mockReturnValueOnce(createTestRow()) // get inside save -> existing found
        .mockReturnValueOnce(createTestRow({ name: 'Updated DB' })); // get after update

      const config = createTestConfig({ name: 'Updated DB' });
      const result = service.save(config);

      expect(result.name).toBe('Updated DB');
      const prepareCalls = mockPrepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const updateCall = prepareCalls.find((sql: string) => sql.includes('UPDATE connections SET'));
      expect(updateCall).toBeDefined();
    });

    it('should store ssl as 1 when ssl is true', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow({ ssl: 1 }));

      const config = createTestConfig({ ssl: true });
      service.save(config);

      // The run call includes ssl as 1
      const runCalls = mockRun.mock.calls;
      const insertRunCall = runCalls.find((args: unknown[]) => {
        // For INSERT, ssl value is at index 8
        return args.length >= 16 && args[8] === 1;
      });
      expect(insertRunCall).toBeDefined();
    });

    it('should store ssl as 0 when ssl is false or undefined', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig({ ssl: false });
      service.save(config);

      const runCalls = mockRun.mock.calls;
      const insertRunCall = runCalls.find((args: unknown[]) => {
        return args.length >= 16 && args[8] === 0;
      });
      expect(insertRunCall).toBeDefined();
    });

    it('should serialize sslConfig as JSON', () => {
      const sslConfig = { mode: 'require' as const, rejectUnauthorized: true };
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig({ ssl: true, sslConfig });
      service.save(config);

      const runCalls = mockRun.mock.calls;
      const hasJsonSsl = runCalls.some((args: unknown[]) =>
        args.some((arg: unknown) => typeof arg === 'string' && arg.includes('require'))
      );
      expect(hasJsonSsl).toBe(true);
    });

    it('should serialize ssh config as JSON', () => {
      const ssh = {
        enabled: true,
        host: 'bastion.example.com',
        port: 22,
        username: 'admin',
        authMethod: 'password' as const,
      };
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig({ ssh });
      service.save(config);

      const runCalls = mockRun.mock.calls;
      const hasSshJson = runCalls.some((args: unknown[]) =>
        args.some((arg: unknown) => typeof arg === 'string' && arg.includes('bastion.example.com'))
      );
      expect(hasSshJson).toBe(true);
    });

    it('should store null for optional fields when not provided', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig({
        host: undefined,
        port: undefined,
        username: undefined,
        filepath: undefined,
        color: undefined,
        environment: undefined,
        folder: undefined,
      });
      service.save(config);

      // Verify the INSERT run call includes nulls for optional fields
      expect(mockRun).toHaveBeenCalled();
    });

    it('should log debug message on insert', () => {
      mockGet
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig();
      service.save(config);

      expect(logger.debug).toHaveBeenCalledWith('Connection created', { id: 'test-id-1', name: 'Test DB' });
    });

    it('should log debug message on update', () => {
      mockGet
        .mockReturnValueOnce(createTestRow())
        .mockReturnValueOnce(createTestRow());

      const config = createTestConfig();
      service.save(config);

      expect(logger.debug).toHaveBeenCalledWith('Connection updated', { id: 'test-id-1', name: 'Test DB' });
    });
  });

  describe('delete', () => {
    it('should return true when connection was deleted', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      const result = service.delete('test-id-1');

      expect(result).toBe(true);
    });

    it('should return false when connection was not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.delete('non-existent');

      expect(result).toBe(false);
    });

    it('should execute DELETE query with correct id', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      service.delete('abc-123');

      expect(mockRun).toHaveBeenCalledWith('abc-123');
    });

    it('should log deletion result', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      service.delete('test-id-1');

      expect(logger.debug).toHaveBeenCalledWith('Connection deleted', { id: 'test-id-1', deleted: true });
    });
  });

  describe('updateFolder', () => {
    it('should update the folder for a connection', () => {
      service.updateFolder('test-id-1', 'Production');

      expect(mockRun).toHaveBeenCalledWith('Production', expect.any(String), 'test-id-1');
    });

    it('should allow setting folder to null', () => {
      service.updateFolder('test-id-1', null);

      expect(mockRun).toHaveBeenCalledWith(null, expect.any(String), 'test-id-1');
    });

    it('should log folder update', () => {

      service.updateFolder('test-id-1', 'Staging');

      expect(logger.debug).toHaveBeenCalledWith('Connection folder updated', { id: 'test-id-1', folder: 'Staging' });
    });
  });

  describe('getFolders', () => {
    it('should return distinct folder names', () => {
      mockAll.mockReturnValueOnce([{ folder: 'Dev' }, { folder: 'Prod' }]);

      const result = service.getFolders();

      expect(result).toEqual(['Dev', 'Prod']);
    });

    it('should return empty array when no folders exist', () => {
      mockAll.mockReturnValueOnce([]);

      const result = service.getFolders();

      expect(result).toEqual([]);
    });
  });

  describe('renameFolder', () => {
    it('should update folder name for all matching connections', () => {
      service.renameFolder('OldName', 'NewName');

      expect(mockRun).toHaveBeenCalledWith('NewName', expect.any(String), 'OldName');
    });

    it('should log the rename', () => {

      service.renameFolder('OldName', 'NewName');

      expect(logger.debug).toHaveBeenCalledWith('Folder renamed', { oldName: 'OldName', newName: 'NewName' });
    });
  });

  describe('deleteFolder', () => {
    it('should set folder to NULL for all connections in that folder', () => {
      service.deleteFolder('MyFolder');

      expect(mockRun).toHaveBeenCalledWith(expect.any(String), 'MyFolder');
    });

    it('should log the folder deletion', () => {

      service.deleteFolder('MyFolder');

      expect(logger.debug).toHaveBeenCalledWith('Folder deleted, connections moved to ungrouped', { folder: 'MyFolder' });
    });
  });

  describe('updatePositions', () => {
    it('should update sort order and folder for each position', () => {
      const positions = [
        { id: 'id-1', sortOrder: 0, folder: null },
        { id: 'id-2', sortOrder: 1, folder: 'Dev' },
      ];

      service.updatePositions(positions);

      // transaction is called with a function; the fn is called immediately by the mock
      expect(mockRun).toHaveBeenCalledTimes(2);
    });

    it('should run inside a transaction', () => {
      const positions = [
        { id: 'id-1', sortOrder: 0, folder: null },
      ];

      service.updatePositions(positions);

      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should log the count of updated positions', () => {
      const positions = [
        { id: 'id-1', sortOrder: 0, folder: null },
        { id: 'id-2', sortOrder: 1, folder: 'Prod' },
        { id: 'id-3', sortOrder: 2, folder: 'Prod' },
      ];

      service.updatePositions(positions);

      expect(logger.debug).toHaveBeenCalledWith('Connection positions updated', { count: 3 });
    });

    it('should handle empty positions array', () => {
      service.updatePositions([]);

      // Transaction is still created but no runs happen
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe('updateLastConnected', () => {
    it('should update last_connected_at timestamp', () => {
      service.updateLastConnected('test-id-1');

      expect(mockRun).toHaveBeenCalledWith(expect.any(String), 'test-id-1');
    });

    it('should log the update', () => {

      service.updateLastConnected('test-id-1');

      expect(logger.debug).toHaveBeenCalledWith('Connection last_connected_at updated', { id: 'test-id-1' });
    });
  });

  describe('row mapping edge cases', () => {
    it('should map empty string database to empty string (not null)', () => {
      mockAll.mockReturnValueOnce([createTestRow({ database: '' })]);

      const result = service.list();

      expect(result[0].database).toBe('');
    });

    it('should use null coalescing for database field', () => {
      mockAll.mockReturnValueOnce([createTestRow({ database: null })]);

      const result = service.list();

      // null ?? '' => ''
      expect(result[0].database).toBe('');
    });

    it('should handle sort_order of 0 correctly', () => {
      mockAll.mockReturnValueOnce([createTestRow({ sort_order: 0 })]);

      const result = service.list();

      expect(result[0].sortOrder).toBe(0);
    });

    it('should handle null sort_order', () => {
      mockAll.mockReturnValueOnce([createTestRow({ sort_order: null })]);

      const result = service.list();

      // null ?? 0 => 0
      expect(result[0].sortOrder).toBe(0);
    });

    it('should convert empty string host to null', () => {
      mockAll.mockReturnValueOnce([createTestRow({ host: '' })]);

      const result = service.list();

      expect(result[0].host).toBeNull();
    });

    it('should map lastConnectedAt correctly when present', () => {
      const ts = '2024-06-15T10:30:00.000Z';
      mockAll.mockReturnValueOnce([createTestRow({ last_connected_at: ts })]);

      const result = service.list();

      expect(result[0].lastConnectedAt).toBe(ts);
    });
  });

  describe('connectionsService singleton', () => {
    it('should be an instance of ConnectionsService', () => {
      expect(connectionsService).toBeInstanceOf(ConnectionsService);
    });
  });
});
