import { ipcMain } from 'electron'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { logger } from '@main/utils/logger'
import { toPlainObject } from '@main/utils/serialize'
import { withDriver } from './helpers'
import { splitSqlStatements } from '@main/utils/sql'
import type { QueryResult } from '@main/types'

// Re-exported for existing importers; the implementation now lives in @main/utils/sql.
export { splitSqlStatements }

export const registerQueryHandlers = (): void => {
  ipcMain.handle('query:execute', async (event, connectionId: string, sql: string, params?: unknown[], useTransaction?: boolean) => {
    logger.debug('IPC: query:execute', { connectionId, sql: sql.substring(0, 100), paramsCount: params?.length, useTransaction })
    const ownerId = windowManager.getSessionOwner(connectionId)
    if (ownerId !== undefined && ownerId !== event.sender.id) {
      throw new Error('Not authorized to execute queries on this connection')
    }
    return withDriver(connectionId, async (driver) => {
      const result = await driver.execute(sql, params, useTransaction)
      return toPlainObject(result)
    })
  })

  ipcMain.handle('query:executeMultiple', async (event, connectionId: string, sql: string, useTransaction?: boolean) => {
    logger.debug('IPC: query:executeMultiple', { connectionId, sql: sql.substring(0, 100), useTransaction })
    const ownerId = windowManager.getSessionOwner(connectionId)
    if (ownerId !== undefined && ownerId !== event.sender.id) {
      throw new Error('Not authorized to execute queries on this connection')
    }
    return withDriver(connectionId, async (driver) => {
      const statements = splitSqlStatements(sql)
      const results: QueryResult[] = []
      const start = Date.now()

      for (const stmt of statements) {
        if (stmt.trim()) {
          const result = await driver.execute(stmt, undefined, useTransaction)
          results.push(result)
        }
      }

      return toPlainObject({
        results,
        totalExecutionTime: Date.now() - start
      })
    })
  })

  ipcMain.handle('query:cancel', async (event, connectionId: string) => {
    logger.debug('IPC: query:cancel', { connectionId })
    const ownerId = windowManager.getSessionOwner(connectionId)
    if (ownerId !== undefined && ownerId !== event.sender.id) {
      throw new Error('Not authorized to cancel queries on this connection')
    }
    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      return false
    }
    return driver.cancelQuery()
  })
}
