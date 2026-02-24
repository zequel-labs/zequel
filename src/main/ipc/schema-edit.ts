import { ipcMain } from 'electron'
import { logger } from '@main/utils/logger'
import { type RoutineType } from '@main/types'
import { withDriver, withMySQLDriver, withPostgresDriver, assertSessionOwner } from './helpers'
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
  UpdateRowRequest,
  CreateViewRequest,
  DropViewRequest,
  RenameViewRequest,
  CreateTriggerRequest,
  DropTriggerRequest,
  CreateUserRequest,
  DropUserRequest
} from '@main/types/schema-operations'

export const registerSchemaEditHandlers = (): void => {
  // Column operations
  ipcMain.handle('schema:addColumn', async (event, connectionId: string, request: AddColumnRequest) => {
    logger.debug('IPC: schema:addColumn', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.addColumn(request))
  })

  ipcMain.handle('schema:modifyColumn', async (event, connectionId: string, request: ModifyColumnRequest) => {
    logger.debug('IPC: schema:modifyColumn', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.modifyColumn(request))
  })

  ipcMain.handle('schema:dropColumn', async (event, connectionId: string, request: DropColumnRequest) => {
    logger.debug('IPC: schema:dropColumn', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropColumn(request))
  })

  ipcMain.handle('schema:renameColumn', async (event, connectionId: string, request: RenameColumnRequest) => {
    logger.debug('IPC: schema:renameColumn', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.renameColumn(request))
  })

  // Index operations
  ipcMain.handle('schema:createIndex', async (event, connectionId: string, request: CreateIndexRequest) => {
    logger.debug('IPC: schema:createIndex', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.createIndex(request))
  })

  ipcMain.handle('schema:dropIndex', async (event, connectionId: string, request: DropIndexRequest) => {
    logger.debug('IPC: schema:dropIndex', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropIndex(request))
  })

  // Foreign key operations
  ipcMain.handle('schema:addForeignKey', async (event, connectionId: string, request: AddForeignKeyRequest) => {
    logger.debug('IPC: schema:addForeignKey', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.addForeignKey(request))
  })

  ipcMain.handle('schema:dropForeignKey', async (event, connectionId: string, request: DropForeignKeyRequest) => {
    logger.debug('IPC: schema:dropForeignKey', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropForeignKey(request))
  })

  // Table operations
  ipcMain.handle('schema:createTable', async (event, connectionId: string, request: CreateTableRequest) => {
    logger.debug('IPC: schema:createTable', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.createTable(request))
  })

  ipcMain.handle('schema:dropTable', async (event, connectionId: string, request: DropTableRequest) => {
    logger.debug('IPC: schema:dropTable', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropTable(request))
  })

  ipcMain.handle('schema:renameTable', async (event, connectionId: string, request: RenameTableRequest) => {
    logger.debug('IPC: schema:renameTable', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.renameTable(request))
  })

  // Row operations
  ipcMain.handle('schema:insertRow', async (event, connectionId: string, request: InsertRowRequest) => {
    logger.debug('IPC: schema:insertRow', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.insertRow(request))
  })

  ipcMain.handle('schema:deleteRow', async (event, connectionId: string, request: DeleteRowRequest) => {
    logger.debug('IPC: schema:deleteRow', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.deleteRow(request))
  })

  ipcMain.handle('schema:updateRow', async (event, connectionId: string, request: UpdateRowRequest) => {
    logger.debug('IPC: schema:updateRow', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.updateRow(request))
  })

  // View operations
  ipcMain.handle('schema:createView', async (event, connectionId: string, request: CreateViewRequest) => {
    logger.debug('IPC: schema:createView', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.createView(request))
  })

  ipcMain.handle('schema:dropView', async (event, connectionId: string, request: DropViewRequest) => {
    logger.debug('IPC: schema:dropView', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropView(request))
  })

  ipcMain.handle('schema:renameView', async (event, connectionId: string, request: RenameViewRequest) => {
    logger.debug('IPC: schema:renameView', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.renameView(request))
  })

  ipcMain.handle('schema:viewDDL', async (event, connectionId: string, viewName: string) => {
    logger.debug('IPC: schema:viewDDL', { connectionId, viewName })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getViewDDL(viewName))
  })

  // Metadata operations
  ipcMain.handle('schema:getDataTypes', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getDataTypes', { connectionId })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getDataTypes())
  })

  ipcMain.handle('schema:getPrimaryKey', async (event, connectionId: string, table: string) => {
    logger.debug('IPC: schema:getPrimaryKey', { connectionId, table })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getPrimaryKeyColumns(table))
  })

  // Routine operations
  ipcMain.handle('schema:getRoutines', async (event, connectionId: string, type?: RoutineType) => {
    logger.debug('IPC: schema:getRoutines', { connectionId, type })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getRoutines(type))
  })

  ipcMain.handle('schema:getRoutineDefinition', async (event, connectionId: string, name: string, type: RoutineType) => {
    logger.debug('IPC: schema:getRoutineDefinition', { connectionId, name, type })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getRoutineDefinition(name, type))
  })

  // User management
  ipcMain.handle('schema:getUsers', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getUsers', { connectionId })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getUsers())
  })

  ipcMain.handle('schema:createUser', async (event, connectionId: string, request: CreateUserRequest) => {
    logger.debug('IPC: schema:createUser', { connectionId, user: request.user.name })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.createUser(request))
  })

  ipcMain.handle('schema:dropUser', async (event, connectionId: string, request: DropUserRequest) => {
    logger.debug('IPC: schema:dropUser', { connectionId, user: request.name })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropUser(request))
  })

  // Table comment
  ipcMain.handle('schema:updateTableComment', async (event, connectionId: string, table: string, comment: string | null) => {
    logger.debug('IPC: schema:updateTableComment', { connectionId, table, comment })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.updateTableComment(table, comment))
  })

  // MySQL-specific: Charset and Collation operations
  ipcMain.handle('schema:getCharsets', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getCharsets', { connectionId })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.getCharsets())
  })

  ipcMain.handle('schema:getCollations', async (event, connectionId: string, charset?: string) => {
    logger.debug('IPC: schema:getCollations', { connectionId, charset })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Collations', (driver) => driver.getCollations(charset))
  })

  ipcMain.handle('schema:setTableCharset', async (event, connectionId: string, table: string, charset: string, collation?: string) => {
    logger.debug('IPC: schema:setTableCharset', { connectionId, table, charset, collation })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.setTableCharset(table, charset, collation))
  })

  ipcMain.handle('schema:setDatabaseCharset', async (event, connectionId: string, database: string, charset: string, collation?: string) => {
    logger.debug('IPC: schema:setDatabaseCharset', { connectionId, database, charset, collation })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Charsets', (driver) => driver.setDatabaseCharset(database, charset, collation))
  })

  // MySQL-specific: Partition operations
  ipcMain.handle('schema:getPartitions', async (event, connectionId: string, table: string) => {
    logger.debug('IPC: schema:getPartitions', { connectionId, table })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.getPartitions(table))
  })

  ipcMain.handle('schema:createPartition', async (
    event,
    connectionId: string,
    table: string,
    partitionName: string,
    partitionType: 'RANGE' | 'LIST' | 'HASH' | 'KEY',
    expression: string,
    values?: string
  ) => {
    logger.debug('IPC: schema:createPartition', { connectionId, table, partitionName, partitionType, expression, values })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.createPartition(table, partitionName, partitionType, expression, values))
  })

  ipcMain.handle('schema:dropPartition', async (event, connectionId: string, table: string, partitionName: string) => {
    logger.debug('IPC: schema:dropPartition', { connectionId, table, partitionName })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Partitions', (driver) => driver.dropPartition(table, partitionName))
  })

  // MySQL-specific: Event (Scheduler) operations
  ipcMain.handle('schema:getEvents', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getEvents', { connectionId })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.getEvents())
  })

  ipcMain.handle('schema:getEventDefinition', async (event, connectionId: string, eventName: string) => {
    logger.debug('IPC: schema:getEventDefinition', { connectionId, eventName })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.getEventDefinition(eventName))
  })

  ipcMain.handle('schema:createEvent', async (
    event,
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
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.createEvent(eventName, schedule, body, options))
  })

  ipcMain.handle('schema:dropEvent', async (event, connectionId: string, eventName: string) => {
    logger.debug('IPC: schema:dropEvent', { connectionId, eventName })
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.dropEvent(eventName))
  })

  ipcMain.handle('schema:alterEvent', async (
    event,
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
    assertSessionOwner(event, connectionId)
    return withMySQLDriver(connectionId, 'Events', (driver) => driver.alterEvent(eventName, options))
  })

  // PostgreSQL-specific: Encoding and Collation operations
  ipcMain.handle('schema:getPgEncodings', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getPgEncodings', { connectionId })
    assertSessionOwner(event, connectionId)
    return withPostgresDriver(connectionId, 'Encodings', (driver) => driver.getEncodings())
  })

  ipcMain.handle('schema:getPgCollations', async (event, connectionId: string) => {
    logger.debug('IPC: schema:getPgCollations', { connectionId })
    assertSessionOwner(event, connectionId)
    return withPostgresDriver(connectionId, 'Collations', (driver) => driver.getCollations())
  })

  // Trigger operations
  ipcMain.handle('schema:getTriggers', async (event, connectionId: string, table?: string) => {
    logger.debug('IPC: schema:getTriggers', { connectionId, table })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getTriggers(table))
  })

  ipcMain.handle('schema:getTriggerDefinition', async (event, connectionId: string, name: string, table?: string) => {
    logger.debug('IPC: schema:getTriggerDefinition', { connectionId, name, table })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.getTriggerDefinition(name, table))
  })

  ipcMain.handle('schema:createTrigger', async (event, connectionId: string, request: CreateTriggerRequest) => {
    logger.debug('IPC: schema:createTrigger', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.createTrigger(request))
  })

  ipcMain.handle('schema:dropTrigger', async (event, connectionId: string, request: DropTriggerRequest) => {
    logger.debug('IPC: schema:dropTrigger', { connectionId, request })
    assertSessionOwner(event, connectionId)
    return withDriver(connectionId, (driver) => driver.dropTrigger(request))
  })
}
