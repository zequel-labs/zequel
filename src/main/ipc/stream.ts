import { ipcMain } from 'electron'
import { logger } from '@main/utils/logger'
import { toPlainObject } from '@main/utils/serialize'
import { withDriver } from './helpers'
import { cursorManager } from '@main/db/cursors/CursorManager'
import type { DataOptions } from '@main/types'

export const registerStreamHandlers = (): void => {
  ipcMain.handle(
    'stream:queryStart',
    async (_, connectionId: string, sql: string, chunkSize: number) => {
      logger.debug('IPC: stream:queryStart', { connectionId, sql: sql.substring(0, 100), chunkSize })
      return withDriver(connectionId, async (driver) => {
        const result = await driver.queryStream(sql, chunkSize)
        const cursorId = await cursorManager.register(result.cursor)
        return toPlainObject({
          cursorId,
          columns: result.columns,
          totalRows: result.totalRows
        })
      })
    }
  )

  ipcMain.handle(
    'stream:tableStart',
    async (_, connectionId: string, table: string, options: DataOptions, chunkSize: number) => {
      logger.debug('IPC: stream:tableStart', { connectionId, table, chunkSize })
      return withDriver(connectionId, async (driver) => {
        const result = await driver.selectTopStream(table, options, chunkSize)
        const cursorId = await cursorManager.register(result.cursor)
        return toPlainObject({
          cursorId,
          columns: result.columns,
          totalRows: result.totalRows
        })
      })
    }
  )

  ipcMain.handle(
    'stream:read',
    async (_, cursorId: string) => {
      logger.debug('IPC: stream:read', { cursorId })
      const rows = await cursorManager.read(cursorId)
      return toPlainObject(rows)
    }
  )

  ipcMain.handle(
    'stream:cancel',
    async (_, cursorId: string) => {
      logger.debug('IPC: stream:cancel', { cursorId })
      await cursorManager.cancel(cursorId)
      return true
    }
  )
}
