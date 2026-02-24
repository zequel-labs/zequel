import { ipcMain } from 'electron'
import { logger } from '@main/utils/logger'
import { backupService } from '@main/services/backup'
import { settingsService } from '@main/services/settings'
import { connectionsService } from '@main/services/connections'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { DatabaseType, TableObjectType, type SavedConnection, type BackupConfig, type RestoreConfig, type BackupEntity, BackupEntityType } from '@main/types'

const VALID_DB_TYPES = new Set(Object.values(DatabaseType))

const validateDbType = (dbType: unknown): void => {
  if (typeof dbType !== 'string' || !VALID_DB_TYPES.has(dbType as DatabaseType)) {
    throw new Error('Invalid database type')
  }
}

function validateBackupConfig(config: unknown): asserts config is BackupConfig {
  if (!config || typeof config !== 'object') throw new Error('Invalid backup config')
  const c = config as Record<string, unknown>
  if (typeof c.connectionId !== 'string' || !c.connectionId) throw new Error('Invalid connectionId')
  if (typeof c.outputPath !== 'string' || !c.outputPath) throw new Error('Invalid outputPath')
  if (typeof c.binaryPath !== 'string' || !c.binaryPath) throw new Error('Invalid binaryPath')
  if (!c.binaryPath.startsWith('/') && !/^[A-Za-z]:\\/.test(c.binaryPath as string)) {
    throw new Error('binaryPath must be an absolute path')
  }
}

function validateRestoreConfig(config: unknown): asserts config is RestoreConfig {
  if (!config || typeof config !== 'object') throw new Error('Invalid restore config')
  const c = config as Record<string, unknown>
  if (typeof c.connectionId !== 'string' || !c.connectionId) throw new Error('Invalid connectionId')
  if (typeof c.inputPath !== 'string' || !c.inputPath) throw new Error('Invalid inputPath')
  if (!c.inputPath.startsWith('/') && !/^[A-Za-z]:\\/.test(c.inputPath as string)) {
    throw new Error('inputPath must be an absolute path')
  }
  if (typeof c.binaryPath !== 'string' || !c.binaryPath) throw new Error('Invalid binaryPath')
  if (!c.binaryPath.startsWith('/') && !/^[A-Za-z]:\\/.test(c.binaryPath as string)) {
    throw new Error('binaryPath must be an absolute path')
  }
}

/** System schemas that should not be included in backup entity lists. */
const SYSTEM_SCHEMAS: Record<string, Set<string>> = {
  [DatabaseType.PostgreSQL]: new Set(['information_schema', 'pg_catalog', 'pg_toast']),
  [DatabaseType.MySQL]: new Set(['information_schema', 'performance_schema', 'mysql', 'sys']),
  [DatabaseType.MariaDB]: new Set(['information_schema', 'performance_schema', 'mysql', 'sys']),
  [DatabaseType.SQLServer]: new Set(['sys', 'INFORMATION_SCHEMA', 'guest']),
}

/** Resolve a connection config from either saved connections or the active connection manager.
 *  The connectionId parameter is a sessionId (UUID) from the renderer. */
const resolveConnection = (sessionId: string): SavedConnection => {
  // Resolve the persistent saved connection ID from the session
  const savedId = connectionManager.getSavedConnectionId(sessionId)

  if (savedId) {
    const saved = connectionsService.get(savedId)
    if (saved) {
      // If the saved connection has no database, fall back to the active connection config
      if (!saved.database) {
        const activeConfig = connectionManager.getConnectionConfig(sessionId)
        if (activeConfig?.database) {
          return { ...saved, database: activeConfig.database }
        }
      }
      return saved
    }
  }

  // Fallback: connection was established via connectWithConfig (not saved)
  const config = connectionManager.getConnectionConfig(sessionId)
  if (config) {
    return {
      id: sessionId,
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
      trustServerCertificate: config.trustServerCertificate,
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

/** Resolve the password for a connection session.
 *  Checks keychain first (for saved connections), then falls back to the
 *  in-memory config (for connectWithConfig connections). */
const resolvePassword = async (sessionId: string): Promise<string | null> => {
  const { keychainService } = await import('@main/services/keychain')
  const keychainId = connectionManager.getSavedConnectionId(sessionId) || sessionId
  const password = await keychainService.getPassword(keychainId)
  if (password) return password
  // Fallback for connectWithConfig connections (password not in keychain)
  return connectionManager.getConnectionConfig(sessionId)?.password ?? null
}

export const registerBackupHandlers = (): void => {
  // ── Backup handlers ─────────────────────────────────────────────────────

  ipcMain.handle(
    'nativeBackup:detectBinary',
    async (_event, connectionId: string) => {
      if (typeof connectionId !== 'string' || !connectionId) throw new Error('Invalid connectionId')
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
            type: table.type === TableObjectType.View ? BackupEntityType.View : BackupEntityType.Table,
          })
        }
      }

      return entities
    }
  )

  ipcMain.handle(
    'nativeBackup:buildCommand',
    async (_event, config: BackupConfig) => {
      validateBackupConfig(config)
      logger.debug('IPC: nativeBackup:buildCommand', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      const password = await resolvePassword(config.connectionId)

      return backupService.buildBackupCommand(config, conn, password)
    }
  )

  ipcMain.handle(
    'nativeBackup:execute',
    async (event, config: BackupConfig) => {
      validateBackupConfig(config)
      logger.debug('IPC: nativeBackup:execute', { connectionId: config.connectionId })

      const ownerId = windowManager.getSessionOwner(config.connectionId)
      if (ownerId !== undefined && ownerId !== event.sender.id) {
        throw new Error('Not authorized to backup this connection')
      }

      const conn = resolveConnection(config.connectionId)
      const password = await resolvePassword(config.connectionId)
      return backupService.executeBackup(config, conn, password, event.sender.id)
    }
  )

  ipcMain.handle(
    'nativeBackup:cancel',
    async (_event, operationId: string) => {
      if (typeof operationId !== 'string' || !operationId) throw new Error('Invalid operation ID')
      logger.debug('IPC: nativeBackup:cancel', { operationId })
      return backupService.cancelOperation(operationId)
    }
  )

  ipcMain.handle(
    'nativeBackup:getBinaryPath',
    async (_event, dbType: DatabaseType) => {
      validateDbType(dbType)
      logger.debug('IPC: nativeBackup:getBinaryPath', { dbType })
      return settingsService.get(`backup.binary.${dbType}`)
    }
  )

  ipcMain.handle(
    'nativeBackup:saveBinaryPath',
    async (_event, dbType: DatabaseType, path: string) => {
      validateDbType(dbType)
      if (typeof path !== 'string' || !path) throw new Error('Invalid binary path')
      logger.debug('IPC: nativeBackup:saveBinaryPath', { dbType, path })
      settingsService.set(`backup.binary.${dbType}`, path)
      return true
    }
  )

  // ── Restore handlers ────────────────────────────────────────────────────

  ipcMain.handle(
    'nativeRestore:detectBinary',
    async (_event, connectionId: string) => {
      if (typeof connectionId !== 'string' || !connectionId) throw new Error('Invalid connectionId')
      logger.debug('IPC: nativeRestore:detectBinary', { connectionId })
      const conn = resolveConnection(connectionId)
      return backupService.detectRestoreBinary(conn.type)
    }
  )

  ipcMain.handle(
    'nativeRestore:buildCommand',
    async (_event, config: RestoreConfig) => {
      validateRestoreConfig(config)
      logger.debug('IPC: nativeRestore:buildCommand', { connectionId: config.connectionId })

      const conn = resolveConnection(config.connectionId)
      const password = await resolvePassword(config.connectionId)

      return backupService.buildRestoreCommand(config, conn, password)
    }
  )

  ipcMain.handle(
    'nativeRestore:execute',
    async (event, config: RestoreConfig) => {
      validateRestoreConfig(config)
      logger.debug('IPC: nativeRestore:execute', { connectionId: config.connectionId })

      const ownerId = windowManager.getSessionOwner(config.connectionId)
      if (ownerId !== undefined && ownerId !== event.sender.id) {
        throw new Error('Not authorized to restore this connection')
      }

      const conn = resolveConnection(config.connectionId)
      const password = await resolvePassword(config.connectionId)
      return backupService.executeRestore(config, conn, password, event.sender.id)
    }
  )

  ipcMain.handle(
    'nativeRestore:cancel',
    async (_event, operationId: string) => {
      if (typeof operationId !== 'string' || !operationId) throw new Error('Invalid operation ID')
      logger.debug('IPC: nativeRestore:cancel', { operationId })
      return backupService.cancelOperation(operationId)
    }
  )

  ipcMain.handle(
    'nativeRestore:getBinaryPath',
    async (_event, dbType: DatabaseType) => {
      validateDbType(dbType)
      logger.debug('IPC: nativeRestore:getBinaryPath', { dbType })
      return settingsService.get(`restore.binary.${dbType}`)
    }
  )

  ipcMain.handle(
    'nativeRestore:saveBinaryPath',
    async (_event, dbType: DatabaseType, path: string) => {
      validateDbType(dbType)
      if (typeof path !== 'string' || !path) throw new Error('Invalid binary path')
      logger.debug('IPC: nativeRestore:saveBinaryPath', { dbType, path })
      settingsService.set(`restore.binary.${dbType}`, path)
      return true
    }
  )
}
