import { ref } from 'vue'
import { identify } from 'sql-query-identifier'
import type { Dialect } from 'sql-query-identifier'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { useRecentsStore } from '@/stores/recents'
import { useSettingsStore } from '@/stores/settings'
import { DatabaseType } from '@/types/connection'
import type { QueryResult, MultiQueryResult, QueryHistoryItem } from '@/types/query'

const SAFE_EXECUTION_TYPES = new Set(['LISTING', 'INFORMATION'])

const getDialect = (dbType?: DatabaseType): Dialect => {
  switch (dbType) {
    case DatabaseType.PostgreSQL: return 'psql'
    case DatabaseType.MySQL: return 'mysql'
    case DatabaseType.MariaDB: return 'mysql'
    case DatabaseType.SQLite: return 'sqlite'
    case DatabaseType.DuckDB: return 'sqlite'
    case DatabaseType.SQLServer: return 'mssql'
    default: return 'generic'
  }
}

const isReadOnlyQuery = (sql: string, dialect: Dialect): boolean => {
  try {
    const statements = identify(sql, { strict: false, dialect })
    return statements.every(s => SAFE_EXECUTION_TYPES.has(s.executionType))
  } catch {
    // If parsing fails, block the query in safe mode to be safe
    return false
  }
}

/**
 * Checks whether a SQL string contains multiple statements.
 * This is a lightweight check that looks for semicolons outside of
 * quoted strings and comments.
 */
const hasMultipleStatements = (sql: string): boolean => {
  let i = 0
  const len = sql.length

  while (i < len) {
    const ch = sql[i]

    // Single-quoted string
    if (ch === "'") {
      i++
      while (i < len) {
        if (sql[i] === "'" && i + 1 < len && sql[i + 1] === "'") {
          i += 2
        } else if (sql[i] === "'") {
          i++
          break
        } else {
          i++
        }
      }
      continue
    }

    // Double-quoted identifier
    if (ch === '"') {
      i++
      while (i < len) {
        if (sql[i] === '"' && i + 1 < len && sql[i + 1] === '"') {
          i += 2
        } else if (sql[i] === '"') {
          i++
          break
        } else {
          i++
        }
      }
      continue
    }

    // Backtick-quoted identifier
    if (ch === '`') {
      i++
      while (i < len) {
        if (sql[i] === '`' && i + 1 < len && sql[i + 1] === '`') {
          i += 2
        } else if (sql[i] === '`') {
          i++
          break
        } else {
          i++
        }
      }
      continue
    }

    // Line comment (--)
    if (ch === '-' && i + 1 < len && sql[i + 1] === '-') {
      i += 2
      while (i < len && sql[i] !== '\n') {
        i++
      }
      continue
    }

    // Block comment (/* ... */)
    if (ch === '/' && i + 1 < len && sql[i + 1] === '*') {
      i += 2
      while (i < len) {
        if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
          i += 2
          break
        } else {
          i++
        }
      }
      continue
    }

    // Semicolon — if there is non-whitespace content after it, there are multiple statements
    if (ch === ';') {
      let j = i + 1
      while (j < len && /\s/.test(sql[j])) {
        j++
      }
      if (j < len) {
        const remaining = sql.substring(j).trim()
        if (remaining.length > 0) {
          return true
        }
      }
      i++
      continue
    }

    i++
  }

  return false
}

export const useQuery = () => {
  const connectionsStore = useConnectionsStore()
  const tabsStore = useTabsStore()
  const recentsStore = useRecentsStore()
  const settingsStore = useSettingsStore()
  const isExecuting = ref(false)
  const error = ref<string | null>(null)

  const getQueryName = (sql: string): string => {
    // Extract a meaningful name from the SQL
    const trimmed = sql.trim().replace(/\s+/g, ' ')
    // Truncate to first 50 chars
    return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed
  }

  const executeQuery = async (sql: string, tabId?: string, useTransaction?: boolean): Promise<QueryResult | null> => {
    const connectionId = connectionsStore.activeSessionId
    if (!connectionId) {
      error.value = 'No active connection'
      return null
    }

    // Block destructive queries in safe mode
    if (settingsStore.safeMode) {
      const dbType = connectionsStore.activeConnection?.type
      const dialect = getDialect(dbType)
      if (!isReadOnlyQuery(sql, dialect)) {
        error.value = 'Write queries are not allowed in Safe Mode'
        if (tabId) {
          tabsStore.setTabResult(tabId, {
            columns: [],
            rows: [],
            rowCount: 0,
            affectedRows: 0,
            executionTime: 0,
            error: error.value
          })
        }
        return null
      }
    }

    // Check if the SQL contains multiple statements
    if (hasMultipleStatements(sql)) {
      return executeMultipleQueries(sql, tabId, useTransaction)
    }

    isExecuting.value = true
    error.value = null

    if (tabId) {
      tabsStore.setTabResult(tabId, undefined)
      tabsStore.setTabExecuting(tabId, true)
    }

    try {
      const result = await window.api.query.execute(connectionId, sql, undefined, useTransaction)

      if (tabId) {
        tabsStore.setTabResult(tabId, result)
      }

      if (result.error) {
        error.value = result.error
      }

      // Resolve to saved connection ID for persistence
      const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId

      // Save to history
      await window.api.history.add(
        savedId,
        sql,
        result.executionTime,
        result.rowCount,
        result.error
      )

      // Save to recents (only for successful SELECT queries)
      if (!result.error && sql.trim().toUpperCase().startsWith('SELECT')) {
        recentsStore.addRecentQuery(getQueryName(sql), sql, connectionId, connectionsStore.getActiveDatabase(connectionId))
      }

      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Query execution failed'

      // Resolve to saved connection ID for persistence
      const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId

      // Save failed query to history too
      await window.api.history.add(savedId, sql, 0, 0, error.value)

      return null
    } finally {
      isExecuting.value = false
      if (tabId) {
        tabsStore.setTabExecuting(tabId, false)
      }
    }
  }

  const executeMultipleQueries = async (sql: string, tabId?: string, useTransaction?: boolean): Promise<QueryResult | null> => {
    const connectionId = connectionsStore.activeSessionId
    if (!connectionId) {
      error.value = 'No active connection'
      return null
    }

    // Safe mode check is handled by executeQuery() before calling this function

    isExecuting.value = true
    error.value = null

    if (tabId) {
      tabsStore.setTabResult(tabId, undefined)
      tabsStore.setTabExecuting(tabId, true)
    }

    try {
      const multiResult: MultiQueryResult = await window.api.query.executeMultiple(connectionId, sql, useTransaction)

      if (tabId && multiResult.results.length > 0) {
        tabsStore.setTabMultiResults(tabId, multiResult.results)
      }

      // Check if any result has an error
      const firstError = multiResult.results.find(r => r.error)
      if (firstError) {
        error.value = firstError.error || null
      }

      // Resolve to saved connection ID for persistence
      const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId

      // Save to history with total execution time and combined row count
      const totalRows = multiResult.results.reduce((sum, r) => sum + (r.rowCount || 0), 0)
      const firstErrorMsg = multiResult.results.find(r => r.error)?.error
      await window.api.history.add(
        savedId,
        sql,
        multiResult.totalExecutionTime,
        totalRows,
        firstErrorMsg
      )

      // Save to recents for any successful SELECT queries
      for (const result of multiResult.results) {
        if (!result.error) {
          recentsStore.addRecentQuery(getQueryName(sql), sql, connectionId, connectionsStore.getActiveDatabase(connectionId))
          break // Just add one recent entry for the entire batch
        }
      }

      return multiResult.results.length > 0 ? multiResult.results[multiResult.results.length - 1] : null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Query execution failed'

      // Resolve to saved connection ID for persistence
      const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId

      // Save failed query to history too
      await window.api.history.add(savedId, sql, 0, 0, error.value)

      return null
    } finally {
      isExecuting.value = false
      if (tabId) {
        tabsStore.setTabExecuting(tabId, false)
      }
    }
  }

  const cancelQuery = async (): Promise<boolean> => {
    const connectionId = connectionsStore.activeSessionId
    if (!connectionId) return false

    try {
      return await window.api.query.cancel(connectionId)
    } catch {
      return false
    }
  }

  const createQueryTab = (sql = '') => {
    const connectionId = connectionsStore.activeSessionId
    if (!connectionId) return null
    return tabsStore.createQueryTab(connectionId, sql)
  }

  const getHistory = async (limit = 100): Promise<QueryHistoryItem[]> => {
    const connectionId = connectionsStore.activeSessionId
    if (!connectionId) return []
    const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId
    return window.api.history.list(savedId, limit)
  }

  const clearHistory = async (): Promise<void> => {
    const connectionId = connectionsStore.activeSessionId
    if (connectionId) {
      const savedId = connectionsStore.getSavedConnectionId(connectionId) ?? connectionId
      await window.api.history.clear(savedId)
    }
  }

  return {
    isExecuting,
    error,
    executeQuery,
    cancelQuery,
    createQueryTab,
    getHistory,
    clearHistory
  }
}
