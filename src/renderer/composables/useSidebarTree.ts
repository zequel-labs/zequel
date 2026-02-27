import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef, type WritableComputedRef } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { usePinnedStore } from '@/stores/pinned'
import { useTabs } from '@/composables/useTabs'
import { useSidebarFolder } from '@/composables/useSidebarFolder'
import { useSidebarStateStore } from '@/stores/sidebarState'
import type { Column, Table } from '@/types/table'
import { TableObjectType } from '@/types/table'

export interface UseSidebarTreeOptions {
  searchFilter: () => string
  onRefresh?: () => void
  onConnectionChange?: () => void
}

export interface UseSidebarTreeReturn {
  connectionsStore: ReturnType<typeof useConnectionsStore>
  pendingChangesStore: ReturnType<typeof usePendingChangesStore>
  pinnedStore: ReturnType<typeof usePinnedStore>
  activeSessionId: ComputedRef<string | null>
  currentDatabase: ComputedRef<string | undefined>
  activeTables: ComputedRef<Table[]>
  activeTablesOnly: ComputedRef<Table[]>
  activeViewsOnly: ComputedRef<Table[]>
  filteredTablesOnly: ComputedRef<Table[]>
  filteredViewsOnly: ComputedRef<Table[]>
  tablesOpen: WritableComputedRef<boolean>
  viewsOpen: WritableComputedRef<boolean>
  expandedTables: Ref<Set<string>>
  tableColumns: Ref<Map<string, Column[]>>
  loadingTableColumns: Ref<Set<string>>
  toggleTableExpand: (tableName: string) => Promise<void>
  togglePin: (table: { name: string; type: string }) => Promise<void>
  handleTableClick: (table: { name: string; type: string }) => void
  loadTableColumns: (tableName: string) => Promise<void>
  expandAll: () => void
  collapseAll: () => void
}

export const useSidebarTree = (options: UseSidebarTreeOptions): UseSidebarTreeReturn => {
  const connectionsStore = useConnectionsStore()
  const pendingChangesStore = usePendingChangesStore()
  const pinnedStore = usePinnedStore()
  const sidebarStateStore = useSidebarStateStore()
  const { openTableTab, openViewTab } = useTabs()

  const activeSessionId = computed(() => connectionsStore.activeSessionId)
  const currentDatabase = computed(() => {
    if (!activeSessionId.value) return undefined
    return connectionsStore.getActiveDatabase(activeSessionId.value) || undefined
  })

  const activeTables = computed(() => {
    if (!activeSessionId.value) return []
    return connectionsStore.tables.get(activeSessionId.value) || []
  })

  const activeTablesOnly = computed(() => activeTables.value.filter(t => t.type === 'table'))
  const activeViewsOnly = computed(() => activeTables.value.filter(t => t.type !== 'table'))

  // Folder collapse state
  const tablesOpen = useSidebarFolder(options.searchFilter, true)
  const viewsOpen = useSidebarFolder(options.searchFilter)

  // Table column expansion state
  const expandedTables = ref<Set<string>>(new Set())
  const tableColumns = ref<Map<string, Column[]>>(new Map())
  const loadingTableColumns = ref<Set<string>>(new Set())

  const filteredTablesOnly = computed(() => {
    const filter = options.searchFilter()
    if (!filter) return activeTablesOnly.value
    const q = filter.toLowerCase()
    return activeTablesOnly.value.filter(t => t.name.toLowerCase().includes(q))
  })

  const filteredViewsOnly = computed(() => {
    const filter = options.searchFilter()
    if (!filter) return activeViewsOnly.value
    const q = filter.toLowerCase()
    return activeViewsOnly.value.filter(t => t.name.toLowerCase().includes(q))
  })

  const toggleTableExpand = async (tableName: string): Promise<void> => {
    if (expandedTables.value.has(tableName)) {
      expandedTables.value.delete(tableName)
      expandedTables.value = new Set(expandedTables.value)
      return
    }

    const sessionId = activeSessionId.value
    if (!sessionId) return

    expandedTables.value.add(tableName)
    expandedTables.value = new Set(expandedTables.value)

    if (!tableColumns.value.has(tableName)) {
      loadingTableColumns.value.add(tableName)
      loadingTableColumns.value = new Set(loadingTableColumns.value)
      try {
        const cols = await window.api.schema.columns(sessionId, tableName)
        tableColumns.value.set(tableName, cols)
        tableColumns.value = new Map(tableColumns.value)
      } catch {
        tableColumns.value.set(tableName, [])
        tableColumns.value = new Map(tableColumns.value)
      } finally {
        loadingTableColumns.value.delete(tableName)
        loadingTableColumns.value = new Set(loadingTableColumns.value)
      }
    }
  }

  const togglePin = async (table: { name: string; type: string }): Promise<void> => {
    if (!activeSessionId.value) return
    const type = table.type === 'view' ? TableObjectType.View : TableObjectType.Table
    if (pinnedStore.isPinned(type, table.name, currentDatabase.value)) {
      await pinnedStore.unpinEntity(type, table.name, activeSessionId.value, currentDatabase.value)
    } else {
      await pinnedStore.pinEntity(type, table.name, activeSessionId.value, currentDatabase.value)
    }
  }

  const handleTableClick = (table: { name: string; type: string }): void => {
    if (!activeSessionId.value) return
    if (table.type === 'view') {
      openViewTab(table.name, currentDatabase.value)
    } else {
      openTableTab(table.name, currentDatabase.value)
    }
  }

  const loadTableColumns = async (tableName: string): Promise<void> => {
    if (tableColumns.value.has(tableName) || loadingTableColumns.value.has(tableName)) return
    const sessionId = activeSessionId.value
    if (!sessionId) return

    loadingTableColumns.value.add(tableName)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      const cols = await window.api.schema.columns(sessionId, tableName)
      if (activeSessionId.value !== sessionId) return
      tableColumns.value.set(tableName, cols)
      tableColumns.value = new Map(tableColumns.value)
    } catch {
      if (activeSessionId.value !== sessionId) return
      tableColumns.value.set(tableName, [])
      tableColumns.value = new Map(tableColumns.value)
    } finally {
      loadingTableColumns.value.delete(tableName)
      loadingTableColumns.value = new Set(loadingTableColumns.value)
    }
  }

  const expandAll = (): void => {
    tablesOpen.value = true
    viewsOpen.value = true

    for (const table of activeTablesOnly.value) {
      expandedTables.value.add(table.name)
    }
    expandedTables.value = new Set(expandedTables.value)

    Promise.all(activeTablesOnly.value.map(t => loadTableColumns(t.name)))
  }

  const collapseAll = (): void => {
    expandedTables.value = new Set()
  }

  // Clear caches on refresh
  const handleRefreshSchema = (): void => {
    expandedTables.value = new Set()
    tableColumns.value = new Map()
    options.onRefresh?.()
  }

  onMounted(() => {
    window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  })

  onUnmounted(() => {
    window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
  })

  // Sync expandedTables to sidebar state store
  watch(expandedTables, (val) => {
    if (activeSessionId.value) sidebarStateStore.setExpandedTables(activeSessionId.value, val)
  })

  // Restore expandedTables from sidebar state store on init
  const storedExpandedTables = sidebarStateStore.getExpandedTables(activeSessionId.value)
  if (storedExpandedTables.size > 0) {
    expandedTables.value = storedExpandedTables
  }

  // Clear caches when connection changes
  watch(() => connectionsStore.activeSessionId, () => {
    expandedTables.value = new Set()
    tableColumns.value = new Map()
    options.onConnectionChange?.()
  })

  return {
    connectionsStore,
    pendingChangesStore,
    pinnedStore,
    activeSessionId,
    currentDatabase,
    activeTables,
    activeTablesOnly,
    activeViewsOnly,
    filteredTablesOnly,
    filteredViewsOnly,
    tablesOpen,
    viewsOpen,
    expandedTables,
    tableColumns,
    loadingTableColumns,
    toggleTableExpand,
    togglePin,
    handleTableClick,
    loadTableColumns,
    expandAll,
    collapseAll,
  }
}
