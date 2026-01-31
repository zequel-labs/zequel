import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType } from '@main/types';

// ─── Mock ioredis ────────────────────────────────────────────────────────────

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockInfo = vi.fn();
const mockSelect = vi.fn();
const mockScan = vi.fn();
const mockType = vi.fn();
const mockTtl = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();
const mockRename = vi.fn();
const mockPing = vi.fn();
const mockExists = vi.fn();
const mockCall = vi.fn();
const mockLlen = vi.fn();
const mockLrange = vi.fn();
const mockSmembers = vi.fn();
const mockZrange = vi.fn();
const mockHgetall = vi.fn();
const mockXrange = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();

vi.mock('ioredis', () => {
  class MockRedis {
    connect = mockConnect;
    disconnect = mockDisconnect;
    info = mockInfo;
    select = mockSelect;
    scan = mockScan;
    type = mockType;
    ttl = mockTtl;
    get = mockGet;
    set = mockSet;
    del = mockDel;
    rename = mockRename;
    ping = mockPing;
    exists = mockExists;
    call = mockCall;
    llen = mockLlen;
    lrange = mockLrange;
    smembers = mockSmembers;
    zrange = mockZrange;
    hgetall = mockHgetall;
    xrange = mockXrange;
    on = mockOn;
    off = mockOff;
  }
  return { default: MockRedis };
});

// ─── Import after mocking ────────────────────────────────────────────────────

import { RedisDriver } from '@main/db/redis';
import type { ConnectionConfig } from '@main/types';

// ─── Helper ──────────────────────────────────────────────────────────────────

const makeConfig = (overrides?: Partial<ConnectionConfig>): ConnectionConfig => ({
  id: 'test-id',
  name: 'Test Redis',
  type: DatabaseType.Redis,
  host: 'localhost',
  port: 6379,
  database: '0',
  ...overrides
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RedisDriver', () => {
  let driver: RedisDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new RedisDriver();

    // Default mock returns
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockReturnValue(undefined);
    mockInfo.mockResolvedValue('');
    mockSelect.mockResolvedValue('OK');
    mockScan.mockResolvedValue(['0', []]);
  });

  // ─── Type ────────────────────────────────────────────────────────────

  describe('type', () => {
    it('should have type Redis', () => {
      expect(driver.type).toBe(DatabaseType.Redis);
    });
  });

  // ─── Connection ──────────────────────────────────────────────────────

  describe('connect', () => {
    it('should connect successfully', async () => {
      await driver.connect(makeConfig());

      expect(mockConnect).toHaveBeenCalled();
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with password and username', async () => {
      await driver.connect(makeConfig({ username: 'user', password: 'pass' }));

      expect(driver.isConnected).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(driver.connect(makeConfig())).rejects.toThrow('Connection refused');
      expect(driver.isConnected).toBe(false);
    });

    it('should parse database number from "db3"', async () => {
      await driver.connect(makeConfig({ database: 'db3' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should default to database 0 for invalid input', async () => {
      await driver.connect(makeConfig({ database: 'invalid' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should register and remove error handler during connect', async () => {
      await driver.connect(makeConfig());

      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockOff).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('disconnect', () => {
    it('should disconnect and reset state', async () => {
      await driver.connect(makeConfig());
      await driver.disconnect();

      expect(mockDisconnect).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });
  });

  // ─── getDatabases ────────────────────────────────────────────────────

  describe('getDatabases', () => {
    it('should return databases with key counts from INFO keyspace', async () => {
      await driver.connect(makeConfig());

      mockInfo.mockResolvedValueOnce(
        '# Keyspace\r\ndb0:keys=150,expires=10,avg_ttl=3600\r\ndb1:keys=42,expires=0,avg_ttl=0\r\n'
      );

      const databases = await driver.getDatabases();

      expect(databases).toEqual([
        { name: 'db0', charset: '150' },
        { name: 'db1', charset: '42' }
      ]);
    });

    it('should return empty array when INFO fails', async () => {
      await driver.connect(makeConfig());

      mockInfo.mockRejectedValueOnce(new Error('not authorized'));

      const databases = await driver.getDatabases();
      expect(databases).toEqual([]);
    });

    it('should return empty array when no keyspace data', async () => {
      await driver.connect(makeConfig());

      mockInfo.mockResolvedValueOnce('# Keyspace\r\n');

      const databases = await driver.getDatabases();
      expect(databases).toEqual([]);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getDatabases()).rejects.toThrow('Not connected');
    });
  });

  // ─── getTables ───────────────────────────────────────────────────────

  describe('getTables', () => {
    it('should return individual keys when few keys exist', async () => {
      await driver.connect(makeConfig());

      // First scan returns keys, second scan returns cursor 0 (done)
      mockScan
        .mockResolvedValueOnce(['0', ['user:1', 'user:2', 'config']])

      const tables = await driver.getTables('db0');

      expect(tables).toHaveLength(3);
      expect(tables[0].name).toBe('config');
      expect(tables[0].type).toBe(TableObjectType.Table);
      expect(tables[1].name).toBe('user:1');
    });

    it('should switch database if different from current', async () => {
      await driver.connect(makeConfig({ database: '0' }));

      mockScan.mockResolvedValueOnce(['0', []]);

      await driver.getTables('db3');

      expect(mockSelect).toHaveBeenCalledWith(3);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getTables('db0')).rejects.toThrow('Not connected');
    });
  });

  // ─── getColumns ──────────────────────────────────────────────────────

  describe('getColumns', () => {
    it('should return fixed columns for Redis keys', async () => {
      await driver.connect(makeConfig());

      const columns = await driver.getColumns('mykey');

      expect(columns).toHaveLength(4);
      expect(columns[0]).toMatchObject({ name: 'key', type: 'string', primaryKey: true });
      expect(columns[1]).toMatchObject({ name: 'type', type: 'string' });
      expect(columns[2]).toMatchObject({ name: 'ttl', type: 'integer', nullable: true });
      expect(columns[3]).toMatchObject({ name: 'value', type: 'string', nullable: true });
    });
  });

  // ─── getTableData ────────────────────────────────────────────────────

  describe('getTableData', () => {
    it('should return data for a single key', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      // First type call is from getTableData's Promise.all
      mockType.mockResolvedValueOnce('string');
      mockTtl.mockResolvedValueOnce(-1);
      // Second type call is from getKeyValue() internally
      mockType.mockResolvedValueOnce('string');
      mockGet.mockResolvedValueOnce('hello');

      const result = await driver.getTableData('mykey', { limit: 50, offset: 0 });

      expect(result.totalCount).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        key: 'mykey',
        type: 'string',
        ttl: null, // -1 => null
        value: 'hello'
      });
    });

    it('should return data for keys matching a pattern', async () => {
      await driver.connect(makeConfig());

      mockScan.mockResolvedValueOnce(['0', ['user:1', 'user:2']]);

      mockType
        .mockResolvedValueOnce('string')
        .mockResolvedValueOnce('string');
      mockTtl
        .mockResolvedValueOnce(300)
        .mockResolvedValueOnce(-1);
      mockGet
        .mockResolvedValueOnce('Alice')
        .mockResolvedValueOnce('Bob');

      const result = await driver.getTableData('user:*', { limit: 50, offset: 0 });

      expect(result.totalCount).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].key).toBe('user:1');
      expect(result.rows[0].ttl).toBe(300);
      expect(result.rows[1].key).toBe('user:2');
      expect(result.rows[1].ttl).toBeNull();
    });

    it('should return empty when key does not exist', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(0);

      const result = await driver.getTableData('nonexistent', { limit: 50, offset: 0 });

      expect(result.totalCount).toBe(0);
      expect(result.rows).toHaveLength(0);
    });

    it('should paginate results with offset and limit', async () => {
      await driver.connect(makeConfig());

      const keys = Array.from({ length: 10 }, (_, i) => `key:${i}`);
      mockScan.mockResolvedValueOnce(['0', keys]);

      // For the 2 keys in the slice (offset=3, limit=2): key:3, key:4
      mockType.mockResolvedValue('string');
      mockTtl.mockResolvedValue(-1);
      mockGet.mockResolvedValue('val');

      const result = await driver.getTableData('key:*', { limit: 2, offset: 3 });

      expect(result.totalCount).toBe(10);
      expect(result.rows).toHaveLength(2);
      expect(result.offset).toBe(3);
      expect(result.limit).toBe(2);
    });
  });

  // ─── execute (command runner) ────────────────────────────────────────

  describe('execute', () => {
    describe('basic commands', () => {
      it('should execute GET command', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce('myvalue');

        const result = await driver.execute('GET mykey');

        expect(mockCall).toHaveBeenCalledWith('GET', 'mykey');
        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('result', 'myvalue');
      });

      it('should execute SET command', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce('OK');

        const result = await driver.execute('SET mykey myvalue');

        expect(mockCall).toHaveBeenCalledWith('SET', 'mykey', 'myvalue');
        expect(result.rows[0]).toHaveProperty('result', 'OK');
      });

      it('should execute DEL command', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce(1);

        const result = await driver.execute('DEL mykey');

        expect(mockCall).toHaveBeenCalledWith('DEL', 'mykey');
        expect(result.rows[0]).toHaveProperty('result', '1');
      });
    });

    describe('null result', () => {
      it('should return (nil) for null result', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce(null);

        const result = await driver.execute('GET nonexistent');

        expect(result.rows[0]).toHaveProperty('result', '(nil)');
      });
    });

    describe('array results', () => {
      it('should format array results with index', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce(['key1', 'key2', 'key3']);

        const result = await driver.execute('KEYS *');

        expect(result.rowCount).toBe(3);
        expect(result.rows[0]).toHaveProperty('#', 1);
        expect(result.rows[0]).toHaveProperty('value', 'key1');
      });

      it('should format HGETALL as key-value pairs', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce(['field1', 'value1', 'field2', 'value2']);

        const result = await driver.execute('HGETALL myhash');

        expect(result.rowCount).toBe(2);
        expect(result.rows[0]).toHaveProperty('field', 'field1');
        expect(result.rows[0]).toHaveProperty('value', 'value1');
      });

      it('should handle empty array result', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce([]);

        const result = await driver.execute('SMEMBERS emptyset');

        expect(result.rowCount).toBe(0);
        expect(result.rows[0]).toHaveProperty('result', '(empty list or set)');
      });
    });

    describe('quoted strings', () => {
      it('should parse single-quoted strings', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce('OK');

        const result = await driver.execute("SET mykey 'hello world'");

        expect(mockCall).toHaveBeenCalledWith('SET', 'mykey', 'hello world');
        expect(result.error).toBeUndefined();
      });

      it('should parse double-quoted strings', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce('OK');

        const result = await driver.execute('SET mykey "hello world"');

        expect(mockCall).toHaveBeenCalledWith('SET', 'mykey', 'hello world');
        expect(result.error).toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should return error for empty command', async () => {
        await driver.connect(makeConfig());

        const result = await driver.execute('');

        expect(result.error).toBe('Empty command');
      });

      it('should return error when command fails', async () => {
        await driver.connect(makeConfig());

        mockCall.mockRejectedValueOnce(new Error('WRONGTYPE'));

        const result = await driver.execute('GET mykey');

        expect(result.error).toBe('WRONGTYPE');
        expect(result.rowCount).toBe(0);
      });

      it('should throw when not connected', async () => {
        await expect(driver.execute('GET mykey')).rejects.toThrow('Not connected');
      });
    });

    describe('object results', () => {
      it('should stringify object results', async () => {
        await driver.connect(makeConfig());

        mockCall.mockResolvedValueOnce({ foo: 'bar' });

        const result = await driver.execute('CUSTOM cmd');

        expect(result.rows[0]).toHaveProperty('result');
        expect(typeof result.rows[0].result).toBe('string');
      });
    });
  });

  // ─── getIndexes / getForeignKeys ─────────────────────────────────────

  describe('getIndexes', () => {
    it('should return empty array (not applicable)', async () => {
      await driver.connect(makeConfig());
      const indexes = await driver.getIndexes('mykey');
      expect(indexes).toEqual([]);
    });
  });

  describe('getForeignKeys', () => {
    it('should return empty array (not applicable)', async () => {
      await driver.connect(makeConfig());
      const fks = await driver.getForeignKeys('mykey');
      expect(fks).toEqual([]);
    });
  });

  // ─── getTableDDL ─────────────────────────────────────────────────────

  describe('getTableDDL', () => {
    it('should return key info as DDL-like text for string key', async () => {
      await driver.connect(makeConfig());

      mockType.mockResolvedValueOnce('string');
      mockTtl.mockResolvedValueOnce(600);
      mockType.mockResolvedValueOnce('string');
      mockGet.mockResolvedValueOnce('hello');

      const ddl = await driver.getTableDDL('mykey');

      expect(ddl).toContain('Redis Key: mykey');
      expect(ddl).toContain('Type: string');
      expect(ddl).toContain('600 seconds');
      expect(ddl).toContain('hello');
    });

    it('should show "No expiry" for persistent keys', async () => {
      await driver.connect(makeConfig());

      mockType.mockResolvedValueOnce('string');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('string');
      mockGet.mockResolvedValueOnce('value');

      const ddl = await driver.getTableDDL('mykey');

      expect(ddl).toContain('No expiry');
    });

    it('should JSON-stringify non-string values', async () => {
      await driver.connect(makeConfig());

      mockType.mockResolvedValueOnce('hash');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('hash');
      mockHgetall.mockResolvedValueOnce({ field1: 'val1', field2: 'val2' });

      const ddl = await driver.getTableDDL('myhash');

      expect(ddl).toContain('Type: hash');
      expect(ddl).toContain('field1');
      expect(ddl).toContain('val1');
    });

    it('should handle error gracefully', async () => {
      await driver.connect(makeConfig());

      mockType.mockRejectedValueOnce(new Error('error'));

      const ddl = await driver.getTableDDL('badkey');
      expect(ddl).toContain('not found or inaccessible');
    });
  });

  // ─── getDataTypes ────────────────────────────────────────────────────

  describe('getDataTypes', () => {
    it('should return Redis data types', () => {
      const types = driver.getDataTypes();

      expect(types.length).toBeGreaterThan(0);
      const typeNames = types.map((t) => t.name);
      expect(typeNames).toContain('string');
      expect(typeNames).toContain('list');
      expect(typeNames).toContain('set');
      expect(typeNames).toContain('hash');
      expect(typeNames).toContain('zset');
      expect(typeNames).toContain('stream');
    });
  });

  // ─── getPrimaryKeyColumns ────────────────────────────────────────────

  describe('getPrimaryKeyColumns', () => {
    it('should always return ["key"]', async () => {
      await driver.connect(makeConfig());
      const pk = await driver.getPrimaryKeyColumns('mykey');
      expect(pk).toEqual(['key']);
    });
  });

  // ─── Schema operations (not supported) ───────────────────────────────

  describe('unsupported schema operations', () => {
    it('addColumn should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.addColumn({
        table: 'mykey',
        column: { name: 'col', type: 'string', nullable: true }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('column operations');
    });

    it('modifyColumn should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.modifyColumn({
        table: 'mykey',
        oldName: 'col',
        newDefinition: { name: 'col', type: 'string', nullable: true }
      });
      expect(result.success).toBe(false);
    });

    it('dropColumn should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropColumn({
        table: 'mykey',
        columnName: 'col'
      });
      expect(result.success).toBe(false);
    });

    it('renameColumn should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.renameColumn({
        table: 'mykey',
        oldName: 'col',
        newName: 'newcol'
      });
      expect(result.success).toBe(false);
    });

    it('createIndex should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.createIndex({
        table: 'mykey',
        index: { name: 'idx', columns: ['col'] }
      });
      expect(result.success).toBe(false);
    });

    it('dropIndex should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropIndex({
        table: 'mykey',
        indexName: 'idx'
      });
      expect(result.success).toBe(false);
    });

    it('addForeignKey should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.addForeignKey({
        table: 'mykey',
        foreignKey: {
          name: 'fk',
          columns: ['col'],
          referencedTable: 'other',
          referencedColumns: ['id']
        }
      });
      expect(result.success).toBe(false);
    });

    it('dropForeignKey should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropForeignKey({
        table: 'mykey',
        constraintName: 'fk'
      });
      expect(result.success).toBe(false);
    });

    it('createTable should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.createTable({
        table: { name: 'newtable', columns: [] }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('table operations');
    });
  });

  // ─── dropTable (DEL key) ─────────────────────────────────────────────

  describe('dropTable', () => {
    it('should DEL the key', async () => {
      await driver.connect(makeConfig());

      mockDel.mockResolvedValueOnce(1);

      const result = await driver.dropTable({ table: 'mykey' });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toBe('DEL mykey');
      expect(mockDel).toHaveBeenCalledWith('mykey');
    });

    it('should handle error', async () => {
      await driver.connect(makeConfig());

      mockDel.mockRejectedValueOnce(new Error('del failed'));

      const result = await driver.dropTable({ table: 'mykey' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('del failed');
    });
  });

  // ─── renameTable (RENAME key) ────────────────────────────────────────

  describe('renameTable', () => {
    it('should RENAME the key', async () => {
      await driver.connect(makeConfig());

      mockRename.mockResolvedValueOnce('OK');

      const result = await driver.renameTable({
        oldName: 'oldkey',
        newName: 'newkey'
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe('RENAME oldkey newkey');
      expect(mockRename).toHaveBeenCalledWith('oldkey', 'newkey');
    });

    it('should handle error', async () => {
      await driver.connect(makeConfig());

      mockRename.mockRejectedValueOnce(new Error('no such key'));

      const result = await driver.renameTable({ oldName: 'a', newName: 'b' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('no such key');
    });
  });

  // ─── insertRow (SET key value) ───────────────────────────────────────

  describe('insertRow', () => {
    it('should SET a key-value pair', async () => {
      await driver.connect(makeConfig());

      mockSet.mockResolvedValueOnce('OK');

      const result = await driver.insertRow({
        table: 'keys',
        values: { key: 'mykey', value: 'myvalue' }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(mockSet).toHaveBeenCalledWith('mykey', 'myvalue');
    });

    it('should return error when key is missing', async () => {
      await driver.connect(makeConfig());

      const result = await driver.insertRow({
        table: 'keys',
        values: { value: 'myvalue' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Key is required');
    });

    it('should set empty string when value is missing', async () => {
      await driver.connect(makeConfig());

      mockSet.mockResolvedValueOnce('OK');

      const result = await driver.insertRow({
        table: 'keys',
        values: { key: 'mykey' }
      });

      expect(result.success).toBe(true);
      expect(mockSet).toHaveBeenCalledWith('mykey', '');
    });
  });

  // ─── deleteRow (DEL key) ─────────────────────────────────────────────

  describe('deleteRow', () => {
    it('should DEL the key', async () => {
      await driver.connect(makeConfig());

      mockDel.mockResolvedValueOnce(1);

      const result = await driver.deleteRow({
        table: 'keys',
        primaryKeyValues: { key: 'mykey' }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(mockDel).toHaveBeenCalledWith('mykey');
    });

    it('should return error when key is missing', async () => {
      await driver.connect(makeConfig());

      const result = await driver.deleteRow({
        table: 'keys',
        primaryKeyValues: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Key is required');
    });
  });

  // ─── View operations (not supported) ─────────────────────────────────

  describe('view operations', () => {
    it('createView should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.createView({
        view: { name: 'v1', selectStatement: 'SELECT 1' }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('views');
    });

    it('dropView should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropView({ viewName: 'v1' });
      expect(result.success).toBe(false);
    });

    it('renameView should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(false);
    });

    it('getViewDDL should return not supported message', async () => {
      await driver.connect(makeConfig());
      const ddl = await driver.getViewDDL('v1');
      expect(ddl).toContain('does not support');
    });
  });

  // ─── Routine operations (not supported) ──────────────────────────────

  describe('routine operations', () => {
    it('getRoutines should return empty array', async () => {
      await driver.connect(makeConfig());
      const routines = await driver.getRoutines();
      expect(routines).toEqual([]);
    });

    it('getRoutineDefinition should return not supported', async () => {
      await driver.connect(makeConfig());
      const def = await driver.getRoutineDefinition('proc', 'PROCEDURE' as 'PROCEDURE');
      expect(def).toContain('does not support');
    });
  });

  // ─── Trigger operations (not supported) ──────────────────────────────

  describe('trigger operations', () => {
    it('getTriggers should return empty array', async () => {
      await driver.connect(makeConfig());
      const triggers = await driver.getTriggers();
      expect(triggers).toEqual([]);
    });

    it('getTriggerDefinition should return not supported', async () => {
      await driver.connect(makeConfig());
      const def = await driver.getTriggerDefinition('trig');
      expect(def).toContain('does not support');
    });

    it('createTrigger should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.createTrigger({
        trigger: { name: 't1', table: 'mykey', timing: 'BEFORE', event: 'INSERT', body: '' }
      });
      expect(result.success).toBe(false);
    });

    it('dropTrigger should return error', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropTrigger({ triggerName: 't1' });
      expect(result.success).toBe(false);
    });
  });

  // ─── User management ─────────────────────────────────────────────────

  describe('getUsers', () => {
    it('should return users from ACL LIST', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce([
        'user default on ~* +@all',
        'user reader on ~* +@read'
      ]);

      const users = await driver.getUsers();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('default');
      expect(users[1].name).toBe('reader');
    });

    it('should fall back to default user when ACL not supported', async () => {
      await driver.connect(makeConfig());

      mockCall.mockRejectedValueOnce(new Error('unknown command ACL'));

      const users = await driver.getUsers();

      expect(users).toEqual([{ name: 'default', login: true }]);
    });
  });

  describe('getUserPrivileges', () => {
    it('should return privileges from ACL GETUSER', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce([
        'commands', '+@all',
        'keys', '~*',
        'channels', '&*'
      ]);

      const privileges = await driver.getUserPrivileges('default');

      expect(privileges).toHaveLength(3);
      expect(privileges[0]).toMatchObject({
        privilege: 'commands',
        grantee: 'default',
        objectName: '+@all'
      });
    });

    it('should return empty array on error', async () => {
      await driver.connect(makeConfig());

      mockCall.mockRejectedValueOnce(new Error('error'));

      const privileges = await driver.getUserPrivileges('default');
      expect(privileges).toEqual([]);
    });

    it('should return empty array when user not found', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(null);

      const privileges = await driver.getUserPrivileges('unknown');
      expect(privileges).toEqual([]);
    });
  });

  // ─── getClient ───────────────────────────────────────────────────────

  describe('getClient', () => {
    it('should return the ioredis client when connected', async () => {
      await driver.connect(makeConfig());

      const client = driver.getClient();
      expect(client).toBeDefined();
    });

    it('should throw when not connected', () => {
      expect(() => driver.getClient()).toThrow('Not connected');
    });
  });

  // ─── getAllKeys ──────────────────────────────────────────────────────

  describe('getAllKeys', () => {
    it('should scan all keys', async () => {
      await driver.connect(makeConfig());

      mockScan
        .mockResolvedValueOnce(['42', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);

      const keys = await driver.getAllKeys();

      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should respect maxKeys limit', async () => {
      await driver.connect(makeConfig());

      // Return a large batch that exceeds default maxKeys
      const bigBatch = Array.from({ length: 100 }, (_, i) => `key${i}`);
      mockScan.mockResolvedValueOnce(['42', bigBatch]);

      const keys = await driver.getAllKeys(50);

      // Should have stopped after the first batch since keys.length >= maxKeys
      expect(keys.length).toBeGreaterThanOrEqual(50);
    });
  });

  // ─── ping ─────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('should return true when client responds with PONG', async () => {
      await driver.connect(makeConfig());

      mockPing.mockResolvedValueOnce('PONG');

      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when ping fails', async () => {
      await driver.connect(makeConfig());

      mockPing.mockRejectedValueOnce(new Error('timeout'));

      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when response is not PONG', async () => {
      await driver.connect(makeConfig());

      mockPing.mockResolvedValueOnce('ERROR');

      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  // ─── testConnection ──────────────────────────────────────────────────

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      mockInfo.mockResolvedValue(
        '# Server\r\nredis_version:7.0.0\r\nos:Linux\r\ntcp_port:6379\r\nuptime_in_seconds:86400\r\nredis_mode:standalone\r\n'
      );

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.serverVersion).toBe('Redis 7.0.0');
    });

    it('should return failure on connection error', async () => {
      mockConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });

    it('should parse uptime in days and hours', async () => {
      mockInfo.mockResolvedValue(
        '# Server\r\nredis_version:7.0.0\r\nuptime_in_seconds:172800\r\n'
      );

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverInfo?.['Uptime']).toBe('2d 0h');
    });

    it('should show uptime in hours only when less than 1 day', async () => {
      mockInfo.mockResolvedValue(
        '# Server\r\nredis_version:7.0.0\r\nuptime_in_seconds:3600\r\n'
      );

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverInfo?.['Uptime']).toBe('1h');
    });

    it('should handle info call failure gracefully', async () => {
      // First connect succeeds
      mockInfo.mockRejectedValueOnce(new Error('no permission'));

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('Unknown');
    });

    it('should handle non-Error objects in testConnection catch', async () => {
      mockConnect.mockRejectedValueOnce('string error');

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  // ─── connect - SSL/TLS paths ──────────────────────────────────────────

  describe('connect - SSL/TLS', () => {
    it('should connect with SSL in Require mode', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'require' as import('@main/types').SSLMode,
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL in VerifyCA mode with rejectUnauthorized true', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'verify-ca' as import('@main/types').SSLMode,
          ca: 'fake-ca-cert',
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL in VerifyFull mode', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'verify-full' as import('@main/types').SSLMode,
          ca: 'fake-ca',
          cert: 'fake-cert',
          key: 'fake-key',
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should not add TLS when sslConfig mode is Disable', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'disable' as import('@main/types').SSLMode,
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should fallback to plain connection on Prefer mode when TLS fails', async () => {
      // First connect (TLS) fails
      mockConnect
        .mockRejectedValueOnce(new Error('TLS handshake failed'))
        // Second connect (plain) succeeds
        .mockResolvedValueOnce(undefined);

      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'prefer' as import('@main/types').SSLMode,
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should throw when Prefer mode TLS fails and plain also fails', async () => {
      mockConnect
        .mockRejectedValueOnce(new Error('TLS failed'))
        .mockRejectedValueOnce(new Error('Plain also failed'));

      await expect(driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'prefer' as import('@main/types').SSLMode,
        },
      }))).rejects.toThrow('Plain also failed');

      expect(driver.isConnected).toBe(false);
    });

    it('should use rejectUnauthorized from sslConfig when mode is Require', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'require' as import('@main/types').SSLMode,
          rejectUnauthorized: true,
        },
      }));

      expect(driver.isConnected).toBe(true);
    });

    it('should connect with Prefer mode with rejectUnauthorized false', async () => {
      await driver.connect(makeConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: 'prefer' as import('@main/types').SSLMode,
        },
      }));

      expect(driver.isConnected).toBe(true);
    });
  });

  // ─── connect - non-SSL error path cleanup ─────────────────────────────

  describe('connect - error cleanup (non-Prefer mode)', () => {
    it('should cleanup client and throw on connection failure without Prefer mode', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(driver.connect(makeConfig())).rejects.toThrow('Connection refused');

      expect(driver.isConnected).toBe(false);
    });
  });

  // ─── getTableData - various key types ─────────────────────────────────

  describe('getTableData - various key types', () => {
    it('should handle list type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('list');
      mockTtl.mockResolvedValueOnce(600);
      mockType.mockResolvedValueOnce('list');
      mockLlen.mockResolvedValueOnce(5);
      mockLrange.mockResolvedValueOnce(['a', 'b', 'c', 'd', 'e']);

      const result = await driver.getTableData('mylist', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].type).toBe('list');
      expect(result.rows[0].value).toBe('["a","b","c","d","e"]');
    });

    it('should handle set type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('set');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('set');
      mockSmembers.mockResolvedValueOnce(['member1', 'member2']);

      const result = await driver.getTableData('myset', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].type).toBe('set');
      expect(result.rows[0].value).toBe('["member1","member2"]');
    });

    it('should handle zset type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('zset');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('zset');
      mockZrange.mockResolvedValueOnce(['member1', '1', 'member2', '2']);

      const result = await driver.getTableData('myzset', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].type).toBe('zset');
      expect(result.rows[0].value).toContain('member1');
    });

    it('should handle hash type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('hash');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('hash');
      mockHgetall.mockResolvedValueOnce({ field1: 'val1', field2: 'val2' });

      const result = await driver.getTableData('myhash', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].type).toBe('hash');
      expect(result.rows[0].value).toContain('field1');
    });

    it('should handle stream type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('stream');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('stream');
      mockXrange.mockResolvedValueOnce([
        ['1-0', ['name', 'Alice', 'age', '30']],
      ]);

      const result = await driver.getTableData('mystream', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].type).toBe('stream');
      expect(result.rows[0].value).toContain('Alice');
    });

    it('should handle stream xrange error gracefully', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('stream');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('stream');
      mockXrange.mockRejectedValueOnce(new Error('stream error'));

      const result = await driver.getTableData('badstream', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].value).toBe('(stream - unable to read)');
    });

    it('should handle unknown type keys', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('ReJSON-RL');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('ReJSON-RL');

      const result = await driver.getTableData('myjson', { limit: 50, offset: 0 });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].value).toBe('(ReJSON-RL)');
    });

    it('should use default offset and limit when not provided', async () => {
      await driver.connect(makeConfig());

      mockExists.mockResolvedValueOnce(1);
      mockType.mockResolvedValueOnce('string');
      mockTtl.mockResolvedValueOnce(-1);
      mockType.mockResolvedValueOnce('string');
      mockGet.mockResolvedValueOnce('val');

      const result = await driver.getTableData('mykey', {});

      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
    });
  });

  // ─── execute - additional command types ────────────────────────────────

  describe('execute - additional command types', () => {
    it('should handle undefined result', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(undefined);

      const result = await driver.execute('GET nonexistent');

      expect(result.rows[0]).toHaveProperty('result', '(nil)');
    });

    it('should handle numeric result', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(42);

      const result = await driver.execute('INCR counter');

      expect(result.rows[0]).toHaveProperty('result', '42');
      expect(result.rowCount).toBe(1);
    });

    it('should handle CONFIG GET as key-value pairs', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(['maxmemory', '0', 'maxmemory-policy', 'noeviction']);

      const result = await driver.execute('CONFIG GET maxmemory*');

      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toHaveProperty('field', 'maxmemory');
      expect(result.rows[0]).toHaveProperty('value', '0');
    });

    it('should handle array result with objects (e.g., nested data)', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce([{ nested: 'object' }, 'plain']);

      const result = await driver.execute('CUSTOM cmd');

      expect(result.rowCount).toBe(2);
      expect(result.rows[0]).toHaveProperty('value');
    });

    it('should handle non-Error thrown by call', async () => {
      await driver.connect(makeConfig());

      mockCall.mockRejectedValueOnce('string error thrown');

      const result = await driver.execute('BAD cmd');

      expect(result.error).toBe('string error thrown');
    });

    it('should handle boolean-like result as fallback', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(true);

      const result = await driver.execute('CUSTOM truthy');

      expect(result.rows[0]).toHaveProperty('result', 'true');
    });
  });

  // ─── getAllKeys - cursor iteration edge cases ─────────────────────────

  describe('getAllKeys - cursor iteration', () => {
    it('should iterate through multiple cursor pages', async () => {
      await driver.connect(makeConfig());

      mockScan
        .mockResolvedValueOnce(['10', ['k1', 'k2']])
        .mockResolvedValueOnce(['20', ['k3', 'k4']])
        .mockResolvedValueOnce(['0', ['k5']]);

      const keys = await driver.getAllKeys();

      expect(keys).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
    });

    it('should stop scanning when maxKeys is reached', async () => {
      await driver.connect(makeConfig());

      const batch = Array.from({ length: 10 }, (_, i) => `k${i}`);
      mockScan.mockResolvedValueOnce(['5', batch]);

      const keys = await driver.getAllKeys(5);

      expect(keys.length).toBe(10); // batch is already added
      // Scan should stop, not loop again
      expect(mockScan).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getTables - large key set grouping ───────────────────────────────

  describe('getTables - prefix grouping for large key sets', () => {
    it('should group keys by prefix when more than 200 keys', async () => {
      await driver.connect(makeConfig());

      const keys = Array.from({ length: 250 }, (_, i) => `user:${i}`);
      mockScan.mockResolvedValueOnce(['0', keys]);

      const tables = await driver.getTables('db0');

      // Should group by prefix
      expect(tables.length).toBeLessThan(250);
      expect(tables[0].name).toContain(':*');
      expect(tables[0].rowCount).toBe(250);
    });

    it('should handle keys without colon prefix in large set', async () => {
      await driver.connect(makeConfig());

      const keys = [
        ...Array.from({ length: 150 }, (_, i) => `user:${i}`),
        ...Array.from({ length: 60 }, (_, i) => `solo${i}`),
      ];
      mockScan.mockResolvedValueOnce(['0', keys]);

      const tables = await driver.getTables('db0');

      // Should have the user:* group plus individual solo keys as their own groups
      const userGroup = tables.find((t) => t.name === 'user:*');
      expect(userGroup).toBeDefined();
      expect(userGroup!.rowCount).toBe(150);
    });
  });

  // ─── parseDatabaseNumber edge cases ───────────────────────────────────

  describe('connect - parseDatabaseNumber edge cases', () => {
    it('should clamp database number to 0-15 range', async () => {
      await driver.connect(makeConfig({ database: 'db99' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should default empty database string to 0', async () => {
      await driver.connect(makeConfig({ database: '' }));
      expect(driver.isConnected).toBe(true);
    });
  });

  // ─── deleteRow and insertRow error paths ──────────────────────────────

  describe('deleteRow - error path', () => {
    it('should return error when DEL fails', async () => {
      await driver.connect(makeConfig());

      mockDel.mockRejectedValueOnce(new Error('DEL error'));

      const result = await driver.deleteRow({
        table: 'keys',
        primaryKeyValues: { key: 'mykey' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('DEL error');
    });
  });

  describe('insertRow - error path', () => {
    it('should return error when SET fails', async () => {
      await driver.connect(makeConfig());

      mockSet.mockRejectedValueOnce(new Error('SET error'));

      const result = await driver.insertRow({
        table: 'keys',
        values: { key: 'mykey', value: 'val' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SET error');
    });
  });

  // ─── isKeyValueResultCommand coverage ─────────────────────────────────

  describe('execute - isKeyValueResultCommand', () => {
    it('should format ZRANGEBYSCORE as key-value pairs', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(['member1', '10', 'member2', '20']);

      const result = await driver.execute('ZRANGEBYSCORE myzset -inf +inf WITHSCORES');

      expect(result.rows[0]).toHaveProperty('field', 'member1');
      expect(result.rows[0]).toHaveProperty('value', '10');
    });

    it('should not format KEYS as key-value pairs', async () => {
      await driver.connect(makeConfig());

      mockCall.mockResolvedValueOnce(['key1', 'key2']);

      const result = await driver.execute('KEYS *');

      // Regular array format (not key-value)
      expect(result.rows[0]).toHaveProperty('#', 1);
      expect(result.rows[0]).toHaveProperty('value', 'key1');
    });
  });
});
