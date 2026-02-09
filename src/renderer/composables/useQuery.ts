import { ref } from 'vue'
import { useConnectionsStore } from '../stores/connections'
import { useTabsStore } from '../stores/tabs'
import { useRecentsStore } from '../stores/recents'
import type { QueryResult, MultiQueryResult, QueryHistoryItem } from '../types/query'

/**
 * Checks whether a SQL string contains multiple statements.
 * This is a lightweight check that looks for semicolons outside of
 * quoted strings and comments.
 */
const hasMultipleStatements = (sql: string): boolean => {
  let i = 0
  const len = sql.length
  let foundOne = false

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

    // Semicolon
    if (ch === ';') {
      if (foundOne) {
        // Found a second statement boundary
        return true
      }
      // Check if there is non-whitespace content after the semicolon
      let j = i + 1
      while (j < len && /\s/.test(sql[j])) {
        j++
      }
      if (j < len) {
        // There is content after the semicolon: check if it is a real statement
        // (not just a trailing comment or whitespace)
        const remaining = sql.substring(j).trim()
        if (remaining.length > 0) {
          foundOne = true
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
  const isExecuting = ref(false)
  const error = ref<string | null>(null)

  const getQueryName = (sql: string): string => {
    // Extract a meaningful name from the SQL
    const trimmed = sql.trim().replace(/\s+/g, ' ')
    // Truncate to first 50 chars
    return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed
  }

  const executeQuery = async (sql: string, tabId?: string): Promise<QueryResult | null> => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) {
      error.value = 'No active connection'
      return null
    }

    // Check if the SQL contains multiple statements
    if (hasMultipleStatements(sql)) {
      return executeMultipleQueries(sql, tabId)
    }

    isExecuting.value = true
    error.value = null

    if (tabId) {
      tabsStore.setTabExecuting(tabId, true)
    }

    try {
      const result = await window.api.query.execute(connectionId, sql)

      if (tabId) {
        // Clear multi-result state and set single result
        tabsStore.updateTabData(tabId, { results: undefined, activeResultIndex: undefined } as any)
        tabsStore.setTabResult(tabId, result)
      }

      if (result.error) {
        error.value = result.error
      }

      // Save to history
      await window.api.history.add(
        connectionId,
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

      // Save failed query to history too
      await window.api.history.add(connectionId, sql, 0, 0, error.value)

      return null
    } finally {
      isExecuting.value = false
      if (tabId) {
        tabsStore.setTabExecuting(tabId, false)
      }
    }
  }

  const executeMultipleQueries = async (sql: string, tabId?: string): Promise<QueryResult | null> => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) {
      error.value = 'No active connection'
      return null
    }

    isExecuting.value = true
    error.value = null

    if (tabId) {
      tabsStore.setTabExecuting(tabId, true)
    }

    try {
      const multiResult: MultiQueryResult = await window.api.query.executeMultiple(connectionId, sql)

      if (tabId) {
        tabsStore.setTabResults(tabId, multiResult.results)
      }

      // Check if any result has an error
      const firstError = multiResult.results.find(r => r.error)
      if (firstError) {
        error.value = firstError.error || null
      }

      // Save to history with total execution time and combined row count
      const totalRows = multiResult.results.reduce((sum, r) => sum + (r.rowCount || 0), 0)
      const firstErrorMsg = multiResult.results.find(r => r.error)?.error
      await window.api.history.add(
        connectionId,
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

      // Return the first result for backward compatibility
      return multiResult.results.length > 0 ? multiResult.results[0] : null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Query execution failed'

      // Save failed query to history too
      await window.api.history.add(connectionId, sql, 0, 0, error.value)

      return null
    } finally {
      isExecuting.value = false
      if (tabId) {
        tabsStore.setTabExecuting(tabId, false)
      }
    }
  }

  const cancelQuery = async (): Promise<boolean> => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return false

    try {
      return await window.api.query.cancel(connectionId)
    } catch {
      return false
    }
  }

  const createQueryTab = (sql = '') => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createQueryTab(connectionId, sql)
  }

  const getHistory = async (limit = 100): Promise<QueryHistoryItem[]> => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return []
    return window.api.history.list(connectionId, limit)
  }

  const clearHistory = async (): Promise<void> => {
    const connectionId = connectionsStore.activeConnectionId
    if (connectionId) {
      await window.api.history.clear(connectionId)
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
