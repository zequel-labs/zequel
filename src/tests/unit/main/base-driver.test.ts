import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  type UserPrivilege,
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
  DropTriggerRequest
} from '@main/types/schema-operations';

// Concrete implementation of BaseDriver for testing purposes
class TestDriver extends BaseDriver {
  readonly type = DatabaseType.SQLite;

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

  async getUserPrivileges(_username: string, _host?: string): Promise<UserPrivilege[]> {
    return [];
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

  public callBuildWhereClause(options: DataOptions): { clause: string; values: unknown[] } {
    return this.buildWhereClause(options);
  }

  public callBuildOrderClause(options: DataOptions): string {
    return this.buildOrderClause(options);
  }

  public callBuildLimitClause(options: DataOptions): string {
    return this.buildLimitClause(options);
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

  describe('buildWhereClause', () => {
    it('should return empty clause when no filters', () => {
      const result = driver.callBuildWhereClause({});

      expect(result.clause).toBe('');
      expect(result.values).toEqual([]);
    });

    it('should return empty clause when filters array is empty', () => {
      const result = driver.callBuildWhereClause({ filters: [] });

      expect(result.clause).toBe('');
      expect(result.values).toEqual([]);
    });

    it('should handle IS NULL operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NULL', value: null }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "name" IS NULL');
      expect(result.values).toEqual([]);
    });

    it('should handle IS NOT NULL operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'IS NOT NULL', value: null }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "name" IS NOT NULL');
      expect(result.values).toEqual([]);
    });

    it('should handle IN operator with array value', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "status" IN (?, ?)');
      expect(result.values).toEqual(['active', 'pending']);
    });

    it('should handle NOT IN operator with array value', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'NOT IN', value: [1, 2, 3] }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "status" NOT IN (?, ?, ?)');
      expect(result.values).toEqual([1, 2, 3]);
    });

    it('should skip IN operator when value is not an array', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: 'IN', value: 'active' }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('');
      expect(result.values).toEqual([]);
    });

    it('should handle LIKE operator with wildcard wrapping', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'LIKE', value: 'test' }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "name" LIKE ?');
      expect(result.values).toEqual(['%test%']);
    });

    it('should handle NOT LIKE operator with wildcard wrapping', () => {
      const options: DataOptions = {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: 'test' }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "name" NOT LIKE ?');
      expect(result.values).toEqual(['%test%']);
    });

    it('should handle = operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'id', operator: '=', value: 42 }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "id" = ?');
      expect(result.values).toEqual([42]);
    });

    it('should handle != operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'status', operator: '!=', value: 'deleted' }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "status" != ?');
      expect(result.values).toEqual(['deleted']);
    });

    it('should handle > operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'age', operator: '>', value: 18 }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "age" > ?');
      expect(result.values).toEqual([18]);
    });

    it('should handle < operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'age', operator: '<', value: 65 }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "age" < ?');
      expect(result.values).toEqual([65]);
    });

    it('should handle >= operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'score', operator: '>=', value: 90 }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "score" >= ?');
      expect(result.values).toEqual([90]);
    });

    it('should handle <= operator', () => {
      const options: DataOptions = {
        filters: [{ column: 'score', operator: '<=', value: 100 }],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "score" <= ?');
      expect(result.values).toEqual([100]);
    });

    it('should combine multiple filters with AND', () => {
      const options: DataOptions = {
        filters: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'age', operator: '>', value: 18 },
        ],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "status" = ? AND "age" > ?');
      expect(result.values).toEqual(['active', 18]);
    });

    it('should handle mixed operator types in multiple filters', () => {
      const options: DataOptions = {
        filters: [
          { column: 'name', operator: 'IS NOT NULL', value: null },
          { column: 'category', operator: 'IN', value: ['A', 'B'] },
          { column: 'score', operator: '>=', value: 50 },
        ],
      };

      const result = driver.callBuildWhereClause(options);

      expect(result.clause).toBe('WHERE "name" IS NOT NULL AND "category" IN (?, ?) AND "score" >= ?');
      expect(result.values).toEqual(['A', 'B', 50]);
    });
  });

  describe('buildOrderClause', () => {
    it('should return empty string when no orderBy', () => {
      const result = driver.callBuildOrderClause({});

      expect(result).toBe('');
    });

    it('should build ORDER BY clause with default ASC direction', () => {
      const options: DataOptions = { orderBy: 'name' };

      const result = driver.callBuildOrderClause(options);

      expect(result).toBe('ORDER BY "name" ASC');
    });

    it('should build ORDER BY clause with specified direction', () => {
      const options: DataOptions = { orderBy: 'created_at', orderDirection: 'DESC' as DataOptions['orderDirection'] };

      const result = driver.callBuildOrderClause(options);

      expect(result).toBe('ORDER BY "created_at" DESC');
    });
  });

  describe('buildLimitClause', () => {
    it('should return empty string when no limit or offset', () => {
      const result = driver.callBuildLimitClause({});

      expect(result).toBe('');
    });

    it('should build LIMIT clause', () => {
      const options: DataOptions = { limit: 50 };

      const result = driver.callBuildLimitClause(options);

      expect(result).toBe('LIMIT 50');
    });

    it('should build OFFSET clause', () => {
      const options: DataOptions = { offset: 100 };

      const result = driver.callBuildLimitClause(options);

      expect(result).toBe('OFFSET 100');
    });

    it('should build LIMIT and OFFSET clause together', () => {
      const options: DataOptions = { limit: 25, offset: 50 };

      const result = driver.callBuildLimitClause(options);

      expect(result).toBe('LIMIT 25 OFFSET 50');
    });

    it('should handle limit of 0', () => {
      const options: DataOptions = { limit: 0 };

      const result = driver.callBuildLimitClause(options);

      expect(result).toBe('LIMIT 0');
    });

    it('should handle offset of 0', () => {
      const options: DataOptions = { offset: 0 };

      const result = driver.callBuildLimitClause(options);

      expect(result).toBe('OFFSET 0');
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
        'getUserPrivileges',
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
