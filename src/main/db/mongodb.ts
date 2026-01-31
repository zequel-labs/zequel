import { MongoClient, Db, ObjectId, Document } from 'mongodb'
import { BaseDriver, TestConnectionResult } from './base'
import {
  DatabaseType,
  SSLMode,
  type ConnectionConfig,
  type QueryResult,
  type Database as DatabaseInfo,
  type Table,
  type Column,
  type Index,
  type ForeignKey,
  type DataOptions,
  type DataResult,
  type ColumnInfo,
  type Routine,
  type DatabaseUser,
  type UserPrivilege,
  type Trigger
} from '../types'
import type {
  AddColumnRequest,
  ModifyColumnRequest,
  DropColumnRequest,
  RenameColumnRequest,
  CreateIndexRequest,
  DropIndexRequest,
  AddForeignKeyRequest,
  DropForeignKeyRequest,
  CreateTableRequest,
  DropTableRequest,
  RenameTableRequest,
  InsertRowRequest,
  DeleteRowRequest,
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest,
  SchemaOperationResult,
  DataTypeInfo,
  CreateTriggerRequest,
  DropTriggerRequest
} from '../types/schema-operations'

// MongoDB data types for UI display
const MONGODB_DATA_TYPES: DataTypeInfo[] = [
  { name: 'String', category: 'string' },
  { name: 'Number', category: 'numeric' },
  { name: 'Boolean', category: 'boolean' },
  { name: 'Date', category: 'datetime' },
  { name: 'ObjectId', category: 'other' },
  { name: 'Array', category: 'other' },
  { name: 'Object', category: 'json' },
  { name: 'Binary', category: 'binary' },
  { name: 'Int32', category: 'numeric' },
  { name: 'Int64', category: 'numeric' },
  { name: 'Double', category: 'numeric' },
  { name: 'Decimal128', category: 'numeric' },
  { name: 'Timestamp', category: 'datetime' },
  { name: 'Null', category: 'other' },
  { name: 'RegExp', category: 'other' }
]

export class MongoDBDriver extends BaseDriver {
  readonly type = DatabaseType.MongoDB
  private client: MongoClient | null = null
  private db: Db | null = null
  private currentDatabase: string = ''

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const uri = this.buildConnectionUri(config)
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      })
      await this.client.connect()

      this.currentDatabase = this.extractDatabaseName(config.database || 'admin')
      this.db = this.client.db(this.currentDatabase)

      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
      this.db = null
    }
    this._isConnected = false
    this.config = null
  }

  /**
   * Returns the underlying Db instance for direct access (e.g., backup operations).
   */
  getDb(): Db {
    return this.ensureDb()
  }

  /**
   * Returns the underlying MongoClient for direct access (e.g., backup operations).
   */
  getClient(): MongoClient {
    this.ensureConnected()
    if (!this.client) {
      throw new Error('MongoDB client not available')
    }
    return this.client
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      let serverVersion = 'Unknown'
      const serverInfo: Record<string, string> = {}
      try {
        const db = this.ensureDb()
        const buildInfo = await db.command({ buildInfo: 1 })
        serverVersion = `MongoDB ${buildInfo.version || 'Unknown'}`
        if (buildInfo.gitVersion) serverInfo['Git Version'] = buildInfo.gitVersion
        if (buildInfo.javascriptEngine) serverInfo['JS Engine'] = buildInfo.javascriptEngine
        if (buildInfo.storageEngines) serverInfo['Storage Engines'] = buildInfo.storageEngines.join(', ')
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Extract the database name from a value that may be a full MongoDB URI or a plain name.
   */
  private extractDatabaseName(value: string): string {
    if (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://')) {
      try {
        const url = new URL(value)
        return url.pathname.replace(/^\//, '') || 'admin'
      } catch {
        return 'admin'
      }
    }
    return value
  }

  private buildConnectionUri(config: ConnectionConfig): string {
    // If a full connection string is provided in the database field (starts with mongodb:// or mongodb+srv://)
    if (config.database?.startsWith('mongodb://') || config.database?.startsWith('mongodb+srv://')) {
      return config.database
    }

    const host = config.host || 'localhost'
    const port = config.port || 27017
    const username = config.username ? encodeURIComponent(config.username) : ''
    const password = config.password ? encodeURIComponent(config.password) : ''

    let uri = 'mongodb://'
    if (username && password) {
      uri += `${username}:${password}@`
    } else if (username) {
      uri += `${username}@`
    }
    uri += `${host}:${port}`

    const params: string[] = []
    if (config.ssl || (config.sslConfig?.enabled && config.sslConfig?.mode !== SSLMode.Disable)) {
      params.push('tls=true')
      if (config.sslConfig?.rejectUnauthorized === false) {
        params.push('tlsAllowInvalidCertificates=true')
      }
    }

    if (config.database && config.database !== 'admin') {
      uri += `/${config.database}`
    }

    if (params.length > 0) {
      uri += (uri.includes('/') ? '?' : '/?') + params.join('&')
    }

    return uri
  }

  private ensureDb(): Db {
    this.ensureConnected()
    if (!this.db) {
      throw new Error('Database not selected')
    }
    return this.db
  }

  /**
   * Serialize MongoDB document values for transport.
   * Converts ObjectId, Date, Buffer, and other MongoDB-specific types to plain JS.
   */
  private serializeDocument(doc: Document): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(doc)) {
      result[key] = this.serializeValue(value)
    }
    return result
  }

  private serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }
    if (value instanceof ObjectId) {
      return value.toHexString()
    }
    if (value instanceof Date) {
      return value.toISOString()
    }
    if (Buffer.isBuffer(value)) {
      return `<Binary: ${value.length} bytes>`
    }
    if (typeof value === 'bigint') {
      return value.toString()
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.serializeValue(v))
    }
    if (value && typeof value === 'object') {
      // Handle BSON types with _bsontype
      const bsonObj = value as Record<string, unknown>
      if (bsonObj._bsontype === 'Decimal128') {
        return String(value)
      }
      if (bsonObj._bsontype === 'Long' || bsonObj._bsontype === 'Int32') {
        return Number(value)
      }
      if (bsonObj._bsontype === 'Timestamp') {
        return String(value)
      }
      if (bsonObj._bsontype === 'Binary') {
        return '<Binary data>'
      }
      // Recurse for plain objects
      const serialized: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) {
        serialized[k] = this.serializeValue(v)
      }
      return serialized
    }
    return value
  }

  /**
   * Infer the BSON type name from a JS value.
   */
  private inferBsonType(value: unknown): string {
    if (value === null || value === undefined) return 'Null'
    if (value instanceof ObjectId) return 'ObjectId'
    if (value instanceof Date) return 'Date'
    if (Buffer.isBuffer(value)) return 'Binary'
    if (typeof value === 'boolean') return 'Boolean'
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'Number (Int)' : 'Number (Double)'
    }
    if (typeof value === 'string') return 'String'
    if (typeof value === 'bigint') return 'Int64'
    if (Array.isArray(value)) return 'Array'
    if (value && typeof value === 'object') {
      const bsonObj = value as Record<string, unknown>
      if (bsonObj._bsontype === 'Decimal128') return 'Decimal128'
      if (bsonObj._bsontype === 'Long') return 'Int64'
      if (bsonObj._bsontype === 'Int32') return 'Int32'
      if (bsonObj._bsontype === 'Timestamp') return 'Timestamp'
      if (bsonObj._bsontype === 'Binary') return 'Binary'
      return 'Object'
    }
    return 'Unknown'
  }

  // ─── Execute (query runner) ──────────────────────────────────────────

  async execute(query: string, _params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const result = await this.executeMongoQuery(query)
      return {
        ...result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Parse and execute a MongoDB query string.
   * Supports patterns like:
   *   db.collection.find({...})
   *   db.collection.aggregate([...])
   *   db.collection.insertOne({...})
   *   db.collection.insertMany([...])
   *   db.collection.updateOne({filter}, {update})
   *   db.collection.updateMany({filter}, {update})
   *   db.collection.deleteOne({filter})
   *   db.collection.deleteMany({filter})
   *   db.collection.countDocuments({filter})
   *   db.collection.distinct("field", {filter})
   *   db.collection.createIndex({keys}, {options})
   *   db.collection.dropIndex("name")
   *   db.collection.drop()
   */
  private async executeMongoQuery(query: string): Promise<Omit<QueryResult, 'executionTime'>> {
    const db = this.ensureDb()
    const trimmed = query.trim()

    // Parse: db.<collection>.<method>(<args>)
    const match = trimmed.match(/^db\.(\w+)\.(\w+)\(([\s\S]*)\)$/s)
    if (!match) {
      // Try simple commands like db.getCollectionNames()
      if (trimmed === 'db.getCollectionNames()') {
        const collections = await db.listCollections().toArray()
        const names = collections.map((c) => c.name).sort()
        return {
          columns: [{ name: 'name', type: 'String', nullable: false }],
          rows: names.map((n) => ({ name: n })),
          rowCount: names.length
        }
      }
      if (trimmed.match(/^db\.stats\(\s*\)$/)) {
        const stats = await db.stats()
        const serialized = this.serializeDocument(stats as unknown as Document)
        return {
          columns: Object.keys(serialized).map((k) => ({ name: k, type: 'String', nullable: true })),
          rows: [serialized],
          rowCount: 1
        }
      }
      throw new Error(
        'Invalid MongoDB query. Use format: db.collection.method(...)\n' +
        'Supported methods: find, aggregate, insertOne, insertMany, updateOne, updateMany, ' +
        'deleteOne, deleteMany, countDocuments, distinct, createIndex, dropIndex, drop'
      )
    }

    const collectionName = match[1]
    const method = match[2]
    const argsStr = match[3].trim()

    const collection = db.collection(collectionName)

    // Parse arguments as JSON (wrap in array brackets for multi-arg parsing)
    let args: unknown[] = []
    if (argsStr) {
      try {
        // Attempt to parse as a JSON array of arguments
        args = JSON.parse(`[${argsStr}]`)
      } catch {
        // Try wrapping in object braces if it looks like a bare object
        try {
          args = [JSON.parse(argsStr)]
        } catch {
          throw new Error(`Failed to parse arguments: ${argsStr}`)
        }
      }
    }

    switch (method) {
      case 'find': {
        const filter = (args[0] as Document) || {}
        const projection = (args[1] as Document) || {}
        const cursor = collection.find(filter, { projection })
        // Apply limit to prevent returning too many docs
        const docs = await cursor.limit(1000).toArray()
        return this.docsToQueryResult(docs)
      }

      case 'findOne': {
        const filter = (args[0] as Document) || {}
        const doc = await collection.findOne(filter)
        return this.docsToQueryResult(doc ? [doc] : [])
      }

      case 'aggregate': {
        const pipeline = (args[0] as Document[]) || []
        const docs = await collection.aggregate(pipeline).toArray()
        return this.docsToQueryResult(docs)
      }

      case 'insertOne': {
        const doc = (args[0] as Document) || {}
        const result = await collection.insertOne(doc)
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'insertedId', type: 'ObjectId', nullable: false }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            insertedId: result.insertedId.toHexString()
          }],
          rowCount: 1,
          affectedRows: result.acknowledged ? 1 : 0
        }
      }

      case 'insertMany': {
        const docs = (args[0] as Document[]) || []
        const result = await collection.insertMany(docs)
        const insertedIds: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(result.insertedIds)) {
          insertedIds[key] = value instanceof ObjectId ? value.toHexString() : String(value)
        }
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'insertedCount', type: 'Number', nullable: false },
            { name: 'insertedIds', type: 'Object', nullable: false }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            insertedCount: result.insertedCount,
            insertedIds
          }],
          rowCount: 1,
          affectedRows: result.insertedCount
        }
      }

      case 'updateOne': {
        const filter = (args[0] as Document) || {}
        const update = (args[1] as Document) || {}
        const options = (args[2] as Document) || {}
        const result = await collection.updateOne(filter, update, options)
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'matchedCount', type: 'Number', nullable: false },
            { name: 'modifiedCount', type: 'Number', nullable: false },
            { name: 'upsertedId', type: 'String', nullable: true }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedId: result.upsertedId ? result.upsertedId.toHexString() : null
          }],
          rowCount: 1,
          affectedRows: result.modifiedCount
        }
      }

      case 'updateMany': {
        const filter = (args[0] as Document) || {}
        const update = (args[1] as Document) || {}
        const options = (args[2] as Document) || {}
        const result = await collection.updateMany(filter, update, options)
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'matchedCount', type: 'Number', nullable: false },
            { name: 'modifiedCount', type: 'Number', nullable: false },
            { name: 'upsertedId', type: 'String', nullable: true }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
            upsertedId: result.upsertedId ? result.upsertedId.toHexString() : null
          }],
          rowCount: 1,
          affectedRows: result.modifiedCount
        }
      }

      case 'deleteOne': {
        const filter = (args[0] as Document) || {}
        const result = await collection.deleteOne(filter)
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'deletedCount', type: 'Number', nullable: false }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            deletedCount: result.deletedCount
          }],
          rowCount: 1,
          affectedRows: result.deletedCount
        }
      }

      case 'deleteMany': {
        const filter = (args[0] as Document) || {}
        const result = await collection.deleteMany(filter)
        return {
          columns: [
            { name: 'acknowledged', type: 'Boolean', nullable: false },
            { name: 'deletedCount', type: 'Number', nullable: false }
          ],
          rows: [{
            acknowledged: result.acknowledged,
            deletedCount: result.deletedCount
          }],
          rowCount: 1,
          affectedRows: result.deletedCount
        }
      }

      case 'countDocuments': {
        const filter = (args[0] as Document) || {}
        const count = await collection.countDocuments(filter)
        return {
          columns: [{ name: 'count', type: 'Number', nullable: false }],
          rows: [{ count }],
          rowCount: 1
        }
      }

      case 'distinct': {
        const field = args[0] as string
        const filter = (args[1] as Document) || {}
        const values = await collection.distinct(field, filter)
        return {
          columns: [{ name: field, type: 'String', nullable: true }],
          rows: values.map((v) => ({ [field]: this.serializeValue(v) })),
          rowCount: values.length
        }
      }

      case 'createIndex': {
        const keys = (args[0] as Document) || {}
        const options = (args[1] as Document) || {}
        const indexName = await collection.createIndex(keys, options)
        return {
          columns: [{ name: 'indexName', type: 'String', nullable: false }],
          rows: [{ indexName }],
          rowCount: 1
        }
      }

      case 'dropIndex': {
        const indexName = args[0] as string
        await collection.dropIndex(indexName)
        return {
          columns: [{ name: 'result', type: 'String', nullable: false }],
          rows: [{ result: `Index '${indexName}' dropped` }],
          rowCount: 1
        }
      }

      case 'drop': {
        const dropped = await collection.drop()
        return {
          columns: [{ name: 'dropped', type: 'Boolean', nullable: false }],
          rows: [{ dropped }],
          rowCount: 1
        }
      }

      default:
        throw new Error(`Unsupported MongoDB method: ${method}`)
    }
  }

  /**
   * Convert an array of MongoDB documents into a QueryResult.
   */
  private docsToQueryResult(docs: Document[]): Omit<QueryResult, 'executionTime'> {
    if (docs.length === 0) {
      return { columns: [], rows: [], rowCount: 0 }
    }

    // Collect all unique keys across all documents
    const keySet = new Set<string>()
    for (const doc of docs) {
      for (const key of Object.keys(doc)) {
        keySet.add(key)
      }
    }

    const keys = Array.from(keySet)
    // Put _id first if present
    keys.sort((a, b) => {
      if (a === '_id') return -1
      if (b === '_id') return 1
      return a.localeCompare(b)
    })

    // Infer column types from first non-null value
    const columns: ColumnInfo[] = keys.map((key) => {
      let type = 'String'
      for (const doc of docs) {
        if (doc[key] !== null && doc[key] !== undefined) {
          type = this.inferBsonType(doc[key])
          break
        }
      }
      return {
        name: key,
        type,
        nullable: true,
        primaryKey: key === '_id'
      }
    })

    const rows = docs.map((doc) => this.serializeDocument(doc))

    return {
      columns,
      rows,
      rowCount: docs.length
    }
  }

  // ─── Schema browsing ─────────────────────────────────────────────────

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    if (!this.client) throw new Error('Client not connected')

    const adminDb = this.client.db('admin')
    try {
      const result = await adminDb.admin().listDatabases()
      return result.databases.map((db) => ({
        name: db.name
      }))
    } catch {
      // If no admin access, return the current database only
      return [{ name: this.currentDatabase }]
    }
  }

  async getTables(database: string, _schema?: string): Promise<Table[]> {
    this.ensureConnected()
    if (!this.client) throw new Error('Client not connected')

    // Switch database if needed
    const dbName = this.extractDatabaseName(database)
    if (dbName !== this.currentDatabase) {
      this.db = this.client.db(dbName)
      this.currentDatabase = dbName
    }

    const db = this.ensureDb()
    const collections = await db.listCollections().toArray()

    const tables: Table[] = []
    for (const col of collections) {
      let rowCount: number | undefined
      try {
        rowCount = await db.collection(col.name).estimatedDocumentCount()
      } catch {
        // Ignore count errors
      }

      tables.push({
        name: col.name,
        type: col.type === 'view' ? 'view' : 'table',
        rowCount,
        comment: col.type === 'view' ? 'MongoDB View' : 'MongoDB Collection'
      })
    }

    return tables.sort((a, b) => a.name.localeCompare(b.name))
  }

  async getColumns(table: string): Promise<Column[]> {
    const db = this.ensureDb()
    const collection = db.collection(table)

    // Sample documents to infer schema
    const sampleDocs = await collection.find().limit(100).toArray()

    if (sampleDocs.length === 0) {
      // Return _id as default column for empty collections
      return [{
        name: '_id',
        type: 'ObjectId',
        nullable: false,
        defaultValue: null,
        primaryKey: true,
        autoIncrement: false,
        unique: true,
        comment: 'Primary key'
      }]
    }

    // Gather all field names and their types across sampled docs
    const fieldInfo = new Map<string, { types: Set<string>; nullCount: number; totalCount: number }>()

    for (const doc of sampleDocs) {
      this.extractFieldInfo(doc, '', fieldInfo, sampleDocs.length)
    }

    const columns: Column[] = []
    // Ensure _id comes first
    const sortedFields = Array.from(fieldInfo.entries()).sort(([a], [b]) => {
      if (a === '_id') return -1
      if (b === '_id') return 1
      return a.localeCompare(b)
    })

    for (const [fieldName, info] of sortedFields) {
      const typeArray = Array.from(info.types)
      const type = typeArray.length === 1 ? typeArray[0] : `Mixed (${typeArray.join(', ')})`

      columns.push({
        name: fieldName,
        type,
        nullable: info.nullCount > 0 || info.totalCount < sampleDocs.length,
        defaultValue: null,
        primaryKey: fieldName === '_id',
        autoIncrement: false,
        unique: fieldName === '_id',
        comment: info.totalCount < sampleDocs.length
          ? `Present in ${info.totalCount}/${sampleDocs.length} sampled docs`
          : undefined
      })
    }

    return columns
  }

  private extractFieldInfo(
    doc: Document,
    prefix: string,
    fieldInfo: Map<string, { types: Set<string>; nullCount: number; totalCount: number }>,
    _totalDocs: number
  ): void {
    for (const [key, value] of Object.entries(doc)) {
      const fieldName = prefix ? `${prefix}.${key}` : key

      if (!fieldInfo.has(fieldName)) {
        fieldInfo.set(fieldName, { types: new Set(), nullCount: 0, totalCount: 0 })
      }

      const info = fieldInfo.get(fieldName)!
      info.totalCount++

      if (value === null || value === undefined) {
        info.nullCount++
        info.types.add('Null')
      } else {
        info.types.add(this.inferBsonType(value))
      }
    }
  }

  async getIndexes(table: string): Promise<Index[]> {
    const db = this.ensureDb()
    const collection = db.collection(table)

    try {
      const indexes = await collection.indexes()
      return indexes.map((idx) => ({
        name: idx.name || 'unknown',
        columns: Object.keys(idx.key as Document),
        unique: idx.unique || false,
        primary: idx.name === '_id_',
        type: this.getIndexType(idx.key as Document)
      }))
    } catch {
      return []
    }
  }

  private getIndexType(key: Document): string {
    const values = Object.values(key)
    if (values.includes('text')) return 'text'
    if (values.includes('2dsphere')) return '2dsphere'
    if (values.includes('2d')) return '2d'
    if (values.includes('hashed')) return 'hashed'
    return 'btree'
  }

  async getForeignKeys(_table: string): Promise<ForeignKey[]> {
    // MongoDB does not have foreign key constraints
    return []
  }

  async getTableDDL(table: string): Promise<string> {
    const db = this.ensureDb()
    const collection = db.collection(table)

    // Build a pseudo-DDL showing collection info, indexes, and sample schema
    const lines: string[] = []
    lines.push(`// MongoDB Collection: ${table}`)
    lines.push(`// Database: ${this.currentDatabase}`)
    lines.push('')

    // Show indexes
    try {
      const indexes = await collection.indexes()
      if (indexes.length > 0) {
        lines.push('// Indexes:')
        for (const idx of indexes) {
          lines.push(`db.${table}.createIndex(${JSON.stringify(idx.key)}, ${JSON.stringify({ name: idx.name, unique: idx.unique || false })})`)
        }
        lines.push('')
      }
    } catch {
      // Ignore
    }

    // Show inferred schema from sample
    const columns = await this.getColumns(table)
    if (columns.length > 0) {
      lines.push('// Inferred schema (from sampling):')
      lines.push('// {')
      for (const col of columns) {
        const nullable = col.nullable ? ' (optional)' : ''
        lines.push(`//   "${col.name}": ${col.type}${nullable}`)
      }
      lines.push('// }')
    }

    // Show document count
    try {
      const count = await collection.estimatedDocumentCount()
      lines.push('')
      lines.push(`// Estimated document count: ${count}`)
    } catch {
      // Ignore
    }

    return lines.join('\n')
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    const db = this.ensureDb()
    const collection = db.collection(table)

    // Build MongoDB filter from DataOptions filters
    const filter = this.buildMongoFilter(options)
    const sort = this.buildMongoSort(options)
    const skip = options.offset || 0
    const limit = options.limit || 50

    // Get total count with filter
    const totalCount = await collection.countDocuments(filter)

    // Get columns info
    const columnsInfo = await this.getColumns(table)
    const columns: ColumnInfo[] = columnsInfo.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      primaryKey: col.primaryKey,
      defaultValue: col.defaultValue,
      autoIncrement: col.autoIncrement
    }))

    // Get data
    const docs = await collection
      .find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    const rows = docs.map((doc) => this.serializeDocument(doc))

    return {
      columns,
      rows,
      totalCount,
      offset: skip,
      limit
    }
  }

  private buildMongoFilter(options: DataOptions): Document {
    if (!options.filters || options.filters.length === 0) {
      return {}
    }

    const conditions: Document[] = []

    for (const filter of options.filters) {
      const field = filter.column

      switch (filter.operator) {
        case '=':
          conditions.push({ [field]: this.coerceFilterValue(filter.value) })
          break
        case '!=':
          conditions.push({ [field]: { $ne: this.coerceFilterValue(filter.value) } })
          break
        case '>':
          conditions.push({ [field]: { $gt: this.coerceFilterValue(filter.value) } })
          break
        case '<':
          conditions.push({ [field]: { $lt: this.coerceFilterValue(filter.value) } })
          break
        case '>=':
          conditions.push({ [field]: { $gte: this.coerceFilterValue(filter.value) } })
          break
        case '<=':
          conditions.push({ [field]: { $lte: this.coerceFilterValue(filter.value) } })
          break
        case 'LIKE':
        case 'NOT LIKE': {
          // Convert SQL LIKE pattern to regex
          const pattern = String(filter.value).replace(/%/g, '.*').replace(/_/g, '.')
          const regex = { $regex: pattern, $options: 'i' }
          if (filter.operator === 'NOT LIKE') {
            conditions.push({ [field]: { $not: regex } })
          } else {
            conditions.push({ [field]: regex })
          }
          break
        }
        case 'IN':
          if (Array.isArray(filter.value)) {
            conditions.push({ [field]: { $in: filter.value.map((v) => this.coerceFilterValue(v)) } })
          }
          break
        case 'NOT IN':
          if (Array.isArray(filter.value)) {
            conditions.push({ [field]: { $nin: filter.value.map((v) => this.coerceFilterValue(v)) } })
          }
          break
        case 'IS NULL':
          conditions.push({ [field]: { $eq: null } })
          break
        case 'IS NOT NULL':
          conditions.push({ [field]: { $ne: null } })
          break
      }
    }

    if (conditions.length === 0) return {}
    if (conditions.length === 1) return conditions[0]
    return { $and: conditions }
  }

  private coerceFilterValue(value: unknown): unknown {
    if (value === null || value === undefined) return null
    const str = String(value)
    // Try to coerce ObjectId strings
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      try {
        return new ObjectId(str)
      } catch {
        // Not a valid ObjectId, return as string
      }
    }
    // Try numeric
    if (!isNaN(Number(str)) && str.trim() !== '') {
      return Number(str)
    }
    return value
  }

  private buildMongoSort(options: DataOptions): Document {
    if (!options.orderBy) return {}
    const direction = options.orderDirection === 'DESC' ? -1 : 1
    return { [options.orderBy]: direction }
  }

  // ─── Schema editing operations (limited for MongoDB) ─────────────────

  getDataTypes(): DataTypeInfo[] {
    return MONGODB_DATA_TYPES
  }

  async getPrimaryKeyColumns(_table: string): Promise<string[]> {
    // MongoDB always uses _id as primary key
    return ['_id']
  }

  async addColumn(_request: AddColumnRequest): Promise<SchemaOperationResult> {
    // MongoDB is schema-less; fields are added by inserting/updating documents
    return {
      success: false,
      error: 'MongoDB is schema-less. Fields are added automatically when documents are inserted or updated.'
    }
  }

  async modifyColumn(_request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB is schema-less. Field types are not enforced at the database level.'
    }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    // We can unset a field from all documents in the collection
    const db = this.ensureDb()
    const collection = db.collection(request.table)
    const mongoCmd = `db.${request.table}.updateMany({}, { $unset: { "${request.columnName}": "" } })`

    try {
      const result = await collection.updateMany({}, { $unset: { [request.columnName]: '' } })
      return {
        success: true,
        sql: mongoCmd,
        affectedRows: result.modifiedCount
      }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const collection = db.collection(request.table)
    const mongoCmd = `db.${request.table}.updateMany({}, { $rename: { "${request.oldName}": "${request.newName}" } })`

    try {
      const result = await collection.updateMany({}, { $rename: { [request.oldName]: request.newName } })
      return {
        success: true,
        sql: mongoCmd,
        affectedRows: result.modifiedCount
      }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const collection = db.collection(request.table)

    const keys: Document = {}
    for (const col of request.index.columns) {
      keys[col] = 1
    }

    const mongoCmd = `db.${request.table}.createIndex(${JSON.stringify(keys)}, { name: "${request.index.name}", unique: ${request.index.unique || false} })`

    try {
      await collection.createIndex(keys, {
        name: request.index.name,
        unique: request.index.unique || false
      })
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const collection = db.collection(request.table)
    const mongoCmd = `db.${request.table}.dropIndex("${request.indexName}")`

    try {
      await collection.dropIndex(request.indexName)
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async addForeignKey(_request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB does not support foreign key constraints.'
    }
  }

  async dropForeignKey(_request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB does not support foreign key constraints.'
    }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const mongoCmd = `db.createCollection("${request.table.name}")`

    try {
      await db.createCollection(request.table.name)
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const mongoCmd = `db.${request.table}.drop()`

    try {
      await db.collection(request.table).drop()
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const mongoCmd = `db.${request.oldName}.renameCollection("${request.newName}")`

    try {
      await db.collection(request.oldName).rename(request.newName)
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const collection = db.collection(request.table)
    const mongoCmd = `db.${request.table}.insertOne(${JSON.stringify(request.values)})`

    try {
      const result = await collection.insertOne(request.values as Document)
      return {
        success: true,
        sql: mongoCmd,
        affectedRows: result.acknowledged ? 1 : 0
      }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()
    const collection = db.collection(request.table)

    // Build filter from primary key values
    const filter: Document = {}
    for (const [key, value] of Object.entries(request.primaryKeyValues)) {
      if (key === '_id' && typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
        filter[key] = new ObjectId(value)
      } else {
        filter[key] = value
      }
    }

    const mongoCmd = `db.${request.table}.deleteOne(${JSON.stringify(request.primaryKeyValues)})`

    try {
      const result = await collection.deleteOne(filter)
      return {
        success: true,
        sql: mongoCmd,
        affectedRows: result.deletedCount
      }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // ─── View operations ─────────────────────────────────────────────────

  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    const db = this.ensureDb()

    // MongoDB views are created with a pipeline on a source collection
    // We'll try to parse the select statement as a JSON pipeline
    try {
      let pipeline: Document[] = []
      try {
        pipeline = JSON.parse(request.view.selectStatement)
      } catch {
        return {
          success: false,
          error: 'For MongoDB views, provide the aggregation pipeline as a JSON array in the select statement field.'
        }
      }

      // The first element should be the source collection
      // Format: { "source": "collectionName", "pipeline": [...] }
      const mongoCmd = `db.createView("${request.view.name}", "source", ${JSON.stringify(pipeline)})`

      await db.createCollection(request.view.name, {
        viewOn: 'source',
        pipeline
      })

      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    // In MongoDB, views are dropped just like collections
    const db = this.ensureDb()
    const mongoCmd = `db.${request.viewName}.drop()`

    try {
      await db.collection(request.viewName).drop()
      return { success: true, sql: mongoCmd }
    } catch (error) {
      return {
        success: false,
        sql: mongoCmd,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async renameView(_request: RenameViewRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB does not support renaming views directly. Drop and recreate the view instead.'
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    const db = this.ensureDb()

    try {
      const collections = await db.listCollections({ name: viewName }).toArray()
      if (collections.length > 0 && collections[0].type === 'view') {
        const viewInfo = collections[0]
        return JSON.stringify(viewInfo, null, 2)
      }
      return `// View '${viewName}' not found`
    } catch {
      return `// Error retrieving view definition for '${viewName}'`
    }
  }

  // ─── Routine operations (not supported in MongoDB) ────────────────────

  async getRoutines(_type?: 'PROCEDURE' | 'FUNCTION'): Promise<Routine[]> {
    // MongoDB does not have stored procedures/functions
    return []
  }

  async getRoutineDefinition(_name: string, _type: 'PROCEDURE' | 'FUNCTION'): Promise<string> {
    return '// MongoDB does not support stored procedures or functions.'
  }

  // ─── User management ─────────────────────────────────────────────────

  async getUsers(): Promise<DatabaseUser[]> {
    this.ensureConnected()
    if (!this.client) throw new Error('Client not connected')

    try {
      const db = this.client.db('admin')
      const result = await db.command({ usersInfo: 1 })
      return (result.users || []).map((user: Document) => ({
        name: user.user as string,
        roles: ((user.roles || []) as Document[]).map((r) => `${r.role}@${r.db}`),
        superuser: ((user.roles || []) as Document[]).some(
          (r) => r.role === 'root' || r.role === 'userAdminAnyDatabase' || r.role === 'dbAdminAnyDatabase'
        )
      }))
    } catch {
      // If no admin access, return empty
      return []
    }
  }

  async getUserPrivileges(username: string, _host?: string): Promise<UserPrivilege[]> {
    this.ensureConnected()
    if (!this.client) throw new Error('Client not connected')

    try {
      const db = this.client.db('admin')
      const result = await db.command({ usersInfo: { user: username, db: 'admin' }, showPrivileges: true })
      const user = result.users?.[0]
      if (!user) return []

      const privileges: UserPrivilege[] = []

      // Extract inherited privileges
      if (user.inheritedPrivileges) {
        for (const priv of user.inheritedPrivileges as Document[]) {
          const resource = priv.resource as Document
          const actions = priv.actions as string[]
          for (const action of actions) {
            privileges.push({
              privilege: action,
              grantee: username,
              objectType: resource.db ? 'database' : 'cluster',
              objectName: resource.db
                ? (resource.collection ? `${resource.db}.${resource.collection}` : resource.db as string)
                : 'cluster'
            })
          }
        }
      }

      return privileges
    } catch {
      return []
    }
  }

  // ─── Trigger operations (not supported in MongoDB) ────────────────────

  async getTriggers(_table?: string): Promise<Trigger[]> {
    // MongoDB has Change Streams but not traditional triggers
    return []
  }

  async getTriggerDefinition(_name: string, _table?: string): Promise<string> {
    return '// MongoDB does not support traditional triggers. Consider using Change Streams instead.'
  }

  async createTrigger(_request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB does not support triggers. Consider using Change Streams for similar functionality.'
    }
  }

  async dropTrigger(_request: DropTriggerRequest): Promise<SchemaOperationResult> {
    return {
      success: false,
      error: 'MongoDB does not support triggers.'
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.db) return false
      await this.db.command({ ping: 1 })
      return true
    } catch {
      return false
    }
  }
}
