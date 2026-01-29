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

  return {
    tabs,
    activeTab,
    activeTabId,
    hasUnsavedChanges,
    openQueryTab,
    openTableTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    setActiveTab,
    updateTabTitle,
    setTabSql,
    setTableView
  }
}
