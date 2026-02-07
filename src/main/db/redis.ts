import Redis from 'ioredis'
import { BaseDriver, TestConnectionResult } from './base'
import {
  DatabaseType,
  SSLMode,
  TableObjectType,
  RoutineType,
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
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '../types/schema-operations'

export class RedisDriver extends BaseDriver {
  readonly type = DatabaseType.Redis
  private client: Redis | null = null
  private currentDatabase: number = 0

  private buildBaseOptions(config: ConnectionConfig) {
    const options: Record<string, unknown> = {
      host: config.host || 'localhost',
      port: config.port || 6379,
      db: this.parseDatabaseNumber(config.database),
      lazyConnect: true,
      connectTimeout: 10000
    }
    if (config.password) options.password = config.password
    if (config.username) options.username = config.username
    return options
  }

  private buildTLSOptions(config: ConnectionConfig): Record<string, unknown> | undefined {
    const sslEnabled = config.ssl || config.sslConfig?.enabled
    const mode = config.sslConfig?.mode ?? SSLMode.Disable
    if (!sslEnabled || mode === SSLMode.Disable) return undefined

    const rejectUnauthorized = mode === SSLMode.Prefer
      ? false
      : (mode === SSLMode.VerifyCA || mode === SSLMode.VerifyFull)
        ? true
        : (config.sslConfig?.rejectUnauthorized ?? false)

    return {
      rejectUnauthorized,
      ...(config.sslConfig?.ca ? { ca: config.sslConfig.ca } : {}),
      ...(config.sslConfig?.cert ? { cert: config.sslConfig.cert } : {}),
      ...(config.sslConfig?.key ? { key: config.sslConfig.key } : {})
    }
  }

  async connect(config: ConnectionConfig): Promise<void> {
    const mode = config.sslConfig?.mode ?? SSLMode.Disable
    const tls = this.buildTLSOptions(config)
    const options = this.buildBaseOptions(config)
    if (tls) options.tls = tls

    // Suppress ioredis "Unhandled error event" during connection attempts.
    // Without this, a TLS timeout emits an 'error' event with no listener,
    // which ioredis logs to stderr and could crash in strict environments.
    const noop = () => {}

    try {
      this.client = new Redis(options as any)
      this.client.on('error', noop)
      await this.client.connect()
      this.client.off('error', noop)
      this.currentDatabase = this.parseDatabaseNumber(config.database)
      this.config = config
      this._isConnected = true
    } catch (error) {
      // For 'prefer' mode: if TLS fails, retry without TLS
      if (mode === SSLMode.Prefer && tls) {
        if (this.client) { this.client.disconnect(); this.client = null }

        try {
          const plainOptions = this.buildBaseOptions(config)
          this.client = new Redis(plainOptions as any)
          this.client.on('error', noop)
          await this.client.connect()
          this.client.off('error', noop)
          this.currentDatabase = this.parseDatabaseNumber(config.database)
          this.config = config
          this._isConnected = true
          return
        } catch (fallbackError) {
          this._isConnected = false
          if (this.client) { this.client.disconnect(); this.client = null }
          throw fallbackError
        }
      }
      this._isConnected = false
      if (this.client) { this.client.disconnect(); this.client = null }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.disconnect()
      this.client = null
    }
    this._isConnected = false
    this.config = null
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      let serverVersion = 'Unknown'
      const serverInfo: Record<string, string> = {}
      try {
        const info = await this.client!.info('server')
        const lines = info.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('redis_version:')) {
            serverVersion = `Redis ${trimmed.split(':')[1]}`
          } else if (trimmed.startsWith('os:')) {
            serverInfo['OS'] = trimmed.split(':')[1]
          } else if (trimmed.startsWith('tcp_port:')) {
            serverInfo['Port'] = trimmed.split(':')[1]
          } else if (trimmed.startsWith('uptime_in_seconds:')) {
            const secs = parseInt(trimmed.split(':')[1], 10)
            if (!isNaN(secs)) {
              const days = Math.floor(secs / 86400)
              const hours = Math.floor((secs % 86400) / 3600)
              serverInfo['Uptime'] = days > 0 ? `${days}d ${hours}h` : `${hours}h`
            }
          } else if (trimmed.startsWith('redis_mode:')) {
            serverInfo['Mode'] = trimmed.split(':')[1]
          }
        }
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /**
   * Execute a Redis command string.
   * Parses command strings like "GET key", "SET key value", "HGETALL myhash", etc.
   */
  async execute(commandString: string, _params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const parts = this.parseCommandString(commandString.trim())
      if (parts.length === 0) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTime: Date.now() - startTime,
          error: 'Empty command'
        }
      }

      const command = parts[0].toUpperCase()
      const args = parts.slice(1)

      // Execute the command using ioredis call()
      const result = await (this.client as any).call(command, ...args)

      // Format result based on the command type
      return this.formatCommandResult(command, result, startTime)
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
   * Returns Redis databases 0-15 with key counts.
   * Parses INFO keyspace to extract keys=N for each active database.
   */
  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()

    const databases: DatabaseInfo[] = []
    try {
      // Use INFO keyspace to get databases with keys
      const info = await this.client!.info('keyspace')
      const dbKeyCounts = new Map<number, number>()

      const lines = info.split('\n')
      for (const line of lines) {
        // Format: db0:keys=123,expires=0,avg_ttl=0
        const match = line.match(/^db(\d+):keys=(\d+)/)
        if (match) {
          dbKeyCounts.set(parseInt(match[1], 10), parseInt(match[2], 10))
        }
      }

      // Only return databases that have keys
      for (const [dbNum, keys] of Array.from(dbKeyCounts.entries()).sort((a, b) => a[0] - b[0])) {
        databases.push({
          name: `db${dbNum}`,
          charset: String(keys)
        })
      }
    } catch {
      // Fallback: return empty list
    }

    return databases
  }

  /**
   * Returns Redis keys matching a pattern as "tables".
   * Uses SCAN to avoid blocking the server (unlike KEYS).
   * Groups keys by their prefix (part before the first ':') to create logical groups.
   */
  async getTables(database: string, _schema?: string): Promise<Table[]> {
    this.ensureConnected()

    // Switch to the requested database
    const dbNum = this.parseDatabaseNumber(database)
    if (dbNum !== this.currentDatabase) {
      await this.client!.select(dbNum)
      this.currentDatabase = dbNum
    }

    // Scan all keys and group by prefix
    const keys = await this.scanAllKeys('*')
    const prefixCounts = new Map<string, number>()

    for (const key of keys) {
      const colonIndex = key.indexOf(':')
      const prefix = colonIndex > 0 ? key.substring(0, colonIndex) + ':*' : key
      prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1)
    }

    // If we have very few unique keys (under 200), show them individually
    // Otherwise show prefix groups
    if (keys.length <= 200) {
      return keys.sort().map((key) => ({
        name: key,
        type: TableObjectType.Table
      }))
    }

    // Show prefix groups for large key spaces
    const tables: Table[] = []
    const sortedPrefixes = Array.from(prefixCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]))

    for (const [prefix, count] of sortedPrefixes) {
      tables.push({
        name: prefix,
        type: TableObjectType.Table,
        rowCount: count
      })
    }

    return tables
  }

  /**
   * Returns columns for displaying Redis key data.
   * Redis keys have: key, type, ttl, and value.
   */
  async getColumns(_table: string): Promise<Column[]> {
    return [
      {
        name: 'key',
        type: 'string',
        nullable: false,
        defaultValue: null,
        primaryKey: true,
        autoIncrement: false,
        unique: true
      },
      {
        name: 'type',
        type: 'string',
        nullable: false,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        unique: false
      },
      {
        name: 'ttl',
        type: 'integer',
        nullable: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        unique: false
      },
      {
        name: 'value',
        type: 'string',
        nullable: true,
        defaultValue: null,
        primaryKey: false,
        autoIncrement: false,
        unique: false
      }
    ]
  }

  /**
   * Returns data for keys matching the table name pattern.
   */
  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    // Determine the pattern to scan
    const pattern = table.endsWith(':*') ? table : table

    // Scan for matching keys
    let keys: string[]
    if (pattern.includes('*')) {
      keys = await this.scanAllKeys(pattern)
    } else {
      // Single key
      const exists = await this.client!.exists(pattern)
      keys = exists ? [pattern] : []
    }

    keys.sort()

    const totalCount = keys.length
    const offset = options.offset || 0
    const limit = options.limit || 50
    const pagedKeys = keys.slice(offset, offset + limit)

    // Get type, TTL, and value for each key
    const rows: Record<string, unknown>[] = []
    for (const key of pagedKeys) {
      const [keyType, ttl, value] = await Promise.all([
        this.client!.type(key),
        this.client!.ttl(key),
        this.getKeyValue(key)
      ])

      rows.push({
        key,
        type: keyType,
        ttl: ttl === -1 ? null : ttl,
        value: typeof value === 'string' ? value : JSON.stringify(value)
      })
    }

    const columns: ColumnInfo[] = [
      { name: 'key', type: 'string', nullable: false, primaryKey: true },
      { name: 'type', type: 'string', nullable: false },
      { name: 'ttl', type: 'integer', nullable: true },
      { name: 'value', type: 'string', nullable: true }
    ]

    return {
      columns,
      rows,
      totalCount,
      offset,
      limit
    }
  }

  // --- Indexes: not applicable for Redis ---
  async getIndexes(_table: string): Promise<Index[]> {
    return []
  }

  // --- Foreign keys: not applicable for Redis ---
  async getForeignKeys(_table: string): Promise<ForeignKey[]> {
    return []
  }

  // --- DDL: show key info ---
  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()
    try {
      const keyType = await this.client!.type(table)
      const ttl = await this.client!.ttl(table)
      const value = await this.getKeyValue(table)

      let ddl = `-- Redis Key: ${table}\n`
      ddl += `-- Type: ${keyType}\n`
      ddl += `-- TTL: ${ttl === -1 ? 'No expiry' : `${ttl} seconds`}\n`
      ddl += `--\n`
      ddl += `-- Value:\n`

      if (typeof value === 'string') {
        ddl += value
      } else {
        ddl += JSON.stringify(value, null, 2)
      }

      return ddl
    } catch {
      return `-- Key '${table}' not found or inaccessible`
    }
  }

  // --- Schema operations: not supported for Redis ---

  getDataTypes(): DataTypeInfo[] {
    return [
      { name: 'string', category: 'string' },
      { name: 'list', category: 'string' },
      { name: 'set', category: 'string' },
      { name: 'zset', category: 'string' },
      { name: 'hash', category: 'string' },
      { name: 'stream', category: 'other' }
    ]
  }

  async getPrimaryKeyColumns(_table: string): Promise<string[]> {
    return ['key']
  }

  async addColumn(_request: AddColumnRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support column operations' }
  }

  async modifyColumn(_request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support column operations' }
  }

  async dropColumn(_request: DropColumnRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support column operations' }
  }

  async renameColumn(_request: RenameColumnRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support column operations' }
  }

  async createIndex(_request: CreateIndexRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support index operations' }
  }

  async dropIndex(_request: DropIndexRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support index operations' }
  }

  async addForeignKey(_request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support foreign key operations' }
  }

  async dropForeignKey(_request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support foreign key operations' }
  }

  async createTable(_request: CreateTableRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support table operations. Use SET, HSET, LPUSH, etc.' }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    try {
      // "Dropping a table" in Redis means deleting the key
      const result = await this.client!.del(request.table)
      return {
        success: true,
        sql: `DEL ${request.table}`,
        affectedRows: result
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    try {
      await this.client!.rename(request.oldName, request.newName)
      return {
        success: true,
        sql: `RENAME ${request.oldName} ${request.newName}`
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    try {
      const key = request.values['key'] as string
      const value = request.values['value'] as string
      if (!key) {
        return { success: false, error: 'Key is required' }
      }
      await this.client!.set(key, value || '')
      return {
        success: true,
        sql: `SET ${key} ${value || ''}`,
        affectedRows: 1
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    try {
      const key = request.primaryKeyValues['key'] as string
      if (!key) {
        return { success: false, error: 'Key is required for deletion' }
      }
      const result = await this.client!.del(key)
      return {
        success: true,
        sql: `DEL ${key}`,
        affectedRows: result
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // --- View operations: not supported for Redis ---
  async createView(_request: CreateViewRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support views' }
  }

  async dropView(_request: DropViewRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support views' }
  }

  async renameView(_request: RenameViewRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support views' }
  }

  async getViewDDL(_viewName: string): Promise<string> {
    return '-- Redis does not support views'
  }

  // --- Routine operations: not supported for Redis ---
  async getRoutines(_type?: RoutineType): Promise<Routine[]> {
    return []
  }

  async getRoutineDefinition(_name: string, _type: RoutineType): Promise<string> {
    return '-- Redis does not support stored procedures or functions'
  }

  // --- User management ---
  async getUsers(): Promise<DatabaseUser[]> {
    this.ensureConnected()
    try {
      const aclList = await (this.client as any).call('ACL', 'LIST') as string[]
      return aclList.map((entry: string) => {
        const parts = entry.split(' ')
        const name = parts[1] || 'default'
        return {
          name,
          hasPassword: !entry.includes('nopass'),
          login: true
        }
      })
    } catch {
      // ACL not supported (Redis < 6.0) or no permission
      return [{ name: 'default', login: true }]
    }
  }

  async createUser(request: CreateUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { name, password } = request.user

    let sql: string
    try {
      if (password) {
        sql = `ACL SETUSER ${name} on >${password} ~* &* +@all`
        const displaySql = `ACL SETUSER ${name} on >**** ~* &* +@all`
        await (this.client as any).call('ACL', 'SETUSER', name, 'on', `>${password}`, '~*', '&*', '+@all')
        return { success: true, sql: displaySql }
      } else {
        sql = `ACL SETUSER ${name} on nopass ~* &* +@all`
        await (this.client as any).call('ACL', 'SETUSER', name, 'on', 'nopass', '~*', '&*', '+@all')
        return { success: true, sql }
      }
    } catch (error) {
      return { success: false, sql: `ACL SETUSER ${name} ...`, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropUser(request: DropUserRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `ACL DELUSER ${request.name}`

    try {
      await (this.client as any).call('ACL', 'DELUSER', request.name)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // --- Trigger operations: not supported for Redis ---
  async getTriggers(_table?: string): Promise<Trigger[]> {
    return []
  }

  async getTriggerDefinition(_name: string, _table?: string): Promise<string> {
    return '-- Redis does not support triggers'
  }

  async createTrigger(_request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support triggers' }
  }

  async dropTrigger(_request: DropTriggerRequest): Promise<SchemaOperationResult> {
    return { success: false, error: 'Redis does not support triggers' }
  }

  // --- Public helper methods for backup ---

  /**
   * Returns the underlying ioredis client for direct access (e.g., backup operations).
   */
  getClient(): Redis {
    this.ensureConnected()
    if (!this.client) {
      throw new Error('Redis client not available')
    }
    return this.client
  }

  /**
   * Scan all keys in the current database using SCAN (non-blocking).
   * Public wrapper for backup usage.
   */
  async getAllKeys(maxKeys: number = 50000): Promise<string[]> {
    return this.scanAllKeys('*', maxKeys)
  }

  // --- Private helper methods ---

  /**
   * Parse a database name/number string into a database index.
   * Accepts "0", "db0", "db0 (empty)", etc.
   */
  private parseDatabaseNumber(database: string): number {
    if (!database) return 0
    const match = database.match(/(\d+)/)
    if (match) {
      const num = parseInt(match[1], 10)
      return num >= 0 && num <= 15 ? num : 0
    }
    return 0
  }

  /**
   * Scan all keys matching a pattern using SCAN (non-blocking).
   */
  private async scanAllKeys(pattern: string, maxKeys: number = 10000): Promise<string[]> {
    const keys: string[] = []
    let cursor = '0'

    do {
      const [nextCursor, batch] = await this.client!.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      cursor = nextCursor
      keys.push(...batch)

      if (keys.length >= maxKeys) {
        break
      }
    } while (cursor !== '0')

    return keys
  }

  /**
   * Get the value of a key based on its type.
   * Handles all Redis data types: string, list, set, sorted set, hash, stream.
   */
  private async getKeyValue(key: string): Promise<unknown> {
    const keyType = await this.client!.type(key)

    switch (keyType) {
      case 'string':
        return await this.client!.get(key)

      case 'list': {
        const length = await this.client!.llen(key)
        // Get up to 100 elements for display
        const items = await this.client!.lrange(key, 0, Math.min(99, length - 1))
        return items
      }

      case 'set': {
        const members = await this.client!.smembers(key)
        return members.slice(0, 100)
      }

      case 'zset': {
        // Get members with scores
        const result = await this.client!.zrange(key, 0, 99, 'WITHSCORES')
        const pairs: { member: string; score: string }[] = []
        for (let i = 0; i < result.length; i += 2) {
          pairs.push({ member: result[i], score: result[i + 1] })
        }
        return pairs
      }

      case 'hash': {
        const hash = await this.client!.hgetall(key)
        return hash
      }

      case 'stream': {
        try {
          const entries = await this.client!.xrange(key, '-', '+', 'COUNT', 100)
          return entries.map(([id, fields]) => {
            const obj: Record<string, string> = { _id: id }
            for (let i = 0; i < fields.length; i += 2) {
              obj[fields[i]] = fields[i + 1]
            }
            return obj
          })
        } catch {
          return '(stream - unable to read)'
        }
      }

      default:
        return `(${keyType})`
    }
  }

  /**
   * Parse a Redis command string into parts, respecting quoted strings.
   * Examples:
   *   "GET mykey" => ["GET", "mykey"]
   *   "SET mykey 'hello world'" => ["SET", "mykey", "hello world"]
   *   'HSET myhash field "some value"' => ["HSET", "myhash", "field", "some value"]
   */
  private parseCommandString(input: string): string[] {
    const parts: string[] = []
    let current = ''
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let i = 0; i < input.length; i++) {
      const char = input[i]

      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote
        continue
      }

      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote
        continue
      }

      if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
        if (current.length > 0) {
          parts.push(current)
          current = ''
        }
        continue
      }

      current += char
    }

    if (current.length > 0) {
      parts.push(current)
    }

    return parts
  }

  /**
   * Format the result of a Redis command into a QueryResult.
   */
  private formatCommandResult(command: string, result: unknown, startTime: number): QueryResult {
    const executionTime = Date.now() - startTime

    // Handle null result
    if (result === null || result === undefined) {
      return {
        columns: [{ name: 'result', type: 'string', nullable: true }],
        rows: [{ result: '(nil)' }],
        rowCount: 1,
        executionTime
      }
    }

    // Handle simple string/number result (GET, SET, INCR, etc.)
    if (typeof result === 'string' || typeof result === 'number') {
      return {
        columns: [{ name: 'result', type: typeof result, nullable: false }],
        rows: [{ result: String(result) }],
        rowCount: 1,
        executionTime
      }
    }

    // Handle array results (KEYS, SMEMBERS, LRANGE, etc.)
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return {
          columns: [{ name: 'result', type: 'string', nullable: true }],
          rows: [{ result: '(empty list or set)' }],
          rowCount: 0,
          executionTime
        }
      }

      // Check for key-value pair arrays (HGETALL, ZRANGE WITHSCORES, CONFIG GET, etc.)
      const isKeyValuePairs = this.isKeyValueResultCommand(command) && result.length % 2 === 0

      if (isKeyValuePairs) {
        const columns: ColumnInfo[] = [
          { name: 'field', type: 'string', nullable: false },
          { name: 'value', type: 'string', nullable: true }
        ]
        const rows: Record<string, unknown>[] = []
        for (let i = 0; i < result.length; i += 2) {
          rows.push({ field: String(result[i]), value: String(result[i + 1]) })
        }
        return { columns, rows, rowCount: rows.length, executionTime }
      }

      // Regular array
      const columns: ColumnInfo[] = [
        { name: '#', type: 'integer', nullable: false },
        { name: 'value', type: 'string', nullable: true }
      ]
      const rows: Record<string, unknown>[] = result.map((item, index) => ({
        '#': index + 1,
        value: typeof item === 'object' ? JSON.stringify(item) : String(item)
      }))

      return { columns, rows, rowCount: rows.length, executionTime }
    }

    // Handle object results
    if (typeof result === 'object') {
      return {
        columns: [{ name: 'result', type: 'string', nullable: false }],
        rows: [{ result: JSON.stringify(result, null, 2) }],
        rowCount: 1,
        executionTime
      }
    }

    // Fallback
    return {
      columns: [{ name: 'result', type: 'string', nullable: false }],
      rows: [{ result: String(result) }],
      rowCount: 1,
      executionTime
    }
  }

  /**
   * Check if a command returns key-value pair arrays.
   */
  async ping(): Promise<boolean> {
    try {
      if (!this.client) return false
      const result = await this.client.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }

  private isKeyValueResultCommand(command: string): boolean {
    const kvCommands = new Set([
      'HGETALL',
      'CONFIG',
      'ZRANGEBYSCORE',
      'ZRANGEBYLEX',
      'XRANGE',
      'XREVRANGE'
    ])
    return kvCommands.has(command.toUpperCase())
  }
}
