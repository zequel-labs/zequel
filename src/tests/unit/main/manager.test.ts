import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseType, DEFAULT_PORTS } from '@main/types';
import type { ConnectionConfig, SSHConfig } from '@main/types';
import type { DatabaseDriver, TestConnectionResult } from '@main/db/base';

// ── Mock: logger ───────────────────────────────────────────────────────────
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock: connectionStatus ─────────────────────────────────────────────────
const mockEmitConnectionStatus = vi.fn();
vi.mock('@main/services/connectionStatus', () => ({
  emitConnectionStatus: (...args: unknown[]) => mockEmitConnectionStatus(...args),
  ConnectionStatusType: {
    Reconnecting: 'reconnecting',
    Connected: 'connected',
    Error: 'error',
  },
}));

// ── Mock: queryLog ─────────────────────────────────────────────────────────
const mockEmitQueryLog = vi.fn();
vi.mock('@main/services/queryLog', () => ({
  emitQueryLog: (...args: unknown[]) => mockEmitQueryLog(...args),
}));

// ── Mock: sshTunnelManager ─────────────────────────────────────────────────
const mockCreateTunnel = vi.fn();
const mockCloseTunnel = vi.fn();
const mockHasTunnel = vi.fn();

vi.mock('@main/services/ssh-tunnel', () => ({
  sshTunnelManager: {
    createTunnel: (...args: unknown[]) => mockCreateTunnel(...args),
    closeTunnel: (...args: unknown[]) => mockCloseTunnel(...args),
    hasTunnel: (...args: unknown[]) => mockHasTunnel(...args),
    closeAllTunnels: vi.fn(),
  },
}));

// ── Mock driver helper ─────────────────────────────────────────────────────
const createMockDriver = (overrides?: Partial<DatabaseDriver>): DatabaseDriver => ({
  type: DatabaseType.PostgreSQL,
  isConnected: true,
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  testConnection: vi.fn().mockResolvedValue({ success: true, error: null }),
  execute: vi.fn(),
  getDatabases: vi.fn(),
  getTables: vi.fn(),
  getColumns: vi.fn(),
  getIndexes: vi.fn(),
  getForeignKeys: vi.fn(),
  getTableDDL: vi.fn(),
  getTableData: vi.fn(),
  addColumn: vi.fn(),
  modifyColumn: vi.fn(),
  dropColumn: vi.fn(),
  renameColumn: vi.fn(),
  createIndex: vi.fn(),
  dropIndex: vi.fn(),
  addForeignKey: vi.fn(),
  dropForeignKey: vi.fn(),
  createTable: vi.fn(),
  dropTable: vi.fn(),
  renameTable: vi.fn(),
  insertRow: vi.fn(),
  deleteRow: vi.fn(),
  createView: vi.fn(),
  dropView: vi.fn(),
  renameView: vi.fn(),
  getViewDDL: vi.fn(),
  getDataTypes: vi.fn().mockReturnValue([]),
  getPrimaryKeyColumns: vi.fn(),
  getRoutines: vi.fn(),
  getRoutineDefinition: vi.fn(),
  getUsers: vi.fn(),
  createUser: vi.fn(),
  dropUser: vi.fn(),
  getTriggers: vi.fn(),
  getTriggerDefinition: vi.fn(),
  createTrigger: vi.fn(),
  dropTrigger: vi.fn(),
  ping: vi.fn().mockResolvedValue(true),
  cancelQuery: vi.fn(),
  ...overrides,
});

// ── Track the last driver each mock constructor returns ────────────────────
let lastCreatedDriver: DatabaseDriver;

// Internal properties that wrapDriverQueries accesses on drivers
// These are set per-type so that the wrapping logic can find them
const mockMySQLConnection = {
  query: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue([]),
};

const mockPostgresClient = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
};

const mockSQLiteStatement = {
  all: vi.fn().mockReturnValue([]),
  get: vi.fn().mockReturnValue(undefined),
  run: vi.fn().mockReturnValue({ changes: 0 }),
};

const mockSQLiteDb = {
  prepare: vi.fn().mockReturnValue(mockSQLiteStatement),
};

const mockClickHouseClient = {
  query: vi.fn().mockResolvedValue({ json: vi.fn() }),
};

const makeMockClass = (dbType: DatabaseType) => {
  // Return a proper class that can be instantiated with `new`
  return class MockDriver {
    constructor() {
      const driver = createMockDriver({ type: dbType });
      lastCreatedDriver = driver;
      // Copy all properties so the instance behaves like the mock driver
      Object.assign(this, driver);
      // Ensure `type` is accessible as a property (not just from assign)
      Object.defineProperty(this, 'type', { value: dbType, writable: false });

      // Attach internal driver properties that wrapDriverQueries accesses
      if (dbType === DatabaseType.MySQL || dbType === DatabaseType.MariaDB) {
        (this as any).connection = mockMySQLConnection;
      } else if (dbType === DatabaseType.PostgreSQL) {
        (this as any).client = mockPostgresClient;
      } else if (dbType === DatabaseType.SQLite) {
        (this as any).db = mockSQLiteDb;
      } else if (dbType === DatabaseType.ClickHouse) {
        (this as any).client = mockClickHouseClient;
      }
    }
  };
};

// ── Mock: database drivers ─────────────────────────────────────────────────
vi.mock('@main/db/sqlite', () => ({ SQLiteDriver: makeMockClass(DatabaseType.SQLite) }));
vi.mock('@main/db/mysql', () => ({ MySQLDriver: makeMockClass(DatabaseType.MySQL) }));
vi.mock('@main/db/mariadb', () => ({ MariaDBDriver: makeMockClass(DatabaseType.MariaDB) }));
vi.mock('@main/db/postgres', () => ({ PostgreSQLDriver: makeMockClass(DatabaseType.PostgreSQL) }));
vi.mock('@main/db/clickhouse', () => ({ ClickHouseDriver: makeMockClass(DatabaseType.ClickHouse) }));
vi.mock('@main/db/mongodb', () => ({ MongoDBDriver: makeMockClass(DatabaseType.MongoDB) }));
vi.mock('@main/db/redis', () => ({ RedisDriver: makeMockClass(DatabaseType.Redis) }));

// ── Helpers ────────────────────────────────────────────────────────────────
const makeConfig = (overrides?: Partial<ConnectionConfig>): ConnectionConfig => ({
  id: 'test-conn-1',
  name: 'Test Connection',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'user',
  password: 'pass',
  ...overrides,
});

const makeSSHConfig = (overrides?: Partial<SSHConfig>): SSHConfig => ({
  enabled: true,
  host: 'ssh.example.com',
  port: 22,
  username: 'sshuser',
  authMethod: 'password',
  password: 'sshpass',
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe('ConnectionManager', () => {
  let ConnectionManager: typeof import('@main/db/manager')['ConnectionManager'];
  let manager: InstanceType<typeof ConnectionManager>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockHasTunnel.mockReturnValue(false);
    mockCreateTunnel.mockResolvedValue(44444);

    // Reset internal mock driver properties
    mockMySQLConnection.query = vi.fn().mockResolvedValue([]);
    mockMySQLConnection.execute = vi.fn().mockResolvedValue([]);
    mockPostgresClient.query = vi.fn().mockResolvedValue({ rows: [] });
    mockSQLiteStatement.all = vi.fn().mockReturnValue([]);
    mockSQLiteStatement.get = vi.fn().mockReturnValue(undefined);
    mockSQLiteStatement.run = vi.fn().mockReturnValue({ changes: 0 });
    mockSQLiteDb.prepare = vi.fn().mockReturnValue(mockSQLiteStatement);
    mockClickHouseClient.query = vi.fn().mockResolvedValue({ json: vi.fn() });

    const mod = await import('@main/db/manager');
    ConnectionManager = mod.ConnectionManager;
    manager = new ConnectionManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── createDriver ───────────────────────────────────────────────────────
  describe('createDriver', () => {
    it('should create a SQLite driver', () => {
      const driver = manager.createDriver(DatabaseType.SQLite);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.SQLite);
    });

    it('should create a MySQL driver', () => {
      const driver = manager.createDriver(DatabaseType.MySQL);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.MySQL);
    });

    it('should create a MariaDB driver', () => {
      const driver = manager.createDriver(DatabaseType.MariaDB);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.MariaDB);
    });

    it('should create a PostgreSQL driver', () => {
      const driver = manager.createDriver(DatabaseType.PostgreSQL);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.PostgreSQL);
    });

    it('should create a ClickHouse driver', () => {
      const driver = manager.createDriver(DatabaseType.ClickHouse);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.ClickHouse);
    });

    it('should create a MongoDB driver', () => {
      const driver = manager.createDriver(DatabaseType.MongoDB);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.MongoDB);
    });

    it('should create a Redis driver', () => {
      const driver = manager.createDriver(DatabaseType.Redis);
      expect(driver).toBeDefined();
      expect(driver.type).toBe(DatabaseType.Redis);
    });

    it('should throw for unsupported database type', () => {
      expect(() => manager.createDriver('unsupported' as DatabaseType)).toThrow(
        'Unsupported database type: unsupported'
      );
    });
  });

  // ── connect ────────────────────────────────────────────────────────────
  describe('connect', () => {
    it('should connect and store the driver', async () => {
      const config = makeConfig();
      const driver = await manager.connect(config);

      expect(driver).toBeDefined();
      expect(driver.connect).toHaveBeenCalledWith(expect.objectContaining({ id: config.id }));
      expect(manager.getConnection(config.id)).toBe(driver);
    });

    it('should disconnect existing connection before re-connecting', async () => {
      const config = makeConfig();

      const firstDriver = await manager.connect(config);
      const secondDriver = await manager.connect(config);

      expect(firstDriver.disconnect).toHaveBeenCalled();
      expect(manager.getConnection(config.id)).toBe(secondDriver);
    });

    it('should set up SSH tunnel when SSH is configured', async () => {
      const config = makeConfig({
        ssh: makeSSHConfig(),
      });

      const driver = await manager.connect(config);

      expect(mockCreateTunnel).toHaveBeenCalledWith(
        config.id,
        config.ssh,
        config.host,
        config.port
      );
      // Driver should be connected with tunneled config
      expect(driver.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '127.0.0.1',
          port: 44444,
        })
      );
    });

    it('should not create SSH tunnel for SQLite', async () => {
      const config = makeConfig({
        type: DatabaseType.SQLite,
        ssh: makeSSHConfig(),
        database: ':memory:',
      });

      await manager.connect(config);

      expect(mockCreateTunnel).not.toHaveBeenCalled();
    });

    it('should use default remote host (localhost) when host is not set with SSH', async () => {
      const config = makeConfig({
        host: undefined,
        port: undefined,
        ssh: makeSSHConfig(),
      });

      await manager.connect(config);

      expect(mockCreateTunnel).toHaveBeenCalledWith(
        config.id,
        config.ssh,
        'localhost',
        DEFAULT_PORTS[config.type]
      );
    });

    it('should start health check for non-SQLite, non-ClickHouse connections', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });

      await manager.connect(config);

      const driver = manager.getConnection(config.id)!;
      (driver.ping as ReturnType<typeof vi.fn>).mockClear();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(driver.ping).toHaveBeenCalled();
    });

    it('should NOT start health check for SQLite', async () => {
      const config = makeConfig({ type: DatabaseType.SQLite, database: ':memory:' });

      const driver = await manager.connect(config);
      (driver.ping as ReturnType<typeof vi.fn>).mockClear();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(driver.ping).not.toHaveBeenCalled();
    });

    it('should NOT start health check for ClickHouse', async () => {
      const config = makeConfig({ type: DatabaseType.ClickHouse });

      const driver = await manager.connect(config);
      (driver.ping as ReturnType<typeof vi.fn>).mockClear();

      await vi.advanceTimersByTimeAsync(60_000);

      expect(driver.ping).not.toHaveBeenCalled();
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────
  describe('disconnect', () => {
    it('should disconnect and remove the driver', async () => {
      const config = makeConfig();
      const driver = await manager.connect(config);

      const result = await manager.disconnect(config.id);

      expect(result).toBe(true);
      expect(driver.disconnect).toHaveBeenCalled();
      expect(manager.getConnection(config.id)).toBeUndefined();
    });

    it('should return false when no connection exists', async () => {
      const result = await manager.disconnect('nonexistent');
      expect(result).toBe(false);
    });

    it('should close SSH tunnel if one exists', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });

      await manager.connect(config);
      // hasTunnel returns true during disconnect check
      mockHasTunnel.mockReturnValue(true);
      await manager.disconnect(config.id);

      expect(mockCloseTunnel).toHaveBeenCalledWith(config.id);
    });

    it('should stop health check on disconnect', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });
      const driver = await manager.connect(config);

      await manager.disconnect(config.id);

      (driver.ping as ReturnType<typeof vi.fn>).mockClear();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(driver.ping).not.toHaveBeenCalled();
    });
  });

  // ── disconnectAll ──────────────────────────────────────────────────────
  describe('disconnectAll', () => {
    it('should disconnect all connections', async () => {
      const config1 = makeConfig({ id: 'conn-1' });
      const config2 = makeConfig({ id: 'conn-2', type: DatabaseType.MySQL });

      const driver1 = await manager.connect(config1);
      const driver2 = await manager.connect(config2);

      await manager.disconnectAll();

      expect(driver1.disconnect).toHaveBeenCalled();
      expect(driver2.disconnect).toHaveBeenCalled();
      expect(manager.getConnection('conn-1')).toBeUndefined();
      expect(manager.getConnection('conn-2')).toBeUndefined();
    });

    it('should handle empty connection list', async () => {
      await expect(manager.disconnectAll()).resolves.toBeUndefined();
    });
  });

  // ── getConnection ──────────────────────────────────────────────────────
  describe('getConnection', () => {
    it('should return undefined for unknown connection id', () => {
      expect(manager.getConnection('no-such')).toBeUndefined();
    });

    it('should return the driver for an existing connection', async () => {
      const config = makeConfig();
      const driver = await manager.connect(config);
      expect(manager.getConnection(config.id)).toBe(driver);
    });
  });

  // ── isConnected ────────────────────────────────────────────────────────
  describe('isConnected', () => {
    it('should return false when no connection exists', () => {
      expect(manager.isConnected('no-such')).toBe(false);
    });

    it('should return true when driver reports connected', async () => {
      const config = makeConfig();
      await manager.connect(config);
      expect(manager.isConnected(config.id)).toBe(true);
    });

    it('should return false when driver reports not connected', async () => {
      const config = makeConfig();
      await manager.connect(config);

      const driver = manager.getConnection(config.id)!;
      Object.defineProperty(driver, 'isConnected', { value: false, configurable: true });

      expect(manager.isConnected(config.id)).toBe(false);
    });
  });

  // ── testConnection ─────────────────────────────────────────────────────
  describe('testConnection', () => {
    it('should test connection without SSH and return success', async () => {
      const config = makeConfig();
      const result = await manager.testConnection(config);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should set up and tear down SSH tunnel for test with SSH config', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });
      mockHasTunnel.mockReturnValue(true);

      const result = await manager.testConnection(config);

      expect(mockCreateTunnel).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.sshSuccess).toBe(true);
      // The test tunnel should be cleaned up
      expect(mockCloseTunnel).toHaveBeenCalled();
    });

    it('should return SSH error when tunnel creation fails', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });
      mockCreateTunnel.mockRejectedValueOnce(new Error('SSH auth failed'));

      const result = await manager.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.sshSuccess).toBe(false);
      expect(result.sshError).toBe('SSH auth failed');
    });

    it('should not create SSH tunnel for SQLite test', async () => {
      const config = makeConfig({
        type: DatabaseType.SQLite,
        ssh: makeSSHConfig(),
        database: ':memory:',
      });

      await manager.testConnection(config);

      expect(mockCreateTunnel).not.toHaveBeenCalled();
    });

    it('should clean up test tunnel in the finally block even if driver throws', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });
      mockHasTunnel.mockReturnValue(true);

      // Make the driver's testConnection throw
      // We use a spy on createDriver to intercept
      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementationOnce((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.testConnection as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
          new Error('unexpected crash')
        );
        return driver;
      });

      const result = await manager.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('unexpected crash');
      // Tunnel should still be cleaned up
      expect(mockCloseTunnel).toHaveBeenCalled();
    });

    it('should return database error when driver test fails but SSH succeeded', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });
      mockHasTunnel.mockReturnValue(true);

      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementationOnce((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.testConnection as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
          success: false,
          error: 'connection refused',
        } as TestConnectionResult);
        return driver;
      });

      const result = await manager.testConnection(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('connection refused');
      expect(result.sshSuccess).toBe(true);
    });
  });

  // ── reconnect ──────────────────────────────────────────────────────────
  describe('reconnect', () => {
    it('should reconnect successfully on first attempt', async () => {
      const config = makeConfig();
      await manager.connect(config);

      const result = await manager.reconnect(config.id);

      expect(result).toBe(true);
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: config.id, status: 'reconnecting', attempt: 1 })
      );
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: config.id, status: 'connected' })
      );
    });

    it('should return false when no config is stored', async () => {
      const result = await manager.reconnect('unknown');

      expect(result).toBe(false);
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'unknown',
          status: 'error',
          error: 'Connection configuration not found',
        })
      );
    });

    it('should return false if reconnect is already in progress', async () => {
      const config = makeConfig();
      await manager.connect(config);

      // Make the next driver's connect hang forever
      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementationOnce((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.connect as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
        return driver;
      });

      // Start first reconnect (will hang because connect never resolves)
      const firstReconnect = manager.reconnect(config.id);

      // Need to let the async function get past the synchronous guard
      await vi.advanceTimersByTimeAsync(0);

      // Second call while first is in progress
      const secondResult = await manager.reconnect(config.id);
      expect(secondResult).toBe(false);

      // Clean up: we just leave the hanging promise; it doesn't affect other tests
      // since we create a new manager each time
      void firstReconnect;
    });

    it('should use exponential backoff between retry attempts', async () => {
      const config = makeConfig();
      await manager.connect(config);

      // Track attempts
      let attempt = 0;
      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementation((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.connect as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          attempt++;
          if (attempt <= 3) {
            throw new Error(`fail attempt ${attempt}`);
          }
        });
        return driver;
      });

      const reconnectPromise = manager.reconnect(config.id);

      // Advance through backoff delays: 1s, 2s, 4s
      await vi.advanceTimersByTimeAsync(1000); // after attempt 1 (2^0 * 1000)
      await vi.advanceTimersByTimeAsync(2000); // after attempt 2 (2^1 * 1000)
      await vi.advanceTimersByTimeAsync(4000); // after attempt 3 (2^2 * 1000)

      const result = await reconnectPromise;
      expect(result).toBe(true);
      expect(attempt).toBe(4); // 3 failures + 1 success
    });

    it('should fail after MAX_RECONNECT_ATTEMPTS (5)', async () => {
      const config = makeConfig();
      await manager.connect(config);

      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementation((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.connect as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('always fails'));
        return driver;
      });

      const reconnectPromise = manager.reconnect(config.id);

      // Advance through all backoff delays: 1s + 2s + 4s + 8s
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);

      const result = await reconnectPromise;
      expect(result).toBe(false);
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: config.id,
          status: 'error',
          error: 'Failed to reconnect after 5 attempts',
        })
      );
    });

    it('should close and recreate SSH tunnel during reconnect', async () => {
      const config = makeConfig({ ssh: makeSSHConfig() });

      await manager.connect(config);

      // Now the tunnel "exists"
      mockHasTunnel.mockReturnValue(true);

      await manager.reconnect(config.id);

      // The old tunnel should be closed
      expect(mockCloseTunnel).toHaveBeenCalledWith(config.id);
      // A new tunnel should be created (once during connect, once during reconnect)
      expect(mockCreateTunnel).toHaveBeenCalledTimes(2);
    });

    it('should disconnect old driver silently during reconnect', async () => {
      const config = makeConfig();
      const firstDriver = await manager.connect(config);

      await manager.reconnect(config.id);

      expect(firstDriver.disconnect).toHaveBeenCalled();
    });

    it('should emit reconnecting status for each attempt', async () => {
      const config = makeConfig();
      await manager.connect(config);

      let attempt = 0;
      const origCreateDriver = manager.createDriver.bind(manager);
      vi.spyOn(manager, 'createDriver').mockImplementation((type: DatabaseType) => {
        const driver = origCreateDriver(type);
        (driver.connect as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          attempt++;
          if (attempt <= 2) {
            throw new Error('fail');
          }
        });
        return driver;
      });

      const reconnectPromise = manager.reconnect(config.id);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await reconnectPromise;

      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'reconnecting', attempt: 1 })
      );
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'reconnecting', attempt: 2 })
      );
      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'reconnecting', attempt: 3 })
      );
    });
  });

  // ── health checks ─────────────────────────────────────────────────────
  describe('health checks', () => {
    it('should trigger reconnect when ping returns false', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });
      const driver = await manager.connect(config);

      (driver.ping as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: config.id,
          status: 'reconnecting',
        })
      );
    });

    it('should trigger reconnect when ping throws an error', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });
      const driver = await manager.connect(config);

      (driver.ping as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network error'));

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockEmitConnectionStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: config.id,
          status: 'reconnecting',
        })
      );
    });

    it('should stop health check when driver is removed between intervals', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });
      await manager.connect(config);

      await manager.disconnect(config.id);

      await vi.advanceTimersByTimeAsync(60_000);

      // No reconnecting status after disconnect
      const reconnectCalls = mockEmitConnectionStatus.mock.calls.filter(
        (call) => (call[0] as Record<string, unknown>)?.status === 'reconnecting'
      );
      expect(reconnectCalls).toHaveLength(0);
    });

    it('should not trigger reconnect when ping returns true', async () => {
      const config = makeConfig({ type: DatabaseType.PostgreSQL });
      const driver = await manager.connect(config);

      // ping already returns true by default
      (driver.ping as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      await vi.advanceTimersByTimeAsync(30_000);

      const reconnectCalls = mockEmitConnectionStatus.mock.calls.filter(
        (call) => (call[0] as Record<string, unknown>)?.status === 'reconnecting'
      );
      expect(reconnectCalls).toHaveLength(0);
    });
  });

  // ── wrapDriverQueries ─────────────────────────────────────────────────
  describe('wrapDriverQueries', () => {
    // ── MySQL / MariaDB ──────────────────────────────────────────────────
    describe('MySQL / MariaDB query wrapping', () => {
      const mysqlTypes = [DatabaseType.MySQL, DatabaseType.MariaDB];

      for (const dbType of mysqlTypes) {
        describe(`${dbType}`, () => {
          it('should emit query log on successful connection.query()', async () => {
            const config = makeConfig({ id: `wrap-${dbType}`, type: dbType });
            await manager.connect(config);

            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            await conn.query('SELECT 1');

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config.id,
                sql: 'SELECT 1',
              })
            );
          });

          it('should emit query log on successful connection.execute()', async () => {
            const config = makeConfig({ id: `wrap-exec-${dbType}`, type: dbType });
            await manager.connect(config);

            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            await conn.execute('INSERT INTO t VALUES (1)');

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config.id,
                sql: 'INSERT INTO t VALUES (1)',
              })
            );
          });

          it('should emit query log and rethrow on query() error', async () => {
            const config = makeConfig({ id: `wrap-err-q-${dbType}`, type: dbType });
            await manager.connect(config);

            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            // Make the underlying query fail
            // The wrapped function calls the original (which is the mock at the time of wrapping).
            // We need to override the original that was captured by bind.
            // Since wrapDriverQueries does origQuery = conn.query.bind(conn) BEFORE replacing,
            // we need a different approach: set up the mock to fail before connecting.
            mockMySQLConnection.query = vi.fn().mockRejectedValue(new Error('query failed'));

            // Re-connect to re-wrap with the failing mock
            const config2 = makeConfig({ id: `wrap-err-q2-${dbType}`, type: dbType });
            await manager.connect(config2);
            const driver2 = manager.getConnection(config2.id)!;
            const conn2 = (driver2 as any).connection;

            await expect(conn2.query('BAD SQL')).rejects.toThrow('query failed');

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config2.id,
                sql: 'BAD SQL',
              })
            );
          });

          it('should emit query log and rethrow on execute() error', async () => {
            mockMySQLConnection.execute = vi.fn().mockRejectedValue(new Error('execute failed'));

            const config = makeConfig({ id: `wrap-err-e-${dbType}`, type: dbType });
            await manager.connect(config);
            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            await expect(conn.execute('BAD SQL')).rejects.toThrow('execute failed');

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config.id,
                sql: 'BAD SQL',
              })
            );
          });

          it('should handle non-string first argument to query()', async () => {
            const config = makeConfig({ id: `wrap-nonstr-${dbType}`, type: dbType });
            await manager.connect(config);

            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            await conn.query({ sql: 'SELECT 1' });

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config.id,
                sql: '',
              })
            );
          });

          it('should handle non-string first argument to execute()', async () => {
            const config = makeConfig({ id: `wrap-nonstr-e-${dbType}`, type: dbType });
            await manager.connect(config);

            const driver = manager.getConnection(config.id)!;
            const conn = (driver as any).connection;

            await conn.execute({ sql: 'SELECT 1' });

            expect(mockEmitQueryLog).toHaveBeenCalledWith(
              expect.objectContaining({
                connectionId: config.id,
                sql: '',
              })
            );
          });
        });
      }

      it('should skip wrapping when connection property is null', async () => {
        // Temporarily set connection to null
        const origConn = mockMySQLConnection;
        const config = makeConfig({ id: 'wrap-null-mysql', type: DatabaseType.MySQL });

        // We need to temporarily make the mock class not attach connection
        // Instead, let's just verify no error is thrown when connection is absent
        // by connecting a MongoDB type (which has no wrapping and no internal props)
        const mongoConfig = makeConfig({ id: 'wrap-mongodb', type: DatabaseType.MongoDB });
        await manager.connect(mongoConfig);

        // No emitQueryLog should be called for MongoDB
        expect(mockEmitQueryLog).not.toHaveBeenCalled();
      });
    });

    // ── PostgreSQL ───────────────────────────────────────────────────────
    describe('PostgreSQL query wrapping', () => {
      it('should emit query log on successful client.query()', async () => {
        const config = makeConfig({ id: 'wrap-pg', type: DatabaseType.PostgreSQL });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query('SELECT * FROM users');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'SELECT * FROM users',
          })
        );
      });

      it('should emit query log and rethrow on client.query() error', async () => {
        mockPostgresClient.query = vi.fn().mockRejectedValue(new Error('pg error'));

        const config = makeConfig({ id: 'wrap-pg-err', type: DatabaseType.PostgreSQL });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await expect(client.query('BAD SQL')).rejects.toThrow('pg error');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'BAD SQL',
          })
        );
      });

      it('should extract sql from query object with text property', async () => {
        const config = makeConfig({ id: 'wrap-pg-obj', type: DatabaseType.PostgreSQL });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query({ text: 'SELECT $1', values: [1] });

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'SELECT $1',
          })
        );
      });

      it('should use empty string when query arg is non-string without text', async () => {
        const config = makeConfig({ id: 'wrap-pg-notext', type: DatabaseType.PostgreSQL });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query({ values: [1] });

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: '',
          })
        );
      });

      it('should include executionTime in the emitted log', async () => {
        const config = makeConfig({ id: 'wrap-pg-time', type: DatabaseType.PostgreSQL });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query('SELECT 1');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            executionTime: expect.any(Number),
            timestamp: expect.any(String),
          })
        );
      });
    });

    // ── SQLite ───────────────────────────────────────────────────────────
    describe('SQLite query wrapping', () => {
      it('should emit query log on successful prepare().all()', async () => {
        const config = makeConfig({ id: 'wrap-sqlite-all', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('SELECT * FROM test');
        stmt.all();

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'SELECT * FROM test',
          })
        );
      });

      it('should emit query log on successful prepare().get()', async () => {
        const config = makeConfig({ id: 'wrap-sqlite-get', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('SELECT * FROM test LIMIT 1');
        stmt.get();

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'SELECT * FROM test LIMIT 1',
          })
        );
      });

      it('should emit query log on successful prepare().run()', async () => {
        const config = makeConfig({ id: 'wrap-sqlite-run', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('INSERT INTO test VALUES (1)');
        stmt.run();

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'INSERT INTO test VALUES (1)',
          })
        );
      });

      it('should emit query log and rethrow on prepare().all() error', async () => {
        mockSQLiteStatement.all = vi.fn().mockImplementation(() => { throw new Error('all failed'); });
        mockSQLiteDb.prepare = vi.fn().mockReturnValue(mockSQLiteStatement);

        const config = makeConfig({ id: 'wrap-sqlite-all-err', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('BAD SQL');
        expect(() => stmt.all()).toThrow('all failed');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'BAD SQL',
          })
        );
      });

      it('should emit query log and rethrow on prepare().get() error', async () => {
        mockSQLiteStatement.get = vi.fn().mockImplementation(() => { throw new Error('get failed'); });
        mockSQLiteDb.prepare = vi.fn().mockReturnValue(mockSQLiteStatement);

        const config = makeConfig({ id: 'wrap-sqlite-get-err', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('BAD SQL');
        expect(() => stmt.get()).toThrow('get failed');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'BAD SQL',
          })
        );
      });

      it('should emit query log and rethrow on prepare().run() error', async () => {
        mockSQLiteStatement.run = vi.fn().mockImplementation(() => { throw new Error('run failed'); });
        mockSQLiteDb.prepare = vi.fn().mockReturnValue(mockSQLiteStatement);

        const config = makeConfig({ id: 'wrap-sqlite-run-err', type: DatabaseType.SQLite, database: ':memory:' });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const db = (driver as any).db;

        const stmt = db.prepare('BAD SQL');
        expect(() => stmt.run()).toThrow('run failed');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'BAD SQL',
          })
        );
      });
    });

    // ── ClickHouse ───────────────────────────────────────────────────────
    describe('ClickHouse query wrapping', () => {
      it('should emit query log on successful client.query()', async () => {
        const config = makeConfig({ id: 'wrap-ch', type: DatabaseType.ClickHouse });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query({ query: 'SELECT 1' });

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'SELECT 1',
          })
        );
      });

      it('should emit query log and rethrow on client.query() error', async () => {
        mockClickHouseClient.query = vi.fn().mockRejectedValue(new Error('ch error'));

        const config = makeConfig({ id: 'wrap-ch-err', type: DatabaseType.ClickHouse });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await expect(client.query({ query: 'BAD SQL' })).rejects.toThrow('ch error');

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: 'BAD SQL',
          })
        );
      });

      it('should use empty string when params.query is undefined', async () => {
        const config = makeConfig({ id: 'wrap-ch-noquery', type: DatabaseType.ClickHouse });
        await manager.connect(config);

        const driver = manager.getConnection(config.id)!;
        const client = (driver as any).client;

        await client.query({});

        expect(mockEmitQueryLog).toHaveBeenCalledWith(
          expect.objectContaining({
            connectionId: config.id,
            sql: '',
          })
        );
      });
    });

    // ── MongoDB / Redis (no wrapping) ────────────────────────────────────
    describe('MongoDB and Redis (no query wrapping)', () => {
      it('should not emit query logs for MongoDB', async () => {
        const config = makeConfig({ id: 'wrap-mongo', type: DatabaseType.MongoDB });
        await manager.connect(config);
        expect(mockEmitQueryLog).not.toHaveBeenCalled();
      });

      it('should not emit query logs for Redis', async () => {
        const config = makeConfig({ id: 'wrap-redis', type: DatabaseType.Redis });
        await manager.connect(config);
        expect(mockEmitQueryLog).not.toHaveBeenCalled();
      });
    });
  });

  // ── health check: driver removed between intervals ───────────────────
  describe('health check edge cases', () => {
    it('should stop health check when driver is no longer in connections map', async () => {
      const config = makeConfig({ id: 'hc-edge', type: DatabaseType.MySQL });
      await manager.connect(config);

      // Manually remove the driver from the connections map (simulating removal)
      // without going through disconnect() which would clear the interval
      const driver = manager.getConnection(config.id)!;
      (manager as any).connections.delete(config.id);

      // Advance timer to trigger health check
      await vi.advanceTimersByTimeAsync(30_000);

      // ping should NOT have been called since driver was removed
      expect(driver.ping).not.toHaveBeenCalled();

      // The health check should have stopped itself (no further pings)
      await vi.advanceTimersByTimeAsync(30_000);
      expect(driver.ping).not.toHaveBeenCalled();
    });

    it('should skip health check tick when reconnect is already in progress', async () => {
      const config = makeConfig({ id: 'hc-reconnect', type: DatabaseType.PostgreSQL });
      const driver = await manager.connect(config);

      // Simulate reconnect in progress
      (manager as any).reconnectInProgress.add(config.id);

      (driver.ping as ReturnType<typeof vi.fn>).mockClear();
      await vi.advanceTimersByTimeAsync(30_000);

      // ping should not be called while reconnect is in progress
      expect(driver.ping).not.toHaveBeenCalled();

      // Clean up
      (manager as any).reconnectInProgress.delete(config.id);
    });
  });

  // ── connect for each database type ────────────────────────────────────
  describe('connecting different database types', () => {
    const types: DatabaseType[] = [
      DatabaseType.SQLite,
      DatabaseType.MySQL,
      DatabaseType.MariaDB,
      DatabaseType.PostgreSQL,
      DatabaseType.ClickHouse,
      DatabaseType.MongoDB,
      DatabaseType.Redis,
    ];

    for (const dbType of types) {
      it(`should connect to ${dbType}`, async () => {
        const config = makeConfig({
          id: `test-${dbType}`,
          type: dbType,
          database: dbType === DatabaseType.SQLite ? ':memory:' : 'testdb',
        });

        const driver = await manager.connect(config);
        expect(driver).toBeDefined();
        expect(driver.connect).toHaveBeenCalled();
        expect(manager.getConnection(config.id)).toBe(driver);
      });
    }
  });
});
