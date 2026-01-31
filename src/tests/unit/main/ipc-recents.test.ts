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

vi.mock('@main/services/recents', () => ({
  recentsService: {
    addRecent: vi.fn(),
    getRecents: vi.fn(),
    getRecentsByConnection: vi.fn(),
    getRecentsByType: vi.fn(),
    removeRecent: vi.fn(),
    clearRecents: vi.fn(),
    clearRecentsForConnection: vi.fn(),
  },
}));

import { registerRecentsHandlers } from '@main/ipc/recents';
import { recentsService } from '@main/services/recents';

const mockRecentsService = vi.mocked(recentsService);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerRecentsHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerRecentsHandlers();
  });

  it('should register all recents IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'recents:add',
      'recents:list',
      'recents:listByConnection',
      'recents:listByType',
      'recents:remove',
      'recents:clear',
      'recents:clearForConnection',
    ]);
  });

  describe('recents:add', () => {
    it('should call addRecent with all parameters', async () => {
      const recent = {
        id: 1,
        type: 'table',
        name: 'users',
        connectionId: 'conn-1',
        database: 'mydb',
        schema: 'public',
        accessedAt: '2024-01-01',
      };
      mockRecentsService.addRecent.mockReturnValue(recent as ReturnType<typeof recentsService.addRecent>);

      const handler = getHandler('recents:add');
      const result = await handler(null, 'table', 'users', 'conn-1', 'mydb', 'public', 'SELECT * FROM users');

      expect(mockRecentsService.addRecent).toHaveBeenCalledWith(
        'table', 'users', 'conn-1', 'mydb', 'public', 'SELECT * FROM users'
      );
      expect(result).toEqual(recent);
    });

    it('should call addRecent without optional parameters', async () => {
      const recent = { id: 2, type: 'table', name: 'orders', connectionId: 'conn-1', accessedAt: '2024-01-01' };
      mockRecentsService.addRecent.mockReturnValue(recent as ReturnType<typeof recentsService.addRecent>);

      const handler = getHandler('recents:add');
      await handler(null, 'table', 'orders', 'conn-1');

      expect(mockRecentsService.addRecent).toHaveBeenCalledWith(
        'table', 'orders', 'conn-1', undefined, undefined, undefined
      );
    });
  });

  describe('recents:list', () => {
    it('should call getRecents with limit', async () => {
      const recents = [{ id: 1, type: 'table', name: 'users' }];
      mockRecentsService.getRecents.mockReturnValue(recents as ReturnType<typeof recentsService.getRecents>);

      const handler = getHandler('recents:list');
      const result = await handler(null, 10);

      expect(mockRecentsService.getRecents).toHaveBeenCalledWith(10);
      expect(result).toEqual(recents);
    });

    it('should call getRecents without limit', async () => {
      mockRecentsService.getRecents.mockReturnValue([]);

      const handler = getHandler('recents:list');
      await handler(null);

      expect(mockRecentsService.getRecents).toHaveBeenCalledWith(undefined);
    });
  });

  describe('recents:listByConnection', () => {
    it('should call getRecentsByConnection with connectionId and limit', async () => {
      const recents = [{ id: 1, type: 'table', name: 'users', connectionId: 'conn-1' }];
      mockRecentsService.getRecentsByConnection.mockReturnValue(recents as ReturnType<typeof recentsService.getRecentsByConnection>);

      const handler = getHandler('recents:listByConnection');
      const result = await handler(null, 'conn-1', 15);

      expect(mockRecentsService.getRecentsByConnection).toHaveBeenCalledWith('conn-1', 15);
      expect(result).toEqual(recents);
    });

    it('should call getRecentsByConnection without limit', async () => {
      mockRecentsService.getRecentsByConnection.mockReturnValue([]);

      const handler = getHandler('recents:listByConnection');
      await handler(null, 'conn-1');

      expect(mockRecentsService.getRecentsByConnection).toHaveBeenCalledWith('conn-1', undefined);
    });
  });

  describe('recents:listByType', () => {
    it('should call getRecentsByType with type and limit', async () => {
      const recents = [{ id: 1, type: 'view', name: 'user_stats' }];
      mockRecentsService.getRecentsByType.mockReturnValue(recents as ReturnType<typeof recentsService.getRecentsByType>);

      const handler = getHandler('recents:listByType');
      const result = await handler(null, 'view', 5);

      expect(mockRecentsService.getRecentsByType).toHaveBeenCalledWith('view', 5);
      expect(result).toEqual(recents);
    });

    it('should call getRecentsByType without limit', async () => {
      mockRecentsService.getRecentsByType.mockReturnValue([]);

      const handler = getHandler('recents:listByType');
      await handler(null, 'query');

      expect(mockRecentsService.getRecentsByType).toHaveBeenCalledWith('query', undefined);
    });
  });

  describe('recents:remove', () => {
    it('should call removeRecent and return true on success', async () => {
      mockRecentsService.removeRecent.mockReturnValue(true);

      const handler = getHandler('recents:remove');
      const result = await handler(null, 1);

      expect(mockRecentsService.removeRecent).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should return false when item does not exist', async () => {
      mockRecentsService.removeRecent.mockReturnValue(false);

      const handler = getHandler('recents:remove');
      const result = await handler(null, 999);

      expect(result).toBe(false);
    });
  });

  describe('recents:clear', () => {
    it('should call clearRecents and return count', async () => {
      mockRecentsService.clearRecents.mockReturnValue(15);

      const handler = getHandler('recents:clear');
      const result = await handler(null);

      expect(mockRecentsService.clearRecents).toHaveBeenCalled();
      expect(result).toBe(15);
    });
  });

  describe('recents:clearForConnection', () => {
    it('should call clearRecentsForConnection with connectionId', async () => {
      mockRecentsService.clearRecentsForConnection.mockReturnValue(5);

      const handler = getHandler('recents:clearForConnection');
      const result = await handler(null, 'conn-1');

      expect(mockRecentsService.clearRecentsForConnection).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(5);
    });
  });
});
