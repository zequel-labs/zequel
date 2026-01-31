import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType } from '@main/types';
import type { ConnectionConfig, DataOptions } from '@main/types';
import { SQLITE_DATA_TYPES } from '@main/types/schema-operations';

// --- Mock better-sqlite3 ---
// vi.hoisted ensures these are available when vi.mock factory runs (hoisted)

const {
  mockAll,
  mockRun,
  mockGet,
  mockColumns,
  mockPrepare,
  mockExec,
  mockPragma,
  mockClose,
  MockDatabase,
} = vi.hoisted(() => {
  const mockAll = vi.fn();
  const mockRun = vi.fn();
  const mockGet = vi.fn();
  const mockColumns = vi.fn();

  const mockPrepare = vi.fn(() => ({
    all: mockAll,
    run: mockRun,
    get: mockGet,
    columns: mockColumns,
  }));

  const mockExec = vi.fn();
  const mockPragma = vi.fn();
  const mockClose = vi.fn();

  const mockDb = {
    prepare: mockPrepare,
    exec: mockExec,
    pragma: mockPragma,
    close: mockClose,
  };

  // better-sqlite3's default export is used with `new Database(path, opts)`
  // so the mock must be a constructable function
  const MockDatabase = vi.fn(function (this: Record<string, unknown>) {
    Object.assign(this, mockDb);
    return this;
  });

  return {
    mockAll,
    mockRun,
    mockGet,
    mockColumns,
    mockPrepare,
    mockExec,
    mockPragma,
    mockClose,
    MockDatabase,
  };
});

vi.mock('better-sqlite3', () => ({
  default: MockDatabase,
}));

// Mock fs
vi.mock('fs', () => ({
  statSync: vi.fn(() => ({
    size: 1024 * 512, // 512 KB
  })),
}));

import { SQLiteDriver } from '@main/db/sqlite';

describe('SQLiteDriver', () => {
  let driver: SQLiteDriver;
  const testConfig: ConnectionConfig = {
    id: 'test-sqlite',
    name: 'Test SQLite',
    type: DatabaseType.SQLite,
    database: 'test.db',
    filepath: '/path/to/test.db',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    driver = new SQLiteDriver();

    // Restore default mock implementations after resetAllMocks
    mockPrepare.mockReturnValue({
      all: mockAll,
      run: mockRun,
      get: mockGet,
      columns: mockColumns,
    });

    // Reset MockDatabase to use the mock db object
    MockDatabase.mockImplementation(function (this: Record<string, unknown>) {
      Object.assign(this, {
        prepare: mockPrepare,
        exec: mockExec,
        pragma: mockPragma,
        close: mockClose,
      });
      return this;
    });

    // Default mock returns
    mockAll.mockReturnValue([]);
    mockRun.mockReturnValue({ changes: 0 });
    mockGet.mockReturnValue(undefined);
    mockColumns.mockReturnValue([]);
  });

  describe('type', () => {
    it('should have SQLite type', () => {
      expect(driver.type).toBe(DatabaseType.SQLite);
    });
  });

  describe('connect', () => {
    it('should connect successfully with filepath', async () => {
      await driver.connect(testConfig);

      expect(MockDatabase).toHaveBeenCalledWith('/path/to/test.db', { readonly: false });
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(driver.isConnected).toBe(true);
    });

    it('should use database property when filepath is not provided', async () => {
      const config: ConnectionConfig = {
        id: 'test-2',
        name: 'Test SQLite 2',
        type: DatabaseType.SQLite,
        database: 'fallback.db',
      };

      await driver.connect(config);

      expect(MockDatabase).toHaveBeenCalledWith('fallback.db', { readonly: false });
    });

    it('should set isConnected to false and rethrow on failure', async () => {
      MockDatabase.mockImplementationOnce(function () {
        throw new Error('Cannot open database');
      });

      const freshDriver = new SQLiteDriver();
      await expect(freshDriver.connect(testConfig)).rejects.toThrow('Cannot open database');
      expect(freshDriver.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close db and reset state', async () => {
      await driver.connect(testConfig);

      await driver.disconnect();

      expect(mockClose).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await driver.disconnect();

      expect(mockClose).not.toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return success with version and server info', async () => {
      // Mock the version query
      mockAll.mockReturnValueOnce([]) // pragma all call (for journal_mode in connect is not via all)
        .mockReturnValue([]);
      mockGet.mockReturnValue(undefined);

      // We need to handle the sequence of prepare calls
      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        // Call 1: SELECT sqlite_version()
        // Call 2: PRAGMA journal_mode
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{ version: '3.39.0' }]
            : [{ journal_mode: 'wal' }]),
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.serverVersion).toBe('SQLite 3.39.0');
    });

    it('should return failure when connection fails', async () => {
      MockDatabase.mockImplementationOnce(function () {
        throw new Error('File not found');
      });

      const freshDriver = new SQLiteDriver();
      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('execute', () => {
    it('should throw when not connected', async () => {
      // ensureConnected throws before any query logic runs
      await expect(driver.execute('SELECT 1')).rejects.toThrow('Not connected to database');
    });

    it('should execute SELECT queries and return rows', async () => {
      await driver.connect(testConfig);

      const mockRows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
      const mockCols = [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ];

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue(mockRows),
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue(mockCols),
      });

      const result = await driver.execute('SELECT * FROM users');

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
      expect(result.columns).toEqual([
        { name: 'id', type: 'INTEGER', nullable: true, primaryKey: false },
        { name: 'name', type: 'TEXT', nullable: true, primaryKey: false },
      ]);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle PRAGMA queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ journal_mode: 'wal' }]),
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue([{ name: 'journal_mode', type: 'TEXT' }]),
      });

      const result = await driver.execute('PRAGMA journal_mode');

      expect(result.rows).toEqual([{ journal_mode: 'wal' }]);
      expect(result.rowCount).toBe(1);
    });

    it('should handle EXPLAIN queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ detail: 'SCAN users' }]),
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue([{ name: 'detail', type: 'TEXT' }]),
      });

      const result = await driver.execute('EXPLAIN SELECT * FROM users');

      expect(result.rows).toEqual([{ detail: 'SCAN users' }]);
    });

    it('should execute non-SELECT queries and return affected rows', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockReturnValue({ changes: 3 }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.execute('UPDATE users SET active = 1');

      expect(result.affectedRows).toBe(3);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should pass params for SELECT queries', async () => {
      await driver.connect(testConfig);

      const mockAllFn = vi.fn().mockReturnValue([{ id: 1 }]);
      mockPrepare.mockReturnValue({
        all: mockAllFn,
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue([{ name: 'id', type: 'INTEGER' }]),
      });

      await driver.execute('SELECT * FROM users WHERE id = ?', [1]);

      expect(mockAllFn).toHaveBeenCalledWith(1);
    });

    it('should pass params for non-SELECT queries', async () => {
      await driver.connect(testConfig);

      const mockRunFn = vi.fn().mockReturnValue({ changes: 1 });
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRunFn,
        get: mockGet,
        columns: mockColumns,
      });

      await driver.execute('DELETE FROM users WHERE id = ?', [42]);

      expect(mockRunFn).toHaveBeenCalledWith(42);
    });

    it('should return error in result when execution fails', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockImplementation(() => {
          throw new Error('no such table: users');
        }),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.execute('SELECT * FROM users');

      expect(result.error).toBe('no such table: users');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should handle column type being null', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([{ val: 1 }]),
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue([{ name: 'val', type: null }]),
      });

      const result = await driver.execute('SELECT 1 as val');

      expect(result.columns[0].type).toBe('unknown');
    });
  });

  describe('getDatabases', () => {
    it('should return a single database entry from filepath', async () => {
      await driver.connect(testConfig);

      const databases = await driver.getDatabases();

      expect(databases).toHaveLength(1);
      expect(databases[0].name).toBe('test.db');
    });

    it('should use database name when filepath is not available', async () => {
      const config: ConnectionConfig = {
        id: 'test-3',
        name: 'Test',
        type: DatabaseType.SQLite,
        database: 'myapp.db',
      };

      await driver.connect(config);
      const databases = await driver.getDatabases();

      expect(databases[0].name).toBe('myapp.db');
    });
  });

  describe('getTables', () => {
    it('should return tables and views from sqlite_master', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'users', type: 'table' },
          { name: 'active_users', type: 'view' },
          { name: 'orders', type: 'table' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const tables = await driver.getTables('main');

      expect(tables).toHaveLength(3);
      expect(tables[0]).toEqual({ name: 'users', type: TableObjectType.Table });
      expect(tables[1]).toEqual({ name: 'active_users', type: TableObjectType.View });
      expect(tables[2]).toEqual({ name: 'orders', type: TableObjectType.Table });
    });

    it('should return empty array when no tables exist', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const tables = await driver.getTables('main');

      expect(tables).toEqual([]);
    });
  });

  describe('getColumns', () => {
    it('should return column definitions from PRAGMA table_info', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
          { cid: 2, name: 'email', type: 'TEXT', notnull: 1, dflt_value: "'unknown'", pk: 0 },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const columns = await driver.getColumns('users');

      expect(columns).toHaveLength(3);
      expect(columns[0]).toEqual({
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        defaultValue: null,
        primaryKey: true,
        autoIncrement: true,
        unique: false,
      });
      expect(columns[1]).toEqual({
        name: 'name',
        type: 'TEXT',
        nullable: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        unique: false,
      });
      expect(columns[2]).toEqual({
        name: 'email',
        type: 'TEXT',
        nullable: false,
        defaultValue: "'unknown'",
        primaryKey: false,
        autoIncrement: false,
        unique: false,
      });
    });

    it('should set autoIncrement to true only for INTEGER PRIMARY KEY', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { cid: 0, name: 'id', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const columns = await driver.getColumns('items');

      expect(columns[0].autoIncrement).toBe(false);
      expect(columns[0].primaryKey).toBe(true);
    });

    it('should default type to TEXT when column type is empty', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { cid: 0, name: 'val', type: '', notnull: 0, dflt_value: null, pk: 0 },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const columns = await driver.getColumns('test');

      expect(columns[0].type).toBe('TEXT');
    });
  });

  describe('getIndexes', () => {
    it('should return indexes with their columns', async () => {
      await driver.connect(testConfig);

      let callCount = 0;
      mockPrepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // PRAGMA index_list
          return {
            all: vi.fn().mockReturnValue([
              { seq: 0, name: 'idx_users_email', unique: 1, origin: 'c' },
              { seq: 1, name: 'sqlite_autoindex_users_1', unique: 1, origin: 'pk' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callCount === 2) {
          // PRAGMA index_info for idx_users_email
          return {
            all: vi.fn().mockReturnValue([
              { seqno: 0, cid: 2, name: 'email' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          // PRAGMA index_info for sqlite_autoindex_users_1
          return {
            all: vi.fn().mockReturnValue([
              { seqno: 0, cid: 0, name: 'id' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        }
      });

      const indexes = await driver.getIndexes('users');

      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toEqual({
        name: 'idx_users_email',
        columns: ['email'],
        unique: true,
        primary: false,
      });
      expect(indexes[1]).toEqual({
        name: 'sqlite_autoindex_users_1',
        columns: ['id'],
        unique: true,
        primary: true,
      });
    });

    it('should return empty array when no indexes exist', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const indexes = await driver.getIndexes('logs');

      expect(indexes).toEqual([]);
    });
  });

  describe('getForeignKeys', () => {
    it('should return foreign keys from PRAGMA foreign_key_list', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { id: 0, seq: 0, table: 'users', from: 'user_id', to: 'id', on_update: 'NO ACTION', on_delete: 'CASCADE' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const fks = await driver.getForeignKeys('orders');

      expect(fks).toHaveLength(1);
      expect(fks[0]).toEqual({
        name: 'fk_orders_user_id',
        column: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
        onUpdate: 'NO ACTION',
        onDelete: 'CASCADE',
      });
    });

    it('should return empty array when no foreign keys exist', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const fks = await driver.getForeignKeys('standalone');

      expect(fks).toEqual([]);
    });
  });

  describe('getTableDDL', () => {
    it('should return the CREATE TABLE SQL', async () => {
      await driver.connect(testConfig);

      const expectedDDL = 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)';
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({ sql: expectedDDL }),
        columns: mockColumns,
      });

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toBe(expectedDDL);
    });

    it('should return empty string when table is not found', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue(undefined),
        columns: mockColumns,
      });

      const ddl = await driver.getTableDDL('nonexistent');

      expect(ddl).toBe('');
    });
  });

  describe('getTableData', () => {
    it('should return data with total count', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // COUNT query
          return {
            all: mockAll,
            run: mockRun,
            get: vi.fn().mockReturnValue({ count: 100 }),
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          // PRAGMA table_info (from getColumns)
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          // Data query
          return {
            all: vi.fn().mockReturnValue([
              { id: 1, name: 'Alice' },
              { id: 2, name: 'Bob' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        }
      });

      const options: DataOptions = { limit: 50, offset: 0 };
      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(100);
      expect(result.rows).toHaveLength(2);
      expect(result.columns).toHaveLength(2);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
    });
  });

  describe('getDataTypes', () => {
    it('should return SQLITE_DATA_TYPES', () => {
      const types = driver.getDataTypes();

      expect(types).toBe(SQLITE_DATA_TYPES);
      expect(types).toContainEqual({ name: 'INTEGER', category: 'numeric' });
      expect(types).toContainEqual({ name: 'TEXT', category: 'string' });
      expect(types).toContainEqual({ name: 'REAL', category: 'numeric' });
      expect(types).toContainEqual({ name: 'BLOB', category: 'binary' });
    });
  });

  describe('getPrimaryKeyColumns', () => {
    it('should return primary key column names', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const pkCols = await driver.getPrimaryKeyColumns('users');

      expect(pkCols).toEqual(['id']);
    });

    it('should return multiple columns for composite primary keys', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { cid: 0, name: 'user_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: 'role_id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 2 },
          { cid: 2, name: 'assigned_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const pkCols = await driver.getPrimaryKeyColumns('user_roles');

      expect(pkCols).toEqual(['user_id', 'role_id']);
    });
  });

  describe('getRoutines', () => {
    it('should return empty array (SQLite has no routines)', async () => {
      const routines = await driver.getRoutines();

      expect(routines).toEqual([]);
    });
  });

  describe('getRoutineDefinition', () => {
    it('should return a comment about no stored procedures', async () => {
      const def = await driver.getRoutineDefinition('my_proc', 'PROCEDURE' as import('@main/types').RoutineType);

      expect(def).toBe('-- SQLite does not support stored procedures or functions');
    });
  });

  describe('getUsers', () => {
    it('should return empty array (SQLite has no users)', async () => {
      const users = await driver.getUsers();

      expect(users).toEqual([]);
    });
  });

  describe('getUserPrivileges', () => {
    it('should return empty array (SQLite has no user management)', async () => {
      const privileges = await driver.getUserPrivileges('admin');

      expect(privileges).toEqual([]);
    });
  });

  describe('addColumn', () => {
    it('should execute ALTER TABLE ADD COLUMN', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'age',
          type: 'INTEGER',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE "users" ADD COLUMN');
      expect(result.sql).toContain('"age" INTEGER');
      expect(mockExec).toHaveBeenCalled();
    });

    it('should reject adding PRIMARY KEY columns', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'new_id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('PRIMARY KEY');
    });

    it('should reject NOT NULL columns without default value', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'required_field',
          type: 'TEXT',
          nullable: false,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('default value');
    });

    it('should allow NOT NULL columns with a default value', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'status',
          type: 'TEXT',
          nullable: false,
          defaultValue: 'active',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NOT NULL');
      expect(result.sql).toContain("DEFAULT 'active'");
    });

    it('should handle column with length', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'code',
          type: 'VARCHAR',
          length: 50,
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('VARCHAR(50)');
    });

    it('should handle column with precision and scale', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'products',
        column: {
          name: 'price',
          type: 'NUMERIC',
          precision: 10,
          scale: 2,
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NUMERIC(10,2)');
    });

    it('should return error when exec fails', async () => {
      await driver.connect(testConfig);
      mockExec.mockImplementation(() => {
        throw new Error('table users already has a column named age');
      });

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'age',
          type: 'INTEGER',
          nullable: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already has a column');
    });
  });

  describe('dropColumn', () => {
    it('should execute DROP COLUMN SQL', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'old_field',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "users" DROP COLUMN "old_field"');
    });

    it('should handle errors from exec', async () => {
      await driver.connect(testConfig);
      mockExec.mockImplementation(() => {
        throw new Error('cannot drop column: users has only one column');
      });

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'only_field',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('cannot drop column');
    });
  });

  describe('renameColumn', () => {
    it('should execute RENAME COLUMN SQL', async () => {
      await driver.connect(testConfig);

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'email_addr',
        newName: 'email',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "users" RENAME COLUMN "email_addr" TO "email"');
    });
  });

  describe('createIndex', () => {
    it('should create a regular index', async () => {
      await driver.connect(testConfig);

      const result = await driver.createIndex({
        table: 'users',
        index: {
          name: 'idx_users_email',
          columns: ['email'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE INDEX "idx_users_email" ON "users" ("email")');
    });

    it('should create a unique index', async () => {
      await driver.connect(testConfig);

      const result = await driver.createIndex({
        table: 'users',
        index: {
          name: 'idx_users_email_unique',
          columns: ['email'],
          unique: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE UNIQUE INDEX "idx_users_email_unique" ON "users" ("email")');
    });

    it('should create a multi-column index', async () => {
      await driver.connect(testConfig);

      const result = await driver.createIndex({
        table: 'orders',
        index: {
          name: 'idx_orders_user_date',
          columns: ['user_id', 'order_date'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE INDEX "idx_orders_user_date" ON "orders" ("user_id", "order_date")');
    });
  });

  describe('dropIndex', () => {
    it('should execute DROP INDEX SQL', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'idx_users_email',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP INDEX "idx_users_email"');
    });
  });

  describe('createTable', () => {
    it('should create a simple table', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'title', type: 'TEXT', nullable: false },
            { name: 'body', type: 'TEXT', nullable: true },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE "posts"');
      expect(result.sql).toContain('"id" INTEGER PRIMARY KEY AUTOINCREMENT');
      expect(result.sql).toContain('"title" TEXT NOT NULL');
      expect(result.sql).toContain('"body" TEXT');
    });

    it('should handle composite primary key', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'user_roles',
          columns: [
            { name: 'user_id', type: 'INTEGER', nullable: false },
            { name: 'role_id', type: 'INTEGER', nullable: false },
          ],
          primaryKey: ['user_id', 'role_id'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('PRIMARY KEY ("user_id", "role_id")');
    });

    it('should handle foreign keys in table creation', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_orders_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onDelete: 'CASCADE',
          }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_orders_user"');
      expect(result.sql).toContain('FOREIGN KEY ("user_id")');
      expect(result.sql).toContain('REFERENCES "users" ("id")');
      expect(result.sql).toContain('ON DELETE CASCADE');
    });
  });

  describe('dropTable', () => {
    it('should execute DROP TABLE SQL', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropTable({ table: 'old_table' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE "old_table"');
    });
  });

  describe('renameTable', () => {
    it('should execute RENAME TABLE SQL', async () => {
      await driver.connect(testConfig);

      const result = await driver.renameTable({
        oldName: 'users',
        newName: 'accounts',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "users" RENAME TO "accounts"');
    });
  });

  describe('insertRow', () => {
    it('should insert a row and return affected rows', async () => {
      await driver.connect(testConfig);

      const mockRunFn = vi.fn().mockReturnValue({ changes: 1 });
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRunFn,
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Alice', email: 'alice@example.com' },
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('INSERT INTO "users"');
      expect(result.sql).toContain('"name", "email"');
    });
  });

  describe('deleteRow', () => {
    it('should delete a row by primary key', async () => {
      await driver.connect(testConfig);

      const mockRunFn = vi.fn().mockReturnValue({ changes: 1 });
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRunFn,
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 42 },
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('DELETE FROM "users" WHERE "id" = ?');
    });

    it('should delete by composite primary key', async () => {
      await driver.connect(testConfig);

      const mockRunFn = vi.fn().mockReturnValue({ changes: 1 });
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRunFn,
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.deleteRow({
        table: 'user_roles',
        primaryKeyValues: { user_id: 1, role_id: 2 },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('"user_id" = ?');
      expect(result.sql).toContain('"role_id" = ?');
    });
  });

  describe('createView', () => {
    it('should create a view', async () => {
      await driver.connect(testConfig);

      const result = await driver.createView({
        view: {
          name: 'active_users',
          selectStatement: 'SELECT * FROM users WHERE active = 1',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE VIEW "active_users" AS SELECT * FROM users WHERE active = 1');
    });

    it('should create a view with IF NOT EXISTS when replaceIfExists is true', async () => {
      await driver.connect(testConfig);

      const result = await driver.createView({
        view: {
          name: 'active_users',
          selectStatement: 'SELECT * FROM users WHERE active = 1',
          replaceIfExists: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE VIEW IF NOT EXISTS');
    });
  });

  describe('dropView', () => {
    it('should drop a view with IF EXISTS', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropView({ viewName: 'active_users' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP VIEW IF EXISTS "active_users"');
    });
  });

  describe('getViewDDL', () => {
    it('should return the view SQL definition', async () => {
      await driver.connect(testConfig);

      const expectedSQL = 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1';
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({ sql: expectedSQL }),
        columns: mockColumns,
      });

      const ddl = await driver.getViewDDL('active_users');

      expect(ddl).toBe(expectedSQL);
    });

    it('should return empty string when view is not found', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue(undefined),
        columns: mockColumns,
      });

      const ddl = await driver.getViewDDL('nonexistent');

      expect(ddl).toBe('');
    });
  });

  describe('getTriggers', () => {
    it('should return triggers with parsed timing and event', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          {
            name: 'trg_users_insert',
            table_name: 'users',
            sql: 'CREATE TRIGGER trg_users_insert AFTER INSERT ON users BEGIN SELECT 1; END',
          },
          {
            name: 'trg_users_update',
            table_name: 'users',
            sql: 'CREATE TRIGGER trg_users_update BEFORE UPDATE ON users BEGIN SELECT 1; END',
          },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers('users');

      expect(triggers).toHaveLength(2);
      expect(triggers[0]).toEqual({
        name: 'trg_users_insert',
        table: 'users',
        timing: 'AFTER',
        event: 'INSERT',
        definition: 'CREATE TRIGGER trg_users_insert AFTER INSERT ON users BEGIN SELECT 1; END',
      });
      expect(triggers[1]).toEqual({
        name: 'trg_users_update',
        table: 'users',
        timing: 'BEFORE',
        event: 'UPDATE',
        definition: 'CREATE TRIGGER trg_users_update BEFORE UPDATE ON users BEGIN SELECT 1; END',
      });
    });

    it('should handle INSTEAD OF triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          {
            name: 'trg_view_delete',
            table_name: 'my_view',
            sql: 'CREATE TRIGGER trg_view_delete INSTEAD OF DELETE ON my_view BEGIN DELETE FROM base_table; END',
          },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('INSTEAD OF');
      expect(triggers[0].event).toBe('DELETE');
    });

    it('should return UNKNOWN for unrecognized trigger SQL', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          {
            name: 'trg_weird',
            table_name: 'test',
            sql: '',
          },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('UNKNOWN');
      expect(triggers[0].event).toBe('UNKNOWN');
    });
  });

  describe('getTriggerDefinition', () => {
    it('should return the trigger SQL', async () => {
      await driver.connect(testConfig);

      const expectedSQL = 'CREATE TRIGGER trg_test AFTER INSERT ON users BEGIN SELECT 1; END';
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({ sql: expectedSQL }),
        columns: mockColumns,
      });

      const def = await driver.getTriggerDefinition('trg_test');

      expect(def).toBe(expectedSQL);
    });

    it('should return a not found message when trigger does not exist', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue(undefined),
        columns: mockColumns,
      });

      const def = await driver.getTriggerDefinition('nonexistent');

      expect(def).toBe("-- Trigger 'nonexistent' not found");
    });
  });

  describe('createTrigger', () => {
    it('should create a trigger with FOR EACH ROW', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_audit',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: '  INSERT INTO audit_log(action) VALUES ("insert");',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TRIGGER "trg_audit"');
      expect(result.sql).toContain('AFTER INSERT ON "users"');
      expect(result.sql).toContain('FOR EACH ROW');
      expect(result.sql).toContain('BEGIN');
      expect(result.sql).toContain('END');
    });

    it('should create a trigger with WHEN condition', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_cond',
          table: 'users',
          timing: 'BEFORE',
          event: 'UPDATE',
          body: '  SELECT RAISE(ABORT, "cannot modify");',
          condition: 'OLD.locked = 1',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('WHEN OLD.locked = 1');
    });

    it('should omit FOR EACH ROW when forEachRow is false', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_no_each_row',
          table: 'users',
          timing: 'AFTER',
          event: 'DELETE',
          body: '  SELECT 1;',
          forEachRow: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('FOR EACH ROW');
    });
  });

  describe('dropTrigger', () => {
    it('should drop a trigger with IF EXISTS', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropTrigger({ triggerName: 'trg_audit' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TRIGGER IF EXISTS "trg_audit"');
    });
  });

  describe('ping', () => {
    it('should return true when connected', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({ '1': 1 }),
        columns: mockColumns,
      });

      const result = await driver.ping();

      expect(result).toBe(true);
    });

    it('should return false when db is null', async () => {
      const result = await driver.ping();

      expect(result).toBe(false);
    });

    it('should return false when query throws', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockImplementation(() => {
          throw new Error('database is closed');
        }),
        columns: mockColumns,
      });

      const result = await driver.ping();

      expect(result).toBe(false);
    });
  });

  describe('cancelQuery', () => {
    it('should return false (SQLite does not support cancellation)', async () => {
      const result = await driver.cancelQuery();

      expect(result).toBe(false);
    });
  });

  describe('testConnection - additional branches', () => {
    it('should report file size in MB when file is larger than 1MB', async () => {
      const fs = await import('fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        size: 1024 * 1024 * 5, // 5 MB
      });

      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{ version: '3.39.0' }]
            : [{ journal_mode: 'wal' }]),
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo?.['File Size']).toBe('5.00 MB');
    });

    it('should handle non-Error thrown during connection', async () => {
      MockDatabase.mockImplementationOnce(function () {
        throw 'string error';
      });

      const freshDriver = new SQLiteDriver();
      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle missing version in query result', async () => {
      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{}]
            : [{ journal_mode: 'wal' }]),
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('SQLite Unknown');
    });

    it('should handle no dbPath in config', async () => {
      const configNoPath: ConnectionConfig = {
        id: 'test-no-path',
        name: 'Test No Path',
        type: DatabaseType.SQLite,
        database: '',
      };

      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{ version: '3.39.0' }]
            : [{ journal_mode: 'wal' }]),
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(configNoPath);

      expect(result.success).toBe(true);
      // no File Size key since dbPath is empty string (falsy)
      expect(result.serverInfo?.['File Size']).toBeUndefined();
    });

    it('should handle error in serverInfo gathering gracefully', async () => {
      const fs = await import('fs');
      (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('File not accessible');
      });

      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{ version: '3.39.0' }]
            : []),
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('SQLite 3.39.0');
    });
  });

  describe('execute - additional branches', () => {
    it('should handle non-Error thrown in catch block', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockImplementation(() => {
          throw 42;
        }),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.execute('SELECT * FROM users');

      expect(result.error).toBe('42');
    });

    it('should handle non-SELECT query error with non-Error thrown', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockImplementation(() => {
          throw 'some string error';
        }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.execute('INSERT INTO users VALUES (1)');

      expect(result.error).toBe('some string error');
    });

    it('should execute SELECT with empty params array (no params path)', async () => {
      await driver.connect(testConfig);

      const mockAllFn = vi.fn().mockReturnValue([{ id: 1 }]);
      mockPrepare.mockReturnValue({
        all: mockAllFn,
        run: mockRun,
        get: mockGet,
        columns: vi.fn().mockReturnValue([{ name: 'id', type: 'INTEGER' }]),
      });

      await driver.execute('SELECT * FROM users', []);

      // Empty params array, so stmt.all() should be called without params
      expect(mockAllFn).toHaveBeenCalledWith();
    });

    it('should execute non-SELECT with empty params array', async () => {
      await driver.connect(testConfig);

      const mockRunFn = vi.fn().mockReturnValue({ changes: 0 });
      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRunFn,
        get: mockGet,
        columns: mockColumns,
      });

      await driver.execute('DELETE FROM users', []);

      expect(mockRunFn).toHaveBeenCalledWith();
    });
  });

  describe('getDatabases - fallback to main', () => {
    it('should fallback to main when config has no filepath or database', async () => {
      const config: ConnectionConfig = {
        id: 'test-no-name',
        name: 'Test',
        type: DatabaseType.SQLite,
        database: '',
      };

      await driver.connect(config);

      // Manually override config to simulate edge case
      (driver as unknown as { config: ConnectionConfig | null }).config = {
        id: 'test',
        name: 'test',
        type: DatabaseType.SQLite,
        database: '',
      };

      const databases = await driver.getDatabases();

      expect(databases[0].name).toBe('main');
    });
  });

  describe('getTableData - with filters, sorting, and pagination', () => {
    const setupTableDataMocks = () => {
      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            all: mockAll,
            run: mockRun,
            get: vi.fn().mockReturnValue({ count: 50 }),
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
              { cid: 2, name: 'status', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          return {
            all: vi.fn().mockReturnValue([{ id: 1, name: 'Alice', status: 'active' }]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        }
      });
    };

    it('should apply IS NULL filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NULL', value: null }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
      expect(result.rows).toHaveLength(1);
    });

    it('should apply IS NOT NULL filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NOT NULL', value: null }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply IN filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply NOT IN filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'NOT IN', value: ['deleted'] }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply LIKE filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'LIKE', value: 'Ali' }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply NOT LIKE filter', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: 'Bob' }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply default operator filter (=)', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [{ column: 'id', operator: '=', value: 1 }],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply multiple filters', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'name', operator: '!=', value: 'Admin' },
        ],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply sorting with orderBy and orderDirection', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        orderBy: 'name',
        orderDirection: 'DESC' as import('@main/types').SortDirection,
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply sorting with default ASC direction', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        orderBy: 'name',
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply limit and offset', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        limit: 10,
        offset: 20,
      };

      const result = await driver.getTableData('users', options);

      expect(result.offset).toBe(20);
      expect(result.limit).toBe(10);
    });

    it('should use rows.length as limit when no limit specified', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {};

      const result = await driver.getTableData('users', options);

      expect(result.limit).toBe(1); // rows.length from mock
      expect(result.offset).toBe(0);
    });

    it('should apply > and < operator filters', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [
          { column: 'id', operator: '>', value: 5 },
          { column: 'id', operator: '<', value: 100 },
        ],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });

    it('should apply >= and <= operator filters', async () => {
      await driver.connect(testConfig);
      setupTableDataMocks();

      const options: DataOptions = {
        filters: [
          { column: 'id', operator: '>=', value: 1 },
          { column: 'id', operator: '<=', value: 50 },
        ],
      };

      const result = await driver.getTableData('users', options);

      expect(result.totalCount).toBe(50);
    });
  });

  describe('modifyColumn', () => {
    it('should recreate table to modify a column', async () => {
      await driver.connect(testConfig);

      // Mock getColumns, getIndexes, getForeignKeys, getTableDDL
      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : callIndex === 2
                ? [] // index_list
                : [] // foreign_key_list
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: {
          name: 'full_name',
          type: 'TEXT',
          nullable: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('BEGIN TRANSACTION');
      expect(result.sql).toContain('COMMIT');
    });

    it('should handle modify column not found in table', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'nonexistent',
        newDefinition: {
          name: 'renamed',
          type: 'TEXT',
          nullable: true,
        },
      });

      // Column not found, no modification, but table recreation still proceeds
      expect(result.success).toBe(true);
    });
  });

  describe('dropColumn - fallback to recreateTable', () => {
    it('should fall back to recreateTable when error is no such column', async () => {
      await driver.connect(testConfig);

      // First exec call throws 'no such column' to trigger fallback
      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 1) {
          throw new Error('no such column: old_field');
        }
        // All subsequent exec calls succeed
      });

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'old_field', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, old_field TEXT)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'old_field',
      });

      expect(result.success).toBe(true);
    });

    it('should fall back to recreateTable when error is syntax error', async () => {
      await driver.connect(testConfig);

      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 1) {
          throw new Error('syntax error near DROP');
        }
      });

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'col', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, col TEXT)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.dropColumn({
        table: 't',
        columnName: 'col',
      });

      expect(result.success).toBe(true);
    });

    it('should return error for non-recoverable drop column errors', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('database is locked');
      });

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'field',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('database is locked');
    });
  });

  describe('addForeignKey', () => {
    it('should recreate table to add a foreign key', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'user_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : callIndex === 2
                ? [] // indexes
                : callIndex === 3
                  ? [] // foreign keys
                  : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'fk_orders_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_orders_user"');
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });
  });

  describe('dropForeignKey', () => {
    it('should recreate table to drop a foreign key', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'user_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : callIndex === 2
                ? [] // indexes
                : callIndex === 3
                  ? [{ id: 0, seq: 0, table: 'users', from: 'user_id', to: 'id', on_update: 'NO ACTION', on_delete: 'CASCADE' }]
                  : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, CONSTRAINT fk_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id))' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.dropForeignKey({
        table: 'orders',
        constraintName: 'fk_orders_user_id',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('BEGIN TRANSACTION');
    });
  });

  describe('recreateTableWithModification - error and rollback', () => {
    it('should rollback transaction on error during recreation', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      // Make exec fail on CREATE TABLE (second exec call, after BEGIN)
      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 2) {
          throw new Error('disk full');
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'id',
        newDefinition: {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('disk full');
      // Should have attempted ROLLBACK
      const rollbackCalls = mockExec.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0] === 'ROLLBACK'
      );
      expect(rollbackCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle rollback error silently', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 2) {
          throw new Error('disk full');
        }
        // ROLLBACK also throws
        if (execCallCount === 3) {
          throw new Error('cannot rollback - no transaction');
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'id',
        newDefinition: {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
        },
      });

      // Should still return error from original failure, not rollback error
      expect(result.success).toBe(false);
      expect(result.error).toBe('disk full');
    });

    it('should recreate indexes after table modification (non-primary, columns exist)', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // getColumns
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
              { cid: 2, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          // getIndexes - index_list
          return {
            all: vi.fn().mockReturnValue([
              { seq: 0, name: 'idx_email', unique: 1, origin: 'c' },
              { seq: 1, name: 'pk_idx', unique: 1, origin: 'pk' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 3) {
          // index_info for idx_email
          return {
            all: vi.fn().mockReturnValue([{ seqno: 0, cid: 1, name: 'email' }]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 4) {
          // index_info for pk_idx
          return {
            all: vi.fn().mockReturnValue([{ seqno: 0, cid: 0, name: 'id' }]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 5) {
          // getForeignKeys
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          // getTableDDL
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT)' }),
            columns: mockColumns,
          };
        }
      });

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: {
          name: 'full_name',
          type: 'TEXT',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      // idx_email should be recreated (non-primary, column still exists)
      expect(result.sql).toContain('CREATE UNIQUE INDEX "idx_email"');
      // pk_idx should NOT be recreated (primary index)
      expect(result.sql).not.toContain('CREATE UNIQUE INDEX "pk_idx"');
    });

    it('should skip index recreation when index columns no longer exist', async () => {
      await driver.connect(testConfig);

      // Force the first exec (ALTER TABLE DROP COLUMN) to throw a recoverable error
      // so that dropColumn falls back to recreateTableWithModification
      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 1) {
          throw new Error('no such column: dropme');
        }
        // All subsequent exec calls succeed
      });

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
              { cid: 2, name: 'dropme', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          // index_list: index on 'dropme' column
          return {
            all: vi.fn().mockReturnValue([
              { seq: 0, name: 'idx_dropme', unique: 0, origin: 'c' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 3) {
          // index_info for idx_dropme
          return {
            all: vi.fn().mockReturnValue([{ seqno: 0, cid: 2, name: 'dropme' }]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 4) {
          // getForeignKeys
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, dropme TEXT)' }),
            columns: mockColumns,
          };
        }
      });

      // Drop column 'dropme' - the index on that column should not be recreated
      const result = await driver.dropColumn({
        table: 't',
        columnName: 'dropme',
      });

      expect(result.success).toBe(true);
      // idx_dropme should NOT be recreated since its column was dropped
      expect(result.sql).not.toContain('idx_dropme');
    });

    it('should handle modify column with all options (unique, length, precision, scale, defaultValue)', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'price', type: 'REAL', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE products (id INTEGER PRIMARY KEY, price REAL)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 'products',
        oldName: 'price',
        newDefinition: {
          name: 'price',
          type: 'NUMERIC',
          nullable: false,
          unique: true,
          precision: 10,
          scale: 2,
          defaultValue: 0,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NUMERIC(10,2)');
      expect(result.sql).toContain('NOT NULL');
      expect(result.sql).toContain('UNIQUE');
      expect(result.sql).toContain('DEFAULT 0');
    });

    it('should handle recreateTable with existing foreign keys and onUpdate/onDelete', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'user_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 3) {
          // existing foreign keys
          return {
            all: vi.fn().mockReturnValue([
              { id: 0, seq: 0, table: 'users', from: 'user_id', to: 'id', on_update: 'CASCADE', on_delete: 'SET NULL' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER)' }),
            columns: mockColumns,
          };
        }
      });

      // Modify a column while preserving existing FK with onUpdate/onDelete
      const result = await driver.modifyColumn({
        table: 'orders',
        oldName: 'user_id',
        newDefinition: {
          name: 'user_id',
          type: 'INTEGER',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_orders_user_id"');
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });

    it('should handle column with string defaultValue in recreateTable', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'status', type: 'TEXT', notnull: 0, dflt_value: "'active'", pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE items (id INTEGER PRIMARY KEY, status TEXT)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 'items',
        oldName: 'status',
        newDefinition: {
          name: 'status',
          type: 'TEXT',
          nullable: true,
          defaultValue: "it's active",
        },
      });

      expect(result.success).toBe(true);
      // Should escape single quotes in default value
      expect(result.sql).toContain("DEFAULT 'it''s active'");
    });

    it('should handle column with length only (no precision/scale) in recreateTable', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'code', type: 'VARCHAR', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, code VARCHAR)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'code',
        newDefinition: {
          name: 'code',
          type: 'VARCHAR',
          nullable: true,
          length: 50,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('VARCHAR(50)');
    });

    it('should handle column with precision and scale set via modifyColumn', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'val', type: 'NUMERIC', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, val NUMERIC)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'val',
        newDefinition: {
          name: 'val',
          type: 'NUMERIC',
          nullable: true,
          precision: 8,
          scale: 3,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NUMERIC(8,3)');
    });
  });

  describe('renameColumn - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('no such column');
      });

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'missing',
        newName: 'renamed',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('no such column');
    });
  });

  describe('createIndex - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('index already exists');
      });

      const result = await driver.createIndex({
        table: 'users',
        index: {
          name: 'idx_dup',
          columns: ['email'],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('index already exists');
    });
  });

  describe('dropIndex - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('no such index');
      });

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('no such index');
    });
  });

  describe('dropTable - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('no such table');
      });

      const result = await driver.dropTable({ table: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('no such table');
    });
  });

  describe('renameTable - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('table already exists');
      });

      const result = await driver.renameTable({
        oldName: 'users',
        newName: 'existing_table',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('table already exists');
    });
  });

  describe('insertRow - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockImplementation(() => {
          throw new Error('UNIQUE constraint failed');
        }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { id: 1, name: 'duplicate' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('UNIQUE constraint failed');
    });
  });

  describe('deleteRow - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockImplementation(() => {
          throw new Error('database is locked');
        }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('database is locked');
    });
  });

  describe('createView - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('view already exists');
      });

      const result = await driver.createView({
        view: {
          name: 'existing_view',
          selectStatement: 'SELECT * FROM users',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('view already exists');
    });
  });

  describe('dropView - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('database is locked');
      });

      const result = await driver.dropView({ viewName: 'some_view' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('database is locked');
    });
  });

  describe('renameView', () => {
    it('should rename view by dropping and recreating', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({
          sql: 'CREATE VIEW old_view AS SELECT * FROM users WHERE active = 1',
        }),
        columns: mockColumns,
      });

      const result = await driver.renameView({
        oldName: 'old_view',
        newName: 'new_view',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP VIEW "old_view"');
      expect(result.sql).toContain('CREATE VIEW "new_view"');
    });

    it('should return error when view definition cannot be parsed', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({ sql: 'something weird' }),
        columns: mockColumns,
      });

      const result = await driver.renameView({
        oldName: 'weird_view',
        newName: 'new_view',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not parse view definition');
    });

    it('should return error when view DDL is empty', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue(undefined),
        columns: mockColumns,
      });

      const result = await driver.renameView({
        oldName: 'missing_view',
        newName: 'new_view',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Could not parse view definition');
    });

    it('should return error when drop or create fails', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({
          sql: 'CREATE VIEW v AS SELECT 1',
        }),
        columns: mockColumns,
      });

      mockExec.mockImplementation(() => {
        throw new Error('database is locked');
      });

      const result = await driver.renameView({
        oldName: 'v',
        newName: 'v2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('database is locked');
    });
  });

  describe('createTable - additional branches', () => {
    it('should handle table with indexes', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'items',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'code', type: 'TEXT', nullable: false },
          ],
          indexes: [
            { name: 'idx_items_code', columns: ['code'], unique: true },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledTimes(2); // CREATE TABLE + CREATE INDEX
    });

    it('should handle table creation error', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('table already exists');
      });

      const result = await driver.createTable({
        table: {
          name: 'users',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
          ],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('table already exists');
    });

    it('should handle foreign keys with onUpdate', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });

    it('should not add composite PK when inline PK is set on a column', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'mixed',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'name', type: 'TEXT', nullable: true },
          ],
          primaryKey: ['id'],
        },
      });

      expect(result.success).toBe(true);
      // The composite PK clause should NOT appear because id has inline PK
      expect(result.sql).not.toContain('PRIMARY KEY ("id")');
      expect(result.sql).toContain('"id" INTEGER PRIMARY KEY');
    });

    it('should handle column with unique and default in buildColumnDefinition', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
            {
              name: 'status',
              type: 'TEXT',
              nullable: false,
              unique: true,
              defaultValue: 'draft',
            },
            {
              name: 'count',
              type: 'INTEGER',
              nullable: true,
              defaultValue: 0,
            },
            {
              name: 'code',
              type: 'VARCHAR',
              nullable: true,
              length: 20,
            },
            {
              name: 'amount',
              type: 'NUMERIC',
              nullable: true,
              precision: 10,
              scale: 2,
            },
            {
              name: 'quantity',
              type: 'NUMERIC',
              nullable: true,
              precision: 5,
            },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('"status" TEXT NOT NULL UNIQUE DEFAULT \'draft\'');
      expect(result.sql).toContain('"count" INTEGER DEFAULT 0');
      expect(result.sql).toContain('VARCHAR(20)');
      expect(result.sql).toContain('NUMERIC(10,2)');
      expect(result.sql).toContain('NUMERIC(5)');
    });
  });

  describe('createTrigger - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('near "TRIGGER": syntax error');
      });

      const result = await driver.createTrigger({
        trigger: {
          name: 'bad_trigger',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'INVALID SQL',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('syntax error');
    });
  });

  describe('dropTrigger - error path', () => {
    it('should return error on failure', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw new Error('database is locked');
      });

      const result = await driver.dropTrigger({ triggerName: 'trg' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('database is locked');
    });
  });

  describe('getTriggers - all timing/event combinations', () => {
    it('should parse BEFORE INSERT triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'users', sql: 'CREATE TRIGGER trg BEFORE INSERT ON users BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('BEFORE');
      expect(triggers[0].event).toBe('INSERT');
    });

    it('should parse INSTEAD OF INSERT triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'v', sql: 'CREATE TRIGGER trg INSTEAD OF INSERT ON v BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('INSTEAD OF');
      expect(triggers[0].event).toBe('INSERT');
    });

    it('should parse INSTEAD OF UPDATE triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'v', sql: 'CREATE TRIGGER trg INSTEAD OF UPDATE ON v BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('INSTEAD OF');
      expect(triggers[0].event).toBe('UPDATE');
    });

    it('should parse AFTER UPDATE triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'users', sql: 'CREATE TRIGGER trg AFTER UPDATE ON users BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('AFTER');
      expect(triggers[0].event).toBe('UPDATE');
    });

    it('should parse BEFORE DELETE triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'users', sql: 'CREATE TRIGGER trg BEFORE DELETE ON users BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('BEFORE');
      expect(triggers[0].event).toBe('DELETE');
    });

    it('should parse AFTER DELETE triggers', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'users', sql: 'CREATE TRIGGER trg AFTER DELETE ON users BEGIN SELECT 1; END' },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('AFTER');
      expect(triggers[0].event).toBe('DELETE');
    });

    it('should handle trigger with null sql', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: vi.fn().mockReturnValue([
          { name: 'trg', table_name: 'users', sql: null },
        ]),
        run: mockRun,
        get: mockGet,
        columns: mockColumns,
      });

      const triggers = await driver.getTriggers();

      expect(triggers[0].timing).toBe('UNKNOWN');
      expect(triggers[0].event).toBe('UNKNOWN');
    });
  });

  describe('addColumn - additional branches', () => {
    it('should handle column with numeric default value', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'age',
          type: 'INTEGER',
          nullable: false,
          defaultValue: 0,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NOT NULL');
      expect(result.sql).toContain('DEFAULT 0');
    });

    it('should handle column with precision only (no scale) in addColumn', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'products',
        column: {
          name: 'rating',
          type: 'NUMERIC',
          precision: 5,
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      // precision without scale in addColumn does NOT append (precision) -- it only uses precision+scale together
      expect(result.sql).toContain('NUMERIC');
    });

    it('should handle non-Error thrown in addColumn catch', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'string error from exec';
      });

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'test',
          type: 'TEXT',
          nullable: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error from exec');
    });
  });

  describe('recreateTableWithModification - column with length property', () => {
    it('should include length in column definition during table recreation', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          // getColumns - column with length
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'code', type: 'VARCHAR', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex <= 3) {
          // getIndexes, getForeignKeys - empty
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          // getTableDDL
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, code VARCHAR(50))' }),
            columns: mockColumns,
          };
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'code',
        newDefinition: {
          name: 'code',
          type: 'VARCHAR',
          nullable: true,
          length: 100,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('VARCHAR(100)');
    });
  });

  describe('recreateTableWithModification - FK without onUpdate/onDelete', () => {
    it('should preserve existing FKs without onUpdate/onDelete during modify', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'ref_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 3) {
          // existing FK without onUpdate/onDelete
          return {
            all: vi.fn().mockReturnValue([
              { id: 0, seq: 0, table: 'other', from: 'ref_id', to: 'id', on_update: '', on_delete: '' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, ref_id INTEGER)' }),
            columns: mockColumns,
          };
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'ref_id',
        newDefinition: {
          name: 'ref_id',
          type: 'INTEGER',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_t_ref_id"');
      // Should NOT have ON UPDATE or ON DELETE since they were empty
      expect(result.sql).not.toContain('ON UPDATE');
      expect(result.sql).not.toContain('ON DELETE');
    });
  });

  describe('recreateTableWithModification - non-unique index recreation', () => {
    it('should recreate a non-unique index after table modification', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) {
          return {
            all: vi.fn().mockReturnValue([
              { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
              { cid: 1, name: 'name', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
              { cid: 2, name: 'email', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 2) {
          // index_list: non-unique index
          return {
            all: vi.fn().mockReturnValue([
              { seq: 0, name: 'idx_name', unique: 0, origin: 'c' },
            ]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 3) {
          // index_info for idx_name
          return {
            all: vi.fn().mockReturnValue([{ seqno: 0, cid: 1, name: 'name' }]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else if (callIndex === 4) {
          // getForeignKeys
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: mockGet,
            columns: mockColumns,
          };
        } else {
          return {
            all: vi.fn().mockReturnValue([]),
            run: mockRun,
            get: vi.fn().mockReturnValue({ sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, email TEXT)' }),
            columns: mockColumns,
          };
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'email',
        newDefinition: {
          name: 'email_address',
          type: 'TEXT',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      // Non-unique index should be recreated without UNIQUE keyword
      expect(result.sql).toContain('CREATE INDEX "idx_name"');
      expect(result.sql).not.toContain('CREATE UNIQUE INDEX "idx_name"');
    });
  });

  describe('recreateTableWithModification - non-Error thrown', () => {
    it('should handle non-Error thrown in recreateTable catch', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [{ cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 }]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      let execCallCount = 0;
      mockExec.mockImplementation(() => {
        execCallCount++;
        if (execCallCount === 2) {
          throw 'string error in recreateTable';
        }
      });

      const result = await driver.modifyColumn({
        table: 't',
        oldName: 'id',
        newDefinition: {
          name: 'id',
          type: 'INTEGER',
          nullable: false,
          primaryKey: true,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error in recreateTable');
    });
  });

  describe('createTrigger - non-Error in catch', () => {
    it('should handle non-Error thrown in createTrigger', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 42;
      });

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'SELECT 1;',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('42');
    });
  });

  describe('dropTrigger - non-Error in catch', () => {
    it('should handle non-Error thrown in dropTrigger', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'non-error string';
      });

      const result = await driver.dropTrigger({ triggerName: 'trg' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('non-error string');
    });
  });

  describe('renameColumn - non-Error in catch', () => {
    it('should handle non-Error thrown in renameColumn', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 99;
      });

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'a',
        newName: 'b',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('99');
    });
  });

  describe('createIndex - non-Error in catch', () => {
    it('should handle non-Error thrown in createIndex', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw null;
      });

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx', columns: ['col'] },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('null');
    });
  });

  describe('dropIndex - non-Error in catch', () => {
    it('should handle non-Error thrown in dropIndex', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw undefined;
      });

      const result = await driver.dropIndex({ table: 'users', indexName: 'idx' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('undefined');
    });
  });

  describe('dropTable - non-Error in catch', () => {
    it('should handle non-Error thrown in dropTable', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'drop error';
      });

      const result = await driver.dropTable({ table: 'tbl' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('drop error');
    });
  });

  describe('renameTable - non-Error in catch', () => {
    it('should handle non-Error thrown in renameTable', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw false;
      });

      const result = await driver.renameTable({ oldName: 'a', newName: 'b' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('false');
    });
  });

  describe('insertRow - non-Error in catch', () => {
    it('should handle non-Error thrown in insertRow', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockImplementation(() => {
          throw 'insert error';
        }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('insert error');
    });
  });

  describe('deleteRow - non-Error in catch', () => {
    it('should handle non-Error thrown in deleteRow', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: vi.fn().mockImplementation(() => {
          throw 0;
        }),
        get: mockGet,
        columns: mockColumns,
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('0');
    });
  });

  describe('createView - non-Error in catch', () => {
    it('should handle non-Error thrown in createView', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'view error';
      });

      const result = await driver.createView({
        view: { name: 'v', selectStatement: 'SELECT 1' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('view error');
    });
  });

  describe('dropView - non-Error in catch', () => {
    it('should handle non-Error thrown in dropView', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'drop view error';
      });

      const result = await driver.dropView({ viewName: 'v' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('drop view error');
    });
  });

  describe('renameView - non-Error in catch', () => {
    it('should handle non-Error thrown in renameView', async () => {
      await driver.connect(testConfig);

      mockPrepare.mockReturnValue({
        all: mockAll,
        run: mockRun,
        get: vi.fn().mockReturnValue({
          sql: 'CREATE VIEW v AS SELECT 1',
        }),
        columns: mockColumns,
      });

      mockExec.mockImplementation(() => {
        throw 'rename view error';
      });

      const result = await driver.renameView({ oldName: 'v', newName: 'v2' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('rename view error');
    });
  });

  describe('createTable - non-Error in catch', () => {
    it('should handle non-Error thrown in createTable', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'create table error';
      });

      const result = await driver.createTable({
        table: {
          name: 'tbl',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true }],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('create table error');
    });
  });

  describe('dropColumn - non-Error in exec and non-recoverable', () => {
    it('should handle non-Error thrown in dropColumn (non-recoverable)', async () => {
      await driver.connect(testConfig);

      mockExec.mockImplementation(() => {
        throw 'generic drop column error';
      });

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'col',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('generic drop column error');
    });
  });

  describe('testConnection - journal_mode undefined', () => {
    it('should handle missing journal_mode in PRAGMA result', async () => {
      let prepareCallCount = 0;
      mockPrepare.mockImplementation(() => {
        prepareCallCount++;
        return {
          all: vi.fn().mockReturnValue(prepareCallCount === 1
            ? [{ version: '3.40.0' }]
            : [{}]),  // journal_mode is undefined
          run: mockRun,
          get: mockGet,
          columns: mockColumns,
        };
      });

      const result = await driver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverInfo?.['Journal Mode']).toBe('');
    });
  });

  describe('getDatabases - edge case with trailing slash path', () => {
    it('should handle path ending with slash (pop returns empty)', async () => {
      const config: ConnectionConfig = {
        id: 'test-slash',
        name: 'Test',
        type: DatabaseType.SQLite,
        database: '/some/path/',
        filepath: '/some/path/',
      };

      await driver.connect(config);
      const databases = await driver.getDatabases();

      // '/some/path/'.split('/').pop() returns '' which is falsy, so falls to 'main'
      expect(databases[0].name).toBe('main');
    });
  });

  describe('createTable - FK without onDelete', () => {
    it('should handle foreign key with onUpdate but no onDelete', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: 'CASCADE',
            // no onDelete
          }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).not.toContain('ON DELETE');
    });

    it('should handle foreign key without onUpdate or onDelete', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'ref_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_ref',
            columns: ['ref_id'],
            referencedTable: 'other',
            referencedColumns: ['id'],
            // no onUpdate, no onDelete
          }],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('ON UPDATE');
      expect(result.sql).not.toContain('ON DELETE');
    });
  });

  describe('addForeignKey - without onUpdate/onDelete', () => {
    it('should add foreign key without onUpdate and onDelete', async () => {
      await driver.connect(testConfig);

      let callIndex = 0;
      mockPrepare.mockImplementation(() => {
        callIndex++;
        return {
          all: vi.fn().mockReturnValue(
            callIndex === 1
              ? [
                  { cid: 0, name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
                  { cid: 1, name: 'ref_id', type: 'INTEGER', notnull: 0, dflt_value: null, pk: 0 },
                ]
              : []
          ),
          run: mockRun,
          get: vi.fn().mockReturnValue(
            callIndex === 4
              ? { sql: 'CREATE TABLE t (id INTEGER PRIMARY KEY, ref_id INTEGER)' }
              : undefined
          ),
          columns: mockColumns,
        };
      });

      const result = await driver.addForeignKey({
        table: 't',
        foreignKey: {
          name: 'fk_ref',
          columns: ['ref_id'],
          referencedTable: 'other',
          referencedColumns: ['id'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_ref"');
      expect(result.sql).not.toContain('ON UPDATE');
      expect(result.sql).not.toContain('ON DELETE');
    });
  });
});
