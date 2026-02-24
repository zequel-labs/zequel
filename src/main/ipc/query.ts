import { ipcMain } from 'electron'
import { connectionManager } from '@main/db/manager'
import { windowManager } from '@main/services/windowManager'
import { logger } from '@main/utils/logger'
import { toPlainObject } from '@main/utils/serialize'
import { withDriver } from './helpers'
import type { QueryResult } from '@main/types'

/**
 * Splits a SQL string into individual statements by semicolons,
 * while correctly handling:
 * - Single-quoted strings ('...')
 * - Double-quoted identifiers ("...")
 * - Backtick-quoted identifiers (`...`)
 * - Line comments (-- ...)
 * - Block comments (/* ... *​/)
 */
export const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = []
  let current = ''
  let i = 0
  const len = sql.length

  while (i < len) {
    const ch = sql[i]

    // Single-quoted string
    if (ch === "'") {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === "'" && i + 1 < len && sql[i + 1] === "'") {
          // Escaped single quote ('')
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Double-quoted identifier
    if (ch === '"') {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === '"' && i + 1 < len && sql[i + 1] === '"') {
          // Escaped double quote ("")
          current += '""'
          i += 2
        } else if (sql[i] === '"') {
          current += '"'
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Backtick-quoted identifier
    if (ch === '`') {
      current += ch
      i++
      while (i < len) {
        if (sql[i] === '`' && i + 1 < len && sql[i + 1] === '`') {
          // Escaped backtick (``)
          current += '``'
          i += 2
        } else if (sql[i] === '`') {
          current += '`'
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // Line comment (--)
    if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
      current += '--'
      i += 2
      while (i < len && sql[i] !== '\n') {
        current += sql[i]
        i++
      }
      continue
    }

    // Block comment (/* ... */)
    if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
      current += '/*'
      i += 2
      while (i < len) {
        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          current += '*/'
          i += 2
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    // PostgreSQL dollar-quoted string ($tag$...$tag$ or $$...$$)
    if (ch === '$') {
      const tagMatch = sql.substring(i).match(/^\$([A-Za-z_][\w]*)?\$/)
      if (tagMatch) {
        const tag = tagMatch[0] // e.g. "$$" or "$tag$"
        current += tag
        i += tag.length
        const endPos = sql.indexOf(tag, i)
        if (endPos !== -1) {
          current += sql.substring(i, endPos + tag.length)
          i = endPos + tag.length
        } else {
          // No closing tag found — consume rest of input
          current += sql.substring(i)
          i = len
        }
        continue
      }
    }

    // Semicolon: statement boundary
    if (ch === ';') {
      const trimmed = current.trim()
      if (trimmed) {
        statements.push(trimmed)
      }
      current = ''
      i++
      continue
    }

    // Normal character
    current += ch
    i++
  }

  // Don't forget the last statement (may not end with semicolon)
  const trimmed = current.trim()
  if (trimmed) {
    statements.push(trimmed)
  }

  return statements
}

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
