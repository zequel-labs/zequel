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

vi.mock('@main/db/postgres', () => ({
  PostgreSQLDriver: class PostgreSQLDriver {},
}));

vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { registerPostgreSQLHandlers } from '@main/ipc/postgresql';
import { connectionManager } from '@main/db/manager';
import { PostgreSQLDriver } from '@main/db/postgres';
import { DatabaseType } from '@main/types';

const mockGetConnection = vi.mocked(connectionManager.getConnection);

const getHandler = (channel: string): ((_: unknown, ...args: unknown[]) => Promise<unknown>) => {
  const call = mockIpcHandle.mock.calls.find(
    (c: [string, unknown]) => c[0] === channel
  );
  if (!call) throw new Error(`Handler not found for channel: ${channel}`);
  return call[1] as ((_: unknown, ...args: unknown[]) => Promise<unknown>);
};

const createMockPgDriver = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
  const driver = Object.create(PostgreSQLDriver.prototype);
  driver.type = DatabaseType.PostgreSQL;
  driver.getSchemas = vi.fn().mockResolvedValue([]);
  driver.setCurrentSchema = vi.fn();
  driver.getCurrentSchema = vi.fn().mockReturnValue('public');
  driver.getSequences = vi.fn().mockResolvedValue([]);
  driver.getSequenceDetails = vi.fn().mockResolvedValue({});
  driver.createSequence = vi.fn().mockResolvedValue({ success: true });
  driver.dropSequence = vi.fn().mockResolvedValue({ success: true });
  driver.alterSequence = vi.fn().mockResolvedValue({ success: true });
  driver.getMaterializedViews = vi.fn().mockResolvedValue([]);
  driver.refreshMaterializedView = vi.fn().mockResolvedValue({ success: true });
  driver.getMaterializedViewDDL = vi.fn().mockResolvedValue('');
  driver.getExtensions = vi.fn().mockResolvedValue([]);
  driver.getAvailableExtensions = vi.fn().mockResolvedValue([]);
  driver.createExtension = vi.fn().mockResolvedValue({ success: true });
  driver.dropExtension = vi.fn().mockResolvedValue({ success: true });
  driver.getEnums = vi.fn().mockResolvedValue([]);
  driver.getAllEnums = vi.fn().mockResolvedValue([]);
  Object.assign(driver, overrides);
  return driver;
};

describe('registerPostgreSQLHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcHandle.mockReset();
    registerPostgreSQLHandlers();
  });

  it('should register all PostgreSQL IPC handlers', () => {
    const registeredChannels = mockIpcHandle.mock.calls.map(
      (call: [string, unknown]) => call[0]
    );
    expect(registeredChannels).toEqual([
      'schema:getSchemas',
      'schema:setCurrentSchema',
      'schema:getCurrentSchema',
      'schema:getSequences',
      'schema:getSequenceDetails',
      'schema:createSequence',
      'schema:dropSequence',
      'schema:alterSequence',
      'schema:getMaterializedViews',
      'schema:refreshMaterializedView',
      'schema:getMaterializedViewDDL',
      'schema:getExtensions',
      'schema:getAvailableExtensions',
      'schema:createExtension',
      'schema:dropExtension',
      'schema:getEnums',
      'schema:getAllEnums',
    ]);
  });

  describe('getPostgreSQLDriver helper', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined);
      const handler = getHandler('schema:getSchemas');

      await expect(handler(null, 'conn-1')).rejects.toThrow('Not connected to database');
    });

    it('should throw when connection is not PostgreSQL', async () => {
      const mockDriver = { type: DatabaseType.MySQL };
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);
      const handler = getHandler('schema:getSchemas');

      await expect(handler(null, 'conn-1')).rejects.toThrow(
        'This operation is only available for PostgreSQL connections'
      );
    });
  });

  describe('schema:getSchemas', () => {
    it('should call driver.getSchemas and return result', async () => {
      const schemas = [{ name: 'public' }, { name: 'private' }];
      const mockDriver = createMockPgDriver({ getSchemas: vi.fn().mockResolvedValue(schemas) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getSchemas');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.getSchemas).toHaveBeenCalled();
      expect(result).toEqual(schemas);
    });
  });

  describe('schema:setCurrentSchema', () => {
    it('should call driver.setCurrentSchema and return true', async () => {
      const mockDriver = createMockPgDriver();
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:setCurrentSchema');
      const result = await handler(null, 'conn-1', 'my_schema');

      expect(mockDriver.setCurrentSchema).toHaveBeenCalledWith('my_schema');
      expect(result).toBe(true);
    });
  });

  describe('schema:getCurrentSchema', () => {
    it('should call driver.getCurrentSchema and return schema name', async () => {
      const mockDriver = createMockPgDriver({ getCurrentSchema: vi.fn().mockReturnValue('custom_schema') });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getCurrentSchema');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.getCurrentSchema).toHaveBeenCalled();
      expect(result).toBe('custom_schema');
    });
  });

  describe('schema:getSequences', () => {
    it('should call driver.getSequences with optional schema', async () => {
      const sequences = [{ name: 'users_id_seq', schema: 'public' }];
      const mockDriver = createMockPgDriver({ getSequences: vi.fn().mockResolvedValue(sequences) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getSequences');
      const result = await handler(null, 'conn-1', 'public');

      expect(mockDriver.getSequences).toHaveBeenCalledWith('public');
      expect(result).toEqual(sequences);
    });

    it('should call driver.getSequences without schema', async () => {
      const mockDriver = createMockPgDriver({ getSequences: vi.fn().mockResolvedValue([]) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getSequences');
      await handler(null, 'conn-1');

      expect(mockDriver.getSequences).toHaveBeenCalledWith(undefined);
    });
  });

  describe('schema:getSequenceDetails', () => {
    it('should call driver.getSequenceDetails with sequence name and schema', async () => {
      const details = { name: 'users_id_seq', startValue: '1', increment: '1' };
      const mockDriver = createMockPgDriver({ getSequenceDetails: vi.fn().mockResolvedValue(details) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getSequenceDetails');
      const result = await handler(null, 'conn-1', 'users_id_seq', 'public');

      expect(mockDriver.getSequenceDetails).toHaveBeenCalledWith('users_id_seq', 'public');
      expect(result).toEqual(details);
    });
  });

  describe('schema:createSequence', () => {
    it('should call driver.createSequence with request', async () => {
      const request = { sequence: { name: 'my_seq', startWith: 1, increment: 1 } };
      const mockDriver = createMockPgDriver({ createSequence: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:createSequence');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.createSequence).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropSequence', () => {
    it('should call driver.dropSequence with request', async () => {
      const request = { sequenceName: 'my_seq', cascade: true };
      const mockDriver = createMockPgDriver({ dropSequence: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:dropSequence');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.dropSequence).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:alterSequence', () => {
    it('should call driver.alterSequence with request', async () => {
      const request = { sequenceName: 'my_seq', restartWith: 100 };
      const mockDriver = createMockPgDriver({ alterSequence: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:alterSequence');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.alterSequence).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:getMaterializedViews', () => {
    it('should call driver.getMaterializedViews with optional schema', async () => {
      const views = [{ name: 'user_stats', schema: 'public' }];
      const mockDriver = createMockPgDriver({ getMaterializedViews: vi.fn().mockResolvedValue(views) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getMaterializedViews');
      const result = await handler(null, 'conn-1', 'public');

      expect(mockDriver.getMaterializedViews).toHaveBeenCalledWith('public');
      expect(result).toEqual(views);
    });
  });

  describe('schema:refreshMaterializedView', () => {
    it('should call driver.refreshMaterializedView with request', async () => {
      const request = { viewName: 'user_stats', concurrently: true };
      const mockDriver = createMockPgDriver({ refreshMaterializedView: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:refreshMaterializedView');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.refreshMaterializedView).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:getMaterializedViewDDL', () => {
    it('should call driver.getMaterializedViewDDL with view name and schema', async () => {
      const ddl = 'CREATE MATERIALIZED VIEW user_stats AS SELECT ...';
      const mockDriver = createMockPgDriver({ getMaterializedViewDDL: vi.fn().mockResolvedValue(ddl) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getMaterializedViewDDL');
      const result = await handler(null, 'conn-1', 'user_stats', 'public');

      expect(mockDriver.getMaterializedViewDDL).toHaveBeenCalledWith('user_stats', 'public');
      expect(result).toBe(ddl);
    });
  });

  describe('schema:getExtensions', () => {
    it('should call driver.getExtensions and return result', async () => {
      const extensions = [{ name: 'uuid-ossp', version: '1.1' }];
      const mockDriver = createMockPgDriver({ getExtensions: vi.fn().mockResolvedValue(extensions) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getExtensions');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.getExtensions).toHaveBeenCalled();
      expect(result).toEqual(extensions);
    });
  });

  describe('schema:getAvailableExtensions', () => {
    it('should call driver.getAvailableExtensions and return result', async () => {
      const extensions = [{ name: 'postgis', version: '3.3.2' }];
      const mockDriver = createMockPgDriver({ getAvailableExtensions: vi.fn().mockResolvedValue(extensions) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getAvailableExtensions');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.getAvailableExtensions).toHaveBeenCalled();
      expect(result).toEqual(extensions);
    });
  });

  describe('schema:createExtension', () => {
    it('should call driver.createExtension with request', async () => {
      const request = { name: 'uuid-ossp', schema: 'public' };
      const mockDriver = createMockPgDriver({ createExtension: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:createExtension');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.createExtension).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:dropExtension', () => {
    it('should call driver.dropExtension with request', async () => {
      const request = { name: 'uuid-ossp', cascade: true };
      const mockDriver = createMockPgDriver({ dropExtension: vi.fn().mockResolvedValue({ success: true }) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:dropExtension');
      const result = await handler(null, 'conn-1', request);

      expect(mockDriver.dropExtension).toHaveBeenCalledWith(request);
      expect(result).toEqual({ success: true });
    });
  });

  describe('schema:getEnums', () => {
    it('should call driver.getEnums with optional schema', async () => {
      const enums = [{ name: 'status_type', schema: 'public', values: ['active', 'inactive'] }];
      const mockDriver = createMockPgDriver({ getEnums: vi.fn().mockResolvedValue(enums) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getEnums');
      const result = await handler(null, 'conn-1', 'public');

      expect(mockDriver.getEnums).toHaveBeenCalledWith('public');
      expect(result).toEqual(enums);
    });
  });

  describe('schema:getAllEnums', () => {
    it('should call driver.getAllEnums and return result', async () => {
      const enums = [{ name: 'status_type', schema: 'public', values: ['active'] }];
      const mockDriver = createMockPgDriver({ getAllEnums: vi.fn().mockResolvedValue(enums) });
      mockGetConnection.mockReturnValue(mockDriver as ReturnType<typeof connectionManager.getConnection>);

      const handler = getHandler('schema:getAllEnums');
      const result = await handler(null, 'conn-1');

      expect(mockDriver.getAllEnums).toHaveBeenCalled();
      expect(result).toEqual(enums);
    });
  });
});
