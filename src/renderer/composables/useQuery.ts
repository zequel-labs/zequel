import { ref } from 'vue'
import { useConnectionsStore } from '../stores/connections'
import { useTabsStore, type QueryPlan } from '../stores/tabs'
import { useRecentsStore } from '../stores/recents'
import type { QueryResult, MultiQueryResult, QueryHistoryItem } from '../types/query'

/**
 * Checks whether a SQL string contains multiple statements.
 * This is a lightweight check that looks for semicolons outside of
 * quoted strings and comments.
 */
function hasMultipleStatements(sql: string): boolean {
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

export function useQuery() {
  const connectionsStore = useConnectionsStore()
  const tabsStore = useTabsStore()
  const recentsStore = useRecentsStore()
  const isExplaining = ref(false)
  const isExecuting = ref(false)
  const error = ref<string | null>(null)

  function getQueryName(sql: string): string {
    // Extract a meaningful name from the SQL
    const trimmed = sql.trim().replace(/\s+/g, ' ')
    // Truncate to first 50 chars
    return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed
  }

  async function executeQuery(sql: string, tabId?: string): Promise<QueryResult | null> {
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
        const connection = connectionsStore.connections.find(c => c.id === connectionId)
        recentsStore.addRecentQuery(getQueryName(sql), sql, connectionId, connection?.database)
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

  async function executeMultipleQueries(sql: string, tabId?: string): Promise<QueryResult | null> {
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
      const connection = connectionsStore.connections.find(c => c.id === connectionId)
      for (const result of multiResult.results) {
        if (!result.error) {
          recentsStore.addRecentQuery(getQueryName(sql), sql, connectionId, connection?.database)
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

  async function cancelQuery(): Promise<boolean> {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return false

    try {
      return await window.api.query.cancel(connectionId)
    } catch {
      return false
    }
  }

  function createQueryTab(sql = '') {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createQueryTab(connectionId, sql)
  }

  async function getHistory(limit = 100): Promise<QueryHistoryItem[]> {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return []
    return window.api.history.list(connectionId, limit)
  }

  async function clearHistory(): Promise<void> {
    const connectionId = connectionsStore.activeConnectionId
    if (connectionId) {
      await window.api.history.clear(connectionId)
    }
  }

  async function explainQuery(sql: string, tabId?: string, analyze = false): Promise<QueryPlan | null> {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) {
      error.value = 'No active connection'
      return null
    }

    // Get the connection type to generate the correct EXPLAIN syntax
    const connection = connectionsStore.connections.find((c) => c.id === connectionId)
    if (!connection) {
      error.value = 'Connection not found'
      return null
    }

    isExplaining.value = true
    error.value = null

    try {
      let explainSql: string

      // Generate EXPLAIN query based on database type
      switch (connection.type) {
        case 'postgresql':
          explainSql = analyze
            ? `EXPLAIN (ANALYZE, COSTS, VERBOSE, BUFFERS, FORMAT JSON) ${sql}`
            : `EXPLAIN (COSTS, VERBOSE, FORMAT JSON) ${sql}`
          break
        case 'mysql':
          explainSql = analyze
            ? `EXPLAIN ANALYZE ${sql}`
            : `EXPLAIN FORMAT=JSON ${sql}`
          break
        case 'mariadb':
          explainSql = analyze
            ? `ANALYZE ${sql}`
            : `EXPLAIN ${sql}`
          break
        case 'sqlite':
          explainSql = `EXPLAIN QUERY PLAN ${sql}`
          break
        case 'clickhouse':
          explainSql = analyze
            ? `EXPLAIN PIPELINE ${sql}`
            : `EXPLAIN ${sql}`
          break
        default:
          error.value = `EXPLAIN is not supported for ${connection.type} connections`
          return null
      }

      const result = await window.api.query.execute(connectionId, explainSql)

      if (result.error) {
        error.value = result.error
        return null
      }

      // Parse the result based on database type
      let plan: QueryPlan

      if (connection.type === 'postgresql' || (connection.type === 'mysql' && !analyze)) {
        // JSON format results (PostgreSQL always, MySQL non-ANALYZE)
        const columns = result.columns.map((c) => c.name)
        let planText = ''

        // Try to extract the JSON plan
        if (result.rows.length > 0) {
          const firstRow = result.rows[0]
          const firstValue = Object.values(firstRow)[0]
          if (typeof firstValue === 'string') {
            try {
              const parsed = JSON.parse(firstValue)
              planText = JSON.stringify(parsed, null, 2)
            } catch {
              planText = firstValue
            }
          } else if (typeof firstValue === 'object') {
            planText = JSON.stringify(firstValue, null, 2)
          }
        }

        plan = {
          rows: result.rows,
          columns,
          planText
        }
      } else if (connection.type === 'sqlite') {
        // SQLite returns rows with id, parent, notused, detail
        plan = {
          rows: result.rows,
          columns: result.columns.map((c) => c.name),
          planText: result.rows
            .map((r) => `${r.id}: ${r.detail}`)
            .join('\n')
        }
      } else if (connection.type === 'clickhouse') {
        // ClickHouse returns text-based plan output
        const columns = result.columns.map((c) => c.name)
        const planText = result.rows
          .map((r) => Object.values(r).join(' '))
          .join('\n')

        plan = {
          rows: result.rows,
          columns,
          planText
        }
      } else {
        // MariaDB and MySQL ANALYZE, and other fallbacks - tabular format
        const columns = result.columns.map((c) => c.name)
        const planText = result.rows
          .map((r) => columns.map((c) => `${c}: ${r[c]}`).join(', '))
          .join('\n')

        plan = {
          rows: result.rows,
          columns,
          planText
        }
      }

      if (tabId) {
        tabsStore.setTabQueryPlan(tabId, plan)
        tabsStore.setTabShowPlan(tabId, true)
      }

      return plan
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'EXPLAIN failed'
      return null
    } finally {
      isExplaining.value = false
    }
  }

  return {
    isExecuting,
    isExplaining,
    error,
    executeQuery,
    explainQuery,
    cancelQuery,
    createQueryTab,
    getHistory,
    clearHistory
  }
}
