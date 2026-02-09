import { describe, it, expect, vi, beforeEach } from 'vitest';
import knexLib from 'knex';
import { BaseDriver, type TestConnectionResult, type DatabaseDriver } from '@main/db/base';
import {
  DatabaseType,
  RoutineType,
  type ConnectionConfig,
  type QueryResult,
  type Database as DatabaseInfo,
  type Table,
  type Column,
  type Index,
  type ForeignKey,
  type DataOptions,
  type DataResult,
  type Routine,
  type DatabaseUser,
  type Trigger
} from '@main/types';
import type {
  AddColumnRequest,
  ModifyColumnRequest,
  DropColumnRequest,
  RenameColumnRequest,
  CreateIndexRequest,
  DropIndexRequest,
  AddForeignKeyRequest,
  DropForeignKeyRequest,
  CreateTableRequest,
  DropTableRequest,
  RenameTableRequest,
  InsertRowRequest,
  DeleteRowRequest,
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest,
  SchemaOperationResult,
  DataTypeInfo,
  CreateTriggerRequest,
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '@main/types/schema-operations';

const testKnex = knexLib({ client: 'better-sqlite3', useNullAsDefault: true });

// Concrete implementation of BaseDriver for testing purposes
class TestDriver extends BaseDriver {
  readonly type = DatabaseType.SQLite;
  protected override knex = testKnex;

  connectCalled = false;
  disconnectCalled = false;

  async connect(config: ConnectionConfig): Promise<void> {
    this.config = config;
    this._isConnected = true;
    this.connectCalled = true;
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.config = null;
    this.disconnectCalled = true;
  }

  async execute(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    return { columns: [], rows: [], rowCount: 0, executionTime: 0 };
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    return [];
  }

  async getTables(_database: string, _schema?: string): Promise<Table[]> {
    return [];
  }

  async getColumns(_table: string): Promise<Column[]> {
    return [];
  }

  async getIndexes(_table: string): Promise<Index[]> {
    return [];
  }

  async getForeignKeys(_table: string): Promise<ForeignKey[]> {
    return [];
  }

  async getTableDDL(_table: string): Promise<string> {
    return '';
  }

  async getTableData(_table: string, _options: DataOptions): Promise<DataResult> {
    return { columns: [], rows: [], totalCount: 0, offset: 0, limit: 0 };
  }

  async addColumn(_request: AddColumnRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async modifyColumn(_request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropColumn(_request: DropColumnRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async renameColumn(_request: RenameColumnRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async createIndex(_request: CreateIndexRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropIndex(_request: DropIndexRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async addForeignKey(_request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropForeignKey(_request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async createTable(_request: CreateTableRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropTable(_request: DropTableRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async renameTable(_request: RenameTableRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async insertRow(_request: InsertRowRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async deleteRow(_request: DeleteRowRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async createView(_request: CreateViewRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropView(_request: DropViewRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async renameView(_request: RenameViewRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async getViewDDL(_viewName: string): Promise<string> {
    return '';
  }

  getDataTypes(): DataTypeInfo[] {
    return [];
  }

  async getPrimaryKeyColumns(_table: string): Promise<string[]> {
    return [];
  }

  async getRoutines(_type?: RoutineType): Promise<Routine[]> {
    return [];
  }

  async getRoutineDefinition(_name: string, _type: RoutineType): Promise<string> {
    return '';
  }

  async getUsers(): Promise<DatabaseUser[]> {
    return [];
  }

  async createUser(_request: CreateUserRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropUser(_request: DropUserRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async getTriggers(_table?: string): Promise<Trigger[]> {
    return [];
  }

  async getTriggerDefinition(_name: string, _table?: string): Promise<string> {
    return '';
  }

  async createTrigger(_request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  async dropTrigger(_request: DropTriggerRequest): Promise<SchemaOperationResult> {
    return { success: true };
  }

  // Expose protected methods for testing
  public callEnsureConnected(): void {
    this.ensureConnected();
  }

  public callApplyFilters(table: string, options: DataOptions): { sql: string; bindings: unknown[] } {
    const builder = this.knex!(table).select('*');
    const result = this.applyFilters(builder, options);
    return this.compileQuery(result);
  }

  public callApplyFiltersWhereOnly(table: string, options: DataOptions): { sql: string; bindings: unknown[] } {
    const builder = this.knex!(table).count('* as count');
    const result = this.applyFilters(builder, options, true);
    return this.compileQuery(result);
  }

  public callBuildInsertSQL(table: string, values: Record<string, unknown>): { sql: string; bindings: unknown[] } {
    return this.buildInsertSQL(table, values);
  }

  public callBuildDeleteSQL(table: string, where: Record<string, unknown>): { sql: string; bindings: unknown[] } {
    return this.buildDeleteSQL(table, where);
  }

  public callFormatError(error: unknown): string {
    return this.formatError(error);
  }

  public callBuildTableDataQueries(table: string, options: DataOptions, schema?: string) {
    return this.buildTableDataQueries(table, options, schema);
  }

  public callMapColumnsToInfo(columns: Column[]) {
    return this.mapColumnsToInfo(columns);
  }
}

describe('BaseDriver', () => {
  let driver: TestDriver;

  beforeEach(() => {
    driver = new TestDriver();
  });

  describe('isConnected property', () => {
    it('should return false initially', () => {
      expect(driver.isConnected).toBe(false);
    });

    it('should return true after connect', async () => {
      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      await driver.connect(config);

      expect(driver.isConnected).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      await driver.connect(config);
      await driver.disconnect();

      expect(driver.isConnected).toBe(false);
    });
  });

  describe('ping', () => {
    it('should return false by default', async () => {
      const result = await driver.ping();

      expect(result).toBe(false);
    });
  });

  describe('cancelQuery', () => {
    it('should return false by default', async () => {
      const result = await driver.cancelQuery();

      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return success when connect and disconnect succeed', async () => {
      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      const result = await driver.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(driver.disconnectCalled).toBe(true);
    });

    it('should return failure when connect throws', async () => {
      const failDriver = new TestDriver();
      failDriver.connect = async () => {
        throw new Error('Connection refused');
      };

      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      const result = await failDriver.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should return failure with string error when non-Error is thrown', async () => {
      const failDriver = new TestDriver();
      failDriver.connect = async () => {
        throw 'some string error';
      };

      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      const result = await failDriver.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('some string error');
    });

    it('should still attempt disconnect even on connect failure', async () => {
      let disconnectCalled = false;
      const failDriver = new TestDriver();
      failDriver.connect = async () => {
        throw new Error('Connection refused');
      };
      const originalDisconnect = failDriver.disconnect.bind(failDriver);
      failDriver.disconnect = async () => {
        disconnectCalled = true;
        await originalDisconnect();
      };

      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      await failDriver.testConnection(config);

      expect(disconnectCalled).toBe(true);
    });

    it('should handle disconnect failure during error cleanup gracefully', async () => {
      const failDriver = new TestDriver();
      failDriver.connect = async () => {
        throw new Error('Connection refused');
      };
      failDriver.disconnect = async () => {
        throw new Error('Disconnect also failed');
      };

      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      const result = await failDriver.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('ensureConnected', () => {
    it('should throw when not connected', () => {
      expect(() => driver.callEnsureConnected()).toThrow('Not connected to database');
    });

    it('should not throw when connected', async () => {
      const config: ConnectionConfig = {
        id: 'test-1',
        name: 'Test Connection',
        type: DatabaseType.SQLite,
        database: ':memory:',
      };

      await driver.connect(config);

      expect(() => driver.callEnsureConnected()).not.toThrow();
    });
  });

  describe('applyFilters', () => {
    it('should generate SELECT without WHERE when no filters', () => {
      const { sql, bindings } = driver.callApplyFilters('users', {});

      expect(sql).toBe('select * from `users`');
      expect(bindings).toEqual([]);
    });

    it('should generate SELECT without WHERE when filters array is empty', () => {
      const { sql, bindings } = driver.callApplyFilters('users', { filters: [] });

      expect(sql).toBe('select * from `users`');
      expect(bindings).toEqual([]);
    });

    it('should handle IS NULL operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NULL', value: null }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` is null');
      expect(bindings).toEqual([]);
    });

    it('should handle IS NOT NULL operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NOT NULL', value: null }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` is not null');
      expect(bindings).toEqual([]);
    });

    it('should handle IN operator with array value', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `status` in (?, ?)');
      expect(bindings).toEqual(['active', 'pending']);
    });

    it('should handle NOT IN operator with array value', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'NOT IN', value: [1, 2, 3] }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `status` not in (?, ?, ?)');
      expect(bindings).toEqual([1, 2, 3]);
    });

    it('should skip IN operator when value is not an array', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'IN', value: 'active' }],
      };

      const { sql } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users`');
    });

    it('should handle LIKE operator passing value as-is', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'LIKE', value: '%test%' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` like ?');
      expect(bindings).toEqual(['%test%']);
    });

    it('should handle Not contains operator with wildcard wrapping', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Not contains', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` not like ?');
      expect(bindings).toEqual(['%test%']);
    });

    it('should handle = operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'id', operator: '=', value: 42 }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `id` = ?');
      expect(bindings).toEqual([42]);
    });

    it('should handle <> operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: '<>', value: 'deleted' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `status` <> ?');
      expect(bindings).toEqual(['deleted']);
    });

    it('should handle comparison operators', () => {
      const ops = ['>', '<', '>=', '<='] as const;
      for (const op of ops) {
        const { sql, bindings } = driver.callApplyFilters('users', {
          filters: [{ column: 'age', operator: op, value: 18 }],
        });
        expect(sql).toBe(`select * from \`users\` where \`age\` ${op} ?`);
        expect(bindings).toEqual([18]);
      }
    });

    it('should combine multiple filters with AND', () => {
      const options: DataOptions = {
        filters: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'age', operator: '>', value: 18 },
        ],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `status` = ? and `age` > ?');
      expect(bindings).toEqual(['active', 18]);
    });

    it('should handle BETWEEN operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'age', operator: 'BETWEEN', value: [18, 65] }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `age` between ? and ?');
      expect(bindings).toEqual([18, 65]);
    });

    it('should handle NOT BETWEEN operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'age', operator: 'NOT BETWEEN', value: [0, 17] }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `age` not between ? and ?');
      expect(bindings).toEqual([0, 17]);
    });

    it('should handle Contains operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Contains', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` like ?');
      expect(bindings).toEqual(['%test%']);
    });

    it('should handle Has prefix operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Has prefix', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` like ?');
      expect(bindings).toEqual(['test%']);
    });

    it('should handle Has suffix operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Has suffix', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where `name` like ?');
      expect(bindings).toEqual(['%test']);
    });

    it('should handle ILIKE with LOWER() fallback', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'ILIKE', value: '%test%' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where LOWER(`name`) LIKE LOWER(?)');
      expect(bindings).toEqual(['%test%']);
    });

    it('should handle Contains - Case insensitive with LOWER() fallback', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Contains - Case insensitive', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where LOWER(`name`) LIKE LOWER(?)');
      expect(bindings).toEqual(['%test%']);
    });

    it('should handle Not contains - Case insensitive with LOWER() fallback', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'Not contains - Case insensitive', value: 'test' }],
      };

      const { sql, bindings } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` where LOWER(`name`) NOT LIKE LOWER(?)');
      expect(bindings).toEqual(['%test%']);
    });
  });

  describe('applyFilters - ordering and pagination', () => {
    it('should add ORDER BY when orderBy is specified', () => {
      const options: DataOptions = { orderBy: 'name' };

      const { sql } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` order by `name` asc');
    });

    it('should add ORDER BY DESC when specified', () => {
      const options: DataOptions = { orderBy: 'created_at', orderDirection: 'DESC' as DataOptions['orderDirection'] };

      const { sql } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` order by `created_at` desc');
    });

    it('should add LIMIT when specified', () => {
      const options: DataOptions = { limit: 50 };

      const { sql } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` limit ?');
    });

    it('should add OFFSET when specified', () => {
      const options: DataOptions = { offset: 100 };

      const { sql } = driver.callApplyFilters('users', options);

      // Knex adds LIMIT when OFFSET is used (required by most SQL dialects)
      expect(sql).toContain('offset ?');
    });

    it('should add LIMIT and OFFSET together', () => {
      const options: DataOptions = { limit: 25, offset: 50 };

      const { sql } = driver.callApplyFilters('users', options);

      expect(sql).toBe('select * from `users` limit ? offset ?');
    });

    it('should not add ORDER BY/LIMIT/OFFSET when whereOnly is true', () => {
      const options: DataOptions = {
        filters: [{ column: 'id', operator: '=', value: 1 }],
        orderBy: 'name',
        limit: 50,
        offset: 10,
      };

      const { sql } = driver.callApplyFiltersWhereOnly('users', options);

      expect(sql).toBe('select count(*) as `count` from `users` where `id` = ?');
    });
  });

  describe('buildInsertSQL', () => {
    it('should build INSERT statement', () => {
      const { sql, bindings } = driver.callBuildInsertSQL('users', { name: 'Alice', age: 30 });

      expect(sql).toBe('insert into `users` (`age`, `name`) values (?, ?)');
      expect(bindings).toEqual([30, 'Alice']);
    });
  });

  describe('buildDeleteSQL', () => {
    it('should build DELETE statement', () => {
      const { sql, bindings } = driver.callBuildDeleteSQL('users', { id: 1 });

      expect(sql).toBe('delete from `users` where `id` = ?');
      expect(bindings).toEqual([1]);
    });

    it('should handle multiple where conditions', () => {
      const { sql, bindings } = driver.callBuildDeleteSQL('users', { id: 1, name: 'Alice' });

      expect(sql).toBe('delete from `users` where `id` = ? and `name` = ?');
      expect(bindings).toEqual([1, 'Alice']);
    });
  });

  describe('formatError', () => {
    it('should extract message from Error instances', () => {
      expect(driver.callFormatError(new Error('something failed'))).toBe('something failed');
    });

    it('should convert non-Error values to string', () => {
      expect(driver.callFormatError('raw string')).toBe('raw string');
      expect(driver.callFormatError(42)).toBe('42');
      expect(driver.callFormatError(null)).toBe('null');
    });
  });

  describe('buildTableDataQueries', () => {
    it('should build count and data queries without schema', () => {
      const result = driver.callBuildTableDataQueries('users', {});

      expect(result.countSql).toBe('select count(*) as `count` from `users`');
      expect(result.countBindings).toEqual([]);
      expect(result.dataSql).toBe('select * from `users`');
      expect(result.dataBindings).toEqual([]);
    });

    it('should apply filters to both queries', () => {
      const result = driver.callBuildTableDataQueries('users', {
        filters: [{ column: 'status', operator: '=', value: 'active' }],
        limit: 10,
        offset: 5,
      });

      expect(result.countSql).toBe('select count(*) as `count` from `users` where `status` = ?');
      expect(result.countBindings).toEqual(['active']);
      expect(result.dataSql).toBe('select * from `users` where `status` = ? limit ? offset ?');
      expect(result.dataBindings).toEqual(['active', 10, 5]);
    });
  });

  describe('mapColumnsToInfo', () => {
    it('should map Column[] to ColumnInfo[]', () => {
      const columns: Column[] = [
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, unique: false },
        { name: 'name', type: 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, unique: false, defaultValue: 'unnamed' },
      ];

      const result = driver.callMapColumnsToInfo(columns);

      expect(result).toEqual([
        { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true, defaultValue: undefined },
        { name: 'name', type: 'TEXT', nullable: true, primaryKey: false, autoIncrement: false, defaultValue: 'unnamed' },
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(driver.callMapColumnsToInfo([])).toEqual([]);
    });
  });

  describe('DatabaseDriver interface contract', () => {
    it('should have a type property', () => {
      expect(driver.type).toBe(DatabaseType.SQLite);
    });

    it('should have isConnected property', () => {
      expect(typeof driver.isConnected).toBe('boolean');
    });

    it('should implement all required methods', () => {
      const methodNames: (keyof DatabaseDriver)[] = [
        'connect',
        'disconnect',
        'testConnection',
        'execute',
        'getDatabases',
        'getTables',
        'getColumns',
        'getIndexes',
        'getForeignKeys',
        'getTableDDL',
        'getTableData',
        'addColumn',
        'modifyColumn',
        'dropColumn',
        'renameColumn',
        'createIndex',
        'dropIndex',
        'addForeignKey',
        'dropForeignKey',
        'createTable',
        'dropTable',
        'renameTable',
        'insertRow',
        'deleteRow',
        'createView',
        'dropView',
        'renameView',
        'getViewDDL',
        'getDataTypes',
        'getPrimaryKeyColumns',
        'getRoutines',
        'getRoutineDefinition',
        'getUsers',
        'createUser',
        'dropUser',
        'getTriggers',
        'getTriggerDefinition',
        'createTrigger',
        'dropTrigger',
        'ping',
        'cancelQuery',
      ];

      for (const method of methodNames) {
        expect(typeof driver[method]).toBe('function');
      }
    });
  });

  describe('TestConnectionResult interface', () => {
    it('should accept a successful result', () => {
      const result: TestConnectionResult = {
        success: true,
        error: null,
        latency: 42,
        serverVersion: '3.39.0',
        serverInfo: { 'File Size': '1.2 MB' },
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBe(42);
      expect(result.serverVersion).toBe('3.39.0');
      expect(result.serverInfo).toEqual({ 'File Size': '1.2 MB' });
    });

    it('should accept a failed result', () => {
      const result: TestConnectionResult = {
        success: false,
        error: 'Connection refused',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should accept SSH related properties', () => {
      const result: TestConnectionResult = {
        success: true,
        error: null,
        sshSuccess: true,
        sshError: null,
      };

      expect(result.sshSuccess).toBe(true);
      expect(result.sshError).toBeNull();
    });
  });
});
