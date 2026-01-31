import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryHistoryItem, SavedQuery } from '@main/services/queryHistory';

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

import { QueryHistoryService, queryHistoryService } from '@main/services/queryHistory';
import { logger } from '@main/utils/logger';

const createHistoryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  connection_id: 'conn-1',
  sql: 'SELECT * FROM users',
  execution_time: 150,
  row_count: 42,
  error: null,
  executed_at: '2024-01-15T10:30:00.000Z',
  ...overrides,
});

const createSavedQueryRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  connection_id: 'conn-1',
  name: 'Get Users',
  sql: 'SELECT * FROM users',
  description: 'Fetches all users',
  created_at: '2024-01-15T10:30:00.000Z',
  updated_at: '2024-01-15T10:30:00.000Z',
  ...overrides,
});

describe('QueryHistoryService', () => {
  let service: QueryHistoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QueryHistoryService();
    mockGet.mockReturnValue(undefined);
  });

  describe('addToHistory', () => {
    it('should insert a query history entry and return it', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 5 });
      mockGet.mockReturnValueOnce(createHistoryRow({ id: 5 }));

      const result = service.addToHistory('conn-1', 'SELECT 1', 100, 1);

      expect(result.id).toBe(5);
      expect(result.connectionId).toBe('conn-1');
      expect(result.sql).toBe('SELECT * FROM users'); // from mock row
    });

    it('should pass correct parameters to INSERT', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createHistoryRow());

      service.addToHistory('conn-1', 'SELECT 1', 200, 50, undefined);

      expect(mockRun).toHaveBeenCalledWith('conn-1', 'SELECT 1', 200, 50, null);
    });

    it('should handle null optional parameters', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createHistoryRow());

      service.addToHistory('conn-1', 'DELETE FROM temp');

      expect(mockRun).toHaveBeenCalledWith('conn-1', 'DELETE FROM temp', null, null, null);
    });

    it('should store error messages', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createHistoryRow({ error: 'Syntax error' }));

      const result = service.addToHistory('conn-1', 'SELCT BAD', undefined, undefined, 'Syntax error');

      expect(mockRun).toHaveBeenCalledWith('conn-1', 'SELCT BAD', null, null, 'Syntax error');
      expect(result.error).toBe('Syntax error');
    });

    it('should log when a query is added', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 7 });
      mockGet.mockReturnValueOnce(createHistoryRow({ id: 7 }));

      service.addToHistory('conn-1', 'SELECT 1');

      expect(logger.debug).toHaveBeenCalledWith('Query added to history', { connectionId: 'conn-1', id: 7 });
    });
  });

  describe('getHistory', () => {
    it('should return history items for a connection', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({ id: 1 }),
        createHistoryRow({ id: 2, sql: 'SELECT 1' }),
      ]);

      const result = service.getHistory('conn-1');

      expect(result).toHaveLength(2);
      expect(result[0].connectionId).toBe('conn-1');
    });

    it('should use default limit of 100 and offset of 0', () => {
      mockAll.mockReturnValueOnce([]);

      service.getHistory('conn-1');

      expect(mockAll).toHaveBeenCalledWith('conn-1', 100, 0);
    });

    it('should accept custom limit and offset', () => {
      mockAll.mockReturnValueOnce([]);

      service.getHistory('conn-1', 50, 10);

      expect(mockAll).toHaveBeenCalledWith('conn-1', 50, 10);
    });

    it('should return empty array when no history exists', () => {
      mockAll.mockReturnValueOnce([]);

      const result = service.getHistory('conn-1');

      expect(result).toEqual([]);
    });

    it('should map execution_time and row_count to undefined when null', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({ execution_time: null, row_count: null }),
      ]);

      const result = service.getHistory('conn-1');

      expect(result[0].executionTime).toBeUndefined();
      expect(result[0].rowCount).toBeUndefined();
    });

    it('should map error to undefined when null', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({ error: null }),
      ]);

      const result = service.getHistory('conn-1');

      expect(result[0].error).toBeUndefined();
    });
  });

  describe('getAllHistory', () => {
    it('should return all history items across connections', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({ connection_id: 'conn-1' }),
        createHistoryRow({ connection_id: 'conn-2' }),
      ]);

      const result = service.getAllHistory();

      expect(result).toHaveLength(2);
    });

    it('should use default limit 100 and offset 0', () => {
      mockAll.mockReturnValueOnce([]);

      service.getAllHistory();

      expect(mockAll).toHaveBeenCalledWith(100, 0);
    });

    it('should accept custom limit and offset', () => {
      mockAll.mockReturnValueOnce([]);

      service.getAllHistory(25, 5);

      expect(mockAll).toHaveBeenCalledWith(25, 5);
    });
  });

  describe('getHistoryItem', () => {
    it('should return a single history item by id', () => {
      mockGet.mockReturnValueOnce(createHistoryRow({ id: 42 }));

      const result = service.getHistoryItem(42);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(42);
    });

    it('should return null when item is not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = service.getHistoryItem(999);

      expect(result).toBeNull();
    });

    it('should pass the id to the query', () => {
      mockGet.mockReturnValueOnce(undefined);

      service.getHistoryItem(123);

      expect(mockGet).toHaveBeenCalledWith(123);
    });
  });

  describe('clearHistory', () => {
    it('should clear history for a specific connection', () => {
      mockRun.mockReturnValueOnce({ changes: 5, lastInsertRowid: 0 });

      const result = service.clearHistory('conn-1');

      expect(result).toBe(5);
      expect(mockRun).toHaveBeenCalledWith('conn-1');
    });

    it('should clear all history when no connectionId is provided', () => {
      mockRun.mockReturnValueOnce({ changes: 100, lastInsertRowid: 0 });

      const result = service.clearHistory();

      expect(result).toBe(100);
      // DELETE FROM query_history (no WHERE clause)
      expect(mockRun).toHaveBeenCalledWith();
    });

    it('should return 0 when no history items exist', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.clearHistory('conn-1');

      expect(result).toBe(0);
    });

    it('should log when clearing for a specific connection', () => {
      mockRun.mockReturnValueOnce({ changes: 3, lastInsertRowid: 0 });

      service.clearHistory('conn-1');

      expect(logger.debug).toHaveBeenCalledWith('Query history cleared for connection', { connectionId: 'conn-1', deleted: 3 });
    });

    it('should log when clearing all history', () => {
      mockRun.mockReturnValueOnce({ changes: 10, lastInsertRowid: 0 });

      service.clearHistory();

      expect(logger.debug).toHaveBeenCalledWith('All query history cleared', { deleted: 10 });
    });
  });

  describe('deleteHistoryItem', () => {
    it('should return true when item was deleted', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      const result = service.deleteHistoryItem(1);

      expect(result).toBe(true);
    });

    it('should return false when item was not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.deleteHistoryItem(999);

      expect(result).toBe(false);
    });

    it('should pass the id to the DELETE query', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      service.deleteHistoryItem(42);

      expect(mockRun).toHaveBeenCalledWith(42);
    });
  });

  describe('saveQuery', () => {
    it('should save a query and return it', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 10 });
      mockGet.mockReturnValueOnce(createSavedQueryRow({ id: 10 }));

      const result = service.saveQuery('My Query', 'SELECT 1', 'conn-1', 'A test query');

      expect(result.id).toBe(10);
      expect(result.name).toBe('Get Users'); // from mock row
    });

    it('should handle optional parameters', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 });
      mockGet.mockReturnValueOnce(createSavedQueryRow());

      service.saveQuery('Query Name', 'SELECT 1');

      // connectionId and description are null when not provided
      expect(mockRun).toHaveBeenCalledWith(
        null,
        'Query Name',
        'SELECT 1',
        null,
        expect.any(String),
        expect.any(String)
      );
    });

    it('should log on save', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 3 });
      mockGet.mockReturnValueOnce(createSavedQueryRow({ id: 3 }));

      service.saveQuery('My Query', 'SELECT 1');

      expect(logger.debug).toHaveBeenCalledWith('Query saved', { id: 3, name: 'My Query' });
    });
  });

  describe('updateSavedQuery', () => {
    it('should update an existing saved query', () => {
      // First get returns existing, second get returns updated
      mockGet
        .mockReturnValueOnce(createSavedQueryRow())
        .mockReturnValueOnce(createSavedQueryRow({ name: 'Updated Name' }));

      const result = service.updateSavedQuery(1, { name: 'Updated Name' });

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Updated Name');
    });

    it('should return null when saved query does not exist', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = service.updateSavedQuery(999, { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should use existing values for fields not being updated', () => {
      const existingRow = createSavedQueryRow({ name: 'Original', sql: 'SELECT 1', description: 'Desc' });
      mockGet
        .mockReturnValueOnce(existingRow)
        .mockReturnValueOnce(existingRow);

      service.updateSavedQuery(1, { name: 'Changed Name' });

      // The run call should use existing sql and description from the mapped row
      // mapRowToSavedQuery returns: sql from row.sql, description from row.description
      expect(mockRun).toHaveBeenCalledWith(
        'Changed Name',
        'SELECT 1',         // existing sql from mapped row
        'Desc',             // existing description from mapped row
        expect.any(String), // updated_at
        1                   // id
      );
    });

    it('should update multiple fields at once', () => {
      mockGet
        .mockReturnValueOnce(createSavedQueryRow())
        .mockReturnValueOnce(createSavedQueryRow());

      service.updateSavedQuery(1, { name: 'New', sql: 'SELECT 2', description: 'Updated desc' });

      expect(mockRun).toHaveBeenCalledWith(
        'New',
        'SELECT 2',
        'Updated desc',
        expect.any(String),
        1
      );
    });
  });

  describe('getSavedQuery', () => {
    it('should return a saved query by id', () => {
      mockGet.mockReturnValueOnce(createSavedQueryRow({ id: 5 }));

      const result = service.getSavedQuery(5);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(5);
      expect(result!.name).toBe('Get Users');
    });

    it('should return null when not found', () => {
      mockGet.mockReturnValueOnce(undefined);

      const result = service.getSavedQuery(999);

      expect(result).toBeNull();
    });

    it('should map connectionId to undefined when null', () => {
      mockGet.mockReturnValueOnce(createSavedQueryRow({ connection_id: null }));

      const result = service.getSavedQuery(1);

      expect(result!.connectionId).toBeUndefined();
    });

    it('should map description to undefined when null', () => {
      mockGet.mockReturnValueOnce(createSavedQueryRow({ description: null }));

      const result = service.getSavedQuery(1);

      expect(result!.description).toBeUndefined();
    });
  });

  describe('listSavedQueries', () => {
    it('should list all saved queries when no connectionId is provided', () => {
      mockAll.mockReturnValueOnce([
        createSavedQueryRow({ id: 1 }),
        createSavedQueryRow({ id: 2, connection_id: 'conn-2' }),
      ]);

      const result = service.listSavedQueries();

      expect(result).toHaveLength(2);
    });

    it('should filter by connectionId when provided', () => {
      mockAll.mockReturnValueOnce([
        createSavedQueryRow({ id: 1, connection_id: 'conn-1' }),
      ]);

      const result = service.listSavedQueries('conn-1');

      expect(result).toHaveLength(1);
      expect(mockAll).toHaveBeenCalledWith('conn-1');
    });

    it('should return empty array when no saved queries exist', () => {
      mockAll.mockReturnValueOnce([]);

      const result = service.listSavedQueries();

      expect(result).toEqual([]);
    });
  });

  describe('deleteSavedQuery', () => {
    it('should return true when query was deleted', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      const result = service.deleteSavedQuery(1);

      expect(result).toBe(true);
    });

    it('should return false when query was not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });

      const result = service.deleteSavedQuery(999);

      expect(result).toBe(false);
    });

    it('should log deletion', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 });

      service.deleteSavedQuery(1);

      expect(logger.debug).toHaveBeenCalledWith('Saved query deleted', { id: 1, deleted: true });
    });
  });

  describe('row mapping', () => {
    it('should map history row with all fields populated', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({
          id: 10,
          connection_id: 'conn-x',
          sql: 'SELECT name FROM products',
          execution_time: 250,
          row_count: 100,
          error: null,
          executed_at: '2024-03-20T15:00:00Z',
        }),
      ]);

      const result = service.getHistory('conn-x');

      expect(result[0]).toEqual({
        id: 10,
        connectionId: 'conn-x',
        sql: 'SELECT name FROM products',
        executionTime: 250,
        rowCount: 100,
        error: undefined,
        executedAt: '2024-03-20T15:00:00Z',
      });
    });

    it('should map history row with error field', () => {
      mockAll.mockReturnValueOnce([
        createHistoryRow({ error: 'Table not found' }),
      ]);

      const result = service.getHistory('conn-1');

      expect(result[0].error).toBe('Table not found');
    });

    it('should map saved query row with all fields', () => {
      mockGet.mockReturnValueOnce(
        createSavedQueryRow({
          id: 20,
          connection_id: 'conn-y',
          name: 'Report Query',
          sql: 'SELECT * FROM reports',
          description: 'Generates report',
          created_at: '2024-05-01T12:00:00Z',
          updated_at: '2024-05-02T12:00:00Z',
        })
      );

      const result = service.getSavedQuery(20);

      expect(result).toEqual({
        id: 20,
        connectionId: 'conn-y',
        name: 'Report Query',
        sql: 'SELECT * FROM reports',
        description: 'Generates report',
        createdAt: '2024-05-01T12:00:00Z',
        updatedAt: '2024-05-02T12:00:00Z',
      });
    });
  });

  describe('queryHistoryService singleton', () => {
    it('should be an instance of QueryHistoryService', () => {
      expect(queryHistoryService).toBeInstanceOf(QueryHistoryService);
    });
  });
});
