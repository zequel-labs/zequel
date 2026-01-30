import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../lib/utils'
import type { QueryResult } from '../types/query'

export type TabType = 'query' | 'table' | 'view' | 'er-diagram' | 'routine' | 'users' | 'monitoring' | 'trigger' | 'event' | 'sequence' | 'materialized-view' | 'extensions' | 'enums'

export interface QueryPlan {
  rows: Record<string, unknown>[]
  columns: string[]
  planText?: string
}

export interface QueryTabData {
  type: 'query'
  connectionId: string
  sql: string
  result?: QueryResult
  results?: QueryResult[]
  activeResultIndex?: number
  queryPlan?: QueryPlan
  isExecuting: boolean
  isDirty: boolean
  showPlan?: boolean
}

export interface TableTabData {
  type: 'table'
  connectionId: string
  tableName: string
  database?: string
  schema?: string
  activeView: 'data' | 'structure'
}

export interface ViewTabData {
  type: 'view'
  connectionId: string
  viewName: string
  database?: string
  schema?: string
}

export interface ERDiagramTabData {
  type: 'er-diagram'
  connectionId: string
  database?: string
}

export interface RoutineTabData {
  type: 'routine'
  connectionId: string
  routineName: string
  routineType: 'PROCEDURE' | 'FUNCTION'
  database?: string
  schema?: string
}

export interface UsersTabData {
  type: 'users'
  connectionId: string
  database?: string
}

export interface MonitoringTabData {
  type: 'monitoring'
  connectionId: string
  database?: string
}

export interface TriggerTabData {
  type: 'trigger'
  connectionId: string
  triggerName: string
  tableName: string
  database?: string
  schema?: string
}

export interface EventTabData {
  type: 'event'
  connectionId: string
  eventName: string
  database?: string
}

// PostgreSQL-specific tab types
export interface SequenceTabData {
  type: 'sequence'
  connectionId: string
  sequenceName: string
  schema?: string
  database?: string
}

export interface MaterializedViewTabData {
  type: 'materialized-view'
  connectionId: string
  viewName: string
  schema?: string
  database?: string
  activeView: 'data'
}

export interface ExtensionsTabData {
  type: 'extensions'
  connectionId: string
  database?: string
}

export interface EnumsTabData {
  type: 'enums'
  connectionId: string
  schema?: string
  database?: string
}

export type TabData = QueryTabData | TableTabData | ViewTabData | ERDiagramTabData | RoutineTabData | UsersTabData | MonitoringTabData | TriggerTabData | EventTabData | SequenceTabData | MaterializedViewTabData | ExtensionsTabData | EnumsTabData

export interface Tab {
  id: string
  title: string
  data: TabData
}

export const useTabsStore = defineStore('tabs', () => {
  // State
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  // Getters
  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.find((t) => t.id === activeTabId.value) || null
  })

  const queryTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'query')
  })

  const tableTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'table')
  })

  const viewTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'view')
  })

  const erDiagramTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'er-diagram')
  })

  const routineTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'routine')
  })

  const usersTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'users')
  })

  const monitoringTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'monitoring')
  })

  const triggerTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'trigger')
  })

  const eventTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === 'event')
  })

  const hasUnsavedChanges = computed(() => {
    return tabs.value.some((t) => t.data.type === 'query' && t.data.isDirty)
  })

  // Actions
  function createQueryTab(connectionId: string, sql = '', title?: string): Tab {
    const id = generateId()
    const queryCount = queryTabs.value.length + 1
    const tab: Tab = {
      id,
      title: title || `Query ${queryCount}`,
      data: {
        type: 'query',
        connectionId,
        sql,
        isExecuting: false,
        isDirty: false
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createTableTab(
    connectionId: string,
    tableName: string,
    database?: string,
    schema?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'table' &&
        t.data.connectionId === connectionId &&
        t.data.tableName === tableName
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: tableName,
      data: {
        type: 'table',
        connectionId,
        tableName,
        database,
        schema,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createViewTab(
    connectionId: string,
    viewName: string,
    database?: string,
    schema?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'view' &&
        t.data.connectionId === connectionId &&
        t.data.viewName === viewName
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: viewName,
      data: {
        type: 'view',
        connectionId,
        viewName,
        database,
        schema,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createERDiagramTab(connectionId: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'er-diagram' &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'ER Diagram',
      data: {
        type: 'er-diagram',
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createRoutineTab(
    connectionId: string,
    routineName: string,
    routineType: 'PROCEDURE' | 'FUNCTION',
    database?: string,
    schema?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'routine' &&
        t.data.connectionId === connectionId &&
        t.data.routineName === routineName &&
        t.data.routineType === routineType
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${routineName} (${routineType === 'PROCEDURE' ? 'SP' : 'FN'})`,
      data: {
        type: 'routine',
        connectionId,
        routineName,
        routineType,
        database,
        schema
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createUsersTab(connectionId: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'users' &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Users',
      data: {
        type: 'users',
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createMonitoringTab(connectionId: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'monitoring' &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Process Monitor',
      data: {
        type: 'monitoring',
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  // PostgreSQL-specific tab functions
  function createSequenceTab(
    connectionId: string,
    sequenceName: string,
    schema?: string,
    database?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'sequence' &&
        t.data.connectionId === connectionId &&
        t.data.sequenceName === sequenceName &&
        t.data.schema === schema
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${sequenceName} (SEQ)`,
      data: {
        type: 'sequence',
        connectionId,
        sequenceName,
        schema,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createMaterializedViewTab(
    connectionId: string,
    viewName: string,
    schema?: string,
    database?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'materialized-view' &&
        t.data.connectionId === connectionId &&
        t.data.viewName === viewName &&
        t.data.schema === schema
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${viewName} (MV)`,
      data: {
        type: 'materialized-view',
        connectionId,
        viewName,
        schema,
        database,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createExtensionsTab(connectionId: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'extensions' &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Extensions',
      data: {
        type: 'extensions',
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createEnumsTab(connectionId: string, schema?: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'enums' &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Enums',
      data: {
        type: 'enums',
        connectionId,
        schema,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function createTriggerTab(
    connectionId: string,
    triggerName: string,
    tableName: string,
    database?: string,
    schema?: string
  ): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'trigger' &&
        t.data.connectionId === connectionId &&
        t.data.triggerName === triggerName &&
        t.data.tableName === tableName
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${triggerName} (Trigger)`,
      data: {
        type: 'trigger',
        connectionId,
        triggerName,
        tableName,
        database,
        schema
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  // MySQL-specific: Event tab
  function createEventTab(connectionId: string, eventName: string, database?: string): Tab {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === 'event' &&
        t.data.connectionId === connectionId &&
        t.data.eventName === eventName
    )
    if (existing) {
      activeTabId.value = existing.id
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${eventName} (Event)`,
      data: {
        type: 'event',
        connectionId,
        eventName,
        database
      }
    }
    tabs.value.push(tab)
    activeTabId.value = id
    return tab
  }

  function closeTab(id: string) {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return

    tabs.value.splice(index, 1)

    // Update active tab
    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        // Activate the previous tab, or the first one
        const newIndex = Math.min(index, tabs.value.length - 1)
        activeTabId.value = tabs.value[newIndex].id
      } else {
        activeTabId.value = null
      }
    }
  }

  function closeAllTabs() {
    tabs.value = []
    activeTabId.value = null
  }

  function closeOtherTabs(id: string) {
    tabs.value = tabs.value.filter((t) => t.id === id)
    activeTabId.value = id
  }

  function closeTabsForConnection(connectionId: string) {
    tabs.value = tabs.value.filter((t) => t.data.connectionId !== connectionId)
    if (activeTabId.value) {
      const activeExists = tabs.value.some((t) => t.id === activeTabId.value)
      if (!activeExists) {
        activeTabId.value = tabs.value[0]?.id || null
      }
    }
  }

  function setActiveTab(id: string) {
    activeTabId.value = id
  }

  function updateTab(id: string, updates: Partial<Tab>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      Object.assign(tab, updates)
    }
  }

  function updateTabData(id: string, updates: Partial<TabData>) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      Object.assign(tab.data, updates)
    }
  }

  function setTabSql(id: string, sql: string) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.sql = sql
      tab.data.isDirty = true
    }
  }

  function setTabResult(id: string, result: QueryResult | undefined) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.result = result
    }
  }

  function setTabExecuting(id: string, isExecuting: boolean) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.isExecuting = isExecuting
    }
  }

  function setTableView(id: string, view: 'data' | 'structure') {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'table') {
      tab.data.activeView = view
    }
  }

  function setTabResults(id: string, results: QueryResult[]) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.results = results
      tab.data.activeResultIndex = 0
      // Also set the first result as the active single result for backward compatibility
      tab.data.result = results.length > 0 ? results[0] : undefined
    }
  }

  function setTabActiveResultIndex(id: string, index: number) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.activeResultIndex = index
      // Update the active single result to match
      if (tab.data.results && index >= 0 && index < tab.data.results.length) {
        tab.data.result = tab.data.results[index]
      }
    }
  }

  function setTabQueryPlan(id: string, plan: QueryPlan | undefined) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.queryPlan = plan
    }
  }

  function reorderTabs(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= tabs.value.length) return
    if (toIndex < 0 || toIndex >= tabs.value.length) return

    const newTabs = [...tabs.value]
    const [movedTab] = newTabs.splice(fromIndex, 1)
    newTabs.splice(toIndex, 0, movedTab)
    tabs.value = newTabs
  }

  function setTabShowPlan(id: string, show: boolean) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.showPlan = show
    }
  }

  // --- Tab Persistence ---

  /**
   * Save current tabs for a connection to the app database.
   * Strips query results and transient state to keep payloads small.
   */
  function saveTabSession(connectionId: string, database: string): void {
    const connectionTabs = tabs.value.filter(t => t.data.connectionId === connectionId)
    if (connectionTabs.length === 0) {
      // No tabs for this connection; delete any saved session
      window.api.tabs.delete(connectionId, database)
      return
    }

    const serializableTabs = connectionTabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      data: {
        ...tab.data,
        // Strip query results, execution state, and query plan for query tabs
        ...(tab.data.type === 'query'
          ? {
              result: undefined,
              results: undefined,
              activeResultIndex: undefined,
              isExecuting: false,
              queryPlan: undefined,
              showPlan: undefined
            }
          : {})
      }
    }))

    const tabsJson = JSON.stringify(serializableTabs)
    window.api.tabs.save(connectionId, database, tabsJson, activeTabId.value)
  }

  /**
   * Restore tabs for a connection from the app database.
   * Returns true if tabs were restored, false otherwise.
   */
  async function restoreTabSession(connectionId: string, database: string): Promise<boolean> {
    try {
      const session = await window.api.tabs.load(connectionId, database)
      if (!session || !session.tabs_json) return false

      const savedTabs = JSON.parse(session.tabs_json) as Tab[]
      if (!Array.isArray(savedTabs) || savedTabs.length === 0) return false

      for (const tab of savedTabs) {
        // Don't add if a tab with the same ID already exists
        if (!tabs.value.find(t => t.id === tab.id)) {
          // Ensure query tabs have correct default state after restore
          if (tab.data.type === 'query') {
            tab.data.isExecuting = false
            tab.data.result = undefined
            tab.data.results = undefined
            tab.data.activeResultIndex = undefined
            tab.data.queryPlan = undefined
            tab.data.showPlan = undefined
          }
          tabs.value.push(tab)
        }
      }

      // Restore active tab if it exists in the restored set
      if (session.active_tab_id && tabs.value.find(t => t.id === session.active_tab_id)) {
        activeTabId.value = session.active_tab_id
      } else if (savedTabs.length > 0) {
        // Fall back to the first restored tab
        const firstRestored = tabs.value.find(t => t.data.connectionId === connectionId)
        if (firstRestored) {
          activeTabId.value = firstRestored.id
        }
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Delete the saved tab session for a connection.
   */
  function deleteTabSession(connectionId: string, database: string): void {
    window.api.tabs.delete(connectionId, database)
  }

  return {
    // State
    tabs,
    activeTabId,
    // Getters
    activeTab,
    queryTabs,
    tableTabs,
    viewTabs,
    erDiagramTabs,
    routineTabs,
    usersTabs,
    monitoringTabs,
    hasUnsavedChanges,
    // Actions
    createQueryTab,
    createTableTab,
    createViewTab,
    createERDiagramTab,
    createRoutineTab,
    createUsersTab,
    createMonitoringTab,
    createTriggerTab,
    triggerTabs,
    createEventTab,
    eventTabs,
    createSequenceTab,
    createMaterializedViewTab,
    createExtensionsTab,
    createEnumsTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsForConnection,
    setActiveTab,
    updateTab,
    updateTabData,
    setTabSql,
    setTabResult,
    setTabResults,
    setTabActiveResultIndex,
    setTabExecuting,
    setTableView,
    setTabQueryPlan,
    setTabShowPlan,
    reorderTabs,
    // Tab persistence
    saveTabSession,
    restoreTabSession,
    deleteTabSession
  }
})
