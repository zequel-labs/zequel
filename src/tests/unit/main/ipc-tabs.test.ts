import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIpcHandle, mockRun, mockGet, mockPrepare } = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockRun: vi.fn(),
  mockGet: vi.fn(),
  mockPrepare: vi.fn(),
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

vi.mock('@main/services/database', () => ({
  appDatabase: {
    getDatabase: vi.fn(),
  },
}));

import { registerTabHandlers } from '@main/ipc/tabs';
import { appDatabase } from '@main/services/database';

const mockGetDatabase = vi.mocked(appDatabase.getDatabase);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerTabHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    mockPrepare.mockReset();
    mockRun.mockReset();
    mockGet.mockReset();

    mockPrepare.mockReturnValue({ run: mockRun, get: mockGet });
    mockGetDatabase.mockReturnValue({ prepare: mockPrepare } as ReturnType<typeof appDatabase.getDatabase>);

    registerTabHandlers();
  });

  it('should register all tab IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'tabs:save',
      'tabs:load',
      'tabs:delete',
    ]);
  });

  describe('tabs:save', () => {
    it('should insert or update tab session and return true', async () => {
      mockRun.mockReturnValue({ changes: 1 });

      const handler = getHandler('tabs:save');
      const tabsJson = JSON.stringify([{ id: 'tab-1', title: 'Query 1' }]);
      const result = await handler(null, 'conn-1', 'mydb', tabsJson, 'tab-1');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tab_sessions'));
      expect(mockRun).toHaveBeenCalledWith('conn-1', 'mydb', tabsJson, 'tab-1');
      expect(result).toBe(true);
    });

    it('should handle null activeTabId', async () => {
      mockRun.mockReturnValue({ changes: 1 });

      const handler = getHandler('tabs:save');
      const result = await handler(null, 'conn-1', 'mydb', '[]', null);

      expect(mockRun).toHaveBeenCalledWith('conn-1', 'mydb', '[]', null);
      expect(result).toBe(true);
    });

    it('should return false when database operation throws', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const handler = getHandler('tabs:save');
      const result = await handler(null, 'conn-1', 'mydb', '[]', null);

      expect(result).toBe(false);
    });

    it('should handle run throwing an error', async () => {
      mockRun.mockImplementation(() => {
        throw new Error('SQLITE_BUSY');
      });

      const handler = getHandler('tabs:save');
      const result = await handler(null, 'conn-1', 'mydb', '[]', 'tab-1');

      expect(result).toBe(false);
    });

    it('should use ON CONFLICT for upsert behavior', async () => {
      mockRun.mockReturnValue({ changes: 1 });

      const handler = getHandler('tabs:save');
      await handler(null, 'conn-1', 'mydb', '[]', 'tab-1');

      const sql = mockPrepare.mock.calls[0][0] as string;
      expect(sql).toContain('ON CONFLICT(connection_id, database_name)');
      expect(sql).toContain('DO UPDATE SET');
    });
  });

  describe('tabs:load', () => {
    it('should return tab session row when found', async () => {
      const row = {
        connection_id: 'conn-1',
        database_name: 'mydb',
        tabs_json: '[{"id":"tab-1"}]',
        active_tab_id: 'tab-1',
        updated_at: '2024-01-01',
      };
      mockGet.mockReturnValue(row);

      const handler = getHandler('tabs:load');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM tab_sessions'));
      expect(mockGet).toHaveBeenCalledWith('conn-1', 'mydb');
      expect(result).toEqual(row);
    });

    it('should return null when no tab session is found', async () => {
      mockGet.mockReturnValue(undefined);

      const handler = getHandler('tabs:load');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(result).toBeNull();
    });

    it('should return null when database operation throws', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database corrupted');
      });

      const handler = getHandler('tabs:load');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(result).toBeNull();
    });

    it('should return null when get throws an error', async () => {
      mockGet.mockImplementation(() => {
        throw new Error('SQLITE_IOERR');
      });

      const handler = getHandler('tabs:load');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(result).toBeNull();
    });
  });

  describe('tabs:delete', () => {
    it('should delete tab session and return true', async () => {
      mockRun.mockReturnValue({ changes: 1 });

      const handler = getHandler('tabs:delete');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM tab_sessions'));
      expect(mockRun).toHaveBeenCalledWith('conn-1', 'mydb');
      expect(result).toBe(true);
    });

    it('should return true even when no rows are deleted', async () => {
      mockRun.mockReturnValue({ changes: 0 });

      const handler = getHandler('tabs:delete');
      const result = await handler(null, 'conn-1', 'nonexistent-db');

      expect(result).toBe(true);
    });

    it('should return false when database operation throws', async () => {
      mockPrepare.mockImplementation(() => {
        throw new Error('Database locked');
      });

      const handler = getHandler('tabs:delete');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(result).toBe(false);
    });

    it('should return false when run throws an error', async () => {
      mockRun.mockImplementation(() => {
        throw new Error('Constraint violation');
      });

      const handler = getHandler('tabs:delete');
      const result = await handler(null, 'conn-1', 'mydb');

      expect(result).toBe(false);
    });
  });
});
