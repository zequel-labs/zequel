import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useQuery } from '@/composables/useQuery';
import { useConnectionsStore } from '@/stores/connections';
import { useTabsStore } from '@/stores/tabs';
import { DatabaseType } from '@/types/connection';
import type { QueryResult, MultiQueryResult } from '@/types/query';

// Mock document for settings store applyTheme
vi.stubGlobal('document', {
  documentElement: {
    classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
    style: { setProperty: vi.fn() },
  },
});

// Mock window.api
vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
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
  connectionsStore.activeSessionId = 'conn-1';
  connectionsStore.sessions.set('conn-1', { savedConnectionId: 'conn-1' });
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
      expect(window.api.query.execute).toHaveBeenCalledWith('conn-1', 'SELECT 1', undefined, undefined);
    });

    it('should forward useTransaction param to execute', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1', undefined, true);

      expect(window.api.query.execute).toHaveBeenCalledWith('conn-1', 'SELECT 1', undefined, true);
    });

    it('should forward useTransaction param to executeMultiple for multi-statement queries', async () => {
      setupActiveConnection();
      const multiResult = {
        results: [makeQueryResult()],
        totalExecutionTime: 100,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;\nSELECT 2;', undefined, true);

      expect(window.api.query.executeMultiple).toHaveBeenCalledWith('conn-1', 'SELECT 1;\nSELECT 2;', true);
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

      expect(window.api.query.executeMultiple).toHaveBeenCalledWith('conn-1', 'SELECT 1;\nSELECT 2;', undefined);
      expect(result).toEqual(multiResult.results[multiResult.results.length - 1]);
    });

    it('should treat a single statement with trailing semicolon as single', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;');

      expect(window.api.query.execute).toHaveBeenCalledWith('conn-1', 'SELECT 1;', undefined, undefined);
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

    it('should store all results and default to last for multi-query with tabId', async () => {
      setupActiveConnection();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');
      const firstResult = makeQueryResult({ rowCount: 1 });
      const lastResult = makeQueryResult({ rowCount: 3 });
      const multiResult: MultiQueryResult = {
        results: [firstResult, lastResult],
        totalExecutionTime: 200,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT 1;\nSELECT 2;', tab.id);

      const updatedTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (updatedTab && updatedTab.data.type === 'query') {
        expect(updatedTab.data.multiResults).toEqual([firstResult, lastResult]);
        expect(updatedTab.data.currentResultIndex).toBe(1);
        expect(updatedTab.data.result).toEqual(lastResult);
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

  describe('safe mode query blocking', () => {
    it('should allow SELECT queries in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT * FROM users');

      expect(result).toEqual(queryResult);
      expect(window.api.query.execute).toHaveBeenCalled();
    });

    it('should block INSERT queries in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('INSERT INTO users (name) VALUES (\'test\')');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
      expect(window.api.query.execute).not.toHaveBeenCalled();
    });

    it('should block UPDATE queries in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('UPDATE users SET name = \'test\'');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should block DELETE queries in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('DELETE FROM users WHERE id = 1');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should block DROP TABLE in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('DROP TABLE users');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should block ALTER TABLE in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('ALTER TABLE users ADD COLUMN email VARCHAR(255)');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should block CREATE TABLE in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('CREATE TABLE new_table (id INT)');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should block TRUNCATE in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('TRUNCATE TABLE users');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });

    it('should allow SHOW queries in safe mode', async () => {
      setupActiveConnection(DatabaseType.MySQL);
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SHOW TABLES');

      expect(result).toEqual(queryResult);
      expect(window.api.query.execute).toHaveBeenCalled();
    });

    it('should allow write queries when safe mode is off', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('INSERT INTO users (name) VALUES (\'test\')');

      expect(result).toEqual(queryResult);
      expect(window.api.query.execute).toHaveBeenCalled();
    });

    it('should block destructive multi-statement queries in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1;\nDROP TABLE users;');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should set tab error result when blocking in safe mode', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();
      const tabsStore = useTabsStore();
      const tab = tabsStore.createQueryTab('conn-1', '');

      const { executeQuery } = useQuery();
      await executeQuery('DROP TABLE users', tab.id);

      const updatedTab = tabsStore.tabs.find((t) => t.id === tab.id);
      if (updatedTab && updatedTab.data.type === 'query') {
        expect(updatedTab.data.result?.error).toBe('Write queries are not allowed in Safe Mode');
      }
    });
  });

  describe('hasMultipleStatements edge cases', () => {
    it('should handle whitespace after semicolon followed by line comment only', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Semicolon followed by whitespace and then a line comment — no real second statement
      await executeQuery('SELECT 1;  -- just a comment');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle semicolon followed by line comment then real statement', async () => {
      setupActiveConnection();
      const multiResult = {
        results: [makeQueryResult()],
        totalExecutionTime: 50,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      // After the semicolon there is a line comment, then a real statement
      await executeQuery('SELECT 1; -- comment\nSELECT 2');

      expect(window.api.query.executeMultiple).toHaveBeenCalled();
    });

    it('should handle semicolon followed by block comment only (no further statement)', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Semicolon followed by a block comment with no real statement after
      await executeQuery('SELECT 1; /* block comment */');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle semicolon followed by block comment then real statement', async () => {
      setupActiveConnection();
      const multiResult = {
        results: [makeQueryResult()],
        totalExecutionTime: 50,
      };
      vi.mocked(window.api.query.executeMultiple).mockResolvedValue(multiResult);

      const { executeQuery } = useQuery();
      // Block comment after semicolon, then a real statement
      await executeQuery('SELECT 1; /* comment */ SELECT 2');

      expect(window.api.query.executeMultiple).toHaveBeenCalled();
    });

    it('should handle unclosed block comment at EOF after semicolon', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Semicolon followed by an unterminated block comment — no second statement
      await executeQuery('SELECT 1; /* unterminated comment');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle unclosed dollar-quoted string reaching end of input', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Dollar-quoted string that is never closed — no semicolon outside the string
      await executeQuery('SELECT $$unclosed dollar quote');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle unclosed named dollar-quoted string reaching end of input', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Named dollar-quoted string never closed
      await executeQuery('SELECT $tag$unclosed named dollar tag');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle block comment at main parse level reaching EOF', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Unterminated block comment at the top-level parse
      await executeQuery('SELECT 1 /* unterminated block comment');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should skip whitespace between semicolons without treating as multiple statements', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Semicolons followed only by whitespace — no second statement
      await executeQuery('SELECT 1;   \n  \t  ');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle line comment at main parse level', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Line comment in main body (not after semicolon)
      await executeQuery('-- comment\nSELECT 1');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle escaped single quotes inside single-quoted strings', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Escaped single quote ('') inside a string should not break parsing
      await executeQuery("SELECT 'it''s a ; test'");

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle escaped double quotes inside double-quoted identifiers', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Escaped double quote ("") inside identifier
      await executeQuery('SELECT "col""name;semi" FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle escaped backtick inside backtick-quoted identifiers', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // Escaped backtick (``) inside identifier
      await executeQuery('SELECT `col``name;semi` FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });

    it('should handle dollar sign that does not start a dollar-quote tag', async () => {
      setupActiveConnection();
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      // A lone $ not matching $$...$$ pattern
      await executeQuery('SELECT $1 FROM t');

      expect(window.api.query.execute).toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });
  });

  describe('dialect detection for different database types', () => {
    it('should use mysql dialect for MariaDB', async () => {
      setupActiveConnection(DatabaseType.MariaDB);
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toEqual(queryResult);
    });

    it('should use sqlite dialect for DuckDB', async () => {
      setupActiveConnection(DatabaseType.DuckDB);
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toEqual(queryResult);
    });

    it('should use mssql dialect for SQLServer', async () => {
      setupActiveConnection(DatabaseType.SQLServer);
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toEqual(queryResult);
    });

    it('should use generic dialect for unknown database types', async () => {
      setupActiveConnection(DatabaseType.Redis);
      const queryResult = makeQueryResult();
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      const result = await executeQuery('SELECT 1');

      expect(result).toEqual(queryResult);
    });
  });

  describe('per-connection safe mode in multi-session context', () => {
    const setupTwoSessions = () => {
      const connectionsStore = useConnectionsStore();
      connectionsStore.connections = [
        {
          id: 'conn-1',
          name: 'DB 1',
          type: DatabaseType.PostgreSQL,
          host: 'localhost',
          port: 5432,
          database: 'db1',
          username: 'user',
          filepath: null,
          ssl: false,
          ssh: null,
          sortOrder: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          lastConnectedAt: null,
        },
        {
          id: 'conn-2',
          name: 'DB 2',
          type: DatabaseType.PostgreSQL,
          host: 'localhost',
          port: 5433,
          database: 'db2',
          username: 'user',
          filepath: null,
          ssl: false,
          ssh: null,
          sortOrder: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          lastConnectedAt: null,
        },
      ];
      connectionsStore.sessions.set('session-1', { savedConnectionId: 'conn-1' });
      connectionsStore.sessions.set('session-2', { savedConnectionId: 'conn-2' });
      connectionsStore.connectionStates.set('session-1', { id: 'session-1', status: 'connected' as never });
      connectionsStore.connectionStates.set('session-2', { id: 'session-2', status: 'connected' as never });
      return connectionsStore;
    };

    it('should block writes for session-1 with safe mode ON but allow writes for session-2', async () => {
      const connectionsStore = setupTwoSessions();
      const queryResult = makeQueryResult();

      // Step 1: Activate session-1 and turn on safe mode
      connectionsStore.activeSessionId = 'session-1';
      connectionsStore.toggleSafeMode();
      expect(connectionsStore.safeMode).toBe(true);

      // Step 2: Verify write queries are blocked for session-1
      const { executeQuery: executeQuery1, error: error1 } = useQuery();
      const result1 = await executeQuery1('INSERT INTO users (name) VALUES (\'test\')');
      expect(result1).toBeNull();
      expect(error1.value).toBe('Write queries are not allowed in Safe Mode');
      expect(window.api.query.execute).not.toHaveBeenCalled();

      // Step 3: Switch to session-2 (safe mode should be off)
      connectionsStore.activeSessionId = 'session-2';
      expect(connectionsStore.safeMode).toBe(false);

      // Step 4: Verify write queries are allowed for session-2
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);
      const { executeQuery: executeQuery2 } = useQuery();
      const result2 = await executeQuery2('INSERT INTO users (name) VALUES (\'test\')');
      expect(result2).toEqual(queryResult);
      expect(window.api.query.execute).toHaveBeenCalledWith('session-2', expect.any(String), undefined, undefined);

      // Step 5: Switch back to session-1 and verify writes are still blocked
      connectionsStore.activeSessionId = 'session-1';
      expect(connectionsStore.safeMode).toBe(true);

      vi.clearAllMocks();
      const { executeQuery: executeQuery3, error: error3 } = useQuery();
      const result3 = await executeQuery3('DELETE FROM users WHERE id = 1');
      expect(result3).toBeNull();
      expect(error3.value).toBe('Write queries are not allowed in Safe Mode');
      expect(window.api.query.execute).not.toHaveBeenCalled();
    });
  });

  describe('safe mode with parse failures', () => {
    it('should block query when sql-query-identifier fails to parse in safe mode', async () => {
      setupActiveConnection(DatabaseType.ClickHouse);
      const connectionsStore = useConnectionsStore();
      connectionsStore.toggleSafeMode();

      const { executeQuery, error } = useQuery();
      // ClickHouse-specific syntax that sql-query-identifier cannot parse
      // This triggers the catch block in isReadOnlyQuery, returning false
      const result = await executeQuery('OPTIMIZE TABLE users FINAL');

      expect(result).toBeNull();
      expect(error.value).toBe('Write queries are not allowed in Safe Mode');
    });
  });

  describe('resolveConnectionId', () => {
    it('should return null when tabId is provided but tab not found, even with active session', async () => {
      setupActiveConnection();
      const connectionsStore = useConnectionsStore();
      // Verify there IS an active session
      expect(connectionsStore.activeSessionId).toBe('conn-1');

      const { executeQuery, error } = useQuery();
      const result = await executeQuery('SELECT 1', 'nonexistent-tab-id');

      // Should NOT fall back to activeSessionId — should fail with no active connection
      expect(result).toBeNull();
      expect(error.value).toBe('No active connection');
      // The query should never be sent to any connection
      expect(window.api.query.execute).not.toHaveBeenCalled();
      expect(window.api.query.executeMultiple).not.toHaveBeenCalled();
    });
  });

  describe('history using getSavedConnectionId', () => {
    it('should save history with saved connection ID instead of session ID', async () => {
      const connectionsStore = useConnectionsStore();
      // Set up a session where session ID differs from saved connection ID
      connectionsStore.activeSessionId = 'session-abc';
      connectionsStore.sessions.set('session-abc', { savedConnectionId: 'saved-conn-42' });
      connectionsStore.connections = [
        {
          id: 'saved-conn-42',
          name: 'Test DB',
          type: DatabaseType.PostgreSQL,
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

      const queryResult = makeQueryResult({ executionTime: 75, rowCount: 3 });
      vi.mocked(window.api.query.execute).mockResolvedValueOnce(queryResult);

      const { executeQuery } = useQuery();
      await executeQuery('SELECT * FROM products');

      // The query should be executed against the session ID
      expect(window.api.query.execute).toHaveBeenCalledWith('session-abc', 'SELECT * FROM products', undefined, undefined);

      // History should be saved with the SAVED connection ID, not the session ID
      expect(window.api.history.add).toHaveBeenCalledWith(
        'saved-conn-42',
        'SELECT * FROM products',
        75,
        3,
        undefined
      );
    });
  });

});
