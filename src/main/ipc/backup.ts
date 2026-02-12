import { ipcMain } from 'electron'
import { logger } from '@main/utils/logger'
import { backupService } from '@main/services/backup'
import { settingsService } from '@main/services/settings'
import { connectionsService } from '@main/services/connections'
import { connectionManager } from '@main/db/manager'
import { DatabaseType, type SavedConnection, type BackupConfig, type RestoreConfig, type BackupEntity, BackupEntityType } from '@main/types'

/** System schemas that should not be included in backup entity lists. */
const SYSTEM_SCHEMAS: Record<string, Set<string>> = {
  [DatabaseType.PostgreSQL]: new Set(['information_schema', 'pg_catalog', 'pg_toast']),
  [DatabaseType.MySQL]: new Set(['information_schema', 'performance_schema', 'mysql', 'sys']),
  [DatabaseType.MariaDB]: new Set(['information_schema', 'performance_schema', 'mysql', 'sys']),
}

/** Resolve a connection config from either saved connections or the active connection manager. */
const resolveConnection = (connectionId: string): SavedConnection => {
  const saved = connectionsService.get(connectionId)
  if (saved) {
    // If the saved connection has no database, fall back to the active connection config
    if (!saved.database) {
      const activeConfig = connectionManager.getConnectionConfig(connectionId)
      if (activeConfig?.database) {
        return { ...saved, database: activeConfig.database }
      }
    }
    return saved
  }

  // Fallback: connection was established via connectWithConfig (not saved)
  const config = connectionManager.getConnectionConfig(connectionId)
  if (config) {
    return {
      id: connectionId,
      name: config.name || '',
      type: config.type,
      host: config.host ?? null,
      port: config.port ?? null,
      database: config.database,
      username: config.username ?? null,
      filepath: config.filepath ?? null,
      ssl: config.ssl ?? false,
      sslConfig: config.sslConfig ?? null,
      ssh: config.ssh ?? null,
      color: config.color ?? null,
      environment: config.environment ?? null,
      folder: config.folder ?? null,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastConnectedAt: new Date().toISOString(),
    }
  }

  throw new Error('Connection not found')
}

export const registerBackupHandlers = (): void => {
  // ── Backup handlers ─────────────────────────────────────────────────────

  ipcMain.handle(
    'nativeBackup:detectBinary',
    async (_event, connectionId: string) => {
      logger.debug('IPC: nativeBackup:detectBinary', { connectionId })
      const conn = resolveConnection(connectionId)
      return backupService.detectBackupBinary(conn.type)
    }
  )

  ipcMain.handle(
    'nativeBackup:getEntities',
    async (_event, connectionId: string) => {
      logger.debug('IPC: nativeBackup:getEntities', { connectionId })

      const driver = connectionManager.getConnection(connectionId)
      if (!driver) throw new Error('Not connected to database')

      const conn = resolveConnection(connectionId)
      const entities: BackupEntity[] = []

      if (conn.type === DatabaseType.Redis) {
        entities.push({ name: 'Full Database', type: BackupEntityType.Database })
      } else if (conn.type === DatabaseType.MongoDB) {
        const collections = await driver.getTables(conn.database, '')
        for (const coll of collections) {
          entities.push({ name: coll.name, type: BackupEntityType.Collection })
        }
      } else {
        const tables = await driver.getTables(conn.database || '', '')
        const systemSchemas = SYSTEM_SCHEMAS[conn.type]
        for (const table of tables) {
          // Skip system schema entities — they are not dumpable
          if (systemSchemas && table.schema && systemSchemas.has(table.schema)) continue
          entities.push({
            name: table.name,
            schema: table.schema,
            type: table.type === 'view' ? BackupEntityType.View : BackupEntityType.Table,
          })
        }
      }

      return entities
    }
  )

  ipcMain.handle(
    'nativeBackup:buildCommand',
    async (_event, config: BackupConfig) => {
      logger.debug('IPC: nativeBackup:buildCommand', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      const { keychainService } = await import('@main/services/keychain')
      const password = await keychainService.getPassword(config.connectionId)

      return backupService.buildBackupCommand(config, conn, password)
    }
  )

  ipcMain.handle(
    'nativeBackup:execute',
    async (_event, config: BackupConfig) => {
      logger.debug('IPC: nativeBackup:execute', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      return backupService.executeBackup(config, conn)
    }
  )

  ipcMain.handle(
    'nativeBackup:cancel',
    async (_event, operationId: string) => {
      logger.debug('IPC: nativeBackup:cancel', { operationId })
      return backupService.cancelOperation(operationId)
    }
  )

  ipcMain.handle(
    'nativeBackup:getBinaryPath',
    async (_event, dbType: DatabaseType) => {
      logger.debug('IPC: nativeBackup:getBinaryPath', { dbType })
      return settingsService.get(`backup.binary.${dbType}`)
    }
  )

  ipcMain.handle(
    'nativeBackup:saveBinaryPath',
    async (_event, dbType: DatabaseType, path: string) => {
      logger.debug('IPC: nativeBackup:saveBinaryPath', { dbType, path })
      settingsService.set(`backup.binary.${dbType}`, path)
      return true
    }
  )

  // ── Restore handlers ────────────────────────────────────────────────────

  ipcMain.handle(
    'nativeRestore:detectBinary',
    async (_event, connectionId: string) => {
      logger.debug('IPC: nativeRestore:detectBinary', { connectionId })
      const conn = resolveConnection(connectionId)
      return backupService.detectRestoreBinary(conn.type)
    }
  )

  ipcMain.handle(
    'nativeRestore:buildCommand',
    async (_event, config: RestoreConfig) => {
      logger.debug('IPC: nativeRestore:buildCommand', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      const { keychainService } = await import('@main/services/keychain')
      const password = await keychainService.getPassword(config.connectionId)

      return backupService.buildRestoreCommand(config, conn, password)
    }
  )

  ipcMain.handle(
    'nativeRestore:execute',
    async (_event, config: RestoreConfig) => {
      logger.debug('IPC: nativeRestore:execute', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      return backupService.executeRestore(config, conn)
    }
  )

  ipcMain.handle(
    'nativeRestore:cancel',
    async (_event, operationId: string) => {
      logger.debug('IPC: nativeRestore:cancel', { operationId })
      return backupService.cancelOperation(operationId)
    }
  )

  ipcMain.handle(
    'nativeRestore:getBinaryPath',
    async (_event, dbType: DatabaseType) => {
      logger.debug('IPC: nativeRestore:getBinaryPath', { dbType })
      return settingsService.get(`restore.binary.${dbType}`)
    }
  )

  ipcMain.handle(
    'nativeRestore:saveBinaryPath',
    async (_event, dbType: DatabaseType, path: string) => {
      logger.debug('IPC: nativeRestore:saveBinaryPath', { dbType, path })
      settingsService.set(`restore.binary.${dbType}`, path)
      return true
    }
  )
}
