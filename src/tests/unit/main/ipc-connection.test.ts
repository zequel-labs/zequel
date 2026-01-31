import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType } from '../../../main/types';
import type { ConnectionConfig, SavedConnection } from '../../../main/types';

vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn(),
    },
  };
});

vi.mock('../../../main/db/manager', () => ({
  connectionManager: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    reconnect: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../main/services/connections', () => ({
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

vi.mock('../../../main/services/keychain', () => ({
  keychainService: {
    setPassword: vi.fn().mockResolvedValue(undefined),
    getPassword: vi.fn().mockResolvedValue(null),
    deletePassword: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import { connectionManager } from '../../../main/db/manager';
import { connectionsService } from '../../../main/services/connections';
import { keychainService } from '../../../main/services/keychain';
import { registerConnectionHandlers } from '../../../main/ipc/connection';

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
      const result = await handler({}, 'conn-1');

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(result).toEqual(connection);
    });

    it('should return null when connection is not found', async () => {
      vi.mocked(connectionsService.get).mockReturnValue(undefined as unknown as SavedConnection);

      const handler = getHandler('connection:get');
      const result = await handler({}, 'non-existent');

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
      await handler({}, config);

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
      await handler({}, config);

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
      const result = await handler({}, config);

      expect(result).toEqual(savedConn);
    });
  });

  describe('connection:delete', () => {
    it('should disconnect, delete keychain password, and delete connection', async () => {
      const handler = getHandler('connection:delete');
      const result = await handler({}, 'conn-1');

      expect(connectionManager.disconnect).toHaveBeenCalledWith('conn-1');
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
      const result = await handler({}, config);

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
      await handler({}, config);

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
      const result = await handler({}, config);

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
      const result = await handler({}, config);

      expect(result).toEqual({ success: false, error: 'string error' });
    });
  });

  describe('connection:connect', () => {
    it('should connect using saved connection and keychain password', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');

      const handler = getHandler('connection:connect');
      const result = await handler({}, 'conn-1');

      expect(connectionsService.get).toHaveBeenCalledWith('conn-1');
      expect(keychainService.getPassword).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          password: 'keychain-pass',
        })
      );
      expect(connectionsService.updateLastConnected).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(true);
    });

    it('should throw when connection is not found', async () => {
      vi.mocked(connectionsService.get).mockReturnValue(undefined as unknown as SavedConnection);

      const handler = getHandler('connection:connect');
      await expect(handler({}, 'non-existent')).rejects.toThrow('Connection not found');
    });

    it('should re-throw connection errors', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue(null);
      vi.mocked(connectionManager.connect).mockRejectedValue(new Error('Timeout'));

      const handler = getHandler('connection:connect');
      await expect(handler({}, 'conn-1')).rejects.toThrow('Timeout');
    });
  });

  describe('connection:disconnect', () => {
    it('should disconnect the connection', async () => {
      const handler = getHandler('connection:disconnect');
      await handler({}, 'conn-1');

      expect(connectionManager.disconnect).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('connection:reconnect', () => {
    it('should reconnect the connection', async () => {
      const handler = getHandler('connection:reconnect');
      await handler({}, 'conn-1');

      expect(connectionManager.reconnect).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('connection:updateFolder', () => {
    it('should update the folder and return true', async () => {
      const handler = getHandler('connection:updateFolder');
      const result = await handler({}, 'conn-1', 'Production');

      expect(connectionsService.updateFolder).toHaveBeenCalledWith('conn-1', 'Production');
      expect(result).toBe(true);
    });

    it('should accept null to remove folder', async () => {
      const handler = getHandler('connection:updateFolder');
      const result = await handler({}, 'conn-1', null);

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
      const result = await handler({}, 'OldName', 'NewName');

      expect(connectionsService.renameFolder).toHaveBeenCalledWith('OldName', 'NewName');
      expect(result).toBe(true);
    });
  });

  describe('connection:deleteFolder', () => {
    it('should delete folder and return true', async () => {
      const handler = getHandler('connection:deleteFolder');
      const result = await handler({}, 'Production');

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
      const result = await handler({}, positions);

      expect(connectionsService.updatePositions).toHaveBeenCalledWith(positions);
      expect(result).toBe(true);
    });
  });

  describe('connection:connectWithDatabase', () => {
    it('should disconnect, then reconnect to a different database', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue('keychain-pass');
      vi.mocked(connectionManager.connect).mockResolvedValue(undefined);

      const handler = getHandler('connection:connectWithDatabase');
      const result = await handler({}, 'conn-1', 'other_db');

      expect(connectionManager.disconnect).toHaveBeenCalledWith('conn-1');
      expect(connectionManager.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'conn-1',
          database: 'other_db',
          password: 'keychain-pass',
        })
      );
      expect(result).toBe(true);
    });

    it('should throw when connection is not found', async () => {
      vi.mocked(connectionsService.get).mockReturnValue(undefined as unknown as SavedConnection);

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({}, 'non-existent', 'db')).rejects.toThrow('Connection not found');
    });

    it('should re-throw connection errors', async () => {
      const saved = makeSavedConnection();
      vi.mocked(connectionsService.get).mockReturnValue(saved);
      vi.mocked(keychainService.getPassword).mockResolvedValue(null);
      vi.mocked(connectionManager.connect).mockRejectedValue(new Error('DNS resolution failed'));

      const handler = getHandler('connection:connectWithDatabase');
      await expect(handler({}, 'conn-1', 'otherdb')).rejects.toThrow('DNS resolution failed');
    });
  });
});
