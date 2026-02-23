import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { createWriteStream } from 'fs'
import { logger } from '@main/utils/logger'
import { connectionManager } from '@main/db/manager'
import { splitSqlStatements } from '@main/ipc/query'
import type { RedisDriver } from '@main/db/redis'
import type { MongoDBDriver } from '@main/db/mongodb'
import type { DatabaseDriver } from '@main/db/base'
import type { PostgreSQLDriver } from '@main/db/postgres'
import { DatabaseType, ExportFormat, TableObjectType } from '@main/types'

export interface ExportOptions {
  format: ExportFormat
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  tableName?: string
  includeHeaders?: boolean
  delimiter?: string
  filePath?: string
  nullAsEmpty?: boolean
  prettyPrint?: boolean
  includeSchema?: boolean
  createTable?: boolean
  schema?: string
  ddl?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  error?: string
}

const formatValue = (value: unknown, nullAsEmpty?: boolean): string => {
  if (value === null || value === undefined) {
    return nullAsEmpty ? '' : 'NULL'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const escapeCSVField = (value: string, delimiter: string): string => {
  // If the value contains the delimiter, quotes, or newlines, wrap it in quotes
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const exportToCSV = (options: ExportOptions): string => {
  const delimiter = options.delimiter || ','
  const lines: string[] = []

  // Add headers if requested
  if (options.includeHeaders !== false) {
    const headers = options.columns.map((col) => escapeCSVField(col.name, delimiter))
    lines.push(headers.join(delimiter))
  }

  // Add data rows
  for (const row of options.rows) {
    const values = options.columns.map((col) => {
      const value = formatValue(row[col.name], options.nullAsEmpty !== false)
      return escapeCSVField(value, delimiter)
    })
    lines.push(values.join(delimiter))
  }

  return lines.join('\n')
}

const exportToJSON = (options: ExportOptions): string => {
  // Create clean objects with only the column values
  const cleanRows = options.rows.map((row) => {
    const cleanRow: Record<string, unknown> = {}
    for (const col of options.columns) {
      cleanRow[col.name] = row[col.name]
    }
    return cleanRow
  })

  return JSON.stringify(cleanRows, null, options.prettyPrint !== false ? 2 : undefined)
}

const exportToSQL = (options: ExportOptions): string => {
  const rawTableName = options.tableName || 'table_name'
  const qualifiedTableName = options.includeSchema && options.schema
    ? `"${options.schema}"."${rawTableName}"`
    : `"${rawTableName}"`
  const lines: string[] = []

  if (options.createTable && options.ddl) {
    lines.push(`DROP TABLE IF EXISTS ${qualifiedTableName};`)
    lines.push(options.ddl.endsWith(';') ? options.ddl : `${options.ddl};`)
    lines.push('')
  }

  for (const row of options.rows) {
    const columns = options.columns.map((col) => `"${col.name}"`).join(', ')
    const values = options.columns
      .map((col) => {
        const value = row[col.name]
        if (value === null || value === undefined) {
          return 'NULL'
        }
        if (typeof value === 'number') {
          return String(value)
        }
        if (typeof value === 'boolean') {
          return value ? '1' : '0'
        }
        // Escape single quotes for SQL strings
        const strValue = String(value).replace(/'/g, "''")
        return `'${strValue}'`
      })
      .join(', ')

    lines.push(`INSERT INTO ${qualifiedTableName} (${columns}) VALUES (${values});`)
  }

  return lines.join('\n')
}

const generateExportContent = (options: ExportOptions): string => {
  switch (options.format) {
    case ExportFormat.CSV:
      return exportToCSV(options)
    case ExportFormat.JSON:
      return exportToJSON(options)
    case ExportFormat.SQL:
      return exportToSQL(options)
    default:
      throw new Error(`Unsupported export format: ${options.format}`)
  }
}

export const registerExportHandlers = (): void => {
  ipcMain.handle(
    'export:toFile',
    async (event, options: ExportOptions): Promise<ExportResult> => {
      logger.debug('IPC: export:toFile', { format: options.format, rowCount: options.rows.length })

      try {
        const content = generateExportContent(options)

        // If filePath is provided, write directly without showing dialog
        if (options.filePath) {
          await writeFile(options.filePath, content, 'utf-8')
          logger.info('Export successful', { filePath: options.filePath, format: options.format })
          return { success: true, filePath: options.filePath }
        }

        // Get the requesting window for the dialog
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('No active window')
        }

        const filterName = options.format === ExportFormat.CSV ? 'CSV Files'
          : options.format === ExportFormat.JSON ? 'JSON Files'
          : 'SQL Files'

        // Show save dialog
        const result = await dialog.showSaveDialog(window, {
          title: 'Export Data',
          defaultPath: `export.${options.format}`,
          filters: [
            { name: filterName, extensions: [options.format] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export canceled' }
        }

        await writeFile(result.filePath, content, 'utf-8')
        logger.info('Export successful', { filePath: result.filePath, format: options.format })
        return { success: true, filePath: result.filePath }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Export failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // Export to clipboard
  ipcMain.handle(
    'export:toClipboard',
    async (_, options: ExportOptions): Promise<ExportResult> => {
      logger.debug('IPC: export:toClipboard', { format: options.format, rowCount: options.rows.length })

      try {
        const content = generateExportContent(options)

        // Import clipboard from electron
        const { clipboard } = await import('electron')
        clipboard.writeText(content)

        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Export to clipboard failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // Database backup (dump)
  ipcMain.handle(
    'backup:export',
    async (event, connectionId: string): Promise<ExportResult> => {
      logger.debug('IPC: backup:export', { connectionId })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        // Detect driver type and use appropriate backup strategy
        let content: string
        let fileExtension: string
        let filterName: string

        if (driver.type === DatabaseType.Redis) {
          logger.info('Starting Redis backup export')
          content = await backupRedis(driver as RedisDriver)
          fileExtension = 'json'
          filterName = 'JSON Files'
        } else if (driver.type === DatabaseType.MongoDB) {
          logger.info('Starting MongoDB backup export')
          content = await backupMongoDB(driver as MongoDBDriver)
          fileExtension = 'json'
          filterName = 'JSON Files'
        } else {
          // SQL databases: existing logic
          logger.info('Starting SQL database backup export', { type: driver.type })
          content = await backupSQL(driver)
          fileExtension = 'sql'
          filterName = 'SQL Files'
        }

        // Get the requesting window for the dialog
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('No active window')
        }

        // Show save dialog
        const result = await dialog.showSaveDialog(window, {
          title: 'Export Database Backup',
          defaultPath: `backup_${new Date().toISOString().split('T')[0]}.${fileExtension}`,
          filters: [
            { name: filterName, extensions: [fileExtension] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export canceled' }
        }

        await writeFile(result.filePath, content, 'utf-8')

        logger.info('Database backup successful', { filePath: result.filePath, type: driver.type })
        return { success: true, filePath: result.filePath }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Database backup failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // Export full table to file using cursor streaming for memory efficiency
  ipcMain.handle(
    'export:tableToFile',
    async (
      _event,
      connectionId: string,
      tableName: string,
      filePath: string,
      options: { format: ExportFormat; delimiter?: string; includeHeaders?: boolean; nullAsEmpty?: boolean; prettyPrint?: boolean; schema?: string; includeSchema?: boolean; createTable?: boolean }
    ): Promise<ExportResult> => {
      logger.debug('IPC: export:tableToFile', { connectionId, tableName, format: options.format })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        // If schema-aware database and schema provided, set it (restore afterwards)
        let previousSchema: string | undefined
        if (options.schema && driver.type === DatabaseType.PostgreSQL) {
          const pgDriver = driver as PostgreSQLDriver
          previousSchema = pgDriver.getCurrentSchema()
          pgDriver.setCurrentSchema(options.schema)
        } else if (options.schema && driver.type === DatabaseType.SQLServer) {
          const { SQLServerDriver } = await import('@main/db/sqlserver')
          if (driver instanceof SQLServerDriver) {
            previousSchema = driver.getCurrentSchema()
            driver.setCurrentSchema(options.schema)
          }
        }

        // Stream export for CSV, JSON, SQL
        const CHUNK_SIZE = 5000
        const streamResult = await driver.selectTopStream(tableName, {}, CHUNK_SIZE)
        const columns = streamResult.columns.map(c => ({ name: c.name, type: c.type }))
        const cursor = streamResult.cursor

        let openedStream: ReturnType<typeof createWriteStream> | null = null
        try {
          await cursor.start()

          const ws = createWriteStream(filePath, { encoding: 'utf-8' })
          openedStream = ws
          let streamError: Error | null = null
          ws.on('error', (err) => { streamError = err })

          // Pre-compute values used across the entire export
          const delimiter = options.delimiter || ','
          const qualifiedTableName = options.includeSchema && options.schema
            ? `"${options.schema}"."${tableName}"` : `"${tableName}"`

          // Fetch DDL if createTable option is enabled
          let ddl: string | undefined
          if (options.createTable && options.format === ExportFormat.SQL) {
            ddl = await driver.getTableDDL(tableName)
          }

          // Write header
          if (options.format === ExportFormat.CSV && options.includeHeaders !== false) {
            ws.write(columns.map(c => escapeCSVField(c.name, delimiter)).join(delimiter) + '\n')
          } else if (options.format === ExportFormat.JSON) {
            ws.write('[\n')
          } else if (options.format === ExportFormat.SQL && options.createTable && ddl) {
            ws.write(`DROP TABLE IF EXISTS ${qualifiedTableName};\n`)
            ws.write((ddl.endsWith(';') ? ddl : `${ddl};`) + '\n\n')
          }

          let totalExported = 0
          let isFirstJsonRow = true
          const sqlCols = options.format === ExportFormat.SQL ? columns.map(c => `"${c.name}"`).join(', ') : ''

          while (true) {
            if (streamError) throw streamError

            const rows = await cursor.read()
            if (rows.length === 0) break

            for (const row of rows) {
              if (options.format === ExportFormat.CSV) {
                const values = columns.map(col => {
                  const value = formatValue(row[col.name], options.nullAsEmpty !== false)
                  return escapeCSVField(value, delimiter)
                })
                ws.write(values.join(delimiter) + '\n')
              } else if (options.format === ExportFormat.JSON) {
                const cleanRow: Record<string, unknown> = {}
                for (const col of columns) {
                  cleanRow[col.name] = row[col.name]
                }
                const prefix = isFirstJsonRow ? '  ' : ',\n  '
                ws.write(prefix + JSON.stringify(cleanRow))
                isFirstJsonRow = false
              } else if (options.format === ExportFormat.SQL) {
                const values = columns.map(col => {
                  const value = row[col.name]
                  if (value === null || value === undefined) return 'NULL'
                  if (typeof value === 'number') return String(value)
                  if (typeof value === 'boolean') return value ? '1' : '0'
                  return `'${String(value).replace(/'/g, "''")}'`
                }).join(', ')
                ws.write(`INSERT INTO ${qualifiedTableName} (${sqlCols}) VALUES (${values});\n`)
              }
            }

            totalExported += rows.length
          }

          // Write footer
          if (options.format === ExportFormat.JSON) {
            ws.write(totalExported > 0 ? '\n]' : ']')
          }

          // Close write stream
          await new Promise<void>((resolve, reject) => {
            ws.end(() => {
              if (streamError) reject(streamError)
              else resolve()
            })
          })

          logger.info('Table export successful (streaming)', { filePath, format: options.format, rowCount: totalExported })
          return { success: true, filePath }
        } finally {
          if (openedStream && !openedStream.writableFinished) openedStream.destroy()
          try { await cursor.cancel() } catch { /* don't mask the original error */ }

          // Restore previous schema so we don't permanently mutate the driver
          if (previousSchema !== undefined) {
            if (driver.type === DatabaseType.PostgreSQL) {
              (driver as PostgreSQLDriver).setCurrentSchema(previousSchema)
            } else if (driver.type === DatabaseType.SQLServer) {
              const { SQLServerDriver } = await import('@main/db/sqlserver')
              if (driver instanceof SQLServerDriver) {
                driver.setCurrentSchema(previousSchema)
              }
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Table export failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // Import backup file
  ipcMain.handle(
    'backup:import',
    async (
      event,
      connectionId: string
    ): Promise<{ success: boolean; statements: number; errors: string[]; filePath?: string }> => {
      logger.debug('IPC: backup:import', { connectionId })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        // Determine file filters based on driver type
        let dialogTitle: string
        let fileFilters: Electron.FileFilter[]

        if (driver.type === DatabaseType.Redis || driver.type === DatabaseType.MongoDB) {
          dialogTitle = `Import ${driver.type === DatabaseType.Redis ? 'Redis' : 'MongoDB'} Backup`
          fileFilters = [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        } else {
          dialogTitle = 'Import SQL File'
          fileFilters = [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        }

        // Get the requesting window for the dialog
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('No active window')
        }

        // Show open dialog
        const result = await dialog.showOpenDialog(window, {
          title: dialogTitle,
          filters: fileFilters,
          properties: ['openFile']
        })

        if (result.canceled || !result.filePaths.length) {
          return { success: false, statements: 0, errors: ['Import canceled'] }
        }

        const filePath = result.filePaths[0]
        const content = await readFile(filePath, 'utf-8')

        let importResult: { successCount: number; errors: string[] }

        if (driver.type === DatabaseType.Redis) {
          logger.info('Starting Redis backup import', { filePath })
          importResult = await importRedis(driver as RedisDriver, content)
        } else if (driver.type === DatabaseType.MongoDB) {
          logger.info('Starting MongoDB backup import', { filePath })
          importResult = await importMongoDB(driver as MongoDBDriver, content)
        } else {
          logger.info('Starting SQL backup import', { filePath })
          importResult = await importSQL(driver, content)
        }

        logger.info('Database import completed', {
          filePath,
          type: driver.type,
          successCount: importResult.successCount,
          errorCount: importResult.errors.length
        })

        return {
          success: importResult.errors.length === 0,
          statements: importResult.successCount,
          errors: importResult.errors,
          filePath
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Database import failed', { error: errorMessage })
        return { success: false, statements: 0, errors: [errorMessage] }
      }
    }
  )
}

// ─── SQL backup helpers (extracted from original inline logic) ──────────────

const backupSQL = async (driver: DatabaseDriver): Promise<string> => {
  const tables = await driver.getTables('', '')
  const actualTables = tables.filter((t) => t.type === TableObjectType.Table)

  const lines: string[] = []
  lines.push('-- Database Backup')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push('')

  for (const table of actualTables) {
    try {
      const ddl = await driver.getTableDDL(table.name)
      lines.push(`-- Table: ${table.name}`)
      lines.push(`DROP TABLE IF EXISTS "${table.name}";`)
      lines.push(ddl.endsWith(';') ? ddl : `${ddl};`)
      lines.push('')

      const data = await driver.getTableData(table.name, { limit: 10000 })
      if (data.rows.length === 10000) {
        lines.push(`-- WARNING: Table ${table.name} may have more than 10,000 rows; export was truncated`)
      }
      if (data.rows.length > 0) {
        lines.push(`-- Data for ${table.name}`)
        for (const row of data.rows) {
          const columns = data.columns.map((col) => `"${col.name}"`).join(', ')
          const values = data.columns
            .map((col) => {
              const value = row[col.name]
              if (value === null || value === undefined) {
                return 'NULL'
              }
              if (typeof value === 'number') {
                return String(value)
              }
              if (typeof value === 'boolean') {
                return value ? '1' : '0'
              }
              const strValue = String(value).replace(/'/g, "''")
              return `'${strValue}'`
            })
            .join(', ')
          lines.push(`INSERT INTO "${table.name}" (${columns}) VALUES (${values});`)
        }
        lines.push('')
      }
    } catch (err) {
      lines.push(`-- Error exporting table ${table.name}: ${err instanceof Error ? err.message : String(err)}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

const importSQL = async (
  driver: DatabaseDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> => {
  // Use proper SQL splitter that handles quoted strings and comments.
  // Filter out statements that are purely comments (no executable SQL).
  const statements = splitSqlStatements(content)
    .filter((s) => {
      // Strip leading line comments and whitespace to find actual SQL content
      const stripped = s.replace(/^(\s*--[^\n]*\n)*\s*/g, '').trim()
      return stripped.length > 0 && !stripped.startsWith('--')
    })

  let successCount = 0
  const errors: string[] = []

  for (const statement of statements) {
    try {
      await driver.execute(statement)
      successCount++
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Error executing: ${statement.substring(0, 50)}... - ${errorMsg}`)
    }
  }

  return { successCount, errors }
}

// ─── Redis backup helpers ──────────────────────────────────────────────────

interface RedisBackupEntry {
  type: string
  value: unknown
  ttl: number
}

const backupRedis = async (driver: RedisDriver): Promise<string> => {
  const client = driver.getClient()
  const keys = await driver.getAllKeys()

  logger.info(`Redis backup: found ${keys.length} keys to export`)

  const backup: Record<string, RedisBackupEntry> = {}
  let exportedCount = 0
  let errorCount = 0

  for (const key of keys) {
    try {
      const keyType = await client.type(key)
      const ttl = await client.ttl(key)

      let value: unknown

      switch (keyType) {
        case 'string':
          value = await client.get(key)
          break

        case 'list':
          value = await client.lrange(key, 0, -1)
          break

        case 'set':
          value = await client.smembers(key)
          break

        case 'hash':
          value = await client.hgetall(key)
          break

        case 'zset': {
          // Retrieve members with scores as alternating array [member, score, ...]
          const raw = await client.zrange(key, 0, -1, 'WITHSCORES')
          const pairs: { member: string; score: string }[] = []
          for (let i = 0; i < raw.length; i += 2) {
            pairs.push({ member: raw[i], score: raw[i + 1] })
          }
          value = pairs
          break
        }

        case 'stream': {
          try {
            const entries = await client.xrange(key, '-', '+', 'COUNT', 10000)
            value = entries.map(([id, fields]) => {
              const obj: Record<string, string> = { _id: id }
              for (let i = 0; i < fields.length; i += 2) {
                obj[fields[i]] = fields[i + 1]
              }
              return obj
            })
          } catch {
            value = null
            logger.warn(`Redis backup: could not read stream key "${key}", skipping value`)
          }
          break
        }

        default:
          // Unknown type; store null
          value = null
          logger.warn(`Redis backup: unknown type "${keyType}" for key "${key}", skipping value`)
      }

      backup[key] = { type: keyType, value, ttl }
      exportedCount++

      if (exportedCount % 500 === 0) {
        logger.info(`Redis backup: exported ${exportedCount}/${keys.length} keys`)
      }
    } catch (err) {
      errorCount++
      logger.warn(`Redis backup: failed to export key "${key}": ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  logger.info(`Redis backup: completed. Exported ${exportedCount} keys, ${errorCount} errors`)

  const backupWrapper = {
    _meta: {
      type: 'redis',
      version: 1,
      exportedAt: new Date().toISOString(),
      keyCount: exportedCount
    },
    data: backup
  }

  return JSON.stringify(backupWrapper, null, 2)
}

const importRedis = async (
  driver: RedisDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> => {
  const parsed = JSON.parse(content)

  // Support both wrapped format (with _meta) and plain format
  const backup: Record<string, RedisBackupEntry> =
    parsed._meta && parsed.data ? parsed.data : parsed

  const client = driver.getClient()
  const keys = Object.keys(backup)
  let successCount = 0
  const errors: string[] = []

  logger.info(`Redis import: restoring ${keys.length} keys`)

  for (const key of keys) {
    try {
      const entry = backup[key]
      const { type, value, ttl } = entry

      switch (type) {
        case 'string': {
          if (value !== null && value !== undefined) {
            await client.set(key, String(value))
          }
          break
        }

        case 'list': {
          if (Array.isArray(value) && value.length > 0) {
            // Delete existing key first to avoid appending to existing data
            await client.del(key)
            // RPUSH to maintain order
            await client.rpush(key, ...value.map(String))
          }
          break
        }

        case 'set': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            await client.sadd(key, ...value.map(String))
          }
          break
        }

        case 'hash': {
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            await client.del(key)
            const hashEntries = Object.entries(value as Record<string, unknown>)
            if (hashEntries.length > 0) {
              const flatArgs: string[] = []
              for (const [field, val] of hashEntries) {
                flatArgs.push(field, String(val))
              }
              await client.hset(key, ...flatArgs)
            }
          }
          break
        }

        case 'zset': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            // Each entry is { member, score }
            const zaddArgs: (string | number)[] = []
            for (const item of value) {
              const entry = item as { member: string; score: string | number }
              zaddArgs.push(Number(entry.score), String(entry.member))
            }
            await (client as any).zadd(key, ...zaddArgs)
          }
          break
        }

        case 'stream': {
          if (Array.isArray(value) && value.length > 0) {
            await client.del(key)
            for (const entry of value) {
              const obj = entry as Record<string, string>
              const fields: string[] = []
              for (const [field, val] of Object.entries(obj)) {
                if (field !== '_id') {
                  fields.push(field, String(val))
                }
              }
              if (fields.length > 0) {
                await client.xadd(key, '*', ...fields)
              }
            }
          }
          break
        }

        default:
          logger.warn(`Redis import: unknown type "${type}" for key "${key}", skipping`)
          continue
      }

      // Restore TTL if it was set (positive value means expiry was set)
      if (ttl > 0) {
        await client.expire(key, ttl)
      }

      successCount++

      if (successCount % 500 === 0) {
        logger.info(`Redis import: restored ${successCount}/${keys.length} keys`)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to restore key "${key}": ${errorMsg}`)
      logger.warn(`Redis import: failed to restore key "${key}": ${errorMsg}`)
    }
  }

  logger.info(`Redis import: completed. Restored ${successCount} keys, ${errors.length} errors`)
  return { successCount, errors }
}

// ─── MongoDB backup helpers ────────────────────────────────────────────────

const backupMongoDB = async (driver: MongoDBDriver): Promise<string> => {
  const db = driver.getDb()
  const collections = await db.listCollections().toArray()

  logger.info(`MongoDB backup: found ${collections.length} collections to export`)

  const backup: Record<string, unknown[]> = {}
  let totalDocs = 0
  let errorCount = 0

  for (const collInfo of collections) {
    // Skip system collections and views
    if (collInfo.name.startsWith('system.') || collInfo.type === 'view') {
      logger.debug(`MongoDB backup: skipping ${collInfo.type || 'system'} "${collInfo.name}"`)
      continue
    }

    try {
      const collection = db.collection(collInfo.name)
      const docs = await collection.find({}).limit(50000).toArray()

      // Serialize documents for JSON compatibility (handle ObjectId, Date, etc.)
      const serializedDocs = docs.map((doc) => serializeMongoDocument(doc))

      backup[collInfo.name] = serializedDocs
      totalDocs += serializedDocs.length

      logger.info(`MongoDB backup: exported collection "${collInfo.name}" (${serializedDocs.length} documents)`)
    } catch (err) {
      errorCount++
      logger.warn(
        `MongoDB backup: failed to export collection "${collInfo.name}": ${err instanceof Error ? err.message : String(err)}`
      )
      backup[collInfo.name] = []
    }
  }

  logger.info(`MongoDB backup: completed. Exported ${Object.keys(backup).length} collections, ${totalDocs} total documents, ${errorCount} errors`)

  const backupWrapper = {
    _meta: {
      type: 'mongodb',
      version: 1,
      exportedAt: new Date().toISOString(),
      collectionCount: Object.keys(backup).length,
      totalDocuments: totalDocs
    },
    data: backup
  }

  return JSON.stringify(backupWrapper, null, 2)
}

/**
 * Recursively serialize a MongoDB document for JSON export.
 * Converts ObjectId, Date, Buffer, and other BSON types to JSON-safe representations.
 */
const serializeMongoDocument = (doc: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    result[key] = serializeMongoValue(value)
  }
  return result
}

const serializeMongoValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value
  }
  // Handle ObjectId (has toHexString method)
  if (value && typeof value === 'object' && 'toHexString' in value && typeof (value as any).toHexString === 'function') {
    return { $oid: (value as any).toHexString() }
  }
  // Handle Date
  if (value instanceof Date) {
    return { $date: value.toISOString() }
  }
  // Handle Buffer / Binary
  if (Buffer.isBuffer(value)) {
    return { $binary: value.toString('base64') }
  }
  // Handle BigInt
  if (typeof value === 'bigint') {
    return { $numberLong: value.toString() }
  }
  // Handle Array
  if (Array.isArray(value)) {
    return value.map((v) => serializeMongoValue(v))
  }
  // Handle BSON-typed objects
  if (value && typeof value === 'object') {
    const bsonObj = value as Record<string, unknown>
    if (bsonObj._bsontype === 'Decimal128') {
      return { $numberDecimal: String(value) }
    }
    if (bsonObj._bsontype === 'Long') {
      return { $numberLong: String(value) }
    }
    if (bsonObj._bsontype === 'Int32') {
      return { $numberInt: String(value) }
    }
    if (bsonObj._bsontype === 'Timestamp') {
      return { $timestamp: String(value) }
    }
    if (bsonObj._bsontype === 'Binary') {
      return { $binary: '<binary data>' }
    }
    // Recurse for plain objects
    return serializeMongoDocument(value as Record<string, unknown>)
  }
  return value
}

/**
 * Deserialize a previously-serialized MongoDB document back to a plain object
 * suitable for insertMany. Converts $oid, $date, etc. back to plain values
 * (strings/dates) that the MongoDB driver can handle.
 */
const deserializeMongoDocument = (doc: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    // Keep _id and deserialize it (e.g., ObjectId)
    if (key === '_id') {
      result[key] = deserializeMongoValue(value)
      continue
    }
    result[key] = deserializeMongoValue(value)
  }
  return result
}

const deserializeMongoValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => deserializeMongoValue(v))
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Extended JSON markers
    if (typeof obj.$oid === 'string') {
      // Return as string; the MongoDB driver will handle ObjectId creation if needed
      return obj.$oid
    }
    if (typeof obj.$date === 'string') {
      return new Date(obj.$date)
    }
    if (typeof obj.$numberLong === 'string') {
      return Number(obj.$numberLong)
    }
    if (typeof obj.$numberInt === 'string') {
      return Number(obj.$numberInt)
    }
    if (typeof obj.$numberDecimal === 'string') {
      return Number(obj.$numberDecimal)
    }
    if (obj.$binary !== undefined) {
      if (typeof obj.$binary === 'string' && obj.$binary !== '<binary data>') {
        return Buffer.from(obj.$binary, 'base64')
      }
      return null
    }
    if (typeof obj.$timestamp === 'string') {
      return obj.$timestamp
    }

    // Recurse for plain objects
    return deserializeMongoDocument(obj)
  }
  return value
}

const importMongoDB = async (
  driver: MongoDBDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> => {
  const parsed = JSON.parse(content)

  // Support both wrapped format (with _meta) and plain format
  const backup: Record<string, unknown[]> =
    parsed._meta && parsed.data ? parsed.data : parsed

  const db = driver.getDb()
  const collectionNames = Object.keys(backup)
  let successCount = 0
  const errors: string[] = []

  logger.info(`MongoDB import: restoring ${collectionNames.length} collections`)

  for (const collectionName of collectionNames) {
    // Skip metadata key
    if (collectionName === '_meta') {
      continue
    }

    const docs = backup[collectionName]
    if (!Array.isArray(docs) || docs.length === 0) {
      logger.debug(`MongoDB import: skipping empty collection "${collectionName}"`)
      continue
    }

    try {
      const collection = db.collection(collectionName)

      // Deserialize documents (convert extended JSON markers back)
      const deserializedDocs = docs.map((doc) =>
        deserializeMongoDocument(doc as Record<string, unknown>)
      )

      // Insert in batches of 1000 to avoid overwhelming the server
      const batchSize = 1000
      let insertedCount = 0

      for (let i = 0; i < deserializedDocs.length; i += batchSize) {
        const batch = deserializedDocs.slice(i, i + batchSize)
        try {
          const result = await collection.insertMany(batch, { ordered: false })
          insertedCount += result.insertedCount
        } catch (batchErr) {
          // With ordered: false, some docs may have been inserted even if some failed
          const errMsg = batchErr instanceof Error ? batchErr.message : String(batchErr)
          errors.push(`Error in batch for "${collectionName}" (batch ${Math.floor(i / batchSize) + 1}): ${errMsg}`)
          logger.warn(`MongoDB import: batch error in "${collectionName}": ${errMsg}`)
        }
      }

      successCount += insertedCount
      logger.info(`MongoDB import: restored collection "${collectionName}" (${insertedCount} documents)`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to restore collection "${collectionName}": ${errorMsg}`)
      logger.warn(`MongoDB import: failed to restore collection "${collectionName}": ${errorMsg}`)
    }
  }

  logger.info(`MongoDB import: completed. Restored ${successCount} documents, ${errors.length} errors`)
  return { successCount, errors }
}
