import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { connectionsService } from '../services/connections'
import { keychainService } from '../services/keychain'
import { logger } from '../utils/logger'
import type { ConnectionConfig } from '../types'

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

    // Save password to keychain if provided
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

    // Disconnect if connected
    await connectionManager.disconnect(id)

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

  ipcMain.handle('connection:connect', async (_, id: string) => {
    logger.debug('IPC: connection:connect', { id })

    try {
      const savedConnection = connectionsService.get(id)
      if (!savedConnection) {
        throw new Error('Connection not found')
      }

      // Get password from keychain
      const password = await keychainService.getPassword(id)

      const config: ConnectionConfig = {
        id: savedConnection.id,
        name: savedConnection.name,
        type: savedConnection.type,
        database: savedConnection.database,
        host: savedConnection.host || undefined,
        port: savedConnection.port || undefined,
        username: savedConnection.username || undefined,
        password: password || undefined,
        ssl: savedConnection.ssl,
        sslConfig: savedConnection.sslConfig || undefined,
        ssh: savedConnection.ssh || undefined,
        filepath: savedConnection.filepath || undefined,
        environment: savedConnection.environment || undefined
      }

      await connectionManager.connect(config)
      connectionsService.updateLastConnected(id)

      return true
    } catch (error) {
      logger.error('Connection failed', error)
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

  ipcMain.handle('connection:connectWithDatabase', async (_, id: string, database: string) => {
    logger.debug('IPC: connection:connectWithDatabase', { id, database })

    try {
      const savedConnection = connectionsService.get(id)
      if (!savedConnection) {
        throw new Error('Connection not found')
      }

      // Disconnect existing connection first
      await connectionManager.disconnect(id)

      // Get password from keychain
      const password = await keychainService.getPassword(id)

      // Build config with overridden database — do NOT save to disk
      const config: ConnectionConfig = {
        id: savedConnection.id,
        name: savedConnection.name,
        type: savedConnection.type,
        database,
        host: savedConnection.host || undefined,
        port: savedConnection.port || undefined,
        username: savedConnection.username || undefined,
        password: password || undefined,
        ssl: savedConnection.ssl,
        sslConfig: savedConnection.sslConfig || undefined,
        ssh: savedConnection.ssh || undefined,
        filepath: savedConnection.filepath || undefined,
        environment: savedConnection.environment || undefined
      }

      await connectionManager.connect(config)
      return true
    } catch (error) {
      logger.error('Connection with database override failed', error)
      throw error
    }
  })

  ipcMain.handle('connection:disconnect', async (_, id: string) => {
    logger.debug('IPC: connection:disconnect', { id })
    return connectionManager.disconnect(id)
  })

  ipcMain.handle('connection:reconnect', async (_, id: string) => {
    logger.debug('IPC: connection:reconnect', { id })
    return connectionManager.reconnect(id)
  })
}
