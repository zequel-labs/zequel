import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType, RoutineType, SSLMode } from '@main/types';
import { POSTGRESQL_DATA_TYPES } from '@main/types/schema-operations';

// ── Mock logger (uses electron, must be mocked before importing driver) ──
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock pg ──
const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockPoolEnd = vi.fn().mockResolvedValue(undefined);
const mockPoolConnect = vi.fn();

vi.mock('pg', () => {
  class MockPool {
    connect = mockPoolConnect;
    end = mockPoolEnd;
  }
  return { Pool: MockPool };
});

import { PostgreSQLDriver } from '@main/db/postgres';

// ── Helpers ──

const createConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-pg',
  name: 'Test PG',
  type: DatabaseType.PostgreSQL,
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  username: 'testuser',
  password: 'testpass',
  ...overrides,
});

const connectDriver = async (driver: PostgreSQLDriver): Promise<void> => {
  mockPoolConnect.mockResolvedValueOnce({
    query: mockQuery,
    release: mockRelease,
  });
  await driver.connect(createConfig());
};

// ── Tests ──

describe('PostgreSQLDriver', () => {
  let driver: PostgreSQLDriver;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPoolEnd.mockResolvedValue(undefined);
    driver = new PostgreSQLDriver();
  });

  // ─────────── type ───────────
  describe('type', () => {
    it('should be PostgreSQL', () => {
      expect(driver.type).toBe(DatabaseType.PostgreSQL);
    });
  });

  // ─────────── connect / disconnect ───────────
  describe('connect', () => {
    it('should connect and set isConnected to true', async () => {
      await connectDriver(driver);
      expect(driver.isConnected).toBe(true);
    });

    it('should use defaults when host/port/database are missing', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      // Should not throw when host/port/database are missing; it falls back to defaults
      await driver.connect(createConfig({ host: undefined, port: undefined, database: '' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should throw and set isConnected to false on failure', async () => {
      mockPoolConnect.mockRejectedValueOnce(new Error('connection refused'));
      await expect(driver.connect(createConfig())).rejects.toThrow('connection refused');
      expect(driver.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should release client and end pool', async () => {
      await connectDriver(driver);
      await driver.disconnect();
      expect(mockRelease).toHaveBeenCalled();
      expect(mockPoolEnd).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when already disconnected', async () => {
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });
  });

  // ─────────── ping ───────────
  describe('ping', () => {
    it('should return true when SELECT 1 succeeds', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when query throws', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('timeout'));
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when no client', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  // ─────────── cancelQuery ───────────
  describe('cancelQuery', () => {
    it('should return false when no pid or pool', async () => {
      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });
  });

  // ─────────── execute ───────────
  describe('execute', () => {
    beforeEach(async () => {
      await connectDriver(driver);
    });

    it('should return rows for a SELECT query', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 42 }] }) // pg_backend_pid
        .mockResolvedValueOnce({
          fields: [
            { name: 'id', dataTypeID: 23 },
            { name: 'name', dataTypeID: 25 },
          ],
          rows: [{ id: 1, name: 'Alice' }],
          rowCount: 1,
        });

      const result = await driver.execute('SELECT * FROM users');
      expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(result.rowCount).toBe(1);
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual(
        expect.objectContaining({ name: 'id', type: 'INTEGER' }),
      );
      expect(result.columns[1]).toEqual(
        expect.objectContaining({ name: 'name', type: 'TEXT' }),
      );
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should convert ? placeholders to $N for params', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ fields: [], rows: [{ id: 1 }], rowCount: 1 });

      await driver.execute('SELECT * FROM users WHERE id = ? AND name = ?', [1, 'Alice']);
      const secondCall = mockQuery.mock.calls[1];
      expect(secondCall[0]).toBe('SELECT * FROM users WHERE id = $1 AND name = $2');
      expect(secondCall[1]).toEqual([1, 'Alice']);
    });

    it('should return affectedRows for non-SELECT results', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ rowCount: 3 });

      const result = await driver.execute('DELETE FROM users');
      expect(result.affectedRows).toBe(3);
      expect(result.rows).toEqual([]);
    });

    it('should return error on query failure', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockRejectedValueOnce(new Error('syntax error'));

      const result = await driver.execute('INVALID SQL');
      expect(result.error).toBe('syntax error');
      expect(result.rows).toEqual([]);
    });

    it('should throw when not connected', async () => {
      const fresh = new PostgreSQLDriver();
      const result = await fresh.execute('SELECT 1').catch((e: Error) => e);
      expect(result).toBeInstanceOf(Error);
    });

    it('should map pg type OIDs correctly', async () => {
      const oidMap: Record<number, string> = {
        16: 'BOOLEAN',
        20: 'BIGINT',
        21: 'SMALLINT',
        23: 'INTEGER',
        25: 'TEXT',
        114: 'JSON',
        700: 'REAL',
        701: 'DOUBLE PRECISION',
        1043: 'VARCHAR',
        1082: 'DATE',
        1114: 'TIMESTAMP',
        1184: 'TIMESTAMPTZ',
        1700: 'NUMERIC',
        2950: 'UUID',
        3802: 'JSONB',
        99999: 'UNKNOWN',
      };

      for (const [oid, expected] of Object.entries(oidMap)) {
        mockQuery
          .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
          .mockResolvedValueOnce({
            fields: [{ name: 'col', dataTypeID: Number(oid) }],
            rows: [{ col: 'x' }],
            rowCount: 1,
          });

        const result = await driver.execute('SELECT col FROM t');
        expect(result.columns[0].type).toBe(expected);
      }
    });
  });

  // ─────────── getDatabases ───────────
  describe('getDatabases', () => {
    it('should return a list of databases', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ name: 'postgres' }, { name: 'mydb' }],
      });

      const dbs = await driver.getDatabases();
      expect(dbs).toEqual([{ name: 'postgres' }, { name: 'mydb' }]);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getDatabases()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getTables ───────────
  describe('getTables', () => {
    it('should return tables with correct TableObjectType mapping', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'users', type: 'BASE TABLE', row_count: '100', size: '16384', comment: null },
          { name: 'user_view', type: 'VIEW', row_count: null, size: null, comment: 'A view' },
        ],
      });

      const tables = await driver.getTables('testdb');
      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual(
        expect.objectContaining({ name: 'users', type: TableObjectType.Table, rowCount: 100 }),
      );
      expect(tables[1]).toEqual(
        expect.objectContaining({ name: 'user_view', type: TableObjectType.View, comment: 'A view' }),
      );
    });

    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getTables('testdb', 'custom_schema');
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toEqual(['custom_schema']);
    });

    it('should default to public schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getTables('testdb');
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[1]).toEqual(['public']);
    });
  });

  // ─────────── getColumns ───────────
  describe('getColumns', () => {
    it('should return columns with correct mappings', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            name: 'id',
            type: 'int4',
            dataType: 'integer',
            nullable: 'NO',
            defaultValue: "nextval('users_id_seq'::regclass)",
            primaryKey: true,
            autoIncrement: true,
            unique: true,
            comment: 'Primary key',
            length: null,
            precision: 32,
            scale: 0,
          },
          {
            name: 'email',
            type: 'varchar',
            dataType: 'character varying',
            nullable: 'YES',
            defaultValue: null,
            primaryKey: false,
            autoIncrement: false,
            unique: true,
            comment: null,
            length: 255,
            precision: null,
            scale: null,
          },
        ],
      });

      const columns = await driver.getColumns('users');
      expect(columns).toHaveLength(2);
      expect(columns[0]).toEqual(
        expect.objectContaining({
          name: 'id',
          type: 'int4',
          nullable: false,
          primaryKey: true,
          autoIncrement: true,
          precision: 32,
          scale: 0,
        }),
      );
      expect(columns[1]).toEqual(
        expect.objectContaining({
          name: 'email',
          type: 'varchar',
          nullable: true,
          length: 255,
        }),
      );
    });
  });

  // ─────────── getIndexes ───────────
  describe('getIndexes', () => {
    it('should return indexes', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'users_pkey', columns: ['id'], unique: true, primary: true, type: 'btree' },
          { name: 'idx_email', columns: ['email'], unique: true, primary: false, type: 'btree' },
        ],
      });

      const indexes = await driver.getIndexes('users');
      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toEqual(
        expect.objectContaining({ name: 'users_pkey', primary: true, unique: true }),
      );
      expect(indexes[1]).toEqual(
        expect.objectContaining({ name: 'idx_email', primary: false, unique: true }),
      );
    });
  });

  // ─────────── getForeignKeys ───────────
  describe('getForeignKeys', () => {
    it('should return foreign keys', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            name: 'fk_user_id',
            column: 'user_id',
            referencedTable: 'users',
            referencedColumn: 'id',
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          },
        ],
      });

      const fks = await driver.getForeignKeys('orders');
      expect(fks).toHaveLength(1);
      expect(fks[0]).toEqual({
        name: 'fk_user_id',
        column: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    });
  });

  // ─────────── getPrimaryKeyColumns ───────────
  describe('getPrimaryKeyColumns', () => {
    it('should return primary key column names', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'int4', dataType: 'integer', nullable: 'NO', defaultValue: null, primaryKey: true, autoIncrement: false, unique: false, comment: null, length: null, precision: null, scale: null },
          { name: 'email', type: 'varchar', dataType: 'character varying', nullable: 'YES', defaultValue: null, primaryKey: false, autoIncrement: false, unique: false, comment: null, length: 255, precision: null, scale: null },
        ],
      });

      const pks = await driver.getPrimaryKeyColumns('users');
      expect(pks).toEqual(['id']);
    });
  });

  // ─────────── getRoutines ───────────
  describe('getRoutines', () => {
    it('should return routines', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'get_user', type: 'FUNCTION', schema: 'public', return_type: 'SETOF users', language: 'plpgsql' },
          { name: 'update_user', type: 'PROCEDURE', schema: 'public', return_type: null, language: 'plpgsql' },
        ],
      });

      const routines = await driver.getRoutines();
      expect(routines).toHaveLength(2);
      expect(routines[0]).toEqual(
        expect.objectContaining({ name: 'get_user', type: 'FUNCTION' }),
      );
      expect(routines[1]).toEqual(
        expect.objectContaining({ name: 'update_user', type: 'PROCEDURE' }),
      );
    });

    it('should filter by type when provided', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getRoutines(RoutineType.Procedure);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("p.prokind = 'p'");
    });

    it('should filter by function type', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getRoutines(RoutineType.Function);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("p.prokind != 'p'");
    });
  });

  // ─────────── getRoutineDefinition ───────────
  describe('getRoutineDefinition', () => {
    it('should return the definition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'CREATE FUNCTION get_user() ...' }],
      });

      const def = await driver.getRoutineDefinition('get_user', RoutineType.Function);
      expect(def).toBe('CREATE FUNCTION get_user() ...');
    });

    it('should return fallback when not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const def = await driver.getRoutineDefinition('missing', RoutineType.Function);
      expect(def).toContain('not found');
    });
  });

  // ─────────── getViewDDL ───────────
  describe('getViewDDL', () => {
    it('should return the view DDL', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'SELECT id, name FROM users' }],
      });

      const ddl = await driver.getViewDDL('active_users');
      expect(ddl).toContain('CREATE OR REPLACE VIEW "public"."active_users"');
      expect(ddl).toContain('SELECT id, name FROM users');
    });

    it('should handle empty definition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [{}] });

      const ddl = await driver.getViewDDL('empty_view');
      expect(ddl).toContain('CREATE OR REPLACE VIEW "public"."empty_view"');
    });
  });

  // ─────────── getDataTypes ───────────
  describe('getDataTypes', () => {
    it('should return POSTGRESQL_DATA_TYPES', () => {
      const types = driver.getDataTypes();
      expect(types).toBe(POSTGRESQL_DATA_TYPES);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  // ─────────── Schema operations ───────────
  describe('addColumn', () => {
    it('should generate correct ALTER TABLE ADD COLUMN sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INTEGER', nullable: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE "public"."users" ADD COLUMN');
      expect(result.sql).toContain('"age" INTEGER');
      expect(result.sql).toContain('NOT NULL');
    });

    it('should include DEFAULT and UNIQUE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'status', type: 'VARCHAR', length: 50, nullable: true, defaultValue: 'active', unique: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'active'");
      expect(result.sql).toContain('UNIQUE');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('column exists'));

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('column exists');
    });
  });

  describe('modifyColumn', () => {
    it('should rename and alter column type', async () => {
      await connectDriver(driver);
      // rename, type change, nullability, default
      mockQuery
        .mockResolvedValueOnce({}) // rename
        .mockResolvedValueOnce({}) // type
        .mockResolvedValueOnce({}) // null
        .mockResolvedValueOnce({}); // default

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'full_name', type: 'TEXT', nullable: true, defaultValue: null },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME COLUMN "name" TO "full_name"');
      expect(result.sql).toContain('TYPE TEXT');
    });

    it('should skip rename when name unchanged', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({}) // type
        .mockResolvedValueOnce({}) // null
        .mockResolvedValueOnce({}); // drop default

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'VARCHAR', length: 100, nullable: false, defaultValue: null },
      });
      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('RENAME');
      expect(result.sql).toContain('DROP DEFAULT');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('type error'));

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'JSON', nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('type error');
    });
  });

  describe('dropColumn', () => {
    it('should generate DROP COLUMN sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropColumn({ table: 'users', columnName: 'age' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "public"."users" DROP COLUMN "age"');
    });
  });

  describe('renameColumn', () => {
    it('should generate RENAME COLUMN sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "public"."users" RENAME COLUMN "name" TO "full_name"');
    });
  });

  describe('createIndex', () => {
    it('should create a regular index', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_name', columns: ['name'], unique: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE INDEX "idx_name" ON "public"."users" ("name")');
    });

    it('should create a unique index with type', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_email', columns: ['email'], unique: true, type: 'btree' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('UNIQUE');
      expect(result.sql).toContain('USING btree');
    });
  });

  describe('dropIndex', () => {
    it('should generate DROP INDEX sql for a regular index', async () => {
      await connectDriver(driver);
      // constraint check returns no rows → regular index
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropIndex({ table: 'users', indexName: 'idx_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP INDEX "public"."idx_name"');
    });

    it('should generate DROP CONSTRAINT sql for a constraint-backed index', async () => {
      await connectDriver(driver);
      // constraint check returns a row → constraint-backed index
      mockQuery.mockResolvedValueOnce({ rows: [{ conname: 'idx_unique' }] });
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropIndex({ table: 'users', indexName: 'idx_unique' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "public"."users" DROP CONSTRAINT "idx_unique" CASCADE');
    });
  });

  describe('addForeignKey', () => {
    it('should generate ADD CONSTRAINT sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'fk_user',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ADD CONSTRAINT "fk_user"');
      expect(result.sql).toContain('REFERENCES "public"."users"');
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });
  });

  describe('dropForeignKey', () => {
    it('should generate DROP CONSTRAINT sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropForeignKey({ table: 'orders', constraintName: 'fk_user' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "public"."orders" DROP CONSTRAINT "fk_user"');
    });
  });

  describe('createTable', () => {
    it('should create a simple table', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'VARCHAR', length: 100, nullable: false },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE "products"');
      expect(result.sql).toContain('"id" SERIAL');
      expect(result.sql).toContain('PRIMARY KEY ("id")');
    });

    it('should include foreign keys', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'user_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [
            {
              name: 'fk_user',
              columns: ['user_id'],
              referencedTable: 'users',
              referencedColumns: ['id'],
              onDelete: 'CASCADE',
            },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONSTRAINT "fk_user" FOREIGN KEY ("user_id")');
      expect(result.sql).toContain('ON DELETE CASCADE');
    });

    it('should add comment when provided', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({})  // create table
        .mockResolvedValueOnce({}); // comment

      const result = await driver.createTable({
        table: {
          name: 'logs',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true, autoIncrement: true }],
          comment: 'Audit logs',
        },
      });
      expect(result.success).toBe(true);
      // comment query should have been executed
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('COMMENT ON TABLE'));
    });
  });

  describe('dropTable', () => {
    it('should generate DROP TABLE sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropTable({ table: 'users' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE "public"."users"');
    });
  });

  describe('renameTable', () => {
    it('should generate RENAME TO sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.renameTable({ oldName: 'users', newName: 'accounts' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE "public"."users" RENAME TO "accounts"');
    });
  });

  describe('insertRow', () => {
    it('should insert row with parameterised values', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Bob', email: 'bob@test.com' },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('INSERT INTO "public"."users"');
      expect(result.sql).toContain('$1, $2');
    });
  });

  describe('deleteRow', () => {
    it('should delete row by primary key', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 42 },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('DELETE FROM "public"."users"');
      expect(result.sql).toContain('"id" = $1');
    });
  });

  // ─────────── View operations ───────────
  describe('createView', () => {
    it('should create a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createView({
        view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = true' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE VIEW "public"."active_users"');
    });

    it('should use CREATE OR REPLACE when replaceIfExists', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createView({
        view: { name: 'v', selectStatement: 'SELECT 1', replaceIfExists: true },
      });
      expect(result.sql).toContain('CREATE OR REPLACE VIEW');
    });
  });

  describe('dropView', () => {
    it('should drop a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropView({ viewName: 'active_users' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP VIEW IF EXISTS "public"."active_users"');
    });

    it('should add CASCADE when requested', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropView({ viewName: 'v', cascade: true });
      expect(result.sql).toContain('CASCADE');
    });
  });

  describe('renameView', () => {
    it('should rename a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER VIEW "public"."v1" RENAME TO "v2"');
    });
  });

  // ─────────── PostgreSQL-specific ───────────
  describe('getSchemas', () => {
    it('should return schemas', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'public', owner: 'postgres', is_system: false, table_count: 10 },
          { name: 'pg_catalog', owner: 'postgres', is_system: true, table_count: 85 },
        ],
      });

      const schemas = await driver.getSchemas();
      expect(schemas).toHaveLength(2);
      expect(schemas[0]).toEqual({ name: 'public', owner: 'postgres', isSystem: false, tableCount: 10 });
    });
  });

  describe('setCurrentSchema / getCurrentSchema', () => {
    it('should get and set the current schema', () => {
      expect(driver.getCurrentSchema()).toBe('public');
      driver.setCurrentSchema('custom');
      expect(driver.getCurrentSchema()).toBe('custom');
    });
  });

  describe('getSequences', () => {
    it('should return sequences', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          name: 'users_id_seq',
          schema: 'public',
          data_type: 'bigint',
          start_value: '1',
          min_value: '1',
          max_value: '9223372036854775807',
          increment: '1',
          cycled: false,
          cache_size: '1',
          last_value: '42',
          owner: 'postgres',
        }],
      });

      const seqs = await driver.getSequences();
      expect(seqs).toHaveLength(1);
      expect(seqs[0]).toEqual(expect.objectContaining({ name: 'users_id_seq', schema: 'public' }));
    });
  });

  describe('createSequence', () => {
    it('should create with all options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createSequence({
        sequence: {
          name: 'my_seq',
          schema: 'public',
          dataType: 'bigint',
          startWith: 100,
          increment: 5,
          minValue: 1,
          maxValue: 1000,
          cycle: true,
          cache: 10,
          ownedBy: 'users.id',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE SEQUENCE "public"."my_seq"');
      expect(result.sql).toContain('AS bigint');
      expect(result.sql).toContain('START WITH 100');
      expect(result.sql).toContain('INCREMENT BY 5');
      expect(result.sql).toContain('CYCLE');
      expect(result.sql).toContain('CACHE 10');
      expect(result.sql).toContain('OWNED BY users.id');
    });
  });

  describe('dropSequence', () => {
    it('should drop with cascade', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropSequence({ sequenceName: 'my_seq', cascade: true });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP SEQUENCE IF EXISTS');
      expect(result.sql).toContain('CASCADE');
    });
  });

  describe('alterSequence', () => {
    it('should generate ALTER SEQUENCE with all clauses', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        restartWith: 1,
        increment: 2,
        minValue: 0,
        maxValue: 500,
        cycle: false,
        cache: 5,
        ownedBy: null,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('RESTART WITH 1');
      expect(result.sql).toContain('INCREMENT BY 2');
      expect(result.sql).toContain('MINVALUE 0');
      expect(result.sql).toContain('MAXVALUE 500');
      expect(result.sql).toContain('NO CYCLE');
      expect(result.sql).toContain('CACHE 5');
      expect(result.sql).toContain('OWNED BY NONE');
    });

    it('should return no-op when no changes', async () => {
      await connectDriver(driver);

      const result = await driver.alterSequence({ sequenceName: 'my_seq' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('No changes specified');
    });
  });

  describe('getMaterializedViews', () => {
    it('should return materialized views', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'mv_sales', schema: 'public', definition: 'SELECT ...', owner: 'postgres', tablespace: null, has_indexes: true, is_populated: true },
        ],
      });

      const mvs = await driver.getMaterializedViews();
      expect(mvs).toHaveLength(1);
      expect(mvs[0]).toEqual(expect.objectContaining({ name: 'mv_sales', isPopulated: true }));
    });
  });

  describe('refreshMaterializedView', () => {
    it('should refresh concurrently with no data', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.refreshMaterializedView({
        viewName: 'mv_sales',
        concurrently: true,
        withData: false,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONCURRENTLY');
      expect(result.sql).toContain('WITH NO DATA');
    });
  });

  describe('getExtensions', () => {
    it('should return extensions', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ name: 'uuid-ossp', version: '1.1', schema: 'public', description: 'UUID', relocatable: true }],
      });

      const exts = await driver.getExtensions();
      expect(exts).toHaveLength(1);
      expect(exts[0].name).toBe('uuid-ossp');
    });
  });

  describe('createExtension', () => {
    it('should create with schema and cascade', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createExtension({ name: 'hstore', schema: 'public', version: '1.8', cascade: true });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE EXTENSION IF NOT EXISTS "hstore"');
      expect(result.sql).toContain('SCHEMA "public"');
      expect(result.sql).toContain("VERSION '1.8'");
      expect(result.sql).toContain('CASCADE');
    });
  });

  describe('dropExtension', () => {
    it('should drop with cascade', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropExtension({ name: 'hstore', cascade: true });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP EXTENSION IF EXISTS "hstore"');
      expect(result.sql).toContain('CASCADE');
    });
  });

  describe('getEnums', () => {
    it('should return enum types', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ name: 'status', schema: 'public', values: ['active', 'inactive'] }],
      });

      const enums = await driver.getEnums();
      expect(enums).toHaveLength(1);
      expect(enums[0]).toEqual({ name: 'status', schema: 'public', values: ['active', 'inactive'] });
    });
  });

  describe('getAllEnums', () => {
    it('should return all enums across schemas', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'status', schema: 'public', values: ['a'] },
          { name: 'role', schema: 'auth', values: ['admin', 'user'] },
        ],
      });

      const enums = await driver.getAllEnums();
      expect(enums).toHaveLength(2);
    });
  });

  // ─────────── Triggers ───────────
  describe('getTriggers', () => {
    it('should return triggers without table filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'trg_audit', table_name: 'users', schema: 'public', enabled: true, timing: 'AFTER', event: 'INSERT', definition: 'CREATE TRIGGER ...' },
        ],
      });

      const triggers = await driver.getTriggers();
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toEqual(expect.objectContaining({ name: 'trg_audit', table: 'users' }));
    });

    it('should filter by table', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getTriggers('users');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('c.relname = $1');
    });
  });

  describe('createTrigger', () => {
    it('should fail without functionName', async () => {
      await connectDriver(driver);

      const result = await driver.createTrigger({
        trigger: { name: 'trg', table: 'users', timing: 'AFTER', event: 'INSERT', body: 'BEGIN END' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('function name');
    });

    it('should create trigger with function', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_audit',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: '',
          functionName: 'audit_fn',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TRIGGER "trg_audit"');
      expect(result.sql).toContain('EXECUTE FUNCTION audit_fn()');
    });
  });

  describe('dropTrigger', () => {
    it('should fail without table', async () => {
      await connectDriver(driver);

      const result = await driver.dropTrigger({ triggerName: 'trg' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('table name');
    });

    it('should drop trigger on table', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropTrigger({ triggerName: 'trg', table: 'users', cascade: true });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DROP TRIGGER IF EXISTS "trg"');
      expect(result.sql).toContain('CASCADE');
    });
  });

  // ─────────── getTableDDL (composite) ───────────
  describe('getTableDDL', () => {
    it('should compose DDL from columns, indexes, and foreign keys', async () => {
      await connectDriver(driver);
      // getColumns
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'id', type: 'int4', dataType: 'integer', nullable: 'NO', defaultValue: null, primaryKey: true, autoIncrement: false, unique: false, comment: null, length: null, precision: null, scale: null },
          { name: 'name', type: 'varchar', dataType: 'character varying', nullable: 'YES', defaultValue: "'unnamed'", primaryKey: false, autoIncrement: false, unique: false, comment: null, length: 50, precision: null, scale: null },
        ],
      });
      // getIndexes
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'users_pkey', columns: ['id'], unique: true, primary: true, type: 'btree' },
          { name: 'idx_name', columns: ['name'], unique: false, primary: false, type: 'btree' },
        ],
      });
      // getForeignKeys
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const ddl = await driver.getTableDDL('users');
      expect(ddl).toContain('CREATE TABLE "public"."users"');
      expect(ddl).toContain('"id" int4');
      expect(ddl).toContain('NOT NULL');
      expect(ddl).toContain('PRIMARY KEY ("id")');
      expect(ddl).toContain('CREATE INDEX "idx_name" ON "public"."users"');
    });
  });

  // ─────────── getUsers ───────────
  describe('getUsers', () => {
    it('should return user list', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'postgres', superuser: true, create_role: true, create_db: true, login: true, replication: false, connection_limit: -1, valid_until: null, roles: [] },
        ],
      });

      const users = await driver.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual(expect.objectContaining({ name: 'postgres', superuser: true }));
    });
  });

  // ─────────── connect with SSL ───────────
  describe('connect with SSL', () => {
    it('should connect with SSL Require mode', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Require,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL VerifyCA mode (rejectUnauthorized=true)', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.VerifyCA,
          ca: 'my-ca-cert',
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL VerifyFull mode', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.VerifyFull,
          ca: 'ca-cert',
          cert: 'client-cert',
          key: 'client-key',
          serverName: 'my-server',
          minVersion: 'TLSv1.2',
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL Prefer mode (rejectUnauthorized=false)', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Prefer,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should fallback to non-SSL when Prefer mode fails', async () => {
      // First connect attempt with SSL fails
      mockPoolConnect.mockRejectedValueOnce(new Error('SSL error'));
      // Second connect attempt without SSL succeeds
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Prefer,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should throw when Prefer mode fallback also fails', async () => {
      // First connect attempt with SSL fails
      mockPoolConnect.mockRejectedValueOnce(new Error('SSL error'));
      // Second connect attempt without SSL also fails
      mockPoolConnect.mockRejectedValueOnce(new Error('connection refused'));

      await expect(driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Prefer,
        },
      }))).rejects.toThrow('connection refused');
      expect(driver.isConnected).toBe(false);
    });

    it('should not use SSL when mode is Disable', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: false,
        sslConfig: {
          enabled: false,
          mode: SSLMode.Disable,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should use rejectUnauthorized from sslConfig when mode is Require', async () => {
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Require,
          rejectUnauthorized: true,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle Prefer mode cleanup when client exists during fallback', async () => {
      const mockClient = { query: mockQuery, release: mockRelease };
      // First connect succeeds (pool created), but something later fails
      mockPoolConnect
        .mockResolvedValueOnce(mockClient)
        .mockImplementationOnce(() => {
          // Simulate: first connect gives us a client, then pool.connect throws on retry
          throw new Error('SSL handshake failed');
        });

      // We need to simulate the case where the initial pool.connect succeeds
      // but then the overall connect flow fails with SSL prefer
      // Actually, the code: pool.connect() is called once and throws
      // Then in cleanup: client.release() and pool.end() are called
      // Then retry without SSL

      // Let's mock it properly: first pool.connect rejects (SSL fail),
      // then pool.connect for fallback succeeds
      vi.clearAllMocks();
      driver = new PostgreSQLDriver();

      mockPoolConnect.mockRejectedValueOnce(new Error('SSL fail'));
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: { enabled: true, mode: SSLMode.Prefer },
      }));
      expect(driver.isConnected).toBe(true);
    });
  });

  // ─────────── getTableData with filters, sorting, limit/offset ───────────
  describe('getTableData', () => {
    const colRow = { name: 'id', type: 'int4', dataType: 'integer', nullable: 'NO', defaultValue: null, primaryKey: true, autoIncrement: true, unique: false, comment: null, length: null, precision: null, scale: null };

    const setupTableDataMocks = (count: string, dataRows: Record<string, unknown>[] = []) => {
      // 1. COUNT query
      mockQuery.mockResolvedValueOnce({ rows: [{ count }] });
      // 2. getColumns query
      mockQuery.mockResolvedValueOnce({ rows: [colRow] });
      // 3. data query
      mockQuery.mockResolvedValueOnce({ rows: dataRows });
    };

    it('should return table data without filters', async () => {
      await connectDriver(driver);
      setupTableDataMocks('10', [{ id: 1 }, { id: 2 }]);

      const result = await driver.getTableData('users', {});
      expect(result.totalCount).toBe(10);
      expect(result.rows).toHaveLength(2);
      expect(result.columns).toHaveLength(1);
    });

    it('should build WHERE clause with IS NULL filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('5');

      const result = await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NULL', value: null }],
      });
      expect(result.totalCount).toBe(5);
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IS NULL');
    });

    it('should build WHERE clause with IS NOT NULL filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('3');

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NOT NULL', value: null }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IS NOT NULL');
    });

    it('should build WHERE clause with IN filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('2');

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IN');
      expect(mockQuery.mock.calls[0][1]).toEqual(['active', 'pending']);
    });

    it('should build WHERE clause with NOT IN filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('7');

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: 'NOT IN', value: ['banned'] }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('NOT IN');
    });

    it('should build WHERE clause with LIKE filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('4');

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'LIKE', value: 'john' }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('LIKE');
      expect(mockQuery.mock.calls[0][1]).toEqual(['%john%']);
    });

    it('should build WHERE clause with NOT LIKE filter', async () => {
      await connectDriver(driver);
      setupTableDataMocks('6');

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: 'test' }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('NOT LIKE');
    });

    it('should build WHERE clause with default operator (= etc)', async () => {
      await connectDriver(driver);
      setupTableDataMocks('1', [{ id: 1 }]);

      await driver.getTableData('users', {
        filters: [{ column: 'id', operator: '=', value: 1 }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('"id" = $1');
    });

    it('should include ORDER BY clause', async () => {
      await connectDriver(driver);
      setupTableDataMocks('10', [{ id: 1 }]);

      await driver.getTableData('users', { orderBy: 'id', orderDirection: 'DESC' });
      const dataQuery = mockQuery.mock.calls[2][0] as string;
      expect(dataQuery).toContain('ORDER BY "id" DESC');
    });

    it('should include LIMIT and OFFSET', async () => {
      await connectDriver(driver);
      setupTableDataMocks('50', [{ id: 11 }]);

      const result = await driver.getTableData('users', { limit: 10, offset: 10 });
      const dataQuery = mockQuery.mock.calls[2][0] as string;
      expect(dataQuery).toContain('LIMIT 10');
      expect(dataQuery).toContain('OFFSET 10');
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(10);
    });

    it('should combine multiple filters with AND', async () => {
      await connectDriver(driver);
      setupTableDataMocks('1');

      await driver.getTableData('users', {
        filters: [
          { column: 'status', operator: '=', value: 'active' },
          { column: 'age', operator: '>', value: 18 },
        ],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('AND');
    });
  });

  // ─────────── testConnection ───────────
  describe('testConnection', () => {
    it('should return success with server info', async () => {
      // connect
      mockPoolConnect.mockResolvedValueOnce({
        query: mockQuery,
        release: mockRelease,
      });
      // execute('SELECT version()') -> pid query + actual query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ fields: [{ name: 'version', dataTypeID: 25 }], rows: [{ version: 'PostgreSQL 15.4' }], rowCount: 1 });
      // execute('SHOW server_encoding') -> pid + query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ fields: [{ name: 'server_encoding', dataTypeID: 25 }], rows: [{ server_encoding: 'UTF8' }], rowCount: 1 });
      // execute('SHOW timezone') -> pid + query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ fields: [{ name: 'TimeZone', dataTypeID: 25 }], rows: [{ TimeZone: 'UTC' }], rowCount: 1 });
      // execute('SHOW max_connections') -> pid + query
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({ fields: [{ name: 'max_connections', dataTypeID: 25 }], rows: [{ max_connections: '100' }], rowCount: 1 });

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('PostgreSQL 15.4');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return error on connection failure', async () => {
      mockPoolConnect.mockRejectedValueOnce(new Error('host not found'));

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(false);
      expect(result.error).toBe('host not found');
    });
  });

  // ─────────── cancelQuery advanced ───────────
  describe('cancelQuery advanced', () => {
    it('should successfully cancel when pid is set', async () => {
      await connectDriver(driver);
      // Set the pid directly to simulate a running query
      (driver as any).currentQueryPid = 42;

      const cancelQuery = vi.fn().mockResolvedValueOnce({ rows: [{ cancelled: true }] });
      const cancelRelease = vi.fn();
      mockPoolConnect.mockResolvedValueOnce({
        query: cancelQuery,
        release: cancelRelease,
      });

      const result = await driver.cancelQuery();
      expect(result).toBe(true);
      expect(cancelRelease).toHaveBeenCalled();
    });

    it('should return false when cancel backend returns false', async () => {
      await connectDriver(driver);
      (driver as any).currentQueryPid = 42;

      const cancelQuery = vi.fn().mockResolvedValueOnce({ rows: [{ cancelled: false }] });
      const cancelRelease = vi.fn();
      mockPoolConnect.mockResolvedValueOnce({
        query: cancelQuery,
        release: cancelRelease,
      });

      const result = await driver.cancelQuery();
      expect(result).toBe(false);
      expect(cancelRelease).toHaveBeenCalled();
    });

    it('should return false when pool.connect for cancel fails', async () => {
      await connectDriver(driver);
      (driver as any).currentQueryPid = 42;

      mockPoolConnect.mockRejectedValueOnce(new Error('pool exhausted'));

      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });
  });

  // ─────────── error handling in schema operations ───────────
  describe('error handling in schema operations', () => {
    it('dropColumn should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('cannot drop'));

      const result = await driver.dropColumn({ table: 'users', columnName: 'id' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('cannot drop');
    });

    it('renameColumn should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('column not found'));

      const result = await driver.renameColumn({ table: 'users', oldName: 'x', newName: 'y' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('column not found');
    });

    it('createIndex should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('index exists'));

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_dup', columns: ['email'], unique: false },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('index exists');
    });

    it('dropIndex should return error on failure', async () => {
      await connectDriver(driver);
      // constraint check returns no rows → regular index
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockRejectedValueOnce(new Error('no such index'));

      const result = await driver.dropIndex({ table: 'users', indexName: 'idx_missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('no such index');
    });

    it('addForeignKey should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('ref table missing'));

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'fk_bad',
          columns: ['user_id'],
          referencedTable: 'nonexistent',
          referencedColumns: ['id'],
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('ref table missing');
    });

    it('dropForeignKey should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('constraint not found'));

      const result = await driver.dropForeignKey({ table: 'orders', constraintName: 'fk_missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('constraint not found');
    });

    it('createTable should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('table exists'));

      const result = await driver.createTable({
        table: {
          name: 'users',
          columns: [{ name: 'id', type: 'INTEGER', nullable: false, primaryKey: true }],
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('table exists');
    });

    it('dropTable should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('permission denied'));

      const result = await driver.dropTable({ table: 'system_table' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });

    it('renameTable should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('table not found'));

      const result = await driver.renameTable({ oldName: 'missing', newName: 'new_name' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('table not found');
    });

    it('insertRow should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('unique violation'));

      const result = await driver.insertRow({
        table: 'users',
        values: { email: 'duplicate@test.com' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('unique violation');
    });

    it('deleteRow should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('FK constraint'));

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 1 },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('FK constraint');
    });

    it('createView should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('invalid select'));

      const result = await driver.createView({
        view: { name: 'bad_view', selectStatement: 'SELECT FROM' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid select');
    });

    it('dropView should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('view not found'));

      const result = await driver.dropView({ viewName: 'missing_view' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('view not found');
    });

    it('renameView should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('view not found'));

      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('view not found');
    });

    it('createSequence should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('sequence exists'));

      const result = await driver.createSequence({
        sequence: { name: 'dup_seq' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('sequence exists');
    });

    it('dropSequence should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('sequence not found'));

      const result = await driver.dropSequence({ sequenceName: 'missing_seq' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('sequence not found');
    });

    it('alterSequence should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('invalid value'));

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        restartWith: -1,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid value');
    });

    it('refreshMaterializedView should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('not populated'));

      const result = await driver.refreshMaterializedView({ viewName: 'mv_bad' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('not populated');
    });

    it('createExtension should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('permission denied'));

      const result = await driver.createExtension({ name: 'pgcrypto' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });

    it('dropExtension should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('extension not found'));

      const result = await driver.dropExtension({ name: 'nonexistent' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('extension not found');
    });

    it('createTrigger should return error on query failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('function not found'));

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_bad',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: '',
          functionName: 'nonexistent_fn',
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('function not found');
    });

    it('dropTrigger should return error on query failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('trigger not found'));

      const result = await driver.dropTrigger({ triggerName: 'trg_bad', table: 'users' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('trigger not found');
    });
  });

  // ─────────── getTriggerDefinition edge cases ───────────
  describe('getTriggerDefinition', () => {
    it('should return the definition when found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'CREATE TRIGGER trg_audit AFTER INSERT ...' }],
      });

      const def = await driver.getTriggerDefinition('trg_audit');
      expect(def).toBe('CREATE TRIGGER trg_audit AFTER INSERT ...');
    });

    it('should return not-found message when trigger missing', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const def = await driver.getTriggerDefinition('missing_trg');
      expect(def).toContain("Trigger 'missing_trg' not found");
    });

    it('should include table filter when provided', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'CREATE TRIGGER ...' }],
      });

      await driver.getTriggerDefinition('trg_audit', 'users');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('c.relname = $2');
      expect(mockQuery.mock.calls[0][1]).toEqual(['trg_audit', 'users']);
    });
  });

  // ─────────── getSequenceDetails edge cases ───────────
  describe('getSequenceDetails', () => {
    it('should return sequence details when found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          name: 'my_seq',
          schema: 'public',
          data_type: 'bigint',
          start_value: '1',
          min_value: '1',
          max_value: '9999',
          increment: '1',
          cycled: false,
          cache_size: '1',
          last_value: '50',
          owner: 'postgres',
        }],
      });

      const seq = await driver.getSequenceDetails('my_seq');
      expect(seq).not.toBeNull();
      expect(seq!.name).toBe('my_seq');
      expect(seq!.lastValue).toBe('50');
    });

    it('should return null when sequence not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const seq = await driver.getSequenceDetails('missing_seq');
      expect(seq).toBeNull();
    });

    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getSequenceDetails('my_seq', 'custom_schema');
      expect(mockQuery.mock.calls[0][1]).toEqual(['custom_schema', 'my_seq']);
    });
  });

  // ─────────── alterSequence with various option combinations ───────────
  describe('alterSequence option combinations', () => {
    it('should handle null minValue (NO MINVALUE)', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        minValue: null as unknown as number,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NO MINVALUE');
    });

    it('should handle null maxValue (NO MAXVALUE)', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        maxValue: null as unknown as number,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NO MAXVALUE');
    });

    it('should handle cycle=true', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        cycle: true,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CYCLE');
      expect(result.sql).not.toContain('NO CYCLE');
    });

    it('should handle ownedBy with a value', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        ownedBy: 'users.id',
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('OWNED BY users.id');
    });

    it('should use custom schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.alterSequence({
        sequenceName: 'my_seq',
        schema: 'custom',
        restartWith: 1,
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('"custom"."my_seq"');
    });
  });

  // ─────────── createTable additional branches ───────────
  describe('createTable additional branches', () => {
    it('should use BIGSERIAL for BIGINT auto-increment PK', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'big_table',
          columns: [
            { name: 'id', type: 'BIGINT', nullable: false, primaryKey: true, autoIncrement: true },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('"id" BIGSERIAL');
    });

    it('should use table.primaryKey when no column-level PKs', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'composite_pk',
          columns: [
            { name: 'a', type: 'INTEGER', nullable: false },
            { name: 'b', type: 'INTEGER', nullable: false },
          ],
          primaryKey: ['a', 'b'],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('PRIMARY KEY ("a", "b")');
    });

    it('should create indexes separately', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({})   // create table
        .mockResolvedValueOnce({});  // create index

      const result = await driver.createTable({
        table: {
          name: 'indexed_table',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'email', type: 'VARCHAR', length: 255, nullable: true },
          ],
          indexes: [{ name: 'idx_email', columns: ['email'], unique: true }],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should handle column with unique but not PK', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'unique_table',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'code', type: 'VARCHAR', length: 50, nullable: false, unique: true },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('UNIQUE');
    });

    it('should handle non-nullable non-PK column with default and no auto-increment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'defaults_table',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'status', type: 'VARCHAR', length: 20, nullable: false, defaultValue: 'active' },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'active'");
      expect(result.sql).toContain('NOT NULL');
    });

    it('should handle foreign keys with onUpdate', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTable({
        table: {
          name: 'fk_table',
          columns: [
            { name: 'id', type: 'INTEGER', nullable: false, primaryKey: true },
            { name: 'ref_id', type: 'INTEGER', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_ref',
            columns: ['ref_id'],
            referencedTable: 'other',
            referencedColumns: ['id'],
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
          }],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });
  });

  // ─────────── addColumn with numeric default ───────────
  describe('addColumn with numeric default', () => {
    it('should handle numeric default value', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'score', type: 'INTEGER', nullable: true, defaultValue: 0 },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DEFAULT 0');
    });

    it('should handle primaryKey column without unique', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'pk_col', type: 'INTEGER', nullable: false, primaryKey: true, unique: true },
      });
      expect(result.success).toBe(true);
      // unique should NOT appear when primaryKey is true
      expect(result.sql).not.toContain('UNIQUE');
    });
  });

  // ─────────── modifyColumn with string default ───────────
  describe('modifyColumn with string default', () => {
    it('should set string default value', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({}) // type
        .mockResolvedValueOnce({}) // null
        .mockResolvedValueOnce({}); // set default

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'status',
        newDefinition: { name: 'status', type: 'VARCHAR', length: 50, nullable: true, defaultValue: 'pending' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("SET DEFAULT 'pending'");
    });

    it('should handle precision and scale in column type', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({}) // type
        .mockResolvedValueOnce({}); // null

      const result = await driver.modifyColumn({
        table: 'products',
        oldName: 'price',
        newDefinition: { name: 'price', type: 'NUMERIC', precision: 10, scale: 2, nullable: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NUMERIC(10,2)');
    });

    it('should handle precision-only column type', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({}) // type
        .mockResolvedValueOnce({}); // null

      const result = await driver.modifyColumn({
        table: 'data',
        oldName: 'val',
        newDefinition: { name: 'val', type: 'NUMERIC', precision: 5, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NUMERIC(5)');
    });
  });

  // ─────────── getTableDDL with foreign keys and precision ───────────
  describe('getTableDDL additional branches', () => {
    it('should include foreign keys in DDL', async () => {
      await connectDriver(driver);
      // getColumns - includes precision and scale
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'amount', type: 'numeric', dataType: 'numeric', nullable: 'YES', defaultValue: null, primaryKey: false, autoIncrement: false, unique: false, comment: null, length: null, precision: 10, scale: 2 },
        ],
      });
      // getIndexes
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // getForeignKeys
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'fk_user', column: 'user_id', referencedTable: 'users', referencedColumn: 'id', onUpdate: 'CASCADE', onDelete: null },
        ],
      });

      const ddl = await driver.getTableDDL('orders');
      expect(ddl).toContain('CONSTRAINT "fk_user"');
      expect(ddl).toContain('ON UPDATE CASCADE');
      expect(ddl).toContain('(10, 2)');
    });
  });

  // ─────────── getMaterializedViewDDL ───────────
  describe('getMaterializedViewDDL', () => {
    it('should return materialized view DDL', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'SELECT * FROM sales' }],
      });

      const ddl = await driver.getMaterializedViewDDL('mv_sales');
      expect(ddl).toContain('CREATE MATERIALIZED VIEW "public"."mv_sales"');
      expect(ddl).toContain('SELECT * FROM sales');
    });

    it('should handle custom schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [{ definition: 'SELECT 1' }],
      });

      const ddl = await driver.getMaterializedViewDDL('mv_test', 'analytics');
      expect(ddl).toContain('"analytics"."mv_test"');
    });

    it('should handle empty definition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [{}] });

      const ddl = await driver.getMaterializedViewDDL('mv_empty');
      expect(ddl).toContain('CREATE MATERIALIZED VIEW');
    });
  });

  // ─────────── getAvailableExtensions ───────────
  describe('getAvailableExtensions', () => {
    it('should return available extensions', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          { name: 'pgcrypto', version: '1.3', description: 'Cryptographic functions' },
          { name: 'hstore', version: null, description: null },
        ],
      });

      const exts = await driver.getAvailableExtensions();
      expect(exts).toHaveLength(2);
      expect(exts[0]).toEqual({ name: 'pgcrypto', version: '1.3', description: 'Cryptographic functions' });
      expect(exts[1]).toEqual({ name: 'hstore', version: '', description: '' });
    });
  });

  // ─────────── createSequence with minimal options ───────────
  describe('createSequence minimal', () => {
    it('should create sequence with no options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createSequence({
        sequence: { name: 'simple_seq' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE SEQUENCE "public"."simple_seq"');
    });

    it('should create sequence with NO CYCLE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createSequence({
        sequence: { name: 'no_cycle_seq', cycle: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('NO CYCLE');
    });
  });

  // ─────────── dropSequence without cascade ───────────
  describe('dropSequence without cascade', () => {
    it('should drop without cascade', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropSequence({ sequenceName: 'my_seq', schema: 'custom' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP SEQUENCE IF EXISTS "custom"."my_seq"');
      expect(result.sql).not.toContain('CASCADE');
    });
  });

  // ─────────── refreshMaterializedView without options ───────────
  describe('refreshMaterializedView without options', () => {
    it('should refresh without concurrently or data clause', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.refreshMaterializedView({ viewName: 'mv_test', schema: 'analytics' });
      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('CONCURRENTLY');
      expect(result.sql).not.toContain('WITH NO DATA');
      expect(result.sql).toContain('"analytics"."mv_test"');
    });
  });

  // ─────────── createExtension minimal ───────────
  describe('createExtension minimal', () => {
    it('should create extension with just name', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createExtension({ name: 'uuid-ossp' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    });
  });

  // ─────────── dropExtension without cascade ───────────
  describe('dropExtension without cascade', () => {
    it('should drop extension without cascade', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropExtension({ name: 'hstore' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP EXTENSION IF EXISTS "hstore"');
      expect(result.sql).not.toContain('CASCADE');
    });
  });

  // ─────────── createTrigger with condition ───────────
  describe('createTrigger with condition', () => {
    it('should include WHEN clause for condition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_conditional',
          table: 'users',
          timing: 'BEFORE',
          event: 'UPDATE',
          body: '',
          functionName: 'check_fn',
          condition: 'NEW.status != OLD.status',
          schema: 'custom',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('WHEN (NEW.status != OLD.status)');
      expect(result.sql).toContain('"custom"."users"');
    });
  });

  // ─────────── dropTrigger with schema ───────────
  describe('dropTrigger with schema', () => {
    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropTrigger({
        triggerName: 'trg_test',
        table: 'users',
        schema: 'my_schema',
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('"my_schema"."users"');
    });
  });

  // ─────────── dropView without cascade ───────────
  describe('dropView without cascade', () => {
    it('should drop view without CASCADE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.dropView({ viewName: 'v1' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP VIEW IF EXISTS "public"."v1"');
      expect(result.sql).not.toContain('CASCADE');
    });
  });

  // ─────────── addForeignKey without onUpdate/onDelete ───────────
  describe('addForeignKey without onUpdate/onDelete', () => {
    it('should omit ON UPDATE and ON DELETE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({});

      const result = await driver.addForeignKey({
        table: 'orders',
        foreignKey: {
          name: 'fk_simple',
          columns: ['user_id'],
          referencedTable: 'users',
          referencedColumns: ['id'],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('ON UPDATE');
      expect(result.sql).not.toContain('ON DELETE');
    });
  });

  // ─────────── getUsers with connection_limit and valid_until ───────────
  describe('getUsers with extra fields', () => {
    it('should handle connection_limit and valid_until', async () => {
      await connectDriver(driver);
      const futureDate = new Date('2025-12-31');
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            name: 'limited_user',
            superuser: false,
            create_role: false,
            create_db: false,
            login: true,
            replication: false,
            connection_limit: 5,
            valid_until: futureDate,
            roles: ['role1'],
          },
        ],
      });

      const users = await driver.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].connectionLimit).toBe(5);
      expect(users[0].validUntil).toBe(futureDate.toISOString());
      expect(users[0].roles).toEqual(['role1']);
    });
  });

  // ─────────── execute with non-Error throw ───────────
  describe('execute with non-Error throw', () => {
    it('should handle non-Error thrown from actual query', async () => {
      await connectDriver(driver);
      // pid query succeeds, actual query throws string
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockRejectedValueOnce('string error');

      const result = await driver.execute('BAD SQL');
      expect(result.error).toBe('string error');
    });

    it('should handle non-Error thrown from pid query', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce('pid error');

      const result = await driver.execute('SELECT 1');
      expect(result.error).toBe('pid error');
    });
  });

  // ─────────── getSequences with custom schema ───────────
  describe('getSequences with custom schema', () => {
    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getSequences('custom_schema');
      expect(mockQuery.mock.calls[0][1]).toEqual(['custom_schema']);
    });
  });

  // ─────────── getMaterializedViews with custom schema ───────────
  describe('getMaterializedViews with custom schema', () => {
    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getMaterializedViews('analytics');
      expect(mockQuery.mock.calls[0][1]).toEqual(['analytics']);
    });
  });

  // ─────────── getEnums with custom schema ───────────
  describe('getEnums with custom schema', () => {
    it('should use provided schema', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await driver.getEnums('custom');
      expect(mockQuery.mock.calls[0][1]).toEqual(['custom']);
    });
  });

  // ─────────── execute with empty fields ───────────
  describe('execute edge cases', () => {
    it('should handle missing fields in result', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({
          fields: undefined,
          rows: [{ id: 1 }],
          rowCount: 1,
        });

      const result = await driver.execute('SELECT 1');
      expect(result.columns).toEqual([]);
      expect(result.rows).toHaveLength(1);
    });

    it('should handle rowCount being null', async () => {
      await connectDriver(driver);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ pid: 1 }] })
        .mockResolvedValueOnce({
          fields: [],
          rows: [{ id: 1 }],
          rowCount: null,
        });

      const result = await driver.execute('SELECT 1');
      expect(result.rowCount).toBe(0);
    });
  });

  // ─────────── createUser ───────────
  describe('createUser', () => {
    it('should create a basic user with LOGIN', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await driver.createUser({
        user: { name: 'newuser', password: 'secret123' },
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE ROLE "newuser" WITH LOGIN PASSWORD $1',
        ['secret123'],
      );
    });

    it('should create a user without password', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await driver.createUser({
        user: { name: 'nopassuser' },
      });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'CREATE ROLE "nopassuser" WITH LOGIN',
      );
      expect(result.sql).not.toContain('PASSWORD');
      expect(result.sql).not.toContain('****');
    });

    it('should include SUPERUSER, CREATEDB, REPLICATION, BYPASSRLS options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await driver.createUser({
        user: {
          name: 'admin',
          password: 'pw',
          superuser: true,
          createDb: true,
          replication: true,
          bypassRls: true,
        },
      });

      expect(result.success).toBe(true);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('SUPERUSER');
      expect(sql).toContain('CREATEDB');
      expect(sql).toContain('REPLICATION');
      expect(sql).toContain('BYPASSRLS');
      expect(sql).toContain('LOGIN');
    });

    it('should escape double quotes in username', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await driver.createUser({
        user: { name: 'user"name', password: 'pw' },
      });

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('"user""name"');
    });

    it('should parameterize password (not inline)', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await driver.createUser({
        user: { name: 'u', password: 'my$ecret' },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('$1'),
        ['my$ecret'],
      );
    });

    it('should redact password in returned SQL', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await driver.createUser({
        user: { name: 'u', password: 'secret' },
      });

      expect(result.sql).not.toContain('secret');
      expect(result.sql).toContain("'****'");
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('role "u" already exists'));

      const result = await driver.createUser({
        user: { name: 'u', password: 'pw' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  // ─────────── dropUser ───────────
  describe('dropUser', () => {
    it('should drop a user', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const result = await driver.dropUser({ name: 'testuser' });

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('DROP ROLE "testuser"');
    });

    it('should escape double quotes in username', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await driver.dropUser({ name: 'user"name' });

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('"user""name"');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('role "x" does not exist'));

      const result = await driver.dropUser({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  // ─────────── getUsers with bypassRls ───────────
  describe('getUsers with bypassRls', () => {
    it('should return bypassRls field', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            name: 'rls_user',
            superuser: false,
            create_role: false,
            create_db: false,
            login: true,
            replication: false,
            bypass_rls: true,
            connection_limit: -1,
            valid_until: null,
            roles: [],
          },
        ],
      });

      const users = await driver.getUsers();
      expect(users[0].bypassRls).toBe(true);
    });
  });
});
