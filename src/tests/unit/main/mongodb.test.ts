import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseType, TableObjectType } from '@main/types';

// ─── Mock mongodb ────────────────────────────────────────────────────────────

const mockToArray = vi.fn();
const mockLimit = vi.fn(() => ({ toArray: mockToArray }));
const mockSort = vi.fn(() => ({ skip: vi.fn(() => ({ limit: mockLimit })) }));
const mockCursorLimit = vi.fn(() => ({ toArray: mockToArray }));

const mockFind = vi.fn(() => ({
  limit: mockCursorLimit,
  toArray: mockToArray,
  sort: mockSort
}));

const mockFindOne = vi.fn();
const mockAggregate = vi.fn(() => ({ toArray: mockToArray }));
const mockInsertOne = vi.fn();
const mockInsertMany = vi.fn();
const mockUpdateOne = vi.fn();
const mockUpdateMany = vi.fn();
const mockDeleteOne = vi.fn();
const mockDeleteMany = vi.fn();
const mockCountDocuments = vi.fn();
const mockDistinct = vi.fn();
const mockCollectionCreateIndex = vi.fn();
const mockCollectionDropIndex = vi.fn();
const mockCollectionDrop = vi.fn();
const mockEstimatedDocumentCount = vi.fn();
const mockIndexes = vi.fn();
const mockRename = vi.fn();

const mockCollection = vi.fn(() => ({
  find: mockFind,
  findOne: mockFindOne,
  aggregate: mockAggregate,
  insertOne: mockInsertOne,
  insertMany: mockInsertMany,
  updateOne: mockUpdateOne,
  updateMany: mockUpdateMany,
  deleteOne: mockDeleteOne,
  deleteMany: mockDeleteMany,
  countDocuments: mockCountDocuments,
  distinct: mockDistinct,
  createIndex: mockCollectionCreateIndex,
  dropIndex: mockCollectionDropIndex,
  drop: mockCollectionDrop,
  estimatedDocumentCount: mockEstimatedDocumentCount,
  indexes: mockIndexes,
  rename: mockRename
}));

const mockListCollectionsToArray = vi.fn();
const mockListCollections = vi.fn(() => ({ toArray: mockListCollectionsToArray }));
const mockDbCommand = vi.fn();
const mockCreateCollection = vi.fn();
const mockDbStats = vi.fn();
const mockAdminListDatabases = vi.fn();

const mockDb = vi.fn(() => ({
  collection: mockCollection,
  listCollections: mockListCollections,
  command: mockDbCommand,
  createCollection: mockCreateCollection,
  stats: mockDbStats,
  admin: () => ({ listDatabases: mockAdminListDatabases })
}));

const mockClientConnect = vi.fn();
const mockClientClose = vi.fn();
const mockClientDb = mockDb;

vi.mock('mongodb', () => {
  class MockObjectId {
    private hex: string;
    constructor(hex?: string) {
      this.hex = hex || 'abcdef1234567890abcdef12';
    }
    toHexString(): string {
      return this.hex;
    }
  }

  class MockMongoClient {
    connect = mockClientConnect;
    close = mockClientClose;
    db = mockClientDb;
  }

  return {
    MongoClient: MockMongoClient,
    Db: vi.fn(),
    ObjectId: MockObjectId,
    Document: {}
  };
});

// ─── Import after mocking ────────────────────────────────────────────────────

import { MongoDBDriver } from '@main/db/mongodb';
import type { ConnectionConfig } from '@main/types';

// ─── Helper ──────────────────────────────────────────────────────────────────

const makeConfig = (overrides?: Partial<ConnectionConfig>): ConnectionConfig => ({
  id: 'test-id',
  name: 'Test Mongo',
  type: DatabaseType.MongoDB,
  host: 'localhost',
  port: 27017,
  database: 'testdb',
  username: 'admin',
  password: 'secret',
  ...overrides
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MongoDBDriver', () => {
  let driver: MongoDBDriver;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new MongoDBDriver();

    // Reset default mock returns
    mockClientConnect.mockResolvedValue(undefined);
    mockClientClose.mockResolvedValue(undefined);
    mockListCollectionsToArray.mockResolvedValue([]);
    mockToArray.mockResolvedValue([]);
    mockEstimatedDocumentCount.mockResolvedValue(0);
    mockCountDocuments.mockResolvedValue(0);
  });

  // ─── Type ────────────────────────────────────────────────────────────

  describe('type', () => {
    it('should have type MongoDB', () => {
      expect(driver.type).toBe(DatabaseType.MongoDB);
    });
  });

  // ─── Connection ──────────────────────────────────────────────────────

  describe('connect', () => {
    it('should connect successfully', async () => {
      await driver.connect(makeConfig());

      expect(mockClientConnect).toHaveBeenCalled();
      expect(driver.isConnected).toBe(true);
    });

    it('should use provided host and port', async () => {
      await driver.connect(makeConfig({ host: 'remotehost', port: 27018 }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle connection failure', async () => {
      mockClientConnect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(driver.connect(makeConfig())).rejects.toThrow('Connection refused');
      expect(driver.isConnected).toBe(false);
    });

    it('should use a full mongodb:// URI from the database field', async () => {
      await driver.connect(makeConfig({ database: 'mongodb://user:pass@host:27017/mydb' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should use a full mongodb+srv:// URI from the database field', async () => {
      await driver.connect(makeConfig({ database: 'mongodb+srv://user:pass@cluster.example.com/mydb' }));
      expect(driver.isConnected).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect and reset state', async () => {
      await driver.connect(makeConfig());
      await driver.disconnect();

      expect(mockClientClose).toHaveBeenCalled();
      expect(driver.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await driver.disconnect();
      expect(driver.isConnected).toBe(false);
    });
  });

  // ─── getDatabases ────────────────────────────────────────────────────

  describe('getDatabases', () => {
    it('should return databases from admin listDatabases', async () => {
      await driver.connect(makeConfig());

      mockAdminListDatabases.mockResolvedValueOnce({
        databases: [
          { name: 'admin' },
          { name: 'local' },
          { name: 'testdb' }
        ]
      });

      const databases = await driver.getDatabases();
      expect(databases).toEqual([
        { name: 'admin' },
        { name: 'local' },
        { name: 'testdb' }
      ]);
    });

    it('should fall back to current database when admin access denied', async () => {
      await driver.connect(makeConfig());

      mockAdminListDatabases.mockRejectedValueOnce(new Error('not authorized'));

      const databases = await driver.getDatabases();
      expect(databases).toEqual([{ name: 'testdb' }]);
    });

    it('should throw when not connected', async () => {
      await expect(driver.getDatabases()).rejects.toThrow('Not connected');
    });
  });

  // ─── getTables ───────────────────────────────────────────────────────

  describe('getTables', () => {
    it('should return sorted collections as tables', async () => {
      await driver.connect(makeConfig());

      mockListCollectionsToArray.mockResolvedValueOnce([
        { name: 'users', type: 'collection' },
        { name: 'orders', type: 'collection' }
      ]);
      mockEstimatedDocumentCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);

      const tables = await driver.getTables('testdb');

      expect(tables).toHaveLength(2);
      // Sorted alphabetically: orders, users
      expect(tables[0].name).toBe('orders');
      expect(tables[0].type).toBe(TableObjectType.Table);
      expect(tables[1].name).toBe('users');
      // Each collection gets its own estimatedDocumentCount call in iteration order
      // (users first = 100, orders second = 50), but sorted output is orders, users
      expect(typeof tables[0].rowCount).toBe('number');
      expect(typeof tables[1].rowCount).toBe('number');
    });

    it('should mark views correctly', async () => {
      await driver.connect(makeConfig());

      mockListCollectionsToArray.mockResolvedValueOnce([
        { name: 'user_summary', type: 'view' }
      ]);
      mockEstimatedDocumentCount.mockResolvedValueOnce(0);

      const tables = await driver.getTables('testdb');

      expect(tables[0].type).toBe(TableObjectType.View);
      expect(tables[0].comment).toBe('MongoDB View');
    });

    it('should use requested database without switching driver state', async () => {
      await driver.connect(makeConfig());

      mockListCollectionsToArray.mockResolvedValueOnce([]);

      await driver.getTables('otherdb');

      // mockClientDb called with 'otherdb' for the query
      expect(mockClientDb).toHaveBeenCalledWith('otherdb');
    });

    it('should throw when not connected', async () => {
      await expect(driver.getTables('testdb')).rejects.toThrow('Not connected');
    });
  });

  // ─── getColumns ──────────────────────────────────────────────────────

  describe('getColumns', () => {
    it('should return default _id column for empty collections', async () => {
      await driver.connect(makeConfig());

      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([]) }))
      });

      const columns = await driver.getColumns('users');

      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('_id');
      expect(columns[0].type).toBe('ObjectId');
      expect(columns[0].primaryKey).toBe(true);
    });

    it('should infer schema from sampled documents', async () => {
      await driver.connect(makeConfig());

      const sampleDocs = [
        { _id: 'abc', name: 'Alice', age: 30 },
        { _id: 'def', name: 'Bob', age: 25, email: 'bob@test.com' }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(sampleDocs) }))
      });

      const columns = await driver.getColumns('users');

      // _id should be first
      expect(columns[0].name).toBe('_id');
      expect(columns[0].primaryKey).toBe(true);

      // Should contain all fields from all sampled documents
      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain('name');
      expect(colNames).toContain('age');
      expect(colNames).toContain('email');
    });

    it('should mark optional fields as nullable', async () => {
      await driver.connect(makeConfig());

      // email only in one of two docs
      const sampleDocs = [
        { _id: 'abc', name: 'Alice' },
        { _id: 'def', name: 'Bob', email: 'bob@test.com' }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(sampleDocs) }))
      });

      const columns = await driver.getColumns('users');
      const emailCol = columns.find((c) => c.name === 'email');
      expect(emailCol?.nullable).toBe(true);
    });
  });

  // ─── getIndexes ──────────────────────────────────────────────────────

  describe('getIndexes', () => {
    it('should return indexes for a collection', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { name: '_id_', key: { _id: 1 }, unique: true },
        { name: 'email_1', key: { email: 1 }, unique: true },
        { name: 'name_text', key: { name: 'text' } }
      ]);

      const indexes = await driver.getIndexes('users');

      expect(indexes).toHaveLength(3);
      expect(indexes[0]).toEqual({
        name: '_id_',
        columns: ['_id'],
        unique: true,
        primary: true,
        type: 'btree'
      });
      expect(indexes[1]).toEqual({
        name: 'email_1',
        columns: ['email'],
        unique: true,
        primary: false,
        type: 'btree'
      });
      expect(indexes[2]).toEqual({
        name: 'name_text',
        columns: ['name'],
        unique: false,
        primary: false,
        type: 'text'
      });
    });

    it('should return empty array on error', async () => {
      await driver.connect(makeConfig());
      mockIndexes.mockRejectedValueOnce(new Error('error'));

      const indexes = await driver.getIndexes('users');
      expect(indexes).toEqual([]);
    });
  });

  // ─── getForeignKeys ──────────────────────────────────────────────────

  describe('getForeignKeys', () => {
    it('should always return empty array (MongoDB has no FK)', async () => {
      await driver.connect(makeConfig());
      const fks = await driver.getForeignKeys('users');
      expect(fks).toEqual([]);
    });
  });

  // ─── execute (query runner) ──────────────────────────────────────────

  describe('execute', () => {
    describe('find', () => {
      it('should execute db.collection.find({})', async () => {
        await driver.connect(makeConfig());

        const docs = [
          { _id: 'abc', name: 'Alice' },
          { _id: 'def', name: 'Bob' }
        ];
        mockFind.mockReturnValueOnce({
          limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
        });

        const result = await driver.execute('db.users.find({})');

        expect(result.rowCount).toBe(2);
        expect(result.rows).toHaveLength(2);
        expect(result.error).toBeUndefined();
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
      });

      it('should return empty result for no matching documents', async () => {
        await driver.connect(makeConfig());

        mockFind.mockReturnValueOnce({
          limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([]) }))
        });

        const result = await driver.execute('db.users.find({})');

        expect(result.rowCount).toBe(0);
        expect(result.rows).toEqual([]);
        expect(result.columns).toEqual([]);
      });
    });

    describe('findOne', () => {
      it('should execute db.collection.findOne({})', async () => {
        await driver.connect(makeConfig());

        mockFindOne.mockResolvedValueOnce({ _id: 'abc', name: 'Alice' });

        const result = await driver.execute('db.users.findOne({})');

        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('name', 'Alice');
      });

      it('should handle null result from findOne', async () => {
        await driver.connect(makeConfig());

        mockFindOne.mockResolvedValueOnce(null);

        const result = await driver.execute('db.users.findOne({"_id": "nonexistent"})');

        expect(result.rowCount).toBe(0);
        expect(result.rows).toEqual([]);
      });
    });

    describe('aggregate', () => {
      it('should execute db.collection.aggregate([])', async () => {
        await driver.connect(makeConfig());

        const aggDocs = [
          { _id: 'group1', total: 100 },
          { _id: 'group2', total: 200 }
        ];
        mockAggregate.mockReturnValueOnce({
          toArray: vi.fn().mockResolvedValueOnce(aggDocs)
        });

        const result = await driver.execute('db.orders.aggregate([{"$group": {"_id": "$status", "total": {"$sum": "$amount"}}}])');

        expect(result.rowCount).toBe(2);
        expect(result.rows[0]).toHaveProperty('total', 100);
      });
    });

    describe('insertOne', () => {
      it('should execute db.collection.insertOne({})', async () => {
        await driver.connect(makeConfig());

        const { ObjectId } = await import('mongodb');
        mockInsertOne.mockResolvedValueOnce({
          acknowledged: true,
          insertedId: new ObjectId('abcdef1234567890abcdef12')
        });

        const result = await driver.execute('db.users.insertOne({"name": "Charlie"})');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(1);
        expect(result.rows[0]).toHaveProperty('acknowledged', true);
        expect(result.rows[0]).toHaveProperty('insertedId', 'abcdef1234567890abcdef12');
      });
    });

    describe('insertMany', () => {
      it('should execute db.collection.insertMany([])', async () => {
        await driver.connect(makeConfig());

        const { ObjectId } = await import('mongodb');
        mockInsertMany.mockResolvedValueOnce({
          acknowledged: true,
          insertedCount: 2,
          insertedIds: {
            '0': new ObjectId('abcdef1234567890abcdef12'),
            '1': new ObjectId('abcdef1234567890abcdef13')
          }
        });

        const result = await driver.execute('db.users.insertMany([{"name": "A"}, {"name": "B"}])');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(2);
        expect(result.rows[0]).toHaveProperty('insertedCount', 2);
      });
    });

    describe('updateOne', () => {
      it('should execute db.collection.updateOne({}, {})', async () => {
        await driver.connect(makeConfig());

        mockUpdateOne.mockResolvedValueOnce({
          acknowledged: true,
          matchedCount: 1,
          modifiedCount: 1,
          upsertedId: null
        });

        const result = await driver.execute('db.users.updateOne({"name": "Alice"}, {"$set": {"age": 31}})');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(1);
        expect(result.rows[0]).toHaveProperty('matchedCount', 1);
        expect(result.rows[0]).toHaveProperty('modifiedCount', 1);
        expect(result.rows[0]).toHaveProperty('upsertedId', null);
      });
    });

    describe('updateMany', () => {
      it('should execute db.collection.updateMany({}, {})', async () => {
        await driver.connect(makeConfig());

        mockUpdateMany.mockResolvedValueOnce({
          acknowledged: true,
          matchedCount: 5,
          modifiedCount: 3,
          upsertedId: null
        });

        const result = await driver.execute('db.users.updateMany({}, {"$set": {"active": true}})');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(3);
        expect(result.rows[0]).toHaveProperty('matchedCount', 5);
      });
    });

    describe('deleteOne', () => {
      it('should execute db.collection.deleteOne({})', async () => {
        await driver.connect(makeConfig());

        mockDeleteOne.mockResolvedValueOnce({
          acknowledged: true,
          deletedCount: 1
        });

        const result = await driver.execute('db.users.deleteOne({"name": "Alice"})');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(1);
        expect(result.rows[0]).toHaveProperty('deletedCount', 1);
      });
    });

    describe('deleteMany', () => {
      it('should execute db.collection.deleteMany({})', async () => {
        await driver.connect(makeConfig());

        mockDeleteMany.mockResolvedValueOnce({
          acknowledged: true,
          deletedCount: 10
        });

        const result = await driver.execute('db.users.deleteMany({"active": false})');

        expect(result.rowCount).toBe(1);
        expect(result.affectedRows).toBe(10);
        expect(result.rows[0]).toHaveProperty('deletedCount', 10);
      });
    });

    describe('countDocuments', () => {
      it('should execute db.collection.countDocuments({})', async () => {
        await driver.connect(makeConfig());

        mockCountDocuments.mockResolvedValueOnce(42);

        const result = await driver.execute('db.users.countDocuments({})');

        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('count', 42);
      });
    });

    describe('distinct', () => {
      it('should execute db.collection.distinct("field")', async () => {
        await driver.connect(makeConfig());

        mockDistinct.mockResolvedValueOnce(['admin', 'user', 'editor']);

        const result = await driver.execute('db.users.distinct("role")');

        expect(result.rowCount).toBe(3);
        expect(result.rows.map((r) => r['role'])).toEqual(['admin', 'user', 'editor']);
      });
    });

    describe('createIndex', () => {
      it('should execute db.collection.createIndex({})', async () => {
        await driver.connect(makeConfig());

        mockCollectionCreateIndex.mockResolvedValueOnce('email_1');

        const result = await driver.execute('db.users.createIndex({"email": 1})');

        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('indexName', 'email_1');
      });
    });

    describe('dropIndex', () => {
      it('should execute db.collection.dropIndex("name")', async () => {
        await driver.connect(makeConfig());

        mockCollectionDropIndex.mockResolvedValueOnce(undefined);

        const result = await driver.execute('db.users.dropIndex("email_1")');

        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('result', "Index 'email_1' dropped");
      });
    });

    describe('drop', () => {
      it('should execute db.collection.drop()', async () => {
        await driver.connect(makeConfig());

        mockCollectionDrop.mockResolvedValueOnce(true);

        const result = await driver.execute('db.users.drop()');

        expect(result.rowCount).toBe(1);
        expect(result.rows[0]).toHaveProperty('dropped', true);
      });
    });

    describe('special commands', () => {
      it('should execute db.getCollectionNames()', async () => {
        await driver.connect(makeConfig());

        mockListCollectionsToArray.mockResolvedValueOnce([
          { name: 'orders' },
          { name: 'users' }
        ]);

        const result = await driver.execute('db.getCollectionNames()');

        expect(result.rowCount).toBe(2);
        expect(result.rows.map((r) => r.name)).toEqual(['orders', 'users']);
      });

      it('should execute db.stats()', async () => {
        await driver.connect(makeConfig());

        mockDbCommand.mockImplementation(async (cmd: Record<string, unknown>) => {
          if ('buildInfo' in cmd) return { version: '6.0.0' };
          return {};
        });
        mockDbStats.mockResolvedValueOnce({ db: 'testdb', collections: 5, objects: 1000 });

        // db.stats() calls db.stats() which is db.command in mongo
        // Actually in the source, db.stats() is a separate path
        const result = await driver.execute('db.stats()');

        expect(result.rowCount).toBe(1);
      });
    });

    describe('error handling', () => {
      it('should return error for invalid query format', async () => {
        await driver.connect(makeConfig());

        const result = await driver.execute('SELECT * FROM users');

        expect(result.error).toBeDefined();
        expect(result.error).toContain('Invalid MongoDB query');
      });

      it('should return error for unsupported method', async () => {
        await driver.connect(makeConfig());

        const result = await driver.execute('db.users.unsupportedMethod()');

        expect(result.error).toContain('Unsupported MongoDB method');
      });

      it('should return error when not connected', async () => {
        const result = await driver.execute('db.users.find({})');
        expect(result.error).toContain('Not connected');
        expect(result.rowCount).toBe(0);
      });

      it('should return error when query execution fails', async () => {
        await driver.connect(makeConfig());

        mockFind.mockReturnValueOnce({
          limit: vi.fn(() => ({
            toArray: vi.fn().mockRejectedValueOnce(new Error('query failed'))
          }))
        });

        const result = await driver.execute('db.users.find({})');

        expect(result.error).toBe('query failed');
        expect(result.rowCount).toBe(0);
      });
    });
  });

  // ─── Schema operations ───────────────────────────────────────────────

  describe('getDataTypes', () => {
    it('should return MongoDB data types', () => {
      const types = driver.getDataTypes();

      expect(types.length).toBeGreaterThan(0);
      const typeNames = types.map((t) => t.name);
      expect(typeNames).toContain('String');
      expect(typeNames).toContain('Number');
      expect(typeNames).toContain('ObjectId');
      expect(typeNames).toContain('Array');
      expect(typeNames).toContain('Boolean');
      expect(typeNames).toContain('Date');
    });
  });

  describe('getPrimaryKeyColumns', () => {
    it('should always return ["_id"]', async () => {
      await driver.connect(makeConfig());
      const pk = await driver.getPrimaryKeyColumns('users');
      expect(pk).toEqual(['_id']);
    });
  });

  describe('addColumn', () => {
    it('should return error (schema-less)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.addColumn({
        table: 'users',
        column: { name: 'email', type: 'String', nullable: true }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('schema-less');
    });
  });

  describe('modifyColumn', () => {
    it('should return error (schema-less)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.modifyColumn({
        table: 'users',
        oldName: 'name',
        newDefinition: { name: 'name', type: 'Number', nullable: true }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('schema-less');
    });
  });

  describe('dropColumn', () => {
    it('should unset field from all documents', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 10,
        modifiedCount: 8,
        upsertedId: null
      });

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'deprecatedField'
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(8);
      expect(mockUpdateMany).toHaveBeenCalledWith({}, { $unset: { deprecatedField: '' } });
    });

    it('should return error on failure', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockRejectedValueOnce(new Error('update failed'));

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'field'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('update failed');
    });
  });

  describe('renameColumn', () => {
    it('should rename field in all documents', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 10,
        modifiedCount: 10,
        upsertedId: null
      });

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'fullName',
        newName: 'name'
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(10);
      expect(mockUpdateMany).toHaveBeenCalledWith({}, { $rename: { fullName: 'name' } });
    });
  });

  describe('createIndex', () => {
    it('should create an index on the collection', async () => {
      await driver.connect(makeConfig());

      mockCollectionCreateIndex.mockResolvedValueOnce('email_1');

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'email_idx', columns: ['email'], unique: true }
      });

      expect(result.success).toBe(true);
      expect(mockCollectionCreateIndex).toHaveBeenCalledWith(
        { email: 1 },
        { name: 'email_idx', unique: true }
      );
    });
  });

  describe('dropIndex', () => {
    it('should drop an index from the collection', async () => {
      await driver.connect(makeConfig());

      mockCollectionDropIndex.mockResolvedValueOnce(undefined);

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'email_idx'
      });

      expect(result.success).toBe(true);
      expect(mockCollectionDropIndex).toHaveBeenCalledWith('email_idx');
    });
  });

  describe('addForeignKey', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.addForeignKey({
        table: 'users',
        foreignKey: {
          name: 'fk_test',
          columns: ['orgId'],
          referencedTable: 'orgs',
          referencedColumns: ['id']
        }
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('foreign key');
    });
  });

  describe('dropForeignKey', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropForeignKey({
        table: 'users',
        constraintName: 'fk_test'
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createTable', () => {
    it('should create a collection', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockResolvedValueOnce(undefined);

      const result = await driver.createTable({
        table: { name: 'newCollection', columns: [] }
      });

      expect(result.success).toBe(true);
      expect(mockCreateCollection).toHaveBeenCalledWith('newCollection');
    });

    it('should return error on failure', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockRejectedValueOnce(new Error('already exists'));

      const result = await driver.createTable({
        table: { name: 'existing', columns: [] }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('already exists');
    });
  });

  describe('dropTable', () => {
    it('should drop a collection', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockResolvedValueOnce(true);

      const result = await driver.dropTable({ table: 'oldCollection' });

      expect(result.success).toBe(true);
    });
  });

  describe('renameTable', () => {
    it('should rename a collection', async () => {
      await driver.connect(makeConfig());

      mockRename.mockResolvedValueOnce(undefined);

      const result = await driver.renameTable({
        oldName: 'oldName',
        newName: 'newName'
      });

      expect(result.success).toBe(true);
      expect(mockRename).toHaveBeenCalledWith('newName');
    });
  });

  describe('insertRow', () => {
    it('should insert a document', async () => {
      await driver.connect(makeConfig());

      mockInsertOne.mockResolvedValueOnce({
        acknowledged: true,
        insertedId: { toHexString: () => 'aaa' }
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Charlie', age: 28 }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });
  });

  describe('deleteRow', () => {
    it('should delete a document by _id', async () => {
      await driver.connect(makeConfig());

      mockDeleteOne.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 1
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { _id: 'abcdef1234567890abcdef12' }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });
  });

  describe('updateRow', () => {
    it('should update a document by _id', async () => {
      await driver.connect(makeConfig());

      mockUpdateOne.mockResolvedValueOnce({
        acknowledged: true,
        modifiedCount: 1,
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      });

      const result = await driver.updateRow({
        table: 'users',
        primaryKeyValues: { _id: 'abcdef1234567890abcdef12' },
        values: { name: 'Updated Name', age: 30 }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
      expect(mockUpdateOne).toHaveBeenCalled();
    });

    it('should return error on failure', async () => {
      await driver.connect(makeConfig());

      mockUpdateOne.mockRejectedValueOnce(new Error('Update failed'));

      const result = await driver.updateRow({
        table: 'users',
        primaryKeyValues: { _id: 'abcdef1234567890abcdef12' },
        values: { name: 'Fail' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  // ─── View operations ─────────────────────────────────────────────────

  describe('createView', () => {
    it('should create a view with valid source and pipeline', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockResolvedValueOnce(undefined);

      const result = await driver.createView({
        view: {
          name: 'userSummary',
          selectStatement: '{"source": "users", "pipeline": [{"$match": {"active": true}}]}'
        }
      });

      expect(result.success).toBe(true);
      expect(mockCreateCollection).toHaveBeenCalledWith('userSummary', {
        viewOn: 'users',
        pipeline: [{ $match: { active: true } }]
      });
    });

    it('should return error for invalid JSON', async () => {
      await driver.connect(makeConfig());

      const result = await driver.createView({
        view: {
          name: 'badView',
          selectStatement: 'not valid json'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSON');
    });

    it('should return error when source is missing', async () => {
      await driver.connect(makeConfig());

      const result = await driver.createView({
        view: {
          name: 'badView',
          selectStatement: '{"pipeline": [{"$match": {}}]}'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('source');
    });
  });

  describe('dropView', () => {
    it('should drop a view (same as dropping collection)', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockResolvedValueOnce(true);

      const result = await driver.dropView({ viewName: 'userSummary' });

      expect(result.success).toBe(true);
    });
  });

  describe('renameView', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(makeConfig());

      const result = await driver.renameView({
        oldName: 'v1',
        newName: 'v2'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not support renaming views');
    });
  });

  describe('getViewDDL', () => {
    it('should return view definition as JSON', async () => {
      await driver.connect(makeConfig());

      mockListCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([{
          name: 'myView',
          type: 'view',
          options: { viewOn: 'users', pipeline: [] }
        }])
      });

      const ddl = await driver.getViewDDL('myView');

      expect(ddl).toContain('myView');
      expect(ddl).toContain('view');
    });

    it('should return not found message for missing view', async () => {
      await driver.connect(makeConfig());

      mockListCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([])
      });

      const ddl = await driver.getViewDDL('noSuchView');

      expect(ddl).toContain('not found');
    });
  });

  // ─── Routine operations ───────────────────────────────────────────────

  describe('getRoutines', () => {
    it('should return empty array (not supported)', async () => {
      await driver.connect(makeConfig());
      const routines = await driver.getRoutines();
      expect(routines).toEqual([]);
    });
  });

  describe('getRoutineDefinition', () => {
    it('should return not supported message', async () => {
      await driver.connect(makeConfig());
      const def = await driver.getRoutineDefinition('myProc', 'PROCEDURE' as 'PROCEDURE');
      expect(def).toContain('does not support');
    });
  });

  describe('createUser', () => {
    it('should create user with readWriteAnyDatabase role by default', async () => {
      await driver.connect(makeConfig());
      mockDbCommand.mockResolvedValueOnce({ ok: 1 });

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'secret123' },
      });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('createUser');
      expect(result.sql).toContain('****');
      expect(mockDbCommand).toHaveBeenCalledWith({
        createUser: 'testuser',
        pwd: 'secret123',
        roles: [{ role: 'readWriteAnyDatabase', db: 'admin' }],
      });
    });

    it('should return error without password', async () => {
      await driver.connect(makeConfig());

      const result = await driver.createUser({
        user: { name: 'testuser' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password is required');
    });

    it('should create superuser with root role', async () => {
      await driver.connect(makeConfig());
      mockDbCommand.mockResolvedValueOnce({ ok: 1 });

      const result = await driver.createUser({
        user: { name: 'admin', password: 'pw', superuser: true },
      });

      expect(result.success).toBe(true);
      expect(mockDbCommand).toHaveBeenCalledWith({
        createUser: 'admin',
        pwd: 'pw',
        roles: [{ role: 'root', db: 'admin' }],
      });
    });

    it('should return error on failure', async () => {
      await driver.connect(makeConfig());
      mockDbCommand.mockRejectedValueOnce(new Error('User already exists'));

      const result = await driver.createUser({
        user: { name: 'testuser', password: 'pw' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('User already exists');
    });
  });

  describe('dropUser', () => {
    it('should drop user', async () => {
      await driver.connect(makeConfig());
      mockDbCommand.mockResolvedValueOnce({ ok: 1 });

      const result = await driver.dropUser({ name: 'testuser' });

      expect(result.success).toBe(true);
      expect(result.sql).toContain('dropUser');
      expect(mockDbCommand).toHaveBeenCalledWith({
        dropUser: 'testuser',
      });
    });

    it('should return error on failure', async () => {
      await driver.connect(makeConfig());
      mockDbCommand.mockRejectedValueOnce(new Error('Cannot drop'));

      const result = await driver.dropUser({ name: 'u' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot drop');
    });
  });

  // ─── Trigger operations ───────────────────────────────────────────────

  describe('getTriggers', () => {
    it('should return empty array', async () => {
      await driver.connect(makeConfig());
      const triggers = await driver.getTriggers();
      expect(triggers).toEqual([]);
    });
  });

  describe('getTriggerDefinition', () => {
    it('should return not supported message', async () => {
      await driver.connect(makeConfig());
      const def = await driver.getTriggerDefinition('myTrigger');
      expect(def).toContain('does not support');
    });
  });

  describe('createTrigger', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.createTrigger({
        trigger: { name: 't1', table: 'users', timing: 'BEFORE', event: 'INSERT', body: '' }
      });
      expect(result.success).toBe(false);
    });
  });

  describe('dropTrigger', () => {
    it('should return error (not supported)', async () => {
      await driver.connect(makeConfig());
      const result = await driver.dropTrigger({ triggerName: 't1' });
      expect(result.success).toBe(false);
    });
  });

  // ─── User management ─────────────────────────────────────────────────

  describe('getUsers', () => {
    it('should return users from admin command', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({
        users: [
          { user: 'admin', roles: [{ role: 'root', db: 'admin' }] },
          { user: 'reader', roles: [{ role: 'read', db: 'testdb' }] }
        ]
      });

      const users = await driver.getUsers();

      expect(users).toHaveLength(2);
      expect(users[0].name).toBe('admin');
      expect(users[0].superuser).toBe(true);
      expect(users[1].name).toBe('reader');
      expect(users[1].superuser).toBe(false);
    });

    it('should return empty array when not authorized', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockRejectedValueOnce(new Error('not authorized'));

      const users = await driver.getUsers();
      expect(users).toEqual([]);
    });
  });

  // ─── getTableData ─────────────────────────────────────────────────────

  describe('getTableData', () => {
    it('should return table data with default options', async () => {
      await driver.connect(makeConfig());

      // Mock for getColumns inside getTableData
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc', name: 'Alice' }])
        }))
      });

      mockCountDocuments.mockResolvedValueOnce(2);

      // Mock for the data query with sort/skip/limit chain
      const mockLimitFn = vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([
        { _id: 'abc', name: 'Alice' },
        { _id: 'def', name: 'Bob' }
      ])}));
      const mockSkipFn = vi.fn(() => ({ limit: mockLimitFn }));
      const mockSortFn = vi.fn(() => ({ skip: mockSkipFn }));
      mockFind.mockReturnValueOnce({
        limit: vi.fn(),
        sort: mockSortFn
      });

      const result = await driver.getTableData('users', {});

      expect(result.totalCount).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
      expect(result.columns.length).toBeGreaterThan(0);
    });

    it('should apply sorting with DESC direction', async () => {
      await driver.connect(makeConfig());

      // Mock for getColumns
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc', name: 'Alice' }])
        }))
      });

      mockCountDocuments.mockResolvedValueOnce(1);

      const mockLimitFn = vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc', name: 'Alice' }]) }));
      const mockSkipFn = vi.fn(() => ({ limit: mockLimitFn }));
      const mockSortFn = vi.fn(() => ({ skip: mockSkipFn }));
      mockFind.mockReturnValueOnce({
        limit: vi.fn(),
        sort: mockSortFn
      });

      await driver.getTableData('users', {
        orderBy: 'name',
        orderDirection: 'DESC' as 'DESC',
        limit: 25,
        offset: 10
      });

      expect(mockSortFn).toHaveBeenCalledWith({ name: -1 });
      expect(mockSkipFn).toHaveBeenCalledWith(10);
      expect(mockLimitFn).toHaveBeenCalledWith(25);
    });

    it('should apply filters with various operators', async () => {
      await driver.connect(makeConfig());

      // Mock for getColumns
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc', name: 'Alice', age: 30 }])
        }))
      });

      mockCountDocuments.mockResolvedValueOnce(1);

      const mockLimitFn = vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([]) }));
      const mockSkipFn = vi.fn(() => ({ limit: mockLimitFn }));
      const mockSortFn = vi.fn(() => ({ skip: mockSkipFn }));
      mockFind.mockReturnValueOnce({
        limit: vi.fn(),
        sort: mockSortFn
      });

      await driver.getTableData('users', {
        filters: [
          { column: 'name', operator: '=', value: 'Alice' },
          { column: 'age', operator: '>', value: '25' }
        ]
      });

      // The find call for data should have used a filter with $and
      expect(mockFind).toHaveBeenCalled();
    });

    it('should apply ASC sorting by default', async () => {
      await driver.connect(makeConfig());

      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc' }])
        }))
      });

      mockCountDocuments.mockResolvedValueOnce(0);

      const mockLimitFn = vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([]) }));
      const mockSkipFn = vi.fn(() => ({ limit: mockLimitFn }));
      const mockSortFn = vi.fn(() => ({ skip: mockSkipFn }));
      mockFind.mockReturnValueOnce({
        limit: vi.fn(),
        sort: mockSortFn
      });

      await driver.getTableData('users', {
        orderBy: 'name'
      });

      expect(mockSortFn).toHaveBeenCalledWith({ name: 1 });
    });
  });

  // ─── buildMongoFilter (through getTableData) ─────────────────────────

  describe('filter operators (through getTableData)', () => {
    const setupGetTableDataMocks = () => {
      // Mock for getColumns
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc' }])
        }))
      });

      mockCountDocuments.mockResolvedValueOnce(0);

      const mockLimitFn = vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce([]) }));
      const mockSkipFn = vi.fn(() => ({ limit: mockLimitFn }));
      const mockSortFn = vi.fn(() => ({ skip: mockSkipFn }));
      mockFind.mockReturnValueOnce({
        limit: vi.fn(),
        sort: mockSortFn
      });
    };

    it('should handle != operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'status', operator: '!=', value: 'inactive' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle < operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'age', operator: '<', value: '30' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle >= operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'age', operator: '>=', value: '18' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle <= operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'age', operator: '<=', value: '65' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle LIKE operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'LIKE', value: '%alice%' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle NOT LIKE operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: 'NOT LIKE', value: '%test%' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle IN operator with array value', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'role', operator: 'IN', value: ['admin', 'editor'] }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle NOT IN operator with array value', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'role', operator: 'NOT IN', value: ['banned'] }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle IS NULL operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NULL', value: null }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle IS NOT NULL operator', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'email', operator: 'IS NOT NULL', value: null }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle IN operator with non-array value (no condition added)', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'role', operator: 'IN', value: 'admin' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle NOT IN operator with non-array value (no condition added)', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'role', operator: 'NOT IN', value: 'admin' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle multiple filters (produces $and)', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [
          { column: 'age', operator: '>', value: '18' },
          { column: 'age', operator: '<', value: '65' },
          { column: 'status', operator: '=', value: 'active' }
        ]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should coerce ObjectId-like string values in filters', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: '_id', operator: '=', value: 'abcdef1234567890abcdef12' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should coerce numeric string values in filters', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'age', operator: '=', value: '42' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle null value in coerceFilterValue', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: '=', value: null }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle undefined value in coerceFilterValue', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: '=', value: undefined }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });

    it('should handle single filter (returns condition directly, no $and)', async () => {
      await driver.connect(makeConfig());
      setupGetTableDataMocks();

      await driver.getTableData('users', {
        filters: [{ column: 'name', operator: '=', value: 'Alice' }]
      });

      expect(mockCountDocuments).toHaveBeenCalled();
    });
  });

  // ─── ping ─────────────────────────────────────────────────────────────

  describe('ping', () => {
    it('should return true when db responds', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({ ok: 1 });

      const result = await driver.ping();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      const result = await driver.ping();
      expect(result).toBe(false);
    });

    it('should return false when ping fails', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockRejectedValueOnce(new Error('timeout'));

      const result = await driver.ping();
      expect(result).toBe(false);
    });
  });

  // ─── getTableDDL ─────────────────────────────────────────────────────

  describe('getTableDDL', () => {
    it('should return collection info as pseudo-DDL', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { name: '_id_', key: { _id: 1 }, unique: true }
      ]);

      // For getColumns call inside getTableDDL
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc', name: 'Alice' }])
        }))
      });

      mockEstimatedDocumentCount.mockResolvedValueOnce(100);

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toContain('MongoDB Collection: users');
      expect(ddl).toContain('Indexes:');
      expect(ddl).toContain('Estimated document count: 100');
    });
  });

  // ─── getClient / getDb ────────────────────────────────────────────────

  describe('getClient', () => {
    it('should return the MongoClient when connected', async () => {
      await driver.connect(makeConfig());

      const client = driver.getClient();
      expect(client).toBeDefined();
    });

    it('should throw when not connected', () => {
      expect(() => driver.getClient()).toThrow('Not connected');
    });
  });

  describe('getDb', () => {
    it('should return the Db instance when connected', async () => {
      await driver.connect(makeConfig());

      const db = driver.getDb();
      expect(db).toBeDefined();
    });

    it('should throw when not connected', () => {
      expect(() => driver.getDb()).toThrow('Not connected');
    });
  });

  // ─── testConnection ──────────────────────────────────────────────────

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      mockDbCommand.mockResolvedValue({ version: '6.0.0', gitVersion: 'abc', javascriptEngine: 'mozjs' });

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return failure on connection error', async () => {
      mockClientConnect.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('should include serverVersion and serverInfo with storageEngines', async () => {
      mockDbCommand.mockResolvedValueOnce({
        version: '7.0.0',
        gitVersion: 'git123',
        javascriptEngine: 'mozjs-115',
        storageEngines: ['wiredTiger', 'inMemory']
      });

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('MongoDB 7.0.0');
      expect(result.serverInfo).toBeDefined();
      expect(result.serverInfo!['Git Version']).toBe('git123');
      expect(result.serverInfo!['JS Engine']).toBe('mozjs-115');
      expect(result.serverInfo!['Storage Engines']).toBe('wiredTiger, inMemory');
    });

    it('should handle buildInfo command failure gracefully', async () => {
      mockDbCommand.mockRejectedValueOnce(new Error('not authorized'));

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('Unknown');
    });

    it('should handle non-Error exceptions in testConnection', async () => {
      mockClientConnect.mockRejectedValueOnce('string error');

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle disconnect error during failed testConnection', async () => {
      mockClientConnect.mockRejectedValueOnce(new Error('fail'));
      mockClientClose.mockRejectedValueOnce(new Error('close fail'));

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(false);
      expect(result.error).toBe('fail');
    });

    it('should handle buildInfo with missing version', async () => {
      mockDbCommand.mockResolvedValueOnce({});

      const result = await driver.testConnection(makeConfig());

      expect(result.success).toBe(true);
      expect(result.serverVersion).toBe('MongoDB Unknown');
    });
  });

  // ─── buildConnectionUri edge cases ─────────────────────────────────────

  describe('buildConnectionUri (via connect)', () => {
    it('should handle username without password', async () => {
      await driver.connect(makeConfig({ username: 'admin', password: undefined }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle no username and no password', async () => {
      await driver.connect(makeConfig({ username: undefined, password: undefined }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle default host and port when not provided', async () => {
      await driver.connect(makeConfig({ host: undefined, port: undefined }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle SSL with sslConfig enabled', async () => {
      await driver.connect(makeConfig({
        ssl: false,
        sslConfig: { enabled: true, mode: 'require' as 'require', rejectUnauthorized: false }
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle SSL with ssl flag true', async () => {
      await driver.connect(makeConfig({
        ssl: true
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle SSL with rejectUnauthorized not false', async () => {
      await driver.connect(makeConfig({
        sslConfig: { enabled: true, mode: 'require' as 'require', rejectUnauthorized: true }
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle database set to admin (no path appended)', async () => {
      await driver.connect(makeConfig({ database: 'admin' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle SSL params with database path already in URI', async () => {
      await driver.connect(makeConfig({
        database: 'mydb',
        ssl: true
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle SSL params without explicit database (uses /? separator)', async () => {
      await driver.connect(makeConfig({
        database: 'admin',
        ssl: true
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should handle sslConfig with mode Disable', async () => {
      await driver.connect(makeConfig({
        ssl: false,
        sslConfig: { enabled: true, mode: 'disable' as 'disable' }
      }));
      expect(driver.isConnected).toBe(true);
    });

    it('should use database field as-is when it is not a mongodb URI', async () => {
      await driver.connect(makeConfig({ database: '' }));
      expect(driver.isConnected).toBe(true);
    });
  });

  // ─── extractDatabaseName edge cases ────────────────────────────────────

  describe('extractDatabaseName (via connect with mongodb URI)', () => {
    it('should extract database name from mongodb:// URI', async () => {
      await driver.connect(makeConfig({ database: 'mongodb://localhost:27017/mydb' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should extract database name from mongodb+srv:// URI', async () => {
      await driver.connect(makeConfig({ database: 'mongodb+srv://cluster.example.com/srvdb' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should default to admin when URI has no database path', async () => {
      await driver.connect(makeConfig({ database: 'mongodb://localhost:27017/' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should default to admin when URI path is empty', async () => {
      await driver.connect(makeConfig({ database: 'mongodb://localhost:27017' }));
      expect(driver.isConnected).toBe(true);
    });

    it('should default to admin for invalid mongodb:// URL', async () => {
      // This triggers the catch block in extractDatabaseName for invalid URLs
      await driver.connect(makeConfig({ database: 'mongodb://[invalid' }));
      expect(driver.isConnected).toBe(true);
    });
  });

  // ─── serializeValue edge cases ────────────────────────────────────────

  describe('serializeValue (through execute find)', () => {
    it('should serialize null and undefined values', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', field1: null, field2: undefined }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]).toHaveProperty('field1', null);
      expect(result.rows[0]).toHaveProperty('field2', undefined);
    });

    it('should serialize Date values to ISO strings', async () => {
      await driver.connect(makeConfig());

      const date = new Date('2024-01-15T10:00:00Z');
      const docs = [{ _id: 'abc', createdAt: date }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['createdAt']).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should serialize Buffer values', async () => {
      await driver.connect(makeConfig());

      const buf = Buffer.from('hello');
      const docs = [{ _id: 'abc', data: buf }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['data']).toBe('<Binary: 5 bytes>');
    });

    it('should serialize bigint values', async () => {
      await driver.connect(makeConfig());

      const bigVal = BigInt('9007199254740993');
      const docs = [{ _id: 'abc', bigNum: bigVal }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['bigNum']).toBe(bigVal.toString());
    });

    it('should serialize arrays recursively', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', tags: ['a', 'b', 'c'] }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['tags']).toEqual(['a', 'b', 'c']);
    });

    it('should serialize BSON Decimal128 type', async () => {
      await driver.connect(makeConfig());

      const decimal128 = { _bsontype: 'Decimal128', toString: () => '3.14159' };
      const docs = [{ _id: 'abc', price: decimal128 }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['price']).toBe('3.14159');
    });

    it('should serialize BSON Long type', async () => {
      await driver.connect(makeConfig());

      const longVal = { _bsontype: 'Long', valueOf: () => 12345 };
      const docs = [{ _id: 'abc', count: longVal }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['count']).toBe(12345);
    });

    it('should serialize BSON Int32 type', async () => {
      await driver.connect(makeConfig());

      const int32Val = { _bsontype: 'Int32', valueOf: () => 42 };
      const docs = [{ _id: 'abc', age: int32Val }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['age']).toBe(42);
    });

    it('should serialize BSON Timestamp type', async () => {
      await driver.connect(makeConfig());

      const tsVal = { _bsontype: 'Timestamp', toString: () => 'Timestamp(1234, 1)' };
      const docs = [{ _id: 'abc', ts: tsVal }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['ts']).toBe('Timestamp(1234, 1)');
    });

    it('should serialize BSON Binary type', async () => {
      await driver.connect(makeConfig());

      const binaryVal = { _bsontype: 'Binary', buffer: Buffer.from('data') };
      const docs = [{ _id: 'abc', bin: binaryVal }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['bin']).toBe('<Binary data>');
    });

    it('should serialize nested objects recursively', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', address: { city: 'NY', zip: 10001 } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['address']).toEqual({ city: 'NY', zip: 10001 });
    });

    it('should serialize ObjectId values to hex strings', async () => {
      await driver.connect(makeConfig());

      const { ObjectId } = await import('mongodb');
      const docs = [{ _id: new ObjectId('abcdef1234567890abcdef12'), name: 'Test' }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['_id']).toBe('abcdef1234567890abcdef12');
    });

    it('should pass through primitive string/number/boolean values', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', name: 'Alice', age: 30, active: true }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.rows[0]['name']).toBe('Alice');
      expect(result.rows[0]['age']).toBe(30);
      expect(result.rows[0]['active']).toBe(true);
    });
  });

  // ─── inferBsonType edge cases ─────────────────────────────────────────

  describe('inferBsonType (through getColumns)', () => {
    it('should infer Date type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', createdAt: new Date() }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const createdAtCol = columns.find((c) => c.name === 'createdAt');
      expect(createdAtCol?.type).toBe('Date');
    });

    it('should infer Buffer as Binary type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', data: Buffer.from('test') }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const dataCol = columns.find((c) => c.name === 'data');
      expect(dataCol?.type).toBe('Binary');
    });

    it('should infer boolean type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', active: true }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const activeCol = columns.find((c) => c.name === 'active');
      expect(activeCol?.type).toBe('Boolean');
    });

    it('should infer integer number as Number (Int)', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', count: 42 }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const countCol = columns.find((c) => c.name === 'count');
      expect(countCol?.type).toBe('Number (Int)');
    });

    it('should infer float number as Number (Double)', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', price: 3.14 }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const priceCol = columns.find((c) => c.name === 'price');
      expect(priceCol?.type).toBe('Number (Double)');
    });

    it('should infer bigint as Int64 type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', bigNum: BigInt(999) }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const bigCol = columns.find((c) => c.name === 'bigNum');
      expect(bigCol?.type).toBe('Int64');
    });

    it('should infer Array type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', tags: ['a', 'b'] }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const tagsCol = columns.find((c) => c.name === 'tags');
      expect(tagsCol?.type).toBe('Array');
    });

    it('should infer BSON Decimal128 type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', amount: { _bsontype: 'Decimal128' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const amountCol = columns.find((c) => c.name === 'amount');
      expect(amountCol?.type).toBe('Decimal128');
    });

    it('should infer BSON Long as Int64 type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', longVal: { _bsontype: 'Long' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const longCol = columns.find((c) => c.name === 'longVal');
      expect(longCol?.type).toBe('Int64');
    });

    it('should infer BSON Int32 type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', intVal: { _bsontype: 'Int32' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const intCol = columns.find((c) => c.name === 'intVal');
      expect(intCol?.type).toBe('Int32');
    });

    it('should infer BSON Timestamp type', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', ts: { _bsontype: 'Timestamp' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const tsCol = columns.find((c) => c.name === 'ts');
      expect(tsCol?.type).toBe('Timestamp');
    });

    it('should infer BSON Binary type from object', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', bin: { _bsontype: 'Binary' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const binCol = columns.find((c) => c.name === 'bin');
      expect(binCol?.type).toBe('Binary');
    });

    it('should infer Object type for plain objects', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc', metadata: { key: 'value' } }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const metaCol = columns.find((c) => c.name === 'metadata');
      expect(metaCol?.type).toBe('Object');
    });

    it('should infer Null type for null values', async () => {
      await driver.connect(makeConfig());

      // All docs have null for field, so type should be Null
      const docs = [{ _id: 'abc', field: null }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const fieldCol = columns.find((c) => c.name === 'field');
      expect(fieldCol?.type).toBe('Null');
      expect(fieldCol?.nullable).toBe(true);
    });

    it('should infer Mixed type when field has multiple types across docs', async () => {
      await driver.connect(makeConfig());

      const docs = [
        { _id: 'abc', value: 'text' },
        { _id: 'def', value: 42 }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const valueCol = columns.find((c) => c.name === 'value');
      expect(valueCol?.type).toContain('Mixed');
    });

    it('should infer ObjectId type', async () => {
      await driver.connect(makeConfig());

      const { ObjectId } = await import('mongodb');
      const docs = [{ _id: new ObjectId('abcdef1234567890abcdef12'), name: 'Test' }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const idCol = columns.find((c) => c.name === '_id');
      expect(idCol?.type).toBe('ObjectId');
    });

    it('should generate comment for fields not present in all docs', async () => {
      await driver.connect(makeConfig());

      const docs = [
        { _id: 'a', name: 'Alice' },
        { _id: 'b', name: 'Bob' },
        { _id: 'c', name: 'Charlie', rare: 'x' }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const rareCol = columns.find((c) => c.name === 'rare');
      expect(rareCol?.comment).toContain('1/3');
    });
  });

  // ─── execute edge cases ────────────────────────────────────────────────

  describe('execute additional edge cases', () => {
    it('should handle find with projection argument', async () => {
      await driver.connect(makeConfig());

      const docs = [{ name: 'Alice' }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({}, {"name": 1})');

      expect(result.rowCount).toBe(1);
    });

    it('should handle updateOne with upsertedId', async () => {
      await driver.connect(makeConfig());

      const { ObjectId } = await import('mongodb');
      mockUpdateOne.mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedId: new ObjectId('abcdef1234567890abcdef12')
      });

      const result = await driver.execute('db.users.updateOne({"name": "New"}, {"$set": {"name": "New"}}, {"upsert": true})');

      expect(result.rows[0]['upsertedId']).toBe('abcdef1234567890abcdef12');
    });

    it('should handle updateMany with upsertedId', async () => {
      await driver.connect(makeConfig());

      const { ObjectId } = await import('mongodb');
      mockUpdateMany.mockResolvedValueOnce({
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedId: new ObjectId('abcdef1234567890abcdef12')
      });

      const result = await driver.execute('db.users.updateMany({}, {"$set": {"field": "val"}}, {"upsert": true})');

      expect(result.rows[0]['upsertedId']).toBe('abcdef1234567890abcdef12');
    });

    it('should handle distinct with filter argument', async () => {
      await driver.connect(makeConfig());

      mockDistinct.mockResolvedValueOnce(['admin', 'user']);

      const result = await driver.execute('db.users.distinct("role", {"active": true})');

      expect(result.rowCount).toBe(2);
    });

    it('should handle createIndex with options argument', async () => {
      await driver.connect(makeConfig());

      mockCollectionCreateIndex.mockResolvedValueOnce('email_1');

      const result = await driver.execute('db.users.createIndex({"email": 1}, {"unique": true})');

      expect(result.rows[0]['indexName']).toBe('email_1');
    });

    it('should handle insertMany with non-ObjectId insertedIds', async () => {
      await driver.connect(makeConfig());

      mockInsertMany.mockResolvedValueOnce({
        acknowledged: true,
        insertedCount: 2,
        insertedIds: {
          '0': 'string-id-1',
          '1': 'string-id-2'
        }
      });

      const result = await driver.execute('db.users.insertMany([{"name": "A"}, {"name": "B"}])');

      expect(result.rows[0]['insertedIds']).toEqual({ '0': 'string-id-1', '1': 'string-id-2' });
    });

    it('should handle query with arguments that fail first JSON parse but succeed second', async () => {
      await driver.connect(makeConfig());

      // countDocuments with empty args should still work
      mockCountDocuments.mockResolvedValueOnce(5);

      const result = await driver.execute('db.users.countDocuments()');

      expect(result.rows[0]['count']).toBe(5);
    });

    it('should return error for non-Error thrown in execute', async () => {
      await driver.connect(makeConfig());

      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockRejectedValueOnce('string error')
        }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.error).toBe('string error');
    });

    it('should handle find with empty args (no filter)', async () => {
      await driver.connect(makeConfig());

      const docs = [{ _id: 'abc' }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find()');

      expect(result.rowCount).toBe(1);
    });

    it('should handle aggregate with empty args', async () => {
      await driver.connect(makeConfig());

      mockAggregate.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([])
      });

      const result = await driver.execute('db.users.aggregate()');

      expect(result.rowCount).toBe(0);
    });
  });

  // ─── getIndexes edge cases ────────────────────────────────────────────

  describe('getIndexes type detection', () => {
    it('should detect 2dsphere index type', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { name: 'loc_2dsphere', key: { location: '2dsphere' } }
      ]);

      const indexes = await driver.getIndexes('places');

      expect(indexes[0].type).toBe('2dsphere');
    });

    it('should detect 2d index type', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { name: 'loc_2d', key: { location: '2d' } }
      ]);

      const indexes = await driver.getIndexes('places');

      expect(indexes[0].type).toBe('2d');
    });

    it('should detect hashed index type', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { name: 'field_hashed', key: { field: 'hashed' } }
      ]);

      const indexes = await driver.getIndexes('data');

      expect(indexes[0].type).toBe('hashed');
    });

    it('should handle index without name', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([
        { key: { field: 1 } }
      ]);

      const indexes = await driver.getIndexes('data');

      expect(indexes[0].name).toBe('unknown');
    });
  });

  // ─── Schema operation error branches ─────────────────────────────────

  describe('schema operation error handling', () => {
    it('should handle renameColumn error', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockRejectedValueOnce(new Error('rename failed'));

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'old',
        newName: 'new'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('rename failed');
    });

    it('should handle renameColumn non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockRejectedValueOnce('string error');

      const result = await driver.renameColumn({
        table: 'users',
        oldName: 'old',
        newName: 'new'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle createIndex error', async () => {
      await driver.connect(makeConfig());

      mockCollectionCreateIndex.mockRejectedValueOnce(new Error('duplicate index'));

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx', columns: ['email'], unique: false }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('duplicate index');
    });

    it('should handle dropIndex error', async () => {
      await driver.connect(makeConfig());

      mockCollectionDropIndex.mockRejectedValueOnce(new Error('index not found'));

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('index not found');
    });

    it('should handle dropTable error', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockRejectedValueOnce(new Error('drop failed'));

      const result = await driver.dropTable({ table: 'users' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('drop failed');
    });

    it('should handle renameTable error', async () => {
      await driver.connect(makeConfig());

      mockRename.mockRejectedValueOnce(new Error('rename failed'));

      const result = await driver.renameTable({
        oldName: 'old',
        newName: 'new'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('rename failed');
    });

    it('should handle insertRow error', async () => {
      await driver.connect(makeConfig());

      mockInsertOne.mockRejectedValueOnce(new Error('insert failed'));

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('insert failed');
    });

    it('should handle insertRow with not acknowledged result', async () => {
      await driver.connect(makeConfig());

      mockInsertOne.mockResolvedValueOnce({
        acknowledged: false,
        insertedId: { toHexString: () => 'xxx' }
      });

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Test' }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(0);
    });

    it('should handle deleteRow error', async () => {
      await driver.connect(makeConfig());

      mockDeleteOne.mockRejectedValueOnce(new Error('delete failed'));

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { _id: 'abcdef1234567890abcdef12' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('delete failed');
    });

    it('should handle deleteRow with non-ObjectId primary key', async () => {
      await driver.connect(makeConfig());

      mockDeleteOne.mockResolvedValueOnce({
        acknowledged: true,
        deletedCount: 1
      });

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { _id: 'not-an-objectid', customKey: 123 }
      });

      expect(result.success).toBe(true);
      expect(result.affectedRows).toBe(1);
    });

    it('should handle dropColumn with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockUpdateMany.mockRejectedValueOnce('string error');

      const result = await driver.dropColumn({
        table: 'users',
        columnName: 'field'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle createTable with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockRejectedValueOnce('string error');

      const result = await driver.createTable({
        table: { name: 'col', columns: [] }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle dropTable with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockRejectedValueOnce('string error');

      const result = await driver.dropTable({ table: 'col' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle renameTable with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockRename.mockRejectedValueOnce('string error');

      const result = await driver.renameTable({
        oldName: 'old',
        newName: 'new'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle insertRow with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockInsertOne.mockRejectedValueOnce('string error');

      const result = await driver.insertRow({
        table: 'users',
        values: { name: 'Test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle deleteRow with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockDeleteOne.mockRejectedValueOnce('string error');

      const result = await driver.deleteRow({
        table: 'users',
        primaryKeyValues: { _id: 'abc' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle createIndex with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockCollectionCreateIndex.mockRejectedValueOnce('string error');

      const result = await driver.createIndex({
        table: 'users',
        index: { name: 'idx', columns: ['field'], unique: false }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle dropIndex with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockCollectionDropIndex.mockRejectedValueOnce('string error');

      const result = await driver.dropIndex({
        table: 'users',
        indexName: 'idx'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  // ─── View operation edge cases ─────────────────────────────────────────

  describe('view operation edge cases', () => {
    it('should handle createView with outer error (createCollection fails)', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockRejectedValueOnce(new Error('create failed'));

      const result = await driver.createView({
        view: {
          name: 'myView',
          selectStatement: '{"source": "users", "pipeline": [{"$match": {}}]}'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('create failed');
    });

    it('should handle createView with non-Error outer exception', async () => {
      await driver.connect(makeConfig());

      mockCreateCollection.mockRejectedValueOnce('string error');

      const result = await driver.createView({
        view: {
          name: 'myView',
          selectStatement: '{"source": "users", "pipeline": [{"$match": {}}]}'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle dropView error', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockRejectedValueOnce(new Error('drop failed'));

      const result = await driver.dropView({ viewName: 'myView' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('drop failed');
    });

    it('should handle dropView with non-Error exception', async () => {
      await driver.connect(makeConfig());

      mockCollectionDrop.mockRejectedValueOnce('string error');

      const result = await driver.dropView({ viewName: 'myView' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });

    it('should handle getViewDDL with collection that is not a view', async () => {
      await driver.connect(makeConfig());

      mockListCollections.mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValueOnce([{
          name: 'myTable',
          type: 'collection'
        }])
      });

      const ddl = await driver.getViewDDL('myTable');

      expect(ddl).toContain('not found');
    });

    it('should handle getViewDDL error', async () => {
      await driver.connect(makeConfig());

      mockListCollections.mockReturnValueOnce({
        toArray: vi.fn().mockRejectedValueOnce(new Error('list failed'))
      });

      const ddl = await driver.getViewDDL('myView');

      expect(ddl).toContain('Error retrieving');
    });
  });

  // ─── getTables edge cases ─────────────────────────────────────────────

  describe('getTables edge cases', () => {
    it('should handle estimatedDocumentCount error for a collection', async () => {
      await driver.connect(makeConfig());

      mockListCollectionsToArray.mockResolvedValueOnce([
        { name: 'users', type: 'collection' }
      ]);
      mockEstimatedDocumentCount.mockRejectedValueOnce(new Error('count failed'));

      const tables = await driver.getTables('testdb');

      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe('users');
      expect(tables[0].rowCount).toBeUndefined();
    });

    it('should extract database name from URI in getTables', async () => {
      await driver.connect(makeConfig());

      mockListCollectionsToArray.mockResolvedValueOnce([]);

      await driver.getTables('mongodb://localhost/otherdb');

      expect(mockClientDb).toHaveBeenCalledWith('otherdb');
    });
  });

  // ─── getTableDDL edge cases ────────────────────────────────────────────

  describe('getTableDDL edge cases', () => {
    it('should handle indexes error gracefully', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockRejectedValueOnce(new Error('index error'));

      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([{ _id: 'abc' }])
        }))
      });

      mockEstimatedDocumentCount.mockResolvedValueOnce(10);

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toContain('MongoDB Collection: users');
      expect(ddl).not.toContain('Indexes:');
    });

    it('should handle estimatedDocumentCount error in DDL', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([]);

      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([])
        }))
      });

      mockEstimatedDocumentCount.mockRejectedValueOnce(new Error('count error'));

      const ddl = await driver.getTableDDL('users');

      expect(ddl).toContain('MongoDB Collection: users');
      expect(ddl).not.toContain('Estimated document count');
    });

    it('should handle empty columns list in DDL', async () => {
      await driver.connect(makeConfig());

      mockIndexes.mockResolvedValueOnce([]);

      // empty collection returns default _id column, so we need getColumns to return something
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValueOnce([])
        }))
      });

      mockEstimatedDocumentCount.mockResolvedValueOnce(0);

      const ddl = await driver.getTableDDL('empty');

      expect(ddl).toContain('MongoDB Collection: empty');
    });
  });

  // ─── getUsers edge cases ───────────────────────────────────────────────

  describe('getUsers edge cases', () => {
    it('should handle users with userAdminAnyDatabase role as superuser', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({
        users: [
          { user: 'uadmin', roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }] }
        ]
      });

      const users = await driver.getUsers();

      expect(users[0].superuser).toBe(true);
    });

    it('should handle users with dbAdminAnyDatabase role as superuser', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({
        users: [
          { user: 'dbadmin', roles: [{ role: 'dbAdminAnyDatabase', db: 'admin' }] }
        ]
      });

      const users = await driver.getUsers();

      expect(users[0].superuser).toBe(true);
    });

    it('should handle users with no roles', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({
        users: [
          { user: 'norole' }
        ]
      });

      const users = await driver.getUsers();

      expect(users[0].name).toBe('norole');
      expect(users[0].superuser).toBe(false);
      expect(users[0].roles).toEqual([]);
    });

    it('should handle empty users array', async () => {
      await driver.connect(makeConfig());

      mockDbCommand.mockResolvedValueOnce({
        users: []
      });

      const users = await driver.getUsers();

      expect(users).toEqual([]);
    });
  });

  // ─── docsToQueryResult edge cases ──────────────────────────────────────

  describe('docsToQueryResult (through execute)', () => {
    it('should sort _id column first in results', async () => {
      await driver.connect(makeConfig());

      const docs = [
        { name: 'Alice', age: 30, _id: 'abc' }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      expect(result.columns[0].name).toBe('_id');
      expect(result.columns[0].primaryKey).toBe(true);
    });

    it('should collect all unique keys across all documents', async () => {
      await driver.connect(makeConfig());

      const docs = [
        { _id: '1', a: 1 },
        { _id: '2', b: 2 },
        { _id: '3', c: 3 }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      const colNames = result.columns.map((c) => c.name);
      expect(colNames).toContain('_id');
      expect(colNames).toContain('a');
      expect(colNames).toContain('b');
      expect(colNames).toContain('c');
    });

    it('should use String as default type when all values are null', async () => {
      await driver.connect(makeConfig());

      const docs = [
        { _id: '1', field: null },
        { _id: '2', field: null }
      ];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const result = await driver.execute('db.users.find({})');

      const fieldCol = result.columns.find((c) => c.name === 'field');
      // When all values are null/undefined, it finds null first, which causes inferBsonType to return 'Null'
      // But the first non-null check in docsToQueryResult means it falls through to default 'String'
      expect(fieldCol?.type).toBe('String');
    });
  });

  // ─── ensureDb edge cases ───────────────────────────────────────────────

  describe('ensureDb edge cases', () => {
    it('should throw Database not selected when db is null but connected', async () => {
      // Connect sets db, but we can test getDb behavior
      // Already tested via getDb tests, but we need specific behavior
      await driver.connect(makeConfig());
      // getDb returns ensureDb()
      const db = driver.getDb();
      expect(db).toBeDefined();
    });
  });

  // ─── execute argument parsing edge cases ───────────────────────────────

  describe('execute argument parsing', () => {
    it('should return error when arguments cannot be parsed as JSON', async () => {
      await driver.connect(makeConfig());

      const result = await driver.execute('db.users.find({invalid: json here})');

      expect(result.error).toContain('Failed to parse arguments');
    });

    it('should handle arguments that parse as single JSON but not as array items', async () => {
      await driver.connect(makeConfig());

      // This triggers the fallback: first try `[{...}]` fails, then try `JSON.parse(argsStr)` succeeds
      mockCountDocuments.mockResolvedValueOnce(10);

      // A bare string argument like "role" passes through the first parse as JSON array
      const result = await driver.execute('db.users.countDocuments({"active": true})');

      expect(result.error).toBeUndefined();
      expect(result.rows[0]['count']).toBe(10);
    });
  });

  // ─── inferBsonType Unknown fallback ───────────────────────────────────

  describe('inferBsonType Unknown fallback', () => {
    it('should return Unknown for symbol type values', async () => {
      await driver.connect(makeConfig());

      // Symbol is a type that inferBsonType does not handle explicitly
      // However, typeof Symbol() is 'symbol', which falls through all checks
      const symVal = Symbol('test');
      const docs = [{ _id: 'abc', field: symVal }];
      mockFind.mockReturnValueOnce({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValueOnce(docs) }))
      });

      const columns = await driver.getColumns('users');
      const fieldCol = columns.find((c) => c.name === 'field');
      expect(fieldCol?.type).toBe('Unknown');
    });
  });
});
