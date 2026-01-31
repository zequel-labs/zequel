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

import { registerMonitoringHandlers } from '@main/ipc/monitoring';
import { connectionManager } from '@main/db/manager';
import { MySQLDriver } from '@main/db/mysql';
import { PostgreSQLDriver } from '@main/db/postgres';
import { SQLiteDriver } from '@main/db/sqlite';

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

    it('should return empty variables/status for unsupported driver types', async () => {
      const mockDriver = {};
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('monitoring:getServerStatus');
      const result = await handler(null, 'conn-1');

      expect(result).toEqual({ variables: {}, status: {} });
    });
  });
});
