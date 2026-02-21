import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType } from '@main/types';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock('@main/utils/serialize', () => ({
  toPlainObject: vi.fn(<T>(obj: T): T => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('@main/ipc/helpers', () => ({
  withDriver: vi.fn(),
}));

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
  },
}));

vi.mock('@main/utils/format', () => ({
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
}));

import { ipcMain } from 'electron';
import { withDriver } from '@main/ipc/helpers';
import { toPlainObject } from '@main/utils/serialize';
import { registerSchemaHandlers } from '@main/ipc/schema';
import { connectionManager } from '@main/db/manager';
import type { DatabaseDriver } from '@main/db/base';

const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls;
  const match = calls.find((c) => c[0] === channel);
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return match[1] as (...args: unknown[]) => unknown;
};

// Helper to set up withDriver to call through with a mock driver
const setupWithDriverMock = (methodName: string, returnValue: unknown): ReturnType<typeof vi.fn> => {
  const methodMock = vi.fn().mockResolvedValue(returnValue);
  vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
    const mockDriverInstance = { [methodName]: methodMock } as unknown as DatabaseDriver;
    return fn(mockDriverInstance);
  });
  return methodMock;
};

describe('registerSchemaHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSchemaHandlers();
  });

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
    expect(registeredChannels).toContain('schema:databases');
    expect(registeredChannels).toContain('schema:tables');
    expect(registeredChannels).toContain('schema:columns');
    expect(registeredChannels).toContain('schema:indexes');
    expect(registeredChannels).toContain('schema:foreignKeys');
    expect(registeredChannels).toContain('schema:tableDDL');
    expect(registeredChannels).toContain('schema:tableData');
  });

  describe('schema:databases', () => {
    it('should call driver.getDatabases and return the result', async () => {
      const databases = [{ name: 'db1' }, { name: 'db2' }];
      const methodMock = setupWithDriverMock('getDatabases', databases);

      const handler = getHandler('schema:databases');
      const result = await handler({}, 'conn-1');

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function));
      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(databases);
    });
  });

  describe('schema:tables', () => {
    it('should call driver.getTables with database and optional schema', async () => {
      const tables = [{ name: 'users', type: 'table' }];
      const methodMock = setupWithDriverMock('getTables', tables);

      const handler = getHandler('schema:tables');
      const result = await handler({}, 'conn-1', 'mydb', 'public');

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('mydb', 'public');
      expect(result).toEqual(tables);
    });

    it('should work without schema parameter', async () => {
      const tables = [{ name: 'orders', type: 'table' }];
      const methodMock = setupWithDriverMock('getTables', tables);

      const handler = getHandler('schema:tables');
      const result = await handler({}, 'conn-1', 'mydb');

      expect(methodMock).toHaveBeenCalledWith('mydb', undefined);
      expect(result).toEqual(tables);
    });
  });

  describe('schema:columns', () => {
    it('should call driver.getColumns with table name', async () => {
      const columns = [
        { name: 'id', type: 'INT', nullable: false, primaryKey: true },
        { name: 'email', type: 'VARCHAR', nullable: true, primaryKey: false },
      ];
      const methodMock = setupWithDriverMock('getColumns', columns);

      const handler = getHandler('schema:columns');
      const result = await handler({}, 'conn-1', 'users');

      expect(methodMock).toHaveBeenCalledWith('users');
      expect(result).toEqual(columns);
    });
  });

  describe('schema:indexes', () => {
    it('should call driver.getIndexes with table name', async () => {
      const indexes = [
        { name: 'pk_users', columns: ['id'], unique: true, primary: true },
      ];
      const methodMock = setupWithDriverMock('getIndexes', indexes);

      const handler = getHandler('schema:indexes');
      const result = await handler({}, 'conn-1', 'users');

      expect(methodMock).toHaveBeenCalledWith('users');
      expect(result).toEqual(indexes);
    });
  });

  describe('schema:foreignKeys', () => {
    it('should call driver.getForeignKeys with table name', async () => {
      const fks = [
        { name: 'fk_orders_user', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' },
      ];
      const methodMock = setupWithDriverMock('getForeignKeys', fks);

      const handler = getHandler('schema:foreignKeys');
      const result = await handler({}, 'conn-1', 'orders');

      expect(methodMock).toHaveBeenCalledWith('orders');
      expect(result).toEqual(fks);
    });
  });

  describe('schema:tableDDL', () => {
    it('should call driver.getTableDDL with table name', async () => {
      const ddl = 'CREATE TABLE users (id INT PRIMARY KEY, name TEXT)';
      const methodMock = setupWithDriverMock('getTableDDL', ddl);

      const handler = getHandler('schema:tableDDL');
      const result = await handler({}, 'conn-1', 'users');

      expect(methodMock).toHaveBeenCalledWith('users');
      expect(result).toBe(ddl);
    });
  });

  describe('schema:tableData', () => {
    it('should call driver.getTableData and serialize with toPlainObject', async () => {
      const dataResult = {
        columns: [{ name: 'id', type: 'INT', nullable: false }],
        rows: [{ id: 1 }, { id: 2 }],
        totalCount: 2,
        offset: 0,
        limit: 50,
      };
      const methodMock = setupWithDriverMock('getTableData', dataResult);

      const handler = getHandler('schema:tableData');
      const options = { offset: 0, limit: 50 };
      const result = await handler({}, 'conn-1', 'users', options);

      expect(methodMock).toHaveBeenCalledWith('users', options);
      expect(toPlainObject).toHaveBeenCalledWith(dataResult);
      expect(result).toEqual(dataResult);
    });

    it('should pass filter and sort options through', async () => {
      const dataResult = { columns: [], rows: [], totalCount: 0, offset: 0, limit: 10 };
      const methodMock = setupWithDriverMock('getTableData', dataResult);

      const handler = getHandler('schema:tableData');
      const options = {
        offset: 10,
        limit: 10,
        orderBy: 'name',
        orderDirection: 'ASC',
        filters: [{ column: 'status', operator: '=', value: 'active' }],
      };
      await handler({}, 'conn-1', 'users', options);

      expect(methodMock).toHaveBeenCalledWith('users', options);
    });
  });

  describe('schema:getTableProperties', () => {
    it('should register the getTableProperties handler', () => {
      const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);
      expect(registeredChannels).toContain('schema:getTableProperties');
    });

    it('should throw when connection is not found', async () => {
      vi.mocked(connectionManager.getConnection).mockReturnValue(undefined);
      const handler = getHandler('schema:getTableProperties');

      await expect(handler({}, 'conn-1', 'users', TableObjectType.Table)).rejects.toThrow('Connection not found');
    });

    it('should return fallback result for unsupported database type', async () => {
      const mockDriver = { type: 'unknown-type' };
      vi.mocked(connectionManager.getConnection).mockReturnValue(mockDriver as unknown as DatabaseDriver);

      const handler = getHandler('schema:getTableProperties');
      const result = await handler({}, 'conn-1', 'users', TableObjectType.Table);

      expect(result).toEqual({ name: 'users', type: TableObjectType.Table });
    });

    // ─── PostgreSQL ──────────────────────────────────────────────────────
    describe('PostgreSQL', () => {
      const createPgDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.PostgreSQL,
          execute: executeMock,
          getTableDDL: vi.fn(),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return PostgreSQL table properties with metadata', async () => {
        const executeMock = vi.fn().mockResolvedValue({
          rows: [{
            oid: 16384,
            owner: 'postgres',
            tablespace: 'pg_default',
            row_count: 100,
            column_count: 5,
            index_count: 2,
            total_size: '8192',
            table_size: '4096',
            index_size: '4096',
            has_indexes: true,
            has_rules: false,
            has_triggers: true,
            comment: 'Users table',
          }],
          error: undefined,
        });
        const driver = createPgDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue('CREATE TABLE users (id INT)');

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table, 'public') as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 'users',
          type: TableObjectType.Table,
          schema: 'public',
          oid: 16384,
          owner: 'postgres',
          rowCount: 100,
          columnCount: 5,
          indexCount: 2,
          hasIndexes: true,
          hasRules: false,
          hasTriggers: true,
          comment: 'Users table',
          ddl: 'CREATE TABLE users (id INT)',
        });
      });

      it('should default schema to public when not provided', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [], error: undefined });
        createPgDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ schema: 'public' });
        expect(executeMock).toHaveBeenCalledWith(expect.stringContaining('pg_class'), ['users', 'public']);
      });

      it('should get view DDL for PostgreSQL views', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined }) // metadata query
          .mockResolvedValueOnce({
            rows: [{ definition: 'SELECT * FROM users' }],
            error: undefined,
          }); // view DDL query
        createPgDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'active_users', TableObjectType.View, 'public') as Record<string, unknown>;

        expect(result).toMatchObject({
          ddl: 'CREATE OR REPLACE VIEW "public"."active_users" AS\nSELECT * FROM users',
        });
      });

      it('should ignore metadata errors gracefully', async () => {
        const executeMock = vi.fn().mockRejectedValue(new Error('Permission denied'));
        const driver = createPgDriver(executeMock);
        driver.getTableDDL = vi.fn().mockRejectedValue(new Error('DDL error'));

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users', type: TableObjectType.Table });
      });

      it('should ignore DDL errors for tables', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [], error: undefined });
        const driver = createPgDriver(executeMock);
        driver.getTableDDL = vi.fn().mockRejectedValue(new Error('DDL error'));

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users' });
        expect(result.ddl).toBeUndefined();
      });

      it('should ignore DDL errors for views', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockRejectedValueOnce(new Error('View DDL error'));
        createPgDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'v_users', TableObjectType.View) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'v_users' });
        expect(result.ddl).toBeUndefined();
      });

      it('should handle metadata query returning error field', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [{ oid: 1 }], error: 'some error' });
        const driver = createPgDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue(null);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.oid).toBeUndefined();
      });

      it('should handle view DDL query returning error field', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({ rows: [{ definition: 'SELECT 1' }], error: 'some error' });
        createPgDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'v_users', TableObjectType.View) as Record<string, unknown>;

        expect(result.ddl).toBeUndefined();
      });

      it('should set tablespace to pg_default when null', async () => {
        const executeMock = vi.fn().mockResolvedValue({
          rows: [{
            oid: 1, owner: 'pg', tablespace: null, row_count: 0, column_count: 1,
            index_count: 0, total_size: '0', table_size: '0', index_size: '0',
            has_indexes: false, has_rules: false, has_triggers: false, comment: null,
          }],
          error: undefined,
        });
        const driver = createPgDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue(null);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.tablespace).toBe('pg_default');
      });
    });

    // ─── MySQL / MariaDB ─────────────────────────────────────────────────
    describe('MySQL / MariaDB', () => {
      const createMySQLDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.MySQL,
          execute: executeMock,
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return MySQL table properties with metadata', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              table_schema: 'testdb',
              engine: 'InnoDB',
              row_format: 'Dynamic',
              row_count: 500,
              avg_row_length: 64,
              data_length: 32000,
              index_length: 16000,
              data_free: 0,
              auto_increment: 501,
              collation: 'utf8mb4_unicode_ci',
              create_time: '2024-01-01 00:00:00',
              update_time: '2024-06-01 12:00:00',
              comment: 'Users table',
            }],
            error: undefined,
          })
          .mockResolvedValueOnce({
            rows: [{ 'Create Table': 'CREATE TABLE users (id INT PRIMARY KEY)' }],
            error: undefined,
          });

        createMySQLDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 'users',
          type: TableObjectType.Table,
          database: 'testdb',
          engine: 'InnoDB',
          rowFormat: 'Dynamic',
          rowCount: 500,
          collation: 'utf8mb4_unicode_ci',
          charset: 'utf8mb4',
          ddl: 'CREATE TABLE users (id INT PRIMARY KEY)',
        });
      });

      it('should dispatch to MySQL for MariaDB driver type', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({ rows: [], error: undefined });
        const driver = {
          type: DatabaseType.MariaDB,
          execute: executeMock,
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users', type: TableObjectType.Table });
      });

      it('should get view DDL with SHOW CREATE VIEW', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({
            rows: [{ 'Create View': 'CREATE VIEW v_users AS SELECT * FROM users' }],
            error: undefined,
          });
        createMySQLDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'v_users', TableObjectType.View) as Record<string, unknown>;

        expect(result.ddl).toBe('CREATE VIEW v_users AS SELECT * FROM users');
      });

      it('should ignore metadata errors gracefully', async () => {
        const executeMock = vi.fn()
          .mockRejectedValueOnce(new Error('Access denied'))
          .mockRejectedValueOnce(new Error('DDL error'));
        createMySQLDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users', type: TableObjectType.Table });
      });

      it('should not set charset when collation is undefined', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              table_schema: 'testdb', engine: 'InnoDB', row_format: 'Dynamic',
              row_count: 0, avg_row_length: 0, data_length: 0, index_length: 0,
              data_free: 0, auto_increment: null, collation: null,
              create_time: null, update_time: null, comment: null,
            }],
            error: undefined,
          })
          .mockResolvedValueOnce({ rows: [], error: undefined });
        createMySQLDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.charset).toBeUndefined();
      });

      it('should handle DDL query returning error field', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({ rows: [{ 'Create Table': 'CREATE TABLE' }], error: 'some error' });
        createMySQLDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.ddl).toBeUndefined();
      });
    });

    // ─── SQLite ──────────────────────────────────────────────────────────
    describe('SQLite', () => {
      const createSQLiteDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.SQLite,
          execute: executeMock,
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return SQLite table properties', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [{ sql: 'CREATE TABLE users (id INT)' }], error: undefined })
          .mockResolvedValueOnce({ rows: [{ cnt: 42 }], error: undefined })
          .mockResolvedValueOnce({ rows: [{ page_count: 10 }], error: undefined })
          .mockResolvedValueOnce({ rows: [{ page_size: 4096 }], error: undefined });
        createSQLiteDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 'users',
          type: TableObjectType.Table,
          ddl: 'CREATE TABLE users (id INT)',
          rowCount: 42,
          pageCount: 10,
          pageSize: 4096,
        });
      });

      it('should pass view type to sqlite_master query', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [{ sql: 'CREATE VIEW v AS SELECT 1' }], error: undefined })
          .mockResolvedValueOnce({ rows: [{ cnt: 1 }], error: undefined })
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({ rows: [], error: undefined });
        createSQLiteDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        await handler({}, 'conn-1', 'v', TableObjectType.View);

        expect(executeMock).toHaveBeenCalledWith(
          expect.stringContaining('sqlite_master'),
          ['v', 'view']
        );
      });

      it('should ignore all errors gracefully', async () => {
        const executeMock = vi.fn().mockRejectedValue(new Error('Error'));
        createSQLiteDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users', type: TableObjectType.Table });
      });

      it('should handle DDL query returning error field', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [{ sql: 'CREATE TABLE t' }], error: 'some error' })
          .mockResolvedValueOnce({ rows: [{ cnt: 0 }], error: 'some error' })
          .mockResolvedValueOnce({ rows: [{ page_count: 1 }], error: 'some error' })
          .mockResolvedValueOnce({ rows: [{ page_size: 4096 }], error: undefined });
        createSQLiteDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.ddl).toBeUndefined();
        expect(result.rowCount).toBeUndefined();
      });
    });

    // ─── ClickHouse ──────────────────────────────────────────────────────
    describe('ClickHouse', () => {
      const createClickHouseDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.ClickHouse,
          execute: executeMock,
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return ClickHouse table properties', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({
            rows: [{
              database: 'analytics',
              engine: 'MergeTree',
              partition_key: 'toYYYYMM(date)',
              sorting_key: 'id',
              primary_key: 'id',
              sampling_key: '',
              total_rows: 1000000,
              total_bytes: 52428800,
              metadata_modification_time: '2024-01-01 00:00:00',
              comment: 'Events table',
            }],
            error: undefined,
          })
          .mockResolvedValueOnce({
            rows: [{ statement: 'CREATE TABLE events ...' }],
            error: undefined,
          });
        createClickHouseDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'events', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 'events',
          database: 'analytics',
          engine: 'MergeTree',
          partitionKey: 'toYYYYMM(date)',
          sortingKey: 'id',
          primaryKey: 'id',
          totalRows: 1000000,
          ddl: 'CREATE TABLE events ...',
        });
      });

      it('should ignore errors gracefully', async () => {
        const executeMock = vi.fn().mockRejectedValue(new Error('Error'));
        createClickHouseDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'events', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'events', type: TableObjectType.Table });
      });

      it('should use Create Table key as fallback for DDL', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({
            rows: [{ 'Create Table': 'CREATE TABLE t ...' }],
            error: undefined,
          });
        createClickHouseDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 't', TableObjectType.Table) as Record<string, unknown>;

        expect(result.ddl).toBe('CREATE TABLE t ...');
      });

      it('should use first Object.values as DDL fallback', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({
            rows: [{ other_key: 'CREATE TABLE x ...' }],
            error: undefined,
          });
        createClickHouseDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'x', TableObjectType.Table) as Record<string, unknown>;

        expect(result.ddl).toBe('CREATE TABLE x ...');
      });
    });

    // ─── MongoDB ─────────────────────────────────────────────────────────
    describe('MongoDB', () => {
      it('should return MongoDB collection properties', async () => {
        const mockDb = {
          command: vi.fn().mockResolvedValue({
            count: 5000,
            storageSize: 1048576,
            avgObjSize: 256,
            nindexes: 3,
            totalIndexSize: 524288,
            capped: false,
          }),
          collection: vi.fn(),
        };
        const driver = {
          type: DatabaseType.MongoDB,
          getDb: vi.fn().mockReturnValue(mockDb),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(mockDb.command).toHaveBeenCalledWith({ collStats: 'users' });
        expect(result).toMatchObject({
          name: 'users',
          type: TableObjectType.Table,
          rowCount: 5000,
          nindexes: 3,
          capped: false,
        });
      });

      it('should fall back to countDocuments when collStats fails', async () => {
        const mockCollection = {
          countDocuments: vi.fn().mockResolvedValue(100),
        };
        const mockDb = {
          command: vi.fn().mockRejectedValue(new Error('not authorized')),
          collection: vi.fn().mockReturnValue(mockCollection),
        };
        const driver = {
          type: DatabaseType.MongoDB,
          getDb: vi.fn().mockReturnValue(mockDb),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.rowCount).toBe(100);
      });

      it('should handle both collStats and countDocuments failing', async () => {
        const mockCollection = {
          countDocuments: vi.fn().mockRejectedValue(new Error('Error')),
        };
        const mockDb = {
          command: vi.fn().mockRejectedValue(new Error('not authorized')),
          collection: vi.fn().mockReturnValue(mockCollection),
        };
        const driver = {
          type: DatabaseType.MongoDB,
          getDb: vi.fn().mockReturnValue(mockDb),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.rowCount).toBeUndefined();
      });

      it('should not call countDocuments when rowCount is already set', async () => {
        const mockCollection = {
          countDocuments: vi.fn(),
        };
        const mockDb = {
          command: vi.fn().mockResolvedValue({
            count: 500,
            storageSize: 0,
            avgObjSize: 0,
            nindexes: 1,
            totalIndexSize: 0,
            capped: false,
          }),
          collection: vi.fn().mockReturnValue(mockCollection),
        };
        const driver = {
          type: DatabaseType.MongoDB,
          getDb: vi.fn().mockReturnValue(mockDb),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);

        const handler = getHandler('schema:getTableProperties');
        await handler({}, 'conn-1', 'users', TableObjectType.Table);

        expect(mockCollection.countDocuments).not.toHaveBeenCalled();
      });
    });

    // ─── DuckDB ──────────────────────────────────────────────────────────
    describe('DuckDB', () => {
      const createDuckDBDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.DuckDB,
          execute: executeMock,
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return DuckDB table properties with DDL from duckdb_tables', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [{ sql: 'CREATE TABLE t (id INT)' }], error: undefined })
          .mockResolvedValueOnce({ rows: [{ cnt: 100 }], error: undefined });
        createDuckDBDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 't', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 't',
          type: TableObjectType.Table,
          ddl: 'CREATE TABLE t (id INT)',
          rowCount: 100,
        });
      });

      it('should fallback to duckdb_views for views when duckdb_tables returns no rows', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined }) // duckdb_tables empty
          .mockResolvedValueOnce({ rows: [{ sql: 'CREATE VIEW v AS SELECT 1' }], error: undefined }) // duckdb_views
          .mockResolvedValueOnce({ rows: [{ cnt: 1 }], error: undefined });
        createDuckDBDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'v', TableObjectType.View) as Record<string, unknown>;

        expect(result.ddl).toBe('CREATE VIEW v AS SELECT 1');
      });

      it('should not query duckdb_views for non-view types', async () => {
        const executeMock = vi.fn()
          .mockResolvedValueOnce({ rows: [], error: undefined })
          .mockResolvedValueOnce({ rows: [{ cnt: 0 }], error: undefined });
        createDuckDBDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 't', TableObjectType.Table) as Record<string, unknown>;

        expect(result.ddl).toBeUndefined();
        expect(executeMock).toHaveBeenCalledTimes(2);
      });

      it('should ignore all errors gracefully', async () => {
        const executeMock = vi.fn().mockRejectedValue(new Error('Error'));
        createDuckDBDriver(executeMock);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 't', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 't', type: TableObjectType.Table });
      });
    });

    // ─── SQL Server ──────────────────────────────────────────────────────
    describe('SQL Server', () => {
      const createSQLServerDriver = (executeMock: ReturnType<typeof vi.fn>) => {
        const driver = {
          type: DatabaseType.SQLServer,
          execute: executeMock,
          getCurrentSchema: vi.fn().mockReturnValue('dbo'),
          getViewDDL: vi.fn(),
          getTableDDL: vi.fn(),
        };
        vi.mocked(connectionManager.getConnection).mockReturnValue(driver as unknown as DatabaseDriver);
        return driver;
      };

      it('should return SQL Server table properties', async () => {
        const executeMock = vi.fn().mockResolvedValue({
          rows: [{
            table_name: 'users',
            schema_name: 'dbo',
            row_count: 200,
            total_size_mb: 1.5,
            data_size_mb: 1.0,
            unused_size_mb: 0.5,
            index_count: 3,
            column_count: 8,
            comment: 'Users table',
          }],
          error: undefined,
        });
        const driver = createSQLServerDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue('CREATE TABLE dbo.users ...');

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({
          name: 'users',
          type: TableObjectType.Table,
          schema: 'dbo',
          rowCount: 200,
          totalSize: '1.5 MB',
          tableSize: '1 MB',
          indexCount: 3,
          columnCount: 8,
          comment: 'Users table',
          ddl: 'CREATE TABLE dbo.users ...',
        });
      });

      it('should use provided schema instead of getCurrentSchema', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [], error: undefined });
        const driver = createSQLServerDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue(null);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table, 'custom') as Record<string, unknown>;

        expect(result.schema).toBe('custom');
        expect(driver.getCurrentSchema).not.toHaveBeenCalled();
      });

      it('should get view DDL for views', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [], error: undefined });
        const driver = createSQLServerDriver(executeMock);
        driver.getViewDDL = vi.fn().mockResolvedValue('CREATE VIEW v AS SELECT 1');

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'v', TableObjectType.View) as Record<string, unknown>;

        expect(driver.getViewDDL).toHaveBeenCalledWith('v');
        expect(result.ddl).toBe('CREATE VIEW v AS SELECT 1');
      });

      it('should ignore metadata and DDL errors gracefully', async () => {
        const executeMock = vi.fn().mockRejectedValue(new Error('Error'));
        const driver = createSQLServerDriver(executeMock);
        driver.getTableDDL = vi.fn().mockRejectedValue(new Error('DDL error'));

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result).toMatchObject({ name: 'users', type: TableObjectType.Table });
      });

      it('should default to getCurrentSchema when schema not provided', async () => {
        const executeMock = vi.fn().mockResolvedValue({ rows: [], error: undefined });
        const driver = createSQLServerDriver(executeMock);
        driver.getTableDDL = vi.fn().mockResolvedValue(null);

        const handler = getHandler('schema:getTableProperties');
        const result = await handler({}, 'conn-1', 'users', TableObjectType.Table) as Record<string, unknown>;

        expect(result.schema).toBe('dbo');
        expect(driver.getCurrentSchema).toHaveBeenCalled();
      });
    });
  });
});
