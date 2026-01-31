import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType, RoutineType } from '@main/types';
import type { ConnectionConfig } from '@main/types';

// --- Mock @clickhouse/client ---

const mockJson = vi.fn();
const mockQuery = vi.fn();
const mockCommand = vi.fn();
const mockClose = vi.fn();
const mockPing = vi.fn();

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    query: mockQuery,
    command: mockCommand,
    close: mockClose,
    ping: mockPing,
  })),
}));

import { ClickHouseDriver } from '@main/db/clickhouse';

describe('ClickHouseDriver', () => {
  let driver: ClickHouseDriver;
  const testConfig: ConnectionConfig = {
    id: 'test-ch',
    name: 'Test ClickHouse',
    type: DatabaseType.ClickHouse,
    host: 'localhost',
    port: 8123,
    database: 'test_db',
    username: 'default',
    password: 'secret',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new ClickHouseDriver();

    // Default mock: query returns a resultSet with empty json
    mockJson.mockResolvedValue([]);
    mockQuery.mockResolvedValue({ json: mockJson });
    mockCommand.mockResolvedValue(undefined);
    mockPing.mockResolvedValue({ success: true });
  });

  describe('type', () => {
    it('should have ClickHouse type', () => {
      expect(driver.type).toBe(DatabaseType.ClickHouse);
    });
  });

  describe('connect', () => {
    it('should connect successfully with http protocol', async () => {
      const { createClient } = await import('@clickhouse/client');

      await driver.connect(testConfig);

      expect(createClient).toHaveBeenCalledWith({
        url: 'http://localhost:8123',
        username: 'default',
        password: 'secret',
        database: 'test_db',
        request_timeout: 30000,
      });
      expect(driver.isConnected).toBe(true);
    });

    it('should use https when ssl is enabled', async () => {
      const { createClient } = await import('@clickhouse/client');
      const sslConfig: ConnectionConfig = {
        ...testConfig,
        ssl: true,
      };

      await driver.connect(sslConfig);

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://localhost:8123' })
      );
    });

    it('should use https when sslConfig.enabled is true and mode is not Disable', async () => {
      const { createClient } = await import('@clickhouse/client');
      const sslConfig: ConnectionConfig = {
        ...testConfig,
        sslConfig: { enabled: true, mode: 'require' as import('@main/types').SSLMode },
      };

      await driver.connect(sslConfig);

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://localhost:8123' })
      );
    });

    it('should use default values when config properties are missing', async () => {
      const { createClient } = await import('@clickhouse/client');
      const minimalConfig: ConnectionConfig = {
        id: 'minimal',
        name: 'Minimal',
        type: DatabaseType.ClickHouse,
        database: '',
      };

      await driver.connect(minimalConfig);

      expect(createClient).toHaveBeenCalledWith({
        url: 'http://localhost:8123',
        username: 'default',
        password: '',
        database: 'default',
        request_timeout: 30000,
      });
    });

    it('should test connection with SELECT 1 query', async () => {
      await driver.connect(testConfig);

      expect(mockQuery).toHaveBeenCalledWith({
        query: 'SELECT 1',
        format: 'JSONEachRow',
      });
    });

    it('should set isConnected to false and rethrow on failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(driver.connect(testConfig)).rejects.toThrow('Connection refused');
      expect(driver.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should close client and reset state', async () => {
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

  describe('ping', () => {
    it('should return true when ping succeeds', async () => {
      await driver.connect(testConfig);

      const result = await driver.ping();

      expect(result).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should return false when client is null', async () => {
      const result = await driver.ping();

      expect(result).toBe(false);
    });

    it('should return false when ping fails', async () => {
      await driver.connect(testConfig);
      mockPing.mockRejectedValueOnce(new Error('timeout'));

      const result = await driver.ping();

      expect(result).toBe(false);
    });

    it('should return false when ping returns success: false', async () => {
      await driver.connect(testConfig);
      mockPing.mockResolvedValueOnce({ success: false });

      const result = await driver.ping();

      expect(result).toBe(false);
    });
  });

  describe('cancelQuery', () => {
    it('should return false when no abort controller exists', async () => {
      const result = await driver.cancelQuery();

      expect(result).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute SELECT queries and return rows', async () => {
      await driver.connect(testConfig);

      const mockRows = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue(mockRows),
      });

      const result = await driver.execute('SELECT * FROM users');

      expect(result.rows).toEqual(mockRows);
      expect(result.rowCount).toBe(2);
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0].name).toBe('id');
      expect(result.columns[0].type).toBe('Number');
      expect(result.columns[1].name).toBe('name');
      expect(result.columns[1].type).toBe('String');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should detect SHOW queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ name: 'default' }]),
      });

      const result = await driver.execute('SHOW DATABASES');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        query: 'SHOW DATABASES',
        format: 'JSONEachRow',
      }));
      expect(result.rows).toHaveLength(1);
    });

    it('should detect DESCRIBE queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ name: 'id', type: 'UInt64' }]),
      });

      await driver.execute('DESCRIBE TABLE users');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        format: 'JSONEachRow',
      }));
    });

    it('should detect WITH queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ cnt: 5 }]),
      });

      await driver.execute('WITH cte AS (SELECT 1) SELECT * FROM cte');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        format: 'JSONEachRow',
      }));
    });

    it('should execute non-SELECT queries using command', async () => {
      await driver.connect(testConfig);

      const result = await driver.execute('INSERT INTO users VALUES (1, \'Alice\')');

      expect(mockCommand).toHaveBeenCalledWith(expect.objectContaining({
        query: 'INSERT INTO users VALUES (1, \'Alice\')',
      }));
      expect(result.affectedRows).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it('should return error in result when execution fails', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('Table does not exist'));

      const result = await driver.execute('SELECT * FROM nonexistent');

      expect(result.error).toBe('Table does not exist');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should infer column types from first row values', async () => {
      await driver.connect(testConfig);

      const mockRows = [
        { count: 42, active: true, name: 'test' },
      ];
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue(mockRows),
      });

      const result = await driver.execute('SELECT count, active, name FROM stats');

      expect(result.columns).toEqual([
        { name: 'count', type: 'Number', nullable: true },
        { name: 'active', type: 'Boolean', nullable: true },
        { name: 'name', type: 'String', nullable: true },
      ]);
    });

    it('should return empty columns when query returns no rows', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const result = await driver.execute('SELECT * FROM empty_table');

      expect(result.columns).toEqual([]);
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should throw when not connected', async () => {
      // driver.execute calls ensureConnected which throws
      await expect(async () => {
        await driver.execute('SELECT 1');
      }).rejects.toThrow('Not connected to database');
    });
  });

  describe('getDatabases', () => {
    it('should return list of databases', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'default' },
          { name: 'test_db' },
          { name: 'system' },
        ]),
      });

      const databases = await driver.getDatabases();

      expect(databases).toEqual([
        { name: 'default' },
        { name: 'test_db' },
        { name: 'system' },
      ]);
      expect(mockQuery).toHaveBeenCalledWith({
        query: 'SHOW DATABASES',
        format: 'JSONEachRow',
      });
    });
  });

  describe('getTables', () => {
    it('should return tables and views', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'users', engine: 'MergeTree', total_rows: '1000', total_bytes: '50000', comment: '' },
          { name: 'active_users', engine: 'View', total_rows: '0', total_bytes: '0', comment: 'Active users view' },
          { name: 'daily_stats', engine: 'MaterializedView', total_rows: '500', total_bytes: '25000', comment: '' },
        ]),
      });

      const tables = await driver.getTables('test_db');

      expect(tables).toHaveLength(3);
      expect(tables[0]).toEqual({
        name: 'users',
        type: TableObjectType.Table,
        rowCount: 1000,
        size: 50000,
        comment: undefined,
      });
      expect(tables[1]).toEqual({
        name: 'active_users',
        type: TableObjectType.View,
        rowCount: 0,
        size: 0,
        comment: 'Active users view',
      });
      expect(tables[2]).toEqual({
        name: 'daily_stats',
        type: TableObjectType.View,
        rowCount: 500,
        size: 25000,
        comment: undefined,
      });
    });
  });

  describe('getColumns', () => {
    it('should return column definitions', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'id', type: 'UInt64', default_kind: '', default_expression: '', comment: '', is_in_primary_key: 1, is_in_sorting_key: 1 },
          { name: 'name', type: 'Nullable(String)', default_kind: 'DEFAULT', default_expression: "'unknown'", comment: 'User name', is_in_primary_key: 0, is_in_sorting_key: 0 },
          { name: 'created_at', type: 'DateTime', default_kind: 'DEFAULT', default_expression: 'now()', comment: '', is_in_primary_key: 0, is_in_sorting_key: 0 },
        ]),
      });

      const columns = await driver.getColumns('users');

      expect(columns).toHaveLength(3);
      expect(columns[0]).toEqual({
        name: 'id',
        type: 'UInt64',
        nullable: false,
        defaultValue: null,
        primaryKey: true,
        autoIncrement: false,
        unique: false,
        comment: undefined,
      });
      expect(columns[1]).toEqual({
        name: 'name',
        type: 'Nullable(String)',
        nullable: true,
        defaultValue: "'unknown'",
        primaryKey: false,
        autoIncrement: false,
        unique: false,
        comment: 'User name',
      });
      expect(columns[2]).toEqual({
        name: 'created_at',
        type: 'DateTime',
        nullable: false,
        defaultValue: 'now()',
        primaryKey: false,
        autoIncrement: false,
        unique: false,
        comment: undefined,
      });
    });
  });

  describe('getIndexes', () => {
    it('should return primary key and sorting key indexes', async () => {
      await driver.connect(testConfig);

      // First query: system.tables for primary/sorting keys
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: 'id', sorting_key: 'id, created_at' },
        ]),
      });
      // Second query: data_skipping_indices
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'idx_name', expr: 'name', type: 'minmax' },
        ]),
      });

      const indexes = await driver.getIndexes('users');

      expect(indexes).toHaveLength(3);
      expect(indexes[0]).toEqual({
        name: 'PRIMARY',
        columns: ['id'],
        unique: true,
        primary: true,
        type: 'PRIMARY KEY',
      });
      expect(indexes[1]).toEqual({
        name: 'ORDER BY',
        columns: ['id', 'created_at'],
        unique: false,
        primary: false,
        type: 'SORTING KEY',
      });
      expect(indexes[2]).toEqual({
        name: 'idx_name',
        columns: ['name'],
        unique: false,
        primary: false,
        type: 'minmax',
      });
    });

    it('should not add sorting key when it matches primary key', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: 'id', sorting_key: 'id' },
        ]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const indexes = await driver.getIndexes('simple_table');

      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('PRIMARY');
    });

    it('should return empty array when no table info is found', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const indexes = await driver.getIndexes('nonexistent');

      expect(indexes).toEqual([]);
    });

    it('should return empty array on error', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('table not found'));

      const indexes = await driver.getIndexes('broken');

      expect(indexes).toEqual([]);
    });

    it('should handle data_skipping_indices query failure gracefully', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: 'id', sorting_key: 'id' },
        ]),
      });
      // data_skipping_indices query fails
      mockQuery.mockRejectedValueOnce(new Error('table not found'));

      const indexes = await driver.getIndexes('users');

      // Should still return the primary key index
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('PRIMARY');
    });
  });

  describe('getForeignKeys', () => {
    it('should return empty array (ClickHouse has no foreign keys)', async () => {
      await driver.connect(testConfig);

      const fks = await driver.getForeignKeys('users');

      expect(fks).toEqual([]);
    });
  });

  describe('getTableDDL', () => {
    it('should return the SHOW CREATE TABLE result', async () => {
      await driver.connect(testConfig);

      const expectedDDL = 'CREATE TABLE test_db.users (id UInt64, name String) ENGINE = MergeTree ORDER BY id';
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ statement: expectedDDL }]),
      });

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toBe(expectedDDL);
    });

    it('should return empty string when no result', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const ddl = await driver.getTableDDL('nonexistent');

      expect(ddl).toBe('');
    });
  });

  describe('getTableData', () => {
    it('should return table data with total count', async () => {
      await driver.connect(testConfig);

      // Count query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '100' }]),
      });
      // Columns query (getColumns)
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'id', type: 'UInt64', default_kind: '', default_expression: '', comment: '', is_in_primary_key: 1, is_in_sorting_key: 1 },
          { name: 'name', type: 'String', default_kind: '', default_expression: '', comment: '', is_in_primary_key: 0, is_in_sorting_key: 0 },
        ]),
      });
      // Data query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ]),
      });

      const result = await driver.getTableData('users', { limit: 50, offset: 0 });

      expect(result.totalCount).toBe(100);
      expect(result.rows).toHaveLength(2);
      expect(result.columns).toHaveLength(2);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should use default limit and offset', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '10' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const result = await driver.getTableData('users', {});

      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
    });
  });

  describe('getDataTypes', () => {
    it('should return ClickHouse data types', () => {
      const types = driver.getDataTypes();

      expect(types.length).toBeGreaterThan(0);
      expect(types).toContainEqual({ name: 'String', category: 'string' });
      expect(types).toContainEqual({ name: 'UInt64', category: 'numeric' });
      expect(types).toContainEqual({ name: 'DateTime', category: 'datetime' });
      expect(types).toContainEqual({ name: 'Bool', category: 'boolean' });
      expect(types).toContainEqual({ name: 'UUID', category: 'other' });
    });
  });

  describe('getPrimaryKeyColumns', () => {
    it('should return primary key columns', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: 'id, tenant_id' },
        ]),
      });

      const pkCols = await driver.getPrimaryKeyColumns('events');

      expect(pkCols).toEqual(['id', 'tenant_id']);
    });

    it('should return empty array when no primary key', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: '' },
        ]),
      });

      const pkCols = await driver.getPrimaryKeyColumns('log_table');

      expect(pkCols).toEqual([]);
    });

    it('should return empty array when table is not found', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const pkCols = await driver.getPrimaryKeyColumns('nonexistent');

      expect(pkCols).toEqual([]);
    });
  });

  describe('addColumn', () => {
    it('should add a column using ALTER TABLE', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'age',
          type: 'UInt8',
          nullable: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE');
      expect(result.sql).toContain('ADD COLUMN');
      expect(result.sql).toContain('`age` UInt8');
    });

    it('should wrap type in Nullable when nullable is true', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'email',
          type: 'String',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('Nullable(String)');
    });

    it('should include DEFAULT when defaultValue is set', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'status',
          type: 'String',
          nullable: false,
          defaultValue: 'active',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'active'");
    });

    it('should include COMMENT when comment is set', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'score',
          type: 'Float64',
          nullable: false,
          comment: 'User score',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("COMMENT 'User score'");
    });

    it('should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Column already exists'));

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'age',
          type: 'UInt8',
          nullable: false,
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Column already exists');
    });
  });

  describe('modifyColumn', () => {
    it('should rename and modify a column', async () => {
      await driver.connect(testConfig);

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'old_name',
        newDefinition: {
          name: 'new_name',
          type: 'String',
          nullable: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME COLUMN `old_name` TO `new_name`');
      expect(result.sql).toContain('MODIFY COLUMN');
      expect(mockCommand).toHaveBeenCalledTimes(2);
    });

    it('should only modify when name is unchanged', async () => {
      await driver.connect(testConfig);

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: {
          name: 'name',
          type: 'String',
          nullable: false,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('RENAME COLUMN');
      expect(result.sql).toContain('MODIFY COLUMN');
      expect(mockCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('dropColumn', () => {
    it('should drop a column', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'old_field',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP COLUMN `old_field`');
    });
  });

  describe('renameColumn', () => {
    it('should rename a column', async () => {
      await driver.connect(testConfig);

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'email_addr',
        newName: 'email',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME COLUMN `email_addr` TO `email`');
    });
  });

  describe('createIndex', () => {
    it('should create a data-skipping index', async () => {
      await driver.connect(testConfig);

      const result = await driver.createIndex({
        table: 'users',
        index: {
          name: 'idx_email',
          columns: ['email'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ADD INDEX `idx_email`');
      expect(result.sql).toContain('TYPE minmax');
      expect(result.sql).toContain('GRANULARITY 4');
    });

    it('should use specified index type', async () => {
      await driver.connect(testConfig);

      const result = await driver.createIndex({
        table: 'events',
        index: {
          name: 'idx_bloom',
          columns: ['event_type'],
          type: 'bloom_filter',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('TYPE bloom_filter');
    });
  });

  describe('dropIndex', () => {
    it('should drop an index', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'idx_email',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP INDEX `idx_email`');
    });
  });

  describe('addForeignKey', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(testConfig);

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'fk_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support foreign keys');
    });
  });

  describe('dropForeignKey', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropForeignKey({
        table: 'orders',
        constraintName: 'fk_user',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support foreign keys');
    });
  });

  describe('createTable', () => {
    it('should create a table with MergeTree engine', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'events',
          columns: [
            { name: 'id', type: 'UInt64', nullable: false, primaryKey: true },
            { name: 'event_type', type: 'String', nullable: false },
            { name: 'payload', type: 'String', nullable: true },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE `test_db`.`events`');
      expect(result.sql).toContain('ENGINE = MergeTree()');
      expect(result.sql).toContain('ORDER BY (`id`)');
      expect(result.sql).toContain('PRIMARY KEY (`id`)');
    });

    it('should use tuple() for ORDER BY when no primary key', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'logs',
          columns: [
            { name: 'message', type: 'String', nullable: false },
            { name: 'level', type: 'String', nullable: false },
          ],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ORDER BY tuple()');
    });

    it('should use composite primary key from table definition', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'metrics',
          columns: [
            { name: 'timestamp', type: 'DateTime', nullable: false },
            { name: 'metric_name', type: 'String', nullable: false },
            { name: 'value', type: 'Float64', nullable: false },
          ],
          primaryKey: ['timestamp', 'metric_name'],
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ORDER BY (`timestamp`, `metric_name`)');
      expect(result.sql).toContain('PRIMARY KEY (`timestamp`, `metric_name`)');
    });

    it('should include table comment when provided', async () => {
      await driver.connect(testConfig);

      const result = await driver.createTable({
        table: {
          name: 'audit',
          columns: [
            { name: 'id', type: 'UInt64', nullable: false, primaryKey: true },
          ],
          comment: 'Audit log table',
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("COMMENT 'Audit log table'");
    });

    it('should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Table already exists'));

      const result = await driver.createTable({
        table: {
          name: 'users',
          columns: [
            { name: 'id', type: 'UInt64', nullable: false, primaryKey: true },
          ],
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Table already exists');
    });
  });

  describe('dropTable', () => {
    it('should drop a table', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropTable({ table: 'old_table' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE `test_db`.`old_table`');
    });
  });

  describe('renameTable', () => {
    it('should rename a table', async () => {
      await driver.connect(testConfig);

      const result = await driver.renameTable({
        oldName: 'users',
        newName: 'accounts',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME TABLE `test_db`.`users` TO `test_db`.`accounts`');
    });
  });

  describe('insertRow', () => {
    it('should insert a row', async () => {
      await driver.connect(testConfig);

      const result = await driver.insertRow({
        table: 'users',
        values: { id: 1, name: 'Alice', email: 'alice@test.com' },
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('INSERT INTO `test_db`.`users`');
      expect(result.sql).toContain('`id`, `name`, `email`');
    });

    it('should handle null values in insert', async () => {
      await driver.connect(testConfig);

      const result = await driver.insertRow({
        table: 'users',
        values: { id: 1, name: null },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NULL');
    });

    it('should escape string values', async () => {
      await driver.connect(testConfig);

      const result = await driver.insertRow({
        table: 'users',
        values: { name: "O'Brien" },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("O\\'Brien");
    });
  });

  describe('deleteRow', () => {
    it('should delete a row using ALTER TABLE DELETE', async () => {
      await driver.connect(testConfig);

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 42 },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE `test_db`.`users` DELETE WHERE');
      expect(result.sql).toContain('`id` = 42');
    });

    it('should handle string primary key values', async () => {
      await driver.connect(testConfig);

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { email: 'alice@test.com' },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("`email` = 'alice@test.com'");
    });

    it('should handle null primary key values', async () => {
      await driver.connect(testConfig);

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { deleted_at: null },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('`deleted_at` IS NULL');
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
      expect(result.sql).toContain('CREATE VIEW `test_db`.`active_users`');
    });

    it('should create or replace a view when replaceIfExists is true', async () => {
      await driver.connect(testConfig);

      const result = await driver.createView({
        view: {
          name: 'active_users',
          selectStatement: 'SELECT * FROM users WHERE active = 1',
          replaceIfExists: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE OR REPLACE VIEW');
    });
  });

  describe('dropView', () => {
    it('should drop a view with IF EXISTS', async () => {
      await driver.connect(testConfig);

      const result = await driver.dropView({ viewName: 'active_users' });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP VIEW IF EXISTS `test_db`.`active_users`');
    });
  });

  describe('renameView', () => {
    it('should rename a view using RENAME TABLE', async () => {
      await driver.connect(testConfig);

      const result = await driver.renameView({
        oldName: 'old_view',
        newName: 'new_view',
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME TABLE `test_db`.`old_view` TO `test_db`.`new_view`');
    });
  });

  describe('getViewDDL', () => {
    it('should return the view DDL', async () => {
      await driver.connect(testConfig);

      const expectedDDL = 'CREATE VIEW test_db.active_users AS SELECT * FROM users WHERE active = 1';
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ statement: expectedDDL }]),
      });

      const ddl = await driver.getViewDDL('active_users');

      expect(ddl).toBe(expectedDDL);
    });

    it('should return empty string when view not found', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const ddl = await driver.getViewDDL('nonexistent');

      expect(ddl).toBe('');
    });
  });

  describe('getRoutines', () => {
    it('should return user-defined functions', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'my_func', create_query: 'CREATE FUNCTION my_func AS (x) -> x * 2' },
        ]),
      });

      const routines = await driver.getRoutines();

      expect(routines).toHaveLength(1);
      expect(routines[0]).toEqual({
        name: 'my_func',
        type: RoutineType.Function,
        definition: 'CREATE FUNCTION my_func AS (x) -> x * 2',
      });
    });

    it('should return empty array when query fails', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const routines = await driver.getRoutines();

      expect(routines).toEqual([]);
    });
  });

  describe('getRoutineDefinition', () => {
    it('should return the function definition', async () => {
      await driver.connect(testConfig);

      const expectedDef = 'CREATE FUNCTION my_func AS (x) -> x * 2';
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ create_query: expectedDef }]),
      });

      const def = await driver.getRoutineDefinition('my_func', RoutineType.Function);

      expect(def).toBe(expectedDef);
    });

    it('should return not found message when function does not exist', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const def = await driver.getRoutineDefinition('nonexistent', RoutineType.Function);

      expect(def).toBe("-- Function 'nonexistent' not found");
    });

    it('should return error message on failure', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const def = await driver.getRoutineDefinition('my_func', RoutineType.Function);

      expect(def).toContain('Error getting function definition');
      expect(def).toContain('access denied');
    });
  });

  describe('getUsers', () => {
    it('should return users from system.users', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'default' },
          { name: 'admin' },
        ]),
      });

      const users = await driver.getUsers();

      expect(users).toEqual([
        { name: 'default', login: true },
        { name: 'admin', login: true },
      ]);
    });

    it('should fallback to currentUser() when system.users is not accessible', async () => {
      await driver.connect(testConfig);

      // First query fails
      mockQuery.mockRejectedValueOnce(new Error('access denied'));
      // Fallback query succeeds
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ user: 'default' }]),
      });

      const users = await driver.getUsers();

      expect(users).toEqual([{ name: 'default', login: true }]);
    });

    it('should return empty array when both queries fail', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('access denied'));
      mockQuery.mockRejectedValueOnce(new Error('also denied'));

      const users = await driver.getUsers();

      expect(users).toEqual([]);
    });
  });

  describe('getUserPrivileges', () => {
    it('should return user privileges', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { 'GRANTS FOR default': 'GRANT ALL ON *.*' },
        ]),
      });

      const privileges = await driver.getUserPrivileges('default');

      expect(privileges).toHaveLength(1);
      expect(privileges[0].privilege).toBe('GRANT ALL ON *.*');
      expect(privileges[0].grantee).toBe('default');
    });

    it('should return empty array when query fails', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const privileges = await driver.getUserPrivileges('unknown');

      expect(privileges).toEqual([]);
    });
  });

  describe('getTriggers', () => {
    it('should return empty array (ClickHouse has no triggers)', async () => {
      const triggers = await driver.getTriggers();

      expect(triggers).toEqual([]);
    });
  });

  describe('getTriggerDefinition', () => {
    it('should return a not supported message', async () => {
      const def = await driver.getTriggerDefinition('trg_test');

      expect(def).toBe('-- ClickHouse does not support triggers');
    });
  });

  describe('createTrigger', () => {
    it('should return error (not supported)', async () => {
      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_test',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'SELECT 1',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support triggers');
    });
  });

  describe('dropTrigger', () => {
    it('should return error (not supported)', async () => {
      const result = await driver.dropTrigger({ triggerName: 'trg_test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support triggers');
    });
  });

  describe('testConnection', () => {
    it('should return success with version and server info', async () => {
      await driver.connect(testConfig);

      // Reset for the testConnection call which creates a new driver connection
      const freshDriver = new ClickHouseDriver();

      // connect query (SELECT 1)
      mockQuery.mockResolvedValueOnce({ json: vi.fn().mockResolvedValue([]) });
      // version query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ version: '23.8.1.1' }]),
      });
      // timezone query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ tz: 'UTC' }]),
      });
      // uptime query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ uptime: 86400 }]),
      });
      // db count query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ cnt: 5 }]),
      });

      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.serverVersion).toBe('23.8.1.1');
    });

    it('should return failure when connection fails', async () => {
      const freshDriver = new ClickHouseDriver();
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should handle non-Error objects in testConnection catch', async () => {
      const freshDriver = new ClickHouseDriver();
      mockQuery.mockRejectedValueOnce('string error');

      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should return Unknown version when version query returns no rows', async () => {
      const freshDriver = new ClickHouseDriver();

      // connect query (SELECT 1)
      mockQuery.mockResolvedValueOnce({ json: vi.fn().mockResolvedValue([]) });
      // version query returns empty
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      // timezone query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ tz: 'UTC' }]),
      });
      // uptime query - undefined uptime
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{}]),
      });
      // db count query - undefined cnt
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{}]),
      });

      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('Unknown');
    });

    it('should handle server info queries failing gracefully', async () => {
      const freshDriver = new ClickHouseDriver();

      // connect query (SELECT 1)
      mockQuery.mockResolvedValueOnce({ json: vi.fn().mockResolvedValue([]) });
      // version query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ version: '23.8.1.1' }]),
      });
      // timezone query fails
      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const result = await freshDriver.testConnection(testConfig);

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('23.8.1.1');
    });
  });

  describe('connect - SSL variants', () => {
    it('should use http when sslConfig.enabled is true but mode is Disable', async () => {
      const { createClient } = await import('@clickhouse/client');
      const config: ConnectionConfig = {
        ...testConfig,
        sslConfig: { enabled: true, mode: 'disable' as import('@main/types').SSLMode },
      };

      await driver.connect(config);

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:8123' })
      );
    });

    it('should use http when sslConfig.enabled is false', async () => {
      const { createClient } = await import('@clickhouse/client');
      const config: ConnectionConfig = {
        ...testConfig,
        ssl: false,
        sslConfig: { enabled: false },
      };

      await driver.connect(config);

      expect(createClient).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost:8123' })
      );
    });
  });

  describe('getTableData - filters and sorting', () => {
    it('should build WHERE clause with IS NULL filter', async () => {
      await driver.connect(testConfig);

      // Count query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '5' }]),
      });
      // Columns query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { name: 'id', type: 'UInt64', default_kind: '', default_expression: '', comment: '', is_in_primary_key: 1, is_in_sorting_key: 1 },
        ]),
      });
      // Data query
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NULL', value: '' }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('`email` IS NULL'),
        })
      );
    });

    it('should build WHERE clause with IS NOT NULL filter', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '5' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NOT NULL', value: '' }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('`email` IS NOT NULL'),
        })
      );
    });

    it('should build WHERE clause with IN filter', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '5' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('IN'),
        })
      );
    });

    it('should build WHERE clause with NOT IN filter', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '2' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'id', operator: 'NOT IN', value: [1, 2, 3] }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('NOT IN'),
        })
      );
    });

    it('should build WHERE clause with LIKE filter', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '3' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'LIKE', value: 'test' }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('LIKE'),
        })
      );
    });

    it('should build WHERE clause with NOT LIKE filter', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '3' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: 'admin' }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('NOT LIKE'),
        })
      );
    });

    it('should build WHERE clause with default operator (e.g., =) and string value', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '1' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: '=', value: 'Alice' }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining("= 'Alice'"),
        })
      );
    });

    it('should build WHERE clause with default operator and numeric value', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '1' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        filters: [{ column: 'id', operator: '>', value: 10 }],
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('> 10'),
        })
      );
    });

    it('should build ORDER BY clause with sorting', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '10' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        orderBy: 'name',
        orderDirection: 'DESC',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('ORDER BY `name` DESC'),
        })
      );
    });

    it('should default orderDirection to ASC when not specified', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ count: '10' }]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      await driver.getTableData('users', {
        orderBy: 'id',
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining('ORDER BY `id` ASC'),
        })
      );
    });
  });

  describe('execute - additional edge cases', () => {
    it('should detect DESC queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ name: 'id', type: 'UInt64' }]),
      });

      await driver.execute('DESC users');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        format: 'JSONEachRow',
      }));
    });

    it('should detect EXPLAIN queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ explain: 'ReadFromStorage' }]),
      });

      await driver.execute('EXPLAIN SELECT * FROM users');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        format: 'JSONEachRow',
      }));
    });

    it('should detect EXISTS queries as SELECT', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{ result: 1 }]),
      });

      await driver.execute('EXISTS TABLE users');

      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        format: 'JSONEachRow',
      }));
    });

    it('should handle non-Error objects in execute catch', async () => {
      await driver.connect(testConfig);

      mockQuery.mockRejectedValueOnce('plain string error');

      const result = await driver.execute('SELECT 1');

      expect(result.error).toBe('plain string error');
    });

    it('should handle non-SELECT command failure', async () => {
      await driver.connect(testConfig);

      mockCommand.mockRejectedValueOnce(new Error('Syntax error'));

      const result = await driver.execute('DROP TABLE nonexistent');

      expect(result.error).toBe('Syntax error');
    });
  });

  describe('schema operation error paths', () => {
    it('dropColumn should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Cannot drop column'));

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'id',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot drop column');
    });

    it('renameColumn should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Column not found'));

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'nonexistent',
        newName: 'new_col',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Column not found');
    });

    it('createIndex should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Index already exists'));

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_dup', columns: ['name'] },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Index already exists');
    });

    it('dropIndex should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Index not found'));

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'nonexistent_idx',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Index not found');
    });

    it('dropTable should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Table not found'));

      const result = await driver.dropTable({ table: 'nonexistent' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Table not found');
    });

    it('renameTable should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await driver.renameTable({
        oldName: 'users',
        newName: 'accounts',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('insertRow should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Type mismatch'));

      const result = await driver.insertRow({
        table: 'users',
        values: { id: 'not_a_number' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Type mismatch');
    });

    it('deleteRow should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('DELETE failed'));

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DELETE failed');
    });

    it('createView should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('View creation failed'));

      const result = await driver.createView({
        view: { name: 'bad_view', selectStatement: 'SELECT * FROM nonexistent' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('View creation failed');
    });

    it('dropView should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await driver.dropView({ viewName: 'restricted_view' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });

    it('renameView should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Rename failed'));

      const result = await driver.renameView({
        oldName: 'old_view',
        newName: 'new_view',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rename failed');
    });

    it('modifyColumn should return error when command fails', async () => {
      await driver.connect(testConfig);
      mockCommand.mockRejectedValueOnce(new Error('Cannot modify'));

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'UInt64', nullable: false },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot modify');
    });
  });

  describe('buildColumnDefinition edge cases', () => {
    it('should handle column with length', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'code',
          type: 'FixedString',
          nullable: false,
          length: 16,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('FixedString(16)');
    });

    it('should handle column with precision and scale', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'amount',
          type: 'Decimal',
          nullable: false,
          precision: 10,
          scale: 2,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('Decimal(10, 2)');
    });

    it('should handle column with precision only', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'big_num',
          type: 'Decimal32',
          nullable: false,
          precision: 9,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('Decimal32(9)');
    });

    it('should handle column with numeric default value', async () => {
      await driver.connect(testConfig);

      const result = await driver.addColumn({
        table: 'users',
        column: {
          name: 'count',
          type: 'UInt32',
          nullable: false,
          defaultValue: 0,
        },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('DEFAULT 0');
    });
  });

  describe('deleteRow - undefined primary key value', () => {
    it('should handle undefined primary key values', async () => {
      await driver.connect(testConfig);

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { deleted_at: undefined },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('`deleted_at` IS NULL');
    });
  });

  describe('insertRow - undefined values', () => {
    it('should handle undefined values in insert', async () => {
      await driver.connect(testConfig);

      const result = await driver.insertRow({
        table: 'users',
        values: { id: 1, name: undefined },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('NULL');
    });
  });

  describe('getPartitions', () => {
    it('should return partition information', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          {
            partition: '202301',
            name: '202301_1_1_0',
            rows: '1000',
            bytes_on_disk: '5000',
            data_compressed_bytes: '3000',
            data_uncompressed_bytes: '10000',
            engine: 'MergeTree',
          },
        ]),
      });

      const partitions = await driver.getPartitions('events');

      expect(partitions).toHaveLength(1);
      expect(partitions[0]).toEqual({
        partition: '202301',
        name: '202301_1_1_0',
        rows: 1000,
        bytesOnDisk: 5000,
        dataCompressedBytes: 3000,
        dataUncompressedBytes: 10000,
        engine: 'MergeTree',
      });
    });
  });

  describe('getEngineInfo', () => {
    it('should return engine information', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          {
            engine: 'MergeTree',
            engine_full: 'MergeTree ORDER BY id',
            partition_key: '',
            sorting_key: 'id',
            primary_key: 'id',
            sampling_key: '',
          },
        ]),
      });

      const info = await driver.getEngineInfo('users');

      expect(info).toEqual({
        engine: 'MergeTree',
        engineFull: 'MergeTree ORDER BY id',
        partitionKey: '',
        sortingKey: 'id',
        primaryKey: 'id',
        samplingKey: '',
      });
    });

    it('should return null when table not found', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const info = await driver.getEngineInfo('nonexistent');

      expect(info).toBeNull();
    });
  });

  describe('cancelQuery - abort controller', () => {
    it('should abort an in-flight query', async () => {
      await driver.connect(testConfig);

      // Start a long-running query that we'll cancel
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

      // Set up a delayed query so we can cancel it
      mockQuery.mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => resolve({ json: vi.fn().mockResolvedValue([]) }), 1000);
      }));

      // Start execute (don't await it)
      const queryPromise = driver.execute('SELECT sleep(10)');

      // Wait a tick so the controller is set
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cancelResult = await driver.cancelQuery();

      expect(cancelResult).toBe(true);
      expect(abortSpy).toHaveBeenCalled();

      abortSpy.mockRestore();
      await queryPromise; // clean up
    });
  });

  describe('getUsers - fallback with empty user', () => {
    it('should handle fallback when currentUser returns empty user', async () => {
      await driver.connect(testConfig);

      // First query fails
      mockQuery.mockRejectedValueOnce(new Error('access denied'));
      // Fallback returns empty rows
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{}]),
      });

      const users = await driver.getUsers();

      expect(users).toEqual([{ name: 'default', login: true }]);
    });
  });

  describe('getUserPrivileges - empty grant value', () => {
    it('should handle empty grant object values', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([{}]),
      });

      const privileges = await driver.getUserPrivileges('default');

      expect(privileges).toHaveLength(1);
      expect(privileges[0].privilege).toBe('');
    });
  });

  describe('getIndexes - no primary key', () => {
    it('should handle table with no primary key but has sorting key', async () => {
      await driver.connect(testConfig);

      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([
          { primary_key: '', sorting_key: 'timestamp' },
        ]),
      });
      mockQuery.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue([]),
      });

      const indexes = await driver.getIndexes('logs');

      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('ORDER BY');
      expect(indexes[0].type).toBe('SORTING KEY');
    });
  });
});
