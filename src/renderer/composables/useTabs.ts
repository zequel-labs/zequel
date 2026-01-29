import { computed } from 'vue'
import { useTabsStore, type Tab } from '../stores/tabs'
import { useConnectionsStore } from '../stores/connections'

export function useTabs() {
  const tabsStore = useTabsStore()
  const connectionsStore = useConnectionsStore()

  const tabs = computed(() => tabsStore.tabs)
  const activeTab = computed(() => tabsStore.activeTab)
  const activeTabId = computed(() => tabsStore.activeTabId)
  const hasUnsavedChanges = computed(() => tabsStore.hasUnsavedChanges)

  function openQueryTab(sql = '') {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createQueryTab(connectionId, sql)
  }

  function openTableTab(tableName: string, database?: string, schema?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createTableTab(connectionId, tableName, database, schema)
  }

  function openViewTab(viewName: string, database?: string, schema?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createViewTab(connectionId, viewName, database, schema)
  }

  function openERDiagramTab(database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createERDiagramTab(connectionId, database)
  }

  function openRoutineTab(
    routineName: string,
    routineType: 'PROCEDURE' | 'FUNCTION',
    database?: string,
    schema?: string
  ) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createRoutineTab(connectionId, routineName, routineType, database, schema)
  }

  function openUsersTab(database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createUsersTab(connectionId, database)
  }

  function openMonitoringTab(database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createMonitoringTab(connectionId, database)
  }

  function openEventTab(eventName: string, database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createEventTab(connectionId, eventName, database)
  }

  function openTriggerTab(
    triggerName: string,
    tableName: string,
    database?: string,
    schema?: string
  ) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createTriggerTab(connectionId, triggerName, tableName, database, schema)
  }

  // PostgreSQL-specific tab functions
  function openSequenceTab(sequenceName: string, schema?: string, database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createSequenceTab(connectionId, sequenceName, schema, database)
  }

  function openMaterializedViewTab(viewName: string, schema?: string, database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createMaterializedViewTab(connectionId, viewName, schema, database)
  }

  function openExtensionsTab(database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createExtensionsTab(connectionId, database)
  }

  function openEnumsTab(schema?: string, database?: string) {
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) return null
    return tabsStore.createEnumsTab(connectionId, schema, database)
  }

  function closeTab(id: string) {
    tabsStore.closeTab(id)
  }

  function closeAllTabs() {
    tabsStore.closeAllTabs()
  }

  function closeOtherTabs(id: string) {
    tabsStore.closeOtherTabs(id)
  }

  function setActiveTab(id: string) {
    tabsStore.setActiveTab(id)
  }

  function updateTabTitle(id: string, title: string) {
    tabsStore.updateTab(id, { title })
  }

  function setTabSql(id: string, sql: string) {
    tabsStore.setTabSql(id, sql)
  }

  function setTableView(id: string, view: 'data' | 'structure' | 'ddl') {
    tabsStore.setTableView(id, view)
  }

  function setViewView(id: string, view: 'data' | 'ddl') {
    tabsStore.setViewView(id, view)
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
    setTableView,
    setViewView
  }
}
