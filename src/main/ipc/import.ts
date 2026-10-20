import { createRowTransferContext } from '@main/services/row-transfer-context'
import { rowTransfers } from '@main/services/row-transfer'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { logger } from '@main/utils/logger'
import { isPathAllowed, allowSelectedPath } from '@main/utils/pathValidation'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { assertSessionOwner } from '@main/ipc/helpers'
import { convertImportValue } from '@main/services/import-values'
import { DatabaseType } from '@main/types'
import {
  parseCSVFile,
  parseJSONFile,
  streamImportData,
  type ImportPreview,
  type ImportOptions,
  type ColumnMapping
} from '@main/services/import'

export interface ImportResult {
  success: boolean
  insertedRows?: number
  errors?: string[]
  filePath?: string
  cancelled?: boolean
}

export const registerImportHandlers = (): void => {
  ipcMain.handle('rowTransfer:get', (event, id: string) => rowTransfers.get(event.sender.id, id))
  ipcMain.handle('rowTransfer:cancel', (event, id: string) => rowTransfers.cancel(event.sender.id, id))
  // Open file dialog and get preview
  ipcMain.handle(
    'import:preview',
    async (event, format: 'csv' | 'json'): Promise<{ preview: ImportPreview | null; filePath: string | null; error?: string }> => {
      logger.debug('IPC: import:preview', { format })

      try {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('No active window')
        }

        const filters =
          format === 'csv'
            ? [{ name: 'CSV Files', extensions: ['csv', 'tsv', 'txt'] }]
            : [{ name: 'JSON Files', extensions: ['json'] }]

        const result = await dialog.showOpenDialog(window, {
          title: `Import ${format.toUpperCase()} File`,
          filters: [...filters, { name: 'All Files', extensions: ['*'] }],
          properties: ['openFile']
        })

        if (result.canceled || !result.filePaths.length) {
          return { preview: null, filePath: null, error: 'Import canceled' }
        }

        const filePath = result.filePaths[0]
        allowSelectedPath(filePath)
        const options: ImportOptions = {
          filePath,
          format,
          hasHeaders: true,
          previewLimit: 100
        }

        const preview =
          format === 'csv' ? await parseCSVFile(options) : await parseJSONFile(options)

        return { preview, filePath }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Import preview failed', { error: errorMessage })
        return { preview: null, filePath: null, error: errorMessage }
      }
    }
  )

  // Re-parse with different options
  ipcMain.handle(
    'import:reparse',
    async (
      _,
      filePath: string,
      format: 'csv' | 'json',
      options: { hasHeaders?: boolean; delimiter?: string; nullToken?: string }
    ): Promise<{ preview: ImportPreview | null; error?: string }> => {
      logger.debug('IPC: import:reparse', { filePath, format, options })

      try {
        if (!isPathAllowed(filePath)) {
          throw new Error('Import file path is not in an allowed directory')
        }

        const importOptions: ImportOptions = {
          filePath,
          format,
          hasHeaders: options.hasHeaders,
          delimiter: options.delimiter,
          nullToken: options.nullToken,
          previewLimit: 100
        }

        const preview =
          format === 'csv'
            ? await parseCSVFile(importOptions)
            : await parseJSONFile(importOptions)

        return { preview }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Import reparse failed', { error: errorMessage })
        return { preview: null, error: errorMessage }
      }
    }
  )

  // Execute import
  ipcMain.handle(
    'import:execute',
    async (
      event,
      connectionId: string,
      tableName: string,
      filePath: string,
      format: 'csv' | 'json',
      columnMappings: ColumnMapping[],
      options: {
        hasHeaders?: boolean
        delimiter?: string
        nullToken?: string
        truncateTable?: boolean
        batchSize?: number
        schema?: string
        operationId?: string
      }
    ): Promise<ImportResult> => {
      logger.debug('IPC: import:execute', { connectionId, tableName, format })
      let operation: ReturnType<typeof rowTransfers.start> | undefined
      let failure: unknown
      let insertedRows = 0
      let context: Awaited<ReturnType<typeof createRowTransferContext>> | undefined
      let abortQuery: (() => void) | undefined
      let cancellation: Promise<unknown> | undefined
      let transaction = false
      let inFlight: Promise<void> | undefined

      try {
        const ownerId = windowManager.getSessionOwner(connectionId)
        if (ownerId !== undefined && ownerId !== event.sender.id) {
          throw new Error('Not authorized to import data on this connection')
        }
        if (!isPathAllowed(filePath)) {
          throw new Error('Import file path is not in an allowed directory')
        }

        operation = rowTransfers.start(event.sender.id, options.operationId)
        operation.progress.label = `Import into ${options.schema ? options.schema + '.' : ''}${tableName}`
        context = await createRowTransferContext(connectionId)
        operation.controller.signal.throwIfAborted()
        const driver = context.driver

        // Read all data from file
        const importOptions: ImportOptions = {
          filePath,
          format,
          hasHeaders: options.hasHeaders,
          delimiter: options.delimiter,
          nullToken: options.nullToken
        }

        if (typeof tableName !== 'string' || !tableName.trim()) throw new Error('Invalid tableName')

        const mapped = columnMappings.filter(mapping => mapping.targetColumn && mapping.sourceColumn)
        if (!mapped.length) throw new Error('Select at least one column to import')
        if (new Set(mapped.map(mapping => mapping.targetColumn)).size !== mapped.length) throw new Error('Each target column can only be mapped once')
        const columns = await driver.getColumns(tableName, options.schema)
        for (const mapping of mapped) {
          const column = columns.find(column => column.name === mapping.targetColumn)
          if (!column) throw new Error(`Unknown target column: ${mapping.targetColumn}`)
          mapping.targetType = column.type
        }
        importOptions.onBytes = bytes => { operation!.progress.bytes = bytes }
        operation.progress.label = `Import into ${options.schema ? options.schema + '.' : ''}${tableName}`
        const signal = operation.controller.signal
        abortQuery = () => { cancellation = driver.cancelQuery().catch(() => {}) }
        signal.addEventListener('abort', abortQuery, { once: true })
        // Validate the complete input before the first write, retaining one record at a time.
        let totalRows = 0
        for await (const row of streamImportData(importOptions, signal)) {
          for (const mapping of mapped) convertImportValue(row[mapping.sourceColumn], mapping.targetType)
          operation.progress.processed = ++totalRows
          if (totalRows % 500 === 0) await new Promise<void>(resolve => setImmediate(resolve))
        }
        operation.progress.phase = 'transferring'
        operation.progress.total = totalRows
        operation.progress.processed = 0
        signal.throwIfAborted()

        // Keep clearing and insertion on the same dedicated transaction connection.
        let canRollback = driver.supportsTransactions
        if (canRollback && [DatabaseType.MySQL, DatabaseType.MariaDB].includes(driver.type)) {
          const storage = await driver.execute('SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?', [options.schema || null, tableName])
          if (storage.error) throw new Error(storage.error)
          canRollback = String(storage.rows?.[0]?.engine).toLowerCase() === 'innodb'
        }
        if (canRollback) {
          await driver.beginTransaction()
          transaction = true
        }
        // Clearing first must fail closed: never append after an unsuccessful deletion.
        if (options.truncateTable) {
          const quote = (name: string): string => {
            if ([DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.ClickHouse].includes(driver.type)) return '`' + name.replace(/`/g, '``') + '`'
            if (driver.type === DatabaseType.SQLServer) return '[' + name.replace(/]/g, ']]') + ']'
            return '"' + name.replace(/"/g, '""') + '"'
          }
          if ([DatabaseType.MongoDB, DatabaseType.Redis].includes(driver.type)) throw new Error('Clearing this database type is not supported by file import')
          const target = options.schema ? `${quote(options.schema)}.${quote(tableName)}` : quote(tableName)
          // ClickHouse DELETE requires WHERE and runs as an asynchronous mutation; TRUNCATE completes first.
          const clear = driver.type === DatabaseType.ClickHouse ? `TRUNCATE TABLE ${target}` : `DELETE FROM ${target}`
          const result = await driver.execute(clear, undefined, transaction)
          if (result.error) throw new Error(`Failed to clear table: ${result.error}`)
        }

        const sqlBatch = [DatabaseType.PostgreSQL, DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.SQLite, DatabaseType.DuckDB, DatabaseType.SQLServer].includes(driver.type)
        const quote = (name: string): string => {
          if ([DatabaseType.MySQL, DatabaseType.MariaDB].includes(driver.type)) return '`' + name.replace(/`/g, '``') + '`'
          if (driver.type === DatabaseType.SQLServer) return '[' + name.replace(/]/g, ']]') + ']'
          return '"' + name.replace(/"/g, '""') + '"'
        }
        const target = options.schema ? `${quote(options.schema)}.${quote(tableName)}` : quote(tableName)
        // Row-by-row INSERTs would create one ClickHouse part per row and round values through SQL literals.
        const bulkInsert = driver.type === DatabaseType.ClickHouse ? driver.insertRows?.bind(driver) : undefined
        const parameterLimit = driver.type === DatabaseType.SQLite ? 900 : driver.type === DatabaseType.SQLServer ? 2000 : 30000
        const batchLimit = Math.max(1, Math.min(options.batchSize || 500, 1000, Math.floor(parameterLimit / mapped.length)))
        let batch: Record<string, unknown>[] = []
        let bytes = 0
        const flush = async (): Promise<void> => {
          if (!batch.length) return
          signal.throwIfAborted()
          // Never send a batch before the previous one succeeded: at most one write is in flight.
          await inFlight
          signal.throwIfAborted()
          const rows = batch
          batch = []
          bytes = 0
          if (sqlBatch) {
            const columnsSql = mapped.map(mapping => quote(mapping.targetColumn)).join(', ')
            // Untyped NULL parameters fail on SQL Server binary columns and DuckDB; a NULL literal fits any type.
            const values = rows.map(row => '(' + mapped.map(mapping => row[mapping.targetColumn] === null ? 'NULL' : '?').join(', ') + ')')
            const params = rows.flatMap(row => mapped.map(mapping => row[mapping.targetColumn]).filter(value => value !== null))
            // Parse the next batch while this one is written (on SQLite, in its worker thread).
            inFlight = driver.execute(`INSERT INTO ${target} (${columnsSql}) VALUES ${values.join(', ')}`, params, transaction).then(result => {
              if (result.error) throw new Error(`Batch starting at row ${insertedRows + 1}: ${result.error}`)
              insertedRows += rows.length
              operation!.progress.processed = insertedRows
              operation!.progress.applied = transaction ? 0 : insertedRows
            })
            inFlight.catch(() => {}) // Observed by the next flush or the error path.
          } else if (bulkInsert) {
            inFlight = bulkInsert(tableName, rows, options.schema).then(() => {
              insertedRows += rows.length
              operation!.progress.processed = insertedRows
              operation!.progress.applied = insertedRows
            }, (error: unknown) => {
              throw new Error(`Batch starting at row ${insertedRows + 1}: ${error instanceof Error ? error.message : String(error)}`)
            })
            inFlight.catch(() => {})
          } else {
            for (const values of rows) {
              signal.throwIfAborted()
              const result = await driver.insertRow({ table: tableName, schema: options.schema, values })
              if (!result.success) throw new Error(`Row ${insertedRows + 1}: ${result.error || 'Insert failed'}`)
              insertedRows++
              operation!.progress.applied = insertedRows
            }
            operation!.progress.processed = insertedRows
            operation!.progress.applied = transaction ? 0 : insertedRows
          }
          await new Promise<void>(resolve => setImmediate(resolve))
        }
        for await (const row of streamImportData(importOptions, signal)) {
          signal.throwIfAborted()
          const values: Record<string, unknown> = Object.create(null)
          for (const mapping of mapped) values[mapping.targetColumn] = convertImportValue(row[mapping.sourceColumn], mapping.targetType)
          const rowBytes = Buffer.byteLength(JSON.stringify(values))
          if (bytes + rowBytes > 1024 * 1024) await flush()
          batch.push(values)
          bytes += rowBytes
          if (batch.length >= batchLimit) await flush()
        }
        await flush()
        await inFlight
        signal.throwIfAborted()
        if (transaction) {
          await driver.commitTransaction()
          transaction = false
          operation.progress.applied = insertedRows
        }
        return { success: true, insertedRows, errors: [], filePath }
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error)
        // Rollback must not race the batch still being written on the same connection.
        await inFlight?.catch(() => {})
        await cancellation
        if (transaction && context) {
          try {
            await context.driver.rollbackTransaction()
            insertedRows = 0
            if (operation) operation.progress.applied = 0
          } catch (rollbackError) {
            errorMessage += `; Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
          }
        }
        failure = error
        logger.error('Import failed', { error: errorMessage })
        return { success: false, insertedRows, cancelled: operation?.controller.signal.aborted, errors: [errorMessage] }
      } finally {
        if (abortQuery) operation?.controller.signal.removeEventListener('abort', abortQuery)
        try { await context?.close() } catch (error) { failure = error; throw error }
        finally { if (operation) rowTransfers.finish(operation, failure) }
      }
    }
  )

  // Get table columns for mapping
  ipcMain.handle(
    'import:getTableColumns',
    async (event, connectionId: string, tableName: string, schema?: string) => {
      assertSessionOwner(event, connectionId)
      logger.debug('IPC: import:getTableColumns', { connectionId, tableName })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        const columns = await driver.getColumns(tableName, schema)
        return { columns }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to get table columns', { error: errorMessage })
        return { columns: [], error: errorMessage }
      }
    }
  )
}
