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

vi.mock('@main/services/bookmarks', () => ({
  bookmarksService: {
    addBookmark: vi.fn(),
    getBookmarks: vi.fn(),
    getBookmarksByType: vi.fn(),
    getFolders: vi.fn(),
    updateBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    isBookmarked: vi.fn(),
    clearBookmarks: vi.fn(),
  },
}));

import { registerBookmarkHandlers } from '@main/ipc/bookmarks';
import { bookmarksService } from '@main/services/bookmarks';

const mockBookmarksService = vi.mocked(bookmarksService);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerBookmarkHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerBookmarkHandlers();
  });

  it('should register all bookmark IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'bookmarks:add',
      'bookmarks:list',
      'bookmarks:listByType',
      'bookmarks:folders',
      'bookmarks:update',
      'bookmarks:remove',
      'bookmarks:isBookmarked',
      'bookmarks:clear',
    ]);
  });

  describe('bookmarks:add', () => {
    it('should call addBookmark with all parameters', async () => {
      const bookmark = { id: 1, type: 'table', name: 'users', connectionId: 'conn-1', createdAt: '2024-01-01' };
      mockBookmarksService.addBookmark.mockReturnValue(bookmark as ReturnType<typeof bookmarksService.addBookmark>);

      const handler = getHandler('bookmarks:add');
      const result = await handler(null, 'table', 'users', 'conn-1', 'mydb', 'public', undefined, 'Favorites');

      expect(mockBookmarksService.addBookmark).toHaveBeenCalledWith(
        'table', 'users', 'conn-1', 'mydb', 'public', undefined, 'Favorites'
      );
      expect(result).toEqual(bookmark);
    });

    it('should call addBookmark without optional parameters', async () => {
      const bookmark = { id: 2, type: 'query', name: 'My Query', connectionId: 'conn-1', createdAt: '2024-01-01' };
      mockBookmarksService.addBookmark.mockReturnValue(bookmark as ReturnType<typeof bookmarksService.addBookmark>);

      const handler = getHandler('bookmarks:add');
      await handler(null, 'query', 'My Query', 'conn-1');

      expect(mockBookmarksService.addBookmark).toHaveBeenCalledWith(
        'query', 'My Query', 'conn-1', undefined, undefined, undefined, undefined
      );
    });
  });

  describe('bookmarks:list', () => {
    it('should call getBookmarks with connectionId', async () => {
      const bookmarks = [{ id: 1, name: 'users' }];
      mockBookmarksService.getBookmarks.mockReturnValue(bookmarks as ReturnType<typeof bookmarksService.getBookmarks>);

      const handler = getHandler('bookmarks:list');
      const result = await handler(null, 'conn-1');

      expect(mockBookmarksService.getBookmarks).toHaveBeenCalledWith('conn-1');
      expect(result).toEqual(bookmarks);
    });

    it('should call getBookmarks without connectionId', async () => {
      mockBookmarksService.getBookmarks.mockReturnValue([]);

      const handler = getHandler('bookmarks:list');
      await handler(null);

      expect(mockBookmarksService.getBookmarks).toHaveBeenCalledWith(undefined);
    });
  });

  describe('bookmarks:listByType', () => {
    it('should call getBookmarksByType with type and connectionId', async () => {
      const bookmarks = [{ id: 1, type: 'table', name: 'users' }];
      mockBookmarksService.getBookmarksByType.mockReturnValue(bookmarks as ReturnType<typeof bookmarksService.getBookmarksByType>);

      const handler = getHandler('bookmarks:listByType');
      const result = await handler(null, 'table', 'conn-1');

      expect(mockBookmarksService.getBookmarksByType).toHaveBeenCalledWith('table', 'conn-1');
      expect(result).toEqual(bookmarks);
    });

    it('should call getBookmarksByType without connectionId', async () => {
      mockBookmarksService.getBookmarksByType.mockReturnValue([]);

      const handler = getHandler('bookmarks:listByType');
      await handler(null, 'view');

      expect(mockBookmarksService.getBookmarksByType).toHaveBeenCalledWith('view', undefined);
    });
  });

  describe('bookmarks:folders', () => {
    it('should call getFolders with connectionId', async () => {
      const folders = ['Favorites', 'Reports'];
      mockBookmarksService.getFolders.mockReturnValue(folders);

      const handler = getHandler('bookmarks:folders');
      const result = await handler(null, 'conn-1');

      expect(mockBookmarksService.getFolders).toHaveBeenCalledWith('conn-1');
      expect(result).toEqual(folders);
    });

    it('should call getFolders without connectionId', async () => {
      mockBookmarksService.getFolders.mockReturnValue([]);

      const handler = getHandler('bookmarks:folders');
      await handler(null);

      expect(mockBookmarksService.getFolders).toHaveBeenCalledWith(undefined);
    });
  });

  describe('bookmarks:update', () => {
    it('should call updateBookmark with id and updates', async () => {
      const updated = { id: 1, name: 'New Name', type: 'table', connectionId: 'conn-1', createdAt: '2024-01-01' };
      mockBookmarksService.updateBookmark.mockReturnValue(updated as ReturnType<typeof bookmarksService.updateBookmark>);

      const handler = getHandler('bookmarks:update');
      const result = await handler(null, 1, { name: 'New Name' });

      expect(mockBookmarksService.updateBookmark).toHaveBeenCalledWith(1, { name: 'New Name' });
      expect(result).toEqual(updated);
    });

    it('should call updateBookmark with multiple fields', async () => {
      const updates = { name: 'New Name', folder: 'Reports', sql: 'SELECT 1' };
      mockBookmarksService.updateBookmark.mockReturnValue(null);

      const handler = getHandler('bookmarks:update');
      await handler(null, 5, updates);

      expect(mockBookmarksService.updateBookmark).toHaveBeenCalledWith(5, updates);
    });
  });

  describe('bookmarks:remove', () => {
    it('should call removeBookmark with id', async () => {
      mockBookmarksService.removeBookmark.mockReturnValue(true);

      const handler = getHandler('bookmarks:remove');
      const result = await handler(null, 1);

      expect(mockBookmarksService.removeBookmark).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should return false when bookmark does not exist', async () => {
      mockBookmarksService.removeBookmark.mockReturnValue(false);

      const handler = getHandler('bookmarks:remove');
      const result = await handler(null, 999);

      expect(result).toBe(false);
    });
  });

  describe('bookmarks:isBookmarked', () => {
    it('should call isBookmarked and return true when bookmarked', async () => {
      mockBookmarksService.isBookmarked.mockReturnValue(true);

      const handler = getHandler('bookmarks:isBookmarked');
      const result = await handler(null, 'table', 'users', 'conn-1');

      expect(mockBookmarksService.isBookmarked).toHaveBeenCalledWith('table', 'users', 'conn-1');
      expect(result).toBe(true);
    });

    it('should call isBookmarked and return false when not bookmarked', async () => {
      mockBookmarksService.isBookmarked.mockReturnValue(false);

      const handler = getHandler('bookmarks:isBookmarked');
      const result = await handler(null, 'table', 'orders', 'conn-1');

      expect(result).toBe(false);
    });
  });

  describe('bookmarks:clear', () => {
    it('should call clearBookmarks with connectionId', async () => {
      mockBookmarksService.clearBookmarks.mockReturnValue(5);

      const handler = getHandler('bookmarks:clear');
      const result = await handler(null, 'conn-1');

      expect(mockBookmarksService.clearBookmarks).toHaveBeenCalledWith('conn-1');
      expect(result).toBe(5);
    });

    it('should call clearBookmarks without connectionId to clear all', async () => {
      mockBookmarksService.clearBookmarks.mockReturnValue(10);

      const handler = getHandler('bookmarks:clear');
      const result = await handler(null);

      expect(mockBookmarksService.clearBookmarks).toHaveBeenCalledWith(undefined);
      expect(result).toBe(10);
    });
  });
});
