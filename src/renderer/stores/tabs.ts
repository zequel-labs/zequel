import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../lib/utils'
import type { QueryResult } from '../types/query'
import { TabType, RoutineType } from '../types/table'

export { TabType }

export interface QueryPlan {
  rows: Record<string, unknown>[]
  columns: string[]
  planText?: string
}

export interface QueryTabData {
  type: TabType.Query
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
  type: TabType.Table
  connectionId: string
  tableName: string
  database?: string
  schema?: string
  activeView: 'data' | 'structure'
}

export interface ViewTabData {
  type: TabType.View
  connectionId: string
  viewName: string
  database?: string
  schema?: string
  activeView?: 'data'
}

export interface ERDiagramTabData {
  type: TabType.ERDiagram
  connectionId: string
  database?: string
}

export interface RoutineTabData {
  type: TabType.Routine
  connectionId: string
  routineName: string
  routineType: RoutineType
  database?: string
  schema?: string
}

export interface UsersTabData {
  type: TabType.Users
  connectionId: string
  database?: string
}

export interface MonitoringTabData {
  type: TabType.Monitoring
  connectionId: string
  database?: string
}

export interface TriggerTabData {
  type: TabType.Trigger
  connectionId: string
  triggerName: string
  tableName: string
  database?: string
  schema?: string
}

export interface EventTabData {
  type: TabType.Event
  connectionId: string
  eventName: string
  database?: string
}

// PostgreSQL-specific tab types
export interface SequenceTabData {
  type: TabType.Sequence
  connectionId: string
  sequenceName: string
  schema?: string
  database?: string
}

export interface MaterializedViewTabData {
  type: TabType.MaterializedView
  connectionId: string
  viewName: string
  schema?: string
  database?: string
  activeView: 'data'
}

export interface ExtensionsTabData {
  type: TabType.Extensions
  connectionId: string
  database?: string
}

export interface EnumsTabData {
  type: TabType.Enums
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
  // Track the last active tab per connection so switching connections restores the right tab
  const perConnectionActiveTab = new Map<string, string>()

  // Getters
  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.find((t) => t.id === activeTabId.value) || null
  })

  const queryTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Query)
  })

  const tableTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Table)
  })

  const viewTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.View)
  })

  const erDiagramTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.ERDiagram)
  })

  const routineTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Routine)
  })

  const usersTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Users)
  })

  const monitoringTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Monitoring)
  })

  const triggerTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Trigger)
  })

  const eventTabs = computed(() => {
    return tabs.value.filter((t) => t.data.type === TabType.Event)
  })

  const hasUnsavedChanges = computed(() => {
    return tabs.value.some((t) => t.data.type === TabType.Query && t.data.isDirty)
  })

  // Actions
  const createQueryTab = (connectionId: string, sql = '', title?: string): Tab => {
    const id = generateId()
    const queryCount = queryTabs.value.length + 1
    const tab: Tab = {
      id,
      title: title || `Query ${queryCount}`,
      data: {
        type: TabType.Query,
        connectionId,
        sql,
        isExecuting: false,
        isDirty: false
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createTableTab = (
    connectionId: string,
    tableName: string,
    database?: string,
    schema?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Table &&
        t.data.connectionId === connectionId &&
        t.data.tableName === tableName
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: tableName,
      data: {
        type: TabType.Table,
        connectionId,
        tableName,
        database,
        schema,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createViewTab = (
    connectionId: string,
    viewName: string,
    database?: string,
    schema?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.View &&
        t.data.connectionId === connectionId &&
        t.data.viewName === viewName
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: viewName,
      data: {
        type: TabType.View,
        connectionId,
        viewName,
        database,
        schema,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createERDiagramTab = (connectionId: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.ERDiagram &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'ER Diagram',
      data: {
        type: TabType.ERDiagram,
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createRoutineTab = (
    connectionId: string,
    routineName: string,
    routineType: RoutineType,
    database?: string,
    schema?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Routine &&
        t.data.connectionId === connectionId &&
        t.data.routineName === routineName &&
        t.data.routineType === routineType
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${routineName} (${routineType === RoutineType.Procedure ? 'SP' : 'FN'})`,
      data: {
        type: TabType.Routine,
        connectionId,
        routineName,
        routineType,
        database,
        schema
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createUsersTab = (connectionId: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Users &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Users',
      data: {
        type: TabType.Users,
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createMonitoringTab = (connectionId: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Monitoring &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Process Monitor',
      data: {
        type: TabType.Monitoring,
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  // PostgreSQL-specific tab functions
  const createSequenceTab = (
    connectionId: string,
    sequenceName: string,
    schema?: string,
    database?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Sequence &&
        t.data.connectionId === connectionId &&
        t.data.sequenceName === sequenceName &&
        t.data.schema === schema
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${sequenceName} (SEQ)`,
      data: {
        type: TabType.Sequence,
        connectionId,
        sequenceName,
        schema,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createMaterializedViewTab = (
    connectionId: string,
    viewName: string,
    schema?: string,
    database?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.MaterializedView &&
        t.data.connectionId === connectionId &&
        t.data.viewName === viewName &&
        t.data.schema === schema
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${viewName} (MV)`,
      data: {
        type: TabType.MaterializedView,
        connectionId,
        viewName,
        schema,
        database,
        activeView: 'data'
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createExtensionsTab = (connectionId: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Extensions &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Extensions',
      data: {
        type: TabType.Extensions,
        connectionId,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createEnumsTab = (connectionId: string, schema?: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Enums &&
        t.data.connectionId === connectionId
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: 'Enums',
      data: {
        type: TabType.Enums,
        connectionId,
        schema,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const createTriggerTab = (
    connectionId: string,
    triggerName: string,
    tableName: string,
    database?: string,
    schema?: string
  ): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Trigger &&
        t.data.connectionId === connectionId &&
        t.data.triggerName === triggerName &&
        t.data.tableName === tableName
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${triggerName} (Trigger)`,
      data: {
        type: TabType.Trigger,
        connectionId,
        triggerName,
        tableName,
        database,
        schema
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  // MySQL-specific: Event tab
  const createEventTab = (connectionId: string, eventName: string, database?: string): Tab => {
    // Check if tab already exists
    const existing = tabs.value.find(
      (t) =>
        t.data.type === TabType.Event &&
        t.data.connectionId === connectionId &&
        t.data.eventName === eventName
    )
    if (existing) {
      setActiveTab(existing.id)
      return existing
    }

    const id = generateId()
    const tab: Tab = {
      id,
      title: `${eventName} (Event)`,
      data: {
        type: TabType.Event,
        connectionId,
        eventName,
        database
      }
    }
    tabs.value.push(tab)
    setActiveTab(id)
    return tab
  }

  const closeTab = (id: string) => {
    const index = tabs.value.findIndex((t) => t.id === id)
    if (index < 0) return

    tabs.value.splice(index, 1)

    // Update active tab
    if (activeTabId.value === id) {
      if (tabs.value.length > 0) {
        // Activate the previous tab, or the first one
        const newIndex = Math.min(index, tabs.value.length - 1)
        setActiveTab(tabs.value[newIndex].id)
      } else {
        activeTabId.value = null
      }
    }
  }

  const closeAllTabs = () => {
    tabs.value = []
    activeTabId.value = null
  }

  const closeOtherTabs = (id: string) => {
    tabs.value = tabs.value.filter((t) => t.id === id)
    setActiveTab(id)
  }

  const closeTabsForConnection = (connectionId: string) => {
    tabs.value = tabs.value.filter((t) => t.data.connectionId !== connectionId)
    perConnectionActiveTab.delete(connectionId)
    if (activeTabId.value) {
      const activeExists = tabs.value.some((t) => t.id === activeTabId.value)
      if (!activeExists) {
        activeTabId.value = tabs.value[0]?.id || null
      }
    }
  }

  const setActiveTab = (id: string) => {
    activeTabId.value = id
    // Track per-connection active tab
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      perConnectionActiveTab.set(tab.data.connectionId, id)
    }
  }

  const updateTab = (id: string, updates: Partial<Tab>) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      Object.assign(tab, updates)
    }
  }

  const updateTabData = (id: string, updates: Partial<TabData>) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab) {
      Object.assign(tab.data, updates)
    }
  }

  const setTabSql = (id: string, sql: string) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.sql = sql
      tab.data.isDirty = true
    }
  }

  const setTabResult = (id: string, result: QueryResult | undefined) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.result = result
    }
  }

  const setTabExecuting = (id: string, isExecuting: boolean) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.isExecuting = isExecuting
    }
  }

  const setTableView = (id: string, view: 'data' | 'structure') => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Table) {
      tab.data.activeView = view
    }
  }

  const setTabResults = (id: string, results: QueryResult[]) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.results = results
      tab.data.activeResultIndex = 0
      // Also set the first result as the active single result for backward compatibility
      tab.data.result = results.length > 0 ? results[0] : undefined
    }
  }

  const setTabActiveResultIndex = (id: string, index: number) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.activeResultIndex = index
      // Update the active single result to match
      if (tab.data.results && index >= 0 && index < tab.data.results.length) {
        tab.data.result = tab.data.results[index]
      }
    }
  }

  const setTabQueryPlan = (id: string, plan: QueryPlan | undefined) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.queryPlan = plan
    }
  }

  const reorderTabs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= tabs.value.length) return
    if (toIndex < 0 || toIndex >= tabs.value.length) return

    const newTabs = [...tabs.value]
    const [movedTab] = newTabs.splice(fromIndex, 1)
    newTabs.splice(toIndex, 0, movedTab)
    tabs.value = newTabs
  }

  const setTabShowPlan = (id: string, show: boolean) => {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === TabType.Query) {
      tab.data.showPlan = show
    }
  }

  /**
   * Switch the active tab to the last-known tab for a given connection.
   * If no tab is tracked, falls back to the first tab of that connection, or null.
   */
  const switchToConnection = (connectionId: string): void => {
    // Save current active tab for whatever connection owns it
    if (activeTabId.value) {
      const currentTab = tabs.value.find(t => t.id === activeTabId.value)
      if (currentTab) {
        perConnectionActiveTab.set(currentTab.data.connectionId, activeTabId.value)
      }
    }

    // Restore the last active tab for the target connection
    const savedTabId = perConnectionActiveTab.get(connectionId)
    if (savedTabId && tabs.value.some(t => t.id === savedTabId && t.data.connectionId === connectionId)) {
      activeTabId.value = savedTabId
    } else {
      // Fall back to the first tab for this connection
      const firstTab = tabs.value.find(t => t.data.connectionId === connectionId)
      activeTabId.value = firstTab?.id || null
    }
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
    switchToConnection
  }
})
