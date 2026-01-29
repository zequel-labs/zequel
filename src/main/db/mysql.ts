import mysql from 'mysql2/promise'
import { BaseDriver } from './base'
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
  Routine
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
  ColumnDefinition
} from '../types/schema-operations'
import { MYSQL_DATA_TYPES } from '../types/schema-operations'

export class MySQLDriver extends BaseDriver {
  readonly type = 'mysql'
  private connection: mysql.Connection | null = null
  private currentDatabase: string = ''

  async connect(config: ConnectionConfig): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: config.host || 'localhost',
        port: config.port || 3306,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl
          ? {
              rejectUnauthorized: config.sslConfig?.rejectUnauthorized ?? true
            }
          : undefined
      })
      this.currentDatabase = config.database
      this.config = config
      this._isConnected = true
    } catch (error) {
      this._isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end()
      this.connection = null
    }
    this._isConnected = false
    this.config = null
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected()
    const startTime = Date.now()

    try {
      const [result, fields] = params && params.length > 0
        ? await this.connection!.query(sql, params)
        : await this.connection!.query(sql)

      if (Array.isArray(result)) {
        const columns: ColumnInfo[] = (fields as mysql.FieldPacket[])?.map((field) => ({
          name: field.name,
          type: this.mapMySQLType(field.type),
          nullable: true,
          primaryKey: ((field.flags as number) & 2) !== 0
        })) || []

        return {
          columns,
          rows: result as Record<string, unknown>[],
          rowCount: result.length,
          executionTime: Date.now() - startTime
        }
      } else {
        const resultSetHeader = result as mysql.ResultSetHeader
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          affectedRows: resultSetHeader.affectedRows,
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

  private mapMySQLType(typeId: number | undefined): string {
    const types: Record<number, string> = {
      0: 'DECIMAL',
      1: 'TINYINT',
      2: 'SMALLINT',
      3: 'INT',
      4: 'FLOAT',
      5: 'DOUBLE',
      6: 'NULL',
      7: 'TIMESTAMP',
      8: 'BIGINT',
      9: 'MEDIUMINT',
      10: 'DATE',
      11: 'TIME',
      12: 'DATETIME',
      13: 'YEAR',
      14: 'NEWDATE',
      15: 'VARCHAR',
      16: 'BIT',
      245: 'JSON',
      246: 'NEWDECIMAL',
      247: 'ENUM',
      248: 'SET',
      249: 'TINY_BLOB',
      250: 'MEDIUM_BLOB',
      251: 'LONG_BLOB',
      252: 'BLOB',
      253: 'VAR_STRING',
      254: 'STRING',
      255: 'GEOMETRY'
    }
    return types[typeId || 0] || 'UNKNOWN'
  }

  async getDatabases(): Promise<DatabaseInfo[]> {
    this.ensureConnected()
    const [rows] = await this.connection!.query('SHOW DATABASES')
    return (rows as { Database: string }[]).map((row) => ({
      name: row.Database
    }))
  }

  async getTables(database: string, schema?: string): Promise<Table[]> {
    this.ensureConnected()

    if (database !== this.currentDatabase) {
      await this.connection!.query(`USE \`${database}\``)
      this.currentDatabase = database
    }

    const [rows] = await this.connection!.query(`
      SELECT TABLE_NAME as name, TABLE_TYPE as type, TABLE_ROWS as row_count,
             DATA_LENGTH + INDEX_LENGTH as size, TABLE_COMMENT as comment
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [database])

    return (rows as any[]).map((row) => ({
      name: row.name,
      type: row.type === 'VIEW' ? 'view' : 'table',
      rowCount: row.row_count,
      size: row.size,
      comment: row.comment
    }))
  }

  async getColumns(table: string): Promise<Column[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`
      SELECT
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        COLUMN_DEFAULT as defaultValue,
        COLUMN_KEY as columnKey,
        EXTRA as extra,
        CHARACTER_MAXIMUM_LENGTH as length,
        NUMERIC_PRECISION as \`precision\`,
        NUMERIC_SCALE as scale,
        COLUMN_COMMENT as comment
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [this.currentDatabase, table])

    return (rows as any[]).map((row) => ({
      name: row.name,
      type: row.type.toUpperCase(),
      nullable: row.nullable === 'YES',
      defaultValue: row.defaultValue,
      primaryKey: row.columnKey === 'PRI',
      autoIncrement: row.extra?.includes('auto_increment') || false,
      unique: row.columnKey === 'UNI',
      comment: row.comment,
      length: row.length,
      precision: row.precision,
      scale: row.scale
    }))
  }

  async getIndexes(table: string): Promise<Index[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`SHOW INDEX FROM \`${table}\``)

    const indexMap = new Map<string, Index>()

    for (const row of rows as any[]) {
      const existing = indexMap.get(row.Key_name)
      if (existing) {
        existing.columns.push(row.Column_name)
      } else {
        indexMap.set(row.Key_name, {
          name: row.Key_name,
          columns: [row.Column_name],
          unique: row.Non_unique === 0,
          primary: row.Key_name === 'PRIMARY',
          type: row.Index_type
        })
      }
    }

    return Array.from(indexMap.values())
  }

  async getForeignKeys(table: string): Promise<ForeignKey[]> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`
      SELECT
        CONSTRAINT_NAME as name,
        COLUMN_NAME as \`column\`,
        REFERENCED_TABLE_NAME as referencedTable,
        REFERENCED_COLUMN_NAME as referencedColumn
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [this.currentDatabase, table])

    // Get ON UPDATE/DELETE actions
    const [refRows] = await this.connection!.query(`
      SELECT
        CONSTRAINT_NAME as name,
        UPDATE_RULE as onUpdate,
        DELETE_RULE as onDelete
      FROM information_schema.REFERENTIAL_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = ?
        AND TABLE_NAME = ?
    `, [this.currentDatabase, table])

    const refMap = new Map<string, { onUpdate: string; onDelete: string }>()
    for (const row of refRows as any[]) {
      refMap.set(row.name, { onUpdate: row.onUpdate, onDelete: row.onDelete })
    }

    return (rows as any[]).map((row) => ({
      name: row.name,
      column: row.column,
      referencedTable: row.referencedTable,
      referencedColumn: row.referencedColumn,
      onUpdate: refMap.get(row.name)?.onUpdate,
      onDelete: refMap.get(row.name)?.onDelete
    }))
  }

  async getTableDDL(table: string): Promise<string> {
    this.ensureConnected()

    const [rows] = await this.connection!.query(`SHOW CREATE TABLE \`${table}\``)
    const row = (rows as any[])[0]
    return row['Create Table'] || row['Create View'] || ''
  }

  async getTableData(table: string, options: DataOptions): Promise<DataResult> {
    this.ensureConnected()

    const { clause: whereClause, values } = this.buildWhereClauseMysql(options)
    const orderClause = this.buildOrderClauseMysql(options)
    const limitClause = this.buildLimitClause(options)

    // Get total count
    const [countRows] = await this.connection!.query(
      `SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`,
      values
    )
    const totalCount = (countRows as any[])[0].count

    // Get columns info
    const columnsInfo = await this.getColumns(table)
    const columns: ColumnInfo[] = columnsInfo.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      primaryKey: col.primaryKey,
      defaultValue: col.defaultValue
    }))

    // Get data
    const [rows] = await this.connection!.query(
      `SELECT * FROM \`${table}\` ${whereClause} ${orderClause} ${limitClause}`,
      values
    )

    return {
      columns,
      rows: rows as Record<string, unknown>[],
      totalCount,
      offset: options.offset || 0,
      limit: options.limit || (rows as any[]).length
    }
  }

  private buildWhereClauseMysql(options: DataOptions): { clause: string; values: unknown[] } {
    if (!options.filters || options.filters.length === 0) {
      return { clause: '', values: [] }
    }

    const conditions: string[] = []
    const values: unknown[] = []

    for (const filter of options.filters) {
      switch (filter.operator) {
        case 'IS NULL':
          conditions.push(`\`${filter.column}\` IS NULL`)
          break
        case 'IS NOT NULL':
          conditions.push(`\`${filter.column}\` IS NOT NULL`)
          break
        case 'IN':
        case 'NOT IN':
          if (Array.isArray(filter.value)) {
            const placeholders = filter.value.map(() => '?').join(', ')
            conditions.push(`\`${filter.column}\` ${filter.operator} (${placeholders})`)
            values.push(...filter.value)
          }
          break
        case 'LIKE':
        case 'NOT LIKE':
          conditions.push(`\`${filter.column}\` ${filter.operator} ?`)
          values.push(`%${filter.value}%`)
          break
        default:
          conditions.push(`\`${filter.column}\` ${filter.operator} ?`)
          values.push(filter.value)
      }
    }

    return {
      clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    }
  }

  private buildOrderClauseMysql(options: DataOptions): string {
    if (!options.orderBy) return ''
    const direction = options.orderDirection || 'ASC'
    return `ORDER BY \`${options.orderBy}\` ${direction}`
  }

  // Schema editing operations

  getDataTypes(): DataTypeInfo[] {
    return MYSQL_DATA_TYPES
  }

  async getPrimaryKeyColumns(table: string): Promise<string[]> {
    this.ensureConnected()
    const columns = await this.getColumns(table)
    return columns.filter((col) => col.primaryKey).map((col) => col.name)
  }

  async getRoutines(type?: 'PROCEDURE' | 'FUNCTION'): Promise<Routine[]> {
    this.ensureConnected()

    let sql = `
      SELECT
        ROUTINE_NAME as name,
        ROUTINE_TYPE as type,
        ROUTINE_SCHEMA as \`schema\`,
        DATA_TYPE as return_type,
        EXTERNAL_LANGUAGE as language,
        CREATED as created_at,
        LAST_ALTERED as modified_at
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = DATABASE()
    `

    if (type) {
      sql += ` AND ROUTINE_TYPE = '${type}'`
    }

    sql += ` ORDER BY ROUTINE_NAME`

    const [rows] = await this.connection!.execute(sql)

    return (rows as any[]).map(row => ({
      name: row.name,
      type: row.type as 'PROCEDURE' | 'FUNCTION',
      schema: row.schema,
      returnType: row.return_type,
      language: row.language || 'SQL',
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      modifiedAt: row.modified_at?.toISOString?.() || row.modified_at
    }))
  }

  async getRoutineDefinition(name: string, type: 'PROCEDURE' | 'FUNCTION'): Promise<string> {
    this.ensureConnected()

    const sql = type === 'PROCEDURE'
      ? `SHOW CREATE PROCEDURE \`${name}\``
      : `SHOW CREATE FUNCTION \`${name}\``

    try {
      const [rows] = await this.connection!.execute(sql)
      const row = (rows as any[])[0]
      if (type === 'PROCEDURE') {
        return row?.['Create Procedure'] || `-- PROCEDURE '${name}' not found`
      }
      return row?.['Create Function'] || `-- FUNCTION '${name}' not found`
    } catch (error) {
      return `-- Error getting ${type} definition: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  private buildColumnDefinition(col: ColumnDefinition): string {
    let def = `\`${col.name}\` ${col.type}`
    if (col.length) def += `(${col.length})`
    else if (col.precision !== undefined && col.scale !== undefined) def += `(${col.precision},${col.scale})`
    else if (col.precision !== undefined) def += `(${col.precision})`
    if (!col.nullable) def += ' NOT NULL'
    else def += ' NULL'
    if (col.autoIncrement) def += ' AUTO_INCREMENT'
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      const defaultVal = typeof col.defaultValue === 'string'
        ? `'${col.defaultValue.replace(/'/g, "''")}'`
        : col.defaultValue
      def += ` DEFAULT ${defaultVal}`
    }
    if (col.unique && !col.primaryKey) def += ' UNIQUE'
    if (col.comment) def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`
    return def
  }

  async addColumn(request: AddColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, column } = request

    let columnDef = this.buildColumnDefinition(column)
    if (column.afterColumn) {
      columnDef += column.afterColumn === 'FIRST' ? ' FIRST' : ` AFTER \`${column.afterColumn}\``
    }

    const sql = `ALTER TABLE \`${table}\` ADD COLUMN ${columnDef}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async modifyColumn(request: ModifyColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newDefinition } = request

    const columnDef = this.buildColumnDefinition(newDefinition)
    const sql = oldName !== newDefinition.name
      ? `ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldName}\` ${columnDef}`
      : `ALTER TABLE \`${table}\` MODIFY COLUMN ${columnDef}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropColumn(request: DropColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, columnName } = request

    const sql = `ALTER TABLE \`${table}\` DROP COLUMN \`${columnName}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameColumn(request: RenameColumnRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, oldName, newName } = request

    // MySQL 8.0+ supports RENAME COLUMN, but for compatibility we use CHANGE
    // First get column info
    const columns = await this.getColumns(table)
    const column = columns.find((c) => c.name === oldName)
    if (!column) {
      return { success: false, error: `Column '${oldName}' not found` }
    }

    let typeDef = column.type
    if (column.length) typeDef += `(${column.length})`
    else if (column.precision && column.scale) typeDef += `(${column.precision},${column.scale})`

    let def = `\`${newName}\` ${typeDef}`
    if (!column.nullable) def += ' NOT NULL'
    if (column.autoIncrement) def += ' AUTO_INCREMENT'
    if (column.defaultValue !== undefined && column.defaultValue !== null) {
      def += ` DEFAULT ${column.defaultValue}`
    }

    const sql = `ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldName}\` ${def}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async createIndex(request: CreateIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, index } = request

    const uniqueKeyword = index.unique ? 'UNIQUE ' : ''
    const columns = index.columns.map((c) => `\`${c}\``).join(', ')
    const indexType = index.type ? ` USING ${index.type}` : ''
    const sql = `CREATE ${uniqueKeyword}INDEX \`${index.name}\` ON \`${table}\` (${columns})${indexType}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropIndex(request: DropIndexRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, indexName } = request

    const sql = `DROP INDEX \`${indexName}\` ON \`${table}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async addForeignKey(request: AddForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, foreignKey } = request

    const columns = foreignKey.columns.map((c) => `\`${c}\``).join(', ')
    const refColumns = foreignKey.referencedColumns.map((c) => `\`${c}\``).join(', ')
    const onUpdate = foreignKey.onUpdate ? ` ON UPDATE ${foreignKey.onUpdate}` : ''
    const onDelete = foreignKey.onDelete ? ` ON DELETE ${foreignKey.onDelete}` : ''

    const sql = `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${foreignKey.name}\` ` +
      `FOREIGN KEY (${columns}) REFERENCES \`${foreignKey.referencedTable}\` (${refColumns})${onUpdate}${onDelete}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropForeignKey(request: DropForeignKeyRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, constraintName } = request

    const sql = `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${constraintName}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async createTable(request: CreateTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table } = request

    const columnDefs = table.columns.map((col) => this.buildColumnDefinition(col))

    // Add primary key
    const pkColumns = table.columns.filter((c) => c.primaryKey).map((c) => `\`${c.name}\``)
    if (pkColumns.length > 0) {
      columnDefs.push(`PRIMARY KEY (${pkColumns.join(', ')})`)
    } else if (table.primaryKey && table.primaryKey.length > 0) {
      columnDefs.push(`PRIMARY KEY (${table.primaryKey.map((c) => `\`${c}\``).join(', ')})`)
    }

    // Add indexes
    if (table.indexes) {
      for (const idx of table.indexes) {
        const uniqueKeyword = idx.unique ? 'UNIQUE ' : ''
        const columns = idx.columns.map((c) => `\`${c}\``).join(', ')
        columnDefs.push(`${uniqueKeyword}INDEX \`${idx.name}\` (${columns})`)
      }
    }

    // Add foreign keys
    if (table.foreignKeys) {
      for (const fk of table.foreignKeys) {
        const columns = fk.columns.map((c) => `\`${c}\``).join(', ')
        const refColumns = fk.referencedColumns.map((c) => `\`${c}\``).join(', ')
        const onUpdate = fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : ''
        const onDelete = fk.onDelete ? ` ON DELETE ${fk.onDelete}` : ''
        columnDefs.push(
          `CONSTRAINT \`${fk.name}\` FOREIGN KEY (${columns}) ` +
          `REFERENCES \`${fk.referencedTable}\` (${refColumns})${onUpdate}${onDelete}`
        )
      }
    }

    let sql = `CREATE TABLE \`${table.name}\` (\n  ${columnDefs.join(',\n  ')}\n)`
    if (table.comment) {
      sql += ` COMMENT='${table.comment.replace(/'/g, "''")}'`
    }

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropTable(request: DropTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP TABLE \`${request.table}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameTable(request: RenameTableRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `RENAME TABLE \`${request.oldName}\` TO \`${request.newName}\``

    try {
      await this.connection!.query(sql)
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
    const columnList = columns.map((c) => `\`${c}\``).join(', ')
    const sql = `INSERT INTO \`${table}\` (${columnList}) VALUES (${placeholders})`
    const params = Object.values(values)

    try {
      const [result] = await this.connection!.query(sql, params)
      const affectedRows = (result as mysql.ResultSetHeader).affectedRows
      return { success: true, sql, affectedRows }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async deleteRow(request: DeleteRowRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { table, primaryKeyValues } = request

    const conditions = Object.keys(primaryKeyValues).map((col) => `\`${col}\` = ?`).join(' AND ')
    const sql = `DELETE FROM \`${table}\` WHERE ${conditions}`
    const params = Object.values(primaryKeyValues)

    try {
      const [result] = await this.connection!.query(sql, params)
      const affectedRows = (result as mysql.ResultSetHeader).affectedRows
      return { success: true, sql, affectedRows }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  // View operations
  async createView(request: CreateViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const { view } = request
    const createOrReplace = view.replaceIfExists ? 'CREATE OR REPLACE VIEW' : 'CREATE VIEW'
    const sql = `${createOrReplace} \`${view.name}\` AS ${view.selectStatement}`

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async dropView(request: DropViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `DROP VIEW IF EXISTS \`${request.viewName}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async renameView(request: RenameViewRequest): Promise<SchemaOperationResult> {
    this.ensureConnected()
    const sql = `RENAME TABLE \`${request.oldName}\` TO \`${request.newName}\``

    try {
      await this.connection!.query(sql)
      return { success: true, sql }
    } catch (error) {
      return { success: false, sql, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async getViewDDL(viewName: string): Promise<string> {
    this.ensureConnected()
    const [rows] = await this.connection!.query(`SHOW CREATE VIEW \`${viewName}\``)
    const row = (rows as mysql.RowDataPacket[])[0]
    return row?.['Create View'] || ''
  }

  // User management
  async getUsers(): Promise<import('../types').DatabaseUser[]> {
    this.ensureConnected()

    const sql = `
      SELECT
        User as name,
        Host as host,
        Super_priv = 'Y' as superuser,
        Create_user_priv = 'Y' as create_role,
        Create_priv = 'Y' as create_db
      FROM mysql.user
      ORDER BY User, Host
    `

    try {
      const [rows] = await this.connection!.query(sql)
      return (rows as mysql.RowDataPacket[]).map((row) => ({
        name: row.name,
        host: row.host,
        superuser: Boolean(row.superuser),
        createRole: Boolean(row.create_role),
        createDb: Boolean(row.create_db),
        login: true // MySQL users can always login if they exist
      }))
    } catch {
      // Fallback query for limited permissions
      const [rows] = await this.connection!.query(`SELECT CURRENT_USER() as user`)
      const currentUser = (rows as mysql.RowDataPacket[])[0]?.user || 'unknown@%'
      const [name, host] = currentUser.split('@')
      return [{
        name,
        host,
        login: true
      }]
    }
  }

  async getUserPrivileges(username: string, host?: string): Promise<import('../types').UserPrivilege[]> {
    this.ensureConnected()

    const userHost = host || '%'

    try {
      const [rows] = await this.connection!.query(
        `SHOW GRANTS FOR ?@?`,
        [username, userHost]
      )

      const privileges: import('../types').UserPrivilege[] = []

      for (const row of rows as mysql.RowDataPacket[]) {
        const grant = Object.values(row)[0] as string
        // Parse GRANT statement
        const match = grant.match(/GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO/i)
        if (match) {
          const privList = match[1].split(',').map((p) => p.trim())
          const objectName = match[2].replace(/`/g, '')
          const isGrantable = grant.includes('WITH GRANT OPTION')

          for (const priv of privList) {
            privileges.push({
              privilege: priv,
              grantee: `${username}@${userHost}`,
              objectName,
              isGrantable
            })
          }
        }
      }

      return privileges
    } catch {
      return []
    }
  }
}
