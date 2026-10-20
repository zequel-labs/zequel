import { createRowTransferContext } from '@main/services/row-transfer-context'
import { pipeline } from 'node:stream/promises'
import { createBackupArtifact } from '@main/services/backup/artifacts'
import { rowTransfers } from '@main/services/row-transfer'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { createWriteStream } from 'fs'
import { logger } from '@main/utils/logger'
import { isPathAllowed } from '@main/utils/pathValidation'
import { windowManager } from '@main/services/windowManager'
import { DatabaseType, ExportFormat } from '@main/types'
import { formatExportDate, isDate } from '@main/utils/date'

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
  operationId?: string
  databaseType?: DatabaseType
}

export interface ExportResult {
  success: boolean
  filePath?: string
  error?: string
}

const quoteIdentifier = (name: string, type?: DatabaseType): string => {
  if (type === DatabaseType.MySQL || type === DatabaseType.MariaDB || type === DatabaseType.ClickHouse) return '`' + name.replace(/`/g, '``') + '`'
  if (type === DatabaseType.SQLServer) return '[' + name.replace(/]/g, ']]') + ']'
  return '"' + name.replace(/"/g, '""') + '"'
}

const jsonReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('JSON cannot represent non-finite numbers')
  return typeof value === 'bigint' ? value.toString() : value
}

const formatValue = (value: unknown, nullAsEmpty?: boolean): string => {
  if (value === null || value === undefined) {
    return nullAsEmpty ? '' : 'NULL'
  }
  if (isDate(value)) {
    return formatExportDate(value)
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return '\\x' + Buffer.from(value).toString('hex')
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
      const raw = row[col.name]
      if ((raw === null || raw === undefined) && options.nullAsEmpty !== true) return '\\N'
      const value = formatValue(raw, options.nullAsEmpty === true)
      if (value === '\\N') return '"\\N"'
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
      cleanRow[col.name] = jsonValue(row[col.name])
    }
    return cleanRow
  })

  return JSON.stringify(cleanRows, (_key, value: unknown) => jsonReplacer(_key, value), options.prettyPrint !== false ? 2 : undefined)
}

const jsonValue = (value: unknown): unknown => Buffer.isBuffer(value) || value instanceof Uint8Array
  ? '\\x' + Buffer.from(value).toString('hex') : value

const exportToSQL = (options: ExportOptions): string => {
  const rawTableName = options.tableName || 'table_name'
  const qualifiedTableName = options.includeSchema && options.schema
    ? `${quoteIdentifier(options.schema, options.databaseType)}.${quoteIdentifier(rawTableName, options.databaseType)}`
    : quoteIdentifier(rawTableName, options.databaseType)
  const lines: string[] = []

  if (options.createTable && options.ddl) {
    lines.push(options.ddl.endsWith(';') ? options.ddl : `${options.ddl};`)
    lines.push('')
  }

  for (const row of options.rows) {
    const columns = options.columns.map((col) => quoteIdentifier(col.name, options.databaseType)).join(', ')
    const values = options.columns
      .map((col) => {
        const value = row[col.name]
        if (value === null || value === undefined) {
          return 'NULL'
        }
        if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
          const hex = Buffer.from(value).toString('hex')
          if (options.databaseType === DatabaseType.PostgreSQL) return `decode('${hex}', 'hex')`
          if (options.databaseType === DatabaseType.SQLServer) return `0x${hex}`
          if (options.databaseType === DatabaseType.DuckDB) return `from_hex('${hex}')`
          return `X'${hex}'`
        }
        if (typeof value === 'number') {
          if (!Number.isFinite(value)) throw new Error('Non-finite numbers cannot be exported as portable SQL')
          return String(value)
        }
        if (typeof value === 'boolean') {
          return options.databaseType === DatabaseType.SQLServer || options.databaseType === DatabaseType.SQLite ? (value ? '1' : '0') : (value ? 'TRUE' : 'FALSE')
        }
        if (isDate(value)) {
          return `'${formatExportDate(value)}'`
        }
        // Escape single quotes for SQL strings
        let strValue = (typeof value === 'object' ? JSON.stringify(value) : String(value)).replace(/'/g, "''")
        if ([DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.ClickHouse].includes(options.databaseType!)) strValue = strValue.replace(/\\/g, '\\\\')
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

const writeRows = async (
  owner: number,
  filePath: string,
  options: ExportOptions,
  rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>,
  total?: number,
  onCancel?: () => void,
  release?: () => Promise<void>,
): Promise<ExportResult> => {
  const operation = rowTransfers.start(owner, options.operationId)
  operation.progress.label = `Export ${options.tableName || 'query results'}`
  if (onCancel) operation.controller.signal.addEventListener('abort', onCancel, { once: true })
  let artifact: Awaited<ReturnType<typeof createBackupArtifact>> | undefined
  let failure: unknown
  try {
    artifact = await createBackupArtifact(filePath)
    operation.progress.phase = 'transferring'
    operation.progress.total = total
    const content = async function* (): AsyncGenerator<string> {
      const header = { ...options, rows: [] }
      if (options.format === ExportFormat.JSON) yield options.prettyPrint === false ? '[' : '[\n'
      else {
        const text = generateExportContent(header)
        if (text) yield text + '\n'
      }
      let first = true
      for await (const row of rows) {
        operation.controller.signal.throwIfAborted()
        if (options.format === ExportFormat.JSON) {
          const clean = Object.fromEntries(options.columns.map(column => [column.name, jsonValue(row[column.name])]))
          yield (first ? '' : options.prettyPrint === false ? ',' : ',\n') + JSON.stringify(clean, (_key, value: unknown) => jsonReplacer(_key, value), options.prettyPrint === false ? undefined : 2)
        } else yield generateExportContent({ ...options, createTable: false, includeHeaders: false, rows: [row] }) + '\n'
        first = false
        operation.progress.processed++
        // Yield to IPC/cancel even when the source is already in memory.
        if (operation.progress.processed % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
      }
      if (options.format === ExportFormat.JSON) yield options.prettyPrint === false ? ']' : '\n]'
    }
    const measured = async function* (): AsyncGenerator<string> {
      for await (const chunk of content()) {
        operation.progress.bytes = (operation.progress.bytes ?? 0) + Buffer.byteLength(chunk)
        yield chunk
      }
    }
    await pipeline(measured(), createWriteStream(artifact.path, { flags: 'wx', mode: 0o600 }), { signal: operation.controller.signal })
    operation.controller.signal.throwIfAborted()
    operation.progress.phase = 'finalizing'
    await artifact.publish(artifact.path)
    return { success: true, filePath }
  } catch (error) {
    failure = error
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    if (onCancel) operation.controller.signal.removeEventListener('abort', onCancel)
    try {
      await artifact?.cleanup()
      await release?.()
    } catch (error) { failure = error; throw error }
    finally { rowTransfers.finish(operation, failure) }
  }
}

export const registerExportHandlers = (): void => {
  ipcMain.handle(
    'export:toFile',
    async (event, options: ExportOptions): Promise<ExportResult> => {
      logger.debug('IPC: export:toFile', { format: options.format, rowCount: options.rows.length })

      try {
        // If filePath is provided, write directly without showing dialog
        if (options.filePath) {
          if (!isPathAllowed(options.filePath)) {
            throw new Error('Export file path is not in an allowed directory')
          }
          return await writeRows(event.sender.id, options.filePath, options, options.rows, options.rows.length)
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

        return await writeRows(event.sender.id, result.filePath, options, options.rows, options.rows.length)
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

  // Export full table to file using cursor streaming for memory efficiency
  ipcMain.handle(
    'export:tableToFile',
    async (
      event,
      connectionId: string,
      tableName: string,
      filePath: string,
      options: { format: ExportFormat; delimiter?: string; includeHeaders?: boolean; nullAsEmpty?: boolean; prettyPrint?: boolean; schema?: string; includeSchema?: boolean; createTable?: boolean; operationId?: string }
    ): Promise<ExportResult> => {
      logger.debug('IPC: export:tableToFile', { connectionId, tableName, format: options.format })

      const tableOwnerId = windowManager.getSessionOwner(connectionId)
      if (tableOwnerId !== undefined && tableOwnerId !== event.sender.id) {
        throw new Error('Not authorized to export data from this connection')
      }
      if (!isPathAllowed(filePath)) {
        throw new Error('Export file path is not in an allowed directory')
      }

      let context: Awaited<ReturnType<typeof createRowTransferContext>> | undefined
      try {
        context = await createRowTransferContext(connectionId)
        const driver = context.driver

        // Schema belongs to this query, never to mutable editor state.
        const streamResult = await driver.selectTopStream(tableName, { schema: options.schema, rawValues: true }, 500)
        const cursor = streamResult.cursor
        let cursorCleanup: Promise<void> | undefined
        const closeCursor = (): Promise<void> => cursorCleanup ??= cursor.cancel().catch(() => {})
        try {
          let ddl: string | undefined
          if (options.createTable && options.format === ExportFormat.SQL) {
            ddl = await driver.getTableDDL(tableName, options.schema)
          }
          await cursor.start()
          const rows = async function* (): AsyncGenerator<Record<string, unknown>> {
            while (true) {
              const batch = await cursor.read()
              if (!batch.length) return
              for (const row of batch) yield row
            }
          }
          return await writeRows(event.sender.id, filePath, {
            ...options, columns: streamResult.columns, rows: [], tableName, ddl, databaseType: driver.type,
          }, rows(), streamResult.totalRows, () => { void closeCursor() }, async () => {
            await closeCursor()
            await context?.close()
          })
        } finally {
          await closeCursor()
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Table export failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      } finally {
        await context?.close()
      }
    }
  )

}
