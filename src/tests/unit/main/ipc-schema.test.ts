import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../../../main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

vi.mock('../../../main/utils/serialize', () => ({
  toPlainObject: vi.fn(<T>(obj: T): T => JSON.parse(JSON.stringify(obj))),
}));

vi.mock('../../../main/ipc/helpers', () => ({
  withDriver: vi.fn(),
}));

import { ipcMain } from 'electron';
import { withDriver } from '../../../main/ipc/helpers';
import { toPlainObject } from '../../../main/utils/serialize';
import { registerSchemaHandlers } from '../../../main/ipc/schema';
import type { DatabaseDriver } from '../../../main/db/base';

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
});
