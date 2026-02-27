import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType } from '@main/types';
import type { ConnectionConfig, SavedConnection } from '@main/types';

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    connect: vi.fn().mockResolvedValue('session-123'),
    disconnect: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue({ success: true }),
    getConnection: vi.fn().mockReturnValue(null),
    getSessionsForSavedConnection: vi.fn().mockReturnValue([]),
    getSavedConnectionId: vi.fn().mockReturnValue(undefined),
    getConnectionConfig: vi.fn().mockReturnValue(undefined),
    forceRemoveSession: vi.fn(),
  },
}));

vi.mock('@main/services/connections', () => ({
  connectionsService: {
    list: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(null),
    save: vi.fn(),
    delete: vi.fn().mockReturnValue(true),
    updateLastConnected: vi.fn(),
    updateFolder: vi.fn(),
    getFolders: vi.fn().mockReturnValue([]),
    renameFolder: vi.fn(),
    deleteFolder: vi.fn(),
    updatePositions: vi.fn(),
  },
}));

vi.mock('@main/services/keychain', () => ({
  keychainService: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(null),
    deletePassword: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@main/services/windowManager', () => ({
  windowManager: {
    setSessionOwner: vi.fn(),
    removeSessionOwner: vi.fn(),
    getSessionOwner: vi.fn().mockReturnValue(undefined),
    transferSession: vi.fn(),
    getSessionsForWindow: vi.fn().mockReturnValue([]),
    isSessionInTransfer: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import { connectionManager } from '@main/db/manager';
import { connectionsService } from '@main/services/connections';
import { keychainService } from '@main/services/keychain';
import { windowManager } from '@main/services/windowManager';
import { registerConnectionHandlers } from '@main/ipc/connection';

const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls;
  const match = calls.find((c) => c[0] === channel);
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return match[1] as (...args: unknown[]) => unknown;
};

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
  sslConfig: null,
  ssh: null,
  color: null,
  environment: null,
  folder: null,
  sortOrder: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  lastConnectedAt: null,
  ...overrides,
});

describe('registerConnectionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerConnectionHandlers();
  });

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(registeredChannels).toContain('connection:list');
    expect(registeredChannels).toContain('connection:get');
    expect(registeredChannels).toContain('connection:save');
    expect(registeredChannels).toContain('connection:delete');
    expect(registeredChannels).toContain('connection:test');
    expect(registeredChannels).toContain('connection:connect');
    expect(registeredChannels).toContain('connection:disconnect');
    expect(registeredChannels).toContain('connection:reconnect');
    expect(registeredChannels).toContain('connection:updateFolder');
    expect(registeredChannels).toContain('connection:getFolders');
    expect(registeredChannels).toContain('connection:renameFolder');
    expect(registeredChannels).toContain('connection:deleteFolder');
    expect(registeredChannels).toContain('connection:updatePositions');
    expect(registeredChannels).toContain('connection:connectWithDatabase');
    expect(registeredChannels).toContain('connection:connectWithConfig');
    expect(registeredChannels).toContain('connection:getServerVersion');
  });

  describe('connection:list', () => {
    it('should return a serialized list of connections', async () => {
      const connections = [makeSavedConnection()];
      vi.mocked(connectionsService.list).mockReturnValue(connections);

      const handler = getHandler('connection:list');
      const result = await handler({});

      expect(connectionsService.list).toHaveBeenCalled();
      expect(result).toEqual(connections);
    });
  });

  describe('connection:get', () => {
    it('should return a connection when found', async () => {
      const connection = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(connection);

      const handler = getHandler('connection:get');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(result).toEqual(connection);
    });

    it('should return null when connection is not found', async () => {
      vi.mocked(connectionsService.get).mockReturnValue(undefined as unknown as SavedConnection);

      const handler = getHandler('connection:get');
      const result = await handler({ sender: { id: 1 } }, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('connection:save', () => {
    it('should save password to keychain when password is provided', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'secret',
      };
      const savedConn = makeSavedConnection();
      vi.mocked(connectionsService.save).mockReturnValue(savedConn);

      const handler = getHandler('connection:save');
      await handler({ sender: { id: 1 } }, config);

      expect(keychainService.setPassword).toHaveBeenCalledWith('conn-1', 'secret');
      expect(connectionsService.save).toHaveBeenCalled();
    });

    it('should skip keychain save when no password is provided', async () => {
      const config: ConnectionConfig = {
        id: 'conn-2',
        name: 'Test',
        type: DatabaseType.SQLite,
        database: 'test.db',
      };
      const savedConn = makeSavedConnection({ id: 'conn-2' });
      vi.mocked(connectionsService.save).mockReturnValue(savedConn);

      const handler = getHandler('connection:save');
      await handler({ sender: { id: 1 } }, config);

      expect(keychainService.setPassword).not.toHaveBeenCalled();
      expect(connectionsService.save).toHaveBeenCalled();
    });

    it('should return the saved connection as a plain object', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
      };
      const savedConn = makeSavedConnection();
      vi.mocked(connectionsService.save).mockReturnValue(savedConn);

      const handler = getHandler('connection:save');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(result).toEqual(savedConn);
    });
  });

  describe('connection:delete', () => {
    it('should disconnect all sessions, delete keychain password, and delete connection', async () => {
      vi.mocked(connectionManager.getSessionsForSavedConnection).mockReturnValue(['session-a', 'session-b']);

      const handler = getHandler('connection:delete');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(connectionManager.getSessionsForSavedConnection).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('session-a');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('session-b');
      expect(keychainService.deletePassword).toHaveBeenCalledWith('conn-1');
      expect(connectionsService.delete).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(true);
    });
  });

  describe('connection:test', () => {
    it('should test the connection with provided password', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'mypass',
      };
      vi.mocked(connectionManager.testConnection).mockResolvedValue({ success: true });

      const handler = getHandler('connection:test');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(connectionManager.testConnection).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'mypass' })
      );
      expect(result).toEqual({ success: true });
    });

    it('should retrieve password from keychain when not provided', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
      };
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');
      vi.mocked(connectionManager.testConnection).mockResolvedValue({ success: true });

      const handler = getHandler('connection:test');
      await handler({ sender: { id: 1 } }, config);

      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.testConnection).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'keychain-pass' })
      );
    });

    it('should return error result when test throws', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'pass',
      };
      vi.mocked(connectionManager.testConnection).mockRejectedValue(new Error('Connection refused'));

      const handler = getHandler('connection:test');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(result).toEqual({ success: false, error: 'Connection refused' });
    });

    it('should handle non-Error thrown values', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'pass',
      };
      vi.mocked(connectionManager.testConnection).mockRejectedValue('string error');

      const handler = getHandler('connection:test');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(result).toEqual({ success: false, error: 'string error' });
    });
  });

  describe('connection:connect', () => {
    it('should connect using saved connection and keychain password', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('session-123');

      const handler = getHandler('connection:connect');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          password: 'keychain-pass',
        })
      );
      expect(connectionsService.updateLastConnected).toHaveBeenCalledWith('conn-1');
      expect(windowManager.setSessionOwner).toHaveBeenCalledWith('session-123', 1);
      expect(result).toBe('session-123');
    });

    it('should throw when connection is not found', async () => {
      vi.mocked(connectionsService.get).mockReturnValue(undefined as unknown as SavedConnection);

      const handler = getHandler('connection:connect');
      await expect(handler({ sender: { id: 1 } }, 'non-existent')).rejects.toThrow('Connection not found');
    });

    it('should re-throw connection errors', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue(null);
      vi.mocked(connectionManager.connect).mockRejectedValue(new Error('Timeout'));

      const handler = getHandler('connection:connect');
      await expect(handler({ sender: { id: 1 } }, 'conn-1')).rejects.toThrow('Timeout');
    });
  });

  describe('connection:disconnect', () => {
    it('should disconnect the connection', async () => {
      const handler = getHandler('connection:disconnect');
      await handler({ sender: { id: 1 } }, 'conn-1');

      expect(windowManager.removeSessionOwner).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('conn-1');
    });

    it('should reject unauthorized caller', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(999);
      vi.mocked(windowManager.isSessionInTransfer).mockReturnValue(false);

      const handler = getHandler('connection:disconnect');
      await expect(handler({ sender: { id: 1 } }, 'conn-1')).rejects.toThrow(
        'Not authorized to disconnect this session'
      );
    });

    it('should allow disconnect when session is in transfer', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(999);
      vi.mocked(windowManager.isSessionInTransfer).mockReturnValue(true);

      const handler = getHandler('connection:disconnect');
      await handler({ sender: { id: 1 } }, 'conn-1');

      expect(windowManager.removeSessionOwner).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('connection:reconnect', () => {
    it('should reconnect the connection', async () => {
      const handler = getHandler('connection:reconnect');
      await handler({ sender: { id: 1 } }, 'conn-1');

      expect(connectionManager.reconnect).toHaveBeenCalledWith('conn-1');
    });

    it('should reject unauthorized caller', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(999);
      vi.mocked(windowManager.isSessionInTransfer).mockReturnValue(false);

      const handler = getHandler('connection:reconnect');
      await expect(handler({ sender: { id: 1 } }, 'conn-1')).rejects.toThrow(
        'Not authorized to reconnect this session'
      );
    });
  });

  describe('connection:updateFolder', () => {
    it('should update the folder and return true', async () => {
      const handler = getHandler('connection:updateFolder');
      const result = await handler({ sender: { id: 1 } }, 'conn-1', 'Production');

      expect(connectionsService.updateFolder).toHaveBeenCalledWith('conn-1', 'Production');
      expect(result).toBe(true);
    });

    it('should accept null to remove folder', async () => {
      const handler = getHandler('connection:updateFolder');
      const result = await handler({ sender: { id: 1 } }, 'conn-1', null);

      expect(connectionsService.updateFolder).toHaveBeenCalledWith('conn-1', null);
      expect(result).toBe(true);
    });
  });

  describe('connection:getFolders', () => {
    it('should return the list of folders', async () => {
      vi.mocked(connectionsService.getFolders).mockReturnValue(['Production', 'Staging']);

      const handler = getHandler('connection:getFolders');
      const result = await handler({});

      expect(result).toEqual(['Production', 'Staging']);
    });
  });

  describe('connection:renameFolder', () => {
    it('should rename folder and return true', async () => {
      const handler = getHandler('connection:renameFolder');
      const result = await handler({ sender: { id: 1 } }, 'OldName', 'NewName');

      expect(connectionsService.renameFolder).toHaveBeenCalledWith('OldName', 'NewName');
      expect(result).toBe(true);
    });
  });

  describe('connection:deleteFolder', () => {
    it('should delete folder and return true', async () => {
      const handler = getHandler('connection:deleteFolder');
      const result = await handler({ sender: { id: 1 } }, 'Production');

      expect(connectionsService.deleteFolder).toHaveBeenCalledWith('Production');
      expect(result).toBe(true);
    });
  });

  describe('connection:updatePositions', () => {
    it('should update positions and return true', async () => {
      const positions = [
        { id: 'conn-1', sortOrder: 0, folder: null },
        { id: 'conn-2', sortOrder: 1, folder: 'Production' },
      ];

      const handler = getHandler('connection:updatePositions');
      const result = await handler({ sender: { id: 1 } }, positions);

      expect(connectionsService.updatePositions).toHaveBeenCalledWith(positions);
      expect(result).toBe(true);
    });
  });

  describe('connection:connectWithConfig', () => {
    it('should connect with provided password', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'direct-pass',
      };
      vi.mocked(connectionManager.connect).mockResolvedValue('session-cfg-1');

      const handler = getHandler('connection:connectWithConfig');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'direct-pass' })
      );
      expect(result).toBe('session-cfg-1');
    });

    it('should retrieve password from keychain when not provided', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
      };
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('session-cfg-2');

      const handler = getHandler('connection:connectWithConfig');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'keychain-pass' })
      );
      expect(result).toBe('session-cfg-2');
    });

    it('should not fetch keychain password when id is missing', async () => {
      const config: ConnectionConfig = {
        id: '',
        name: 'Test',
        type: DatabaseType.SQLite,
        database: 'test.db',
      };
      vi.mocked(connectionManager.connect).mockResolvedValue('session-cfg-3');

      const handler = getHandler('connection:connectWithConfig');
      const result = await handler({ sender: { id: 1 } }, config);

      expect(keychainService.getPassword).not.toHaveBeenCalled();
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({ password: undefined })
      );
      expect(result).toBe('session-cfg-3');
    });

    it('should re-throw connection errors', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'pass',
      };
      vi.mocked(connectionManager.connect).mockRejectedValue(new Error('Auth failed'));

      const handler = getHandler('connection:connectWithConfig');
      await expect(handler({ sender: { id: 1 } }, config)).rejects.toThrow('Auth failed');
    });

    it('should call setSessionOwner with the new session ID and sender webContentsId', async () => {
      const config: ConnectionConfig = {
        id: 'conn-1',
        name: 'Test',
        type: DatabaseType.PostgreSQL,
        database: 'testdb',
        password: 'direct-pass',
      };
      vi.mocked(connectionManager.connect).mockResolvedValue('session-owner-test');

      const handler = getHandler('connection:connectWithConfig');
      await handler({ sender: { id: 42 } }, config);

      expect(windowManager.setSessionOwner).toHaveBeenCalledWith('session-owner-test', 42);
    });
  });

  describe('connection:connectWithDatabase', () => {
    it('should resolve saved ID from session, disconnect, then reconnect to a different database', async () => {
      const saved = makeSavedConnection();
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('conn-1');
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('new-session-456');

      const handler = getHandler('connection:connectWithDatabase');
      const result = await handler({ sender: { id: 1 } }, 'session-123', 'other_db');

      expect(connectionManager.getSavedConnectionId).toHaveBeenCalledWith('session-123');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('session-123');
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          database: 'other_db',
          password: 'keychain-pass',
        })
      );
      expect(result).toBe('new-session-456');
    });

    it('should throw when session is not found', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue(undefined);

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({ sender: { id: 1 } }, 'non-existent-session', 'db')).rejects.toThrow('Session not found');
    });

    it('should re-throw connection errors', async () => {
      const saved = makeSavedConnection();
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('conn-1');
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue(null);
      vi.mocked(connectionManager.connect).mockRejectedValue(new Error('DNS resolution failed'));

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({ sender: { id: 1 } }, 'session-123', 'otherdb')).rejects.toThrow('DNS resolution failed');
    });

    it('should still return new session when old session disconnect fails', async () => {
      const saved = makeSavedConnection();
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('conn-1');
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue('pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('new-session-789');
      vi.mocked(connectionManager.disconnect).mockRejectedValue(new Error('Already disconnected'));

      const handler = getHandler('connection:connectWithDatabase');
      const result = await handler({ sender: { id: 1 } }, 'session-123', 'other_db');

      expect(result).toBe('new-session-789');
      expect(connectionManager.disconnect).toHaveBeenCalledWith('session-123');
      expect(connectionManager.forceRemoveSession).toHaveBeenCalledWith('session-123');
      expect(windowManager.removeSessionOwner).toHaveBeenCalledWith('session-123');
      expect(windowManager.setSessionOwner).toHaveBeenCalledWith('new-session-789', 1);
    });

    it('should use fallback config from getConnectionConfig for unsaved connections', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue(undefined);
      vi.mocked(connectionManager.getConnectionConfig).mockReturnValue({
        id: 'adhoc',
        name: 'Ad-hoc',
        type: DatabaseType.PostgreSQL,
        database: 'olddb',
        host: 'localhost',
        port: 5432,
      });
      vi.mocked(connectionManager.connect).mockResolvedValue('new-adhoc-session');

      const handler = getHandler('connection:connectWithDatabase');
      const result = await handler({ sender: { id: 1 } }, 'session-123', 'newdb');

      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({ database: 'newdb' })
      );
      expect(result).toBe('new-adhoc-session');
    });

    it('should reject unauthorized caller for connectWithDatabase', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(999);
      vi.mocked(windowManager.isSessionInTransfer).mockReturnValue(false);

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({ sender: { id: 1 } }, 'session-123', 'other_db')).rejects.toThrow(
        'Not authorized to switch database for this session'
      );
    });

    it('should allow connectWithDatabase when session is in transfer', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(999);
      vi.mocked(windowManager.isSessionInTransfer).mockReturnValue(true);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('conn-1');
      vi.mocked(connectionsService.get).mockReturnValue(makeSavedConnection());
      vi.mocked(keychainService.getPassword).mockResolvedValue('pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('new-session');

      const handler = getHandler('connection:connectWithDatabase');
      const result = await handler({ sender: { id: 1 } }, 'session-123', 'other_db');

      expect(result).toBe('new-session');
    });

    it('should rollback new session when setSessionOwner fails', async () => {
      vi.mocked(windowManager.getSessionOwner).mockReturnValue(undefined);
      vi.mocked(connectionManager.getSavedConnectionId).mockReturnValue('conn-1');
      vi.mocked(connectionsService.get).mockReturnValue(makeSavedConnection());
      vi.mocked(keychainService.getPassword).mockResolvedValue('pass');
      vi.mocked(connectionManager.connect).mockResolvedValue('new-session-456');
      vi.mocked(windowManager.setSessionOwner).mockImplementation(() => {
        throw new Error('owner error');
      });

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({ sender: { id: 1 } }, 'session-123', 'other_db')).rejects.toThrow('owner error');

      expect(connectionManager.disconnect).toHaveBeenCalledWith('new-session-456');
      expect(windowManager.removeSessionOwner).toHaveBeenCalledWith('new-session-456');
    });
  });

  describe('connection:getServerVersion', () => {
    const makeDriver = (type: DatabaseType) => ({
      type,
      execute: vi.fn(),
    });

    it('should throw when connection is not found', async () => {
      vi.mocked(connectionManager.getConnection).mockReturnValue(null as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      await expect(handler({ sender: { id: 1 } }, 'non-existent')).rejects.toThrow('Connection not found');
    });

    it('should return SQLite version', async () => {
      const driver = makeDriver(DatabaseType.SQLite);
      driver.execute.mockResolvedValue({
        rows: [{ version: '3.39.0' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT sqlite_version() as version');
      expect(result).toBe('SQLite 3.39.0');
    });

    it('should return SQLite without version when row is empty', async () => {
      const driver = makeDriver(DatabaseType.SQLite);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('SQLite ');
    });

    it('should return Redis version from INFO server output', async () => {
      const driver = makeDriver(DatabaseType.Redis);
      driver.execute.mockResolvedValue({
        rows: [{ value: '# Server\r\nredis_version:7.2.4\r\nredis_git_sha1:00000000' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('INFO server');
      expect(result).toBe('Redis 7.2.4');
    });

    it('should return "Redis" when version pattern is not found', async () => {
      const driver = makeDriver(DatabaseType.Redis);
      driver.execute.mockResolvedValue({
        rows: [{ value: 'some unexpected output' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('Redis');
    });

    it('should return "Redis" when row value is missing', async () => {
      const driver = makeDriver(DatabaseType.Redis);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('Redis');
    });

    it('should return MongoDB version', async () => {
      const driver = makeDriver(DatabaseType.MongoDB);
      driver.execute.mockResolvedValue({
        rows: [{ version: '7.0.5' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('db.version()');
      expect(result).toBe('MongoDB 7.0.5');
    });

    it('should return "MongoDB" when version is empty', async () => {
      const driver = makeDriver(DatabaseType.MongoDB);
      driver.execute.mockResolvedValue({
        rows: [{ version: '' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('MongoDB');
    });

    it('should return PostgreSQL version parsed from version string', async () => {
      const driver = makeDriver(DatabaseType.PostgreSQL);
      driver.execute.mockResolvedValue({
        rows: [{ version: 'PostgreSQL 16.1 on x86_64-pc-linux-gnu' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT version()');
      expect(result).toBe('PostgreSQL 16.1');
    });

    it('should return raw version prefix when PostgreSQL pattern does not match', async () => {
      const driver = makeDriver(DatabaseType.PostgreSQL);
      driver.execute.mockResolvedValue({
        rows: [{ version: 'CockroachDB v23.1.0 on x86_64' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('CockroachDB v23.1.0');
    });

    it('should return "PostgreSQL" when version row is empty', async () => {
      const driver = makeDriver(DatabaseType.PostgreSQL);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('PostgreSQL');
    });

    it('should return MySQL version', async () => {
      const driver = makeDriver(DatabaseType.MySQL);
      driver.execute.mockResolvedValue({
        rows: [{ version: '8.0.35' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT version() as version');
      expect(result).toBe('8.0.35');
    });

    it('should return MariaDB version', async () => {
      const driver = makeDriver(DatabaseType.MariaDB);
      driver.execute.mockResolvedValue({
        rows: [{ version: '11.2.2-MariaDB' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT version() as version');
      expect(result).toBe('11.2.2-MariaDB');
    });

    it('should return empty string for MySQL when version row is empty', async () => {
      const driver = makeDriver(DatabaseType.MySQL);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('');
    });

    it('should return ClickHouse version', async () => {
      const driver = makeDriver(DatabaseType.ClickHouse);
      driver.execute.mockResolvedValue({
        rows: [{ version: '24.1.1.2048' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT version() as version');
      expect(result).toBe('ClickHouse 24.1.1.2048');
    });

    it('should return DuckDB version', async () => {
      const driver = makeDriver(DatabaseType.DuckDB);
      driver.execute.mockResolvedValue({
        rows: [{ version: 'v0.9.2' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith('SELECT version() as version');
      expect(result).toBe('DuckDB v0.9.2');
    });

    it('should return DuckDB without version when row is empty', async () => {
      const driver = makeDriver(DatabaseType.DuckDB);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('DuckDB ');
    });

    it('should return SQL Server version', async () => {
      const driver = makeDriver(DatabaseType.SQLServer);
      driver.execute.mockResolvedValue({
        rows: [{ version: '16.0.1000.6' }],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(driver.execute).toHaveBeenCalledWith("SELECT SERVERPROPERTY('ProductVersion') AS version");
      expect(result).toBe('SQL Server 16.0.1000.6');
    });

    it('should return SQL Server without version when row is empty', async () => {
      const driver = makeDriver(DatabaseType.SQLServer);
      driver.execute.mockResolvedValue({
        rows: [{}],
        columns: [],
        rowCount: 1,
        executionTime: 0,
      });
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('SQL Server ');
    });

    it('should return empty string for unknown database type', async () => {
      const driver = makeDriver('unknown' as DatabaseType);
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('');
    });

    it('should return empty string when execute throws', async () => {
      const driver = makeDriver(DatabaseType.PostgreSQL);
      driver.execute.mockRejectedValue(new Error('Query failed'));
      vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('connection:getServerVersion');
      const result = await handler({ sender: { id: 1 } }, 'conn-1');

      expect(result).toBe('');
    });
  });
});
