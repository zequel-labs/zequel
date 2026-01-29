import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { generateId } from '../lib/utils'
import type { QueryResult } from '../types/query'

export type TabType = 'query' | 'table' | 'view' | 'er-diagram' | 'routine' | 'users'

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
  activeView: 'data' | 'structure' | 'ddl'
}

export interface ViewTabData {
  type: 'view'
  connectionId: string
  viewName: string
  database?: string
  schema?: string
  activeView: 'data' | 'ddl'
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

export type TabData = QueryTabData | TableTabData | ViewTabData | ERDiagramTabData | RoutineTabData | UsersTabData

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

  function setTableView(id: string, view: 'data' | 'structure' | 'ddl') {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'table') {
      tab.data.activeView = view
    }
  }

  function setViewView(id: string, view: 'data' | 'ddl') {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'view') {
      tab.data.activeView = view
    }
  }

  function setTabQueryPlan(id: string, plan: QueryPlan | undefined) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.queryPlan = plan
    }
  }

  function setTabShowPlan(id: string, show: boolean) {
    const tab = tabs.value.find((t) => t.id === id)
    if (tab && tab.data.type === 'query') {
      tab.data.showPlan = show
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
    hasUnsavedChanges,
    // Actions
    createQueryTab,
    createTableTab,
    createViewTab,
    createERDiagramTab,
    createRoutineTab,
    createUsersTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsForConnection,
    setActiveTab,
    updateTab,
    updateTabData,
    setTabSql,
    setTabResult,
    setTabExecuting,
    setTableView,
    setViewView,
    setTabQueryPlan,
    setTabShowPlan
  }
})
