import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ItemType } from '@/types/table';

// Mock window.api.recents
const mockList = vi.fn();
const mockAdd = vi.fn();
const mockRemove = vi.fn();
const mockClear = vi.fn();
const mockClearForConnection = vi.fn();

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
    recents: {
      list: mockList,
      add: mockAdd,
      remove: mockRemove,
      clear: mockClear,
      clearForConnection: mockClearForConnection,
    },
  },
});

import { useRecentsStore } from '@/stores/recents';
import type { RecentItem } from '@/stores/recents';

const createRecentItem = (overrides: Partial<RecentItem> = {}): RecentItem => ({
  id: 1,
  type: ItemType.Table,
  name: 'users',
  connectionId: 'conn-1',
  database: 'mydb',
  accessedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('Recents Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty items', () => {
      const store = useRecentsStore();
      expect(store.items).toEqual([]);
    });

    it('should start with isLoading false', () => {
      const store = useRecentsStore();
      expect(store.isLoading).toBe(false);
    });
  });

  describe('computed properties', () => {
    it('should filter recentTables', () => {
      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, type: ItemType.Table, name: 'users' }),
        createRecentItem({ id: 2, type: ItemType.Query, name: 'query1' }),
        createRecentItem({ id: 3, type: ItemType.Table, name: 'posts' }),
        createRecentItem({ id: 4, type: ItemType.View, name: 'user_view' }),
      ];

      expect(store.recentTables).toHaveLength(2);
      expect(store.recentTables[0].name).toBe('users');
      expect(store.recentTables[1].name).toBe('posts');
    });

    it('should filter recentQueries', () => {
      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, type: ItemType.Table, name: 'users' }),
        createRecentItem({ id: 2, type: ItemType.Query, name: 'query1', sql: 'SELECT 1' }),
        createRecentItem({ id: 3, type: ItemType.Query, name: 'query2', sql: 'SELECT 2' }),
      ];

      expect(store.recentQueries).toHaveLength(2);
      expect(store.recentQueries[0].name).toBe('query1');
      expect(store.recentQueries[1].name).toBe('query2');
    });

    it('should filter recentViews', () => {
      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, type: ItemType.View, name: 'view1' }),
        createRecentItem({ id: 2, type: ItemType.Table, name: 'users' }),
        createRecentItem({ id: 3, type: ItemType.View, name: 'view2' }),
      ];

      expect(store.recentViews).toHaveLength(2);
      expect(store.recentViews[0].name).toBe('view1');
      expect(store.recentViews[1].name).toBe('view2');
    });

    it('should return empty arrays when no items match', () => {
      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, type: ItemType.Table, name: 'users' }),
      ];

      expect(store.recentQueries).toHaveLength(0);
      expect(store.recentViews).toHaveLength(0);
    });
  });

  describe('loadRecents', () => {
    it('should load recents from the backend', async () => {
      const items = [
        createRecentItem({ id: 1, name: 'users' }),
        createRecentItem({ id: 2, name: 'posts' }),
      ];
      mockList.mockResolvedValueOnce(items);

      const store = useRecentsStore();
      await store.loadRecents();

      expect(mockList).toHaveBeenCalledWith(20);
      expect(store.items).toEqual(items);
      expect(store.isLoading).toBe(false);
    });

    it('should accept custom limit', async () => {
      mockList.mockResolvedValueOnce([]);

      const store = useRecentsStore();
      await store.loadRecents(50);

      expect(mockList).toHaveBeenCalledWith(50);
    });

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: RecentItem[]) => void;
      const promise = new Promise<RecentItem[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockList.mockReturnValueOnce(promise);

      const store = useRecentsStore();
      const loadPromise = store.loadRecents();

      expect(store.isLoading).toBe(true);

      resolvePromise!([]);
      await loadPromise;

      expect(store.isLoading).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockList.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useRecentsStore();
      await store.loadRecents();

      expect(store.isLoading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('addRecentTable', () => {
    it('should add a table recent and reload', async () => {
      mockAdd.mockResolvedValueOnce(undefined);
      mockList.mockResolvedValueOnce([
        createRecentItem({ id: 1, type: ItemType.Table, name: 'users' }),
      ]);

      const store = useRecentsStore();
      await store.addRecentTable('users', 'conn-1', 'mydb', 'public');

      expect(mockAdd).toHaveBeenCalledWith(
        ItemType.Table,
        'users',
        'conn-1',
        'mydb',
        'public',
        undefined,
      );
      expect(mockList).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockAdd.mockRejectedValueOnce(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useRecentsStore();
      await store.addRecentTable('users', 'conn-1');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('addRecentView', () => {
    it('should add a view recent and reload', async () => {
      mockAdd.mockResolvedValueOnce(undefined);
      mockList.mockResolvedValueOnce([
        createRecentItem({ id: 1, type: ItemType.View, name: 'user_view' }),
      ]);

      const store = useRecentsStore();
      await store.addRecentView('user_view', 'conn-1', 'mydb', 'public');

      expect(mockAdd).toHaveBeenCalledWith(
        ItemType.View,
        'user_view',
        'conn-1',
        'mydb',
        'public',
        undefined,
      );
    });
  });

  describe('addRecentQuery', () => {
    it('should add a query recent with SQL and reload', async () => {
      mockAdd.mockResolvedValueOnce(undefined);
      mockList.mockResolvedValueOnce([
        createRecentItem({ id: 1, type: ItemType.Query, name: 'query1', sql: 'SELECT * FROM users' }),
      ]);

      const store = useRecentsStore();
      await store.addRecentQuery('query1', 'SELECT * FROM users', 'conn-1', 'mydb');

      expect(mockAdd).toHaveBeenCalledWith(
        ItemType.Query,
        'query1',
        'conn-1',
        'mydb',
        undefined,
        'SELECT * FROM users',
      );
    });
  });

  describe('removeRecent', () => {
    it('should remove a recent item by id', async () => {
      mockRemove.mockResolvedValueOnce(undefined);

      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, name: 'users' }),
        createRecentItem({ id: 2, name: 'posts' }),
        createRecentItem({ id: 3, name: 'comments' }),
      ];

      await store.removeRecent(2);

      expect(mockRemove).toHaveBeenCalledWith(2);
      expect(store.items).toHaveLength(2);
      expect(store.items.map(i => i.name)).toEqual(['users', 'comments']);
    });

    it('should handle errors gracefully', async () => {
      mockRemove.mockRejectedValueOnce(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useRecentsStore();
      store.items = [createRecentItem({ id: 1 })];

      await store.removeRecent(1);

      // Items are not removed on error (remove happens before catch)
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clearRecents', () => {
    it('should clear all recents', async () => {
      mockClear.mockResolvedValueOnce(undefined);

      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1 }),
        createRecentItem({ id: 2 }),
      ];

      await store.clearRecents();

      expect(mockClear).toHaveBeenCalled();
      expect(store.items).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockClear.mockRejectedValueOnce(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useRecentsStore();
      store.items = [createRecentItem({ id: 1 })];

      await store.clearRecents();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('clearRecentsForConnection', () => {
    it('should clear recents for a specific connection', async () => {
      mockClearForConnection.mockResolvedValueOnce(undefined);

      const store = useRecentsStore();
      store.items = [
        createRecentItem({ id: 1, connectionId: 'conn-1', name: 'users' }),
        createRecentItem({ id: 2, connectionId: 'conn-2', name: 'posts' }),
        createRecentItem({ id: 3, connectionId: 'conn-1', name: 'comments' }),
      ];

      await store.clearRecentsForConnection('conn-1');

      expect(mockClearForConnection).toHaveBeenCalledWith('conn-1');
      expect(store.items).toHaveLength(1);
      expect(store.items[0].connectionId).toBe('conn-2');
    });

    it('should handle errors gracefully', async () => {
      mockClearForConnection.mockRejectedValueOnce(new Error('Failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useRecentsStore();
      store.items = [createRecentItem({ id: 1, connectionId: 'conn-1' })];

      await store.clearRecentsForConnection('conn-1');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
