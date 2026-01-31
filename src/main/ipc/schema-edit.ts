import { ipcMain } from 'electron'
import { logger } from '../utils/logger'
import { type RoutineType } from '../types'
import { withDriver, withMySQLDriver } from './helpers'
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
  RenameViewRequest,
  CreateTriggerRequest,
  DropTriggerRequest
} from '../types/schema-operations'

export const registerSchemaEditHandlers = (): void => {
  // Column operations
  ipcMain.handle('schema:addColumn', async (_, connectionId: string, request: AddColumnRequest) => {
    logger.debug('IPC: schema:addColumn', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.addColumn(request))
  })

  ipcMain.handle('schema:modifyColumn', async (_, connectionId: string, request: ModifyColumnRequest) => {
    logger.debug('IPC: schema:modifyColumn', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.modifyColumn(request))
  })

  ipcMain.handle('schema:dropColumn', async (_, connectionId: string, request: DropColumnRequest) => {
    logger.debug('IPC: schema:dropColumn', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropColumn(request))
  })

  ipcMain.handle('schema:renameColumn', async (_, connectionId: string, request: RenameColumnRequest) => {
    logger.debug('IPC: schema:renameColumn', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.renameColumn(request))
  })

  // Index operations
  ipcMain.handle('schema:createIndex', async (_, connectionId: string, request: CreateIndexRequest) => {
    logger.debug('IPC: schema:createIndex', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.createIndex(request))
  })

  ipcMain.handle('schema:dropIndex', async (_, connectionId: string, request: DropIndexRequest) => {
    logger.debug('IPC: schema:dropIndex', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropIndex(request))
  })

  // Foreign key operations
  ipcMain.handle('schema:addForeignKey', async (_, connectionId: string, request: AddForeignKeyRequest) => {
    logger.debug('IPC: schema:addForeignKey', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.addForeignKey(request))
  })

  ipcMain.handle('schema:dropForeignKey', async (_, connectionId: string, request: DropForeignKeyRequest) => {
    logger.debug('IPC: schema:dropForeignKey', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropForeignKey(request))
  })

  // Table operations
  ipcMain.handle('schema:createTable', async (_, connectionId: string, request: CreateTableRequest) => {
    logger.debug('IPC: schema:createTable', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.createTable(request))
  })

  ipcMain.handle('schema:dropTable', async (_, connectionId: string, request: DropTableRequest) => {
    logger.debug('IPC: schema:dropTable', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropTable(request))
  })

  ipcMain.handle('schema:renameTable', async (_, connectionId: string, request: RenameTableRequest) => {
    logger.debug('IPC: schema:renameTable', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.renameTable(request))
  })

  // Row operations
  ipcMain.handle('schema:insertRow', async (_, connectionId: string, request: InsertRowRequest) => {
    logger.debug('IPC: schema:insertRow', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.insertRow(request))
  })

  ipcMain.handle('schema:deleteRow', async (_, connectionId: string, request: DeleteRowRequest) => {
    logger.debug('IPC: schema:deleteRow', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.deleteRow(request))
  })

  // View operations
  ipcMain.handle('schema:createView', async (_, connectionId: string, request: CreateViewRequest) => {
    logger.debug('IPC: schema:createView', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.createView(request))
  })

  ipcMain.handle('schema:dropView', async (_, connectionId: string, request: DropViewRequest) => {
    logger.debug('IPC: schema:dropView', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropView(request))
  })

  ipcMain.handle('schema:renameView', async (_, connectionId: string, request: RenameViewRequest) => {
    logger.debug('IPC: schema:renameView', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.renameView(request))
  })

  ipcMain.handle('schema:viewDDL', async (_, connectionId: string, viewName: string) => {
    logger.debug('IPC: schema:viewDDL', { connectionId, viewName })
    return withDriver(connectionId, (driver) => driver.getViewDDL(viewName))
  })

  // Metadata operations
  ipcMain.handle('schema:getDataTypes', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getDataTypes', { connectionId })
    return withDriver(connectionId, (driver) => driver.getDataTypes())
  })

  ipcMain.handle('schema:getPrimaryKey', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:getPrimaryKey', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getPrimaryKeyColumns(table))
  })

  // Routine operations
  ipcMain.handle('schema:getRoutines', async (_, connectionId: string, type?: RoutineType) => {
    logger.debug('IPC: schema:getRoutines', { connectionId, type })
    return withDriver(connectionId, (driver) => driver.getRoutines(type))
  })

  ipcMain.handle('schema:getRoutineDefinition', async (_, connectionId: string, name: string, type: RoutineType) => {
    logger.debug('IPC: schema:getRoutineDefinition', { connectionId, name, type })
    return withDriver(connectionId, (driver) => driver.getRoutineDefinition(name, type))
  })

  // User management
  ipcMain.handle('schema:getUsers', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getUsers', { connectionId })
    return withDriver(connectionId, (driver) => driver.getUsers())
  })

  ipcMain.handle('schema:getUserPrivileges', async (_, connectionId: string, username: string, host?: string) => {
    logger.debug('IPC: schema:getUserPrivileges', { connectionId, username, host })
    return withDriver(connectionId, (driver) => driver.getUserPrivileges(username, host))
  })

  // MySQL-specific: Charset and Collation operations
  ipcMain.handle('schema:getCharsets', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getCharsets', { connectionId })
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.getCharsets())
  })

  ipcMain.handle('schema:getCollations', async (_, connectionId: string, charset?: string) => {
    logger.debug('IPC: schema:getCollations', { connectionId, charset })
    return withMySQLDriver(connectionId, 'Collations', (driver) => driver.getCollations(charset))
  })

  ipcMain.handle('schema:setTableCharset', async (_, connectionId: string, table: string, charset: string, collation?: string) => {
    logger.debug('IPC: schema:setTableCharset', { connectionId, table, charset, collation })
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.setTableCharset(table, charset, collation))
  })

  ipcMain.handle('schema:setDatabaseCharset', async (_, connectionId: string, database: string, charset: string, collation?: string) => {
    logger.debug('IPC: schema:setDatabaseCharset', { connectionId, database, charset, collation })
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.setDatabaseCharset(database, charset, collation))
  })

  // MySQL-specific: Partition operations
  ipcMain.handle('schema:getPartitions', async (_, connectionId: string, table: string) => {
    logger.debug('IPC: schema:getPartitions', { connectionId, table })
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.getPartitions(table))
  })

  ipcMain.handle('schema:createPartition', async (
    _,
    connectionId: string,
    table: string,
    partitionName: string,
    partitionType: 'RANGE' | 'LIST' | 'HASH' | 'KEY',
    expression: string,
    values?: string
  ) => {
    logger.debug('IPC: schema:createPartition', { connectionId, table, partitionName, partitionType, expression, values })
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.createPartition(table, partitionName, partitionType, expression, values))
  })

  ipcMain.handle('schema:dropPartition', async (_, connectionId: string, table: string, partitionName: string) => {
    logger.debug('IPC: schema:dropPartition', { connectionId, table, partitionName })
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.dropPartition(table, partitionName))
  })

  // MySQL-specific: Event (Scheduler) operations
  ipcMain.handle('schema:getEvents', async (_, connectionId: string) => {
    logger.debug('IPC: schema:getEvents', { connectionId })
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.getEvents())
  })

  ipcMain.handle('schema:getEventDefinition', async (_, connectionId: string, eventName: string) => {
    logger.debug('IPC: schema:getEventDefinition', { connectionId, eventName })
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.getEventDefinition(eventName))
  })

  ipcMain.handle('schema:createEvent', async (
    _,
    connectionId: string,
    eventName: string,
    schedule: string,
    body: string,
    options?: {
      onCompletion?: 'PRESERVE' | 'NOT PRESERVE'
      status?: 'ENABLED' | 'DISABLED'
      comment?: string
    }
  ) => {
    logger.debug('IPC: schema:createEvent', { connectionId, eventName, schedule, body, options })
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.createEvent(eventName, schedule, body, options))
  })

  ipcMain.handle('schema:dropEvent', async (_, connectionId: string, eventName: string) => {
    logger.debug('IPC: schema:dropEvent', { connectionId, eventName })
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.dropEvent(eventName))
  })

  ipcMain.handle('schema:alterEvent', async (
    _,
    connectionId: string,
    eventName: string,
    options: {
      schedule?: string
      body?: string
      newName?: string
      onCompletion?: 'PRESERVE' | 'NOT PRESERVE'
      status?: 'ENABLED' | 'DISABLED'
      comment?: string
    }
  ) => {
    logger.debug('IPC: schema:alterEvent', { connectionId, eventName, options })
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.alterEvent(eventName, options))
  })

  // Trigger operations
  ipcMain.handle('schema:getTriggers', async (_, connectionId: string, table?: string) => {
    logger.debug('IPC: schema:getTriggers', { connectionId, table })
    return withDriver(connectionId, (driver) => driver.getTriggers(table))
  })

  ipcMain.handle('schema:getTriggerDefinition', async (_, connectionId: string, name: string, table?: string) => {
    logger.debug('IPC: schema:getTriggerDefinition', { connectionId, name, table })
    return withDriver(connectionId, (driver) => driver.getTriggerDefinition(name, table))
  })

  ipcMain.handle('schema:createTrigger', async (_, connectionId: string, request: CreateTriggerRequest) => {
    logger.debug('IPC: schema:createTrigger', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.createTrigger(request))
  })

  ipcMain.handle('schema:dropTrigger', async (_, connectionId: string, request: DropTriggerRequest) => {
    logger.debug('IPC: schema:dropTrigger', { connectionId, request })
    return withDriver(connectionId, (driver) => driver.dropTrigger(request))
  })
}
