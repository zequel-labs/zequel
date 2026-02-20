import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType, RoutineType, RoutineParameterMode } from '@main/types';
import { SQLSERVER_DATA_TYPES } from '@main/types/schema-operations';

// ── Mock logger ──
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock mssql ──
const mockQueryFn = vi.fn();
const mockInputFn = vi.fn();
const mockCancelFn = vi.fn();
const mockPoolConnect = vi.fn();
const mockPoolClose = vi.fn();
const mockTransactionBegin = vi.fn();
const mockTransactionCommit = vi.fn();
const mockTransactionRollback = vi.fn();

const createMockRequest = () => ({
  query: mockQueryFn,
  input: mockInputFn,
  cancel: mockCancelFn,
});

let mockRequestInstance = createMockRequest();

vi.mock('mssql', () => {
  // Must use function (not arrow) so `new` works
  function MockConnectionPool() {
    return {
      connect: mockPoolConnect,
      close: mockPoolClose,
    };
  }

  function MockRequest() {
    return mockRequestInstance;
  }

  function MockTransaction() {
    return {
      begin: mockTransactionBegin,
      commit: mockTransactionCommit,
      rollback: mockTransactionRollback,
    };
  }

  return {
    default: {
      ConnectionPool: MockConnectionPool,
      Request: MockRequest,
      Transaction: MockTransaction,
      NVarChar: 'nvarchar',
    },
    ConnectionPool: MockConnectionPool,
    Request: MockRequest,
    Transaction: MockTransaction,
    NVarChar: 'nvarchar',
  };
});

// ── Mock knex ──
const mockKnexInsert = vi.fn();
const mockKnexWhere = vi.fn();
const mockKnexDelete = vi.fn();
const mockKnexUpdate = vi.fn();
const mockKnexSelect = vi.fn();
const mockKnexCount = vi.fn();
const mockKnexWithSchema = vi.fn();
const mockKnexLimit = vi.fn();
const mockKnexOffset = vi.fn();
const mockKnexOrderBy = vi.fn();
const mockKnexClone = vi.fn();
const mockKnexToSQL = vi.fn();

const createMockBuilder = (): Record<string, unknown> => {
  const builder: Record<string, unknown> = {
    insert: mockKnexInsert,
    where: mockKnexWhere,
    delete: mockKnexDelete,
    update: mockKnexUpdate,
    select: mockKnexSelect,
    count: mockKnexCount,
    withSchema: mockKnexWithSchema,
    limit: mockKnexLimit,
    offset: mockKnexOffset,
    orderBy: mockKnexOrderBy,
    clone: mockKnexClone,
    toSQL: mockKnexToSQL,
    whereNull: vi.fn().mockReturnThis(),
    whereNotNull: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
    whereNotIn: vi.fn().mockReturnThis(),
    whereBetween: vi.fn().mockReturnThis(),
    whereNotBetween: vi.fn().mockReturnThis(),
    whereRaw: vi.fn().mockReturnThis(),
  };

  // Chain everything back to itself
  mockKnexInsert.mockReturnValue(builder);
  mockKnexWhere.mockReturnValue(builder);
  mockKnexDelete.mockReturnValue(builder);
  mockKnexUpdate.mockReturnValue(builder);
  mockKnexSelect.mockReturnValue(builder);
  mockKnexCount.mockReturnValue(builder);
  mockKnexWithSchema.mockReturnValue(builder);
  mockKnexLimit.mockReturnValue(builder);
  mockKnexOffset.mockReturnValue(builder);
  mockKnexOrderBy.mockReturnValue(builder);
  mockKnexClone.mockReturnValue(builder);

  return builder;
};

vi.mock('knex', () => ({
  default: vi.fn(() => {
    const knexFn = () => createMockBuilder();
    return knexFn;
  }),
}));

import { SQLServerDriver } from '@main/db/sqlserver';

// ── Helpers ──

const createConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-sqlserver',
  name: 'Test SQL Server',
  type: DatabaseType.SQLServer,
  host: 'localhost',
  port: 1433,
  database: 'testdb',
  username: 'sa',
  password: 'secret',
  ...overrides,
});

const connectDriver = async (driver: SQLServerDriver): Promise<void> => {
  mockPoolConnect.mockResolvedValueOnce(undefined);
  await driver.connect(createConfig());
};

/**
 * Helper to create a mock IResult for mssql query results.
 * recordset: the array of rows, with optional columns metadata.
 * rowsAffected: array of affected row counts.
 */
const createMockResult = (
  recordset: Record<string, unknown>[] = [],
  rowsAffected: number[] = [0],
  columns?: Record<string, { type: { declaration: string }; nullable: boolean }>
) => {
  const rs = [...recordset] as Record<string, unknown>[] & { columns?: unknown };
  if (columns) {
    rs.columns = columns;
  }
  return {
    recordset: rs,
    recordsets: [rs],
    rowsAffected,
  };
};

// ── Tests ──

describe('SQLServerDriver', () => {
  let driver: SQLServerDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestInstance = createMockRequest();
    driver = new SQLServerDriver();
  });

  // ─────────── type ───────────
  describe('type', () => {
    it('should be SQLServer', () => {
      expect(driver.type).toBe(DatabaseType.SQLServer);
    });
  });

  // ─────────── supportsTransactions ───────────
  describe('supportsTransactions', () => {
    it('should return true', () => {
      expect(driver.supportsTransactions).toBe(true);
    });
  });

  // ─────────── connect / disconnect ───────────
  describe('connect', () => {
    it('should connect and set isConnected to true', async () => {
      await connectDriver(driver);
      expect(driver.isConnected).toBe(true);
    });

    it('should use default host and port when not provided', async () => {
      mockPoolConnect.mockResolvedValueOnce(undefined);
      await driver.connect(createConfig({ host: undefined, port: undefined, database: undefined }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle named instances by splitting host on backslash', async () => {
      mockPoolConnect.mockResolvedValueOnce(undefined);
      await driver.connect(createConfig({ host: 'myserver\\SQLEXPRESS' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should throw and set isConnected to false on failure', async () => {
      mockPoolConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(driver.connect(createConfig())).rejects.toThrow('ECONNREFUSED');
      expect(driver.isConnected).toBe(false);
    });

    it('should configure SSL when ssl is true with sslConfig', async () => {
      mockPoolConnect.mockResolvedValueOnce(undefined);
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: { ca: 'ca-cert', cert: 'client-cert', key: 'client-key' },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should set trustServerCertificate from config', async () => {
      mockPoolConnect.mockResolvedValueOnce(undefined);
      await driver.connect(createConfig({ trustServerCertificate: true }));
      expect(driver.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should close pool and set isConnected to false', async () => {
      await connectDriver(driver);
      mockPoolClose.mockResolvedValueOnce(undefined);
      await driver.disconnect();
      expect(mockPoolClose).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when already disconnected', async () => {
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });

    it('should rollback active transaction on disconnect', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();
      mockTransactionRollback.mockResolvedValueOnce(undefined);
      mockPoolClose.mockResolvedValueOnce(undefined);
      await driver.disconnect();
      expect(mockTransactionRollback).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });
  });

  // ─────────── ping ───────────
  describe('ping', () => {
    it('should return true when SELECT 1 succeeds', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ '': 1 }]));
      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when query throws', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('lost connection'));
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when no connection', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  // ─────────── cancelQuery ───────────
  describe('cancelQuery', () => {
    it('should return false when not running a query', async () => {
      await connectDriver(driver);
      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });
  });

  // ─────────── execute ───────────
  describe('execute', () => {
    beforeEach(async () => {
      await connectDriver(driver);
    });

    it('should return rows for a SELECT query', async () => {
      const columns = {
        id: { type: { declaration: 'int' }, nullable: false },
        name: { type: { declaration: 'nvarchar(100)' }, nullable: true },
      };
      const rows = [{ id: 1, name: 'Alice' }];
      const rs = [...rows] as Record<string, unknown>[] & { columns?: unknown };
      rs.columns = columns;
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.execute('SELECT * FROM users');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({ id: 1, name: 'Alice' });
      expect(result.rowCount).toBe(1);
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual(
        expect.objectContaining({ name: 'id', type: 'int' }),
      );
      expect(result.columns[1]).toEqual(
        expect.objectContaining({ name: 'name', type: 'nvarchar(100)' }),
      );
    });

    it('should return affectedRows for INSERT/UPDATE/DELETE', async () => {
      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [5],
      });

      const result = await driver.execute('DELETE FROM sessions WHERE expired = 1');
      expect(result.affectedRows).toBe(5);
      expect(result.rows).toEqual([]);
    });

    it('should bind params and replace ? placeholders with @p0, @p1, etc.', async () => {
      const columns = { id: { type: { declaration: 'int' }, nullable: false } };
      const rows = [{ id: 1 }];
      const rs = [...rows] as Record<string, unknown>[] & { columns?: unknown };
      rs.columns = columns;
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [0],
      });

      await driver.execute('SELECT * FROM users WHERE id = ? AND name = ?', [1, 'Alice']);
      expect(mockInputFn).toHaveBeenCalledWith('p0', 1);
      expect(mockInputFn).toHaveBeenCalledWith('p1', 'Alice');
      expect(mockQueryFn).toHaveBeenCalledWith('SELECT * FROM users WHERE id = @p0 AND name = @p1');
    });

    it('should pass O\'Brien as a binding without corruption', async () => {
      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      await driver.execute('SELECT * FROM users WHERE name = ?', ["O'Brien"]);
      expect(mockInputFn).toHaveBeenCalledWith('p0', "O'Brien");
      expect(mockQueryFn).toHaveBeenCalledWith('SELECT * FROM users WHERE name = @p0');
    });

    it('should return error on query failure', async () => {
      mockQueryFn.mockRejectedValueOnce(new Error('syntax error at position 5'));

      const result = await driver.execute('BAD SQL');
      expect(result.error).toBe('syntax error at position 5');
      expect(result.rows).toEqual([]);
    });

    it('should throw when not connected', async () => {
      const fresh = new SQLServerDriver();
      const result = await fresh.execute('SELECT 1').catch((e: Error) => e);
      expect(result).toBeInstanceOf(Error);
    });

    it('should use transaction request when useTransaction is true and transaction is active', async () => {
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      await driver.execute('INSERT INTO t VALUES (1)', [], true);
      expect(mockQueryFn).toHaveBeenCalled();
    });
  });

  // ─────────── getDatabases ───────────
  describe('getDatabases', () => {
    it('should return a list of databases', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ name: 'testdb' }, { name: 'myapp' }]),
      );

      const dbs = await driver.getDatabases();
      expect(dbs).toEqual([{ name: 'testdb' }, { name: 'myapp' }]);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getDatabases()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getSchemas ───────────
  describe('getSchemas', () => {
    it('should return a list of schemas', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'dbo', principal_id: 1, table_count: 5 },
          { name: 'sales', principal_id: 2, table_count: 3 },
        ]),
      );

      const schemas = await driver.getSchemas();
      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toEqual({ name: 'dbo', tableCount: 5 });
      expect(schemas[1]).toEqual({ name: 'sales', tableCount: 3 });
    });

    it('should throw when not connected', async () => {
      await expect(driver.getSchemas()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── setCurrentSchema / getCurrentSchema ───────────
  describe('setCurrentSchema / getCurrentSchema', () => {
    it('should default to dbo', () => {
      expect(driver.getCurrentSchema()).toBe('dbo');
    });

    it('should update current schema', () => {
      driver.setCurrentSchema('sales');
      expect(driver.getCurrentSchema()).toBe('sales');
    });
  });

  // ─────────── getTables ───────────
  describe('getTables', () => {
    it('should return tables with correct TableObjectType mapping', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'users', type: 'BASE TABLE' },
          { name: 'user_view', type: 'VIEW' },
        ]),
      );

      const tables = await driver.getTables('testdb');
      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual(
        expect.objectContaining({ name: 'users', type: TableObjectType.Table, schema: 'dbo' }),
      );
      expect(tables[1]).toEqual(
        expect.objectContaining({ name: 'user_view', type: TableObjectType.View, schema: 'dbo' }),
      );
    });

    it('should use specified schema', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      const tables = await driver.getTables('testdb', 'sales');
      expect(tables).toEqual([]);
      expect(mockInputFn).toHaveBeenCalledWith('schema', 'nvarchar', 'sales');
    });

    it('should throw when not connected', async () => {
      await expect(driver.getTables('testdb')).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getColumns ───────────
  describe('getColumns', () => {
    it('should return columns with correct mappings', async () => {
      await connectDriver(driver);
      // Main columns query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'id', ORDINAL_POSITION: 1, defaultValue: null, nullable: 'NO', type: 'int', length: null, precision: 10, scale: 0 },
          { name: 'email', ORDINAL_POSITION: 2, defaultValue: null, nullable: 'YES', type: 'nvarchar(255)', length: 255, precision: null, scale: null },
        ]),
      );
      // Primary keys query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ COLUMN_NAME: 'id' }]),
      );
      // Unique columns query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ COLUMN_NAME: 'email' }]),
      );
      // Identity columns query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ name: 'id' }]),
      );
      // Comments query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ column_name: 'id', comment: 'Primary key' }]),
      );

      const columns = await driver.getColumns('users');
      expect(columns).toHaveLength(2);
      expect(columns[0]).toEqual(
        expect.objectContaining({
          name: 'id',
          type: 'int',
          nullable: false,
          primaryKey: true,
          autoIncrement: true,
          comment: 'Primary key',
        }),
      );
      expect(columns[1]).toEqual(
        expect.objectContaining({
          name: 'email',
          type: 'nvarchar(255)',
          nullable: true,
          unique: true,
          length: 255,
        }),
      );
    });

    it('should throw when not connected', async () => {
      await expect(driver.getColumns('users')).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getIndexes ───────────
  describe('getIndexes', () => {
    it('should aggregate multi-column indexes', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { index_name: 'PK_users', is_unique: true, is_primary_key: true, column_name: 'id', key_ordinal: 1, index_type: 'CLUSTERED' },
          { index_name: 'IX_name_email', is_unique: false, is_primary_key: false, column_name: 'name', key_ordinal: 1, index_type: 'NONCLUSTERED' },
          { index_name: 'IX_name_email', is_unique: false, is_primary_key: false, column_name: 'email', key_ordinal: 2, index_type: 'NONCLUSTERED' },
        ]),
      );

      const indexes = await driver.getIndexes('users');
      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toEqual({
        name: 'PK_users',
        columns: ['id'],
        unique: true,
        primary: true,
        type: 'CLUSTERED',
      });
      expect(indexes[1]).toEqual({
        name: 'IX_name_email',
        columns: ['name', 'email'],
        unique: false,
        primary: false,
        type: 'NONCLUSTERED',
      });
    });

    it('should throw when not connected', async () => {
      await expect(driver.getIndexes('users')).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getForeignKeys ───────────
  describe('getForeignKeys', () => {
    it('should return foreign keys with ON UPDATE/DELETE', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          {
            name: 'FK_orders_user',
            column: 'user_id',
            referencedSchema: 'dbo',
            referencedTable: 'users',
            referencedColumn: 'id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
        ]),
      );

      const fks = await driver.getForeignKeys('orders');
      expect(fks).toHaveLength(1);
      expect(fks[0]).toEqual({
        name: 'FK_orders_user',
        column: 'user_id',
        referencedSchema: 'dbo',
        referencedTable: 'users',
        referencedColumn: 'id',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    });

    it('should throw when not connected', async () => {
      await expect(driver.getForeignKeys('orders')).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getTableDDL ───────────
  describe('getTableDDL', () => {
    it('should generate CREATE TABLE DDL from column/index/fk info', async () => {
      await connectDriver(driver);
      // getColumns: main query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'id', ORDINAL_POSITION: 1, defaultValue: null, nullable: 'NO', type: 'int', length: null, precision: 10, scale: 0 },
          { name: 'name', ORDINAL_POSITION: 2, defaultValue: null, nullable: 'YES', type: 'nvarchar(100)', length: 100, precision: null, scale: null },
        ]),
      );
      // getColumns: PK query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ COLUMN_NAME: 'id' }]));
      // getColumns: Unique query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // getColumns: Identity query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ name: 'id' }]));
      // getColumns: Comments query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // getIndexes
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // getForeignKeys
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      const ddl = await driver.getTableDDL('users');
      expect(ddl).toContain('CREATE TABLE');
      expect(ddl).toContain('[id]');
      expect(ddl).toContain('[name]');
      expect(ddl).toContain('IDENTITY(1,1)');
      expect(ddl).toContain('PRIMARY KEY');
    });
  });

  // ─────────── getPrimaryKeyColumns ───────────
  describe('getPrimaryKeyColumns', () => {
    it('should return primary key column names', async () => {
      await connectDriver(driver);
      // getColumns: main query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'id', ORDINAL_POSITION: 1, defaultValue: null, nullable: 'NO', type: 'int', length: null, precision: 10, scale: 0 },
          { name: 'email', ORDINAL_POSITION: 2, defaultValue: null, nullable: 'YES', type: 'nvarchar(255)', length: 255, precision: null, scale: null },
        ]),
      );
      // PK
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ COLUMN_NAME: 'id' }]));
      // Unique
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // Identity
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ name: 'id' }]));
      // Comments
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      const pks = await driver.getPrimaryKeyColumns('users');
      expect(pks).toEqual(['id']);
    });
  });

  // ─────────── getDataTypes ───────────
  describe('getDataTypes', () => {
    it('should return SQLSERVER_DATA_TYPES', () => {
      const types = driver.getDataTypes();
      expect(types).toBe(SQLSERVER_DATA_TYPES);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  // ─────────── Schema operations ───────────
  describe('addColumn', () => {
    it('should generate ALTER TABLE ADD sql', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE [dbo].[users] ADD');
      expect(result.sql).toContain('[age] INT');
      expect(result.sql).toContain('NOT NULL');
    });

    it('should include IDENTITY for auto increment columns', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'row_id', type: 'INT', nullable: false, autoIncrement: true },
      });
      expect(result.sql).toContain('IDENTITY(1,1)');
    });

    it('should include DEFAULT value', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'status', type: 'VARCHAR', length: 20, nullable: true, defaultValue: 'active' },
      });
      expect(result.sql).toContain("DEFAULT 'active'");
    });

    it('should escape single quotes in default value', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'greeting', type: 'NVARCHAR', length: 100, nullable: true, defaultValue: "O'Brien" },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'O''Brien'");
    });

    it('should include UNIQUE constraint', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'email', type: 'NVARCHAR', length: 255, nullable: true, unique: true },
      });
      expect(result.sql).toContain('UNIQUE');
    });

    it('should add column comment via extended property', async () => {
      await connectDriver(driver);
      // executeRaw for ADD
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // setExtendedProperty
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: true, comment: 'User age' },
      });
      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('duplicate column'));

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('duplicate column');
    });
  });

  describe('modifyColumn', () => {
    it('should rename column via sp_rename when name changes', async () => {
      await connectDriver(driver);
      // sp_rename
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // ALTER COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'full_name', type: 'NVARCHAR', length: 200, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('sp_rename');
      expect(result.sql).toContain('full_name');
    });

    it('should not rename when name stays the same', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // ALTER COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'NVARCHAR', length: 500, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE');
      expect(result.sql).toContain('ALTER COLUMN');
      expect(result.sql).not.toContain('sp_rename');
    });

    it('should set default value when provided', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // ALTER COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // ADD DEFAULT
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'status',
        newDefinition: { name: 'status', type: 'VARCHAR', length: 20, nullable: true, defaultValue: 'active' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ADD DEFAULT');
    });

    it('should escape single quotes in new default value', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // ALTER COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // ADD DEFAULT
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'bio',
        newDefinition: { name: 'bio', type: 'NVARCHAR', length: 500, nullable: true, defaultValue: "it's a test" },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'it''s a test'");
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('invalid column'));

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'full_name', type: 'NVARCHAR', length: 200, nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid column');
    });
  });

  describe('dropColumn', () => {
    it('should generate ALTER TABLE DROP COLUMN sql', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // DROP COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropColumn({ table: 'users', columnName: 'age' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE [dbo].[users] DROP COLUMN [age]');
    });

    it('should drop default constraint before dropping column', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint finds a constraint
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ constraint_name: 'DF_users_age' }]),
      );
      // DROP CONSTRAINT
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // DROP COLUMN
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropColumn({ table: 'users', columnName: 'age' });
      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      // dropDefaultConstraint
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // DROP COLUMN fails
      mockQueryFn.mockRejectedValueOnce(new Error('column not found'));

      const result = await driver.dropColumn({ table: 'users', columnName: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('column not found');
    });
  });

  describe('renameColumn', () => {
    it('should use sp_rename for column rename', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('sp_rename');
      expect(result.sql).toContain('@objname');
      expect(result.sql).toContain('@newname');
      expect(result.sql).toContain("'COLUMN'");
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('column not found'));

      const result = await driver.renameColumn({ table: 'users', oldName: 'missing', newName: 'new_name' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('column not found');
    });
  });

  describe('createIndex', () => {
    it('should create a regular index', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'IX_name', columns: ['name'] },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE INDEX [IX_name] ON [dbo].[users] ([name])');
    });

    it('should create a unique index', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'UQ_email', columns: ['email'], unique: true },
      });
      expect(result.sql).toContain('UNIQUE');
      expect(result.sql).toContain('[UQ_email]');
    });

    it('should create multi-column index', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'IX_name_email', columns: ['name', 'email'] },
      });
      expect(result.sql).toContain('[name], [email]');
    });

    it('should use specified schema', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'IX_name', columns: ['name'] },
        schema: 'sales',
      });
      expect(result.sql).toContain('[sales].[users]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('index exists'));

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'IX_name', columns: ['name'] },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('index exists');
    });
  });

  describe('dropIndex', () => {
    it('should generate DROP INDEX sql for non-primary key', async () => {
      await connectDriver(driver);
      // constraint check
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ type_desc: 'NONCLUSTERED' }]));
      // DROP INDEX
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropIndex({ table: 'users', indexName: 'IX_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP INDEX [IX_name] ON [dbo].[users]');
    });

    it('should use DROP CONSTRAINT for primary key index', async () => {
      await connectDriver(driver);
      // constraint check - CLUSTERED
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ type_desc: 'CLUSTERED' }]));
      // isIndexPrimaryKey check
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ is_primary_key: true }]));
      // DROP CONSTRAINT
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropIndex({ table: 'users', indexName: 'PK_users' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP CONSTRAINT [PK_users]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      // constraint check
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ type_desc: 'NONCLUSTERED' }]));
      // DROP INDEX fails
      mockQueryFn.mockRejectedValueOnce(new Error('index not found'));

      const result = await driver.dropIndex({ table: 'users', indexName: 'IX_missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('index not found');
    });
  });

  describe('addForeignKey', () => {
    it('should generate ADD CONSTRAINT sql', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'FK_orders_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ADD CONSTRAINT [FK_orders_user]');
      expect(result.sql).toContain('REFERENCES [dbo].[users]');
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });

    it('should use specified referenced schema', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'FK_orders_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          referencedSchema: 'sales',
        },
      });
      expect(result.sql).toContain('[sales].[users]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('constraint violation'));

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'FK_orders_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('constraint violation');
    });
  });

  describe('dropForeignKey', () => {
    it('should generate DROP CONSTRAINT sql', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropForeignKey({ table: 'orders', constraintName: 'FK_orders_user' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE [dbo].[orders] DROP CONSTRAINT [FK_orders_user]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('constraint not found'));

      const result = await driver.dropForeignKey({ table: 'orders', constraintName: 'FK_missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('constraint not found');
    });
  });

  describe('createTable', () => {
    it('should create a simple table', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'products',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'NVARCHAR', length: 100, nullable: false },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE [dbo].[products]');
      expect(result.sql).toContain('IDENTITY(1,1)');
      expect(result.sql).toContain('PRIMARY KEY ([id])');
    });

    it('should include foreign keys in table definition', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'user_id', type: 'INT', nullable: false },
          ],
          foreignKeys: [{
            name: 'FK_orders_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onDelete: 'CASCADE',
          }],
        },
      });
      expect(result.sql).toContain('CONSTRAINT [FK_orders_user]');
      expect(result.sql).toContain('ON DELETE CASCADE');
    });

    it('should create indexes after table creation', async () => {
      await connectDriver(driver);
      // CREATE TABLE
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // CREATE INDEX
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'user_id', type: 'INT', nullable: false },
          ],
          indexes: [{ name: 'IX_user_id', columns: ['user_id'] }],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should set table comment via extended property', async () => {
      await connectDriver(driver);
      // CREATE TABLE
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // setExtendedProperty
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'logs',
          columns: [{ name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true }],
          comment: 'Audit logs',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('table already exists'));

      const result = await driver.createTable({
        table: {
          name: 'products',
          columns: [{ name: 'id', type: 'INT', nullable: false, primaryKey: true }],
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('table already exists');
    });

    it('should include UNIQUE constraint on non-primary key columns', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'users',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'email', type: 'NVARCHAR', length: 255, nullable: false, unique: true },
          ],
        },
      });
      expect(result.sql).toContain('UNIQUE');
    });

    it('should escape single quotes in column default value', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'settings',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'value', type: 'NVARCHAR', length: 100, nullable: true, defaultValue: "it's O'Brien" },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'it''s O''Brien'");
    });

    it('should use BIGINT for auto increment BIGINT column', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTable({
        table: {
          name: 'big_table',
          columns: [
            { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
          ],
        },
      });
      expect(result.sql).toContain('BIGINT IDENTITY(1,1)');
    });
  });

  describe('identifier quoting', () => {
    it('should escape closing bracket in table names', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropTable({ table: 'weird]name' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE [dbo].[weird]]name]');
    });

    it('should escape closing bracket in column names', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'col]umn', type: 'INT', nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('[col]]umn]');
    });
  });

  describe('dropTable', () => {
    it('should generate DROP TABLE sql', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropTable({ table: 'users' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE [dbo].[users]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('table not found'));

      const result = await driver.dropTable({ table: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('table not found');
    });
  });

  describe('renameTable', () => {
    it('should use sp_rename for table rename', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.renameTable({ oldName: 'users', newName: 'accounts' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('sp_rename');
      expect(result.sql).toContain('@objname');
      expect(result.sql).toContain('@newname');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('table not found'));

      const result = await driver.renameTable({ oldName: 'missing', newName: 'new_name' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('table not found');
    });
  });

  // ─────────── updateTableComment ───────────
  describe('updateTableComment', () => {
    it('should set comment via extended property', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.updateTableComment('users', 'User accounts');
      expect(result.success).toBe(true);
    });

    it('should drop comment when null', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.updateTableComment('users', null);
      expect(result.success).toBe(true);
    });

    it('should drop comment when empty string', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.updateTableComment('users', '');
      expect(result.success).toBe(true);
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      // setExtendedProperty: first attempt (IF EXISTS ... EXEC sp_update/sp_add)
      mockQueryFn.mockRejectedValueOnce(new Error('permission denied'));
      // setExtendedProperty: fallback attempt (EXEC sp_addextendedproperty)
      mockQueryFn.mockRejectedValueOnce(new Error('permission denied'));

      const result = await driver.updateTableComment('users', 'comment');
      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });
  });

  // ─────────── Data operations ───────────
  describe('insertRow', () => {
    it('should insert row using knex-generated SQL', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: 'insert into [dbo].[users] ([name]) values (?)', bindings: ['Bob'] });

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Bob' },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });

    it('should handle O\'Brien value as binding', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: "insert into [dbo].[users] ([name]) values (?)", bindings: ["O'Brien"] });

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: "O'Brien" },
      });
      expect(result.success).toBe(true);
      expect(mockInputFn).toHaveBeenCalledWith('p0', "O'Brien");
    });

    it('should return error when execute returns error', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: 'insert into [dbo].[users] ([name]) values (?)', bindings: ['Bob'] });
      mockQueryFn.mockRejectedValueOnce(new Error('constraint violation'));

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Bob' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('deleteRow', () => {
    it('should delete row by primary key', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: 'delete from [dbo].[users] where [id] = ?', bindings: [42] });

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 42 },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });
  });

  describe('updateRow', () => {
    it('should update row by primary key', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: 'update [dbo].[users] set [name] = ? where [id] = ?', bindings: ['Alice', 1] });

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.updateRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
        values: { name: 'Alice' },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });

    it('should handle O\'Brien value as binding in update', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: "update [dbo].[users] set [name] = ? where [id] = ?", bindings: ["O'Brien", 1] });

      const rs = [] as Record<string, unknown>[] & { columns?: unknown };
      mockQueryFn.mockResolvedValueOnce({
        recordset: rs,
        recordsets: [rs],
        rowsAffected: [1],
      });

      const result = await driver.updateRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
        values: { name: "O'Brien" },
      });
      expect(result.success).toBe(true);
      expect(mockInputFn).toHaveBeenCalledWith('p0', "O'Brien");
      expect(mockInputFn).toHaveBeenCalledWith('p1', 1);
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockKnexToSQL.mockReturnValueOnce({ sql: 'update [dbo].[users] set [name] = ? where [id] = ?', bindings: ['Alice', 1] });
      mockQueryFn.mockRejectedValueOnce(new Error('constraint error'));

      const result = await driver.updateRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
        values: { name: 'Alice' },
      });
      expect(result.success).toBe(false);
    });
  });

  // ─────────── View operations ───────────
  describe('createView', () => {
    it('should create a view', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createView({
        view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = 1' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE VIEW [dbo].[active_users]');
      expect(result.sql).toContain('SELECT * FROM users WHERE active = 1');
    });

    it('should drop and recreate when replaceIfExists is true', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValue(createMockResult());

      const result = await driver.createView({
        view: { name: 'v', selectStatement: 'SELECT 1', replaceIfExists: true },
      });
      // Drop and create are separate executeRaw calls
      expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining('IF OBJECT_ID'));
      expect(mockQueryFn).toHaveBeenCalledWith(expect.stringContaining('DROP VIEW'));
      expect(result.sql).toContain('CREATE VIEW');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('invalid view'));

      const result = await driver.createView({
        view: { name: 'v', selectStatement: 'SELECT 1' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid view');
    });
  });

  describe('dropView', () => {
    it('should drop a view', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropView({ viewName: 'active_users' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP VIEW IF EXISTS [dbo].[active_users]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('view not found'));

      const result = await driver.dropView({ viewName: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('view not found');
    });
  });

  describe('renameView', () => {
    it('should use sp_rename for view rename', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('sp_rename');
      expect(result.sql).toContain('@objname');
      expect(result.sql).toContain('@newname');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('rename failed'));

      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('rename failed');
    });
  });

  describe('getViewDDL', () => {
    it('should return the view definition', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ definition: 'CREATE VIEW [dbo].[v] AS SELECT * FROM users' }]),
      );

      const ddl = await driver.getViewDDL('v');
      expect(ddl).toBe('CREATE VIEW [dbo].[v] AS SELECT * FROM users');
    });

    it('should return fallback when not found', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ definition: null }]));

      const ddl = await driver.getViewDDL('missing');
      expect(ddl).toContain('definition not found');
    });
  });

  // ─────────── getRoutines ───────────
  describe('getRoutines', () => {
    it('should return routines with parameters', async () => {
      await connectDriver(driver);
      // Main routines query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'get_user', type: 'FUNCTION', schema: 'dbo', returnType: 'int' },
          { name: 'update_user', type: 'PROCEDURE', schema: 'dbo', returnType: '' },
        ]),
      );
      // Parameters for get_user
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ name: '@user_id', type: 'int', mode: 'IN' }]),
      );
      // Parameters for update_user
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: '@id', type: 'int', mode: 'IN' },
          { name: '@result', type: 'int', mode: 'OUT' },
        ]),
      );

      const routines = await driver.getRoutines();
      expect(routines).toHaveLength(2);
      expect(routines[0]).toEqual(
        expect.objectContaining({
          name: 'get_user',
          type: RoutineType.Function,
          schema: 'dbo',
          returnType: 'int',
        }),
      );
      expect(routines[0].parameters).toHaveLength(1);
      expect(routines[0].parameters![0]).toEqual({
        name: 'user_id',
        type: 'int',
        mode: RoutineParameterMode.In,
      });
      expect(routines[1]).toEqual(
        expect.objectContaining({
          name: 'update_user',
          type: RoutineType.Procedure,
          schema: 'dbo',
        }),
      );
      expect(routines[1].parameters).toHaveLength(2);
      expect(routines[1].parameters![1]).toEqual({
        name: 'result',
        type: 'int',
        mode: RoutineParameterMode.Out,
      });
    });

    it('should filter by procedure type', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      await driver.getRoutines(RoutineType.Procedure);
      const sql = mockQueryFn.mock.calls[0][0] as string;
      expect(sql).toContain("ROUTINE_TYPE = 'PROCEDURE'");
    });

    it('should filter by function type', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      await driver.getRoutines(RoutineType.Function);
      const sql = mockQueryFn.mock.calls[0][0] as string;
      expect(sql).toContain("ROUTINE_TYPE = 'FUNCTION'");
    });

    it('should throw when not connected', async () => {
      await expect(driver.getRoutines()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getRoutineDefinition ───────────
  describe('getRoutineDefinition', () => {
    it('should return routine definition', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ definition: 'CREATE PROCEDURE update_user AS BEGIN ... END' }]),
      );

      const def = await driver.getRoutineDefinition('update_user', RoutineType.Procedure);
      expect(def).toBe('CREATE PROCEDURE update_user AS BEGIN ... END');
    });

    it('should return fallback when not found', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ definition: null }]));

      const def = await driver.getRoutineDefinition('missing', RoutineType.Function);
      expect(def).toContain('definition not found');
    });

    it('should throw when not connected', async () => {
      await expect(driver.getRoutineDefinition('fn', RoutineType.Function)).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getTriggers ───────────
  describe('getTriggers', () => {
    it('should return triggers', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          {
            trigger_name: 'trg_audit',
            table_name: 'users',
            schema_name: 'dbo',
            is_disabled: false,
            timing: 'AFTER',
            event: 'INSERT',
          },
        ]),
      );

      const triggers = await driver.getTriggers();
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toEqual({
        name: 'trg_audit',
        table: 'users',
        schema: 'dbo',
        timing: 'AFTER',
        event: 'INSERT',
        enabled: true,
      });
    });

    it('should filter by table', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      await driver.getTriggers('users');
      expect(mockInputFn).toHaveBeenCalledWith('table', 'nvarchar', 'users');
    });

    it('should return disabled trigger correctly', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          {
            trigger_name: 'trg_disabled',
            table_name: 'users',
            schema_name: 'dbo',
            is_disabled: true,
            timing: 'INSTEAD OF',
            event: 'UPDATE',
          },
        ]),
      );

      const triggers = await driver.getTriggers();
      expect(triggers[0].enabled).toBe(false);
      expect(triggers[0].timing).toBe('INSTEAD OF');
    });

    it('should throw when not connected', async () => {
      await expect(driver.getTriggers()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getTriggerDefinition ───────────
  describe('getTriggerDefinition', () => {
    it('should return trigger definition', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([{ definition: 'CREATE TRIGGER trg_audit ON dbo.users AFTER INSERT AS BEGIN ... END' }]),
      );

      const def = await driver.getTriggerDefinition('trg_audit');
      expect(def).toBe('CREATE TRIGGER trg_audit ON dbo.users AFTER INSERT AS BEGIN ... END');
    });

    it('should return fallback when not found', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ definition: null }]));

      const def = await driver.getTriggerDefinition('missing');
      expect(def).toContain('definition not found');
    });
  });

  // ─────────── createTrigger ───────────
  describe('createTrigger', () => {
    it('should create a trigger', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_audit',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'INSERT INTO audit SELECT * FROM inserted',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TRIGGER');
      expect(result.sql).toContain('[trg_audit]');
      expect(result.sql).toContain('[users]');
      expect(result.sql).toContain('AFTER INSERT');
      expect(result.sql).toContain('INSERT INTO audit SELECT * FROM inserted');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('trigger error'));

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_bad',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'BAD SQL',
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('trigger error');
    });
  });

  // ─────────── dropTrigger ───────────
  describe('dropTrigger', () => {
    it('should drop a trigger', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropTrigger({ triggerName: 'trg_audit' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TRIGGER IF EXISTS [dbo].[trg_audit]');
    });

    it('should use specified schema', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropTrigger({ triggerName: 'trg_audit', schema: 'sales' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TRIGGER IF EXISTS [sales].[trg_audit]');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('trigger not found'));

      const result = await driver.dropTrigger({ triggerName: 'missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('trigger not found');
    });
  });

  // ─────────── getUsers ───────────
  describe('getUsers', () => {
    it('should return user list', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'app_user', type_desc: 'SQL_LOGIN', is_disabled: false, default_database_name: 'testdb', is_sysadmin: false },
          { name: 'admin', type_desc: 'SQL_LOGIN', is_disabled: false, default_database_name: 'master', is_sysadmin: true },
        ]),
      );

      const users = await driver.getUsers();
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({
        name: 'app_user',
        superuser: false,
        login: true,
        roles: [],
      });
      expect(users[1]).toEqual({
        name: 'admin',
        superuser: true,
        login: true,
        roles: [],
      });
    });

    it('should mark disabled users with login false', async () => {
      await connectDriver(driver);
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'disabled_user', type_desc: 'SQL_LOGIN', is_disabled: true, default_database_name: 'testdb', is_sysadmin: false },
        ]),
      );

      const users = await driver.getUsers();
      expect(users[0].login).toBe(false);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getUsers()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── createUser ───────────
  describe('createUser', () => {
    it('should create user with password', async () => {
      await connectDriver(driver);
      // CREATE LOGIN
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // CREATE USER
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'secret123' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE LOGIN');
      expect(result.sql).toContain('****');
      expect(result.sql).not.toContain('secret123');
    });

    it('should create user without password', async () => {
      await connectDriver(driver);
      // CREATE LOGIN (with empty password)
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // CREATE USER
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.createUser({
        user: { name: 'testuser' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE LOGIN');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQueryFn.mockRejectedValueOnce(new Error('Login already exists'));

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'pw' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Login already exists');
    });
  });

  // ─────────── dropUser ───────────
  describe('dropUser', () => {
    it('should drop user (login and database user)', async () => {
      await connectDriver(driver);
      // DROP USER
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // DROP LOGIN
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropUser({ name: 'testuser' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP LOGIN [testuser]');
    });

    it('should still drop login even if DROP USER fails', async () => {
      await connectDriver(driver);
      // DROP USER fails
      mockQueryFn.mockRejectedValueOnce(new Error('user not found'));
      // DROP LOGIN succeeds
      mockQueryFn.mockResolvedValueOnce(createMockResult());

      const result = await driver.dropUser({ name: 'testuser' });
      expect(result.success).toBe(true);
    });

    it('should return error when DROP LOGIN fails', async () => {
      await connectDriver(driver);
      // DROP USER succeeds
      mockQueryFn.mockResolvedValueOnce(createMockResult());
      // DROP LOGIN fails
      mockQueryFn.mockRejectedValueOnce(new Error('Cannot drop login'));

      const result = await driver.dropUser({ name: 'testuser' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot drop login');
    });
  });

  // ─────────── Transaction support ───────────
  describe('beginTransaction', () => {
    it('should begin a transaction', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);

      await driver.beginTransaction();
      expect(driver.inTransaction).toBe(true);
      expect(mockTransactionBegin).toHaveBeenCalled();
    });

    it('should throw if transaction already active', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();

      await expect(driver.beginTransaction()).rejects.toThrow('Transaction already active');
    });

    it('should throw when not connected', async () => {
      await expect(driver.beginTransaction()).rejects.toThrow('Not connected');
    });
  });

  describe('commitTransaction', () => {
    it('should commit the active transaction', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();

      mockTransactionCommit.mockResolvedValueOnce(undefined);
      await driver.commitTransaction();
      expect(driver.inTransaction).toBe(false);
      expect(mockTransactionCommit).toHaveBeenCalled();
    });

    it('should throw when no transaction is active', async () => {
      await connectDriver(driver);
      await expect(driver.commitTransaction()).rejects.toThrow('No active transaction');
    });

    it('should throw when not connected', async () => {
      await expect(driver.commitTransaction()).rejects.toThrow('Not connected');
    });
  });

  describe('rollbackTransaction', () => {
    it('should rollback the active transaction', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();

      mockTransactionRollback.mockResolvedValueOnce(undefined);
      await driver.rollbackTransaction();
      expect(driver.inTransaction).toBe(false);
      expect(mockTransactionRollback).toHaveBeenCalled();
    });

    it('should throw when no transaction is active', async () => {
      await connectDriver(driver);
      await expect(driver.rollbackTransaction()).rejects.toThrow('No active transaction');
    });

    it('should reset inTransaction even if rollback throws', async () => {
      await connectDriver(driver);
      mockTransactionBegin.mockResolvedValueOnce(undefined);
      await driver.beginTransaction();

      mockTransactionRollback.mockRejectedValueOnce(new Error('rollback failed'));
      await expect(driver.rollbackTransaction()).rejects.toThrow('rollback failed');
      expect(driver.inTransaction).toBe(false);
    });

    it('should throw when not connected', async () => {
      await expect(driver.rollbackTransaction()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── testConnection ───────────
  describe('testConnection', () => {
    it('should return success with server info', async () => {
      // connect
      mockPoolConnect.mockResolvedValueOnce(undefined);

      // @@VERSION
      const versionRs = [{ version: 'Microsoft SQL Server 2022' }] as Record<string, unknown>[] & { columns?: unknown };
      versionRs.columns = { version: { type: { declaration: 'nvarchar(max)' }, nullable: true } };
      mockQueryFn.mockResolvedValueOnce({ recordset: versionRs, recordsets: [versionRs], rowsAffected: [0] });

      // Edition
      const editionRs = [{ edition: 'Developer Edition' }] as Record<string, unknown>[] & { columns?: unknown };
      editionRs.columns = { edition: { type: { declaration: 'nvarchar(max)' }, nullable: true } };
      mockQueryFn.mockResolvedValueOnce({ recordset: editionRs, recordsets: [editionRs], rowsAffected: [0] });

      // ProductVersion
      const pvRs = [{ version: '16.0.1000.6' }] as Record<string, unknown>[] & { columns?: unknown };
      pvRs.columns = { version: { type: { declaration: 'nvarchar(max)' }, nullable: true } };
      mockQueryFn.mockResolvedValueOnce({ recordset: pvRs, recordsets: [pvRs], rowsAffected: [0] });

      // @@SERVERNAME
      const snRs = [{ name: 'MYSERVER' }] as Record<string, unknown>[] & { columns?: unknown };
      snRs.columns = { name: { type: { declaration: 'nvarchar(max)' }, nullable: true } };
      mockQueryFn.mockResolvedValueOnce({ recordset: snRs, recordsets: [snRs], rowsAffected: [0] });

      // disconnect
      mockPoolClose.mockResolvedValueOnce(undefined);

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(true);
      expect(result.serverVersion).toContain('Microsoft SQL Server');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return failure when connection fails', async () => {
      mockPoolConnect.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  // ─────────── getTableData ───────────
  describe('getTableData', () => {
    /** Helper to mock getColumns (5 sequential queries) */
    const mockGetColumns = () => {
      // Main columns query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'id', ORDINAL_POSITION: 1, defaultValue: null, nullable: 'NO', type: 'int', length: null, precision: 10, scale: 0 },
          { name: 'name', ORDINAL_POSITION: 2, defaultValue: null, nullable: 'YES', type: 'nvarchar(255)', length: 255, precision: null, scale: null },
        ]),
      );
      // PK query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ COLUMN_NAME: 'id' }]));
      // Unique query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // Identity query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ name: 'id' }]));
      // Comments query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
    };

    it('should return paginated table data', async () => {
      await connectDriver(driver);

      // getColumns (5 queries) — called first to determine PK for default ORDER BY
      mockGetColumns();

      mockKnexToSQL
        .mockReturnValueOnce({ sql: 'select count(*) as [count] from [dbo].[customers]', bindings: [] })
        .mockReturnValueOnce({ sql: 'select * from [dbo].[customers] order by [id] asc limit 2 offset 0', bindings: [] });

      // count query via execute
      const countRs = [{ count: 50 }] as Record<string, unknown>[] & { columns?: unknown };
      countRs.columns = { count: { type: { declaration: 'int' }, nullable: false } };
      mockQueryFn.mockResolvedValueOnce({ recordset: countRs, recordsets: [countRs], rowsAffected: [0] });

      // data query via execute
      const dataRs = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] as Record<string, unknown>[] & { columns?: unknown };
      dataRs.columns = {
        id: { type: { declaration: 'int' }, nullable: false },
        name: { type: { declaration: 'nvarchar(255)' }, nullable: true },
      };
      mockQueryFn.mockResolvedValueOnce({ recordset: dataRs, recordsets: [dataRs], rowsAffected: [0] });

      const result = await driver.getTableData('customers', { offset: 0, limit: 2 });

      expect(result.totalCount).toBe(50);
      expect(result.rows).toHaveLength(2);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(2);
      expect(result.columns.length).toBeGreaterThan(0);
    });

    it('should use knownTotalCount when provided', async () => {
      await connectDriver(driver);

      // getColumns (5 queries) — called first to determine PK for default ORDER BY
      mockGetColumns();

      mockKnexToSQL
        .mockReturnValueOnce({ sql: 'select count(*) as [count] from [dbo].[customers]', bindings: [] })
        .mockReturnValueOnce({ sql: 'select * from [dbo].[customers]', bindings: [] });

      // data query only (no count query)
      const dataRs = [{ id: 1 }] as Record<string, unknown>[] & { columns?: unknown };
      dataRs.columns = { id: { type: { declaration: 'int' }, nullable: false } };
      mockQueryFn.mockResolvedValueOnce({ recordset: dataRs, recordsets: [dataRs], rowsAffected: [0] });

      const result = await driver.getTableData('customers', { offset: 0, limit: 10, knownTotalCount: 100 });

      expect(result.totalCount).toBe(100);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getTableData('customers', { offset: 0, limit: 10 })).rejects.toThrow();
    });
  });

  // ─────────── queryStream ───────────
  describe('queryStream', () => {
    it('should return stream result with cursor', async () => {
      await connectDriver(driver);

      // Count query via direct mssql.Request (queryStream creates request directly)
      mockQueryFn.mockResolvedValueOnce({
        recordset: [{ count: 100 }],
        recordsets: [[{ count: 100 }]],
        rowsAffected: [0],
      });

      // getColumnsFromQuery via direct mssql.Request
      const colsRs = [] as Record<string, unknown>[] & { columns?: unknown };
      colsRs.columns = { id: { type: { declaration: 'int' }, nullable: false } };
      mockQueryFn.mockResolvedValueOnce({
        recordset: colsRs,
        recordsets: [colsRs],
        rowsAffected: [0],
      });

      const result = await driver.queryStream('SELECT * FROM customers', 500);

      expect(result.totalRows).toBe(100);
      expect(result.cursor).toBeDefined();
      expect(result.columns).toHaveLength(1);
    });

    it('should handle count query failure gracefully', async () => {
      await connectDriver(driver);

      // Count query fails (e.g. DDL statement)
      mockQueryFn.mockRejectedValueOnce(new Error('syntax error'));

      // getColumnsFromQuery
      const colsRs = [] as Record<string, unknown>[] & { columns?: unknown };
      colsRs.columns = {};
      mockQueryFn.mockResolvedValueOnce({
        recordset: colsRs,
        recordsets: [colsRs],
        rowsAffected: [0],
      });

      const result = await driver.queryStream('CREATE TABLE foo (id INT)', 100);

      expect(result.totalRows).toBe(0);
      expect(result.cursor).toBeDefined();
    });

    it('should throw when not connected', async () => {
      await expect(driver.queryStream('SELECT 1', 100)).rejects.toThrow();
    });
  });

  // ─────────── selectTopStream ───────────
  describe('selectTopStream', () => {
    it('should return stream result for table data', async () => {
      await connectDriver(driver);

      mockKnexToSQL
        .mockReturnValueOnce({ sql: 'select count(*) as [count] from [dbo].[customers]', bindings: [] })
        .mockReturnValueOnce({ sql: 'select * from [dbo].[customers]', bindings: [] });

      // count query via execute
      const countRs = [{ count: 200 }] as Record<string, unknown>[] & { columns?: unknown };
      countRs.columns = { count: { type: { declaration: 'int' }, nullable: false } };
      mockQueryFn.mockResolvedValueOnce({ recordset: countRs, recordsets: [countRs], rowsAffected: [0] });

      // getColumns (5 queries)
      // Main columns query
      mockQueryFn.mockResolvedValueOnce(
        createMockResult([
          { name: 'id', ORDINAL_POSITION: 1, defaultValue: null, nullable: 'NO', type: 'int', length: null, precision: 10, scale: 0 },
        ]),
      );
      // PK query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ COLUMN_NAME: 'id' }]));
      // Unique query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));
      // Identity query
      mockQueryFn.mockResolvedValueOnce(createMockResult([{ name: 'id' }]));
      // Comments query
      mockQueryFn.mockResolvedValueOnce(createMockResult([]));

      const result = await driver.selectTopStream('customers', { offset: 0, limit: 50 }, 500);

      expect(result.totalRows).toBe(200);
      expect(result.cursor).toBeDefined();
      expect(result.columns.length).toBeGreaterThan(0);
    });

    it('should throw when not connected', async () => {
      await expect(driver.selectTopStream('customers', { offset: 0 }, 100)).rejects.toThrow();
    });
  });
});
