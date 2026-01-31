import Database from 'better-sqlite3'
import { BaseDriver, TestConnectionResult } from './base'
import * as fs from 'fs'
import type {
  ConnectionConfig,
  QueryResult,
  Database as DatabaseInfo,
  Table,
  Column,
  Index,
  ForeignKey,
  DataOptions,
  DataResult,
  ColumnInfo,
  Routine,
  Trigger
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
  ColumnDefinition,
  CreateTriggerRequest,
  DropTriggerRequest
} from '../types/schema-operations'
import { SQLITE_DATA_TYPES } from '../types/schema-operations'

export class SQLiteDriver extends BaseDriver {
  readonly type = 'sqlite'
  private db: Database.Database | null = null

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      const dbPath = config.filepath || config.database
      this.db = new Database(dbPath, { readonly: false })
      this.db.pragma('journal_mode = WAL')
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this._isConnected = false
    this.config = null
  }

  async testConnection(config: ConnectionConfig): Promise<TestConnectionResult> {
    const start = Date.now()
    try {
      await this.connect(config)
      const latency = Date.now() - start

      const versionResult = await this.execute('SELECT sqlite_version() as version')
      const serverVersion = `SQLite ${(versionResult.rows[0]?.version as string) || 'Unknown'}`

      const serverInfo: Record<string, string> = {}
      try {
        const dbPath = config.filepath || config.database
        if (dbPath) {
          const stats = fs.statSync(dbPath)
          const sizeKB = (stats.size / 1024).toFixed(1)
          const sizeMB = (stats.size / (1024 * 1024)).toFixed(2)
          serverInfo['File Size'] = stats.size < 1024 * 1024 ? `${sizeKB} KB` : `${sizeMB} MB`
        }
        const journalResult = await this.execute("PRAGMA journal_mode")
        serverInfo['Journal Mode'] = (journalResult.rows[0]?.journal_mode as string) || ''
      } catch {}

      await this.disconnect()
      return { success: true, error: null, latency, serverVersion, serverInfo }
    } catch (error) {
      try { await this.disconnect() } catch {}
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const trimmedSql = sql.trim().toLowerCase()
      const isSelect = trimmedSql.startsWith('select') ||
                       trimmedSql.startsWith('pragma') ||
                       trimmedSql.startsWith('explain')

      if (isSelect) {
        const stmt = this.db!.prepare(sql)
        const rows = params && params.length > 0
          ? stmt.all(...params) as Record<string, unknown>[]
          : stmt.all() as Record<string, unknown>[]
        const columns = stmt.columns().map((col) => ({
          name: col.name,
          type: col.type || 'unknown',
          nullable: true,
          primaryKey: false
        }))

        return {
          columns,
          rows,
          rowCount: rows.length,
          executionTime: Date.now() - startTime
        }
      } else {
        const stmt = this.db!.prepare(sql)
        const result = params && params.length > 0
          ? stmt.run(...params)
          : stmt.run()

        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: result.changes,
          executionTime: Date.now() - startTime
        }
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

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    // SQLite only has one database per file
    const dbPath = this.config?.filepath || this.config?.database || 'main'
    return [{ name: dbPath.split('/').pop() || 'main' }]
  }

  async getTables(database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()

    const tables = this.db!.prepare(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string; type: string }[]

    return tables.map((t) => ({
      name: t.name,
      type: t.type === 'view' ? 'view' : 'table'
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const columns = this.db!.prepare(`PRAGMA table_info("${table}")`).all() as {
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }[]

    return columns.map((col) => ({
      name: col.name,
      type: col.type || 'TEXT',
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      primaryKey: col.pk > 0,
      autoIncrement: col.pk > 0 && col.type.toUpperCase() === 'INTEGER',
      unique: false
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const indexes = this.db!.prepare(`PRAGMA index_list("${table}")`).all() as {
      seq: number
      name: string
      unique: number
      origin: string
    }[]

    const result: Index[] = []

    for (const idx of indexes) {
      const columns = this.db!.prepare(`PRAGMA index_info("${idx.name}")`).all() as {
        seqno: number
        cid: number
        name: string
      }[]

      result.push({
        name: idx.name,
        columns: columns.map((c) => c.name),
        unique: idx.unique === 1,
        primary: idx.origin === 'pk'
      })
    }

    return result
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const fks = this.db!.prepare(`PRAGMA foreign_key_list("${table}")`).all() as {
      id: number
      seq: number
      table: string
      from: string
      to: string
      on_update: string
      on_delete: string
    }[]

    return fks.map((fk) => ({
      name: `fk_${table}_${fk.from}`,
      column: fk.from,
      referencedTable: fk.table,
      referencedColumn: fk.to,
      onUpdate: fk.on_update,
      onDelete: fk.on_delete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const result = this.db!.prepare(`
      SELECT sql FROM sqlite_master WHERE name = ? AND type IN ('table', 'view')
    `).get(table) as { sql: string } | undefined

    return result?.sql || ''
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { clause: whereClause, values } = this.buildWhereClause(options)
    const orderClause = this.buildOrderClause(options)
    const limitClause = this.buildLimitClause(options)

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM "${table}" ${whereClause}`
    const countResult = this.db!.prepare(countSql).get(...values) as { count: number }
    const totalCount = countResult.count

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
    const dataSql = `SELECT * FROM "${table}" ${whereClause} ${orderClause} ${limitClause}`
    const rows = this.db!.prepare(dataSql).all(...values) as Record<string, unknown>[]

    return {
      columns,
      rows,
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || rows.length
    }
  }

  // Schema editing operations

  getDataTypes(): DataTypeInfo[] {
    return SQLITE_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()
    const columns = await this.getColumns(table)
    return columns.filter((col) => col.primaryKey).map((col) => col.name)
  }

  // SQLite doesn't support stored procedures/functions
  async getRoutines(): Promise<Routine[]> {
    return [] // SQLite doesn't have stored procedures
  }

  async getRoutineDefinition(): Promise<string> {
    return '-- SQLite does not support stored procedures or functions'
  }

  private buildColumnDefinition(col: ColumnDefinition): string {
    let def = `"${col.name}" ${col.type}`
    if (col.length) def += `(${col.length})`
    else if (col.precision && col.scale) def += `(${col.precision},${col.scale})`
    else if (col.precision) def += `(${col.precision})`
    if (col.primaryKey) def += ' PRIMARY KEY'
    if (col.autoIncrement) def += ' AUTOINCREMENT'
    if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
    if (col.unique && !col.primaryKey) def += ' UNIQUE'
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      const defaultVal = typeof col.defaultValue === 'string'
        ? `'${col.defaultValue.replace(/'/g, "''")}'`
        : col.defaultValue
      def += ` DEFAULT ${defaultVal}`
    }
    return def
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request

    // SQLite doesn't support adding PRIMARY KEY or UNIQUE columns via ALTER TABLE
    // Also doesn't support adding NOT NULL columns without default
    if (column.primaryKey) {
      return { success: false, error: 'SQLite does not support adding PRIMARY KEY columns. Table must be recreated.' }
    }
    if (!column.nullable && column.defaultValue === undefined) {
      return { success: false, error: 'SQLite requires a default value when adding NOT NULL columns' }
    }

    let columnDef = `"${column.name}" ${column.type}`
    if (column.length) columnDef += `(${column.length})`
    else if (column.precision && column.scale) columnDef += `(${column.precision},${column.scale})`
    if (!column.nullable) columnDef += ' NOT NULL'
    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      const defaultVal = typeof column.defaultValue === 'string'
        ? `'${column.defaultValue.replace(/'/g, "''")}'`
        : column.defaultValue
      columnDef += ` DEFAULT ${defaultVal}`
    }

    const sql = `ALTER TABLE "${table}" ADD COLUMN ${columnDef}`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    // SQLite doesn't support ALTER COLUMN, must recreate table
    return this.recreateTableWithModification(request.table, 'modify', {
      oldName: request.oldName,
      newDefinition: request.newDefinition
    })
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, columnName } = request

    // SQLite 3.35.0+ supports DROP COLUMN
    const sql = `ALTER TABLE "${table}" DROP COLUMN "${columnName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      // If DROP COLUMN is not supported, recreate table
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (errorMsg.includes('no such column') || errorMsg.includes('syntax error')) {
        return this.recreateTableWithModification(table, 'drop', { columnName })
      }
      return { success: false, sql, error: errorMsg }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newName } = request

    // SQLite 3.25.0+ supports RENAME COLUMN
    const sql = `ALTER TABLE "${table}" RENAME COLUMN "${oldName}" TO "${newName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index } = request

    const uniqueKeyword = index.unique ? 'UNIQUE ' : ''
    const columns = index.columns.map((c) => `"${c}"`).join(', ')
    const sql = `CREATE ${uniqueKeyword}INDEX "${index.name}" ON "${table}" (${columns})`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { indexName } = request

    const sql = `DROP INDEX "${indexName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    // SQLite doesn't support adding foreign keys to existing tables
    // Must recreate table
    return this.recreateTableWithModification(request.table, 'addForeignKey', {
      foreignKey: request.foreignKey
    })
  }

  async dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    // SQLite doesn't support dropping foreign keys
    // Must recreate table
    return this.recreateTableWithModification(request.table, 'dropForeignKey', {
      constraintName: request.constraintName
    })
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table } = request

    const columnDefs = table.columns.map((col) => this.buildColumnDefinition(col))

    // Add composite primary key if specified and not on individual columns
    if (table.primaryKey && table.primaryKey.length > 0) {
      const hasInlinePK = table.columns.some((c) => c.primaryKey)
      if (!hasInlinePK) {
        columnDefs.push(`PRIMARY KEY (${table.primaryKey.map((c) => `"${c}"`).join(', ')})`)
      }
    }

    // Add foreign keys
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        columnDefs.push(
          `CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns.map((c) => `"${c}"`).join(', ')}) ` +
          `REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((c) => `"${c}"`).join(', ')})${onUpdate}${onDelete}`
        )
      }
    }

    const sql = `CREATE TABLE "${table.name}" (\n  ${columnDefs.join(',\n  ')}\n)`

    try {
      this.db!.exec(sql)

      // Create indexes
      if (table.indexes) {
        for (const idx of table.indexes) {
          await this.createIndex({ table: table.name, index: idx })
        }
      }

      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE "${request.table}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `ALTER TABLE "${request.oldName}" RENAME TO "${request.newName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async insertRow(request: InsertRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, values } = request

    const columns = Object.keys(values)
    const placeholders = columns.map(() => '?').join(', ')
    const columnList = columns.map((c) => `"${c}"`).join(', ')
    const sql = `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})`
    const params = Object.values(values)

    try {
      const stmt = this.db!.prepare(sql)
      const result = stmt.run(...params)
      return { success: true, sql, affectedRows: result.changes }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues } = request

    const conditions = Object.keys(primaryKeyValues).map((col) => `"${col}" = ?`).join(' AND ')
    const sql = `DELETE FROM "${table}" WHERE ${conditions}`
    const params = Object.values(primaryKeyValues)

    try {
      const stmt = this.db!.prepare(sql)
      const result = stmt.run(...params)
      return { success: true, sql, affectedRows: result.changes }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // View operations
  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const createOrReplace = view.replaceIfExists ? 'CREATE VIEW IF NOT EXISTS' : 'CREATE VIEW'
    const sql = `${createOrReplace} "${view.name}" AS ${view.selectStatement}`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP VIEW IF EXISTS "${request.viewName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    // SQLite doesn't support renaming views directly, need to recreate
    try {
      // Get current view definition
      const ddl = await this.getViewDDL(request.oldName)
      // Extract the SELECT statement
      const selectMatch = ddl.match(/AS\s+(SELECT.+)$/is)
      if (!selectMatch) {
        return { success: false, error: 'Could not parse view definition' }
      }

      // Drop old view and create new one
      const dropSql = `DROP VIEW "${request.oldName}"`
      const createSql = `CREATE VIEW "${request.newName}" AS ${selectMatch[1]}`

      this.db!.exec(dropSql)
      this.db!.exec(createSql)

      return { success: true, sql: `${dropSql};\n${createSql}` }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()
    const stmt = this.db!.prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'view' AND name = ?`
    )
    const result = stmt.get(viewName) as { sql: string } | undefined
    return result?.sql || ''
  }

  // Helper method to recreate table for unsupported ALTER TABLE operations
  private async recreateTableWithModification(
    tableName: string,
    operation: 'modify' | 'drop' | 'addForeignKey' | 'dropForeignKey',
    options: {
      oldName?: string
      newDefinition?: ColumnDefinition
      columnName?: string
      foreignKey?: AddForeignKeyRequest['foreignKey']
      constraintName?: string
    }
  ): Promise<SchemaOperationResult> {
    this.ensureConnected()

    const tempTableName = `_${tableName}_temp_${Date.now()}`
    const sqlStatements: string[] = []

    try {
      // Get current table info
      const currentColumns = await this.getColumns(tableName)
      const currentIndexes = await this.getIndexes(tableName)
      const currentForeignKeys = await this.getForeignKeys(tableName)
      const currentDDL = await this.getTableDDL(tableName)

      // Build new column list
      let newColumns: Column[] = [...currentColumns]
      let columnMapping: { old: string; new: string }[] = currentColumns.map((c) => ({ old: c.name, new: c.name }))

      if (operation === 'modify' && options.oldName && options.newDefinition) {
        const idx = newColumns.findIndex((c) => c.name === options.oldName)
        if (idx !== -1) {
          const newDef = options.newDefinition
          newColumns[idx] = {
            name: newDef.name,
            type: newDef.type,
            nullable: newDef.nullable,
            defaultValue: newDef.defaultValue,
            primaryKey: newDef.primaryKey || false,
            autoIncrement: newDef.autoIncrement || false,
            unique: newDef.unique || false,
            length: newDef.length,
            precision: newDef.precision,
            scale: newDef.scale
          }
          columnMapping[idx] = { old: options.oldName, new: newDef.name }
        }
      } else if (operation === 'drop' && options.columnName) {
        newColumns = newColumns.filter((c) => c.name !== options.columnName)
        columnMapping = columnMapping.filter((m) => m.old !== options.columnName)
      }

      // Build CREATE TABLE statement for temp table
      const columnDefs = newColumns.map((col) => {
        let def = `"${col.name}" ${col.type}`
        if (col.length) def += `(${col.length})`
        else if (col.precision && col.scale) def += `(${col.precision},${col.scale})`
        if (col.primaryKey) def += ' PRIMARY KEY'
        if (col.autoIncrement) def += ' AUTOINCREMENT'
        if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
        if (col.unique && !col.primaryKey) def += ' UNIQUE'
        if (col.defaultValue !== undefined && col.defaultValue !== null) {
          const defaultVal = typeof col.defaultValue === 'string'
            ? `'${String(col.defaultValue).replace(/'/g, "''")}'`
            : col.defaultValue
          def += ` DEFAULT ${defaultVal}`
        }
        return def
      })

      // Handle foreign keys
      let fks = currentForeignKeys
      if (operation === 'addForeignKey' && options.foreignKey) {
        const fk = options.foreignKey
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        columnDefs.push(
          `CONSTRAINT "${fk.name}" FOREIGN KEY (${fk.columns.map((c) => `"${c}"`).join(', ')}) ` +
          `REFERENCES "${fk.referencedTable}" (${fk.referencedColumns.map((c) => `"${c}"`).join(', ')})${onUpdate}${onDelete}`
        )
      } else if (operation === 'dropForeignKey' && options.constraintName) {
        fks = fks.filter((fk) => fk.name !== options.constraintName)
      }

      // Add existing foreign keys (unless dropping)
      if (operation !== 'addForeignKey') {
        for (const fk of fks) {
          columnDefs.push(
            `CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") ` +
            `REFERENCES "${fk.referencedTable}" ("${fk.referencedColumn}")` +
            (fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '') +
            (fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '')
          )
        }
      }

      // Begin transaction
      this.db!.exec('BEGIN TRANSACTION')
      sqlStatements.push('BEGIN TRANSACTION')

      // Create new table
      const createTempSql = `CREATE TABLE "${tempTableName}" (\n  ${columnDefs.join(',\n  ')}\n)`
      this.db!.exec(createTempSql)
      sqlStatements.push(createTempSql)

      // Copy data
      const oldCols = columnMapping.map((m) => `"${m.old}"`).join(', ')
      const newCols = columnMapping.map((m) => `"${m.new}"`).join(', ')
      const copyDataSql = `INSERT INTO "${tempTableName}" (${newCols}) SELECT ${oldCols} FROM "${tableName}"`
      this.db!.exec(copyDataSql)
      sqlStatements.push(copyDataSql)

      // Drop old table
      const dropSql = `DROP TABLE "${tableName}"`
      this.db!.exec(dropSql)
      sqlStatements.push(dropSql)

      // Rename temp table
      const renameSql = `ALTER TABLE "${tempTableName}" RENAME TO "${tableName}"`
      this.db!.exec(renameSql)
      sqlStatements.push(renameSql)

      // Recreate non-primary indexes
      for (const idx of currentIndexes) {
        if (!idx.primary) {
          // Check if all columns still exist
          const columnsExist = idx.columns.every((c) => newColumns.some((nc) => nc.name === c))
          if (columnsExist) {
            const uniqueKeyword = idx.unique ? 'UNIQUE ' : ''
            const columns = idx.columns.map((c) => `"${c}"`).join(', ')
            const createIdxSql = `CREATE ${uniqueKeyword}INDEX "${idx.name}" ON "${tableName}" (${columns})`
            this.db!.exec(createIdxSql)
            sqlStatements.push(createIdxSql)
          }
        }
      }

      // Commit transaction
      this.db!.exec('COMMIT')
      sqlStatements.push('COMMIT')

      return { success: true, sql: sqlStatements.join(';\n') }
    } catch (error) {
      // Rollback on error
      try {
        this.db!.exec('ROLLBACK')
      } catch {
        // Ignore rollback errors
      }
      return {
        success: false,
        sql: sqlStatements.join(';\n'),
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // User management - SQLite doesn't support users
  async getUsers(): Promise<import('../types').DatabaseUser[]> {
    // SQLite doesn't have user management
    return []
  }

  async getUserPrivileges(_username: string): Promise<import('../types').UserPrivilege[]> {
    // SQLite doesn't have user management
    return []
  }

  // Trigger operations
  async getTriggers(table?: string): Promise<Trigger[]> {
    this.ensureConnected()

    let sql = `
      SELECT name, tbl_name as table_name, sql
      FROM sqlite_master
      WHERE type = 'trigger'
    `
    if (table) {
      sql += ` AND tbl_name = ?`
    }
    sql += ` ORDER BY name`

    const stmt = this.db!.prepare(sql)
    const rows = table ? stmt.all(table) : stmt.all()

    return (rows as { name: string; table_name: string; sql: string }[]).map((row) => {
      // Parse timing and event from the SQL
      let timing = 'UNKNOWN'
      let event = 'UNKNOWN'

      const sqlUpper = (row.sql || '').toUpperCase()
      if (sqlUpper.includes('BEFORE INSERT')) {
        timing = 'BEFORE'
        event = 'INSERT'
      } else if (sqlUpper.includes('AFTER INSERT')) {
        timing = 'AFTER'
        event = 'INSERT'
      } else if (sqlUpper.includes('INSTEAD OF INSERT')) {
        timing = 'INSTEAD OF'
        event = 'INSERT'
      } else if (sqlUpper.includes('BEFORE UPDATE')) {
        timing = 'BEFORE'
        event = 'UPDATE'
      } else if (sqlUpper.includes('AFTER UPDATE')) {
        timing = 'AFTER'
        event = 'UPDATE'
      } else if (sqlUpper.includes('INSTEAD OF UPDATE')) {
        timing = 'INSTEAD OF'
        event = 'UPDATE'
      } else if (sqlUpper.includes('BEFORE DELETE')) {
        timing = 'BEFORE'
        event = 'DELETE'
      } else if (sqlUpper.includes('AFTER DELETE')) {
        timing = 'AFTER'
        event = 'DELETE'
      } else if (sqlUpper.includes('INSTEAD OF DELETE')) {
        timing = 'INSTEAD OF'
        event = 'DELETE'
      }

      return {
        name: row.name,
        table: row.table_name,
        timing,
        event,
        definition: row.sql
      }
    })
  }

  async getTriggerDefinition(name: string, _table?: string): Promise<string> {
    this.ensureConnected()

    const stmt = this.db!.prepare(
      `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?`
    )
    const result = stmt.get(name) as { sql: string } | undefined
    return result?.sql || `-- Trigger '${name}' not found`
  }

  async createTrigger(request: CreateTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { trigger } = request

    // SQLite trigger syntax:
    // CREATE TRIGGER [IF NOT EXISTS] trigger_name
    // [BEFORE|AFTER|INSTEAD OF] [INSERT|UPDATE|DELETE] ON table_name
    // [FOR EACH ROW]
    // [WHEN condition]
    // BEGIN
    //   statements;
    // END;

    let sql = `CREATE TRIGGER "${trigger.name}"\n`
    sql += `${trigger.timing} ${trigger.event} ON "${trigger.table}"\n`
    if (trigger.forEachRow !== false) {
      sql += `FOR EACH ROW\n`
    }
    if (trigger.condition) {
      sql += `WHEN ${trigger.condition}\n`
    }
    sql += `BEGIN\n${trigger.body}\nEND`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTrigger(request: DropTriggerRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { triggerName } = request

    const sql = `DROP TRIGGER IF EXISTS "${triggerName}"`

    try {
      this.db!.exec(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
