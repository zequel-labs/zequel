import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType, RoutineType, EventStatus, SSLMode } from '@main/types';
import { MYSQL_DATA_TYPES } from '@main/types/schema-operations';

// ── Mock logger ──
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Mock mysql2/promise ──
const mockQuery = vi.fn();
const mockExecute = vi.fn();
const mockEnd = vi.fn();
const mockCreateConnection = vi.fn();

vi.mock('mysql2/promise', () => ({
  default: {
    createConnection: (...args: unknown[]) => mockCreateConnection(...args),
  },
}));

import { MySQLDriver } from '@main/db/mysql';

// ── Helpers ──

const createConfig = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-mysql',
  name: 'Test MySQL',
  type: DatabaseType.MySQL,
  host: 'localhost',
  port: 3306,
  database: 'testdb',
  username: 'root',
  password: 'secret',
  ...overrides,
});

const createMockConnection = () => ({
  query: mockQuery,
  execute: mockExecute,
  end: mockEnd,
  threadId: 12345,
});

const connectDriver = async (driver: MySQLDriver): Promise<void> => {
  const conn = createMockConnection();
  mockCreateConnection.mockResolvedValueOnce(conn);
  await driver.connect(createConfig());
};

// ── Tests ──

describe('MySQLDriver', () => {
  let driver: MySQLDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new MySQLDriver();
  });

  // ─────────── type ───────────
  describe('type', () => {
    it('should be MySQL', () => {
      expect(driver.type).toBe(DatabaseType.MySQL);
    });
  });

  // ─────────── connect / disconnect ───────────
  describe('connect', () => {
    it('should connect and set isConnected to true', async () => {
      await connectDriver(driver);
      expect(driver.isConnected).toBe(true);
    });

    it('should pass connection options to createConnection', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);
      await driver.connect(createConfig({ host: '192.168.1.1', port: 3307 }));

      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: '192.168.1.1', port: 3307, user: 'root' }),
      );
    });

    it('should throw and set isConnected to false on failure', async () => {
      mockCreateConnection.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(driver.connect(createConfig())).rejects.toThrow('ECONNREFUSED');
      expect(driver.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should end connection and set isConnected to false', async () => {
      await connectDriver(driver);
      await driver.disconnect();
      expect(mockEnd).toHaveBeenCalled();
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
      mockQuery.mockResolvedValueOnce([[{ 1: 1 }], []]);
      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when query throws', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('lost connection'));
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when no connection', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  // ─────────── cancelQuery ───────────
  describe('cancelQuery', () => {
    it('should return false when not running a query', async () => {
      await connectDriver(driver);
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
      mockQuery.mockResolvedValueOnce([
        [{ id: 1, name: 'Alice' }],
        [
          { name: 'id', type: 3, flags: 2 },
          { name: 'name', type: 253, flags: 0 },
        ],
      ]);

      const result = await driver.execute('SELECT * FROM users');
      expect(result.rows).toEqual([{ id: 1, name: 'Alice' }]);
      expect(result.rowCount).toBe(1);
      expect(result.columns).toHaveLength(2);
      expect(result.columns[0]).toEqual(
        expect.objectContaining({ name: 'id', type: 'INT', primaryKey: true }),
      );
      expect(result.columns[1]).toEqual(
        expect.objectContaining({ name: 'name', type: 'VAR_STRING', primaryKey: false }),
      );
    });

    it('should return affectedRows for INSERT/UPDATE/DELETE', async () => {
      mockQuery.mockResolvedValueOnce([
        { affectedRows: 5 },
        undefined,
      ]);

      const result = await driver.execute('DELETE FROM sessions WHERE expired = true');
      expect(result.affectedRows).toBe(5);
      expect(result.rows).toEqual([]);
    });

    it('should pass params to query', async () => {
      mockQuery.mockResolvedValueOnce([
        [{ id: 1 }],
        [{ name: 'id', type: 3, flags: 0 }],
      ]);

      await driver.execute('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    });

    it('should return error on query failure', async () => {
      mockQuery.mockRejectedValueOnce(new Error('syntax error at position 5'));

      const result = await driver.execute('BAD SQL');
      expect(result.error).toBe('syntax error at position 5');
      expect(result.rows).toEqual([]);
    });

    it('should throw when not connected', async () => {
      const fresh = new MySQLDriver();
      const result = await fresh.execute('SELECT 1').catch((e: Error) => e);
      expect(result).toBeInstanceOf(Error);
    });

    it('should map MySQL type IDs correctly', async () => {
      const typeMap: Record<number, string> = {
        0: 'DECIMAL',
        1: 'TINYINT',
        3: 'INT',
        7: 'TIMESTAMP',
        8: 'BIGINT',
        12: 'DATETIME',
        15: 'VARCHAR',
        245: 'JSON',
        252: 'BLOB',
        253: 'VAR_STRING',
        254: 'STRING',
        255: 'GEOMETRY',
      };

      for (const [typeId, expected] of Object.entries(typeMap)) {
        mockQuery.mockResolvedValueOnce([
          [{ col: 'x' }],
          [{ name: 'col', type: Number(typeId), flags: 0 }],
        ]);
        const result = await driver.execute('SELECT col FROM t');
        expect(result.columns[0].type).toBe(expected);
      }
    });
  });

  // ─────────── getDatabases ───────────
  describe('getDatabases', () => {
    it('should return a list of databases', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ Database: 'information_schema' }, { Database: 'testdb' }],
        [],
      ]);

      const dbs = await driver.getDatabases();
      expect(dbs).toEqual([{ name: 'information_schema' }, { name: 'testdb' }]);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getDatabases()).rejects.toThrow('Not connected');
    });
  });

  // ─────────── getTables ───────────
  describe('getTables', () => {
    it('should return tables with correct TableObjectType mapping', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [
          { name: 'users', type: 'BASE TABLE', row_count: 100, size: 16384, comment: '' },
          { name: 'user_view', type: 'VIEW', row_count: null, size: null, comment: 'A view' },
        ],
        [],
      ]);

      const tables = await driver.getTables('testdb');
      expect(tables).toHaveLength(2);
      expect(tables[0]).toEqual(
        expect.objectContaining({ name: 'users', type: TableObjectType.Table }),
      );
      expect(tables[1]).toEqual(
        expect.objectContaining({ name: 'user_view', type: TableObjectType.View, comment: 'A view' }),
      );
    });

    it('should switch database when different from current', async () => {
      await connectDriver(driver);
      // USE query
      mockQuery.mockResolvedValueOnce([[], []]);
      // getTables query
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTables('otherdb');
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('USE `otherdb`'));
    });
  });

  // ─────────── getColumns ───────────
  describe('getColumns', () => {
    it('should return columns with correct mappings', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [
          {
            name: 'id',
            type: 'int',
            nullable: 'NO',
            defaultValue: null,
            columnKey: 'PRI',
            extra: 'auto_increment',
            length: null,
            precision: 10,
            scale: 0,
            comment: 'Primary key',
          },
          {
            name: 'email',
            type: 'varchar',
            nullable: 'YES',
            defaultValue: null,
            columnKey: 'UNI',
            extra: '',
            length: 255,
            precision: null,
            scale: null,
            comment: '',
          },
        ],
        [],
      ]);

      const columns = await driver.getColumns('users');
      expect(columns).toHaveLength(2);
      expect(columns[0]).toEqual(
        expect.objectContaining({
          name: 'id',
          type: 'INT',
          nullable: false,
          primaryKey: true,
          autoIncrement: true,
          comment: 'Primary key',
        }),
      );
      expect(columns[1]).toEqual(
        expect.objectContaining({
          name: 'email',
          type: 'VARCHAR',
          nullable: true,
          unique: true,
          length: 255,
        }),
      );
    });
  });

  // ─────────── getIndexes ───────────
  describe('getIndexes', () => {
    it('should aggregate multi-column indexes', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [
          { Key_name: 'PRIMARY', Column_name: 'id', Non_unique: 0, Index_type: 'BTREE' },
          { Key_name: 'idx_name_email', Column_name: 'name', Non_unique: 1, Index_type: 'BTREE' },
          { Key_name: 'idx_name_email', Column_name: 'email', Non_unique: 1, Index_type: 'BTREE' },
        ],
        [],
      ]);

      const indexes = await driver.getIndexes('users');
      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toEqual({
        name: 'PRIMARY',
        columns: ['id'],
        unique: true,
        primary: true,
        type: 'BTREE',
      });
      expect(indexes[1]).toEqual({
        name: 'idx_name_email',
        columns: ['name', 'email'],
        unique: false,
        primary: false,
        type: 'BTREE',
      });
    });
  });

  // ─────────── getForeignKeys ───────────
  describe('getForeignKeys', () => {
    it('should return foreign keys with ON UPDATE/DELETE', async () => {
      await connectDriver(driver);
      // KEY_COLUMN_USAGE
      mockQuery.mockResolvedValueOnce([
        [{ name: 'fk_user', column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
        [],
      ]);
      // REFERENTIAL_CONSTRAINTS
      mockQuery.mockResolvedValueOnce([
        [{ name: 'fk_user', onUpdate: 'CASCADE', onDelete: 'SET NULL' }],
        [],
      ]);

      const fks = await driver.getForeignKeys('orders');
      expect(fks).toHaveLength(1);
      expect(fks[0]).toEqual({
        name: 'fk_user',
        column: 'user_id',
        referencedTable: 'users',
        referencedColumn: 'id',
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    });
  });

  // ─────────── getTableDDL ───────────
  describe('getTableDDL', () => {
    it('should return Create Table statement', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ 'Create Table': 'CREATE TABLE `users` ...' }],
        [],
      ]);

      const ddl = await driver.getTableDDL('users');
      expect(ddl).toBe('CREATE TABLE `users` ...');
    });

    it('should return Create View when table is a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ 'Create View': 'CREATE VIEW `v` AS SELECT ...' }],
        [],
      ]);

      const ddl = await driver.getTableDDL('v');
      expect(ddl).toBe('CREATE VIEW `v` AS SELECT ...');
    });
  });

  // ─────────── getPrimaryKeyColumns ───────────
  describe('getPrimaryKeyColumns', () => {
    it('should return primary key column names', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [
          { name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: 'auto_increment', length: null, precision: null, scale: null, comment: '' },
          { name: 'email', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 255, precision: null, scale: null, comment: '' },
        ],
        [],
      ]);

      const pks = await driver.getPrimaryKeyColumns('users');
      expect(pks).toEqual(['id']);
    });
  });

  // ─────────── getRoutines ───────────
  describe('getRoutines', () => {
    it('should return routines', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([
        [
          { name: 'get_user', type: 'FUNCTION', schema: 'testdb', return_type: 'int', language: null, created_at: '2024-01-01', modified_at: '2024-01-02' },
          { name: 'update_user', type: 'PROCEDURE', schema: 'testdb', return_type: '', language: 'SQL', created_at: '2024-01-01', modified_at: '2024-01-02' },
        ],
        [],
      ]);

      const routines = await driver.getRoutines();
      expect(routines).toHaveLength(2);
      expect(routines[0]).toEqual(
        expect.objectContaining({ name: 'get_user', type: 'FUNCTION' }),
      );
      expect(routines[1]).toEqual(
        expect.objectContaining({ name: 'update_user', type: 'PROCEDURE', language: 'SQL' }),
      );
    });

    it('should filter by type', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([[], []]);

      await driver.getRoutines(RoutineType.Function);
      const sql = mockExecute.mock.calls[0][0] as string;
      expect(sql).toContain("ROUTINE_TYPE = 'FUNCTION'");
    });
  });

  // ─────────── getRoutineDefinition ───────────
  describe('getRoutineDefinition', () => {
    it('should return procedure definition', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([
        [{ 'Create Procedure': 'CREATE PROCEDURE update_user() BEGIN ... END' }],
        [],
      ]);

      const def = await driver.getRoutineDefinition('update_user', RoutineType.Procedure);
      expect(def).toBe('CREATE PROCEDURE update_user() BEGIN ... END');
    });

    it('should return function definition', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([
        [{ 'Create Function': 'CREATE FUNCTION get_user() RETURNS INT BEGIN ... END' }],
        [],
      ]);

      const def = await driver.getRoutineDefinition('get_user', RoutineType.Function);
      expect(def).toBe('CREATE FUNCTION get_user() RETURNS INT BEGIN ... END');
    });

    it('should return fallback when not found', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const def = await driver.getRoutineDefinition('missing', RoutineType.Function);
      expect(def).toContain('not found');
    });

    it('should return error message on exception', async () => {
      await connectDriver(driver);
      mockExecute.mockRejectedValueOnce(new Error('access denied'));

      const def = await driver.getRoutineDefinition('secret_fn', RoutineType.Function);
      expect(def).toContain('Error getting');
      expect(def).toContain('access denied');
    });
  });

  // ─────────── getDataTypes ───────────
  describe('getDataTypes', () => {
    it('should return MYSQL_DATA_TYPES', () => {
      const types = driver.getDataTypes();
      expect(types).toBe(MYSQL_DATA_TYPES);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  // ─────────── Schema operations ───────────
  describe('addColumn', () => {
    it('should generate ALTER TABLE ADD COLUMN sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: false },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER TABLE `users` ADD COLUMN');
      expect(result.sql).toContain('`age` INT');
      expect(result.sql).toContain('NOT NULL');
    });

    it('should include AFTER positioning', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'middle_name', type: 'VARCHAR', length: 50, nullable: true, afterColumn: 'first_name' },
      });
      expect(result.sql).toContain('AFTER `first_name`');
    });

    it('should include FIRST positioning', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'row_id', type: 'INT', nullable: false, afterColumn: 'FIRST' },
      });
      expect(result.sql).toContain('FIRST');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('duplicate column'));

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'age', type: 'INT', nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('duplicate column');
    });
  });

  describe('modifyColumn', () => {
    it('should use CHANGE COLUMN when renaming', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'full_name', type: 'VARCHAR', length: 200, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CHANGE COLUMN `name`');
      expect(result.sql).toContain('`full_name`');
    });

    it('should use MODIFY COLUMN when not renaming', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'TEXT', nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('MODIFY COLUMN');
      expect(result.sql).not.toContain('CHANGE COLUMN');
    });
  });

  describe('dropColumn', () => {
    it('should generate DROP COLUMN sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropColumn({ table: 'users', columnName: 'age' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE `users` DROP COLUMN `age`');
    });
  });

  describe('renameColumn', () => {
    it('should use CHANGE COLUMN with existing definition', async () => {
      await connectDriver(driver);
      // getColumns call
      mockQuery.mockResolvedValueOnce([
        [{ name: 'name', type: 'varchar', nullable: 'NO', defaultValue: null, columnKey: '', extra: '', length: 100, precision: null, scale: null, comment: '' }],
        [],
      ]);
      // CHANGE COLUMN query
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CHANGE COLUMN `name`');
      expect(result.sql).toContain('`full_name`');
    });

    it('should fail when column not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[], []]);

      const result = await driver.renameColumn({ table: 'users', oldName: 'missing', newName: 'new_name' });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Column 'missing' not found");
    });
  });

  describe('createIndex', () => {
    it('should create a regular index', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_name', columns: ['name'] },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('CREATE INDEX `idx_name` ON `users` (`name`)');
    });

    it('should create a unique index with type', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_email', columns: ['email'], unique: true, type: 'BTREE' },
      });
      expect(result.sql).toContain('UNIQUE');
      expect(result.sql).toContain('USING BTREE');
    });
  });

  describe('dropIndex', () => {
    it('should generate DROP INDEX ON table sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropIndex({ table: 'users', indexName: 'idx_name' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP INDEX `idx_name` ON `users`');
    });
  });

  describe('addForeignKey', () => {
    it('should generate ADD CONSTRAINT sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

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
      expect(result.sql).toContain('ADD CONSTRAINT `fk_user`');
      expect(result.sql).toContain('REFERENCES `users`');
      expect(result.sql).toContain('ON UPDATE CASCADE');
      expect(result.sql).toContain('ON DELETE SET NULL');
    });
  });

  describe('dropForeignKey', () => {
    it('should generate DROP FOREIGN KEY sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropForeignKey({ table: 'orders', constraintName: 'fk_user' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE `orders` DROP FOREIGN KEY `fk_user`');
    });
  });

  describe('createTable', () => {
    it('should create a simple table', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'products',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'name', type: 'VARCHAR', length: 100, nullable: false },
          ],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TABLE `products`');
      expect(result.sql).toContain('AUTO_INCREMENT');
      expect(result.sql).toContain('PRIMARY KEY (`id`)');
    });

    it('should include comment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'logs',
          columns: [{ name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true }],
          comment: 'Audit logs',
        },
      });
      expect(result.sql).toContain("COMMENT='Audit logs'");
    });

    it('should include indexes and foreign keys', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true, autoIncrement: true },
            { name: 'user_id', type: 'INT', nullable: false },
          ],
          indexes: [{ name: 'idx_user', columns: ['user_id'] }],
          foreignKeys: [{
            name: 'fk_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onDelete: 'CASCADE',
          }],
        },
      });
      expect(result.sql).toContain('INDEX `idx_user`');
      expect(result.sql).toContain('CONSTRAINT `fk_user`');
      expect(result.sql).toContain('ON DELETE CASCADE');
    });
  });

  describe('dropTable', () => {
    it('should generate DROP TABLE sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropTable({ table: 'users' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TABLE `users`');
    });
  });

  describe('renameTable', () => {
    it('should generate RENAME TABLE sql', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameTable({ oldName: 'users', newName: 'accounts' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('RENAME TABLE `users` TO `accounts`');
    });
  });

  describe('insertRow', () => {
    it('should insert row with params', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Bob', email: 'bob@test.com' },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('INSERT INTO `users`');
    });
  });

  describe('deleteRow', () => {
    it('should delete row by primary key', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { id: 42 },
      });
      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(result.sql).toContain('DELETE FROM `users`');
      expect(result.sql).toContain('`id` = ?');
    });
  });

  // ─────────── View operations ───────────
  describe('createView', () => {
    it('should create a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createView({
        view: { name: 'active_users', selectStatement: 'SELECT * FROM users WHERE active = 1' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE VIEW `active_users`');
    });

    it('should use CREATE OR REPLACE when requested', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createView({
        view: { name: 'v', selectStatement: 'SELECT 1', replaceIfExists: true },
      });
      expect(result.sql).toContain('CREATE OR REPLACE VIEW');
    });
  });

  describe('dropView', () => {
    it('should drop a view', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropView({ viewName: 'active_users' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP VIEW IF EXISTS `active_users`');
    });
  });

  describe('renameView', () => {
    it('should use RENAME TABLE for views', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameView({ oldName: 'v1', newName: 'v2' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('RENAME TABLE `v1` TO `v2`');
    });
  });

  describe('getViewDDL', () => {
    it('should return the view DDL', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ 'Create View': 'CREATE VIEW `v` AS SELECT * FROM users' }],
        [],
      ]);

      const ddl = await driver.getViewDDL('v');
      expect(ddl).toBe('CREATE VIEW `v` AS SELECT * FROM users');
    });
  });

  // ─────────── MySQL-specific: charsets ───────────
  describe('getCharsets', () => {
    it('should return charset info', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ Charset: 'utf8mb4', Description: 'UTF-8 Unicode', 'Default collation': 'utf8mb4_0900_ai_ci', Maxlen: 4 }],
        [],
      ]);

      const charsets = await driver.getCharsets();
      expect(charsets).toHaveLength(1);
      expect(charsets[0]).toEqual({
        charset: 'utf8mb4',
        description: 'UTF-8 Unicode',
        defaultCollation: 'utf8mb4_0900_ai_ci',
        maxLength: 4,
      });
    });
  });

  describe('getCollations', () => {
    it('should return all collations', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ Collation: 'utf8mb4_0900_ai_ci', Charset: 'utf8mb4', Id: 255, Default: 'Yes', Compiled: 'Yes', Sortlen: 0 }],
        [],
      ]);

      const collations = await driver.getCollations();
      expect(collations).toHaveLength(1);
      expect(collations[0]).toEqual(expect.objectContaining({ collation: 'utf8mb4_0900_ai_ci', isDefault: true }));
    });

    it('should filter by charset', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getCollations('utf8mb4');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE Charset = ?'),
        ['utf8mb4'],
      );
    });
  });

  describe('setTableCharset', () => {
    it('should alter table charset', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.setTableCharset('users', 'utf8mb4', 'utf8mb4_unicode_ci');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CONVERT TO CHARACTER SET utf8mb4');
      expect(result.sql).toContain('COLLATE utf8mb4_unicode_ci');
    });
  });

  describe('setDatabaseCharset', () => {
    it('should alter database charset', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.setDatabaseCharset('testdb', 'utf8mb4');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER DATABASE `testdb` CHARACTER SET utf8mb4');
    });
  });

  // ─────────── MySQL-specific: partitions ───────────
  describe('getPartitions', () => {
    it('should return partition info', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [
          {
            partitionName: 'p0',
            subpartitionName: null,
            partitionOrdinalPosition: 1,
            subpartitionOrdinalPosition: null,
            partitionMethod: 'RANGE',
            subpartitionMethod: null,
            partitionExpression: '`year`',
            subpartitionExpression: null,
            partitionDescription: '2020',
            tableRows: 1000,
            avgRowLength: 120,
            dataLength: 120000,
            indexLength: 8192,
            partitionComment: '',
          },
        ],
        [],
      ]);

      const partitions = await driver.getPartitions('sales');
      expect(partitions).toHaveLength(1);
      expect(partitions[0]).toEqual(
        expect.objectContaining({ partitionName: 'p0', partitionMethod: 'RANGE', tableRows: 1000 }),
      );
    });

    it('should filter out null partition names', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ partitionName: null, subpartitionName: null, partitionOrdinalPosition: null, subpartitionOrdinalPosition: null, partitionMethod: null, subpartitionMethod: null, partitionExpression: null, subpartitionExpression: null, partitionDescription: null, tableRows: 100, avgRowLength: 50, dataLength: 5000, indexLength: 1024, partitionComment: '' }],
        [],
      ]);

      const partitions = await driver.getPartitions('users');
      expect(partitions).toHaveLength(0);
    });
  });

  describe('createPartition', () => {
    it('should create RANGE partition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createPartition('sales', 'p2024', 'RANGE', '`year`', '2025');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('VALUES LESS THAN (2025)');
    });

    it('should create LIST partition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createPartition('logs', 'p_error', 'LIST', '`level`', "'error','critical'");
      expect(result.success).toBe(true);
      expect(result.sql).toContain('VALUES IN (');
    });

    it('should create HASH partition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createPartition('data', 'p3', 'HASH', '`id`');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('PARTITION p3');
    });
  });

  describe('dropPartition', () => {
    it('should drop a partition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropPartition('sales', 'p2020');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('ALTER TABLE `sales` DROP PARTITION p2020');
    });
  });

  // ─────────── MySQL-specific: events ───────────
  describe('getEvents', () => {
    it('should return events', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{
          name: 'cleanup_job',
          database: 'testdb',
          definer: 'root@localhost',
          timeZone: 'UTC',
          eventType: 'RECURRING',
          executeAt: null,
          intervalValue: 1,
          intervalField: 'DAY',
          sqlMode: 'STRICT_TRANS_TABLES',
          starts: '2024-01-01',
          ends: null,
          status: EventStatus.Enabled,
          onCompletion: 'PRESERVE',
          created: '2024-01-01',
          lastAltered: '2024-01-01',
          lastExecuted: '2024-06-15',
          eventComment: 'Daily cleanup',
          originator: 1,
          characterSetClient: 'utf8mb4',
          collationConnection: 'utf8mb4_0900_ai_ci',
          databaseCollation: 'utf8mb4_0900_ai_ci',
        }],
        [],
      ]);

      const events = await driver.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(
        expect.objectContaining({
          name: 'cleanup_job',
          eventType: 'RECURRING',
          status: EventStatus.Enabled,
          eventComment: 'Daily cleanup',
        }),
      );
    });
  });

  describe('getEventDefinition', () => {
    it('should return event definition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ 'Create Event': 'CREATE EVENT `cleanup` ON SCHEDULE ...' }],
        [],
      ]);

      const def = await driver.getEventDefinition('cleanup');
      expect(def).toBe('CREATE EVENT `cleanup` ON SCHEDULE ...');
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const def = await driver.getEventDefinition('secret');
      expect(def).toContain('Error getting event definition');
    });
  });

  describe('createEvent', () => {
    it('should create an event with options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createEvent(
        'cleanup',
        'EVERY 1 DAY',
        'DELETE FROM sessions WHERE expired = 1',
        { onCompletion: 'PRESERVE', status: 'ENABLED', comment: "nightly cleanup" },
      );
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE EVENT `cleanup`');
      expect(result.sql).toContain('ON SCHEDULE EVERY 1 DAY');
      expect(result.sql).toContain('ON COMPLETION PRESERVE');
      expect(result.sql).toContain('ENABLED');
      expect(result.sql).toContain("COMMENT 'nightly cleanup'");
    });
  });

  describe('dropEvent', () => {
    it('should drop an event', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropEvent('cleanup');
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP EVENT IF EXISTS `cleanup`');
    });
  });

  describe('alterEvent', () => {
    it('should alter event with all options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('cleanup', {
        schedule: 'EVERY 2 HOURS',
        newName: 'cleanup_v2',
        status: 'DISABLED',
        onCompletion: 'NOT PRESERVE',
        comment: 'updated',
        body: 'DELETE FROM old_data',
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ALTER EVENT `cleanup`');
      expect(result.sql).toContain('ON SCHEDULE EVERY 2 HOURS');
      expect(result.sql).toContain('RENAME TO `cleanup_v2`');
      expect(result.sql).toContain('DISABLED');
      expect(result.sql).toContain("COMMENT 'updated'");
      expect(result.sql).toContain('DO DELETE FROM old_data');
    });
  });

  // ─────────── Triggers ───────────
  describe('getTriggers', () => {
    it('should return triggers', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'trg_audit', table_name: 'users', event: 'INSERT', timing: 'AFTER', action_statement: 'INSERT INTO audit ...', created_at: '2024-01-01' }],
        [],
      ]);

      const triggers = await driver.getTriggers();
      expect(triggers).toHaveLength(1);
      expect(triggers[0]).toEqual(
        expect.objectContaining({ name: 'trg_audit', table: 'users', event: 'INSERT', timing: 'AFTER' }),
      );
    });

    it('should filter by table', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTriggers('users');
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('EVENT_OBJECT_TABLE = ?');
    });
  });

  describe('getTriggerDefinition', () => {
    it('should return trigger definition', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ 'SQL Original Statement': 'CREATE TRIGGER trg ...' }],
        [],
      ]);

      const def = await driver.getTriggerDefinition('trg');
      expect(def).toBe('CREATE TRIGGER trg ...');
    });
  });

  describe('createTrigger', () => {
    it('should create a trigger', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_audit',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'BEGIN INSERT INTO audit VALUES (NEW.id); END',
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE TRIGGER `trg_audit`');
      expect(result.sql).toContain('AFTER INSERT');
      expect(result.sql).toContain('ON `users` FOR EACH ROW');
    });
  });

  describe('dropTrigger', () => {
    it('should drop a trigger', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.dropTrigger({ triggerName: 'trg_audit' });
      expect(result.success).toBe(true);
      expect(result.sql).toBe('DROP TRIGGER IF EXISTS `trg_audit`');
    });
  });

  // ─────────── getUsers ───────────
  describe('getUsers', () => {
    it('should return user list', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'root', host: 'localhost', superuser: 1, create_role: 1, create_db: 1 }],
        [],
      ]);

      const users = await driver.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual(
        expect.objectContaining({ name: 'root', host: 'localhost', superuser: true }),
      );
    });

    it('should fallback when access denied', async () => {
      await connectDriver(driver);
      // first query fails
      mockQuery.mockRejectedValueOnce(new Error('access denied'));
      // fallback query
      mockQuery.mockResolvedValueOnce([
        [{ user: 'app@%' }],
        [],
      ]);

      const users = await driver.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('app');
    });
  });

  // ─────────── createUser ───────────
  describe('createUser', () => {
    it('should create user with password', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'secret123' },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain("CREATE USER 'testuser'@'%' IDENTIFIED BY '****'");
      expect(mockQuery).toHaveBeenCalledWith(
        "CREATE USER 'testuser'@'%' IDENTIFIED BY ?",
        ['secret123']
      );
    });

    it('should create user without password', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await driver.createUser({
        user: { name: 'testuser' },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toBe("CREATE USER 'testuser'@'%'");
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('User already exists'));

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'pw' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('User already exists');
    });
  });

  // ─────────── dropUser ───────────
  describe('dropUser', () => {
    it('should drop user with default host', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await driver.dropUser({ name: 'testuser' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe("DROP USER 'testuser'@'%'");
    });

    it('should drop user with specific host', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);

      const result = await driver.dropUser({ name: 'testuser', host: 'localhost' });

      expect(result.success).toBe(true);
      expect(result.sql).toBe("DROP USER 'testuser'@'localhost'");
    });

    it('should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('Cannot drop'));

      const result = await driver.dropUser({ name: 'u' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot drop');
    });
  });

  // ─────────── connect with SSL ───────────
  describe('connect with SSL', () => {
    it('should connect with SSL Require mode', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.Require,
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL VerifyCA mode', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.VerifyCA,
          ca: 'ca-cert',
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL VerifyFull mode', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: {
          enabled: true,
          mode: SSLMode.VerifyFull,
          ca: 'ca-cert',
          cert: 'client-cert',
          key: 'client-key',
        },
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should connect with SSL Prefer mode', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

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
      mockCreateConnection.mockRejectedValueOnce(new Error('SSL error'));
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

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
      mockCreateConnection.mockRejectedValueOnce(new Error('SSL error'));
      mockCreateConnection.mockRejectedValueOnce(new Error('connection refused'));

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
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

      await driver.connect(createConfig({
        ssl: false,
        sslConfig: {
          enabled: false,
          mode: SSLMode.Disable,
        },
      }));
      expect(driver.isConnected).toBe(true);
      expect(mockCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({ ssl: undefined }),
      );
    });

    it('should use rejectUnauthorized from sslConfig when Require mode', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

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

    it('should cleanup existing connection during Prefer fallback', async () => {
      // Simulate the case where createConnection partially succeeds (returns a conn)
      // but then the catch block has an existing connection to clean up
      const failConn = createMockConnection();
      mockCreateConnection.mockImplementationOnce(async () => {
        // Store the connection on the driver, then throw
        (driver as any).connection = failConn;
        throw new Error('SSL handshake failed');
      });
      const conn2 = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn2);

      await driver.connect(createConfig({
        ssl: true,
        sslConfig: { enabled: true, mode: SSLMode.Prefer },
      }));
      expect(driver.isConnected).toBe(true);
      // The cleanup should have called end() on the failed connection
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  // ─────────── getTableData with filters, sorting, limit/offset ───────────
  describe('getTableData', () => {
    it('should return table data without filters', async () => {
      await connectDriver(driver);
      // count query
      mockQuery.mockResolvedValueOnce([[{ count: 10 }], []]);
      // getColumns
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: 'auto_increment', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      // data query
      mockQuery.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]);

      const result = await driver.getTableData('users', {});
      expect(result.totalCount).toBe(10);
      expect(result.rows).toHaveLength(2);
      expect(result.columns).toHaveLength(1);
    });

    it('should build WHERE clause with IS NULL filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 3 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'email', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 255, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NULL', value: null }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IS NULL');
    });

    it('should build WHERE clause with IS NOT NULL filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 7 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'email', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 255, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NOT NULL', value: null }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IS NOT NULL');
    });

    it('should build WHERE clause with IN filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 2 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'status', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 50, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: 'IN', value: ['active', 'pending'] }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('IN');
    });

    it('should build WHERE clause with NOT IN filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 8 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'status', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 50, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: 'NOT IN', value: ['banned'] }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('NOT IN');
    });

    it('should build WHERE clause with LIKE filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 4 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'name', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 255, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'LIKE', value: 'john' }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('LIKE');
    });

    it('should build WHERE clause with NOT LIKE filter', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 6 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'name', type: 'varchar', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: 255, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: 'test' }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('NOT LIKE');
    });

    it('should build WHERE clause with default operator', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 1 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: '', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[{ id: 1 }], []]);

      await driver.getTableData('users', {
        filters: [{ column: 'id', operator: '=', value: 1 }],
      });
      const countQuery = mockQuery.mock.calls[0][0] as string;
      expect(countQuery).toContain('`id` = ?');
    });

    it('should include ORDER BY clause', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 10 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: '', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[{ id: 1 }], []]);

      await driver.getTableData('users', { orderBy: 'id', orderDirection: 'DESC' });
      const dataQuery = mockQuery.mock.calls[2][0] as string;
      expect(dataQuery).toContain('ORDER BY `id` DESC');
    });

    it('should include LIMIT and OFFSET', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 50 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: '', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[{ id: 11 }], []]);

      const result = await driver.getTableData('users', { limit: 10, offset: 10 });
      const dataQuery = mockQuery.mock.calls[2][0] as string;
      expect(dataQuery).toContain('LIMIT 10');
      expect(dataQuery).toContain('OFFSET 10');
      expect(result.offset).toBe(10);
      expect(result.limit).toBe(10);
    });

    it('should default ORDER BY direction to ASC', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 5 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: '', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[{ id: 1 }], []]);

      await driver.getTableData('users', { orderBy: 'name' });
      const dataQuery = mockQuery.mock.calls[2][0] as string;
      expect(dataQuery).toContain('ORDER BY `name` ASC');
    });

    it('should combine multiple filters with AND', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([[{ count: 1 }], []]);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: '', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([[], []]);

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
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);
      // version query
      mockQuery.mockResolvedValueOnce([
        [{ version: '8.0.32' }],
        [{ name: 'version', type: 253, flags: 0 }],
      ]);
      // charset
      mockQuery.mockResolvedValueOnce([
        [{ Value: 'utf8mb4' }],
        [{ name: 'Value', type: 253, flags: 0 }],
      ]);
      // max_connections
      mockQuery.mockResolvedValueOnce([
        [{ Value: '151' }],
        [{ name: 'Value', type: 253, flags: 0 }],
      ]);
      // timezone
      mockQuery.mockResolvedValueOnce([
        [{ tz: 'UTC' }],
        [{ name: 'tz', type: 253, flags: 0 }],
      ]);

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('8.0.32');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return error on connection failure', async () => {
      mockCreateConnection.mockRejectedValueOnce(new Error('host not found'));

      const result = await driver.testConnection(createConfig());
      expect(result.success).toBe(false);
      expect(result.error).toBe('host not found');
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
      // getColumns
      mockQuery.mockResolvedValueOnce([
        [{ name: 'name', type: 'varchar', nullable: 'NO', defaultValue: null, columnKey: '', extra: '', length: 100, precision: null, scale: null, comment: '' }],
        [],
      ]);
      // CHANGE COLUMN fails
      mockQuery.mockRejectedValueOnce(new Error('rename error'));

      const result = await driver.renameColumn({ table: 'users', oldName: 'name', newName: 'full_name' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('rename error');
    });

    it('createIndex should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('index exists'));

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx_dup', columns: ['email'] },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('index exists');
    });

    it('dropIndex should return error on failure', async () => {
      await connectDriver(driver);
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
          columns: [{ name: 'id', type: 'INT', nullable: false, primaryKey: true }],
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

    it('modifyColumn should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('type mismatch'));

      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'JSON', nullable: true },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('type mismatch');
    });

    it('setTableCharset should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('unknown charset'));

      const result = await driver.setTableCharset('users', 'invalid_charset');
      expect(result.success).toBe(false);
      expect(result.error).toBe('unknown charset');
    });

    it('setDatabaseCharset should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('permission denied'));

      const result = await driver.setDatabaseCharset('testdb', 'utf8mb4', 'bad_collation');
      expect(result.success).toBe(false);
      expect(result.error).toBe('permission denied');
    });

    it('createPartition should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('partition error'));

      const result = await driver.createPartition('sales', 'p_new', 'RANGE', 'year', '2025');
      expect(result.success).toBe(false);
      expect(result.error).toBe('partition error');
    });

    it('dropPartition should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('partition not found'));

      const result = await driver.dropPartition('sales', 'p_missing');
      expect(result.success).toBe(false);
      expect(result.error).toBe('partition not found');
    });

    it('createEvent should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('event error'));

      const result = await driver.createEvent('bad_event', 'EVERY 1 DAY', 'SELECT 1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('event error');
    });

    it('dropEvent should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('event not found'));

      const result = await driver.dropEvent('missing_event');
      expect(result.success).toBe(false);
      expect(result.error).toBe('event not found');
    });

    it('alterEvent should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('alter error'));

      const result = await driver.alterEvent('cleanup', { status: 'DISABLED' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('alter error');
    });

    it('createTrigger should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('trigger error'));

      const result = await driver.createTrigger({
        trigger: {
          name: 'trg_bad',
          table: 'users',
          timing: 'AFTER',
          event: 'INSERT',
          body: 'BEGIN END',
        },
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('trigger error');
    });

    it('dropTrigger should return error on failure', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('trigger not found'));

      const result = await driver.dropTrigger({ triggerName: 'trg_missing' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('trigger not found');
    });
  });

  // ─────────── getRoutineDefinition edge cases ───────────
  describe('getRoutineDefinition edge cases', () => {
    it('should return fallback when procedure not found', async () => {
      await connectDriver(driver);
      mockExecute.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const def = await driver.getRoutineDefinition('missing', RoutineType.Procedure);
      expect(def).toContain('PROCEDURE');
      expect(def).toContain('not found');
    });

    it('should handle non-Error exception', async () => {
      await connectDriver(driver);
      mockExecute.mockRejectedValueOnce('string error');

      const def = await driver.getRoutineDefinition('bad_fn', RoutineType.Function);
      expect(def).toContain('Error getting');
      expect(def).toContain('string error');
    });
  });

  // ─────────── getUsers fallback edge cases ───────────
  describe('getUsers fallback edge cases', () => {
    it('should handle unknown format in fallback', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('access denied'));
      mockQuery.mockResolvedValueOnce([
        [{ user: 'unknown@%' }],
        [],
      ]);

      const users = await driver.getUsers();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('unknown');
      expect(users[0].host).toBe('%');
    });
  });

  // ─────────── createPartition types ───────────
  describe('createPartition types', () => {
    it('should create KEY partition (same as HASH)', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createPartition('data', 'p4', 'KEY', '`id`');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('PARTITION p4');
      expect(result.sql).not.toContain('VALUES');
    });
  });

  // ─────────── alterEvent with individual options ───────────
  describe('alterEvent with individual options', () => {
    it('should alter event with only schedule', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('job', { schedule: 'EVERY 1 HOUR' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON SCHEDULE EVERY 1 HOUR');
      expect(result.sql).not.toContain('RENAME');
      expect(result.sql).not.toContain('DO');
    });

    it('should alter event with only body', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('job', { body: 'SELECT 1' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DO SELECT 1');
    });

    it('should alter event with only onCompletion', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('job', { onCompletion: 'PRESERVE' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON COMPLETION PRESERVE');
    });

    it('should alter event with only newName', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('old_job', { newName: 'new_job' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('RENAME TO `new_job`');
    });

    it('should alter event with only status', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('job', { status: 'ENABLED' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ENABLED');
    });

    it('should alter event with empty comment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.alterEvent('job', { comment: '' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("COMMENT ''");
    });
  });

  // ─────────── cancelQuery edge cases ───────────
  describe('cancelQuery edge cases', () => {
    it('should return false when no connection', async () => {
      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });

    it('should return false when no threadId', async () => {
      const conn = { ...createMockConnection(), threadId: null };
      mockCreateConnection.mockResolvedValueOnce(conn);
      await driver.connect(createConfig());

      // Simulate query running
      (driver as any).isQueryRunning = true;

      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });

    it('should successfully cancel when query is running', async () => {
      await connectDriver(driver);
      (driver as any).isQueryRunning = true;

      const tempMockQuery = vi.fn().mockResolvedValueOnce([[], []]);
      const tempMockEnd = vi.fn().mockResolvedValueOnce(undefined);
      mockCreateConnection.mockResolvedValueOnce({
        query: tempMockQuery,
        execute: vi.fn(),
        end: tempMockEnd,
        threadId: 99999,
      });

      const result = await driver.cancelQuery();
      expect(result).toBe(true);
      expect(tempMockEnd).toHaveBeenCalled();
    });

    it('should return false when cancel connection fails', async () => {
      await connectDriver(driver);
      (driver as any).isQueryRunning = true;

      mockCreateConnection.mockRejectedValueOnce(new Error('connection failed'));

      const result = await driver.cancelQuery();
      expect(result).toBe(false);
    });

    it('should handle end() error in finally block', async () => {
      await connectDriver(driver);
      (driver as any).isQueryRunning = true;

      const tempMockQuery = vi.fn().mockResolvedValueOnce([[], []]);
      const tempMockEnd = vi.fn().mockRejectedValueOnce(new Error('end failed'));
      mockCreateConnection.mockResolvedValueOnce({
        query: tempMockQuery,
        execute: vi.fn(),
        end: tempMockEnd,
        threadId: 99999,
      });

      const result = await driver.cancelQuery();
      expect(result).toBe(true);
    });
  });

  // ─────────── buildColumnDefinition branches ───────────
  describe('buildColumnDefinition branches', () => {
    it('should handle precision and scale', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'products',
        column: { name: 'price', type: 'DECIMAL', precision: 10, scale: 2, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DECIMAL(10,2)');
    });

    it('should handle precision-only', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'data',
        column: { name: 'val', type: 'FLOAT', precision: 5, nullable: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('FLOAT(5)');
    });

    it('should handle auto-increment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'seq', type: 'INT', nullable: false, autoIncrement: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('AUTO_INCREMENT');
    });

    it('should handle comment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'notes', type: 'TEXT', nullable: true, comment: "user's notes" },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("COMMENT 'user''s notes'");
    });

    it('should handle default value with string', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'status', type: 'VARCHAR', length: 50, nullable: true, defaultValue: 'active' },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'active'");
    });

    it('should handle numeric default value', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'score', type: 'INT', nullable: true, defaultValue: 0 },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('DEFAULT 0');
    });

    it('should handle unique non-PK column', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'code', type: 'VARCHAR', length: 50, nullable: false, unique: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('UNIQUE');
    });

    it('should not add UNIQUE when primaryKey is true', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'pk_col', type: 'INT', nullable: false, primaryKey: true, unique: true },
      });
      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('UNIQUE');
    });
  });

  // ─────────── renameColumn with precision and auto-increment ───────────
  describe('renameColumn additional branches', () => {
    it('should handle column with precision and scale', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'price', type: 'decimal', nullable: 'YES', defaultValue: null, columnKey: '', extra: '', length: null, precision: 10, scale: 2, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameColumn({ table: 'products', oldName: 'price', newName: 'amount' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('(10,2)');
    });

    it('should handle column with auto-increment', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'id', type: 'int', nullable: 'NO', defaultValue: null, columnKey: 'PRI', extra: 'auto_increment', length: null, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameColumn({ table: 'users', oldName: 'id', newName: 'user_id' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('AUTO_INCREMENT');
    });

    it('should handle column with default value', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ name: 'status', type: 'varchar', nullable: 'YES', defaultValue: "'active'", columnKey: '', extra: '', length: 50, precision: null, scale: null, comment: '' }],
        [],
      ]);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.renameColumn({ table: 'users', oldName: 'status', newName: 'state' });
      expect(result.success).toBe(true);
      expect(result.sql).toContain("DEFAULT 'active'");
    });
  });

  // ─────────── createTable additional branches ───────────
  describe('createTable additional branches', () => {
    it('should use table.primaryKey when no column-level PKs', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'composite_pk',
          columns: [
            { name: 'a', type: 'INT', nullable: false },
            { name: 'b', type: 'INT', nullable: false },
          ],
          primaryKey: ['a', 'b'],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('PRIMARY KEY (`a`, `b`)');
    });

    it('should include unique indexes', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'indexed_table',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true },
            { name: 'email', type: 'VARCHAR', length: 255, nullable: true },
          ],
          indexes: [{ name: 'idx_email', columns: ['email'], unique: true }],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('UNIQUE INDEX `idx_email`');
    });
  });

  // ─────────── getEventDefinition edge cases ───────────
  describe('getEventDefinition edge cases', () => {
    it('should return fallback when event not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const def = await driver.getEventDefinition('missing');
      expect(def).toContain("EVENT 'missing' not found");
    });

    it('should handle non-Error exception', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce('string error');

      const def = await driver.getEventDefinition('bad_event');
      expect(def).toContain('Error getting event definition');
      expect(def).toContain('string error');
    });
  });

  // ─────────── getTriggerDefinition edge cases ───────────
  describe('getTriggerDefinition edge cases', () => {
    it('should return fallback when trigger not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const def = await driver.getTriggerDefinition('missing_trg');
      expect(def).toContain("Trigger 'missing_trg' not found");
    });

    it('should return error message on exception', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce(new Error('access denied'));

      const def = await driver.getTriggerDefinition('secret_trg');
      expect(def).toContain('Error getting trigger definition');
      expect(def).toContain('access denied');
    });

    it('should handle non-Error exception', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce('string error');

      const def = await driver.getTriggerDefinition('bad_trg');
      expect(def).toContain('Error getting trigger definition');
      expect(def).toContain('string error');
    });
  });

  // ─────────── getViewDDL edge cases ───────────
  describe('getViewDDL edge cases', () => {
    it('should return empty string when view not found', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const ddl = await driver.getViewDDL('missing_view');
      expect(ddl).toBe('');
    });
  });

  // ─────────── getTableDDL edge case: returns empty ───────────
  describe('getTableDDL edge cases', () => {
    it('should return empty string when neither Create Table nor Create View exists', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{}],
        [],
      ]);

      const ddl = await driver.getTableDDL('missing');
      expect(ddl).toBe('');
    });
  });

  // ─────────── execute edge cases ───────────
  describe('execute edge cases', () => {
    it('should handle non-Error thrown from query', async () => {
      await connectDriver(driver);
      mockQuery.mockRejectedValueOnce('string error');

      const result = await driver.execute('BAD SQL');
      expect(result.error).toBe('string error');
    });

    it('should handle undefined typeId', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ col: 'x' }],
        [{ name: 'col', type: undefined, flags: 0 }],
      ]);

      const result = await driver.execute('SELECT col FROM t');
      expect(result.columns[0].type).toBe('DECIMAL');
    });

    it('should handle unknown typeId', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([
        [{ col: 'x' }],
        [{ name: 'col', type: 99999, flags: 0 }],
      ]);

      const result = await driver.execute('SELECT col FROM t');
      expect(result.columns[0].type).toBe('UNKNOWN');
    });
  });

  // ─────────── connect edge cases ───────────
  describe('connect edge cases', () => {
    it('should handle missing database', async () => {
      const conn = createMockConnection();
      mockCreateConnection.mockResolvedValueOnce(conn);

      await driver.connect(createConfig({ database: '' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle non-Error thrown during connect', async () => {
      mockCreateConnection.mockRejectedValueOnce('string error');
      await expect(driver.connect(createConfig())).rejects.toBe('string error');
      expect(driver.isConnected).toBe(false);
    });
  });

  // ─────────── createEvent without options ───────────
  describe('createEvent without options', () => {
    it('should create event without any options', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createEvent('simple_event', 'AT CURRENT_TIMESTAMP', 'SELECT 1');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('CREATE EVENT `simple_event`');
      expect(result.sql).toContain('DO SELECT 1');
      expect(result.sql).not.toContain('ON COMPLETION');
      expect(result.sql).not.toContain('ENABLED');
      expect(result.sql).not.toContain('COMMENT');
    });
  });

  // ─────────── setTableCharset without collation ───────────
  describe('setTableCharset without collation', () => {
    it('should alter without COLLATE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.setTableCharset('users', 'utf8mb4');
      expect(result.success).toBe(true);
      expect(result.sql).not.toContain('COLLATE');
    });
  });

  // ─────────── setDatabaseCharset with collation ───────────
  describe('setDatabaseCharset with collation', () => {
    it('should include COLLATE clause', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.setDatabaseCharset('testdb', 'utf8mb4', 'utf8mb4_unicode_ci');
      expect(result.success).toBe(true);
      expect(result.sql).toContain('COLLATE utf8mb4_unicode_ci');
    });
  });

  // ─────────── addForeignKey without onUpdate/onDelete ───────────
  describe('addForeignKey without onUpdate/onDelete', () => {
    it('should omit ON UPDATE and ON DELETE', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

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

  // ─────────── createTable with FKs with onUpdate ───────────
  describe('createTable FK with onUpdate', () => {
    it('should include ON UPDATE in FK', async () => {
      await connectDriver(driver);
      mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }, []]);

      const result = await driver.createTable({
        table: {
          name: 'orders',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true },
            { name: 'user_id', type: 'INT', nullable: false },
          ],
          foreignKeys: [{
            name: 'fk_user',
            columns: ['user_id'],
            referencedTable: 'users',
            referencedColumns: ['id'],
            onUpdate: 'CASCADE',
          }],
        },
      });
      expect(result.success).toBe(true);
      expect(result.sql).toContain('ON UPDATE CASCADE');
    });
  });
});
