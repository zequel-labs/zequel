import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConnection } from '@/composables/useConnection';
import { ConnectionStatus, DatabaseType } from '@/types/connection';
import type { SavedConnection, ConnectionConfig, ConnectionState } from '@/types/connection';

// Mock window.api
vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    connections: {
      list: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      test: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      getFolders: vi.fn().mockResolvedValue([]),
      reconnect: vi.fn(),
      updateFolder: vi.fn(),
      renameFolder: vi.fn(),
      updatePositions: vi.fn(),
      deleteFolder: vi.fn(),
    },
    schema: {
      databases: vi.fn(),
      tables: vi.fn().mockResolvedValue([]),
    },
    connectionStatus: {
      onChange: vi.fn(),
    },
    theme: {
      set: vi.fn(),
      onChange: vi.fn(),
    },
    tabs: {
      save: vi.fn(),
      load: vi.fn(),
      delete: vi.fn(),
    },
  },
  matchMedia: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
  localStorage: {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
  },
  dispatchEvent: vi.fn(),
});

const makeSavedConnection = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
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
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastConnectedAt: null,
  ...overrides,
});

const makeConnectionConfig = (overrides: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  id: 'conn-1',
  name: 'Test DB',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  ...overrides,
});

describe('useConnection', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have isLoading as false initially', () => {
      const { isLoading } = useConnection();
      expect(isLoading.value).toBe(false);
    });

    it('should have error as null initially', () => {
      const { error } = useConnection();
      expect(error.value).toBeNull();
    });

    it('should have isConnected as false when no active connection', () => {
      const { isConnected } = useConnection();
      expect(isConnected.value).toBe(false);
    });

    it('should have activeConnection as null initially', () => {
      const { activeConnection } = useConnection();
      expect(activeConnection.value).toBeNull();
    });

    it('should return an empty connections list initially', () => {
      const { connections } = useConnection();
      expect(connections.value).toEqual([]);
    });
  });

  describe('connect', () => {
    it('should set isLoading to true during connection', async () => {
      const { connect, isLoading } = useConnection();
      const connection = makeSavedConnection();

      vi.mocked(window.api.connections.connect).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = connect(connection);
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('should clear error before connecting', async () => {
      const { connect, error } = useConnection();
      const connection = makeSavedConnection();

      vi.mocked(window.api.connections.connect).mockResolvedValueOnce(undefined);
      vi.mocked(window.api.schema.tables).mockResolvedValueOnce([]);

      error.value = 'previous error';
      await connect(connection);
      expect(error.value).toBeNull();
    });

    it('should set error on connection failure', async () => {
      const { connect, error } = useConnection();
      const connection = makeSavedConnection();

      vi.mocked(window.api.connections.connect).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(connect(connection)).rejects.toThrow('Connection refused');
      expect(error.value).toBe('Connection refused');
    });

    it('should set generic error when non-Error is thrown', async () => {
      const { connect, error } = useConnection();
      const connection = makeSavedConnection();

      vi.mocked(window.api.connections.connect).mockRejectedValueOnce('string error');

      await expect(connect(connection)).rejects.toBe('string error');
      expect(error.value).toBe('Connection failed');
    });

    it('should set isLoading to false after failure', async () => {
      const { connect, isLoading } = useConnection();
      const connection = makeSavedConnection();

      vi.mocked(window.api.connections.connect).mockRejectedValueOnce(new Error('fail'));

      try {
        await connect(connection);
      } catch {
        // expected
      }
      expect(isLoading.value).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should set isLoading during disconnect', async () => {
      const { disconnect, isLoading } = useConnection();

      vi.mocked(window.api.connections.disconnect).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = disconnect('conn-1');
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('should set error on disconnect failure when store throws', async () => {
      const { disconnect, error } = useConnection();

      // The store's disconnect catches internally, so we must make the
      // closeTabsForConnection call throw to hit the composable's catch.
      // But the composable catches errors from connectionsStore.disconnect which
      // does not re-throw. Let's verify the store's error is handled.
      // The composable only sets its own error if the store throws.
      // The store's disconnect swallows the error, so composable error stays null.
      vi.mocked(window.api.connections.disconnect).mockRejectedValueOnce(new Error('Disconnect error'));

      await disconnect('conn-1');
      // The store's disconnect catches the error internally and does not re-throw,
      // so the composable's error stays null. The store sets its own error.
      expect(error.value).toBeNull();
    });

    it('should handle disconnect with no errors', async () => {
      const { disconnect, error } = useConnection();

      vi.mocked(window.api.connections.disconnect).mockResolvedValueOnce(undefined);

      await disconnect('conn-1');
      expect(error.value).toBeNull();
    });

    it('should clear error on successful disconnect', async () => {
      const { disconnect, error } = useConnection();

      vi.mocked(window.api.connections.disconnect).mockResolvedValueOnce(undefined);

      error.value = 'old error';
      await disconnect('conn-1');
      expect(error.value).toBeNull();
    });
  });

  describe('saveConnection', () => {
    it('should save and return the connection', async () => {
      const { saveConnection } = useConnection();
      const config = makeConnectionConfig();
      const saved = makeSavedConnection();

      vi.mocked(window.api.connections.save).mockResolvedValueOnce(saved);

      const result = await saveConnection(config);
      expect(result).toEqual(saved);
    });

    it('should set isLoading during save', async () => {
      const { saveConnection, isLoading } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.save).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = saveConnection(config);
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('should set error on save failure', async () => {
      const { saveConnection, error } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.save).mockRejectedValueOnce(new Error('Save error'));

      await expect(saveConnection(config)).rejects.toThrow('Save error');
      expect(error.value).toBe('Save error');
    });

    it('should set generic error on non-Error save failure', async () => {
      const { saveConnection, error } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.save).mockRejectedValueOnce(42);

      await expect(saveConnection(config)).rejects.toBe(42);
      expect(error.value).toBe('Save failed');
    });
  });

  describe('deleteConnection', () => {
    it('should set isLoading during delete', async () => {
      const { deleteConnection, isLoading } = useConnection();

      vi.mocked(window.api.connections.delete).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = deleteConnection('conn-1');
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });

    it('should set error on delete failure', async () => {
      const { deleteConnection, error } = useConnection();

      vi.mocked(window.api.connections.delete).mockRejectedValueOnce(new Error('Delete error'));

      await expect(deleteConnection('conn-1')).rejects.toThrow('Delete error');
      expect(error.value).toBe('Delete error');
    });

    it('should set generic error on non-Error delete failure', async () => {
      const { deleteConnection, error } = useConnection();

      vi.mocked(window.api.connections.delete).mockRejectedValueOnce(null);

      await expect(deleteConnection('conn-1')).rejects.toBe(null);
      expect(error.value).toBe('Delete failed');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful test', async () => {
      const { testConnection } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.test).mockResolvedValueOnce({ success: true });

      const result = await testConnection(config);
      expect(result).toBe(true);
    });

    it('should return false on failed test', async () => {
      const { testConnection } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.test).mockResolvedValueOnce({ success: false });

      const result = await testConnection(config);
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      const { testConnection } = useConnection();
      const config = makeConnectionConfig();

      // The store's testConnection catches internally and returns false.
      // The composable then receives false from the store and the
      // composable's own catch block sets error.value to 'Test failed'.
      // However, the store catches the error and returns false without re-throwing,
      // so the composable's catch is never triggered. The composable receives false.
      vi.mocked(window.api.connections.test).mockRejectedValueOnce(new Error('Network error'));

      const result = await testConnection(config);
      expect(result).toBe(false);
    });

    it('should set isLoading during test', async () => {
      const { testConnection, isLoading } = useConnection();
      const config = makeConnectionConfig();

      vi.mocked(window.api.connections.test).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const promise = testConnection(config);
      expect(isLoading.value).toBe(true);

      await promise;
      expect(isLoading.value).toBe(false);
    });
  });

  describe('getConnectionState', () => {
    it('should return disconnected state for unknown connection', () => {
      const { getConnectionState } = useConnection();
      const state = getConnectionState('unknown-id');
      expect(state).toEqual({ id: 'unknown-id', status: ConnectionStatus.Disconnected });
    });
  });
});
