import { validateTransferRequest } from '@main/services/backup/capabilities'
import { rowTransfers } from '@main/services/row-transfer'
import { resolveSqlServerRestoreFiles } from '@main/services/backup/sqlserver-files'
import { stat } from 'node:fs/promises'
import { ipcMain } from 'electron'
import { isAbsolute } from 'node:path'
import { connectionsService } from '@main/services/connections'
import { keychainService } from '@main/services/keychain'
import { settingsService } from '@main/services/settings'
import { backupService } from '@main/services/backup'
import { createOperationContext } from '@main/services/backup/OperationContext'
import { windowManager } from '@main/services/windowManager'
import { DatabaseType, type SavedConnection, type TransferRequest } from '@main/types'

const activeTargets = new Set<string>()
const connectionPassword = (connection: SavedConnection): Promise<string | null> =>
  [DatabaseType.SQLite, DatabaseType.DuckDB].includes(connection.type)
    ? Promise.resolve(null) : keychainService.getPassword(connection.id)

const savedConnection = (id: string): SavedConnection => {
  if (typeof id !== 'string' || !id) throw new Error('Choose a connection')
  const connection = connectionsService.get(id)
  if (!connection) throw new Error('This connection no longer exists')
  return connection
}

export const registerTransferHandlers = (): void => {
  ipcMain.handle('transfers:createDatabase', async (_event, id: string, name: string) => {
    const connection = savedConnection(id)
    if (typeof name !== 'string' || !name.trim() || name.includes('\0')) throw new Error('Enter a database name')
    // These engines create the destination as part of restore. Creating an empty
    // SQL Server database here would unnecessarily require destructive REPLACE.
    if ([DatabaseType.MongoDB, DatabaseType.SQLServer].includes(connection.type)) return
    const supported = [DatabaseType.PostgreSQL, DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.ClickHouse, DatabaseType.SQLServer]
    if (!supported.includes(connection.type)) throw new Error('Creating a database is not supported for this connection')
    const password = await connectionPassword(connection)
    const database = connection.type === DatabaseType.PostgreSQL ? 'postgres'
      : connection.type === DatabaseType.SQLServer ? 'master' : connection.database
    const context = await createOperationContext({ ...connection, database }, password, true)
    try {
      const quoted = connection.type === DatabaseType.SQLServer ? `[${name.replace(/]/g, ']]')}]`
        : [DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.ClickHouse].includes(connection.type) ? `\`${name.replace(/`/g, '``')}\``
          : `"${name.replace(/"/g, '""')}"`
      const result = await context.driver!.execute(`CREATE DATABASE ${quoted}`)
      if (result.error) throw new Error(result.error)
    } finally { await context.close() }
  })

  ipcMain.handle('transfers:open', (_event, mode: string, id?: string, database?: string) => {
    if (mode !== 'backup' && mode !== 'restore') throw new Error('Invalid operation')
    windowManager.openNewWindow({ adoptSessionId: '', savedConnectionId: id || '', operation: mode, activeDatabase: typeof database === 'string' ? database : undefined })
  })

  ipcMain.handle('transfers:databases', async (_event, id: string) => {
    const connection = savedConnection(id)
    if ([DatabaseType.SQLite, DatabaseType.DuckDB].includes(connection.type)) return [{ name: connection.filepath || connection.database }]
    const password = await connectionPassword(connection)
    const database = connection.type === DatabaseType.PostgreSQL ? 'postgres'
      : connection.type === DatabaseType.SQLServer ? 'master'
        : connection.database
    const context = await createOperationContext({ ...connection, database }, password, true)
    try {
      return await context.driver!.getDatabases()
    } finally {
      await context.close()
    }
  })

  ipcMain.handle('transfers:tool', (_event, id: string, mode: string) => {
    const connection = savedConnection(id)
    if (backupService.usesDriverPath(connection.type)) {
      return { path: null, found: true, version: null, warning: null }
    }
    if (mode !== 'backup' && mode !== 'restore') throw new Error('Invalid operation')
    const previousPath = settingsService.get(`${mode}.binary.${connection.type}`)
    const info = mode === 'backup' ? backupService.detectBackupBinary(connection.type) : backupService.detectRestoreBinary(connection.type)
    return { ...info, ...(typeof previousPath === 'string' && isAbsolute(previousPath) ? { previousPath } : {}) }
  })

  ipcMain.handle('transfers:rows', () => rowTransfers.list())
  ipcMain.handle('transfers:cancelRow', (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid operation')
    rowTransfers.cancelOperation(id)
  })
  ipcMain.handle('transfers:list', () => backupService.listOperations())
  ipcMain.handle('transfers:get', (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid operation')
    return backupService.getOperation(id)
  })
  ipcMain.handle('transfers:cancel', (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid operation')
    return backupService.cancelOperation(id)
  })

  ipcMain.handle('transfers:start', async (event, request: TransferRequest) => {
    if (!request || !['backup', 'restore'].includes(request.mode)) throw new Error('Invalid operation')
    const connection = savedConnection(request.savedConnectionId)
    if (typeof request.database !== 'string' || !request.database.trim()) throw new Error('Choose a database')
    if (typeof request.path !== 'string' || !request.path) throw new Error('Choose a file')
    if (connection.type !== DatabaseType.SQLServer && !isAbsolute(request.path)) throw new Error('Choose an absolute file path')
    validateTransferRequest(connection.type, request)
    const usesDriver = backupService.usesDriverPath(connection.type)
    const binary = request.binaryPath || (request.mode === 'backup'
      ? backupService.detectBackupBinary(connection.type).path
      : backupService.detectRestoreBinary(connection.type).path) || ''
    if (!usesDriver && !binary) throw new Error('The database tools are unavailable. Repair or update Zequel.')
    if (binary && !isAbsolute(binary)) throw new Error('Invalid tool path')
    const fileDatabase = [DatabaseType.SQLite, DatabaseType.DuckDB].includes(connection.type)
    if (fileDatabase && !isAbsolute(request.database)) throw new Error('Choose an absolute database file path')
    const target = JSON.stringify([connection.type, connection.host, connection.port, request.database])
    if (activeTargets.has(target)) throw new Error('Another operation is already using this database. Wait for it to finish.')
    activeTargets.add(target)
    let context: Awaited<ReturnType<typeof createOperationContext>> | undefined
    const release = async (): Promise<void> => {
      try { await context?.close() } finally { activeTargets.delete(target) }
    }
    return backupService.prepareTransfer(request.mode, { ...connection, database: request.database }, event.sender.id, async signal => {
      const password = await connectionPassword(connection)
      signal.throwIfAborted()
      if (connection.type === DatabaseType.SQLServer && request.mode === 'restore') {
        const inspection = await createOperationContext({ ...connection, database: 'master' }, password, true)
        try {
          const fileMoves = await resolveSqlServerRestoreFiles(inspection.driver!, request.path, request.database, request.options?.replace === true)
          request = { ...request, options: { ...request.options, fileMoves } }
        } finally { await inspection.close() }
        signal.throwIfAborted()
      }
      context = await createOperationContext({ ...connection, database: request.database, ...(fileDatabase ? { filepath: request.database } : {}) }, password, usesDriver || connection.type === DatabaseType.PostgreSQL)
      signal.throwIfAborted()
      const isDirectory = request.mode === 'restore' && connection.type !== DatabaseType.SQLServer && (await stat(request.path)).isDirectory()
      return operationId => {
        if (request.mode === 'backup') {
          backupService.executeBackup({
            connectionId: context!.id, outputPath: request.path, binaryPath: binary,
            entities: [], customArgs: '', compress: request.compress === true,
            options: request.options || {},
          }, context!.connection, password, event.sender.id, context!.driver, release, operationId)
        } else {
          backupService.executeRestore({
            connectionId: context!.id, inputPath: request.path, binaryPath: binary,
            targetDatabase: request.database, isDirectory,
            customArgs: '', options: request.options || {},
          }, context!.connection, password, event.sender.id, context!.driver, release, operationId)
        }
      }
    }, release)
  })
}
