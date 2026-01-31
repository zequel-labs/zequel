import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { PostgreSQLDriver } from '../db/postgres'
import { logger } from '../utils/logger'
import { DatabaseType } from '../types'
import type {
  CreateSequenceRequest,
  DropSequenceRequest,
  AlterSequenceRequest,
  RefreshMaterializedViewRequest,
  CreateExtensionRequest,
  DropExtensionRequest
} from '../types/schema-operations'

function getPostgreSQLDriver(connectionId: string): PostgreSQLDriver {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  if (driver.type !== DatabaseType.PostgreSQL) {
    throw new Error('This operation is only available for PostgreSQL connections')
  }
  return driver as PostgreSQLDriver
}

export function registerPostgreSQLHandlers(): void {
  // Schema operations
  ipcMain.handle('schema:getSchemas', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getSchemas', { connectionId })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getSchemas()
  })

  ipcMain.handle('schema:setCurrentSchema', async (_, connectionId: string, schema: string) => {
    logger.debug('IPC: schema:setCurrentSchema', { connectionId, schema })
    const driver = getPostgreSQLDriver(connectionId)
    driver.setCurrentSchema(schema)
    return true
  })

  ipcMain.handle('schema:getCurrentSchema', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getCurrentSchema', { connectionId })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getCurrentSchema()
  })

  // Sequence operations
  ipcMain.handle('schema:getSequences', async (_, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getSequences', { connectionId, schema })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getSequences(schema)
  })

  ipcMain.handle('schema:getSequenceDetails', async (_, connectionId: string, sequenceName: string, schema?: string) => {
    logger.debug('IPC: schema:getSequenceDetails', { connectionId, sequenceName, schema })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getSequenceDetails(sequenceName, schema)
  })

  ipcMain.handle('schema:createSequence', async (_, connectionId: string, request: CreateSequenceRequest) => {
    logger.debug('IPC: schema:createSequence', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.createSequence(request)
  })

  ipcMain.handle('schema:dropSequence', async (_, connectionId: string, request: DropSequenceRequest) => {
    logger.debug('IPC: schema:dropSequence', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.dropSequence(request)
  })

  ipcMain.handle('schema:alterSequence', async (_, connectionId: string, request: AlterSequenceRequest) => {
    logger.debug('IPC: schema:alterSequence', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.alterSequence(request)
  })

  // Materialized view operations
  ipcMain.handle('schema:getMaterializedViews', async (_, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getMaterializedViews', { connectionId, schema })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getMaterializedViews(schema)
  })

  ipcMain.handle('schema:refreshMaterializedView', async (_, connectionId: string, request: RefreshMaterializedViewRequest) => {
    logger.debug('IPC: schema:refreshMaterializedView', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.refreshMaterializedView(request)
  })

  ipcMain.handle('schema:getMaterializedViewDDL', async (_, connectionId: string, viewName: string, schema?: string) => {
    logger.debug('IPC: schema:getMaterializedViewDDL', { connectionId, viewName, schema })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getMaterializedViewDDL(viewName, schema)
  })

  // Extension operations
  ipcMain.handle('schema:getExtensions', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getExtensions', { connectionId })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getExtensions()
  })

  ipcMain.handle('schema:getAvailableExtensions', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getAvailableExtensions', { connectionId })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getAvailableExtensions()
  })

  ipcMain.handle('schema:createExtension', async (_, connectionId: string, request: CreateExtensionRequest) => {
    logger.debug('IPC: schema:createExtension', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.createExtension(request)
  })

  ipcMain.handle('schema:dropExtension', async (_, connectionId: string, request: DropExtensionRequest) => {
    logger.debug('IPC: schema:dropExtension', { connectionId, request })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.dropExtension(request)
  })

  // Enum operations
  ipcMain.handle('schema:getEnums', async (_, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getEnums', { connectionId, schema })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getEnums(schema)
  })

  ipcMain.handle('schema:getAllEnums', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getAllEnums', { connectionId })
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getAllEnums()
  })
}
