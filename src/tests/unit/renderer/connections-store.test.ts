import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConnectionStatus, DatabaseType } from '@/types/connection';
import type { SavedConnection, ConnectionConfig } from '@/types/connection';
import type { Database, Table, DatabaseSchema } from '@/types/table';
import { TableObjectType } from '@/types/table';

// Mock window.api
const mockConnectionsList = vi.fn();
const mockConnectionsSave = vi.fn();
const mockConnectionsDelete = vi.fn();
const mockConnectionsTest = vi.fn();
const mockConnectionsConnect = vi.fn();
const mockConnectionsConnectWithConfig = vi.fn();
const mockConnectionsDisconnect = vi.fn();
const mockConnectionsReconnect = vi.fn();
const mockConnectionsGetFolders = vi.fn();
const mockConnectionsUpdateFolder = vi.fn();
const mockConnectionsRenameFolder = vi.fn();
const mockConnectionsUpdatePositions = vi.fn();
const mockConnectionsDeleteFolder = vi.fn();
const mockConnectionsGetServerVersion = vi.fn();
const mockSchemaDatabases = vi.fn();
const mockSchemaTables = vi.fn();
const mockSchemaGetSchemas = vi.fn();
const mockSchemaSetCurrentSchema = vi.fn();
const mockConnectionStatusOnChange = vi.fn();

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
    connections: {
      list: mockConnectionsList,
      save: mockConnectionsSave,
      delete: mockConnectionsDelete,
      test: mockConnectionsTest,
      connect: mockConnectionsConnect,
      connectWithConfig: mockConnectionsConnectWithConfig,
      disconnect: mockConnectionsDisconnect,
      reconnect: mockConnectionsReconnect,
      getFolders: mockConnectionsGetFolders,
      updateFolder: mockConnectionsUpdateFolder,
      renameFolder: mockConnectionsRenameFolder,
      updatePositions: mockConnectionsUpdatePositions,
      deleteFolder: mockConnectionsDeleteFolder,
      getServerVersion: mockConnectionsGetServerVersion,
    },
    schema: {
      databases: mockSchemaDatabases,
      tables: mockSchemaTables,
      getSchemas: mockSchemaGetSchemas,
      setCurrentSchema: mockSchemaSetCurrentSchema,
    },
    connectionStatus: {
      onChange: mockConnectionStatusOnChange,
    },
  },
});

import { useConnectionsStore } from '@/stores/connections';

const createSavedConnection = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
  id: 'conn-1',
  name: 'Test DB',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  filepath: null,
  ssl: false,
  ssh: null,
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  lastConnectedAt: null,
  ...overrides,
});

describe('Connections Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty connections', () => {
      const store = useConnectionsStore();
      expect(store.connections).toEqual([]);
    });

    it('should start with no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeSessionId).toBeNull();
    });

    it('should start with isLoading false', () => {
      const store = useConnectionsStore();
      expect(store.isLoading).toBe(false);
    });

    it('should start with null error', () => {
      const store = useConnectionsStore();
      expect(store.error).toBeNull();
    });

    it('should start with empty folders', () => {
      const store = useConnectionsStore();
      expect(store.folders).toEqual([]);
    });
  });

  describe('computed: activeConnection', () => {
    it('should return null when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeConnection).toBeNull();
    });

    it('should return active connection when set', () => {
      const store = useConnectionsStore();
      const conn = createSavedConnection({ id: 'conn-1' });
      store.connections = [conn];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.activeSessionId = 'session-1';
      expect(store.activeConnection).toEqual(conn);
    });

    it('should return null when active id does not match any session', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeSessionId = 'session-999';
      expect(store.activeConnection).toBeNull();
    });
  });

  describe('computed: sortedConnections', () => {
    it('should sort by sortOrder then name', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: '3', name: 'Zeta', sortOrder: 1 }),
        createSavedConnection({ id: '1', name: 'Alpha', sortOrder: 0 }),
        createSavedConnection({ id: '2', name: 'Beta', sortOrder: 0 }),
      ];

      const sorted = store.sortedConnections;
      expect(sorted[0].name).toBe('Alpha');
      expect(sorted[1].name).toBe('Beta');
      expect(sorted[2].name).toBe('Zeta');
    });

    it('should handle undefined sortOrder as 0', () => {
      const store = useConnectionsStore();
      const connA = createSavedConnection({ id: '1', name: 'Alpha' });
      const connB = createSavedConnection({ id: '2', name: 'Beta', sortOrder: 1 });
      store.connections = [connB, connA];

      const sorted = store.sortedConnections;
      expect(sorted[0].name).toBe('Alpha');
      expect(sorted[1].name).toBe('Beta');
    });
  });

  describe('computed: isConnected', () => {
    it('should return false when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.isConnected).toBe(false);
    });

    it('should return true when active session is connected', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      expect(store.isConnected).toBe(true);
    });

    it('should return false when active session is disconnected', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Disconnected });
      expect(store.isConnected).toBe(false);
    });

    it('should return false when active session is in error', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Error, error: 'err' });
      expect(store.isConnected).toBe(false);
    });
  });

  describe('computed: activeDatabases', () => {
    it('should return empty array when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeDatabases).toEqual([]);
    });

    it('should return databases for active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      const dbs: Database[] = [{ name: 'db1' }, { name: 'db2' }];
      store.databases.set('session-1', dbs);
      expect(store.activeDatabases).toEqual(dbs);
    });
  });

  describe('computed: activeTables', () => {
    it('should return empty array when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeTables).toEqual([]);
    });

    it('should return tables for active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      const tbls: Table[] = [
        { name: 'users', type: TableObjectType.Table },
        { name: 'posts', type: TableObjectType.Table },
      ];
      store.tables.set('session-1', tbls);
      expect(store.activeTables).toEqual(tbls);
    });
  });

  describe('computed: connectedIds', () => {
    it('should return empty array when no connections', () => {
      const store = useConnectionsStore();
      expect(store.connectedIds).toEqual([]);
    });

    it('should return ids of connected connections', () => {
      const store = useConnectionsStore();
      store.sessions.set('conn-1', { savedConnectionId: 'saved-1' });
      store.sessions.set('conn-2', { savedConnectionId: 'saved-2' });
      store.sessions.set('conn-3', { savedConnectionId: 'saved-3' });
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('conn-2', { id: 'conn-2', status: ConnectionStatus.Disconnected });
      store.connectionStates.set('conn-3', { id: 'conn-3', status: ConnectionStatus.Reconnecting });

      expect(store.connectedIds).toContain('conn-1');
      expect(store.connectedIds).toContain('conn-3');
      expect(store.connectedIds).not.toContain('conn-2');
    });
  });

  describe('computed: connectedConnections', () => {
    it('should return only connected connections', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1', name: 'A' }),
        createSavedConnection({ id: 'conn-2', name: 'B' }),
        createSavedConnection({ id: 'conn-3', name: 'C' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.sessions.set('session-3', { savedConnectionId: 'conn-3' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Disconnected });
      store.connectionStates.set('session-3', { id: 'session-3', status: ConnectionStatus.Reconnecting });

      expect(store.connectedConnections).toHaveLength(2);
      expect(store.connectedConnections.map(c => c.name)).toEqual(['A', 'C']);
    });
  });

  describe('computed: hasActiveConnections', () => {
    it('should return false when no connected connections', () => {
      const store = useConnectionsStore();
      expect(store.hasActiveConnections).toBe(false);
    });

    it('should return true when at least one connection is active', () => {
      const store = useConnectionsStore();
      store.sessions.set('conn-1', { savedConnectionId: 'saved-1' });
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      expect(store.hasActiveConnections).toBe(true);
    });
  });

  describe('computed: allFolders', () => {
    it('should merge and sort server and local folders', () => {
      const store = useConnectionsStore();
      store.folders = ['Beta', 'Alpha'];
      store.createFolder('Gamma');
      store.createFolder('Alpha'); // duplicate

      expect(store.allFolders).toEqual(['Alpha', 'Beta', 'Gamma']);
    });
  });

  describe('computed: connectionsByFolder', () => {
    it('should group connections by folder', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: '1', name: 'A', folder: 'Dev' }),
        createSavedConnection({ id: '2', name: 'B', folder: null }),
        createSavedConnection({ id: '3', name: 'C', folder: 'Dev' }),
        createSavedConnection({ id: '4', name: 'D', folder: 'Prod' }),
      ];
      store.folders = ['Dev', 'Prod'];

      const result = store.connectionsByFolder;
      expect(result.grouped['Dev']).toHaveLength(2);
      expect(result.grouped['Prod']).toHaveLength(1);
      expect(result.ungrouped).toHaveLength(1);
      expect(result.ungrouped[0].name).toBe('B');
    });

    it('should include empty local folders', () => {
      const store = useConnectionsStore();
      store.connections = [];
      store.createFolder('EmptyFolder');

      const result = store.connectionsByFolder;
      expect(result.grouped['EmptyFolder']).toEqual([]);
    });
  });

  describe('loadConnections', () => {
    it('should load connections and folders from API', async () => {
      const conns = [createSavedConnection({ id: '1' }), createSavedConnection({ id: '2' })];
      mockConnectionsList.mockResolvedValueOnce(conns);
      mockConnectionsGetFolders.mockResolvedValueOnce(['Dev', 'Prod']);

      const store = useConnectionsStore();
      await store.loadConnections();

      expect(store.connections).toEqual(conns);
      expect(store.folders).toEqual(['Dev', 'Prod']);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockConnectionsList.mockRejectedValueOnce(new Error('Network error'));

      const store = useConnectionsStore();
      await store.loadConnections();

      expect(store.error).toBe('Network error');
      expect(store.isLoading).toBe(false);
    });

    it('should set generic error for non-Error exceptions', async () => {
      mockConnectionsList.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      await store.loadConnections();

      expect(store.error).toBe('Failed to load connections');
    });
  });

  describe('saveConnection', () => {
    it('should save a new connection', async () => {
      const config: ConnectionConfig = {
        id: '',
        name: 'New DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        database: 'newdb',
        username: 'user',
      };
      const saved = createSavedConnection({ id: 'new-id', name: 'New DB' });
      mockConnectionsSave.mockResolvedValueOnce(saved);

      const store = useConnectionsStore();
      const result = await store.saveConnection(config);

      expect(result).toEqual(saved);
      expect(store.connections).toHaveLength(1);
      expect(store.connections[0].id).toBe('new-id');
    });

    it('should update an existing connection', async () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', name: 'Old Name' })];

      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Updated Name',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
      };
      const updated = createSavedConnection({ id: 'conn-1', name: 'Updated Name' });
      mockConnectionsSave.mockResolvedValueOnce(updated);

      const result = await store.saveConnection(config);

      expect(result.name).toBe('Updated Name');
      expect(store.connections).toHaveLength(1);
      expect(store.connections[0].name).toBe('Updated Name');
    });

    it('should set error on failure and rethrow', async () => {
      mockConnectionsSave.mockRejectedValueOnce(new Error('Save failed'));

      const store = useConnectionsStore();
      await expect(store.saveConnection({
        id: '',
        name: 'Test',
        type: DatabaseType.MySQL,
        database: 'db',
      })).rejects.toThrow('Save failed');

      expect(store.error).toBe('Save failed');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('deleteConnection', () => {
    it('should delete a connection and clean up its sessions', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.databases.set('session-1', [{ name: 'db1' }]);
      store.tables.set('session-1', [{ name: 'users', type: TableObjectType.Table }]);

      await store.deleteConnection('conn-1');

      expect(store.connections).toHaveLength(1);
      expect(store.connections[0].id).toBe('conn-2');
      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.databases.has('session-1')).toBe(false);
      expect(store.tables.has('session-1')).toBe(false);
    });

    it('should clear activeSessionId if deleted connection had active session', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.activeSessionId = 'session-1';

      await store.deleteConnection('conn-1');

      expect(store.activeSessionId).toBeNull();
    });

    it('should not clear activeSessionId if different connection deleted', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.activeSessionId = 'session-2';

      await store.deleteConnection('conn-1');

      expect(store.activeSessionId).toBe('session-2');
    });

    it('should set error on failure and rethrow', async () => {
      mockConnectionsDelete.mockRejectedValueOnce(new Error('Delete failed'));

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await expect(store.deleteConnection('conn-1')).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Delete failed');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful test', async () => {
      mockConnectionsTest.mockResolvedValueOnce({ success: true });

      const store = useConnectionsStore();
      const result = await store.testConnection({
        id: '',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      });

      expect(result).toBe(true);
    });

    it('should return false on failed test', async () => {
      mockConnectionsTest.mockResolvedValueOnce({ success: false });

      const store = useConnectionsStore();
      const result = await store.testConnection({
        id: '',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      });

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockConnectionsTest.mockRejectedValueOnce(new Error('Connection refused'));

      const store = useConnectionsStore();
      const result = await store.testConnection({
        id: '',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      });

      expect(result).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect and load tables for non-Redis connections', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.PostgreSQL })];

      await store.connect('conn-1');

      expect(store.connectionStates.get('session-123')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-123');
      expect(store.sessions.get('session-123')?.savedConnectionId).toBe('conn-1');
      expect(mockSchemaTables).toHaveBeenCalled();
    });

    it('should load databases when connection has no database configured', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'db0' }]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.Redis, database: '' })];

      await store.connect('conn-1');

      expect(store.connectionStates.get('session-123')?.status).toBe(ConnectionStatus.Connected);
      expect(mockSchemaDatabases).toHaveBeenCalledWith('session-123');
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should set connecting state initially', async () => {
      let resolveConnect: (sessionId: string) => void;
      const connectPromise = new Promise<string>((resolve) => {
        resolveConnect = resolve;
      });
      mockConnectionsConnect.mockReturnValueOnce(connectPromise);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      const promise = store.connect('conn-1');
      // A temporary connecting key should exist
      const connectingEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Connecting
      );
      expect(connectingEntries.length).toBe(1);

      mockSchemaTables.mockResolvedValueOnce([]);
      resolveConnect!('session-123');
      await promise;

      expect(store.connectionStates.get('session-123')?.status).toBe(ConnectionStatus.Connected);
    });

    it('should set error state on failure', async () => {
      mockConnectionsConnect.mockRejectedValueOnce(new Error('Connection refused'));

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await expect(store.connect('conn-1')).rejects.toThrow('Connection refused');

      // Error state is stored under a temporary key
      const errorEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Error
      );
      expect(errorEntries.length).toBe(1);
      expect(errorEntries[0][1].error).toBe('Connection refused');
    });

    it('should clean up stale error entries for same connection before connecting', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-new');
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      // Pre-populate with stale error entry for conn-1 and a connecting entry for conn-2
      store.connectionStates.set('connecting-conn-1-old', { id: 'connecting-conn-1-old', status: ConnectionStatus.Error, error: 'old failure' });
      store.connectionStates.set('connecting-conn-2-old', { id: 'connecting-conn-2-old', status: ConnectionStatus.Connecting });

      await store.connect('conn-1');

      // Only conn-1 error entries should be cleaned up; conn-2 connecting entry should be preserved
      expect(store.connectionStates.has('connecting-conn-1-old')).toBe(false);
      expect(store.connectionStates.has('connecting-conn-2-old')).toBe(true);
      expect(store.connectionStates.get('session-new')?.status).toBe(ConnectionStatus.Connected);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.databases.set('session-1', [{ name: 'db1' }]);
      store.tables.set('session-1', [{ name: 'users', type: TableObjectType.Table }]);

      await store.disconnect('session-1');

      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.databases.has('session-1')).toBe(false);
      expect(store.tables.has('session-1')).toBe(false);
    });

    it('should switch to another connected session if disconnecting active', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      await store.disconnect('session-1');

      expect(store.activeSessionId).toBe('session-2');
    });

    it('should set activeSessionId to null if no other sessions', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });

      await store.disconnect('session-1');

      expect(store.activeSessionId).toBeNull();
    });

    it('should set error on disconnect failure', async () => {
      mockConnectionsDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      await store.disconnect('session-1');

      expect(store.connectionErrors.get('session-1')).toBe('Disconnect failed');
    });
  });

  describe('disconnectOthers', () => {
    it('should disconnect all sessions except the specified one', async () => {
      mockConnectionsDisconnect.mockResolvedValue(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
        createSavedConnection({ id: 'conn-3' }),
      ];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.sessions.set('session-3', { savedConnectionId: 'conn-3' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-3', { id: 'session-3', status: ConnectionStatus.Connected });

      await store.disconnectOthers('session-1');

      expect(store.connectionStates.get('session-1')?.status).toBe(ConnectionStatus.Connected);
      expect(store.connectionStates.has('session-2')).toBe(false);
      expect(store.connectionStates.has('session-3')).toBe(false);
    });

    it('should keep the specified session as active', async () => {
      mockConnectionsDisconnect.mockResolvedValue(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.activeSessionId = 'session-2';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      await store.disconnectOthers('session-2');

      expect(store.activeSessionId).toBe('session-2');
      expect(store.connectionStates.has('session-1')).toBe(false);
    });

    it('should do nothing when only one session is connected', async () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });

      await store.disconnectOthers('session-1');

      expect(mockConnectionsDisconnect).not.toHaveBeenCalled();
      expect(store.connectionStates.get('session-1')?.status).toBe(ConnectionStatus.Connected);
    });
  });

  describe('loadDatabases', () => {
    it('should load databases for a connection', async () => {
      const dbs: Database[] = [{ name: 'db1' }, { name: 'db2' }];
      mockSchemaDatabases.mockResolvedValueOnce(dbs);

      const store = useConnectionsStore();
      await store.loadDatabases('conn-1');

      expect(store.databases.get('conn-1')).toEqual(dbs);
    });

    it('should set error on failure', async () => {
      mockSchemaDatabases.mockRejectedValueOnce(new Error('Failed'));

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadDatabases('conn-1');

      expect(store.error).toBe('Failed');
    });
  });

  describe('loadTables', () => {
    it('should load tables for a connection', async () => {
      const tbls: Table[] = [
        { name: 'users', type: TableObjectType.Table },
        { name: 'user_view', type: TableObjectType.View },
      ];
      mockSchemaTables.mockResolvedValueOnce(tbls);

      const store = useConnectionsStore();
      await store.loadTables('conn-1', 'mydb');

      expect(store.tables.get('conn-1')).toEqual(tbls);
      expect(mockSchemaTables).toHaveBeenCalledWith('conn-1', 'mydb', undefined);
    });

    it('should pass schema parameter', async () => {
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      await store.loadTables('conn-1', 'mydb', 'public');

      expect(mockSchemaTables).toHaveBeenCalledWith('conn-1', 'mydb', 'public');
    });

    it('should set error on failure', async () => {
      mockSchemaTables.mockRejectedValueOnce(new Error('Failed'));

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadTables('conn-1', 'mydb');

      expect(store.error).toBe('Failed');
    });
  });

  describe('reconnect', () => {
    it('should call api.connections.reconnect', async () => {
      mockConnectionsReconnect.mockResolvedValueOnce(true);

      const store = useConnectionsStore();
      const result = await store.reconnect('conn-1');

      expect(mockConnectionsReconnect).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(true);
    });
  });

  describe('getConnectionState', () => {
    it('should return state for known connection', () => {
      const store = useConnectionsStore();
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });

      const state = store.getConnectionState('conn-1');
      expect(state.status).toBe(ConnectionStatus.Connected);
    });

    it('should return disconnected state for unknown connection', () => {
      const store = useConnectionsStore();
      const state = store.getConnectionState('unknown');
      expect(state.status).toBe(ConnectionStatus.Disconnected);
      expect(state.id).toBe('unknown');
    });
  });

  describe('setActiveDatabase', () => {
    it('should set database override for connection', () => {
      const store = useConnectionsStore();
      store.setActiveDatabase('conn-1', 'newdb');

      expect(store.getActiveDatabase('conn-1')).toBe('newdb');
    });
  });

  describe('getActiveDatabase', () => {
    it('should return override if set', () => {
      const store = useConnectionsStore();
      store.setActiveDatabase('conn-1', 'override-db');

      expect(store.getActiveDatabase('conn-1')).toBe('override-db');
    });

    it('should return connection default database if no override', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'default-db' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });

      expect(store.getActiveDatabase('session-1')).toBe('default-db');
    });

    it('should return empty string if no override and no session', () => {
      const store = useConnectionsStore();
      expect(store.getActiveDatabase('unknown')).toBe('');
    });
  });

  describe('setActiveConnection', () => {
    it('should set the active connection id', () => {
      const store = useConnectionsStore();
      store.setActiveConnection('conn-1');
      expect(store.activeSessionId).toBe('conn-1');
    });

    it('should set to null', () => {
      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      store.setActiveConnection(null);
      expect(store.activeSessionId).toBeNull();
    });
  });

  describe('createFolder', () => {
    it('should add a local folder', () => {
      const store = useConnectionsStore();
      store.createFolder('MyFolder');
      expect(store.allFolders).toContain('MyFolder');
    });

    it('should not duplicate folders', () => {
      const store = useConnectionsStore();
      store.createFolder('MyFolder');
      store.createFolder('MyFolder');
      expect(store.allFolders.filter(f => f === 'MyFolder')).toHaveLength(1);
    });
  });

  describe('updateConnectionFolder', () => {
    it('should update connection folder via API', async () => {
      mockConnectionsUpdateFolder.mockResolvedValueOnce(undefined);
      mockConnectionsGetFolders.mockResolvedValueOnce(['Dev']);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', folder: null })];

      await store.updateConnectionFolder('conn-1', 'Dev');

      expect(mockConnectionsUpdateFolder).toHaveBeenCalledWith('conn-1', 'Dev');
      expect(store.connections[0].folder).toBe('Dev');
      expect(store.folders).toEqual(['Dev']);
    });
  });

  describe('renameFolder', () => {
    it('should rename folder and update connections', async () => {
      mockConnectionsRenameFolder.mockResolvedValueOnce(undefined);
      mockConnectionsGetFolders.mockResolvedValueOnce(['NewName']);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1', folder: 'OldName' }),
        createSavedConnection({ id: 'conn-2', folder: 'OldName' }),
        createSavedConnection({ id: 'conn-3', folder: 'Other' }),
      ];

      await store.renameFolder('OldName', 'NewName');

      expect(store.connections[0].folder).toBe('NewName');
      expect(store.connections[1].folder).toBe('NewName');
      expect(store.connections[2].folder).toBe('Other');
    });

    it('should update local folders when renaming', async () => {
      mockConnectionsRenameFolder.mockResolvedValueOnce(undefined);
      mockConnectionsGetFolders.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.createFolder('OldLocal');

      await store.renameFolder('OldLocal', 'NewLocal');

      expect(store.allFolders).toContain('NewLocal');
      expect(store.allFolders).not.toContain('OldLocal');
    });
  });

  describe('updatePositions', () => {
    it('should update positions via API and local state', async () => {
      mockConnectionsUpdatePositions.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1', sortOrder: 0 }),
        createSavedConnection({ id: 'conn-2', sortOrder: 1 }),
      ];

      await store.updatePositions([
        { id: 'conn-1', sortOrder: 1, folder: null },
        { id: 'conn-2', sortOrder: 0, folder: 'Dev' },
      ]);

      expect(store.connections.find(c => c.id === 'conn-1')?.sortOrder).toBe(1);
      expect(store.connections.find(c => c.id === 'conn-2')?.sortOrder).toBe(0);
      expect(store.connections.find(c => c.id === 'conn-2')?.folder).toBe('Dev');
    });
  });

  describe('deleteFolder', () => {
    it('should delete folder and unassign connections', async () => {
      mockConnectionsDeleteFolder.mockResolvedValueOnce(undefined);
      mockConnectionsGetFolders.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1', folder: 'ToDelete' }),
        createSavedConnection({ id: 'conn-2', folder: 'Keep' }),
      ];
      store.createFolder('ToDelete');

      await store.deleteFolder('ToDelete');

      expect(store.connections[0].folder).toBeNull();
      expect(store.connections[1].folder).toBe('Keep');
      expect(store.allFolders).not.toContain('ToDelete');
    });
  });

  describe('initConnectionStatusListener', () => {
    it('should register listener only once', () => {
      const store = useConnectionsStore();
      store.initConnectionStatusListener();
      store.initConnectionStatusListener();
      expect(mockConnectionStatusOnChange).toHaveBeenCalledOnce();
    });

    it('should handle reconnecting status', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('conn-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];
      callback({
        connectionId: 'conn-1',
        status: ConnectionStatus.Reconnecting,
        attempt: 3,
      });

      const state = store.connectionStates.get('conn-1');
      expect(state?.status).toBe(ConnectionStatus.Reconnecting);
      expect(state?.reconnectAttempt).toBe(3);
    });

    it('should handle connected status after reconnect', () => {
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.PostgreSQL })];
      store.sessions.set('conn-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];
      callback({
        connectionId: 'conn-1',
        status: ConnectionStatus.Connected,
      });

      const state = store.connectionStates.get('conn-1');
      expect(state?.status).toBe(ConnectionStatus.Connected);
    });

    it('should handle error status', () => {
      const store = useConnectionsStore();
      store.sessions.set('conn-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];
      callback({
        connectionId: 'conn-1',
        status: ConnectionStatus.Error,
        error: 'Lost connection',
      });

      const state = store.connectionStates.get('conn-1');
      expect(state?.status).toBe(ConnectionStatus.Error);
      expect(state?.error).toBe('Lost connection');
    });
  });

  describe('connect (additional branches)', () => {
    it('should set generic error message for non-Error exceptions', async () => {
      mockConnectionsConnect.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await expect(store.connect('conn-1')).rejects.toBe('string error');

      const errorEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Error
      );
      expect(errorEntries.length).toBe(1);
      expect(errorEntries[0][1].error).toBe('Connection failed');
    });

    it('should load databases when connection has no database', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'mydb' }]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce('15.0');

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: '' })];

      await store.connect('conn-1');

      expect(mockSchemaDatabases).toHaveBeenCalledWith('session-123');
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should use connection database when it exists', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce('15.0');

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];

      await store.connect('conn-1');

      expect(mockSchemaTables).toHaveBeenCalledWith('session-123', 'mydb', undefined);
    });
  });

  describe('connectWithConfig', () => {
    it('should connect with config and load tables', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-cfg-1');
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce('15.0');

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Config DB',
        type: DatabaseType.PostgreSQL,
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: 'user',
      };

      await store.connectWithConfig(config);

      expect(store.connectionStates.get('session-cfg-1')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-cfg-1');
      expect(store.sessions.get('session-cfg-1')?.savedConnectionId).toBe('cfg-1');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-cfg-1', 'testdb', undefined);
    });

    it('should add ephemeral connection entry when not already present', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-cfg-new');
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-new',
        name: 'Ephemeral DB',
        type: DatabaseType.MySQL,
        host: 'localhost',
        port: 3306,
        database: 'mydb',
        username: 'root',
        ssl: true,
        color: '#ff0000',
        environment: 'production',
        folder: 'Dev',
      };

      await store.connectWithConfig(config);

      expect(store.connections).toHaveLength(1);
      const conn = store.connections[0];
      expect(conn.id).toBe('cfg-new');
      expect(conn.name).toBe('Ephemeral DB');
      expect(conn.type).toBe(DatabaseType.MySQL);
      expect(conn.host).toBe('localhost');
      expect(conn.port).toBe(3306);
      expect(conn.database).toBe('mydb');
      expect(conn.username).toBe('root');
      expect(conn.ssl).toBe(true);
      expect(conn.color).toBe('#ff0000');
      expect(conn.environment).toBe('production');
      expect(conn.folder).toBe('Dev');
    });

    it('should not duplicate connection entry if already present', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-cfg-1');
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'cfg-1', name: 'Existing' })];

      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Existing',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
      };

      await store.connectWithConfig(config);

      expect(store.connections).toHaveLength(1);
    });

    it('should use unsaved as savedConnectionId when config has no id', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-unsaved');
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: '',
        name: 'No ID',
        type: DatabaseType.SQLite,
        database: 'test.db',
        filepath: '/path/to/test.db',
      };

      await store.connectWithConfig(config);

      expect(store.connectionStates.get('session-unsaved')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-unsaved');
      const savedId = store.sessions.get('session-unsaved')?.savedConnectionId
      expect(savedId).toBeDefined()
      expect(savedId).toMatch(/^unsaved-/)
      const conn = store.connections.find(c => c.id === savedId);
      expect(conn).toBeDefined();
      expect(conn?.filepath).toBe('/path/to/test.db');
    });

    it('should load databases when config has no database', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-cfg-1');
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'db0' }]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'No DB',
        type: DatabaseType.Redis,
        database: '',
      };

      await store.connectWithConfig(config);

      expect(mockSchemaDatabases).toHaveBeenCalledWith('session-cfg-1');
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should clean up stale error entries for same connection before connectWithConfig', async () => {
      mockConnectionsConnectWithConfig.mockResolvedValueOnce('session-cfg-1');
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();

      // Pre-populate with stale error entry for cfg-1 and a connecting entry for cfg-2
      store.connectionStates.set('connecting-cfg-1-old', { id: 'connecting-cfg-1-old', status: ConnectionStatus.Error, error: 'old error' });
      store.connectionStates.set('connecting-cfg-2-old', { id: 'connecting-cfg-2-old', status: ConnectionStatus.Connecting });

      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      };

      await store.connectWithConfig(config);

      // Only cfg-1 error entries should be cleaned up; cfg-2 connecting entry should be preserved
      expect(store.connectionStates.has('connecting-cfg-1-old')).toBe(false);
      expect(store.connectionStates.has('connecting-cfg-2-old')).toBe(true);
    });

    it('should set error state on failure', async () => {
      mockConnectionsConnectWithConfig.mockRejectedValueOnce(new Error('Auth failed'));

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Fail',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      };

      await expect(store.connectWithConfig(config)).rejects.toThrow('Auth failed');

      const errorEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Error
      );
      expect(errorEntries.length).toBe(1);
      expect(errorEntries[0][1].error).toBe('Auth failed');
    });

    it('should set generic error message for non-Error exceptions', async () => {
      mockConnectionsConnectWithConfig.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Fail',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      };

      await expect(store.connectWithConfig(config)).rejects.toBe('string error');

      const errorEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Error
      );
      expect(errorEntries.length).toBe(1);
      expect(errorEntries[0][1].error).toBe('Connection failed');
    });

    it('should set connecting state initially', async () => {
      let resolveConnect: (sessionId: string) => void;
      const connectPromise = new Promise<string>((resolve) => {
        resolveConnect = resolve;
      });
      mockConnectionsConnectWithConfig.mockReturnValueOnce(connectPromise);

      const store = useConnectionsStore();
      const config: ConnectionConfig = {
        id: 'cfg-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'db',
      };

      const promise = store.connectWithConfig(config);
      // A temporary connecting key should exist
      const connectingEntries = [...store.connectionStates.entries()].filter(
        ([, s]) => s.status === ConnectionStatus.Connecting
      );
      expect(connectingEntries.length).toBe(1);

      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);
      resolveConnect!('session-cfg-1');
      await promise;

      expect(store.connectionStates.get('session-cfg-1')?.status).toBe(ConnectionStatus.Connected);
    });
  });

  describe('loadSchemas', () => {
    it('should load schemas for a connection', async () => {
      const schemaList: DatabaseSchema[] = [
        { name: 'public', owner: 'postgres', isSystem: false },
        { name: 'pg_catalog', owner: 'postgres', isSystem: true },
      ];
      mockSchemaGetSchemas.mockResolvedValueOnce(schemaList);

      const store = useConnectionsStore();
      await store.loadSchemas('conn-1');

      expect(store.schemas.get('conn-1')).toEqual(schemaList);
      expect(mockSchemaGetSchemas).toHaveBeenCalledWith('conn-1');
    });

    it('should set error on failure', async () => {
      mockSchemaGetSchemas.mockRejectedValueOnce(new Error('Schema load failed'));

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadSchemas('conn-1');

      expect(store.error).toBe('Schema load failed');
    });

    it('should set generic error for non-Error exceptions', async () => {
      mockSchemaGetSchemas.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadSchemas('conn-1');

      expect(store.error).toBe('Failed to load schemas');
    });
  });

  describe('setActiveSchema', () => {
    it('should set schema and reload tables', async () => {
      mockSchemaSetCurrentSchema.mockResolvedValueOnce(undefined);
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });

      await store.setActiveSchema('session-1', 'custom_schema');

      expect(mockSchemaSetCurrentSchema).toHaveBeenCalledWith('session-1', 'custom_schema');
      expect(store.getActiveSchema('session-1')).toBe('custom_schema');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-1', 'mydb', 'custom_schema');
    });

    it('should use database override when reloading tables', async () => {
      mockSchemaSetCurrentSchema.mockResolvedValueOnce(undefined);
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'original' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.setActiveDatabase('session-1', 'override-db');

      await store.setActiveSchema('session-1', 'my_schema');

      expect(mockSchemaTables).toHaveBeenCalledWith('session-1', 'override-db', 'my_schema');
    });

    it('should set error on failure', async () => {
      mockSchemaSetCurrentSchema.mockRejectedValueOnce(new Error('Schema set failed'));

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.setActiveSchema('conn-1', 'bad_schema');

      expect(store.error).toBe('Schema set failed');
    });

    it('should set generic error for non-Error exceptions', async () => {
      mockSchemaSetCurrentSchema.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.setActiveSchema('conn-1', 'bad_schema');

      expect(store.error).toBe('Failed to set active schema');
    });
  });

  describe('getActiveSchema', () => {
    it('should return default when no override set', () => {
      const store = useConnectionsStore();
      store.setActiveDatabase('session-1', 'db');
      // Without any schema override set, it should return 'public'
      expect(store.getActiveSchema('session-1')).toBe('public');
    });

    it('should return schema override after setActiveSchema succeeds', async () => {
      mockSchemaSetCurrentSchema.mockResolvedValueOnce(undefined);
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });

      await store.setActiveSchema('session-1', 'custom');

      expect(store.getActiveSchema('session-1')).toBe('custom');
    });

    it('should return public as default for unknown session', () => {
      const store = useConnectionsStore();
      expect(store.getActiveSchema('unknown-id')).toBe('public');
    });
  });

  describe('fetchServerVersion', () => {
    it('should store server version on success', async () => {
      mockConnectionsGetServerVersion.mockResolvedValueOnce('15.2.0');

      const store = useConnectionsStore();
      // fetchServerVersion is called internally by connect, but we can test it
      // by connecting and checking the result
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaTables.mockResolvedValueOnce([]);

      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      await store.connect('conn-1');

      // Wait for the non-blocking fetchServerVersion to complete
      await vi.waitFor(() => {
        expect(store.serverVersions.get('session-123')).toBe('15.2.0');
      });
    });

    it('should not set version when result is null', async () => {
      mockConnectionsGetServerVersion.mockResolvedValueOnce(null);

      const store = useConnectionsStore();
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaTables.mockResolvedValueOnce([]);

      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      await store.connect('conn-1');

      // Wait a tick for the non-blocking call to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(store.serverVersions.has('session-123')).toBe(false);
    });

    it('should silently ignore errors', async () => {
      mockConnectionsGetServerVersion.mockRejectedValueOnce(new Error('Not supported'));

      const store = useConnectionsStore();
      mockConnectionsConnect.mockResolvedValueOnce('session-123');
      mockSchemaTables.mockResolvedValueOnce([]);

      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      await store.connect('conn-1');

      // Wait a tick for the non-blocking call to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(store.serverVersions.has('session-123')).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('disconnect (additional branches)', () => {
    it('should set generic error for non-Error exceptions', async () => {
      mockConnectionsDisconnect.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.activeSessionId = 'session-1';
      await store.disconnect('session-1');

      expect(store.connectionErrors.get('session-1')).toBe('Failed to disconnect');
    });

    it('should clean up schema overrides and server versions', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeSessionId = 'session-1';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.serverVersions.set('session-1', '15.0');
      store.schemas.set('session-1', [{ name: 'public' }]);

      await store.disconnect('session-1');

      expect(store.serverVersions.has('session-1')).toBe(false);
      expect(store.schemas.has('session-1')).toBe(false);
    });

    it('should not switch activeSessionId when disconnecting non-active', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.activeSessionId = 'session-2';
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      await store.disconnect('session-1');

      expect(store.activeSessionId).toBe('session-2');
    });
  });

  describe('deleteConnection (additional branches)', () => {
    it('should set generic error for non-Error exceptions', async () => {
      mockConnectionsDelete.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await expect(store.deleteConnection('conn-1')).rejects.toBe('string error');
      expect(store.error).toBe('Failed to delete connection');
    });

    it('should clean up schema overrides when deleting', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.schemas.set('session-1', [{ name: 'public' }]);

      await store.deleteConnection('conn-1');

      expect(store.schemas.has('session-1')).toBe(false);
    });

    it('should handle deleting a connection not in the list gracefully', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await store.deleteConnection('nonexistent');

      expect(store.connections).toHaveLength(1);
    });
  });

  describe('saveConnection (additional branches)', () => {
    it('should set generic error for non-Error exceptions', async () => {
      mockConnectionsSave.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      await expect(store.saveConnection({
        id: '',
        name: 'Test',
        type: DatabaseType.MySQL,
        database: 'db',
      })).rejects.toBe('string error');

      expect(store.error).toBe('Failed to save connection');
    });
  });

  describe('loadDatabases (additional branches)', () => {
    it('should set generic error for non-Error exceptions', async () => {
      mockSchemaDatabases.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadDatabases('conn-1');

      expect(store.error).toBe('Failed to load databases');
    });
  });

  describe('loadTables (additional branches)', () => {
    it('should set generic error for non-Error exceptions', async () => {
      mockSchemaTables.mockRejectedValueOnce('string error');

      const store = useConnectionsStore();
      store.activeSessionId = 'conn-1';
      await store.loadTables('conn-1', 'mydb');

      expect(store.error).toBe('Failed to load tables');
    });
  });

  describe('connectionsByFolder (additional branches)', () => {
    it('should handle connections with a folder not in allFolders', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: '1', name: 'A', folder: 'UnknownFolder' }),
        createSavedConnection({ id: '2', name: 'B', folder: null }),
      ];
      // Don't add 'UnknownFolder' to folders - it only comes from connection data
      store.folders = [];

      const result = store.connectionsByFolder;
      expect(result.grouped['UnknownFolder']).toHaveLength(1);
      expect(result.grouped['UnknownFolder'][0].name).toBe('A');
      expect(result.ungrouped).toHaveLength(1);
    });
  });

  describe('initConnectionStatusListener (additional branches)', () => {
    it('should load databases when getActiveDatabase returns empty string on connected event', () => {
      mockSchemaDatabases.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      // Register session but no connections in the list and no override, so getActiveDatabase returns ''
      store.sessions.set('conn-unknown', { savedConnectionId: 'conn-unknown' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];
      callback({
        connectionId: 'conn-unknown',
        status: ConnectionStatus.Connected,
      });

      expect(mockSchemaDatabases).toHaveBeenCalledWith('conn-unknown');
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should ignore events for sessions not owned by this window', () => {
      const store = useConnectionsStore();
      // Do NOT register 'foreign-session' in sessions Map
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];
      callback({
        connectionId: 'foreign-session',
        status: ConnectionStatus.Reconnecting,
        attempt: 1,
      });

      expect(store.connectionStates.get('foreign-session')).toBeUndefined();
    });
  });

  describe('updateConnectionFolder (additional branches)', () => {
    it('should handle updating folder for nonexistent connection gracefully', async () => {
      mockConnectionsUpdateFolder.mockResolvedValueOnce(undefined);
      mockConnectionsGetFolders.mockResolvedValueOnce(['Dev']);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', folder: null })];

      await store.updateConnectionFolder('nonexistent', 'Dev');

      expect(mockConnectionsUpdateFolder).toHaveBeenCalledWith('nonexistent', 'Dev');
      // conn-1 should remain unchanged
      expect(store.connections[0].folder).toBeNull();
      expect(store.folders).toEqual(['Dev']);
    });
  });

  describe('updatePositions (additional branches)', () => {
    it('should skip nonexistent connections in positions list', async () => {
      mockConnectionsUpdatePositions.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1', sortOrder: 0 }),
      ];

      await store.updatePositions([
        { id: 'conn-1', sortOrder: 2, folder: 'Dev' },
        { id: 'nonexistent', sortOrder: 1, folder: null },
      ]);

      expect(store.connections.find(c => c.id === 'conn-1')?.sortOrder).toBe(2);
      expect(store.connections.find(c => c.id === 'conn-1')?.folder).toBe('Dev');
      // nonexistent simply skipped, no error
      expect(store.connections).toHaveLength(1);
    });
  });

  describe('getSavedConnectionId', () => {
    it('should return saved connection ID for an active session', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');
      expect(store.getSavedConnectionId('session-1')).toBe('conn-1');
    });

    it('should return null for an unknown session ID', () => {
      const store = useConnectionsStore();
      expect(store.getSavedConnectionId('nonexistent')).toBeNull();
    });
  });

  describe('getConnectionForSession', () => {
    it('should return the saved connection for a session', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      const store = useConnectionsStore();
      const conn = createSavedConnection({ id: 'conn-1', name: 'My DB' });
      store.connections = [conn];
      await store.connect('conn-1');
      const result = store.getConnectionForSession('session-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('conn-1');
      expect(result?.name).toBe('My DB');
    });

    it('should return null for an unknown session', () => {
      const store = useConnectionsStore();
      expect(store.getConnectionForSession('nonexistent')).toBeNull();
    });

    it('should return null when saved connection no longer exists', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');
      store.connections = []; // Remove the saved connection
      expect(store.getConnectionForSession('session-1')).toBeNull();
    });
  });

  describe('getSessionsForSavedConnection', () => {
    it('should return all sessions for a saved connection', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      mockConnectionsConnect.mockResolvedValueOnce('session-2');
      await store.connect('conn-1');

      const sessions = store.getSessionsForSavedConnection('conn-1');
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain('session-1');
      expect(sessions).toContain('session-2');
    });

    it('should return empty array for unknown saved connection', () => {
      const store = useConnectionsStore();
      expect(store.getSessionsForSavedConnection('nonexistent')).toEqual([]);
    });
  });

  describe('cleanupSessionData', () => {
    it('should remove all cached data for a session', async () => {
      // First mockSchemaTables is consumed by connect -> loadTables
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'db1' }]);
      mockSchemaTables.mockResolvedValueOnce([{ name: 't1', type: 'table' }]);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');
      await store.loadDatabases('session-1');
      await store.loadTables('session-1', 'db1');
      store.setActiveDatabase('session-1', 'other_db');

      expect(store.databases.get('session-1')).toBeDefined();
      expect(store.tables.get('session-1')).toBeDefined();

      store.cleanupSessionData('session-1');

      expect(store.databases.get('session-1')).toBeUndefined();
      expect(store.tables.get('session-1')).toBeUndefined();
    });
  });

  describe('migrateSession', () => {
    it('should transfer session mapping to new ID', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.migrateSession('old-session', 'new-session');

      expect(store.getSavedConnectionId('new-session')).toBe('conn-1');
      expect(store.getSavedConnectionId('old-session')).toBeNull();
      expect(store.connectionStates.get('new-session')?.status).toBe(ConnectionStatus.Connected);
      expect(store.connectionStates.get('old-session')).toBeUndefined();
    });

    it('should preserve schema override during migration', async () => {
      mockSchemaTables.mockResolvedValueOnce([]);
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      mockSchemaSetCurrentSchema.mockResolvedValueOnce(undefined);
      mockSchemaTables.mockResolvedValueOnce([]);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');
      await store.setActiveSchema('old-session', 'custom_schema');

      store.migrateSession('old-session', 'new-session');

      expect(store.getActiveSchema('new-session')).toBe('custom_schema');
    });

    it('should clean up old session data', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'db1' }]);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');
      await store.loadDatabases('old-session');

      store.migrateSession('old-session', 'new-session');

      expect(store.databases.get('old-session')).toBeUndefined();
      expect(store.sessions.has('old-session')).toBe(false);
    });

    it('should handle early return when old session has no saved connection', () => {
      const store = useConnectionsStore();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      store.migrateSession('nonexistent-session', 'new-session');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('no saved connection found'));
      expect(store.sessions.has('new-session')).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('removeLocalSession', () => {
    it('should remove session from local state without calling disconnect IPC', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.databases.set('session-1', [{ name: 'db1' }]);
      store.tables.set('session-1', [{ name: 'users', type: TableObjectType.Table }]);
      store.activeSessionId = 'session-1';

      store.removeLocalSession('session-1');

      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.databases.has('session-1')).toBe(false);
      expect(store.tables.has('session-1')).toBe(false);
      expect(mockConnectionsDisconnect).not.toHaveBeenCalled();
    });

    it('should switch active session to remaining connection', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.removeLocalSession('session-1');

      expect(store.activeSessionId).toBe('session-2');
    });

    it('should set activeSessionId to null if no remaining sessions', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.removeLocalSession('session-1');

      expect(store.activeSessionId).toBeNull();
    });

    it('should not change activeSessionId when removing a non-active session', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-2';

      store.removeLocalSession('session-1');

      expect(store.activeSessionId).toBe('session-2');
    });
  });

  describe('safeMode', () => {
    it('should default to false', () => {
      const store = useConnectionsStore();
      expect(store.safeMode).toBe(false);
    });

    it('should return false when no active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = null;
      expect(store.safeMode).toBe(false);
    });

    it('should toggle safe mode on for active session', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.toggleSafeMode();
      expect(store.safeMode).toBe(true);
    });

    it('should toggle safe mode off after toggling on', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.toggleSafeMode();
      store.toggleSafeMode();
      expect(store.safeMode).toBe(false);
    });

    it('should be per-session (different sessions have independent safe mode)', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      store.activeSessionId = 'session-1';
      store.toggleSafeMode();
      expect(store.safeMode).toBe(true);

      store.activeSessionId = 'session-2';
      expect(store.safeMode).toBe(false);
    });

    it('should check safe mode for a specific session via isSafeModeForSession', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.toggleSafeMode();
      expect(store.isSafeModeForSession('session-1')).toBe(true);
      expect(store.isSafeModeForSession('nonexistent')).toBe(false);
    });

    it('should be cleaned up when session is disconnected', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.toggleSafeMode();
      expect(store.safeMode).toBe(true);

      await store.disconnect('session-1');
      expect(store.isSafeModeForSession('session-1')).toBe(false);
    });

    it('should be preserved during session migration', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.toggleSafeMode();
      expect(store.safeMode).toBe(true);

      store.migrateSession('old-session', 'new-session');

      expect(store.isSafeModeForSession('new-session')).toBe(true);
      expect(store.isSafeModeForSession('old-session')).toBe(false);
    });

    it('should be a no-op when toggling with no active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = null;

      store.toggleSafeMode();
      expect(store.safeMode).toBe(false);
    });

    it('should be cleaned up when connection is deleted', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);
      mockConnectionsDelete.mockResolvedValueOnce(undefined);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.toggleSafeMode();
      expect(store.isSafeModeForSession('session-1')).toBe(true);

      await store.deleteConnection('conn-1');
      expect(store.isSafeModeForSession('session-1')).toBe(false);
    });
  });

  describe('privacyMode', () => {
    it('should default to false', () => {
      const store = useConnectionsStore();
      expect(store.privacyMode).toBe(false);
    });

    it('should return false when no active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = null;
      expect(store.privacyMode).toBe(false);
    });

    it('should toggle privacy mode on for active session', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);
    });

    it('should toggle privacy mode off after toggling on', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.activeSessionId = 'session-1';

      store.togglePrivacyMode();
      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(false);
    });

    it('should be per-session (different sessions have independent privacy mode)', () => {
      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      store.activeSessionId = 'session-1';
      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);

      store.activeSessionId = 'session-2';
      expect(store.privacyMode).toBe(false);
    });

    it('should be preserved during session migration', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);

      store.migrateSession('old-session', 'new-session');

      expect(store.activeSessionId).toBe('new-session');
      expect(store.privacyMode).toBe(true);
    });

    it('should be a no-op when toggling with no active session', () => {
      const store = useConnectionsStore();
      store.activeSessionId = null;

      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(false);
    });

    it('should be cleaned up when session is disconnected', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);

      await store.disconnect('session-1');
      // Privacy mode state should be cleaned up
      store.activeSessionId = 'session-1';
      expect(store.privacyMode).toBe(false);
    });

    it('should be cleaned up when connection is deleted', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);
      mockConnectionsDelete.mockResolvedValueOnce(undefined);
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);

      await store.deleteConnection('conn-1');
      store.activeSessionId = 'session-1';
      expect(store.privacyMode).toBe(false);
    });
  });

  describe('adoptSession', () => {
    it('should register session and set it as active', async () => {
      mockSchemaGetSchemas.mockResolvedValueOnce([{ name: 'public' }]);
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];

      await store.adoptSession('session-adopt-1', 'conn-1');

      expect(store.sessions.get('session-adopt-1')?.savedConnectionId).toBe('conn-1');
      expect(store.connectionStates.get('session-adopt-1')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-adopt-1');
      // PostgreSQL connections load schemas first, then tables with the active schema
      expect(mockSchemaGetSchemas).toHaveBeenCalledWith('session-adopt-1');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-adopt-1', 'mydb', 'public');
    });

    it('should load databases when connection has no database (PostgreSQL)', async () => {
      mockSchemaGetSchemas.mockResolvedValueOnce([{ name: 'public' }]);
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      // PostgreSQL with empty database still goes through the schema branch
      store.connections = [createSavedConnection({ id: 'conn-1', database: '' })];

      await store.adoptSession('session-adopt-2', 'conn-1');

      expect(mockSchemaGetSchemas).toHaveBeenCalledWith('session-adopt-2');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-adopt-2', '', 'public');
    });

    it('should handle missing saved connection gracefully', async () => {
      const store = useConnectionsStore();
      store.connections = [];

      await store.adoptSession('session-adopt-3', 'nonexistent');

      expect(store.sessions.get('session-adopt-3')?.savedConnectionId).toBe('nonexistent');
      expect(store.connectionStates.get('session-adopt-3')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-adopt-3');
      // Tables should not have been loaded since connection not found
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should load tables when connection has a database but is not PostgreSQL or SQL Server', async () => {
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.MySQL, database: 'mydb' })];

      await store.adoptSession('session-adopt-mysql', 'conn-1');

      expect(mockSchemaGetSchemas).not.toHaveBeenCalled();
      expect(mockSchemaTables).toHaveBeenCalledWith('session-adopt-mysql', 'mydb', undefined);
    });

    it('should load databases when connection has no database and is not PostgreSQL or SQL Server', async () => {
      mockSchemaDatabases.mockResolvedValueOnce([{ name: 'db1' }]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.MySQL, database: '' })];

      await store.adoptSession('session-adopt-nodb', 'conn-1');

      expect(mockSchemaGetSchemas).not.toHaveBeenCalled();
      expect(mockSchemaTables).not.toHaveBeenCalled();
      expect(mockSchemaDatabases).toHaveBeenCalledWith('session-adopt-nodb');
    });

    it('should load schemas and tables for SQL Server connection', async () => {
      mockSchemaGetSchemas.mockResolvedValueOnce([{ name: 'dbo' }]);
      mockSchemaTables.mockResolvedValueOnce([]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.SQLServer, database: 'mydb' })];

      await store.adoptSession('session-adopt-sqlserver', 'conn-1');

      expect(mockSchemaGetSchemas).toHaveBeenCalledWith('session-adopt-sqlserver');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-adopt-sqlserver', 'mydb', 'public');
    });

    it('should fully replace session-1 with session-2 when adopting after removeLocalSession', async () => {
      // Step 1: Connect to create session-1
      mockConnectionsConnect.mockResolvedValueOnce('session-1');
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', database: 'mydb' })];
      await store.connect('conn-1');

      // Verify session-1 is present
      expect(store.sessions.has('session-1')).toBe(true);
      expect(store.connectionStates.get('session-1')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-1');

      // Step 2: Remove session-1 from local state (simulating multi-window handoff)
      store.removeLocalSession('session-1');

      // Verify session-1 is gone
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.tables.has('session-1')).toBe(false);
      expect(store.databases.has('session-1')).toBe(false);
      expect(store.activeSessionId).toBeNull();

      // Step 3: Adopt session-2 for the same saved connection
      mockSchemaGetSchemas.mockResolvedValueOnce([{ name: 'public' }]);
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'posts', type: TableObjectType.Table },
      ]);

      await store.adoptSession('session-2', 'conn-1');

      // Step 4: Verify session-1 is still gone
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.tables.has('session-1')).toBe(false);
      expect(store.schemas.has('session-1')).toBe(false);

      // Step 5: Verify session-2 is present and active
      expect(store.sessions.get('session-2')?.savedConnectionId).toBe('conn-1');
      expect(store.connectionStates.get('session-2')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeSessionId).toBe('session-2');
      expect(mockSchemaGetSchemas).toHaveBeenCalledWith('session-2');
      expect(mockSchemaTables).toHaveBeenCalledWith('session-2', 'mydb', 'public');
    });
  });

  describe('migrateSession (activeDatabaseOverrides)', () => {
    it('should preserve activeDatabaseOverrides when override exists', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      store.setActiveDatabase('old-session', 'override-db');

      store.migrateSession('old-session', 'new-session');

      expect(store.getActiveDatabase('new-session')).toBe('override-db');
    });
  });

  describe('deleteConnection cleanup of session-keyed maps', () => {
    it('should clear safeModeOverrides, privacyModeOverrides, and activeSchemaOverrides when deleting', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });

      // Set up session-keyed override data
      store.activeSessionId = 'session-1';
      store.toggleSafeMode();
      store.togglePrivacyMode();
      // Manually set schema override since setActiveSchema requires IPC
      store.setActiveDatabase('session-1', 'mydb');

      // Verify overrides are set before deletion
      expect(store.isSafeModeForSession('session-1')).toBe(true);
      expect(store.isPrivacyModeForSession('session-1')).toBe(true);
      expect(store.getActiveDatabase('session-1')).toBe('mydb');

      await store.deleteConnection('conn-1');

      // All session-keyed maps should be cleared
      expect(store.isSafeModeForSession('session-1')).toBe(false);
      expect(store.isPrivacyModeForSession('session-1')).toBe(false);
      expect(store.sessions.has('session-1')).toBe(false);
      expect(store.connectionStates.has('session-1')).toBe(false);
      expect(store.connections).toHaveLength(0);
    });
  });

  describe('migrateSession preserves safeModeOverrides and privacyModeOverrides', () => {
    it('should preserve both safeMode and privacyMode overrides on the new session and clear them from the old session', async () => {
      mockConnectionsConnect.mockResolvedValueOnce('old-session');
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      await store.connect('conn-1');

      // Enable both safeMode and privacyMode on old session
      store.toggleSafeMode();
      expect(store.safeMode).toBe(true);
      store.togglePrivacyMode();
      expect(store.privacyMode).toBe(true);

      store.migrateSession('old-session', 'new-session');

      // New session should have both overrides preserved
      expect(store.isSafeModeForSession('new-session')).toBe(true);
      expect(store.isPrivacyModeForSession('new-session')).toBe(true);

      // Old session should have both overrides cleared
      expect(store.isSafeModeForSession('old-session')).toBe(false);
      expect(store.isPrivacyModeForSession('old-session')).toBe(false);

      // Active session should now be the new one
      expect(store.activeSessionId).toBe('new-session');
      // Computed safeMode/privacyMode should reflect the new session
      expect(store.safeMode).toBe(true);
      expect(store.privacyMode).toBe(true);
    });
  });

  describe('connectedConnections computed deduplication', () => {
    it('should deduplicate by saved connection ID when multiple sessions exist for the same connection', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', name: 'My DB' })];

      // Create two sessions pointing to the same saved connection
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.sessions.set('session-2', { savedConnectionId: 'conn-1' });
      store.connectionStates.set('session-1', { id: 'session-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('session-2', { id: 'session-2', status: ConnectionStatus.Connected });

      // Despite two connected sessions, connectedConnections should deduplicate by saved connection ID
      expect(store.connectedConnections).toHaveLength(1);
      expect(store.connectedConnections[0].id).toBe('conn-1');
      expect(store.connectedConnections[0].name).toBe('My DB');
    });
  });

  describe('initConnectionStatusListener ignores events for sessions not owned by this window', () => {
    it('should not modify connectionStates for unowned Reconnecting events', () => {
      const store = useConnectionsStore();
      // Only register session-1, NOT foreign-session
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];

      // Fire event for a session NOT in the store's sessions map
      callback({
        connectionId: 'foreign-session',
        status: ConnectionStatus.Reconnecting,
        attempt: 5,
      });

      // No state changes should occur for the foreign session
      expect(store.connectionStates.has('foreign-session')).toBe(false);
      // Existing session should remain unaffected
      expect(store.connectionStates.has('session-1')).toBe(false);
    });

    it('should not modify connectionStates for unowned Connected events', () => {
      const store = useConnectionsStore();
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];

      callback({
        connectionId: 'foreign-session',
        status: ConnectionStatus.Connected,
      });

      expect(store.connectionStates.has('foreign-session')).toBe(false);
      // loadTables and loadDatabases should not have been called for the foreign session
      expect(mockSchemaTables).not.toHaveBeenCalled();
      expect(mockSchemaDatabases).not.toHaveBeenCalled();
    });

    it('should not modify connectionStates for unowned Error events', () => {
      const store = useConnectionsStore();
      store.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      store.initConnectionStatusListener();

      const callback = mockConnectionStatusOnChange.mock.calls[0][0];

      callback({
        connectionId: 'foreign-session',
        status: ConnectionStatus.Error,
        error: 'Connection lost',
      });

      expect(store.connectionStates.has('foreign-session')).toBe(false);
    });
  });
});
