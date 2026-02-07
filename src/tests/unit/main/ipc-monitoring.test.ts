import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIpcHandle } = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
  },
}));

vi.mock('@main/db/mysql', () => ({
  MySQLDriver: class MySQLDriver {},
}));

vi.mock('@main/db/postgres', () => ({
  PostgreSQLDriver: class PostgreSQLDriver {},
}));

vi.mock('@main/db/sqlite', () => ({
  SQLiteDriver: class SQLiteDriver {},
}));

vi.mock('@main/db/clickhouse', () => ({
  ClickHouseDriver: class ClickHouseDriver {},
}));

vi.mock('@main/db/mongodb', () => ({
  MongoDBDriver: class MongoDBDriver {},
}));

vi.mock('@main/db/redis', () => ({
  RedisDriver: class RedisDriver {},
}));

import { registerMonitoringHandlers } from '@main/ipc/monitoring';
import { connectionManager } from '@main/db/manager';
import { MySQLDriver } from '@main/db/mysql';
import { PostgreSQLDriver } from '@main/db/postgres';
import { SQLiteDriver } from '@main/db/sqlite';
import { ClickHouseDriver } from '@main/db/clickhouse';
import { MongoDBDriver } from '@main/db/mongodb';
import { RedisDriver } from '@main/db/redis';

const mockGetConnection = vi.mocked(connectionManager.getConnection);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

describe('registerMonitoringHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerMonitoringHandlers();
  });

  it('should register all three monitoring IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'monitoring:getProcessList',
      'monitoring:killProcess',
      'monitoring:getServerStatus',
    ]);
  });

  describe('monitoring:getProcessList', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined);
      const handler = getHandler('monitoring:getProcessList');

      await expect(handler(null, 'conn-1')).rejects.toThrow('Connection not found');
    });

    it('should return MySQL process list for MySQL driver', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [
          {
            Id: 42,
            User: 'root',
            Host: 'localhost',
            db: 'testdb',
            Command: 'Query',
            Time: 5,
            State: 'executing',
            Info: 'SELECT 1',
            Progress: 0,
          },
        ],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.execute).toHaveBeenCalledWith('SHOW FULL PROCESSLIST');
      expect(result).toEqual([
        {
          id: 42,
          user: 'root',
          host: 'localhost',
          database: 'testdb',
          command: 'Query',
          time: 5,
          state: 'executing',
          info: 'SELECT 1',
          progress: 0,
        },
      ]);
    });

    it('should throw when MySQL execute returns an error', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [],
        error: 'Access denied',
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      await expect(handler(null, 'conn-1')).rejects.toThrow('Access denied');
    });

    it('should return PostgreSQL process list for PostgreSQL driver', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [
          {
            pid: 100,
            user: 'postgres',
            host: '192.168.1.1',
            database: 'mydb',
            command: 'active',
            time: 10,
            state: 'Lock: relation',
            info: 'SELECT * FROM users',
            backend_type: 'client backend',
          },
        ],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.execute).toHaveBeenCalledWith(expect.stringContaining('pg_stat_activity'));
      expect(result).toEqual([
        {
          id: 100,
          user: 'postgres',
          host: '192.168.1.1',
          database: 'mydb',
          command: 'active',
          time: 10,
          state: 'Lock: relation',
          info: 'SELECT * FROM users',
          backendType: 'client backend',
        },
      ]);
    });

    it('should return "local" for PostgreSQL process with no host', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [
          {
            pid: 101,
            user: 'postgres',
            host: null,
            database: 'mydb',
            command: null,
            time: null,
            state: null,
            info: null,
            backend_type: 'autovacuum launcher',
          },
        ],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1') as Record<string, unknown>[];

      expect(result[0]).toMatchObject({
        host: 'local',
        command: 'idle',
        time: 0,
      });
    });

    it('should throw when PostgreSQL execute returns an error', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [],
        error: 'Permission denied',
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      await expect(handler(null, 'conn-1')).rejects.toThrow('Permission denied');
    });

    it('should return empty array for SQLite driver', async () => {
      const mockDriver = Object.create(SQLiteDriver.prototype);
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual([]);
    });

    it('should return ClickHouse process list for ClickHouse driver', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [
          {
            query_id: 'abc-123',
            user: 'default',
            host: 'clickhouse-host',
            database: 'analytics',
            command: 'Select',
            time: 3.5,
            info: 'SELECT count() FROM events',
            read_rows: 1000,
            memory_usage: 512,
          },
        ],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.execute).toHaveBeenCalledWith(expect.stringContaining('system.processes'));
      expect(result).toEqual([
        {
          id: 'abc-123',
          user: 'default',
          host: 'clickhouse-host',
          database: 'analytics',
          command: 'Select',
          time: 4,
          state: null,
          info: 'SELECT count() FROM events',
        },
      ]);
    });

    it('should throw when ClickHouse execute returns an error', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [],
        error: 'Access denied',
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      await expect(handler(null, 'conn-1')).rejects.toThrow('Access denied');
    });

    it('should return MongoDB process list for MongoDB driver', async () => {
      const mockCommand = vi.fn().mockResolvedValue({
        inprog: [
          {
            opid: 12345,
            client: '192.168.1.5:54321',
            ns: 'mydb.users',
            op: 'query',
            secs_running: 3,
            desc: 'conn1234',
            command: { find: 'users', filter: { active: true } },
          },
        ],
      });
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(mockCommand).toHaveBeenCalledWith({ currentOp: 1, $all: true });
      expect(result).toEqual([
        {
          id: 12345,
          user: '192.168.1.5',
          host: '192.168.1.5:54321',
          database: 'mydb',
          command: 'query',
          time: 3,
          state: 'conn1234',
          info: JSON.stringify({ find: 'users', filter: { active: true } }),
        },
      ]);
    });

    it('should handle MongoDB operations with missing fields', async () => {
      const mockCommand = vi.fn().mockResolvedValue({
        inprog: [
          {
            opid: null,
            ns: null,
            op: null,
            secs_running: null,
            desc: null,
            command: null,
          },
        ],
      });
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1') as Record<string, unknown>[];

      expect(result[0]).toMatchObject({
        id: 0,
        user: '-',
        host: 'local',
        database: null,
        command: 'unknown',
        time: 0,
        state: null,
        info: null,
      });
    });

    it('should return Redis process list for Redis driver', async () => {
      const mockCall = vi.fn().mockResolvedValue(
        'id=6 addr=127.0.0.1:57890 fd=7 name= db=0 cmd=client user=default age=120 flags=N\n' +
        'id=7 addr=127.0.0.1:57891 fd=8 name=worker db=1 cmd=get user=admin age=30 flags=S\n'
      );
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ call: mockCall });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1') as Record<string, unknown>[];

      expect(mockCall).toHaveBeenCalledWith('CLIENT', 'LIST');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: '6',
        user: 'default',
        host: '127.0.0.1:57890',
        database: '0',
        command: 'client',
        time: 120,
        state: 'N',
        info: 'client',
      });
      expect(result[1]).toMatchObject({
        id: '7',
        user: 'admin',
        host: '127.0.0.1:57891',
        database: '1',
        command: 'get',
      });
    });

    it('should return empty array for unsupported driver types', async () => {
      const mockDriver = {};
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('monitoring:getProcessList');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual([]);
    });
  });

  describe('monitoring:killProcess', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined);
      const handler = getHandler('monitoring:killProcess');

      await expect(handler(null, 'conn-1', 42)).rejects.toThrow('Connection not found');
    });

    it('should kill a MySQL process successfully', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({ rows: [] });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 42);

      expect(mockDriver.execute).toHaveBeenCalledWith('KILL 42');
      expect(result).toEqual({ success: true });
    });

    it('should return error when MySQL kill fails', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn().mockRejectedValue(new Error('Unknown thread id'));
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 999);

      expect(result).toEqual({ success: false, error: 'Unknown thread id' });
    });

    it('should cancel a PostgreSQL process gracefully (no force)', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [{ pg_cancel_backend: true }],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 100, false);

      expect(mockDriver.execute).toHaveBeenCalledWith('SELECT pg_cancel_backend($1)', [100]);
      expect(result).toEqual({ success: true, error: undefined });
    });

    it('should force terminate a PostgreSQL process', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [{ pg_terminate_backend: true }],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 100, true);

      expect(mockDriver.execute).toHaveBeenCalledWith('SELECT pg_terminate_backend($1)', [100]);
      expect(result).toEqual({ success: true, error: undefined });
    });

    it('should return failure when PostgreSQL backend termination returns false', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [{ pg_cancel_backend: false }],
        error: undefined,
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 100);

      expect(result).toEqual({ success: false, error: 'Failed to terminate backend' });
    });

    it('should return error when PostgreSQL execute returns an error', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({
        rows: [],
        error: 'Insufficient privileges',
      });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 100);

      expect(result).toEqual({ success: false, error: 'Insufficient privileges' });
    });

    it('should return error when PostgreSQL execute throws', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn().mockRejectedValue(new Error('Connection lost'));
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 100);

      expect(result).toEqual({ success: false, error: 'Connection lost' });
    });

    it('should return error for SQLite driver', async () => {
      const mockDriver = Object.create(SQLiteDriver.prototype);
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 1);

      expect(result).toEqual({ success: false, error: 'SQLite does not support process management' });
    });

    it('should return error for unsupported driver types', async () => {
      const mockDriver = {};
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 1);

      expect(result).toEqual({ success: false, error: 'Unsupported database type' });
    });

    it('should handle non-Error throw from MySQL kill', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn().mockRejectedValue('string error');
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 42);

      expect(result).toEqual({ success: false, error: 'string error' });
    });

    it('should kill a ClickHouse query successfully', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({ rows: [], error: undefined });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 'abc-123');

      expect(mockDriver.execute).toHaveBeenCalledWith(expect.stringContaining('KILL QUERY'));
      expect(result).toEqual({ success: true });
    });

    it('should return error when ClickHouse kill returns an error', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn().mockResolvedValue({ rows: [], error: 'Query not found' });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 'abc-123');

      expect(result).toEqual({ success: false, error: 'Query not found' });
    });

    it('should kill a MongoDB operation successfully', async () => {
      const mockCommand = vi.fn().mockResolvedValue({ ok: 1 });
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 12345);

      expect(mockCommand).toHaveBeenCalledWith({ killOp: 1, op: 12345 });
      expect(result).toEqual({ success: true });
    });

    it('should return error when MongoDB killOp fails', async () => {
      const mockCommand = vi.fn().mockRejectedValue(new Error('Not authorized'));
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 12345);

      expect(result).toEqual({ success: false, error: 'Not authorized' });
    });

    it('should kill a Redis client successfully', async () => {
      const mockCall = vi.fn().mockResolvedValue(1);
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ call: mockCall });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 6);

      expect(mockCall).toHaveBeenCalledWith('CLIENT', 'KILL', 'ID', '6');
      expect(result).toEqual({ success: true });
    });

    it('should return error when Redis CLIENT KILL fails', async () => {
      const mockCall = vi.fn().mockRejectedValue(new Error('ERR No such client'));
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ call: mockCall });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:killProcess');
      const result = await handler(null, 'conn-1', 999);

      expect(result).toEqual({ success: false, error: 'ERR No such client' });
    });
  });

  describe('monitoring:getServerStatus', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined);
      const handler = getHandler('monitoring:getServerStatus');

      await expect(handler(null, 'conn-1')).rejects.toThrow('Connection not found');
    });

    it('should return MySQL server status', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { Variable_name: 'max_connections', Value: '151' },
            { Variable_name: 'version', Value: '8.0.33' },
          ],
          error: undefined,
        })
        .mockResolvedValueOnce({
          rows: [
            { Variable_name: 'Threads_connected', Value: '5' },
            { Variable_name: 'Uptime', Value: '86400' },
          ],
          error: undefined,
        });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.execute).toHaveBeenCalledWith('SHOW GLOBAL VARIABLES');
      expect(mockDriver.execute).toHaveBeenCalledWith('SHOW GLOBAL STATUS');
      expect(result).toEqual({
        variables: { max_connections: '151', version: '8.0.33' },
        status: { Threads_connected: '5', Uptime: '86400' },
      });
    });

    it('should return empty objects when MySQL queries return errors', async () => {
      const mockDriver = Object.create(MySQLDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({ rows: [], error: 'Access denied' })
        .mockResolvedValueOnce({ rows: [], error: 'Access denied' });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });

    it('should return PostgreSQL server status', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { name: 'max_connections', setting: '100' },
            { name: 'shared_buffers', setting: '128MB' },
          ],
          error: undefined,
        })
        .mockResolvedValueOnce({
          rows: [
            { name: 'connections', value: '10' },
            { name: 'server_version', value: 'PostgreSQL 15.3' },
          ],
          error: undefined,
        });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({
        variables: { max_connections: '100', shared_buffers: '128MB' },
        status: { connections: '10', server_version: 'PostgreSQL 15.3' },
      });
    });

    it('should return empty objects when PostgreSQL queries return errors', async () => {
      const mockDriver = Object.create(PostgreSQLDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({ rows: [], error: 'Permission denied' })
        .mockResolvedValueOnce({ rows: [], error: 'Permission denied' });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });

    it('should return SQLite server status with pragma values', async () => {
      const mockDriver = Object.create(SQLiteDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({ rows: [{ journal_mode: 'wal' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ synchronous: '2' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ cache_size: '-2000' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ page_size: '4096' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ wal_autocheckpoint: '1000' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ seq: 0, name: 'main', file: '/path/to/db' }], error: undefined });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['journal_mode']).toBe('wal');
      expect(result.variables['synchronous']).toBe('2');
      expect(result.variables['cache_size']).toBe('-2000');
      expect(result.variables['page_size']).toBe('4096');
      expect(result.variables['wal_autocheckpoint']).toBe('1000');
      expect(result.status['databases']).toBe('1');
    });

    it('should handle errors for individual SQLite pragmas gracefully', async () => {
      const mockDriver = Object.create(SQLiteDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({ rows: [{ journal_mode: 'wal' }], error: undefined })
        .mockRejectedValueOnce(new Error('unknown pragma'))
        .mockResolvedValueOnce({ rows: [{ cache_size: '-2000' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ page_size: '4096' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ wal_autocheckpoint: '1000' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ seq: 0, name: 'main', file: '/path' }], error: undefined });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['journal_mode']).toBe('wal');
      expect(result.variables['synchronous']).toBeUndefined();
      expect(result.variables['cache_size']).toBe('-2000');
    });

    it('should handle SQLite database_list error gracefully', async () => {
      const mockDriver = Object.create(SQLiteDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({ rows: [{ journal_mode: 'wal' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ synchronous: '2' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ cache_size: '-2000' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ page_size: '4096' }], error: undefined })
        .mockResolvedValueOnce({ rows: [{ wal_autocheckpoint: '1000' }], error: undefined })
        .mockRejectedValueOnce(new Error('failed'));
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['journal_mode']).toBe('wal');
      expect(result.status['databases']).toBeUndefined();
    });

    it('should return ClickHouse server status', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { name: 'max_memory_usage', value: '10000000000' },
          ],
          error: undefined,
        })
        .mockResolvedValueOnce({
          rows: [
            { name: 'version', value: '23.8.1' },
            { name: 'uptime', value: '86400' },
            { name: 'current_queries', value: '3' },
            { name: 'databases', value: '5' },
            { name: 'tables', value: '42' },
          ],
          error: undefined,
        });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['max_memory_usage']).toBe('10000000000');
      expect(result.status['version']).toBe('23.8.1');
      expect(result.status['uptime']).toBe('86400');
      expect(result.status['current_queries']).toBe('3');
    });

    it('should handle ClickHouse settings query failure gracefully', async () => {
      const mockDriver = Object.create(ClickHouseDriver.prototype);
      mockDriver.execute = vi.fn()
        .mockRejectedValueOnce(new Error('Access denied'))
        .mockResolvedValueOnce({
          rows: [{ name: 'version', value: '23.8.1' }],
          error: undefined,
        });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables).toEqual({});
      expect(result.status['version']).toBe('23.8.1');
    });

    it('should return MongoDB server status', async () => {
      const mockCommand = vi.fn().mockResolvedValue({
        host: 'mongo-host:27017',
        version: '7.0.4',
        process: 'mongod',
        pid: 1234,
        storageEngine: { name: 'wiredTiger' },
        uptime: 86400,
        connections: { current: 5, available: 95, totalCreated: 100 },
        opcounters: { insert: 10, query: 500, update: 20, delete: 3, command: 1000 },
        mem: { resident: 256, virtual: 1024 },
        network: { bytesIn: 50000, bytesOut: 100000, numRequests: 5000 },
      });
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(mockCommand).toHaveBeenCalledWith({ serverStatus: 1 });
      expect(result.variables['host']).toBe('mongo-host:27017');
      expect(result.variables['version']).toBe('7.0.4');
      expect(result.variables['storageEngine']).toBe('wiredTiger');
      expect(result.status['uptime_seconds']).toBe('86400');
      expect(result.status['connections_current']).toBe('5');
      expect(result.status['connections_available']).toBe('95');
      expect(result.status['opcounters_query']).toBe('500');
      expect(result.status['mem_resident_mb']).toBe('256');
      expect(result.status['network_numRequests']).toBe('5000');
    });

    it('should handle MongoDB serverStatus failure gracefully', async () => {
      const mockCommand = vi.fn().mockRejectedValue(new Error('not authorized'));
      const mockDb = vi.fn().mockReturnValue({ command: mockCommand });
      const mockDriver = Object.create(MongoDBDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ db: mockDb });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });

    it('should return Redis server status', async () => {
      const mockInfo = vi.fn().mockResolvedValue(
        '# Server\r\n' +
        'redis_version:7.2.3\r\n' +
        'redis_mode:standalone\r\n' +
        'os:Linux 5.15.0\r\n' +
        'tcp_port:6379\r\n' +
        '# Clients\r\n' +
        'connected_clients:10\r\n' +
        'blocked_clients:0\r\n' +
        '# Memory\r\n' +
        'used_memory_human:2.50M\r\n' +
        '# Stats\r\n' +
        'total_commands_processed:50000\r\n' +
        'uptime_in_seconds:86400\r\n' +
        'keyspace_hits:1000\r\n' +
        'keyspace_misses:50\r\n'
      );
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ info: mockInfo });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['redis_version']).toBe('7.2.3');
      expect(result.variables['redis_mode']).toBe('standalone');
      expect(result.variables['os']).toBe('Linux 5.15.0');
      expect(result.variables['tcp_port']).toBe('6379');
      expect(result.status['connected_clients']).toBe('10');
      expect(result.status['blocked_clients']).toBe('0');
      expect(result.status['used_memory_human']).toBe('2.50M');
      expect(result.status['total_commands_processed']).toBe('50000');
      expect(result.status['uptime_in_seconds']).toBe('86400');
    });

    it('should handle Redis INFO failure gracefully', async () => {
      const mockInfo = vi.fn().mockRejectedValue(new Error('NOAUTH'));
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ info: mockInfo });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });

    it('should skip header lines and empty lines in Redis INFO', async () => {
      const mockInfo = vi.fn().mockResolvedValue(
        '# Server\r\n' +
        '\r\n' +
        'redis_version:7.0.0\r\n' +
        '# Clients\r\n' +
        'connected_clients:1\r\n'
      );
      const mockDriver = Object.create(RedisDriver.prototype);
      mockDriver.getClient = vi.fn().mockReturnValue({ info: mockInfo });
      mockGetConnection.mockReturnValue(mockDriver);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1') as { variables: Record<string, string>; status: Record<string, string> };

      expect(result.variables['redis_version']).toBe('7.0.0');
      expect(result.status['connected_clients']).toBe('1');
      // Headers should not appear
      expect(result.variables['# Server']).toBeUndefined();
    });

    it('should return empty variables/status for unsupported driver types', async () => {
      const mockDriver = {};
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });
  });
});
