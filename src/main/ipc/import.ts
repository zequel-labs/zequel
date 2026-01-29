import { ipcMain, dialog, BrowserWindow } from 'electron'
import { logger } from '../utils/logger'
import { connectionManager } from '../db/manager'
import {
  parseCSVFile,
  parseJSONFile,
  readImportData,
  type ImportPreview,
  type ImportOptions,
  type ColumnMapping
} from '../services/import'

export interface ImportResult {
  success: boolean
  insertedRows?: number
  errors?: string[]
  filePath?: string
}

export function registerImportHandlers(): void {
  // Open file dialog and get preview
  ipcMain.handle(
    'import:preview',
    async (_, format: 'csv' | 'json'): Promise<{ preview: ImportPreview | null; filePath: string | null; error?: string }> => {
      logger.debug('IPC: import:preview', { format })

      try {
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
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
      options: { hasHeaders?: boolean; delimiter?: string }
    ): Promise<{ preview: ImportPreview | null; error?: string }> => {
      logger.debug('IPC: import:reparse', { filePath, format, options })

      try {
        const importOptions: ImportOptions = {
          filePath,
          format,
          hasHeaders: options.hasHeaders,
          delimiter: options.delimiter,
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
      _,
      connectionId: string,
      tableName: string,
      filePath: string,
      format: 'csv' | 'json',
      columnMappings: ColumnMapping[],
      options: {
        hasHeaders?: boolean
        delimiter?: string
        truncateTable?: boolean
        batchSize?: number
      }
    ): Promise<ImportResult> => {
      logger.debug('IPC: import:execute', { connectionId, tableName, format })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        // Read all data from file
        const importOptions: ImportOptions = {
          filePath,
          format,
          hasHeaders: options.hasHeaders,
          delimiter: options.delimiter
        }

        const data = await readImportData(importOptions)
        const batchSize = options.batchSize || 100
        const errors: string[] = []
        let insertedRows = 0

        // Truncate table if requested
        if (options.truncateTable) {
          try {
            await driver.execute(`DELETE FROM "${tableName}"`)
            logger.debug('Table truncated', { tableName })
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            errors.push(`Failed to truncate table: ${errorMsg}`)
          }
        }

        // Process data in batches
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize)

          for (const row of batch) {
            try {
              // Build values object based on column mappings
              const values: Record<string, unknown> = {}

              for (const mapping of columnMappings) {
                if (mapping.targetColumn && mapping.sourceColumn) {
                  let value = row[mapping.sourceColumn]

                  // Type conversion
                  if (value !== null && value !== undefined && value !== '') {
                    switch (mapping.targetType.toUpperCase()) {
                      case 'INTEGER':
                      case 'INT':
                      case 'BIGINT':
                      case 'SMALLINT':
                        value = parseInt(String(value), 10)
                        if (isNaN(value as number)) value = null
                        break
                      case 'DECIMAL':
                      case 'FLOAT':
                      case 'DOUBLE':
                      case 'REAL':
                      case 'NUMERIC':
                        value = parseFloat(String(value))
                        if (isNaN(value as number)) value = null
                        break
                      case 'BOOLEAN':
                      case 'BOOL':
                        const strVal = String(value).toLowerCase()
                        value = strVal === 'true' || strVal === '1' || strVal === 'yes'
                        break
                      case 'JSON':
                      case 'JSONB':
                        if (typeof value === 'string') {
                          try {
                            value = JSON.parse(value)
                          } catch {
                            // Keep as string if not valid JSON
                          }
                        }
                        break
                      default:
                        // Keep as string for TEXT, VARCHAR, etc.
                        value = String(value)
                    }
                  } else {
                    value = null
                  }

                  values[mapping.targetColumn] = value
                }
              }

              // Insert row
              const result = await driver.insertRow({
                table: tableName,
                values
              })

              if (result.success) {
                insertedRows++
              } else if (result.error) {
                errors.push(`Row ${i + batch.indexOf(row) + 1}: ${result.error}`)
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              errors.push(`Row ${i + batch.indexOf(row) + 1}: ${errorMsg}`)
            }
          }
        }

        logger.info('Import completed', {
          tableName,
          totalRows: data.length,
          insertedRows,
          errorCount: errors.length
        })

        return {
          success: errors.length === 0,
          insertedRows,
          errors: errors.slice(0, 100), // Limit error messages
          filePath
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Import failed', { error: errorMessage })
        return { success: false, errors: [errorMessage] }
      }
    }
  )

  // Get table columns for mapping
  ipcMain.handle(
    'import:getTableColumns',
    async (_, connectionId: string, tableName: string) => {
      logger.debug('IPC: import:getTableColumns', { connectionId, tableName })

      try {
        const driver = connectionManager.getConnection(connectionId)
        if (!driver) {
          throw new Error('Not connected to database')
        }

        const columns = await driver.getColumns(tableName)
        return { columns }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to get table columns', { error: errorMessage })
        return { columns: [], error: errorMessage }
      }
    }
  )
}
