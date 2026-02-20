import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType } from '@main/types';
import type { ConnectionConfig } from '@main/types';
import { DUCKDB_DATA_TYPES } from '@main/types/schema-operations';

// --- Mock @duckdb/node-api ---
const {
  mockRun,
  mockGetRowObjectsJson,
  mockColumnNames,
  mockColumnType,
  mockCloseSync,
  mockInstanceCloseSync,
  mockInstanceConnect,
  mockCreate,
  mockInterrupt,
  mockStream,
} = vi.hoisted(() => {
  const mockGetRowObjectsJson = vi.fn().mockResolvedValue([]);
  const mockColumnNames = vi.fn().mockReturnValue([]);
  const mockColumnType = vi.fn().mockReturnValue('VARCHAR');

  const mockCloseSync = vi.fn();
  const mockInterrupt = vi.fn();
  const mockStream = vi.fn();
  const mockRun = vi.fn();

  const mockInstanceCloseSync = vi.fn();
  const mockInstanceConnect = vi.fn();

  const mockCreate = vi.fn();

  return {
    mockRun,
    mockGetRowObjectsJson,
    mockColumnNames,
    mockColumnType,
    mockCloseSync,
    mockInstanceCloseSync,
    mockInstanceConnect,
    mockCreate,
    mockInterrupt,
    mockStream,
  };
});

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: mockCreate,
  },
}));

// Mock fs
const mockStatSync = vi.hoisted(() => vi.fn());
vi.mock('fs', () => ({
  statSync: mockStatSync,
}));

// Mock knex for SQL generation only
const { mockKnexBuilder, mockKnexFn } = vi.hoisted(() => {
  const createBuilder = (): Record<string, ReturnType<typeof vi.fn>> => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ['select', 'from', 'where', 'count', 'limit', 'offset', 'orderBy',
      'insert', 'into', 'del', 'delete', 'clone', 'withSchema', 'whereNull',
      'whereNotNull', 'whereIn', 'whereNotIn', 'whereBetween', 'whereNotBetween',
      'whereRaw'];
    for (const m of methods) {
      builder[m] = vi.fn().mockImplementation(() => builder);
    }
    builder.toSQL = vi.fn().mockReturnValue({ sql: 'SELECT 1', bindings: [] });
    builder.toQuery = vi.fn().mockReturnValue('SELECT 1');
    builder.toString = vi.fn().mockReturnValue('SELECT 1');
    return builder;
  };
  const mockKnexBuilder = createBuilder();
  const mockKnexFn = vi.fn().mockReturnValue(mockKnexBuilder);
  (mockKnexFn as unknown as Record<string, unknown>).raw = vi.fn().mockReturnValue({ toString: () => 'RAW SQL' });
  return { mockKnexBuilder, mockKnexFn };
});

vi.mock('knex', () => ({
  default: vi.fn(() => mockKnexFn),
}));

// Mock DuckDBCursor
vi.mock('@main/db/cursors/DuckDBCursor', () => {
  return {
    DuckDBCursor: class MockDuckDBCursor {
      chunkSize: number;
      constructor(_connection: unknown, _sql: string, _params: unknown[], chunkSize: number) {
        this.chunkSize = chunkSize;
      }
      async start() {}
      async read() { return []; }
      async cancel() {}
    },
  };
});

import { DuckDBDriver } from '@main/db/duckdb';

describe('DuckDBDriver', () => {
  let driver: DuckDBDriver;
  const testConfig: ConnectionConfig = {
    id: 'test-duckdb',
    name: 'Test DuckDB',
    type: DatabaseType.DuckDB,
    database: 'test.duckdb',
    filepath: '/path/to/test.duckdb',
  };

  // Track rowsChanged as a mutable property
  let currentRowsChanged = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new DuckDBDriver();
    currentRowsChanged = 0;

    // Default mock implementations
    const mockResult = {
      getRowObjectsJson: mockGetRowObjectsJson,
      columnNames: mockColumnNames,
      columnType: mockColumnType,
      get rowsChanged() { return currentRowsChanged; },
    };

    mockRun.mockResolvedValue(mockResult);
    mockGetRowObjectsJson.mockResolvedValue([]);
    mockColumnNames.mockReturnValue([]);
    mockColumnType.mockReturnValue('VARCHAR');

    mockStatSync.mockReturnValue({ size: 1024 * 512 }); // 512 KB

    const mockConnection = {
      run: mockRun,
      closeSync: mockCloseSync,
      interrupt: mockInterrupt,
      stream: mockStream,
    };

    mockInstanceConnect.mockResolvedValue(mockConnection);

    mockCreate.mockResolvedValue({
      connect: mockInstanceConnect,
      closeSync: mockInstanceCloseSync,
    });
  });

  describe('type', () => {
    it('should have DuckDB type', () => {
      expect(driver.type).toBe(DatabaseType.DuckDB);
    });
  });

  describe('connect', () => {
    it('should connect successfully with filepath', async () => {
      await driver.connect(testConfig);

      expect(mockCreate).toHaveBeenCalledWith('/path/to/test.duckdb');
      expect(mockInstanceConnect).toHaveBeenCalled();
      expect(driver.isConnected).toBe(true);
    });

    it('should use database property when filepath is not provided', async () => {
      const config: ConnectionConfig = {
        id: 'test-2',
        name: 'Test DuckDB 2',
        type: DatabaseType.DuckDB,
        database: 'fallback.duckdb',
      };

      await driver.connect(config);

      expect(mockCreate).toHaveBeenCalledWith('fallback.duckdb');
    });

    it('should set isConnected to false and rethrow on failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Cannot open database'));

      const freshDriver = new DuckDBDriver();
      await expect(freshDriver.connect(testConfig)).rejects.toThrow('Cannot open database');
      expect(freshDriver.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close connection and instance and reset state', async () => {
      await driver.connect(testConfig);

      await driver.disconnect();

      expect(mockCloseSync).toHaveBeenCalled();
      expect(mockInstanceCloseSync).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await driver.disconnect();

      expect(mockCloseSync).not.toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should rollback active transaction on disconnect', async () => {
      await driver.connect(testConfig);
      await driver.beginTransaction();

      await driver.disconnect();

      // ROLLBACK is called on the transaction connection
      expect(mockRun).toHaveBeenCalledWith('ROLLBACK');
      // Transaction connection closeSync + main connection closeSync
      expect(mockCloseSync).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
      expect(driver.inTransaction).toBe(false);
    });

    it('should handle rollback failure on disconnect gracefully', async () => {
      await driver.connect(testConfig);
      await driver.beginTransaction();

      // Make ROLLBACK fail — the next mockRun call (on transactionConnection) will reject
      mockRun.mockRejectedValueOnce(new Error('rollback failed'));

      await driver.disconnect();

      expect(driver.isConnected).toBe(false);
      expect(driver.inTransaction).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return success with version and server info', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([{ version: 'v1.1.0' }]);

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.serverVersion).toBe('DuckDB v1.1.0');
    });

    it('should include file size in KB for small files', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([{ version: 'v1.1.0' }]);
      mockStatSync.mockReturnValue({ size: 1024 * 512 }); // 512 KB

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo).toBeDefined();
      expect(result.serverInfo!['File Size']).toBe('512.0 KB');
    });

    it('should include file size in MB for large files', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([{ version: 'v1.1.0' }]);
      mockStatSync.mockReturnValue({ size: 1024 * 1024 * 5 }); // 5 MB

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo!['File Size']).toBe('5.00 MB');
    });

    it('should skip file size for :memory: databases', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([{ version: 'v1.1.0' }]);

      const memoryConfig: ConnectionConfig = {
        id: 'test-mem',
        name: 'Memory DB',
        type: DatabaseType.DuckDB,
        filepath: ':memory:',
      };

      const result = await driver.testConnection(memoryConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo).toEqual({});
    });

    it('should handle statSync failure gracefully', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([{ version: 'v1.1.0' }]);
      mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo).toEqual({});
    });

    it('should return failure on connection error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('File not found'));

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should return Unknown when version query returns no rows', async () => {
      mockColumnNames.mockReturnValueOnce(['version']);
      mockGetRowObjectsJson.mockResolvedValueOnce([]);

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('DuckDB Unknown');
    });
  });

  describe('execute', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should execute SELECT queries and return rows', async () => {
      mockColumnNames.mockReturnValue(['id', 'name']);
      mockGetRowObjectsJson.mockResolvedValue([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);

      const result = await driver.execute('SELECT id, name FROM users');

      expect(mockRun).toHaveBeenCalledWith('SELECT id, name FROM users');
      expect(result.rows).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
      expect(result.rowCount).toBe(2);
    });

    it('should execute DML queries and return affected rows', async () => {
      const mockDMLResult = {
        getRowObjectsJson: vi.fn().mockResolvedValue([]),
        columnNames: vi.fn().mockReturnValue([]),
        columnType: vi.fn().mockReturnValue('VARCHAR'),
        get rowsChanged() { return 3; },
      };
      mockRun.mockResolvedValueOnce(mockDMLResult);

      const result = await driver.execute('INSERT INTO users VALUES (1, \'Alice\')');

      expect(result.affectedRows).toBe(3);
      expect(result.rows).toEqual([]);
    });

    it('should return error for failed queries', async () => {
      mockRun.mockRejectedValueOnce(new Error('Syntax error'));

      const result = await driver.execute('INVALID SQL');

      expect(result.error).toContain('Syntax error');
    });

    it('should handle parameterized SELECT queries', async () => {
      mockColumnNames.mockReturnValue(['id']);
      mockGetRowObjectsJson.mockResolvedValue([{ id: 1 }]);

      const result = await driver.execute('SELECT id FROM users WHERE name = ?', ['Alice']);

      expect(mockRun).toHaveBeenCalledWith('SELECT id FROM users WHERE name = ?', ['Alice']);
      expect(result.rows).toEqual([{ id: 1 }]);
    });

    it('should handle parameterized DML queries', async () => {
      const mockDMLResult = {
        getRowObjectsJson: vi.fn().mockResolvedValue([]),
        columnNames: vi.fn().mockReturnValue([]),
        columnType: vi.fn().mockReturnValue('VARCHAR'),
        get rowsChanged() { return 1; },
      };
      mockRun.mockResolvedValueOnce(mockDMLResult);

      const result = await driver.execute('UPDATE users SET name = ? WHERE id = ?', ['Bob', 1]);

      expect(mockRun).toHaveBeenCalledWith('UPDATE users SET name = ? WHERE id = ?', ['Bob', 1]);
      expect(result.affectedRows).toBe(1);
    });

    it('should throw when not connected', async () => {
      const freshDriver = new DuckDBDriver();
      await expect(freshDriver.execute('SELECT 1')).rejects.toThrow();
    });

    it('should recognize PRAGMA as select-like query', async () => {
      mockColumnNames.mockReturnValue(['value']);
      mockGetRowObjectsJson.mockResolvedValue([{ value: '10' }]);

      const result = await driver.execute('PRAGMA version');

      expect(result.rows).toEqual([{ value: '10' }]);
      expect(result.rowCount).toBe(1);
    });

    it('should recognize EXPLAIN as select-like query', async () => {
      mockColumnNames.mockReturnValue(['plan']);
      mockGetRowObjectsJson.mockResolvedValue([{ plan: 'Seq Scan' }]);

      const result = await driver.execute('EXPLAIN SELECT * FROM users');

      expect(result.rows).toHaveLength(1);
    });

    it('should recognize DESCRIBE as select-like query', async () => {
      mockColumnNames.mockReturnValue(['col']);
      mockGetRowObjectsJson.mockResolvedValue([{ col: 'id' }]);

      const result = await driver.execute('DESCRIBE users');

      expect(result.rows).toHaveLength(1);
    });

    it('should recognize SHOW as select-like query', async () => {
      mockColumnNames.mockReturnValue(['name']);
      mockGetRowObjectsJson.mockResolvedValue([{ name: 'users' }]);

      const result = await driver.execute('SHOW TABLES');

      expect(result.rows).toHaveLength(1);
    });

    it('should recognize WITH (CTE) as select-like query', async () => {
      mockColumnNames.mockReturnValue(['id']);
      mockGetRowObjectsJson.mockResolvedValue([{ id: 1 }]);

      const result = await driver.execute('WITH cte AS (SELECT 1 AS id) SELECT * FROM cte');

      expect(result.rows).toHaveLength(1);
    });

    it('should handle null values in row columns', async () => {
      mockColumnNames.mockReturnValue(['id', 'name']);
      mockGetRowObjectsJson.mockResolvedValue([
        { id: 1 },  // name is undefined
      ]);

      const result = await driver.execute('SELECT id, name FROM users');

      expect(result.rows[0].name).toBeNull();
    });

    it('should return columns with type info from SELECT', async () => {
      mockColumnNames.mockReturnValue(['id', 'name']);
      mockColumnType.mockImplementation((i: number) => i === 0 ? 'INTEGER' : 'VARCHAR');
      mockGetRowObjectsJson.mockResolvedValue([]);

      const result = await driver.execute('SELECT id, name FROM users');

      expect(result.columns).toHaveLength(2);
      expect(result.columns![0].name).toBe('id');
      expect(result.columns![0].type).toBe('INTEGER');
      expect(result.columns![1].name).toBe('name');
      expect(result.columns![1].type).toBe('VARCHAR');
    });

    it('should include executionTime in results', async () => {
      mockRun.mockRejectedValueOnce(new Error('fail'));

      const result = await driver.execute('BAD SQL');

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDatabases', () => {
    it('should return single database entry from filepath', async () => {
      await driver.connect(testConfig);

      const dbs = await driver.getDatabases();

      expect(dbs).toHaveLength(1);
      expect(dbs[0].name).toBe('test.duckdb');
    });

    it('should fallback to "main" when no path configured', async () => {
      const config: ConnectionConfig = {
        id: 'test-no-path',
        name: 'No Path',
        type: DatabaseType.DuckDB,
      };

      await driver.connect(config);

      const dbs = await driver.getDatabases();

      expect(dbs[0].name).toBe('main');
    });
  });

  describe('getTables', () => {
    it('should return tables and views from information_schema', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { table_name: 'users', table_type: 'BASE TABLE' },
        { table_name: 'active_users', table_type: 'VIEW' },
      ]);

      const tables = await driver.getTables('main');

      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual({ name: 'users', type: TableObjectType.Table });
      expect(tables[1]).toEqual({ name: 'active_users', type: TableObjectType.View });
    });
  });

  describe('getColumns', () => {
    it('should return columns with types and nullable info', async () => {
      await driver.connect(testConfig);

      // First call: columns query
      mockGetRowObjectsJson
        .mockResolvedValueOnce([
          { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
          { column_name: 'name', data_type: 'VARCHAR', is_nullable: 'YES', column_default: null, ordinal_position: 2 },
        ])
        // Second call: primary key query
        .mockResolvedValueOnce([
          { column_name: 'id' },
        ]);

      const columns = await driver.getColumns('users');

      expect(columns).toHaveLength(2);
      expect(columns[0].name).toBe('id');
      expect(columns[0].type).toBe('INTEGER');
      expect(columns[0].nullable).toBe(false);
      expect(columns[0].primaryKey).toBe(true);
      expect(columns[1].name).toBe('name');
      expect(columns[1].nullable).toBe(true);
      expect(columns[1].primaryKey).toBe(false);
    });

    it('should include defaultValue and autoIncrement fields', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson
        .mockResolvedValueOnce([
          { column_name: 'status', data_type: 'VARCHAR', is_nullable: 'YES', column_default: "'active'", ordinal_position: 1 },
        ])
        .mockResolvedValueOnce([]);

      const columns = await driver.getColumns('users');

      expect(columns[0].defaultValue).toBe("'active'");
      expect(columns[0].autoIncrement).toBe(false);
      expect(columns[0].unique).toBe(false);
    });
  });

  describe('getIndexes', () => {
    it('should return indexes from duckdb_indexes()', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { index_name: 'idx_users_email', is_unique: true, sql: 'CREATE UNIQUE INDEX idx_users_email ON users ("email")' },
      ]);

      const indexes = await driver.getIndexes('users');

      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('idx_users_email');
      expect(indexes[0].unique).toBe(true);
      expect(indexes[0].columns).toEqual(['email']);
    });

    it('should handle is_unique as string "true"', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { index_name: 'idx_test', is_unique: 'true', sql: 'CREATE INDEX idx_test ON t ("col")' },
      ]);

      const indexes = await driver.getIndexes('t');

      expect(indexes[0].unique).toBe(true);
    });

    it('should handle indexes without parseable SQL', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { index_name: 'idx_no_sql', is_unique: false, sql: null },
      ]);

      const indexes = await driver.getIndexes('t');

      expect(indexes[0].columns).toEqual([]);
    });

    it('should handle multi-column indexes', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { index_name: 'idx_multi', is_unique: false, sql: 'CREATE INDEX idx_multi ON t ("col1", "col2", "col3")' },
      ]);

      const indexes = await driver.getIndexes('t');

      expect(indexes[0].columns).toEqual(['col1', 'col2', 'col3']);
    });

    it('should return empty array on error', async () => {
      await driver.connect(testConfig);

      mockRun.mockRejectedValueOnce(new Error('query failed'));

      const indexes = await driver.getIndexes('nonexistent');
      expect(indexes).toEqual([]);
    });
  });

  describe('getForeignKeys', () => {
    it('should return foreign keys from information_schema', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        {
          constraint_name: 'fk_orders_user',
          column_name: 'user_id',
          referenced_table: 'users',
          referenced_column: 'id',
        },
      ]);

      const fks = await driver.getForeignKeys('orders');

      expect(fks).toHaveLength(1);
      expect(fks[0].name).toBe('fk_orders_user');
      expect(fks[0].column).toBe('user_id');
      expect(fks[0].referencedTable).toBe('users');
      expect(fks[0].referencedColumn).toBe('id');
    });

    it('should return empty array on error', async () => {
      await driver.connect(testConfig);

      mockRun.mockRejectedValueOnce(new Error('query failed'));

      const fks = await driver.getForeignKeys('nonexistent');
      expect(fks).toEqual([]);
    });
  });

  describe('getTableDDL', () => {
    it('should return table DDL from duckdb_tables()', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR)' },
      ]);

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toBe('CREATE TABLE users (id INTEGER PRIMARY KEY, name VARCHAR)');
    });

    it('should fallback to view DDL from duckdb_views()', async () => {
      await driver.connect(testConfig);

      // First call: duckdb_tables() — empty
      mockGetRowObjectsJson.mockResolvedValueOnce([]);
      // Second call: duckdb_views() — found
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { sql: 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = true' },
      ]);

      const ddl = await driver.getTableDDL('active_users');

      expect(ddl).toBe('CREATE VIEW active_users AS SELECT * FROM users WHERE active = true');
    });

    it('should return empty string when not found', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([]);
      mockGetRowObjectsJson.mockResolvedValueOnce([]);

      const ddl = await driver.getTableDDL('nonexistent');
      expect(ddl).toBe('');
    });

    it('should return empty string on error', async () => {
      await driver.connect(testConfig);

      mockRun.mockRejectedValueOnce(new Error('query failed'));

      const ddl = await driver.getTableDDL('broken');
      expect(ddl).toBe('');
    });
  });

  describe('getTableData', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should return table data with count and rows', async () => {
      // getColumns: columns query
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
      ]);
      // getColumns: primary key query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ column_name: 'id' }]);
      // Count query result
      mockGetRowObjectsJson.mockResolvedValueOnce([{ count: 100 }]);
      // Data query result
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await driver.getTableData('users', { limit: 50, offset: 0 });

      expect(result.totalCount).toBe(100);
      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
      expect(result.columns).toHaveLength(1);
      expect(result.columns[0].name).toBe('id');
    });

    it('should use knownTotalCount when provided', async () => {
      // getColumns: columns query
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
      ]);
      // getColumns: primary key query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ column_name: 'id' }]);
      // Data query result
      mockGetRowObjectsJson.mockResolvedValueOnce([{ id: 1 }]);

      const result = await driver.getTableData('users', { limit: 10, offset: 0, knownTotalCount: 42 });

      expect(result.totalCount).toBe(42);
    });

    it('should default offset and limit when not provided', async () => {
      // getColumns: columns query
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
      ]);
      // getColumns: primary key query
      mockGetRowObjectsJson.mockResolvedValueOnce([]);
      // Count query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ count: 5 }]);
      // Data query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

      const result = await driver.getTableData('users', {});

      expect(result.offset).toBe(0);
      expect(result.limit).toBe(3); // falls back to rows.length
    });
  });

  describe('queryStream', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should return stream result with cursor', async () => {
      // Count query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ count: 500 }]);
      // getColumnsFromQuery: run with LIMIT 0
      mockColumnNames.mockReturnValueOnce(['id', 'name']);
      mockColumnType
        .mockReturnValueOnce('INTEGER')
        .mockReturnValueOnce('VARCHAR');

      const result = await driver.queryStream('SELECT * FROM users', 100);

      expect(result.totalRows).toBe(500);
      expect(result.columns).toHaveLength(2);
      expect(result.cursor).toBeDefined();
    });

    it('should handle count query failure gracefully', async () => {
      // Count query fails
      mockRun
        .mockRejectedValueOnce(new Error('count failed'))
        // getColumnsFromQuery: LIMIT 0 query
        .mockResolvedValueOnce({
          getRowObjectsJson: vi.fn().mockResolvedValue([]),
          columnNames: vi.fn().mockReturnValue([]),
          columnType: vi.fn().mockReturnValue('VARCHAR'),
          get rowsChanged() { return 0; },
        });

      const result = await driver.queryStream('SELECT * FROM bad_table', 100);

      expect(result.totalRows).toBe(0);
    });

    it('should return empty columns when getColumnsFromQuery fails', async () => {
      // Count query succeeds
      mockGetRowObjectsJson.mockResolvedValueOnce([{ count: 10 }]);
      // getColumnsFromQuery: LIMIT 0 query fails
      mockRun
        .mockResolvedValueOnce({
          getRowObjectsJson: mockGetRowObjectsJson,
          columnNames: mockColumnNames,
          columnType: mockColumnType,
          get rowsChanged() { return 0; },
        })
        .mockRejectedValueOnce(new Error('invalid query'));

      const result = await driver.queryStream('SELECT bad FROM nonexistent', 100);

      expect(result.totalRows).toBe(10);
      expect(result.columns).toEqual([]);
    });
  });

  describe('selectTopStream', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should return stream result for table data', async () => {
      // Count query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ count: 200 }]);
      // getColumns: columns query
      mockGetRowObjectsJson.mockResolvedValueOnce([
        { column_name: 'id', data_type: 'INTEGER', is_nullable: 'NO', column_default: null, ordinal_position: 1 },
      ]);
      // getColumns: primary key query
      mockGetRowObjectsJson.mockResolvedValueOnce([{ column_name: 'id' }]);

      const result = await driver.selectTopStream('users', { limit: 50, offset: 0 }, 100);

      expect(result.totalRows).toBe(200);
      expect(result.columns).toHaveLength(1);
      expect(result.cursor).toBeDefined();
    });
  });

  describe('getDataTypes', () => {
    it('should return DuckDB data types', () => {
      const types = driver.getDataTypes();
      expect(types).toBe(DUCKDB_DATA_TYPES);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('getPrimaryKeyColumns', () => {
    it('should return primary key column names', async () => {
      await driver.connect(testConfig);

      mockGetRowObjectsJson.mockResolvedValueOnce([
        { column_name: 'id' },
        { column_name: 'tenant_id' },
      ]);

      const pks = await driver.getPrimaryKeyColumns('users');

      expect(pks).toEqual(['id', 'tenant_id']);
    });

    it('should return empty array on error', async () => {
      await driver.connect(testConfig);

      mockRun.mockRejectedValueOnce(new Error('query failed'));

      const pks = await driver.getPrimaryKeyColumns('nonexistent');
      expect(pks).toEqual([]);
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should support transactions', () => {
      expect(driver.supportsTransactions).toBe(true);
    });

    it('should track inTransaction state', async () => {
      expect(driver.inTransaction).toBe(false);
      await driver.beginTransaction();
      expect(driver.inTransaction).toBe(true);
      await driver.commitTransaction();
      expect(driver.inTransaction).toBe(false);
    });

    it('should create a separate connection for transactions', async () => {
      // connect() calls instance.connect() once for the main connection
      expect(mockInstanceConnect).toHaveBeenCalledTimes(1);

      await driver.beginTransaction();

      // beginTransaction() calls instance.connect() again for the transaction connection
      expect(mockInstanceConnect).toHaveBeenCalledTimes(2);
      expect(mockRun).toHaveBeenCalledWith('BEGIN TRANSACTION');
    });

    it('should commit a transaction and close the transaction connection', async () => {
      await driver.beginTransaction();
      await driver.commitTransaction();
      expect(mockRun).toHaveBeenCalledWith('COMMIT');
      // Transaction connection closeSync is called
      expect(mockCloseSync).toHaveBeenCalled();
    });

    it('should rollback a transaction and close the transaction connection', async () => {
      await driver.beginTransaction();
      await driver.rollbackTransaction();
      expect(mockRun).toHaveBeenCalledWith('ROLLBACK');
      // Transaction connection closeSync is called
      expect(mockCloseSync).toHaveBeenCalled();
    });

    it('should throw when beginning transaction while one is active', async () => {
      await driver.beginTransaction();
      await expect(driver.beginTransaction()).rejects.toThrow('Transaction already active');
    });

    it('should throw when committing without active transaction', async () => {
      await expect(driver.commitTransaction()).rejects.toThrow('No active transaction');
    });

    it('should throw when rolling back without active transaction', async () => {
      await expect(driver.rollbackTransaction()).rejects.toThrow('No active transaction');
    });

    it('should route execute to transaction connection when useTransaction is true', async () => {
      await driver.beginTransaction();
      vi.clearAllMocks();

      // Re-setup mock for the run call
      const mockResult = {
        getRowObjectsJson: mockGetRowObjectsJson,
        columnNames: mockColumnNames,
        columnType: mockColumnType,
        get rowsChanged() { return 1; },
      };
      mockRun.mockResolvedValue(mockResult);
      mockGetRowObjectsJson.mockResolvedValue([]);

      await driver.execute("UPDATE categories SET name = 'Test' WHERE id = 1", [], true);

      // The execute call should go through the transaction connection's run (same mock)
      expect(mockRun).toHaveBeenCalledWith("UPDATE categories SET name = 'Test' WHERE id = 1");
    });

    it('should route execute to main connection when useTransaction is false', async () => {
      await driver.beginTransaction();
      vi.clearAllMocks();

      const mockResult = {
        getRowObjectsJson: mockGetRowObjectsJson,
        columnNames: mockColumnNames,
        columnType: mockColumnType,
        get rowsChanged() { return 0; },
      };
      mockRun.mockResolvedValue(mockResult);
      mockColumnNames.mockReturnValue(['id']);
      mockGetRowObjectsJson.mockResolvedValue([{ id: 1 }]);

      // useTransaction=false should use main connection even when transaction is active
      const result = await driver.execute('SELECT * FROM categories', [], false);

      expect(result.rows).toEqual([{ id: 1 }]);
      expect(mockRun).toHaveBeenCalledWith('SELECT * FROM categories');
    });
  });

  describe('unsupported operations', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should return empty array for getRoutines', async () => {
      const routines = await driver.getRoutines();
      expect(routines).toEqual([]);
    });

    it('should return info message for getRoutineDefinition', async () => {
      const def = await driver.getRoutineDefinition('proc1');
      expect(def).toContain('does not support');
    });

    it('should return empty array for getUsers', async () => {
      const users = await driver.getUsers();
      expect(users).toEqual([]);
    });

    it('should return failure for createUser', async () => {
      const result = await driver.createUser({ name: 'test', password: 'pass' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return failure for dropUser', async () => {
      const result = await driver.dropUser({ name: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return empty array for getTriggers', async () => {
      const triggers = await driver.getTriggers();
      expect(triggers).toEqual([]);
    });

    it('should return info message for getTriggerDefinition', async () => {
      const def = await driver.getTriggerDefinition('trigger1');
      expect(def).toContain('does not support');
    });

    it('should return failure for createTrigger', async () => {
      const result = await driver.createTrigger({
        name: 'test_trigger',
        table: 'users',
        timing: 'BEFORE',
        event: 'INSERT',
        body: 'SELECT 1',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return failure for dropTrigger', async () => {
      const result = await driver.dropTrigger({ name: 'test_trigger', table: 'users' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return failure for modifyColumn', async () => {
      const result = await driver.modifyColumn({ table: 'users', column: 'name', newType: 'TEXT' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return failure for addForeignKey', async () => {
      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: { name: 'fk_test', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return failure for dropForeignKey', async () => {
      const result = await driver.dropForeignKey({ table: 'orders', foreignKeyName: 'fk_test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });
  });

  describe('schema operations', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    describe('addColumn', () => {
      it('should add a nullable column', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'email', type: 'VARCHAR', nullable: true },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN'));
      });

      it('should add a NOT NULL column with default value', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'status', type: 'VARCHAR', nullable: false, defaultValue: 'active' },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('NOT NULL'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining("DEFAULT 'active'"));
      });

      it('should add a column with numeric default value', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'age', type: 'INTEGER', nullable: true, defaultValue: 0 },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DEFAULT 0'));
      });

      it('should reject adding PRIMARY KEY column', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'id2', type: 'INTEGER', nullable: false, primaryKey: true },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('PRIMARY KEY');
      });

      it('should reject NOT NULL column without default value', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'required_field', type: 'VARCHAR', nullable: false },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('default value');
      });

      it('should handle column with length', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'code', type: 'VARCHAR', nullable: true, length: 10 },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('VARCHAR(10)'));
      });

      it('should handle column with precision and scale', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'price', type: 'DECIMAL', nullable: true, precision: 10, scale: 2 },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DECIMAL(10,2)'));
      });

      it('should handle column with precision only', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'num', type: 'DECIMAL', nullable: true, precision: 5 },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DECIMAL(5)'));
      });

      it('should escape single quotes in string default values', async () => {
        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'bio', type: 'VARCHAR', nullable: true, defaultValue: "it's a test" },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining("it''s a test"));
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('column already exists'));

        const result = await driver.addColumn({
          table: 'users',
          column: { name: 'email', type: 'VARCHAR', nullable: true },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('column already exists');
      });
    });

    describe('dropColumn', () => {
      it('should drop a column', async () => {
        const result = await driver.dropColumn({ table: 'users', columnName: 'email' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('ALTER TABLE "users" DROP COLUMN "email"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('column not found'));

        const result = await driver.dropColumn({ table: 'users', columnName: 'nonexistent' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('column not found');
      });
    });

    describe('renameColumn', () => {
      it('should rename a column', async () => {
        const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('ALTER TABLE "users" RENAME COLUMN "name" TO "full_name"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('column not found'));

        const result = await driver.renameColumn({ table: 'users', oldName: 'x', newName: 'y' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('column not found');
      });
    });

    describe('createIndex', () => {
      it('should create a non-unique index', async () => {
        const result = await driver.createIndex({
          table: 'users',
          index: { name: 'idx_email', columns: ['email'], unique: false },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('CREATE INDEX "idx_email" ON "users" ("email")');
      });

      it('should create a unique index', async () => {
        const result = await driver.createIndex({
          table: 'users',
          index: { name: 'idx_email_unique', columns: ['email'], unique: true },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('CREATE UNIQUE INDEX "idx_email_unique" ON "users" ("email")');
      });

      it('should create a multi-column index', async () => {
        const result = await driver.createIndex({
          table: 'users',
          index: { name: 'idx_name_email', columns: ['name', 'email'], unique: false },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('CREATE INDEX "idx_name_email" ON "users" ("name", "email")');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('index already exists'));

        const result = await driver.createIndex({
          table: 'users',
          index: { name: 'idx_dup', columns: ['email'], unique: false },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('index already exists');
      });
    });

    describe('dropIndex', () => {
      it('should drop an index', async () => {
        const result = await driver.dropIndex({ table: 'users', indexName: 'idx_email' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('DROP INDEX "idx_email"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('index not found'));

        const result = await driver.dropIndex({ table: 'users', indexName: 'nonexistent' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('index not found');
      });
    });

    describe('createTable', () => {
      it('should create a simple table', async () => {
        const result = await driver.createTable({
          table: {
            name: 'products',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'name', type: 'VARCHAR', nullable: false },
            ],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE "products"'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('"id" INTEGER PRIMARY KEY'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('"name" VARCHAR NOT NULL'));
      });

      it('should create a table with composite primary key', async () => {
        const result = await driver.createTable({
          table: {
            name: 'order_items',
            columns: [
              { name: 'order_id', type: 'INTEGER', nullable: false },
              { name: 'product_id', type: 'INTEGER', nullable: false },
              { name: 'quantity', type: 'INTEGER', nullable: false },
            ],
            primaryKey: ['order_id', 'product_id'],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('PRIMARY KEY ("order_id", "product_id")'));
      });

      it('should not add composite PK clause when inline PK exists', async () => {
        const result = await driver.createTable({
          table: {
            name: 'test',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            ],
            primaryKey: ['id'],
          },
        });
        expect(result.success).toBe(true);
        const sql = mockRun.mock.calls[0][0] as string;
        // Should NOT have a separate PRIMARY KEY clause since id already has inline PK
        expect(sql.match(/PRIMARY KEY/g)?.length).toBe(1);
      });

      it('should create a table with foreign keys', async () => {
        const result = await driver.createTable({
          table: {
            name: 'orders',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'user_id', type: 'INTEGER', nullable: false },
            ],
            foreignKeys: [
              {
                name: 'fk_user',
                columns: ['user_id'],
                referencedTable: 'users',
                referencedColumns: ['id'],
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
              },
            ],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CONSTRAINT "fk_user"'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('REFERENCES "users"'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('ON UPDATE CASCADE'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('ON DELETE SET NULL'));
      });

      it('should create a table with indexes', async () => {
        const result = await driver.createTable({
          table: {
            name: 'products',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'sku', type: 'VARCHAR', nullable: false },
            ],
            indexes: [
              { name: 'idx_sku', columns: ['sku'], unique: true },
            ],
          },
        });
        expect(result.success).toBe(true);
        // createTable + createIndex
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CREATE UNIQUE INDEX'));
      });

      it('should handle column with unique constraint', async () => {
        const result = await driver.createTable({
          table: {
            name: 'test',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'email', type: 'VARCHAR', nullable: false, unique: true },
            ],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('"email" VARCHAR NOT NULL UNIQUE'));
      });

      it('should handle column with default value', async () => {
        const result = await driver.createTable({
          table: {
            name: 'test',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'status', type: 'VARCHAR', nullable: true, defaultValue: 'pending' },
            ],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining("DEFAULT 'pending'"));
      });

      it('should handle column with length, precision, and scale', async () => {
        const result = await driver.createTable({
          table: {
            name: 'test',
            columns: [
              { name: 'code', type: 'VARCHAR', nullable: true, length: 5 },
              { name: 'price', type: 'DECIMAL', nullable: true, precision: 10, scale: 2 },
              { name: 'amount', type: 'DECIMAL', nullable: true, precision: 8 },
            ],
          },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('VARCHAR(5)'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DECIMAL(10,2)'));
        expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DECIMAL(8)'));
      });

      it('should handle column with numeric default value', async () => {
        const result = await driver.createTable({
          table: {
            name: 'test',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'quantity', type: 'INTEGER', nullable: true, defaultValue: 0 },
              { name: 'price', type: 'DOUBLE', nullable: true, defaultValue: 9.99 },
            ],
          },
        });
        expect(result.success).toBe(true);
        const sql = mockRun.mock.calls[0][0] as string;
        // Numeric defaults should NOT be quoted
        expect(sql).toContain('DEFAULT 0');
        expect(sql).toContain('DEFAULT 9.99');
        expect(sql).not.toContain("DEFAULT '0'");
        expect(sql).not.toContain("DEFAULT '9.99'");
      });

      it('should create a table with FK without onUpdate/onDelete', async () => {
        const result = await driver.createTable({
          table: {
            name: 'orders',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
              { name: 'user_id', type: 'INTEGER', nullable: false },
            ],
            foreignKeys: [
              {
                name: 'fk_user',
                columns: ['user_id'],
                referencedTable: 'users',
                referencedColumns: ['id'],
              },
            ],
          },
        });
        expect(result.success).toBe(true);
        const sql = mockRun.mock.calls[0][0] as string;
        expect(sql).toContain('CONSTRAINT "fk_user"');
        expect(sql).toContain('REFERENCES "users"');
        // Should NOT contain ON UPDATE or ON DELETE clauses
        expect(sql).not.toContain('ON UPDATE');
        expect(sql).not.toContain('ON DELETE');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('table already exists'));

        const result = await driver.createTable({
          table: {
            name: 'existing',
            columns: [
              { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            ],
          },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('table already exists');
      });
    });

    describe('dropTable', () => {
      it('should drop a table', async () => {
        const result = await driver.dropTable({ table: 'users' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('DROP TABLE "users"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('table not found'));

        const result = await driver.dropTable({ table: 'nonexistent' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('table not found');
      });
    });

    describe('renameTable', () => {
      it('should rename a table', async () => {
        const result = await driver.renameTable({ oldName: 'users', newName: 'people' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('ALTER TABLE "users" RENAME TO "people"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('table not found'));

        const result = await driver.renameTable({ oldName: 'x', newName: 'y' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('table not found');
      });
    });

    describe('insertRow', () => {
      it('should insert a row and return affected rows', async () => {
        const mockInsertResult = {
          getRowObjectsJson: vi.fn().mockResolvedValue([]),
          columnNames: vi.fn().mockReturnValue([]),
          columnType: vi.fn().mockReturnValue('VARCHAR'),
          get rowsChanged() { return 1; },
        };
        mockRun.mockResolvedValueOnce(mockInsertResult);

        const result = await driver.insertRow({
          table: 'users',
          values: { name: 'Alice', email: 'alice@example.com' },
        });

        expect(result.success).toBe(true);
        expect(result.affectedRows).toBe(1);
      });

      it('should return error on insert failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('constraint violation'));

        const result = await driver.insertRow({
          table: 'users',
          values: { name: 'Alice' },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('constraint violation');
      });
    });

    describe('deleteRow', () => {
      it('should delete a row and return affected rows', async () => {
        const mockDeleteResult = {
          getRowObjectsJson: vi.fn().mockResolvedValue([]),
          columnNames: vi.fn().mockReturnValue([]),
          columnType: vi.fn().mockReturnValue('VARCHAR'),
          get rowsChanged() { return 1; },
        };
        mockRun.mockResolvedValueOnce(mockDeleteResult);

        const result = await driver.deleteRow({
          table: 'users',
          primaryKeyValues: { id: 1 },
        });

        expect(result.success).toBe(true);
        expect(result.affectedRows).toBe(1);
      });

      it('should return error on delete failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('foreign key constraint'));

        const result = await driver.deleteRow({
          table: 'users',
          primaryKeyValues: { id: 1 },
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('foreign key constraint');
      });
    });

    describe('createView', () => {
      it('should create a view', async () => {
        const result = await driver.createView({
          view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = true', replaceIfExists: false },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('CREATE VIEW "active_users" AS SELECT * FROM users WHERE active = true');
      });

      it('should create or replace a view', async () => {
        const result = await driver.createView({
          view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = true', replaceIfExists: true },
        });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('CREATE OR REPLACE VIEW "active_users" AS SELECT * FROM users WHERE active = true');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('syntax error'));

        const result = await driver.createView({
          view: { name: 'bad_view', selectStatement: 'INVALID SQL', replaceIfExists: false },
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain('syntax error');
      });
    });

    describe('dropView', () => {
      it('should drop a view', async () => {
        const result = await driver.dropView({ viewName: 'active_users' });
        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('DROP VIEW IF EXISTS "active_users"');
      });

      it('should return error on failure', async () => {
        mockRun.mockRejectedValueOnce(new Error('permission denied'));

        const result = await driver.dropView({ viewName: 'protected_view' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('permission denied');
      });
    });

    describe('renameView', () => {
      it('should rename a view by dropping and recreating', async () => {
        // getViewDDL query
        mockGetRowObjectsJson.mockResolvedValueOnce([
          { sql: 'CREATE VIEW old_view AS SELECT id, name FROM users WHERE active = true' },
        ]);

        const result = await driver.renameView({ oldName: 'old_view', newName: 'new_view' });

        expect(result.success).toBe(true);
        expect(mockRun).toHaveBeenCalledWith('DROP VIEW "old_view"');
        expect(mockRun).toHaveBeenCalledWith('CREATE VIEW "new_view" AS SELECT id, name FROM users WHERE active = true');
      });

      it('should return error when view DDL cannot be parsed', async () => {
        // getViewDDL returns DDL without recognizable SELECT
        mockGetRowObjectsJson.mockResolvedValueOnce([
          { sql: 'SOMETHING WEIRD' },
        ]);

        const result = await driver.renameView({ oldName: 'bad_view', newName: 'new_view' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Could not parse view definition');
      });

      it('should return error on drop/create failure', async () => {
        // 1st mockRun call: getViewDDL → returns DDL via default mockGetRowObjectsJson
        mockGetRowObjectsJson.mockResolvedValueOnce([
          { sql: 'CREATE VIEW v AS SELECT 1 AS id' },
        ]);

        // After getViewDDL returns, renameView calls DROP then CREATE.
        // We need calls 2 and 3 to be: DROP succeeds, CREATE fails.
        // The default mockRun resolves for call 1 (getViewDDL).
        // Override calls 2 & 3 by queueing after the default is consumed:
        const defaultResult = {
          getRowObjectsJson: mockGetRowObjectsJson,
          columnNames: mockColumnNames,
          columnType: mockColumnType,
          get rowsChanged() { return 0; },
        };
        mockRun
          .mockResolvedValueOnce(defaultResult)  // call 1: getViewDDL
          .mockResolvedValueOnce(defaultResult)  // call 2: DROP
          .mockRejectedValueOnce(new Error('create failed'));  // call 3: CREATE

        const result = await driver.renameView({ oldName: 'v', newName: 'v2' });

        expect(result.success).toBe(false);
        expect(result.error).toContain('create failed');
      });
    });

    describe('getViewDDL', () => {
      it('should return view DDL', async () => {
        await driver.connect(testConfig);

        mockGetRowObjectsJson.mockResolvedValueOnce([
          { sql: 'CREATE VIEW test_view AS SELECT 1' },
        ]);

        const ddl = await driver.getViewDDL('test_view');

        expect(ddl).toBe('CREATE VIEW test_view AS SELECT 1');
      });

      it('should return empty string when view not found', async () => {
        await driver.connect(testConfig);

        mockGetRowObjectsJson.mockResolvedValueOnce([]);

        const ddl = await driver.getViewDDL('nonexistent');

        expect(ddl).toBe('');
      });

      it('should return empty string on error', async () => {
        await driver.connect(testConfig);

        mockRun.mockRejectedValueOnce(new Error('query failed'));

        const ddl = await driver.getViewDDL('broken');

        expect(ddl).toBe('');
      });

      it('should handle row with null sql field', async () => {
        await driver.connect(testConfig);

        mockGetRowObjectsJson.mockResolvedValueOnce([{ sql: null }]);

        const ddl = await driver.getViewDDL('null_view');

        expect(ddl).toBe('');
      });
    });
  });

  describe('ping', () => {
    it('should return true when connected', async () => {
      await driver.connect(testConfig);
      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when ping query fails', async () => {
      await driver.connect(testConfig);
      mockRun.mockRejectedValueOnce(new Error('connection lost'));

      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  describe('cancelQuery', () => {
    it('should call interrupt on connection', async () => {
      await driver.connect(testConfig);
      const result = await driver.cancelQuery();
      expect(result).toBe(true);
      expect(mockInterrupt).toHaveBeenCalled();
    });

    it('should return false when not connected', async () => {
      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });

    it('should return false when interrupt throws', async () => {
      await driver.connect(testConfig);
      mockInterrupt.mockImplementation(() => { throw new Error('interrupt failed'); });

      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });
  });
});
