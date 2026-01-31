import { computed } from 'vue'
import { useTabsStore, type Tab } from '../stores/tabs'
import { useConnectionsStore } from '../stores/connections'
import { RoutineType } from '../types/table'

export const useTabs = () => {
  const tabsStore = useTabsStore()
  const connectionsStore = useConnectionsStore()

  const tabs = computed(() => tabsStore.tabs)
  const activeTab = computed(() => tabsStore.activeTab)
  const activeTabId = computed(() => tabsStore.activeTabId)
  const hasUnsavedChanges = computed(() => tabsStore.hasUnsavedChanges)

  const openQueryTab = (sql = '') => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createQueryTab(connectionId, sql)
  }

  const openTableTab = (tableName: string, database?: string, schema?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createTableTab(connectionId, tableName, database, schema)
  }

  const openViewTab = (viewName: string, database?: string, schema?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createViewTab(connectionId, viewName, database, schema)
  }

  const openERDiagramTab = (database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createERDiagramTab(connectionId, database)
  }

  const openRoutineTab = (
    routineName: string,
    routineType: RoutineType,
    database?: string,
    schema?: string
  ) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createRoutineTab(connectionId, routineName, routineType, database, schema)
  }

  const openUsersTab = (database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createUsersTab(connectionId, database)
  }

  const openMonitoringTab = (database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createMonitoringTab(connectionId, database)
  }

  const openEventTab = (eventName: string, database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createEventTab(connectionId, eventName, database)
  }

  const openTriggerTab = (
    triggerName: string,
    tableName: string,
    database?: string,
    schema?: string
  ) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createTriggerTab(connectionId, triggerName, tableName, database, schema)
  }

  // PostgreSQL-specific tab functions
  const openSequenceTab = (sequenceName: string, schema?: string, database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createSequenceTab(connectionId, sequenceName, schema, database)
  }

  const openMaterializedViewTab = (viewName: string, schema?: string, database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createMaterializedViewTab(connectionId, viewName, schema, database)
  }

  const openExtensionsTab = (database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createExtensionsTab(connectionId, database)
  }

  const openEnumsTab = (schema?: string, database?: string) => {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createEnumsTab(connectionId, schema, database)
  }

  const closeTab = (id: string) => {
    tabsStore.closeTab(id)
  }

  const closeAllTabs = () => {
    tabsStore.closeAllTabs()
  }

  const closeOtherTabs = (id: string) => {
    tabsStore.closeOtherTabs(id)
  }

  const setActiveTab = (id: string) => {
    tabsStore.setActiveTab(id)
  }

  const updateTabTitle = (id: string, title: string) => {
    tabsStore.updateTab(id, { title })
  }

  const setTabSql = (id: string, sql: string) => {
    tabsStore.setTabSql(id, sql)
  }

  const setTableView = (id: string, view: 'data' | 'structure') => {
    tabsStore.setTableView(id, view)
  }

  return {
    tabs,
    activeTab,
    activeTabId,
    hasUnsavedChanges,
    openQueryTab,
    openTableTab,
    openViewTab,
    openERDiagramTab,
    openRoutineTab,
    openUsersTab,
    openMonitoringTab,
    openEventTab,
    openTriggerTab,
    openSequenceTab,
    openMaterializedViewTab,
    openExtensionsTab,
    openEnumsTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    setActiveTab,
    updateTabTitle,
    setTabSql,
    setTableView
  }
}
