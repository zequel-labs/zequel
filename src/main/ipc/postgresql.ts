import { ipcMain } from 'electron'
import { connectionManager } from '@main/db/manager'
import type { PostgreSQLDriver } from '@main/db/postgres'
import type { SQLServerDriver } from '@main/db/sqlserver'
import { logger } from '@main/utils/logger'
import { DatabaseType } from '@main/types'
import { assertSessionOwner } from './helpers'
import type {
  CreateSequenceRequest,
  DropSequenceRequest,
  AlterSequenceRequest,
  RefreshMaterializedViewRequest,
  CreateExtensionRequest,
  DropExtensionRequest
} from '@main/types/schema-operations'

const getPostgreSQLDriver = (connectionId: string): PostgreSQLDriver => {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  if (driver.type !== DatabaseType.PostgreSQL) {
    throw new Error('This operation is only available for PostgreSQL connections')
  }
  return driver as PostgreSQLDriver
}

const getSchemaDriver = (connectionId: string): PostgreSQLDriver | SQLServerDriver => {
  const driver = connectionManager.getConnection(connectionId)
  if (!driver) {
    throw new Error('Not connected to database')
  }
  if (driver.type !== DatabaseType.PostgreSQL && driver.type !== DatabaseType.SQLServer) {
    throw new Error('This operation is only available for PostgreSQL and SQL Server connections')
  }
  return driver as PostgreSQLDriver | SQLServerDriver
}

export const registerPostgreSQLHandlers = (): void => {
  // Schema operations (shared between PostgreSQL and SQL Server)
  ipcMain.handle('schema:getSchemas', async (event, connectionId: string, includeEmpty?: boolean) => {
    logger.debug('IPC: schema:getSchemas', { connectionId, includeEmpty })
    assertSessionOwner(event, connectionId)
    const driver = getSchemaDriver(connectionId)
    return driver.getSchemas(includeEmpty)
  })

  ipcMain.handle('schema:setCurrentSchema', async (event, connectionId: string, schema: string) => {
    logger.debug('IPC: schema:setCurrentSchema', { connectionId, schema })
    assertSessionOwner(event, connectionId)
    const driver = getSchemaDriver(connectionId)
    driver.setCurrentSchema(schema)
    return true
  })

  ipcMain.handle('schema:getCurrentSchema', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getCurrentSchema', { connectionId })
    assertSessionOwner(event, connectionId)
    const driver = getSchemaDriver(connectionId)
    return driver.getCurrentSchema()
  })

  ipcMain.handle('schema:createSchema', async (event, connectionId: string, name: string) => {
    logger.debug('IPC: schema:createSchema', { connectionId, name })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.createSchema(name)
  })

  // Sequence operations
  ipcMain.handle('schema:getSequences', async (event, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getSequences', { connectionId, schema })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getSequences(schema)
  })

  ipcMain.handle('schema:getSequenceDetails', async (event, connectionId: string, sequenceName: string, schema?: string) => {
    logger.debug('IPC: schema:getSequenceDetails', { connectionId, sequenceName, schema })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getSequenceDetails(sequenceName, schema)
  })

  ipcMain.handle('schema:createSequence', async (event, connectionId: string, request: CreateSequenceRequest) => {
    logger.debug('IPC: schema:createSequence', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.createSequence(request)
  })

  ipcMain.handle('schema:dropSequence', async (event, connectionId: string, request: DropSequenceRequest) => {
    logger.debug('IPC: schema:dropSequence', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.dropSequence(request)
  })

  ipcMain.handle('schema:alterSequence', async (event, connectionId: string, request: AlterSequenceRequest) => {
    logger.debug('IPC: schema:alterSequence', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.alterSequence(request)
  })

  // Materialized view operations
  ipcMain.handle('schema:getMaterializedViews', async (event, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getMaterializedViews', { connectionId, schema })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getMaterializedViews(schema)
  })

  ipcMain.handle('schema:refreshMaterializedView', async (event, connectionId: string, request: RefreshMaterializedViewRequest) => {
    logger.debug('IPC: schema:refreshMaterializedView', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.refreshMaterializedView(request)
  })

  ipcMain.handle('schema:getMaterializedViewDDL', async (event, connectionId: string, viewName: string, schema?: string) => {
    logger.debug('IPC: schema:getMaterializedViewDDL', { connectionId, viewName, schema })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getMaterializedViewDDL(viewName, schema)
  })

  // Extension operations
  ipcMain.handle('schema:getExtensions', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getExtensions', { connectionId })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getExtensions()
  })

  ipcMain.handle('schema:getAvailableExtensions', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getAvailableExtensions', { connectionId })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getAvailableExtensions()
  })

  ipcMain.handle('schema:createExtension', async (event, connectionId: string, request: CreateExtensionRequest) => {
    logger.debug('IPC: schema:createExtension', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.createExtension(request)
  })

  ipcMain.handle('schema:dropExtension', async (event, connectionId: string, request: DropExtensionRequest) => {
    logger.debug('IPC: schema:dropExtension', { connectionId, request })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.dropExtension(request)
  })

  // Enum operations
  ipcMain.handle('schema:getEnums', async (event, connectionId: string, schema?: string) => {
    logger.debug('IPC: schema:getEnums', { connectionId, schema })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getEnums(schema)
  })

  ipcMain.handle('schema:getAllEnums', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getAllEnums', { connectionId })
    assertSessionOwner(event, connectionId)
    const driver = getPostgreSQLDriver(connectionId)
    return driver.getAllEnums()
  })
}
