import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { logger } from '../utils/logger'
import { connectionManager } from '../db/manager'

export interface ExportOptions {
  format: 'csv' | 'json' | 'sql'
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

export function registerExportHandlers(): void {
  ipcMain.handle(
    'export:toFile',
    async (event, options: ExportOptions): Promise<ExportResult> => {
      logger.debug('IPC: export:toFile', { format: options.format, rowCount: options.rows.length })

      try {
        // Determine file extension and content
        let content: string
        let defaultExtension: string
        let filterName: string

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

        // Get all tables
        const tables = await driver.getTables('', '')
        const actualTables = tables.filter((t) => t.type === 'table')

        // Generate SQL dump
        const lines: string[] = []
        lines.push('-- Database Backup')
        lines.push(`-- Generated: ${new Date().toISOString()}`)
        lines.push('')

        for (const table of actualTables) {
          // Add table DDL
          try {
            const ddl = await driver.getTableDDL(table.name)
            lines.push(`-- Table: ${table.name}`)
            lines.push(`DROP TABLE IF EXISTS "${table.name}";`)
            lines.push(ddl + ';')
            lines.push('')

            // Add data
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

        const content = lines.join('\n')

        // Get the focused window for the dialog
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
        }

        // Show save dialog
        const result = await dialog.showSaveDialog(window, {
          title: 'Export Database Backup',
          defaultPath: `backup_${new Date().toISOString().split('T')[0]}.sql`,
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        })

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export canceled' }
        }

        await writeFile(result.filePath, content, 'utf-8')

        logger.info('Database backup successful', { filePath: result.filePath })
        return { success: true, filePath: result.filePath }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Database backup failed', { error: errorMessage })
        return { success: false, error: errorMessage }
      }
    }
  )

  // Import SQL file
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

        // Get the focused window for the dialog
        const window = BrowserWindow.getFocusedWindow()
        if (!window) {
          throw new Error('No focused window')
        }

        // Show open dialog
        const result = await dialog.showOpenDialog(window, {
          title: 'Import SQL File',
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ],
          properties: ['openFile']
        })

        if (result.canceled || !result.filePaths.length) {
          return { success: false, statements: 0, errors: ['Import canceled'] }
        }

        const filePath = result.filePaths[0]
        const content = await readFile(filePath, 'utf-8')

        // Split SQL content into statements (basic splitting by semicolon)
        // This is a simplified approach - a real implementation would need a proper SQL parser
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

        logger.info('Database import completed', { filePath, successCount, errorCount: errors.length })
        return {
          success: errors.length === 0,
          statements: successCount,
          errors,
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
