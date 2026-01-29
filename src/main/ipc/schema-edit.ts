import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { logger } from '../utils/logger'
import type {
  AddColumnRequest,
  ModifyColumnRequest,
  DropColumnRequest,
  RenameColumnRequest,
  CreateIndexRequest,
  DropIndexRequest,
  AddForeignKeyRequest,
  DropForeignKeyRequest,
  CreateTableRequest,
  DropTableRequest,
  RenameTableRequest,
  InsertRowRequest,
  DeleteRowRequest,
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest
} from '../types/schema-operations'

export function registerSchemaEditHandlers(): void {
  // Column operations
  ipcMain.handle('schema:addColumn', async (_, connectionId: string, request: AddColumnRequest) => {
    logger.debug('IPC: schema:addColumn', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.addColumn(request)
  })

  ipcMain.handle('schema:modifyColumn', async (_, connectionId: string, request: ModifyColumnRequest) => {
    logger.debug('IPC: schema:modifyColumn', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.modifyColumn(request)
  })

  ipcMain.handle('schema:dropColumn', async (_, connectionId: string, request: DropColumnRequest) => {
    logger.debug('IPC: schema:dropColumn', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.dropColumn(request)
  })

  ipcMain.handle('schema:renameColumn', async (_, connectionId: string, request: RenameColumnRequest) => {
    logger.debug('IPC: schema:renameColumn', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.renameColumn(request)
  })

  // Index operations
  ipcMain.handle('schema:createIndex', async (_, connectionId: string, request: CreateIndexRequest) => {
    logger.debug('IPC: schema:createIndex', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.createIndex(request)
  })

  ipcMain.handle('schema:dropIndex', async (_, connectionId: string, request: DropIndexRequest) => {
    logger.debug('IPC: schema:dropIndex', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.dropIndex(request)
  })

  // Foreign key operations
  ipcMain.handle('schema:addForeignKey', async (_, connectionId: string, request: AddForeignKeyRequest) => {
    logger.debug('IPC: schema:addForeignKey', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.addForeignKey(request)
  })

  ipcMain.handle('schema:dropForeignKey', async (_, connectionId: string, request: DropForeignKeyRequest) => {
    logger.debug('IPC: schema:dropForeignKey', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.dropForeignKey(request)
  })

  // Table operations
  ipcMain.handle('schema:createTable', async (_, connectionId: string, request: CreateTableRequest) => {
    logger.debug('IPC: schema:createTable', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.createTable(request)
  })

  ipcMain.handle('schema:dropTable', async (_, connectionId: string, request: DropTableRequest) => {
    logger.debug('IPC: schema:dropTable', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.dropTable(request)
  })

  ipcMain.handle('schema:renameTable', async (_, connectionId: string, request: RenameTableRequest) => {
    logger.debug('IPC: schema:renameTable', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.renameTable(request)
  })

  // Row operations
  ipcMain.handle('schema:insertRow', async (_, connectionId: string, request: InsertRowRequest) => {
    logger.debug('IPC: schema:insertRow', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.insertRow(request)
  })

  ipcMain.handle('schema:deleteRow', async (_, connectionId: string, request: DeleteRowRequest) => {
    logger.debug('IPC: schema:deleteRow', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.deleteRow(request)
  })

  // View operations
  ipcMain.handle('schema:createView', async (_, connectionId: string, request: CreateViewRequest) => {
    logger.debug('IPC: schema:createView', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.createView(request)
  })

  ipcMain.handle('schema:dropView', async (_, connectionId: string, request: DropViewRequest) => {
    logger.debug('IPC: schema:dropView', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.dropView(request)
  })

  ipcMain.handle('schema:renameView', async (_, connectionId: string, request: RenameViewRequest) => {
    logger.debug('IPC: schema:renameView', { connectionId, request })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.renameView(request)
  })

  ipcMain.handle('schema:viewDDL', async (_, connectionId: string, viewName: string) => {
    logger.debug('IPC: schema:viewDDL', { connectionId, viewName })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getViewDDL(viewName)
  })

  // Metadata operations
  ipcMain.handle('schema:getDataTypes', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getDataTypes', { connectionId })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getDataTypes()
  })

  ipcMain.handle('schema:getPrimaryKey', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:getPrimaryKey', { connectionId, table })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getPrimaryKeyColumns(table)
  })

  // Routine operations
  ipcMain.handle('schema:getRoutines', async (_, connectionId: string, type?: 'PROCEDURE' | 'FUNCTION') => {
    logger.debug('IPC: schema:getRoutines', { connectionId, type })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getRoutines(type)
  })

  ipcMain.handle('schema:getRoutineDefinition', async (_, connectionId: string, name: string, type: 'PROCEDURE' | 'FUNCTION') => {
    logger.debug('IPC: schema:getRoutineDefinition', { connectionId, name, type })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getRoutineDefinition(name, type)
  })

  // User management
  ipcMain.handle('schema:getUsers', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getUsers', { connectionId })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getUsers()
  })

  ipcMain.handle('schema:getUserPrivileges', async (_, connectionId: string, username: string, host?: string) => {
    logger.debug('IPC: schema:getUserPrivileges', { connectionId, username, host })

    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      throw new Error('Not connected to database')
    }

    return driver.getUserPrivileges(username, host)
  })
}
