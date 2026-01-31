import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIpcHandle } = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
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

vi.mock('@main/services/queryHistory', () => ({
  queryHistoryService: {
    getHistory: vi.fn(),
    getAllHistory: vi.fn(),
    addToHistory: vi.fn(),
    clearHistory: vi.fn(),
    deleteHistoryItem: vi.fn(),
    listSavedQueries: vi.fn(),
    getSavedQuery: vi.fn(),
    saveQuery: vi.fn(),
    updateSavedQuery: vi.fn(),
    deleteSavedQuery: vi.fn(),
  },
}));

import { registerHistoryHandlers } from '@main/ipc/history';
import { queryHistoryService } from '@main/services/queryHistory';

const mockHistoryService = vi.mocked(queryHistoryService);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerHistoryHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerHistoryHandlers();
  });

  it('should register all history and saved queries IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'history:list',
      'history:add',
      'history:clear',
      'history:delete',
      'savedQueries:list',
      'savedQueries:get',
      'savedQueries:save',
      'savedQueries:update',
      'savedQueries:delete',
    ]);
  });

  describe('history:list', () => {
    it('should call getHistory when connectionId is provided', async () => {
      const items = [{ id: 1, connectionId: 'conn-1', sql: 'SELECT 1', executedAt: '2024-01-01' }];
      mockHistoryService.getHistory.mockReturnValue(items as ReturnType<typeof queryHistoryService.getHistory>);

      const handler = getHandler('history:list');
      const result = await handler(null, 'conn-1', 50, 0);

      expect(mockHistoryService.getHistory).toHaveBeenCalledWith('conn-1', 50, 0);
      expect(mockHistoryService.getAllHistory).not.toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it('should call getAllHistory when connectionId is not provided', async () => {
      const items = [{ id: 1, connectionId: 'conn-1', sql: 'SELECT 1', executedAt: '2024-01-01' }];
      mockHistoryService.getAllHistory.mockReturnValue(items as ReturnType<typeof queryHistoryService.getAllHistory>);

      const handler = getHandler('history:list');
      const result = await handler(null, undefined, 100, 0);

      expect(mockHistoryService.getAllHistory).toHaveBeenCalledWith(100, 0);
      expect(mockHistoryService.getHistory).not.toHaveBeenCalled();
      expect(result).toEqual(items);
    });

    it('should pass undefined limit and offset to getAllHistory', async () => {
      mockHistoryService.getAllHistory.mockReturnValue([]);

      const handler = getHandler('history:list');
      await handler(null);

      expect(mockHistoryService.getAllHistory).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('history:add', () => {
    it('should call addToHistory with all parameters', async () => {
      const item = {
        id: 1,
        connectionId: 'conn-1',
        sql: 'SELECT * FROM users',
        executionTime: 150,
        rowCount: 42,
        error: undefined,
        executedAt: '2024-01-01',
      };
      mockHistoryService.addToHistory.mockReturnValue(item as ReturnType<typeof queryHistoryService.addToHistory>);

      const handler = getHandler('history:add');
      const result = await handler(null, 'conn-1', 'SELECT * FROM users', 150, 42, undefined);

      expect(mockHistoryService.addToHistory).toHaveBeenCalledWith(
        'conn-1', 'SELECT * FROM users', 150, 42, undefined
      );
      expect(result).toEqual(item);
    });

    it('should call addToHistory with error', async () => {
      const item = {
        id: 2,
        connectionId: 'conn-1',
        sql: 'INVALID SQL',
        error: 'Syntax error',
        executedAt: '2024-01-01',
      };
      mockHistoryService.addToHistory.mockReturnValue(item as ReturnType<typeof queryHistoryService.addToHistory>);

      const handler = getHandler('history:add');
      await handler(null, 'conn-1', 'INVALID SQL', undefined, undefined, 'Syntax error');

      expect(mockHistoryService.addToHistory).toHaveBeenCalledWith(
        'conn-1', 'INVALID SQL', undefined, undefined, 'Syntax error'
      );
    });
  });

  describe('history:clear', () => {
    it('should call clearHistory with connectionId', async () => {
      mockHistoryService.clearHistory.mockReturnValue(10);

      const handler = getHandler('history:clear');
      const result = await handler(null, 'conn-1');

      expect(mockHistoryService.clearHistory).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(10);
    });

    it('should call clearHistory without connectionId to clear all', async () => {
      mockHistoryService.clearHistory.mockReturnValue(25);

      const handler = getHandler('history:clear');
      const result = await handler(null);

      expect(mockHistoryService.clearHistory).toHaveBeenCalledWith(undefined);
      expect(result).toBe(25);
    });
  });

  describe('history:delete', () => {
    it('should call deleteHistoryItem and return true on success', async () => {
      mockHistoryService.deleteHistoryItem.mockReturnValue(true);

      const handler = getHandler('history:delete');
      const result = await handler(null, 5);

      expect(mockHistoryService.deleteHistoryItem).toHaveBeenCalledWith(5);
      expect(result).toBe(true);
    });

    it('should return false when item does not exist', async () => {
      mockHistoryService.deleteHistoryItem.mockReturnValue(false);

      const handler = getHandler('history:delete');
      const result = await handler(null, 999);

      expect(result).toBe(false);
    });
  });

  describe('savedQueries:list', () => {
    it('should call listSavedQueries with connectionId', async () => {
      const queries = [{ id: 1, name: 'My Query', sql: 'SELECT 1' }];
      mockHistoryService.listSavedQueries.mockReturnValue(queries as ReturnType<typeof queryHistoryService.listSavedQueries>);

      const handler = getHandler('savedQueries:list');
      const result = await handler(null, 'conn-1');

      expect(mockHistoryService.listSavedQueries).toHaveBeenCalledWith('conn-1');
      expect(result).toEqual(queries);
    });

    it('should call listSavedQueries without connectionId', async () => {
      mockHistoryService.listSavedQueries.mockReturnValue([]);

      const handler = getHandler('savedQueries:list');
      await handler(null);

      expect(mockHistoryService.listSavedQueries).toHaveBeenCalledWith(undefined);
    });
  });

  describe('savedQueries:get', () => {
    it('should call getSavedQuery with id', async () => {
      const query = { id: 1, name: 'My Query', sql: 'SELECT 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      mockHistoryService.getSavedQuery.mockReturnValue(query as ReturnType<typeof queryHistoryService.getSavedQuery>);

      const handler = getHandler('savedQueries:get');
      const result = await handler(null, 1);

      expect(mockHistoryService.getSavedQuery).toHaveBeenCalledWith(1);
      expect(result).toEqual(query);
    });

    it('should return null when query does not exist', async () => {
      mockHistoryService.getSavedQuery.mockReturnValue(null);

      const handler = getHandler('savedQueries:get');
      const result = await handler(null, 999);

      expect(result).toBeNull();
    });
  });

  describe('savedQueries:save', () => {
    it('should call saveQuery with all parameters', async () => {
      const saved = {
        id: 1,
        name: 'My Query',
        sql: 'SELECT * FROM users',
        connectionId: 'conn-1',
        description: 'Fetches all users',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      mockHistoryService.saveQuery.mockReturnValue(saved as ReturnType<typeof queryHistoryService.saveQuery>);

      const handler = getHandler('savedQueries:save');
      const result = await handler(null, 'My Query', 'SELECT * FROM users', 'conn-1', 'Fetches all users');

      expect(mockHistoryService.saveQuery).toHaveBeenCalledWith(
        'My Query', 'SELECT * FROM users', 'conn-1', 'Fetches all users'
      );
      expect(result).toEqual(saved);
    });

    it('should call saveQuery without optional parameters', async () => {
      const saved = { id: 2, name: 'Quick Query', sql: 'SELECT 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' };
      mockHistoryService.saveQuery.mockReturnValue(saved as ReturnType<typeof queryHistoryService.saveQuery>);

      const handler = getHandler('savedQueries:save');
      await handler(null, 'Quick Query', 'SELECT 1');

      expect(mockHistoryService.saveQuery).toHaveBeenCalledWith(
        'Quick Query', 'SELECT 1', undefined, undefined
      );
    });
  });

  describe('savedQueries:update', () => {
    it('should call updateSavedQuery with id and updates', async () => {
      const updated = { id: 1, name: 'Updated', sql: 'SELECT 2', createdAt: '2024-01-01', updatedAt: '2024-01-02' };
      mockHistoryService.updateSavedQuery.mockReturnValue(updated as ReturnType<typeof queryHistoryService.updateSavedQuery>);

      const handler = getHandler('savedQueries:update');
      const result = await handler(null, 1, { name: 'Updated', sql: 'SELECT 2' });

      expect(mockHistoryService.updateSavedQuery).toHaveBeenCalledWith(1, { name: 'Updated', sql: 'SELECT 2' });
      expect(result).toEqual(updated);
    });

    it('should return null when query to update does not exist', async () => {
      mockHistoryService.updateSavedQuery.mockReturnValue(null);

      const handler = getHandler('savedQueries:update');
      const result = await handler(null, 999, { name: 'New Name' });

      expect(result).toBeNull();
    });
  });

  describe('savedQueries:delete', () => {
    it('should call deleteSavedQuery and return true on success', async () => {
      mockHistoryService.deleteSavedQuery.mockReturnValue(true);

      const handler = getHandler('savedQueries:delete');
      const result = await handler(null, 1);

      expect(mockHistoryService.deleteSavedQuery).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should return false when query does not exist', async () => {
      mockHistoryService.deleteSavedQuery.mockReturnValue(false);

      const handler = getHandler('savedQueries:delete');
      const result = await handler(null, 999);

      expect(result).toBe(false);
    });
  });
});
