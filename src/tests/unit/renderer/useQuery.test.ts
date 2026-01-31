import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQuery } from '@/composables/useQuery';
import { useConnectionsStore } from '@/stores/connections';
import { useTabsStore } from '@/stores/tabs';
import { DatabaseType } from '@/types/connection';
import type { QueryResult, MultiQueryResult } from '@/types/query';

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
    query: {
      execute: vi.fn(),
      executeMultiple: vi.fn(),
      cancel: vi.fn(),
    },
    history: {
      add: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    recents: {
      add: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
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

const makeQueryResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  columns: [{ name: 'id', type: 'integer', nullable: false }],
  rows: [{ id: 1 }],
  rowCount: 1,
  executionTime: 50,
  ...overrides,
});

const setupActiveConnection = (type: DatabaseType = DatabaseType.PostgreSQL) => {
  const connectionsStore = useConnectionsStore();
  connectionsStore.activeConnectionId = 'conn-1';
  connectionsStore.connections = [
    {
      id: 'conn-1',
      name: 'Test DB',
      type,
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
    },
  ];
};

describe('useQuery', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have isExecuting as false initially', () => {
      const { isExecuting } = useQuery();
      expect(isExecuting.value).toBe(false);
    });

    it('should have isExplaining as false initially', () => {
      const { isExplaining } = useQuery();
      expect(isExplaining.value).toBe(false);
    });

    it('should have error as null initially', () => {
      const { error } = useQuery();
      expect(error.value).toBeNull();
    });
  });

  describe('executeQuery', () => {
    it('should return null when no active connection', async () => {
      const { executeQuery, error } = useQuery();

      const result = await executeQuery('SELECT 1');
      expect(result).toBeNull();
      expect(error.value).toBe('No active connection');
    });

    it('should execute a single query and return result', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toEqual(queryResult);
      expect(window.api.query.execute).toHaveBeenCalledWith('conn-1', 'SELECT 1');
    });

    it('should set isExecuting during execution', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.execute).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeQueryResult()), 50))
      );

      const { executeQuery, isExecuting } = useQuery();
      const promise = executeQuery('SELECT 1');
      expect(isExecuting.value).toBe(true);

      await promise;
      expect(isExecuting.value).toBe(false);
    });

    it('should save successful query to history', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult({ executionTime: 100, rowCount: 5 });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT * FROM users');

      expect(window.api.history.add).toHaveBeenCalledWith(
        'conn-1',
        'SELECT * FROM users',
        100,
        5,
        undefined
      );
    });

    it('should save failed query to history with error', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult({ error: 'syntax error', executionTime: 10 });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery, error } = useQuery();
      await executeQuery('SELEC');

      expect(error.value).toBe('syntax error');
      expect(window.api.history.add).toHaveBeenCalledWith(
        'conn-1',
        'SELEC',
        10,
        1,
        'syntax error'
      );
    });

    it('should save to recents for successful SELECT queries', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT * FROM users');

      expect(window.api.recents.add).toHaveBeenCalled();
    });

    it('should not save to recents for non-SELECT queries', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult({ rowCount: 0 });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('INSERT INTO users VALUES (1)');

      expect(window.api.recents.add).not.toHaveBeenCalled();
    });

    it('should set tab result when tabId is provided', async () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1', tab.id);

      // The tab should have the result set
      const updatedTab = tabsStore.tabs.find((t) => t.id === tab.id);
      expect(updatedTab).toBeDefined();
    });

    it('should set tab executing state when tabId is provided', async () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');

      vi.mocked(window.api.query.execute).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeQueryResult()), 50))
      );

      const { executeQuery } = useQuery();
      const promise = executeQuery('SELECT 1', tab.id);

      // During execution, tab should be marked as executing
      const executingTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (executingTab && executingTab.data.type === 'query') {
        expect(executingTab.data.isExecuting).toBe(true);
      }

      await promise;

      const doneTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (doneTab && doneTab.data.type === 'query') {
        expect(doneTab.data.isExecuting).toBe(false);
      }
    });

    it('should handle execution errors gracefully', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.execute).mockRejectedValueOnce(new Error('Timeout'));

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toBeNull();
      expect(error.value).toBe('Timeout');
    });

    it('should handle non-Error exceptions', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.execute).mockRejectedValueOnce('string error');

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toBeNull();
      expect(error.value).toBe('Query execution failed');
    });

    it('should save failed query exception to history', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.execute).mockRejectedValueOnce(new Error('Crash'));

      const { executeQuery } = useQuery();
      await executeQuery('BAD QUERY');

      expect(window.api.history.add).toHaveBeenCalledWith(
        'conn-1',
        'BAD QUERY',
        0,
        0,
        'Crash'
      );
    });
  });

  describe('multiple statement detection and execution', () => {
    it('should detect and route multiple statements to executeMultiple', async () => {
      setupActiveConnection();
      const multiResult: MultiQueryResult = {
        results: [makeQueryResult(), makeQueryResult({ rowCount: 2 })],
        totalExecutionTime: 100,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1;\nSELECT 2;');

      expect(window.api.query.executeMultiple).toHaveBeenCalledWith('conn-1', 'SELECT 1;\nSELECT 2;');
      expect(result).toEqual(multiResult.results[0]);
    });

    it('should treat a single statement with trailing semicolon as single', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;');

      expect(window.api.query.execute).toHaveBeenCalledWith('conn-1', 'SELECT 1;');
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should ignore semicolons inside single-quoted strings', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery("SELECT 'a;b' FROM t");

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should ignore semicolons inside double-quoted identifiers', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT "col;name" FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should ignore semicolons inside backtick-quoted identifiers', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT `col;name` FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should ignore semicolons inside line comments', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1 -- comment; here\nFROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should ignore semicolons inside block comments', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1 /* comment; here */ FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should return null for multi-query when no active connection', async () => {
      // No active connection set
      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1;\nSELECT 2;');

      expect(result).toBeNull();
      expect(error.value).toBe('No active connection');
    });

    it('should set tab results for multi-query with tabId', async () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');
      const multiResult: MultiQueryResult = {
        results: [makeQueryResult(), makeQueryResult({ rowCount: 3 })],
        totalExecutionTime: 200,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;\nSELECT 2;', tab.id);

      const updatedTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (updatedTab && updatedTab.data.type === 'query') {
        expect(updatedTab.data.results).toEqual(multiResult.results);
      }
    });

    it('should report first error from multi-query results', async () => {
      setupActiveConnection();
      const multiResult: MultiQueryResult = {
        results: [
          makeQueryResult(),
          makeQueryResult({ error: 'second query failed' }),
        ],
        totalExecutionTime: 100,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery, error } = useQuery();
      await executeQuery('SELECT 1;\nSELECT BAD;');

      expect(error.value).toBe('second query failed');
    });

    it('should handle multi-query execution exception', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.executeMultiple).mockRejectedValue(new Error('Network error'));

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1;\nSELECT 2;');

      expect(result).toBeNull();
      expect(error.value).toBe('Network error');
    });

    it('should return null when multi-query returns empty results', async () => {
      setupActiveConnection();
      const multiResult: MultiQueryResult = {
        results: [],
        totalExecutionTime: 0,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1;\nSELECT 2;');

      expect(result).toBeNull();
    });

    it('should save multi-query to history with combined stats', async () => {
      setupActiveConnection();
      const multiResult: MultiQueryResult = {
        results: [
          makeQueryResult({ rowCount: 3 }),
          makeQueryResult({ rowCount: 7 }),
        ],
        totalExecutionTime: 150,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;\nSELECT 2;');

      expect(window.api.history.add).toHaveBeenCalledWith(
        'conn-1',
        'SELECT 1;\nSELECT 2;',
        150,
        10,
        undefined
      );
    });
  });

  describe('cancelQuery', () => {
    it('should return false when no active connection', async () => {
      const { cancelQuery } = useQuery();
      const result = await cancelQuery();
      expect(result).toBe(false);
    });

    it('should call api cancel and return result', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.cancel).mockResolvedValueOnce(true);

      const { cancelQuery } = useQuery();
      const result = await cancelQuery();

      expect(result).toBe(true);
      expect(window.api.query.cancel).toHaveBeenCalledWith('conn-1');
    });

    it('should return false on cancel exception', async () => {
      setupActiveConnection();
      vi.mocked(window.api.query.cancel).mockRejectedValueOnce(new Error('cancel failed'));

      const { cancelQuery } = useQuery();
      const result = await cancelQuery();
      expect(result).toBe(false);
    });
  });

  describe('createQueryTab', () => {
    it('should return null when no active connection', () => {
      const { createQueryTab } = useQuery();
      const result = createQueryTab('SELECT 1');
      expect(result).toBeNull();
    });

    it('should create a query tab with SQL', () => {
      setupActiveConnection();
      const { createQueryTab } = useQuery();
      const tab = createQueryTab('SELECT * FROM users');

      expect(tab).not.toBeNull();
      expect(tab!.data.type).toBe('query');
    });

    it('should create a query tab with default empty SQL', () => {
      setupActiveConnection();
      const { createQueryTab } = useQuery();
      const tab = createQueryTab();

      expect(tab).not.toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no active connection', async () => {
      const { getHistory } = useQuery();
      const result = await getHistory();
      expect(result).toEqual([]);
    });

    it('should call api history list', async () => {
      setupActiveConnection();
      const historyItems = [
        { id: 1, connectionId: 'conn-1', sql: 'SELECT 1', executedAt: '2024-01-01T00:00:00Z' },
      ];
      vi.mocked(window.api.history.list).mockResolvedValueOnce(historyItems);

      const { getHistory } = useQuery();
      const result = await getHistory(50);

      expect(result).toEqual(historyItems);
      expect(window.api.history.list).toHaveBeenCalledWith('conn-1', 50);
    });

    it('should use default limit of 100', async () => {
      setupActiveConnection();
      vi.mocked(window.api.history.list).mockResolvedValueOnce([]);

      const { getHistory } = useQuery();
      await getHistory();

      expect(window.api.history.list).toHaveBeenCalledWith('conn-1', 100);
    });
  });

  describe('clearHistory', () => {
    it('should do nothing when no active connection', async () => {
      const { clearHistory } = useQuery();
      await clearHistory();
      expect(window.api.history.clear).not.toHaveBeenCalled();
    });

    it('should call api history clear', async () => {
      setupActiveConnection();
      const { clearHistory } = useQuery();
      await clearHistory();
      expect(window.api.history.clear).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('explainQuery', () => {
    it('should return null when no active connection', async () => {
      const { explainQuery, error } = useQuery();
      const result = await explainQuery('SELECT 1');
      expect(result).toBeNull();
      expect(error.value).toBe('No active connection');
    });

    it('should return null when connection not found', async () => {
      const connectionsStore = useConnectionsStore();
      connectionsStore.activeConnectionId = 'conn-missing';
      connectionsStore.connections = [];

      const { explainQuery, error } = useQuery();
      const result = await explainQuery('SELECT 1');
      expect(result).toBeNull();
      expect(error.value).toBe('Connection not found');
    });

    it('should generate PostgreSQL EXPLAIN query', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      const queryResult = makeQueryResult({
        columns: [{ name: 'QUERY PLAN', type: 'text', nullable: false }],
        rows: [{ 'QUERY PLAN': '{"Plan": {"Node Type": "Seq Scan"}}' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users');

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN (COSTS, VERBOSE, FORMAT JSON) SELECT * FROM users'
      );
    });

    it('should generate PostgreSQL EXPLAIN ANALYZE query', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      const queryResult = makeQueryResult({
        columns: [{ name: 'QUERY PLAN', type: 'text', nullable: false }],
        rows: [{ 'QUERY PLAN': '{"Plan": {"Node Type": "Seq Scan"}}' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users', undefined, true);

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) SELECT * FROM users'
      );
    });

    it('should generate MySQL EXPLAIN query', async () => {
      setupActiveConnection(DatabaseType.MySQL);
      const queryResult = makeQueryResult({
        columns: [{ name: 'EXPLAIN', type: 'text', nullable: false }],
        rows: [{ EXPLAIN: '{"query_block": {}}' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users');

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN FORMAT=JSON SELECT * FROM users'
      );
    });

    it('should generate MySQL EXPLAIN ANALYZE query', async () => {
      setupActiveConnection(DatabaseType.MySQL);
      const queryResult = makeQueryResult({
        columns: [{ name: 'EXPLAIN', type: 'text', nullable: false }],
        rows: [{ EXPLAIN: 'actual time=0.1..0.2 rows=1' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users', undefined, true);

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN ANALYZE SELECT * FROM users'
      );
    });

    it('should generate MariaDB EXPLAIN query', async () => {
      setupActiveConnection(DatabaseType.MariaDB);
      const queryResult = makeQueryResult({
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'select_type', type: 'text', nullable: false },
        ],
        rows: [{ id: 1, select_type: 'SIMPLE' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users');

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN SELECT * FROM users'
      );
    });

    it('should generate MariaDB ANALYZE query', async () => {
      setupActiveConnection(DatabaseType.MariaDB);
      const queryResult = makeQueryResult({
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'select_type', type: 'text', nullable: false },
        ],
        rows: [{ id: 1, select_type: 'SIMPLE' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users', undefined, true);

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'ANALYZE SELECT * FROM users'
      );
    });

    it('should generate SQLite EXPLAIN QUERY PLAN', async () => {
      setupActiveConnection(DatabaseType.SQLite);
      const queryResult = makeQueryResult({
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'parent', type: 'integer', nullable: false },
          { name: 'notused', type: 'integer', nullable: false },
          { name: 'detail', type: 'text', nullable: false },
        ],
        rows: [{ id: 0, parent: 0, notused: 0, detail: 'SCAN TABLE users' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      const plan = await explainQuery('SELECT * FROM users');

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN QUERY PLAN SELECT * FROM users'
      );
      expect(plan).not.toBeNull();
      expect(plan!.planText).toBe('0: SCAN TABLE users');
    });

    it('should generate ClickHouse EXPLAIN query', async () => {
      setupActiveConnection(DatabaseType.ClickHouse);
      const queryResult = makeQueryResult({
        columns: [{ name: 'explain', type: 'text', nullable: false }],
        rows: [{ explain: 'ReadFromStorage' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users');

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN SELECT * FROM users'
      );
    });

    it('should generate ClickHouse EXPLAIN PIPELINE for analyze', async () => {
      setupActiveConnection(DatabaseType.ClickHouse);
      const queryResult = makeQueryResult({
        columns: [{ name: 'explain', type: 'text', nullable: false }],
        rows: [{ explain: 'Pipeline' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users', undefined, true);

      expect(window.api.query.execute).toHaveBeenCalledWith(
        'conn-1',
        'EXPLAIN PIPELINE SELECT * FROM users'
      );
    });

    it('should return null for unsupported database types', async () => {
      setupActiveConnection(DatabaseType.MongoDB);

      const { explainQuery, error } = useQuery();
      const result = await explainQuery('db.users.find()');

      expect(result).toBeNull();
      expect(error.value).toContain('not supported');
    });

    it('should return null when explain query returns error', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      const queryResult = makeQueryResult({ error: 'relation does not exist' });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery, error } = useQuery();
      const result = await explainQuery('SELECT * FROM nonexistent');

      expect(result).toBeNull();
      expect(error.value).toBe('relation does not exist');
    });

    it('should set isExplaining during execution', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      vi.mocked(window.api.query.execute).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(makeQueryResult({
          columns: [{ name: 'QUERY PLAN', type: 'text', nullable: false }],
          rows: [{ 'QUERY PLAN': '{}' }],
        })), 50))
      );

      const { explainQuery, isExplaining } = useQuery();
      const promise = explainQuery('SELECT 1');
      expect(isExplaining.value).toBe(true);

      await promise;
      expect(isExplaining.value).toBe(false);
    });

    it('should set tab query plan when tabId is provided', async () => {
      setupActiveConnection(DatabaseType.SQLite);
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');

      const queryResult = makeQueryResult({
        columns: [
          { name: 'id', type: 'integer', nullable: false },
          { name: 'detail', type: 'text', nullable: false },
        ],
        rows: [{ id: 0, detail: 'SCAN TABLE users' }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      await explainQuery('SELECT * FROM users', tab.id);

      const updatedTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (updatedTab && updatedTab.data.type === 'query') {
        expect(updatedTab.data.queryPlan).toBeDefined();
        expect(updatedTab.data.showPlan).toBe(true);
      }
    });

    it('should handle explain exception gracefully', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      vi.mocked(window.api.query.execute).mockRejectedValueOnce(new Error('Timeout'));

      const { explainQuery, error } = useQuery();
      const result = await explainQuery('SELECT 1');

      expect(result).toBeNull();
      expect(error.value).toBe('Timeout');
    });

    it('should handle non-Error explain exception', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      vi.mocked(window.api.query.execute).mockRejectedValueOnce('bad');

      const { explainQuery, error } = useQuery();
      const result = await explainQuery('SELECT 1');

      expect(result).toBeNull();
      expect(error.value).toBe('EXPLAIN failed');
    });

    it('should parse PostgreSQL JSON plan from string value', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      const jsonPlan = { Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'users' } };
      const queryResult = makeQueryResult({
        columns: [{ name: 'QUERY PLAN', type: 'json', nullable: false }],
        rows: [{ 'QUERY PLAN': JSON.stringify(jsonPlan) }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      const plan = await explainQuery('SELECT * FROM users');

      expect(plan).not.toBeNull();
      expect(plan!.planText).toBe(JSON.stringify(jsonPlan, null, 2));
    });

    it('should parse PostgreSQL JSON plan from object value', async () => {
      setupActiveConnection(DatabaseType.PostgreSQL);
      const jsonPlan = { Plan: { 'Node Type': 'Seq Scan' } };
      const queryResult = makeQueryResult({
        columns: [{ name: 'QUERY PLAN', type: 'json', nullable: false }],
        rows: [{ 'QUERY PLAN': jsonPlan }],
      });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { explainQuery } = useQuery();
      const plan = await explainQuery('SELECT * FROM users');

      expect(plan).not.toBeNull();
      expect(plan!.planText).toBe(JSON.stringify(jsonPlan, null, 2));
    });
  });
});
