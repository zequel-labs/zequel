import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ItemType } from '@main/types';
import type { RecentItem } from '@main/services/recents';

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Create mock statement helpers
const mockRun = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));

// Mock appDatabase
vi.mock('@main/services/database', () => ({
  appDatabase: {
    getDatabase: vi.fn(() => ({
      prepare: mockPrepare,
    })),
  },
}));

import { RecentsService, recentsService } from '@main/services/recents';
import { logger } from '@main/utils/logger';

const createRecentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'table',
  name: 'users',
  connection_id: 'conn-1',
  database: 'mydb',
  schema: 'public',
  sql: null,
  accessed_at: '2024-01-15T10:30:00.000Z',
  ...overrides,
});

describe('RecentsService', () => {
  let service: RecentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RecentsService();
    mockGet.mockReturnValue(undefined);
  });

  describe('addRecent', () => {
    it('should insert a new recent item when no existing entry', () => {
      // First query: check existing -> not found
      mockGet.mockReturnValueOnce(undefined);
      // INSERT run
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 5 });
      // getRecent after insert
      mockGet.mockReturnValueOnce(createRecentRow({ id: 5 }));
      // cleanup query run
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.addRecent(ItemType.Table, 'users', 'conn-1', 'mydb', 'public');

      expect(result.id).toBe(5);
      expect(result.name).toBe('users');
      expect(result.type).toBe('table');
    });

    it('should update accessed_at when entry already exists', () => {
      // First query: check existing -> found
      mockGet.mockReturnValueOnce({ id: 3 });
      // UPDATE run
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      // getRecent after update
      mockGet.mockReturnValueOnce(createRecentRow({ id: 3 }));

      const result = service.addRecent(ItemType.Table, 'users', 'conn-1');

      expect(result.id).toBe(3);
    });

    it('should pass sql parameter for query type', () => {
      mockGet.mockReturnValueOnce(undefined);
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createRecentRow({ type: 'query', sql: 'SELECT 1' }));
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.addRecent(
        ItemType.Query,
        'My Query',
        'conn-1',
        'mydb',
        'public',
        'SELECT 1'
      );

      expect(result.type).toBe('query');
    });

    it('should pass null for optional parameters when not provided', () => {
      mockGet.mockReturnValueOnce(undefined);
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createRecentRow());
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      service.addRecent(ItemType.Table, 'users', 'conn-1');

      // The INSERT run call should have null for database, schema, sql
      const insertRunCalls = mockRun.mock.calls.filter(
        (args: unknown[]) => args.length === 6
      );
      if (insertRunCalls.length > 0) {
        const call = insertRunCalls[0];
        expect(call[3]).toBeNull(); // database
        expect(call[4]).toBeNull(); // schema
        expect(call[5]).toBeNull(); // sql
      }
    });

    it('should update sql on existing record via COALESCE', () => {
      mockGet.mockReturnValueOnce({ id: 2 });
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      mockGet.mockReturnValueOnce(createRecentRow({ id: 2, sql: 'SELECT 1' }));

      service.addRecent(ItemType.Query, 'My Query', 'conn-1', undefined, undefined, 'SELECT 1');

      // The UPDATE run should pass 'SELECT 1' and the existing id
      expect(mockRun).toHaveBeenCalledWith('SELECT 1', 2);
    });

    it('should pass null sql when updating existing without new sql', () => {
      mockGet.mockReturnValueOnce({ id: 2 });
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      mockGet.mockReturnValueOnce(createRecentRow({ id: 2 }));

      service.addRecent(ItemType.Table, 'users', 'conn-1');

      expect(mockRun).toHaveBeenCalledWith(null, 2);
    });

    it('should call cleanup after inserting a new record', () => {
      mockGet.mockReturnValueOnce(undefined);
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createRecentRow());
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      service.addRecent(ItemType.Table, 'users', 'conn-1');

      // cleanup is called via prepare().run(MAX_RECENTS)
      // Check that prepare was called with the DELETE cleanup SQL
      const prepareCalls = mockPrepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const cleanupCall = prepareCalls.find((sql: string) =>
        sql.includes('DELETE FROM recents') && sql.includes('NOT IN')
      );
      expect(cleanupCall).toBeDefined();
    });

    it('should NOT call cleanup when updating an existing record', () => {
      mockGet.mockReturnValueOnce({ id: 1 });
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });
      mockGet.mockReturnValueOnce(createRecentRow());

      service.addRecent(ItemType.Table, 'users', 'conn-1');

      // cleanup should not be called
      const prepareCalls = mockPrepare.mock.calls.map((c: unknown[]) => c[0] as string);
      const cleanupCall = prepareCalls.find((sql: string) =>
        sql.includes('DELETE FROM recents') && sql.includes('NOT IN')
      );
      expect(cleanupCall).toBeUndefined();
    });

    it('should log when a new recent item is added', () => {
      mockGet.mockReturnValueOnce(undefined);
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createRecentRow());
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      service.addRecent(ItemType.Table, 'users', 'conn-1');

      expect(logger.debug).toHaveBeenCalledWith('Recent item added', {
        type: ItemType.Table,
        name: 'users',
        connectionId: 'conn-1',
      });
    });
  });

  describe('getRecent', () => {
    it('should return a recent item by id', () => {
      mockGet.mockReturnValueOnce(createRecentRow({ id: 10 }));

      const result = service.getRecent(10);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(10);
      expect(result!.name).toBe('users');
      expect(result!.connectionId).toBe('conn-1');
    });

    it('should return null when not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = service.getRecent(999);

      expect(result).toBeNull();
    });

    it('should pass the id to the query', () => {
      mockGet.mockReturnValueOnce(undefined);

      service.getRecent(42);

      expect(mockGet).toHaveBeenCalledWith(42);
    });

    it('should map optional fields to undefined when null', () => {
      mockGet.mockReturnValueOnce(createRecentRow({
        database: null,
        schema: null,
        sql: null,
      }));

      const result = service.getRecent(1);

      expect(result!.database).toBeUndefined();
      expect(result!.schema).toBeUndefined();
      expect(result!.sql).toBeUndefined();
    });

    it('should map optional fields when present', () => {
      mockGet.mockReturnValueOnce(createRecentRow({
        database: 'mydb',
        schema: 'public',
        sql: 'SELECT 1',
      }));

      const result = service.getRecent(1);

      expect(result!.database).toBe('mydb');
      expect(result!.schema).toBe('public');
      expect(result!.sql).toBe('SELECT 1');
    });
  });

  describe('getRecents', () => {
    it('should return recent items with default limit of 20', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ id: 1 }),
        createRecentRow({ id: 2, name: 'orders' }),
      ]);

      const result = service.getRecents();

      expect(result).toHaveLength(2);
      expect(mockAll).toHaveBeenCalledWith(20);
    });

    it('should accept custom limit', () => {
      mockAll.mockReturnValueOnce([]);

      service.getRecents(5);

      expect(mockAll).toHaveBeenCalledWith(5);
    });

    it('should return empty array when no recents exist', () => {
      mockAll.mockReturnValueOnce([]);

      const result = service.getRecents();

      expect(result).toEqual([]);
    });

    it('should map all rows correctly', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ id: 1, type: 'table', name: 'users' }),
        createRecentRow({ id: 2, type: 'view', name: 'user_stats' }),
        createRecentRow({ id: 3, type: 'query', name: 'Active Users', sql: 'SELECT * FROM users WHERE active' }),
      ]);

      const result = service.getRecents();

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('table');
      expect(result[1].type).toBe('view');
      expect(result[2].type).toBe('query');
      expect(result[2].sql).toBe('SELECT * FROM users WHERE active');
    });
  });

  describe('getRecentsByConnection', () => {
    it('should return recents for a specific connection', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ connection_id: 'conn-1' }),
      ]);

      const result = service.getRecentsByConnection('conn-1');

      expect(result).toHaveLength(1);
      expect(result[0].connectionId).toBe('conn-1');
    });

    it('should pass connectionId and limit to query', () => {
      mockAll.mockReturnValueOnce([]);

      service.getRecentsByConnection('conn-2', 10);

      expect(mockAll).toHaveBeenCalledWith('conn-2', 10);
    });

    it('should use default limit of 20', () => {
      mockAll.mockReturnValueOnce([]);

      service.getRecentsByConnection('conn-1');

      expect(mockAll).toHaveBeenCalledWith('conn-1', 20);
    });
  });

  describe('getRecentsByType', () => {
    it('should return recents filtered by type', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ type: 'view', name: 'user_stats' }),
        createRecentRow({ type: 'view', name: 'order_summary' }),
      ]);

      const result = service.getRecentsByType(ItemType.View);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('view');
    });

    it('should pass type and limit to query', () => {
      mockAll.mockReturnValueOnce([]);

      service.getRecentsByType(ItemType.Query, 5);

      expect(mockAll).toHaveBeenCalledWith(ItemType.Query, 5);
    });

    it('should use default limit of 20', () => {
      mockAll.mockReturnValueOnce([]);

      service.getRecentsByType(ItemType.Table);

      expect(mockAll).toHaveBeenCalledWith(ItemType.Table, 20);
    });
  });

  describe('removeRecent', () => {
    it('should return true when item was removed', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      const result = service.removeRecent(1);

      expect(result).toBe(true);
    });

    it('should return false when item was not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.removeRecent(999);

      expect(result).toBe(false);
    });

    it('should pass the id to the DELETE query', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      service.removeRecent(42);

      expect(mockRun).toHaveBeenCalledWith(42);
    });
  });

  describe('clearRecents', () => {
    it('should delete all recents and return count', () => {
      mockRun.mockReturnValueOnce({ changes: 15, lastInsertRowid: 0 });

      const result = service.clearRecents();

      expect(result).toBe(15);
    });

    it('should return 0 when no recents exist', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.clearRecents();

      expect(result).toBe(0);
    });

    it('should log the clearing', () => {
      mockRun.mockReturnValueOnce({ changes: 5, lastInsertRowid: 0 });

      service.clearRecents();

      expect(logger.debug).toHaveBeenCalledWith('All recents cleared', { deleted: 5 });
    });
  });

  describe('clearRecentsForConnection', () => {
    it('should delete recents for a specific connection', () => {
      mockRun.mockReturnValueOnce({ changes: 3, lastInsertRowid: 0 });

      const result = service.clearRecentsForConnection('conn-1');

      expect(result).toBe(3);
      expect(mockRun).toHaveBeenCalledWith('conn-1');
    });

    it('should return 0 when no recents for that connection', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.clearRecentsForConnection('conn-none');

      expect(result).toBe(0);
    });

    it('should log the clearing with connection id', () => {
      mockRun.mockReturnValueOnce({ changes: 2, lastInsertRowid: 0 });

      service.clearRecentsForConnection('conn-1');

      expect(logger.debug).toHaveBeenCalledWith('Recents cleared for connection', {
        connectionId: 'conn-1',
        deleted: 2,
      });
    });
  });

  describe('row mapping', () => {
    it('should map all fields from database row to RecentItem', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({
          id: 100,
          type: 'query',
          name: 'My Report',
          connection_id: 'conn-x',
          database: 'analytics',
          schema: 'reporting',
          sql: 'SELECT COUNT(*) FROM orders',
          accessed_at: '2024-06-15T08:00:00Z',
        }),
      ]);

      const result = service.getRecents();

      expect(result[0]).toEqual({
        id: 100,
        type: 'query',
        name: 'My Report',
        connectionId: 'conn-x',
        database: 'analytics',
        schema: 'reporting',
        sql: 'SELECT COUNT(*) FROM orders',
        accessedAt: '2024-06-15T08:00:00Z',
      });
    });

    it('should convert empty string database to undefined', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ database: '' }),
      ]);

      const result = service.getRecents();

      expect(result[0].database).toBeUndefined();
    });

    it('should convert empty string schema to undefined', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ schema: '' }),
      ]);

      const result = service.getRecents();

      expect(result[0].schema).toBeUndefined();
    });

    it('should convert empty string sql to undefined', () => {
      mockAll.mockReturnValueOnce([
        createRecentRow({ sql: '' }),
      ]);

      const result = service.getRecents();

      expect(result[0].sql).toBeUndefined();
    });
  });

  describe('ItemType enum values', () => {
    it('should use correct string values', () => {
      expect(ItemType.Table).toBe('table');
      expect(ItemType.View).toBe('view');
      expect(ItemType.Query).toBe('query');
    });
  });

  describe('recentsService singleton', () => {
    it('should be an instance of RecentsService', () => {
      expect(recentsService).toBeInstanceOf(RecentsService);
    });
  });
});
