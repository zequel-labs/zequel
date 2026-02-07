import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType } from '../../../main/types';

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

vi.mock('../../../main/ipc/helpers', () => ({
  withDriver: vi.fn(),
  withMySQLDriver: vi.fn(),
  withPostgresDriver: vi.fn(),
}));

import { ipcMain } from 'electron';
import { withDriver, withMySQLDriver, withPostgresDriver } from '../../../main/ipc/helpers';
import { registerSchemaEditHandlers } from '../../../main/ipc/schema-edit';
import type { DatabaseDriver } from '../../../main/db/base';
import type { MySQLDriver } from '../../../main/db/mysql';
import type { PostgreSQLDriver } from '../../../main/db/postgres';

const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls;
  const match = calls.find((c) => c[0] === channel);
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return match[1] as (...args: unknown[]) => unknown;
};

const setupWithDriverMock = (methodName: string, returnValue: unknown): ReturnType<typeof vi.fn> => {
  const methodMock = vi.fn().mockResolvedValue(returnValue);
  vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
    const mockDriverInstance = { [methodName]: methodMock } as unknown as DatabaseDriver;
    return fn(mockDriverInstance);
  });
  return methodMock;
};

const setupWithMySQLDriverMock = (methodName: string, returnValue: unknown): ReturnType<typeof vi.fn> => {
  const methodMock = vi.fn().mockResolvedValue(returnValue);
  vi.mocked(withMySQLDriver).mockImplementation(async (_id, _feature, fn) => {
    const mockDriverInstance = { [methodName]: methodMock } as unknown as MySQLDriver;
    return fn(mockDriverInstance);
  });
  return methodMock;
};

const setupWithPostgresDriverMock = (methodName: string, returnValue: unknown): ReturnType<typeof vi.fn> => {
  const methodMock = vi.fn().mockResolvedValue(returnValue);
  vi.mocked(withPostgresDriver).mockImplementation(async (_id, _feature, fn) => {
    const mockDriverInstance = { [methodName]: methodMock } as unknown as PostgreSQLDriver;
    return fn(mockDriverInstance);
  });
  return methodMock;
};

describe('registerSchemaEditHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSchemaEditHandlers();
  });

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0]);

    // Column operations
    expect(registeredChannels).toContain('schema:addColumn');
    expect(registeredChannels).toContain('schema:modifyColumn');
    expect(registeredChannels).toContain('schema:dropColumn');
    expect(registeredChannels).toContain('schema:renameColumn');

    // Index operations
    expect(registeredChannels).toContain('schema:createIndex');
    expect(registeredChannels).toContain('schema:dropIndex');

    // Foreign key operations
    expect(registeredChannels).toContain('schema:addForeignKey');
    expect(registeredChannels).toContain('schema:dropForeignKey');

    // Table operations
    expect(registeredChannels).toContain('schema:createTable');
    expect(registeredChannels).toContain('schema:dropTable');
    expect(registeredChannels).toContain('schema:renameTable');

    // Row operations
    expect(registeredChannels).toContain('schema:insertRow');
    expect(registeredChannels).toContain('schema:deleteRow');

    // View operations
    expect(registeredChannels).toContain('schema:createView');
    expect(registeredChannels).toContain('schema:dropView');
    expect(registeredChannels).toContain('schema:renameView');
    expect(registeredChannels).toContain('schema:viewDDL');

    // Metadata operations
    expect(registeredChannels).toContain('schema:getDataTypes');
    expect(registeredChannels).toContain('schema:getPrimaryKey');

    // Routine operations
    expect(registeredChannels).toContain('schema:getRoutines');
    expect(registeredChannels).toContain('schema:getRoutineDefinition');

    // User management
    expect(registeredChannels).toContain('schema:getUsers');
    // MySQL-specific
    expect(registeredChannels).toContain('schema:getCharsets');
    expect(registeredChannels).toContain('schema:getCollations');
    expect(registeredChannels).toContain('schema:setTableCharset');
    expect(registeredChannels).toContain('schema:setDatabaseCharset');
    expect(registeredChannels).toContain('schema:getPartitions');
    expect(registeredChannels).toContain('schema:createPartition');
    expect(registeredChannels).toContain('schema:dropPartition');
    expect(registeredChannels).toContain('schema:getEvents');
    expect(registeredChannels).toContain('schema:getEventDefinition');
    expect(registeredChannels).toContain('schema:createEvent');
    expect(registeredChannels).toContain('schema:dropEvent');
    expect(registeredChannels).toContain('schema:alterEvent');

    // PostgreSQL-specific: Encoding and Collation
    expect(registeredChannels).toContain('schema:getPgEncodings');
    expect(registeredChannels).toContain('schema:getPgCollations');

    // Trigger operations
    expect(registeredChannels).toContain('schema:getTriggers');
    expect(registeredChannels).toContain('schema:getTriggerDefinition');
    expect(registeredChannels).toContain('schema:createTrigger');
    expect(registeredChannels).toContain('schema:dropTrigger');
  });

  // Column operations
  describe('schema:addColumn', () => {
    it('should call driver.addColumn with the request', async () => {
      const request = {
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: true },
      };
      const methodMock = setupWithDriverMock('addColumn', { success: true });

      const handler = getHandler('schema:addColumn');
      const result = await handler({}, 'conn-1', request);

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:modifyColumn', () => {
    it('should call driver.modifyColumn with the request', async () => {
      const request = {
        table: 'users',
        oldName: 'email',
        newDefinition: { name: 'email', type: 'VARCHAR(500)', nullable: false },
      };
      const methodMock = setupWithDriverMock('modifyColumn', { success: true });

      const handler = getHandler('schema:modifyColumn');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropColumn', () => {
    it('should call driver.dropColumn with the request', async () => {
      const request = { table: 'users', columnName: 'age' };
      const methodMock = setupWithDriverMock('dropColumn', { success: true });

      const handler = getHandler('schema:dropColumn');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:renameColumn', () => {
    it('should call driver.renameColumn with the request', async () => {
      const request = { table: 'users', oldName: 'email', newName: 'email_address' };
      const methodMock = setupWithDriverMock('renameColumn', { success: true });

      const handler = getHandler('schema:renameColumn');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  // Table operations
  describe('schema:createTable', () => {
    it('should call driver.createTable with the request', async () => {
      const request = {
        table: {
          name: 'posts',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'title', type: 'VARCHAR(255)', nullable: false },
          ],
        },
      };
      const methodMock = setupWithDriverMock('createTable', { success: true });

      const handler = getHandler('schema:createTable');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropTable', () => {
    it('should call driver.dropTable with the request', async () => {
      const request = { table: 'old_table' };
      const methodMock = setupWithDriverMock('dropTable', { success: true });

      const handler = getHandler('schema:dropTable');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:renameTable', () => {
    it('should call driver.renameTable with the request', async () => {
      const request = { oldName: 'users', newName: 'app_users' };
      const methodMock = setupWithDriverMock('renameTable', { success: true });

      const handler = getHandler('schema:renameTable');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  // View operations
  describe('schema:createView', () => {
    it('should call driver.createView with the request', async () => {
      const request = {
        view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = 1' },
      };
      const methodMock = setupWithDriverMock('createView', { success: true });

      const handler = getHandler('schema:createView');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropView', () => {
    it('should call driver.dropView with the request', async () => {
      const request = { viewName: 'old_view', cascade: true };
      const methodMock = setupWithDriverMock('dropView', { success: true });

      const handler = getHandler('schema:dropView');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:renameView', () => {
    it('should call driver.renameView with the request', async () => {
      const request = { oldName: 'user_view', newName: 'users_view' };
      const methodMock = setupWithDriverMock('renameView', { success: true });

      const handler = getHandler('schema:renameView');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:viewDDL', () => {
    it('should call driver.getViewDDL with view name', async () => {
      const ddl = 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = 1';
      const methodMock = setupWithDriverMock('getViewDDL', ddl);

      const handler = getHandler('schema:viewDDL');
      const result = await handler({}, 'conn-1', 'active_users');

      expect(methodMock).toHaveBeenCalledWith('active_users');
      expect(result).toBe(ddl);
    });
  });

  // Index operations
  describe('schema:createIndex', () => {
    it('should call driver.createIndex with the request', async () => {
      const request = {
        table: 'users',
        index: { name: 'idx_email', columns: ['email'], unique: true },
      };
      const methodMock = setupWithDriverMock('createIndex', { success: true });

      const handler = getHandler('schema:createIndex');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropIndex', () => {
    it('should call driver.dropIndex with the request', async () => {
      const request = { table: 'users', indexName: 'idx_email' };
      const methodMock = setupWithDriverMock('dropIndex', { success: true });

      const handler = getHandler('schema:dropIndex');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  // Foreign key operations
  describe('schema:addForeignKey', () => {
    it('should call driver.addForeignKey with the request', async () => {
      const request = {
        table: 'orders',
        foreignKey: {
          name: 'fk_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onDelete: 'CASCADE' as const,
        },
      };
      const methodMock = setupWithDriverMock('addForeignKey', { success: true });

      const handler = getHandler('schema:addForeignKey');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropForeignKey', () => {
    it('should call driver.dropForeignKey with the request', async () => {
      const request = { table: 'orders', constraintName: 'fk_user' };
      const methodMock = setupWithDriverMock('dropForeignKey', { success: true });

      const handler = getHandler('schema:dropForeignKey');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  // Row operations
  describe('schema:insertRow', () => {
    it('should call driver.insertRow with the request', async () => {
      const request = { table: 'users', values: { name: 'Alice', email: 'alice@example.com' } };
      const methodMock = setupWithDriverMock('insertRow', { success: true });

      const handler = getHandler('schema:insertRow');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:deleteRow', () => {
    it('should call driver.deleteRow with the request', async () => {
      const request = { table: 'users', primaryKeyValues: { id: 42 } };
      const methodMock = setupWithDriverMock('deleteRow', { success: true });

      const handler = getHandler('schema:deleteRow');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  // Metadata operations
  describe('schema:getDataTypes', () => {
    it('should call driver.getDataTypes', async () => {
      const types = [{ name: 'INT', category: 'numeric' }];
      const methodMock = setupWithDriverMock('getDataTypes', types);

      const handler = getHandler('schema:getDataTypes');
      const result = await handler({}, 'conn-1');

      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(types);
    });
  });

  describe('schema:getPrimaryKey', () => {
    it('should call driver.getPrimaryKeyColumns with table name', async () => {
      const pkColumns = ['id'];
      const methodMock = setupWithDriverMock('getPrimaryKeyColumns', pkColumns);

      const handler = getHandler('schema:getPrimaryKey');
      const result = await handler({}, 'conn-1', 'users');

      expect(methodMock).toHaveBeenCalledWith('users');
      expect(result).toEqual(['id']);
    });
  });

  // Routine operations
  describe('schema:getRoutines', () => {
    it('should call driver.getRoutines with optional type filter', async () => {
      const routines = [{ name: 'get_user', type: 'FUNCTION' }];
      const methodMock = setupWithDriverMock('getRoutines', routines);

      const handler = getHandler('schema:getRoutines');
      const result = await handler({}, 'conn-1', 'FUNCTION');

      expect(methodMock).toHaveBeenCalledWith('FUNCTION');
      expect(result).toEqual(routines);
    });
  });

  describe('schema:getRoutineDefinition', () => {
    it('should call driver.getRoutineDefinition with name and type', async () => {
      const definition = 'CREATE FUNCTION get_user(id INT) RETURNS TEXT';
      const methodMock = setupWithDriverMock('getRoutineDefinition', definition);

      const handler = getHandler('schema:getRoutineDefinition');
      const result = await handler({}, 'conn-1', 'get_user', 'FUNCTION');

      expect(methodMock).toHaveBeenCalledWith('get_user', 'FUNCTION');
      expect(result).toBe(definition);
    });
  });

  // User management
  describe('schema:getUsers', () => {
    it('should call driver.getUsers', async () => {
      const users = [{ name: 'admin', superuser: true }];
      const methodMock = setupWithDriverMock('getUsers', users);

      const handler = getHandler('schema:getUsers');
      const result = await handler({}, 'conn-1');

      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(users);
    });
  });

  describe('schema:createUser', () => {
    it('should call driver.createUser', async () => {
      const createResult = { success: true, sql: 'CREATE ROLE ...' };
      const methodMock = setupWithDriverMock('createUser', createResult);

      const handler = getHandler('schema:createUser');
      const request = { user: { name: 'newuser', password: 'pw' } };
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual(createResult);
    });
  });

  describe('schema:dropUser', () => {
    it('should call driver.dropUser', async () => {
      const dropResult = { success: true, sql: 'DROP ROLE ...' };
      const methodMock = setupWithDriverMock('dropUser', dropResult);

      const handler = getHandler('schema:dropUser');
      const request = { name: 'olduser' };
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual(dropResult);
    });
  });

  // MySQL-specific: Charsets
  describe('schema:getCharsets', () => {
    it('should call withMySQLDriver with Charsets feature name', async () => {
      const charsets = [{ charset: 'utf8mb4', description: 'UTF-8 Unicode' }];
      const methodMock = setupWithMySQLDriverMock('getCharsets', charsets);

      const handler = getHandler('schema:getCharsets');
      const result = await handler({}, 'conn-1');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Charsets', expect.any(Function));
      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(charsets);
    });
  });

  describe('schema:getCollations', () => {
    it('should call withMySQLDriver with Collations feature name', async () => {
      const collations = [{ collation: 'utf8mb4_general_ci', charset: 'utf8mb4' }];
      const methodMock = setupWithMySQLDriverMock('getCollations', collations);

      const handler = getHandler('schema:getCollations');
      const result = await handler({}, 'conn-1', 'utf8mb4');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Collations', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('utf8mb4');
      expect(result).toEqual(collations);
    });
  });

  describe('schema:setTableCharset', () => {
    it('should call withMySQLDriver to set table charset', async () => {
      const methodMock = setupWithMySQLDriverMock('setTableCharset', { success: true });

      const handler = getHandler('schema:setTableCharset');
      const result = await handler({}, 'conn-1', 'users', 'utf8mb4', 'utf8mb4_unicode_ci');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Charsets', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('users', 'utf8mb4', 'utf8mb4_unicode_ci');
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:setDatabaseCharset', () => {
    it('should call withMySQLDriver to set database charset', async () => {
      const methodMock = setupWithMySQLDriverMock('setDatabaseCharset', { success: true });

      const handler = getHandler('schema:setDatabaseCharset');
      const result = await handler({}, 'conn-1', 'mydb', 'utf8mb4', 'utf8mb4_general_ci');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Charsets', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('mydb', 'utf8mb4', 'utf8mb4_general_ci');
      expect(result).toEqual({ success: true });
    });
  });

  // MySQL-specific: Partitions
  describe('schema:getPartitions', () => {
    it('should call withMySQLDriver to get partitions', async () => {
      const partitions = [{ partitionName: 'p0', partitionMethod: 'RANGE' }];
      const methodMock = setupWithMySQLDriverMock('getPartitions', partitions);

      const handler = getHandler('schema:getPartitions');
      const result = await handler({}, 'conn-1', 'large_table');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Partitions', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('large_table');
      expect(result).toEqual(partitions);
    });
  });

  describe('schema:createPartition', () => {
    it('should call withMySQLDriver to create a partition', async () => {
      const methodMock = setupWithMySQLDriverMock('createPartition', { success: true });

      const handler = getHandler('schema:createPartition');
      const result = await handler({}, 'conn-1', 'orders', 'p2024', 'RANGE', 'YEAR(created_at)', '2025');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Partitions', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('orders', 'p2024', 'RANGE', 'YEAR(created_at)', '2025');
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropPartition', () => {
    it('should call withMySQLDriver to drop a partition', async () => {
      const methodMock = setupWithMySQLDriverMock('dropPartition', { success: true });

      const handler = getHandler('schema:dropPartition');
      const result = await handler({}, 'conn-1', 'orders', 'p2020');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Partitions', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('orders', 'p2020');
      expect(result).toEqual({ success: true });
    });
  });

  // MySQL-specific: Events
  describe('schema:getEvents', () => {
    it('should call withMySQLDriver to get events', async () => {
      const events = [{ name: 'daily_cleanup', eventType: 'RECURRING' }];
      const methodMock = setupWithMySQLDriverMock('getEvents', events);

      const handler = getHandler('schema:getEvents');
      const result = await handler({}, 'conn-1');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Events', expect.any(Function));
      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(events);
    });
  });

  describe('schema:createEvent', () => {
    it('should call withMySQLDriver to create an event', async () => {
      const methodMock = setupWithMySQLDriverMock('createEvent', { success: true });

      const handler = getHandler('schema:createEvent');
      const result = await handler(
        {},
        'conn-1',
        'daily_cleanup',
        'EVERY 1 DAY',
        'DELETE FROM logs WHERE created_at < NOW() - INTERVAL 30 DAY',
        { status: 'ENABLED' }
      );

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Events', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith(
        'daily_cleanup',
        'EVERY 1 DAY',
        'DELETE FROM logs WHERE created_at < NOW() - INTERVAL 30 DAY',
        { status: 'ENABLED' }
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropEvent', () => {
    it('should call withMySQLDriver to drop an event', async () => {
      const methodMock = setupWithMySQLDriverMock('dropEvent', { success: true });

      const handler = getHandler('schema:dropEvent');
      const result = await handler({}, 'conn-1', 'old_event');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Events', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('old_event');
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:alterEvent', () => {
    it('should call withMySQLDriver to alter an event', async () => {
      const options = { status: 'DISABLED' as const, newName: 'renamed_event' };
      const methodMock = setupWithMySQLDriverMock('alterEvent', { success: true });

      const handler = getHandler('schema:alterEvent');
      const result = await handler({}, 'conn-1', 'my_event', options);

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Events', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('my_event', options);
      expect(result).toEqual({ success: true });
    });
  });

  // PostgreSQL-specific: Encodings and Collations
  describe('schema:getPgEncodings', () => {
    it('should call withPostgresDriver with Encodings feature name', async () => {
      const encodings = [{ name: 'UTF8' }, { name: 'LATIN1' }];
      const methodMock = setupWithPostgresDriverMock('getEncodings', encodings);

      const handler = getHandler('schema:getPgEncodings');
      const result = await handler({}, 'conn-1');

      expect(withPostgresDriver).toHaveBeenCalledWith('conn-1', 'Encodings', expect.any(Function));
      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(encodings);
    });
  });

  describe('schema:getPgCollations', () => {
    it('should call withPostgresDriver with Collations feature name', async () => {
      const collations = [{ name: 'C' }, { name: 'en_US.UTF-8' }];
      const methodMock = setupWithPostgresDriverMock('getCollations', collations);

      const handler = getHandler('schema:getPgCollations');
      const result = await handler({}, 'conn-1');

      expect(withPostgresDriver).toHaveBeenCalledWith('conn-1', 'Collations', expect.any(Function));
      expect(methodMock).toHaveBeenCalled();
      expect(result).toEqual(collations);
    });
  });

  // Trigger operations
  describe('schema:getTriggers', () => {
    it('should call driver.getTriggers with optional table filter', async () => {
      const triggers = [{ name: 'trg_users_insert', table: 'users', event: 'INSERT', timing: 'BEFORE' }];
      const methodMock = setupWithDriverMock('getTriggers', triggers);

      const handler = getHandler('schema:getTriggers');
      const result = await handler({}, 'conn-1', 'users');

      expect(methodMock).toHaveBeenCalledWith('users');
      expect(result).toEqual(triggers);
    });
  });

  describe('schema:createTrigger', () => {
    it('should call driver.createTrigger with the request', async () => {
      const request = {
        trigger: {
          name: 'trg_audit',
          table: 'users',
          timing: 'AFTER' as const,
          event: 'UPDATE' as const,
          body: 'INSERT INTO audit_log VALUES (NEW.id, NOW())',
        },
      };
      const methodMock = setupWithDriverMock('createTrigger', { success: true });

      const handler = getHandler('schema:createTrigger');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropTrigger', () => {
    it('should call driver.dropTrigger with the request', async () => {
      const request = { triggerName: 'trg_audit', table: 'users' };
      const methodMock = setupWithDriverMock('dropTrigger', { success: true });

      const handler = getHandler('schema:dropTrigger');
      const result = await handler({}, 'conn-1', request);

      expect(methodMock).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:getTriggerDefinition', () => {
    it('should call driver.getTriggerDefinition with name and optional table', async () => {
      const definition = 'CREATE TRIGGER trg_audit AFTER UPDATE ON users ...';
      const methodMock = setupWithDriverMock('getTriggerDefinition', definition);

      const handler = getHandler('schema:getTriggerDefinition');
      const result = await handler({}, 'conn-1', 'trg_audit', 'users');

      expect(methodMock).toHaveBeenCalledWith('trg_audit', 'users');
      expect(result).toBe(definition);
    });
  });

  describe('schema:getEventDefinition', () => {
    it('should call withMySQLDriver to get event definition', async () => {
      const definition = 'CREATE EVENT daily_cleanup ON SCHEDULE EVERY 1 DAY ...';
      const methodMock = setupWithMySQLDriverMock('getEventDefinition', definition);

      const handler = getHandler('schema:getEventDefinition');
      const result = await handler({}, 'conn-1', 'daily_cleanup');

      expect(withMySQLDriver).toHaveBeenCalledWith('conn-1', 'Events', expect.any(Function));
      expect(methodMock).toHaveBeenCalledWith('daily_cleanup');
      expect(result).toBe(definition);
    });
  });
});
