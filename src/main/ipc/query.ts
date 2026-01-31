import { ipcMain } from 'electron'
import { connectionManager } from '../db/manager'
import { logger } from '../utils/logger'
import { toPlainObject } from '../utils/serialize'
import { withDriver } from './helpers'
import type { QueryResult } from '../types'

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
  ipcMain.handle('query:execute', async (_, connectionId: string, sql: string, params?: unknown[]) => {
    logger.debug('IPC: query:execute', { connectionId, sql: sql.substring(0, 100), paramsCount: params?.length })
    return withDriver(connectionId, async (driver) => {
      const result = await driver.execute(sql, params)
      return toPlainObject(result)
    })
  })

  ipcMain.handle('query:executeMultiple', async (_, connectionId: string, sql: string) => {
    logger.debug('IPC: query:executeMultiple', { connectionId, sql: sql.substring(0, 100) })
    return withDriver(connectionId, async (driver) => {
      const statements = splitSqlStatements(sql)
      const results: QueryResult[] = []
      const start = Date.now()

      for (const stmt of statements) {
        if (stmt.trim()) {
          const result = await driver.execute(stmt)
          results.push(result)
        }
      }

      return toPlainObject({
        results,
        totalExecutionTime: Date.now() - start
      })
    })
  })

  ipcMain.handle('query:cancel', async (_, connectionId: string) => {
    logger.debug('IPC: query:cancel', { connectionId })
    const driver = connectionManager.getConnection(connectionId)
    if (!driver) {
      return false
    }
    return driver.cancelQuery()
  })
}
