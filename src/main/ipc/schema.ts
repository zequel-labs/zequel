import { ipcMain } from 'electron'
import { logger } from '../utils/logger'
import { formatBytes } from '../utils/format'
import { TableObjectType, type DataOptions, type TableProperties } from '../types'
import { withDriver } from './helpers'
import { toPlainObject } from '../utils/serialize'
import { connectionManager } from '../db/manager'
import { MySQLDriver } from '../db/mysql'
import { PostgreSQLDriver } from '../db/postgres'
import { SQLiteDriver } from '../db/sqlite'
import { ClickHouseDriver } from '../db/clickhouse'
import { MongoDBDriver } from '../db/mongodb'
import { DuckDBDriver } from '../db/duckdb'

export const registerSchemaHandlers = (): void => {
  ipcMain.handle('schema:databases', async (_, connectionId: string) => {
    logger.debug('IPC: schema:databases', { connectionId })
    return withDriver(connectionId, (driver) => driver.getDatabases())
  })

  ipcMain.handle('schema:tables', async (_, connectionId: string, database: string, schema?: string) => {
    logger.debug('IPC: schema:tables', { connectionId, database, schema })
    return withDriver(connectionId, (driver) => driver.getTables(database, schema))
  })

  ipcMain.handle('schema:columns', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:columns', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getColumns(table))
  })

  ipcMain.handle('schema:indexes', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:indexes', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getIndexes(table))
  })

  ipcMain.handle('schema:foreignKeys', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:foreignKeys', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getForeignKeys(table))
  })

  ipcMain.handle('schema:tableDDL', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:tableDDL', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getTableDDL(table))
  })

  ipcMain.handle('schema:tableData', async (_, connectionId: string, table: string, options: DataOptions) => {
    logger.debug('IPC: schema:tableData', { connectionId, table, options })
    return withDriver(connectionId, async (driver) => {
      const result = await driver.getTableData(table, options)
      return toPlainObject(result)
    })
  })

  ipcMain.handle(
    'schema:getTableProperties',
    async (_, connectionId: string, tableName: string, tableType: TableObjectType, schema?: string): Promise<TableProperties> => {
      logger.debug('IPC: schema:getTableProperties', { connectionId, tableName, tableType, schema })

      const driver = connectionManager.getConnection(connectionId)
      if (!driver) {
        throw new Error('Connection not found')
      }

      if (driver instanceof PostgreSQLDriver) {
        return getPostgreSQLTableProperties(driver, tableName, tableType, schema)
      } else if (driver instanceof MySQLDriver) {
        return getMySQLTableProperties(driver, tableName, tableType)
      } else if (driver instanceof SQLiteDriver) {
        return getSQLiteTableProperties(driver, tableName, tableType)
      } else if (driver instanceof ClickHouseDriver) {
        return getClickHouseTableProperties(driver, tableName, tableType)
      } else if (driver instanceof MongoDBDriver) {
        return getMongoDBTableProperties(driver, tableName)
      } else if (driver instanceof DuckDBDriver) {
        return getDuckDBTableProperties(driver, tableName, tableType)
      }

      return { name: tableName, type: tableType }
    }
  )
}

// PostgreSQL table properties
const getPostgreSQLTableProperties = async (
  driver: PostgreSQLDriver,
  tableName: string,
  tableType: TableObjectType,
  schema?: string
): Promise<TableProperties> => {
  const schemaName = schema || 'public'
  const result: TableProperties = {
    name: tableName,
    type: tableType,
    schema: schemaName
  }

  try {
    const infoResult = await driver.execute(`
      SELECT
        c.oid,
        c.relowner::regrole::text AS owner,
        t.spcname AS tablespace,
        c.reltuples::bigint AS row_count,
        c.relnatts AS column_count,
        (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
        pg_total_relation_size(c.oid)::text AS total_size,
        pg_table_size(c.oid)::text AS table_size,
        pg_indexes_size(c.oid)::text AS index_size,
        c.relhasindex AS has_indexes,
        c.relhasrules AS has_rules,
        c.relhastriggers AS has_triggers,
        obj_description(c.oid, 'pg_class') AS comment
      FROM pg_class c
      LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_tablespace t ON t.oid = c.reltablespace
      WHERE c.relname = $1
        AND n.nspname = $2
    `, [tableName, schemaName])

    if (!infoResult.error && infoResult.rows.length > 0) {
      const row = infoResult.rows[0] as Record<string, unknown>
      result.oid = row.oid as number
      result.owner = row.owner as string
      result.tablespace = (row.tablespace as string) || 'pg_default'
      result.rowCount = row.row_count as number
      result.columnCount = row.column_count as number
      result.indexCount = row.index_count as number
      result.totalSize = formatBytes(Number(row.total_size))
      result.tableSize = formatBytes(Number(row.table_size))
      result.indexSize = formatBytes(Number(row.index_size))
      result.hasIndexes = row.has_indexes as boolean
      result.hasRules = row.has_rules as boolean
      result.hasTriggers = row.has_triggers as boolean
      result.comment = row.comment as string | undefined
    }
  } catch {
    // Ignore metadata errors
  }

  // Get DDL for views
  if (tableType === TableObjectType.View) {
    try {
      const ddlResult = await driver.execute(
        `SELECT pg_get_viewdef($1::regclass, true) AS definition`,
        [`"${schemaName}"."${tableName}"`]
      )
      if (!ddlResult.error && ddlResult.rows.length > 0) {
        const def = (ddlResult.rows[0] as Record<string, unknown>).definition as string
        result.ddl = `CREATE OR REPLACE VIEW "${schemaName}"."${tableName}" AS\n${def}`
      }
    } catch {
      // Ignore DDL errors
    }
  } else {
    try {
      const ddl = await driver.getTableDDL(tableName)
      if (ddl) result.ddl = ddl
    } catch {
      // Ignore DDL errors
    }
  }

  return result
}

// MySQL table properties
const getMySQLTableProperties = async (
  driver: MySQLDriver,
  tableName: string,
  tableType: TableObjectType
): Promise<TableProperties> => {
  const result: TableProperties = {
    name: tableName,
    type: tableType
  }

  try {
    const infoResult = await driver.execute(`
      SELECT
        TABLE_SCHEMA AS table_schema,
        ENGINE AS engine,
        ROW_FORMAT AS row_format,
        TABLE_ROWS AS row_count,
        AVG_ROW_LENGTH AS avg_row_length,
        DATA_LENGTH AS data_length,
        INDEX_LENGTH AS index_length,
        DATA_FREE AS data_free,
        AUTO_INCREMENT AS auto_increment,
        TABLE_COLLATION AS collation,
        CREATE_TIME AS create_time,
        UPDATE_TIME AS update_time,
        TABLE_COMMENT AS comment
      FROM information_schema.TABLES
      WHERE TABLE_NAME = ?
        AND TABLE_SCHEMA = DATABASE()
    `, [tableName])

    if (!infoResult.error && infoResult.rows.length > 0) {
      const row = infoResult.rows[0] as Record<string, unknown>
      result.database = row.table_schema as string
      result.engine = row.engine as string | undefined
      result.rowFormat = row.row_format as string | undefined
      result.rowCount = row.row_count as number | undefined
      result.avgRowLength = row.avg_row_length as number | undefined
      result.dataLength = formatBytes(Number(row.data_length || 0))
      result.indexLength = formatBytes(Number(row.index_length || 0))
      result.dataFree = formatBytes(Number(row.data_free || 0))
      result.autoIncrement = row.auto_increment as number | undefined
      result.collation = row.collation as string | undefined
      if (result.collation) {
        result.charset = result.collation.split('_')[0]
      }
      result.createTime = row.create_time as string | undefined
      result.updateTime = row.update_time as string | undefined
      result.comment = row.comment as string | undefined
    }
  } catch {
    // Ignore metadata errors
  }

  // Get DDL
  try {
    const ddlResult = await driver.execute(
      tableType === TableObjectType.View
        ? `SHOW CREATE VIEW \`${tableName}\``
        : `SHOW CREATE TABLE \`${tableName}\``
    )
    if (!ddlResult.error && ddlResult.rows.length > 0) {
      const row = ddlResult.rows[0] as Record<string, unknown>
      result.ddl = (row['Create Table'] || row['Create View']) as string
    }
  } catch {
    // Ignore DDL errors
  }

  return result
}

// SQLite table properties
const getSQLiteTableProperties = async (
  driver: SQLiteDriver,
  tableName: string,
  tableType: TableObjectType
): Promise<TableProperties> => {
  const result: TableProperties = {
    name: tableName,
    type: tableType
  }

  // Get DDL from sqlite_master
  try {
    const ddlResult = await driver.execute(
      `SELECT sql FROM sqlite_master WHERE name = ? AND type = ?`,
      [tableName, tableType === TableObjectType.View ? 'view' : 'table']
    )
    if (!ddlResult.error && ddlResult.rows.length > 0) {
      result.ddl = (ddlResult.rows[0] as Record<string, unknown>).sql as string
    }
  } catch {
    // Ignore
  }

  // Get row count
  try {
    const countResult = await driver.execute(`SELECT COUNT(*) AS cnt FROM "${tableName}"`)
    if (!countResult.error && countResult.rows.length > 0) {
      result.rowCount = (countResult.rows[0] as Record<string, unknown>).cnt as number
    }
  } catch {
    // Ignore
  }

  // Get page info
  try {
    const pageCountResult = await driver.execute('PRAGMA page_count')
    const pageSizeResult = await driver.execute('PRAGMA page_size')
    if (!pageCountResult.error && pageCountResult.rows.length > 0) {
      result.pageCount = Object.values(pageCountResult.rows[0] as Record<string, unknown>)[0] as number
    }
    if (!pageSizeResult.error && pageSizeResult.rows.length > 0) {
      result.pageSize = Object.values(pageSizeResult.rows[0] as Record<string, unknown>)[0] as number
    }
  } catch {
    // Ignore
  }

  return result
}

// ClickHouse table properties
const getClickHouseTableProperties = async (
  driver: ClickHouseDriver,
  tableName: string,
  tableType: TableObjectType
): Promise<TableProperties> => {
  const result: TableProperties = {
    name: tableName,
    type: tableType
  }

  try {
    const infoResult = await driver.execute(`
      SELECT
        database,
        engine,
        partition_key,
        sorting_key,
        primary_key,
        sampling_key,
        total_rows,
        total_bytes,
        metadata_modification_time,
        comment
      FROM system.tables
      WHERE name = '${tableName.replace(/'/g, "\\'")}'
        AND database = currentDatabase()
    `)

    if (!infoResult.error && infoResult.rows.length > 0) {
      const row = infoResult.rows[0] as Record<string, unknown>
      result.database = row.database as string
      result.engine = row.engine as string | undefined
      result.partitionKey = row.partition_key as string | undefined
      result.sortingKey = row.sorting_key as string | undefined
      result.primaryKey = row.primary_key as string | undefined
      result.samplingKey = row.sampling_key as string | undefined
      result.totalRows = row.total_rows as number | undefined
      result.totalBytes = formatBytes(Number(row.total_bytes || 0))
      result.metadataModificationTime = row.metadata_modification_time as string | undefined
      result.comment = row.comment as string | undefined
    }
  } catch {
    // Ignore metadata errors
  }

  // Get DDL
  try {
    const ddlResult = await driver.execute(`SHOW CREATE TABLE \`${tableName.replace(/`/g, '\\`')}\``)
    if (!ddlResult.error && ddlResult.rows.length > 0) {
      const row = ddlResult.rows[0] as Record<string, unknown>
      result.ddl = (row['statement'] || row['Create Table'] || Object.values(row)[0]) as string
    }
  } catch {
    // Ignore DDL errors
  }

  return result
}

// MongoDB collection properties
const getMongoDBTableProperties = async (
  driver: MongoDBDriver,
  tableName: string
): Promise<TableProperties> => {
  const result: TableProperties = {
    name: tableName,
    type: TableObjectType.Table
  }

  try {
    const db = driver.getDb()
    const stats = await db.command({ collStats: tableName })

    result.rowCount = stats.count as number | undefined
    result.storageSize = formatBytes(Number(stats.storageSize || 0))
    result.avgObjSize = formatBytes(Number(stats.avgObjSize || 0))
    result.nindexes = stats.nindexes as number | undefined
    result.totalIndexSize = formatBytes(Number(stats.totalIndexSize || 0))
    result.capped = stats.capped as boolean | undefined
  } catch {
    // Ignore - may not have permissions
  }

  // Get count as fallback
  if (result.rowCount === undefined) {
    try {
      const db = driver.getDb()
      result.rowCount = await db.collection(tableName).countDocuments()
    } catch {
      // Ignore
    }
  }

  return result
}

// DuckDB table properties (similar to SQLite)
const getDuckDBTableProperties = async (
  driver: DuckDBDriver,
  tableName: string,
  tableType: TableObjectType
): Promise<TableProperties> => {
  const result: TableProperties = {
    name: tableName,
    type: tableType
  }

  // Get DDL
  try {
    const ddlResult = await driver.execute(
      `SELECT sql FROM duckdb_tables() WHERE table_name = ?`,
      [tableName]
    )
    if (!ddlResult.error && ddlResult.rows.length > 0) {
      result.ddl = (ddlResult.rows[0] as Record<string, unknown>).sql as string
    } else if (tableType === TableObjectType.View) {
      const viewResult = await driver.execute(
        `SELECT sql FROM duckdb_views() WHERE view_name = ?`,
        [tableName]
      )
      if (!viewResult.error && viewResult.rows.length > 0) {
        result.ddl = (viewResult.rows[0] as Record<string, unknown>).sql as string
      }
    }
  } catch {
    // Ignore
  }

  // Get row count
  try {
    const countResult = await driver.execute(`SELECT COUNT(*) AS cnt FROM "${tableName}"`)
    if (!countResult.error && countResult.rows.length > 0) {
      result.rowCount = (countResult.rows[0] as Record<string, unknown>).cnt as number
    }
  } catch {
    // Ignore
  }

  return result
}

