import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import * as XLSX from 'xlsx'
import { logger } from '../utils/logger'
import { connectionManager } from '../db/manager'
import { RedisDriver } from '../db/redis'
import { MongoDBDriver } from '../db/mongodb'
import type { DatabaseDriver } from '../db/base'

export interface ExportOptions {
  format: 'csv' | 'json' | 'sql' | 'xlsx'
  columns: { name: string; type: string }[]
  rows: Record<string, unknown>[]
  tableName?: string
  includeHeaders?: boolean
  delimiter?: string
}

export interface ExportResult {
  success: boolean
  filePath?: string
  error?: string
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function escapeCSVField(value: string, delimiter: string): string {
  // If the value contains the delimiter, quotes, or newlines, wrap it in quotes
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function exportToCSV(options: ExportOptions): string {
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
      const value = formatValue(row[col.name])
      return escapeCSVField(value, delimiter)
    })
    lines.push(values.join(delimiter))
  }

  return lines.join('\n')
}

function exportToJSON(options: ExportOptions): string {
  // Create clean objects with only the column values
  const cleanRows = options.rows.map((row) => {
    const cleanRow: Record<string, unknown> = {}
    for (const col of options.columns) {
      cleanRow[col.name] = row[col.name]
    }
    return cleanRow
  })

  return JSON.stringify(cleanRows, null, 2)
}

function exportToSQL(options: ExportOptions): string {
  const tableName = options.tableName || 'table_name'
  const lines: string[] = []

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

    lines.push(`INSERT INTO "${tableName}" (${columns}) VALUES (${values});`)
  }

  return lines.join('\n')
}

function exportToExcel(options: ExportOptions): Buffer {
  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new()

  // Prepare data for Excel
  const headers = options.columns.map((col) => col.name)
  const data: unknown[][] = []

  // Add headers as first row
  if (options.includeHeaders !== false) {
    data.push(headers)
  }

  // Add data rows
  for (const row of options.rows) {
    const rowData = options.columns.map((col) => {
      const value = row[col.name]
      if (value === null || value === undefined) {
        return ''
      }
      if (typeof value === 'object') {
        return JSON.stringify(value)
      }
      return value
    })
    data.push(rowData)
  }

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Auto-size columns based on content
  const colWidths = headers.map((header, index) => {
    let maxWidth = header.length
    for (const row of options.rows) {
      const value = row[options.columns[index].name]
      const valueStr = value === null || value === undefined ? '' : String(value)
      maxWidth = Math.max(maxWidth, valueStr.length)
    }
    return { wch: Math.min(maxWidth + 2, 50) } // Cap at 50 chars
  })
  worksheet['!cols'] = colWidths

  // Add worksheet to workbook
  const sheetName = options.tableName || 'Data'
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)) // Excel sheet name max 31 chars

  // Generate buffer
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export:toFile',
    async (event, options: ExportOptions): Promise<ExportResult> => {
      logger.debug('IPC: export:toFile', { format: options.format, rowCount: options.rows.length })

      try {
        // Determine file extension and content
        let content: string | Buffer
        let defaultExtension: string
        let filterName: string
        let isBinary = false

        switch (options.format) {
          case 'csv':
            content = exportToCSV(options)
            defaultExtension = 'csv'
            filterName = 'CSV Files'
            break
          case 'json':
            content = exportToJSON(options)
            defaultExtension = 'json'
            filterName = 'JSON Files'
            break
          case 'sql':
            content = exportToSQL(options)
            defaultExtension = 'sql'
            filterName = 'SQL Files'
            break
          case 'xlsx':
            content = exportToExcel(options)
            defaultExtension = 'xlsx'
            filterName = 'Excel Files'
            isBinary = true
            break
          default:
            throw new Error(`Unsupported export format: ${options.format}`)
        }

        // Get the focused window for the dialog
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
        }

        // Show save dialog
        const result = await dialog.showSaveDialog(window, {
          title: 'Export Data',
          defaultPath: `export.${defaultExtension}`,
          filters: [
            { name: filterName, extensions: [defaultExtension] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export canceled' }
        }

        // Write file
        if (isBinary) {
          await writeFile(result.filePath, content as Buffer)
        } else {
          await writeFile(result.filePath, content as string, 'utf-8')
        }

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
        let content: string

        switch (options.format) {
          case 'csv':
            content = exportToCSV(options)
            break
          case 'json':
            content = exportToJSON(options)
            break
          case 'sql':
            content = exportToSQL(options)
            break
          default:
            throw new Error(`Unsupported export format: ${options.format}`)
        }

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

        if (driver.type === 'redis') {
          logger.info('Starting Redis backup export')
          content = await backupRedis(driver as RedisDriver)
          fileExtension = 'json'
          filterName = 'JSON Files'
        } else if (driver.type === 'mongodb') {
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

        // Get the focused window for the dialog
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
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

        if (driver.type === 'redis' || driver.type === 'mongodb') {
          dialogTitle = `Import ${driver.type === 'redis' ? 'Redis' : 'MongoDB'} Backup`
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

        // Get the focused window for the dialog
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
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

        if (driver.type === 'redis') {
          logger.info('Starting Redis backup import', { filePath })
          importResult = await importRedis(driver as RedisDriver, content)
        } else if (driver.type === 'mongodb') {
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

async function backupSQL(driver: DatabaseDriver): Promise<string> {
  const tables = await driver.getTables('', '')
  const actualTables = tables.filter((t) => t.type === 'table')

  const lines: string[] = []
  lines.push('-- Database Backup')
  lines.push(`-- Generated: ${new Date().toISOString()}`)
  lines.push('')

  for (const table of actualTables) {
    try {
      const ddl = await driver.getTableDDL(table.name)
      lines.push(`-- Table: ${table.name}`)
      lines.push(`DROP TABLE IF EXISTS "${table.name}";`)
      lines.push(ddl + ';')
      lines.push('')

      const data = await driver.getTableData(table.name, { limit: 10000 })
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

async function importSQL(
  driver: DatabaseDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> {
  const statements = content
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

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

async function backupRedis(driver: RedisDriver): Promise<string> {
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

async function importRedis(
  driver: RedisDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> {
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

async function backupMongoDB(driver: MongoDBDriver): Promise<string> {
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
function serializeMongoDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    result[key] = serializeMongoValue(value)
  }
  return result
}

function serializeMongoValue(value: unknown): unknown {
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
function deserializeMongoDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    // Skip _id to let MongoDB generate new ObjectIds on import
    // (the original _id might conflict). Users importing into the same DB
    // can remove this check if they prefer to keep original IDs.
    if (key === '_id') {
      result[key] = deserializeMongoValue(value)
      continue
    }
    result[key] = deserializeMongoValue(value)
  }
  return result
}

function deserializeMongoValue(value: unknown): unknown {
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

async function importMongoDB(
  driver: MongoDBDriver,
  content: string
): Promise<{ successCount: number; errors: string[] }> {
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
