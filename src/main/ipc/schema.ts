import { ipcMain } from 'electron'
import { logger } from '@main/utils/logger'
import { formatBytes } from '@main/utils/format'
import { TableObjectType, type DataOptions, type TableProperties } from '@main/types'
import { withDriver } from './helpers'
import { toPlainObject } from '@main/utils/serialize'
import { connectionManager } from '@main/db/manager'
import { DatabaseType } from '@main/types'
import type { MySQLDriver } from '@main/db/mysql'
import type { PostgreSQLDriver } from '@main/db/postgres'
import type { SQLiteDriver } from '@main/db/sqlite'
import type { ClickHouseDriver } from '@main/db/clickhouse'
import type { MongoDBDriver } from '@main/db/mongodb'
import type { DuckDBDriver } from '@main/db/duckdb'
import type { SQLServerDriver } from '@main/db/sqlserver'

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

      if (driver.type === DatabaseType.PostgreSQL) {
        return getPostgreSQLTableProperties(driver as PostgreSQLDriver, tableName, tableType, schema)
      } else if (driver.type === DatabaseType.MySQL || driver.type === DatabaseType.MariaDB) {
        return getMySQLTableProperties(driver as MySQLDriver, tableName, tableType)
      } else if (driver.type === DatabaseType.SQLite) {
        return getSQLiteTableProperties(driver as SQLiteDriver, tableName, tableType)
      } else if (driver.type === DatabaseType.ClickHouse) {
        return getClickHouseTableProperties(driver as ClickHouseDriver, tableName, tableType)
      } else if (driver.type === DatabaseType.MongoDB) {
        return getMongoDBTableProperties(driver as MongoDBDriver, tableName)
      } else if (driver.type === DatabaseType.DuckDB) {
        return getDuckDBTableProperties(driver as DuckDBDriver, tableName, tableType)
      } else if (driver.type === DatabaseType.SQLServer) {
        return getSQLServerTableProperties(driver as SQLServerDriver, tableName, tableType, schema)
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

// SQL Server table properties
const getSQLServerTableProperties = async (
  driver: SQLServerDriver,
  tableName: string,
  tableType: TableObjectType,
  schema?: string
): Promise<TableProperties> => {
  const schemaName = schema || driver.getCurrentSchema()
  const result: TableProperties = {
    name: tableName,
    type: tableType,
    schema: schemaName
  }

  try {
    const infoResult = await driver.execute(`
      SELECT
        t.name AS table_name,
        s.name AS schema_name,
        p.rows AS row_count,
        CAST(ROUND(SUM(a.total_pages) * 8.0 / 1024, 2) AS DECIMAL(18,2)) AS total_size_mb,
        CAST(ROUND(SUM(a.used_pages) * 8.0 / 1024, 2) AS DECIMAL(18,2)) AS data_size_mb,
        CAST(ROUND((SUM(a.total_pages) - SUM(a.used_pages)) * 8.0 / 1024, 2) AS DECIMAL(18,2)) AS unused_size_mb,
        (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id AND i.type > 0) AS index_count,
        (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS column_count,
        CAST(ep.value AS NVARCHAR(MAX)) AS comment
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      INNER JOIN sys.indexes i ON t.object_id = i.object_id
      INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
      WHERE t.name = ? AND s.name = ?
      GROUP BY t.name, s.name, t.object_id, p.rows, ep.value
    `, [tableName, schemaName])

    if (!infoResult.error && infoResult.rows.length > 0) {
      const row = infoResult.rows[0] as Record<string, unknown>
      result.rowCount = row.row_count as number
      result.totalSize = `${row.total_size_mb} MB`
      result.tableSize = `${row.data_size_mb} MB`
      result.indexCount = row.index_count as number
      result.columnCount = row.column_count as number
      result.comment = row.comment as string | undefined
    }
  } catch {
    // Ignore metadata errors
  }

  // Get DDL
  try {
    if (tableType === TableObjectType.View) {
      const ddl = await driver.getViewDDL(tableName)
      if (ddl) result.ddl = ddl
    } else {
      const ddl = await driver.getTableDDL(tableName)
      if (ddl) result.ddl = ddl
    }
  } catch {
    // Ignore DDL errors
  }

  return result
}

