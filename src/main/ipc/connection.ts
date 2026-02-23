import { ipcMain } from 'electron'
import { connectionManager } from '@main/db/manager'
import { connectionsService } from '@main/services/connections'
import { keychainService } from '@main/services/keychain'
import { windowManager } from '@main/services/windowManager'
import { logger } from '@main/utils/logger'
import { DatabaseType } from '@main/types'
import type { ConnectionConfig } from '@main/types'

const buildConfigFromSaved = async (id: string, databaseOverride?: string): Promise<ConnectionConfig> => {
  const savedConnection = connectionsService.get(id)
  if (!savedConnection) {
    throw new Error('Connection not found')
  }

  const password = await keychainService.getPassword(id)

  return {
    id: savedConnection.id,
    name: savedConnection.name,
    type: savedConnection.type,
    database: databaseOverride ?? savedConnection.database,
    host: savedConnection.host || undefined,
    port: savedConnection.port || undefined,
    username: savedConnection.username || undefined,
    password: password || undefined,
    ssl: savedConnection.ssl,
    sslConfig: savedConnection.sslConfig || undefined,
    ssh: savedConnection.ssh || undefined,
    filepath: savedConnection.filepath || undefined,
    environment: savedConnection.environment || undefined,
    trustServerCertificate: savedConnection.trustServerCertificate
  }
}

export const registerConnectionHandlers = (): void => {
  ipcMain.handle('connection:list', async () => {
    logger.debug('IPC: connection:list')
    const result = connectionsService.list()
    // Return plain objects to avoid serialization issues
    return JSON.parse(JSON.stringify(result))
  })

  ipcMain.handle('connection:get', async (_, id: string) => {
    logger.debug('IPC: connection:get', { id })
    const result = connectionsService.get(id)
    return result ? JSON.parse(JSON.stringify(result)) : null
  })

  ipcMain.handle('connection:save', async (_, config: ConnectionConfig) => {
    // Clone to plain object to avoid serialization issues
    const plainConfig = JSON.parse(JSON.stringify(config)) as ConnectionConfig
    logger.debug('IPC: connection:save', { id: plainConfig.id, name: plainConfig.name })

    // Save password to keychain if provided (skip if absent — the renderer
    // doesn't re-send the password when editing other connection fields)
    if (plainConfig.password) {
      logger.info('Saving password to keychain', { id: plainConfig.id, passwordLength: plainConfig.password.length })
      await keychainService.setPassword(plainConfig.id, plainConfig.password)
    } else {
      logger.info('No password provided, skipping keychain save', { id: plainConfig.id })
    }

    const result = connectionsService.save(plainConfig)
    // Return plain object
    return JSON.parse(JSON.stringify(result))
  })

  ipcMain.handle('connection:delete', async (_, id: string) => {
    logger.debug('IPC: connection:delete', { id })

    // Disconnect all sessions for this saved connection
    const sessions = connectionManager.getSessionsForSavedConnection(id)
    for (const sessionId of sessions) {
      windowManager.removeSessionOwner(sessionId)
      await connectionManager.disconnect(sessionId)
    }

    // Delete password from keychain
    await keychainService.deletePassword(id)

    return connectionsService.delete(id)
  })

  ipcMain.handle('connection:test', async (_, config: ConnectionConfig) => {
    // Clone to plain object to avoid serialization issues
    const plainConfig = JSON.parse(JSON.stringify(config)) as ConnectionConfig
    logger.debug('IPC: connection:test', { type: plainConfig.type })

    try {
      // Get password from keychain if not provided
      let password = plainConfig.password
      if (!password && plainConfig.id) {
        password = (await keychainService.getPassword(plainConfig.id)) || undefined
        logger.info('Password from keychain', { id: plainConfig.id, found: !!password, passwordLength: password?.length || 0 })
      } else {
        logger.info('Password from form', { passwordLength: password?.length || 0 })
      }

      const testConfig = { ...plainConfig, password }
      const result = await connectionManager.testConnection(testConfig)
      logger.debug('Connection test result', result)
      // Return a plain object to avoid serialization issues
      return JSON.parse(JSON.stringify(result))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('Connection test failed', errorMsg)
      return { success: false, error: errorMsg }
    }
  })

  ipcMain.handle('connection:connect', async (event, id: string) => {
    logger.debug('IPC: connection:connect', { id })

    try {
      const config = await buildConfigFromSaved(id)
      const sessionId = await connectionManager.connect(config)
      connectionsService.updateLastConnected(id)
      windowManager.setSessionOwner(sessionId, event.sender.id)

      return sessionId
    } catch (error) {
      logger.error('Connection failed', error)
      throw error
    }
  })

  ipcMain.handle('connection:connectWithConfig', async (event, config: ConnectionConfig) => {
    const plainConfig = JSON.parse(JSON.stringify(config)) as ConnectionConfig
    logger.debug('IPC: connection:connectWithConfig', { id: plainConfig.id, type: plainConfig.type })

    try {
      let password = plainConfig.password
      if (!password && plainConfig.id) {
        password = (await keychainService.getPassword(plainConfig.id)) || undefined
      }

      const fullConfig = { ...plainConfig, password }
      const sessionId = await connectionManager.connect(fullConfig)
      windowManager.setSessionOwner(sessionId, event.sender.id)
      return sessionId
    } catch (error) {
      logger.error('Connection with config failed', error)
      throw error
    }
  })

  ipcMain.handle('connection:updateFolder', async (_, id: string, folder: string | null) => {
    logger.debug('IPC: connection:updateFolder', { id, folder })
    connectionsService.updateFolder(id, folder)
    return true
  })

  ipcMain.handle('connection:getFolders', async () => {
    logger.debug('IPC: connection:getFolders')
    return connectionsService.getFolders()
  })

  ipcMain.handle('connection:renameFolder', async (_, oldName: string, newName: string) => {
    logger.debug('IPC: connection:renameFolder', { oldName, newName })
    connectionsService.renameFolder(oldName, newName)
    return true
  })

  ipcMain.handle('connection:deleteFolder', async (_, folder: string) => {
    logger.debug('IPC: connection:deleteFolder', { folder })
    connectionsService.deleteFolder(folder)
    return true
  })

  ipcMain.handle('connection:updatePositions', async (_, positions: { id: string; sortOrder: number; folder: string | null }[]) => {
    logger.debug('IPC: connection:updatePositions', { count: positions.length })
    connectionsService.updatePositions(positions)
    return true
  })

  ipcMain.handle('connection:connectWithDatabase', async (event, sessionId: string, database: string) => {
    logger.debug('IPC: connection:connectWithDatabase', { sessionId, database })

    try {
      const savedId = connectionManager.getSavedConnectionId(sessionId)
      let config: ConnectionConfig

      if (savedId) {
        config = await buildConfigFromSaved(savedId, database)
      } else {
        // Fallback for unsaved/ad-hoc connections
        const existing = connectionManager.getConnectionConfig(sessionId)
        if (!existing) throw new Error('Session not found')
        config = { ...existing, database }
      }

      const newSessionId = await connectionManager.connect(config)

      try {
        windowManager.removeSessionOwner(sessionId)
        windowManager.setSessionOwner(newSessionId, event.sender.id)

        try {
          await connectionManager.disconnect(sessionId)
        } catch (err) {
          logger.warn('Failed to disconnect old session during database switch', { sessionId, error: err })
        }
      } catch (err) {
        connectionManager.disconnect(newSessionId).catch(() => {})
        throw err
      }

      return newSessionId
    } catch (error) {
      logger.error('Connection with database override failed', error)
      throw error
    }
  })

  ipcMain.handle('connection:disconnect', async (event, id: string) => {
    logger.debug('IPC: connection:disconnect', { id })
    const ownerId = windowManager.getSessionOwner(id)
    if (ownerId !== undefined && ownerId !== event.sender.id && !windowManager.isSessionInTransfer(id)) {
      throw new Error('Not authorized to disconnect this session')
    }
    windowManager.removeSessionOwner(id)
    return connectionManager.disconnect(id)
  })

  ipcMain.handle('connection:reconnect', async (event, id: string) => {
    logger.debug('IPC: connection:reconnect', { id })
    const ownerId = windowManager.getSessionOwner(id)
    if (ownerId !== undefined && ownerId !== event.sender.id && !windowManager.isSessionInTransfer(id)) {
      throw new Error('Not authorized to reconnect this session')
    }
    return connectionManager.reconnect(id)
  })

  ipcMain.handle('connection:getServerVersion', async (_, connectionId: string): Promise<string> => {
    const driver = connectionManager.getConnection(connectionId)
    if (!driver) throw new Error('Connection not found')

    try {
      if (driver.type === DatabaseType.SQLite) {
        const result = await driver.execute('SELECT sqlite_version() as version')
        return `SQLite ${result.rows[0]?.version ?? ''}`
      } else if (driver.type === DatabaseType.Redis) {
        const result = await driver.execute('INFO server')
        const raw = result.rows[0]?.value as string ?? ''
        const match = raw.match(/redis_version:(\S+)/)
        return match ? `Redis ${match[1]}` : 'Redis'
      } else if (driver.type === DatabaseType.MongoDB) {
        const result = await driver.execute('db.version()')
        const version = result.rows[0]?.version as string ?? ''
        return version ? `MongoDB ${version}` : 'MongoDB'
      } else if (driver.type === DatabaseType.PostgreSQL) {
        const result = await driver.execute('SELECT version()')
        const raw = result.rows[0]?.version as string ?? ''
        const match = raw.match(/^PostgreSQL\s+([\d.]+)/)
        return match ? `PostgreSQL ${match[1]}` : raw.split(' on ')[0] || 'PostgreSQL'
      } else if (driver.type === DatabaseType.MySQL || driver.type === DatabaseType.MariaDB) {
        const result = await driver.execute('SELECT version() as version')
        return result.rows[0]?.version as string ?? ''
      } else if (driver.type === DatabaseType.ClickHouse) {
        const result = await driver.execute('SELECT version() as version')
        return `ClickHouse ${result.rows[0]?.version ?? ''}`
      } else if (driver.type === DatabaseType.DuckDB) {
        const result = await driver.execute('SELECT version() as version')
        return `DuckDB ${result.rows[0]?.version ?? ''}`
      } else if (driver.type === DatabaseType.SQLServer) {
        const result = await driver.execute("SELECT SERVERPROPERTY('ProductVersion') AS version")
        return `SQL Server ${result.rows[0]?.version ?? ''}`
      }
      return ''
    } catch (error) {
      logger.error('Failed to get server version', error)
      return ''
    }
  })
}
