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
  mockRowsChanged,
  mockCloseSync,
  mockInstanceCloseSync,
  mockInstanceConnect,
  mockCreate,
  mockInterrupt,
} = vi.hoisted(() => {
  const mockGetRowObjectsJson = vi.fn().mockResolvedValue([]);
  const mockColumnNames = vi.fn().mockReturnValue([]);
  const mockColumnType = vi.fn().mockReturnValue('VARCHAR');
  const mockRowsChanged = 0;

  const mockResult = {
    getRowObjectsJson: mockGetRowObjectsJson,
    columnNames: mockColumnNames,
    columnType: mockColumnType,
    get rowsChanged() { return mockRowsChanged; },
  };

  const mockCloseSync = vi.fn();
  const mockInterrupt = vi.fn();
  const mockRun = vi.fn().mockResolvedValue(mockResult);

  const mockConnection = {
    run: mockRun,
    closeSync: mockCloseSync,
    interrupt: mockInterrupt,
  };

  const mockInstanceCloseSync = vi.fn();
  const mockInstanceConnect = vi.fn().mockResolvedValue(mockConnection);

  const mockCreate = vi.fn().mockResolvedValue({
    connect: mockInstanceConnect,
    closeSync: mockInstanceCloseSync,
  });

  return {
    mockRun,
    mockGetRowObjectsJson,
    mockColumnNames,
    mockColumnType,
    mockRowsChanged,
    mockCloseSync,
    mockInstanceCloseSync,
    mockInstanceConnect,
    mockCreate,
    mockInterrupt,
  };
});

vi.mock('@duckdb/node-api', () => ({
  DuckDBInstance: {
    create: mockCreate,
  },
}));

// Mock fs
vi.mock('fs', () => ({
  statSync: vi.fn(() => ({
    size: 1024 * 512, // 512 KB
  })),
}));

// Mock knex for SQL generation only
vi.mock('knex', () => ({
  default: vi.fn(() => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      count: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      toSQL: vi.fn().mockReturnValue({ sql: 'SELECT 1', bindings: [] }),
      toQuery: vi.fn().mockReturnValue('SELECT 1'),
      toString: vi.fn().mockReturnValue('SELECT 1'),
    };
    const knexFn = vi.fn().mockReturnValue(builder);
    knexFn.raw = vi.fn().mockReturnValue({ toString: () => 'RAW SQL' });
    return knexFn;
  }),
}));

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
    vi.resetAllMocks();
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

    const mockConnection = {
      run: mockRun,
      closeSync: mockCloseSync,
      interrupt: mockInterrupt,
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

    it('should return failure on connection error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('File not found'));

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
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
      currentRowsChanged = 3;

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

    it('should throw when not connected', async () => {
      const freshDriver = new DuckDBDriver();
      await expect(freshDriver.execute('SELECT 1')).rejects.toThrow();
    });
  });

  describe('getDatabases', () => {
    it('should return single database entry from filepath', async () => {
      await driver.connect(testConfig);

      const dbs = await driver.getDatabases();

      expect(dbs).toHaveLength(1);
      expect(dbs[0].name).toBe('test.duckdb');
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
  });

  describe('getDataTypes', () => {
    it('should return DuckDB data types', () => {
      const types = driver.getDataTypes();
      expect(types).toBe(DUCKDB_DATA_TYPES);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should support transactions', () => {
      expect(driver.supportsTransactions).toBe(true);
    });

    it('should begin a transaction', async () => {
      await driver.beginTransaction();
      expect(mockRun).toHaveBeenCalledWith('BEGIN TRANSACTION');
    });

    it('should commit a transaction', async () => {
      await driver.beginTransaction();
      await driver.commitTransaction();
      expect(mockRun).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback a transaction', async () => {
      await driver.beginTransaction();
      await driver.rollbackTransaction();
      expect(mockRun).toHaveBeenCalledWith('ROLLBACK');
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
  });

  describe('unsupported operations', () => {
    it('should return empty array for getRoutines', async () => {
      await driver.connect(testConfig);
      const routines = await driver.getRoutines();
      expect(routines).toEqual([]);
    });

    it('should return info message for getRoutineDefinition', async () => {
      await driver.connect(testConfig);
      const def = await driver.getRoutineDefinition('proc1');
      expect(def).toContain('does not support');
    });

    it('should return empty array for getUsers', async () => {
      await driver.connect(testConfig);
      const users = await driver.getUsers();
      expect(users).toEqual([]);
    });

    it('should return failure for createUser', async () => {
      await driver.connect(testConfig);
      const result = await driver.createUser({ name: 'test', password: 'pass' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return failure for dropUser', async () => {
      await driver.connect(testConfig);
      const result = await driver.dropUser({ name: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return empty array for getTriggers', async () => {
      await driver.connect(testConfig);
      const triggers = await driver.getTriggers();
      expect(triggers).toEqual([]);
    });

    it('should return info message for getTriggerDefinition', async () => {
      await driver.connect(testConfig);
      const def = await driver.getTriggerDefinition('trigger1');
      expect(def).toContain('does not support');
    });

    it('should return failure for createTrigger', async () => {
      await driver.connect(testConfig);
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
      await driver.connect(testConfig);
      const result = await driver.dropTrigger({ name: 'test_trigger', table: 'users' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });

    it('should return failure for modifyColumn', async () => {
      await driver.connect(testConfig);
      const result = await driver.modifyColumn({ table: 'users', column: 'name', newType: 'TEXT' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return failure for addForeignKey', async () => {
      await driver.connect(testConfig);
      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: { name: 'fk_test', columns: ['user_id'], referencedTable: 'users', referencedColumns: ['id'] },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });

    it('should return failure for dropForeignKey', async () => {
      await driver.connect(testConfig);
      const result = await driver.dropForeignKey({ table: 'orders', foreignKeyName: 'fk_test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });
  });

  describe('schema operations', () => {
    beforeEach(async () => {
      await driver.connect(testConfig);
    });

    it('should add a column', async () => {
      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'email', type: 'VARCHAR', nullable: true },
      });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN'));
    });

    it('should drop a column', async () => {
      const result = await driver.dropColumn({ table: 'users', columnName: 'email' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DROP COLUMN'));
    });

    it('should rename a column', async () => {
      const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('RENAME COLUMN'));
    });

    it('should create an index', async () => {
      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_email', columns: ['email'], unique: false },
      });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CREATE'));
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('INDEX'));
    });

    it('should drop an index', async () => {
      const result = await driver.dropIndex({ table: 'users', indexName: 'idx_email' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DROP INDEX'));
    });

    it('should drop a table', async () => {
      const result = await driver.dropTable({ table: 'users' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE'));
    });

    it('should rename a table', async () => {
      const result = await driver.renameTable({ oldName: 'users', newName: 'people' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('RENAME TO'));
    });

    it('should create a view', async () => {
      const result = await driver.createView({
        view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = true', replaceIfExists: false },
      });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('CREATE'));
    });

    it('should drop a view', async () => {
      const result = await driver.dropView({ viewName: 'active_users' });
      expect(result.success).toBe(true);
      expect(mockRun).toHaveBeenCalledWith(expect.stringContaining('DROP VIEW'));
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
  });
});
