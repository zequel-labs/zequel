import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ConnectionStatus, DatabaseType } from '@/types/connection';
import type { SavedConnection, ConnectionConfig } from '@/types/connection';
import type { Database, Table } from '@/types/table';
import { TableObjectType } from '@/types/table';

// Mock window.api
const mockConnectionsList = vi.fn();
const mockConnectionsSave = vi.fn();
const mockConnectionsDelete = vi.fn();
const mockConnectionsTest = vi.fn();
const mockConnectionsConnect = vi.fn();
const mockConnectionsDisconnect = vi.fn();
const mockConnectionsReconnect = vi.fn();
const mockConnectionsGetFolders = vi.fn();
const mockConnectionsUpdateFolder = vi.fn();
const mockConnectionsRenameFolder = vi.fn();
const mockConnectionsUpdatePositions = vi.fn();
const mockConnectionsDeleteFolder = vi.fn();
const mockSchemaDatabases = vi.fn();
const mockSchemaTables = vi.fn();
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
      disconnect: mockConnectionsDisconnect,
      reconnect: mockConnectionsReconnect,
      getFolders: mockConnectionsGetFolders,
      updateFolder: mockConnectionsUpdateFolder,
      renameFolder: mockConnectionsRenameFolder,
      updatePositions: mockConnectionsUpdatePositions,
      deleteFolder: mockConnectionsDeleteFolder,
    },
    schema: {
      databases: mockSchemaDatabases,
      tables: mockSchemaTables,
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
      expect(store.activeConnectionId).toBeNull();
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
      store.activeConnectionId = 'conn-1';
      expect(store.activeConnection).toEqual(conn);
    });

    it('should return null when active id does not match any connection', () => {
      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeConnectionId = 'conn-999';
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

    it('should return true when active connection is connected', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      expect(store.isConnected).toBe(true);
    });

    it('should return false when active connection is disconnected', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Disconnected });
      expect(store.isConnected).toBe(false);
    });

    it('should return false when active connection is in error', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Error, error: 'err' });
      expect(store.isConnected).toBe(false);
    });
  });

  describe('computed: activeDatabases', () => {
    it('should return empty array when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeDatabases).toEqual([]);
    });

    it('should return databases for active connection', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      const dbs: Database[] = [{ name: 'db1' }, { name: 'db2' }];
      store.databases.set('conn-1', dbs);
      expect(store.activeDatabases).toEqual(dbs);
    });
  });

  describe('computed: activeTables', () => {
    it('should return empty array when no active connection', () => {
      const store = useConnectionsStore();
      expect(store.activeTables).toEqual([]);
    });

    it('should return tables for active connection', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      const tbls: Table[] = [
        { name: 'users', type: TableObjectType.Table },
        { name: 'posts', type: TableObjectType.Table },
      ];
      store.tables.set('conn-1', tbls);
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
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('conn-2', { id: 'conn-2', status: ConnectionStatus.Disconnected });
      store.connectionStates.set('conn-3', { id: 'conn-3', status: ConnectionStatus.Reconnecting });

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
    it('should delete a connection', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      store.databases.set('conn-1', [{ name: 'db1' }]);
      store.tables.set('conn-1', [{ name: 'users', type: TableObjectType.Table }]);

      await store.deleteConnection('conn-1');

      expect(store.connections).toHaveLength(1);
      expect(store.connections[0].id).toBe('conn-2');
      expect(store.connectionStates.has('conn-1')).toBe(false);
      expect(store.databases.has('conn-1')).toBe(false);
      expect(store.tables.has('conn-1')).toBe(false);
    });

    it('should clear activeConnectionId if deleted', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeConnectionId = 'conn-1';

      await store.deleteConnection('conn-1');

      expect(store.activeConnectionId).toBeNull();
    });

    it('should not clear activeConnectionId if different', async () => {
      mockConnectionsDelete.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.activeConnectionId = 'conn-2';

      await store.deleteConnection('conn-1');

      expect(store.activeConnectionId).toBe('conn-2');
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
      mockConnectionsConnect.mockResolvedValueOnce(undefined);
      mockSchemaTables.mockResolvedValueOnce([
        { name: 'users', type: TableObjectType.Table },
      ]);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.PostgreSQL })];

      await store.connect('conn-1');

      expect(store.connectionStates.get('conn-1')?.status).toBe(ConnectionStatus.Connected);
      expect(store.activeConnectionId).toBe('conn-1');
      expect(mockSchemaTables).toHaveBeenCalled();
    });

    it('should not load tables for Redis connections', async () => {
      mockConnectionsConnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1', type: DatabaseType.Redis })];

      await store.connect('conn-1');

      expect(store.connectionStates.get('conn-1')?.status).toBe(ConnectionStatus.Connected);
      expect(mockSchemaTables).not.toHaveBeenCalled();
    });

    it('should set connecting state initially', async () => {
      let resolveConnect: () => void;
      const connectPromise = new Promise<void>((resolve) => {
        resolveConnect = resolve;
      });
      mockConnectionsConnect.mockReturnValueOnce(connectPromise);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      const promise = store.connect('conn-1');
      expect(store.connectionStates.get('conn-1')?.status).toBe(ConnectionStatus.Connecting);

      mockSchemaTables.mockResolvedValueOnce([]);
      resolveConnect!();
      await promise;

      expect(store.connectionStates.get('conn-1')?.status).toBe(ConnectionStatus.Connected);
    });

    it('should set error state on failure', async () => {
      mockConnectionsConnect.mockRejectedValueOnce(new Error('Connection refused'));

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];

      await expect(store.connect('conn-1')).rejects.toThrow('Connection refused');

      const state = store.connectionStates.get('conn-1');
      expect(state?.status).toBe(ConnectionStatus.Error);
      expect(state?.error).toBe('Connection refused');
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear state', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      store.databases.set('conn-1', [{ name: 'db1' }]);
      store.tables.set('conn-1', [{ name: 'users', type: TableObjectType.Table }]);

      await store.disconnect('conn-1');

      expect(store.connectionStates.get('conn-1')?.status).toBe(ConnectionStatus.Disconnected);
      expect(store.databases.has('conn-1')).toBe(false);
      expect(store.tables.has('conn-1')).toBe(false);
    });

    it('should switch to another connected connection if disconnecting active', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [
        createSavedConnection({ id: 'conn-1' }),
        createSavedConnection({ id: 'conn-2' }),
      ];
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });
      store.connectionStates.set('conn-2', { id: 'conn-2', status: ConnectionStatus.Connected });

      await store.disconnect('conn-1');

      expect(store.activeConnectionId).toBe('conn-2');
    });

    it('should set activeConnectionId to null if no other connections', async () => {
      mockConnectionsDisconnect.mockResolvedValueOnce(undefined);

      const store = useConnectionsStore();
      store.connections = [createSavedConnection({ id: 'conn-1' })];
      store.activeConnectionId = 'conn-1';
      store.connectionStates.set('conn-1', { id: 'conn-1', status: ConnectionStatus.Connected });

      await store.disconnect('conn-1');

      expect(store.activeConnectionId).toBeNull();
    });

    it('should set error on disconnect failure', async () => {
      mockConnectionsDisconnect.mockRejectedValueOnce(new Error('Disconnect failed'));

      const store = useConnectionsStore();
      await store.disconnect('conn-1');

      expect(store.error).toBe('Disconnect failed');
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

      expect(store.getActiveDatabase('conn-1')).toBe('default-db');
    });

    it('should return empty string if no override and no connection', () => {
      const store = useConnectionsStore();
      expect(store.getActiveDatabase('unknown')).toBe('');
    });
  });

  describe('setActiveConnection', () => {
    it('should set the active connection id', () => {
      const store = useConnectionsStore();
      store.setActiveConnection('conn-1');
      expect(store.activeConnectionId).toBe('conn-1');
    });

    it('should set to null', () => {
      const store = useConnectionsStore();
      store.activeConnectionId = 'conn-1';
      store.setActiveConnection(null);
      expect(store.activeConnectionId).toBeNull();
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
});
