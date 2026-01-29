import { ref } from 'vue'
import { useConnectionsStore } from '../stores/connections'
import { useTabsStore } from '../stores/tabs'
import type { QueryResult, QueryHistoryItem } from '../types/query'

export function useQuery() {
  const connectionsStore = useConnectionsStore()
  const tabsStore = useTabsStore()
  const isExecuting = ref(false)
  const error = ref<string | null>(null)

  async function executeQuery(sql: string, tabId?: string): Promise<QueryResult | null> {
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
      const result = await window.api.query.execute(connectionId, sql)

      if (tabId) {
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
