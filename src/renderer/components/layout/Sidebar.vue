<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { copyToClipboard, getEntityIcon } from '@/lib/utils'
import { useConnectionsStore } from '@/stores/connections'

import { usePinnedStore } from '@/stores/pinned'
import { useTabs } from '@/composables/useTabs'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import { TabType, TableObjectType } from '@/types/table'
import type { PinnedEntity } from '@/types/electron'
import type { QueryHistoryItem } from '@/types/query'
import type { SavedQuery } from '@/types/electron'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconPinFilled,
  IconChevronRight
} from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import RenameTableDialog from '@/components/schema/RenameTableDialog.vue'
import ConfirmDeleteDialog from '@/components/schema/ConfirmDeleteDialog.vue'
import ViewEditorDialog from '@/components/schema/ViewEditorDialog.vue'
import ExportDialog, { type ExportDialogData } from '@/components/dialogs/ExportDialog.vue'
import { ExportMode } from '@/types/table'
import SidebarEntityContextMenu from './SidebarEntityContextMenu.vue'
import SidebarHistoryList from './SidebarHistoryList.vue'
import SidebarSavedQueriesList from './SidebarSavedQueriesList.vue'
import SidebarPgTree from './SidebarPgTree.vue'
import SidebarMySQLTree from './SidebarMySQLTree.vue'
import SidebarSQLiteTree from './SidebarSQLiteTree.vue'
import SidebarClickHouseTree from './SidebarClickHouseTree.vue'
import SidebarRedisTree from './SidebarRedisTree.vue'
import SidebarMongoTree from './SidebarMongoTree.vue'
import SidebarDuckDBTree from './SidebarDuckDBTree.vue'
import SidebarSQLServerTree from './SidebarSQLServerTree.vue'
import SaveQueryDialog from '@/components/dialogs/SaveQueryDialog.vue'

const connectionsStore = useConnectionsStore()

const pinnedStore = usePinnedStore()
const { activeTab, openQueryTab, openCreateTableTab, openTableTab, openViewTab } = useTabs()

const selectedNodeId = ref<string | null>(null)
const pinnedOpen = ref(true)

// Tree refs for expand/collapse
const pgTreeRef = ref<InstanceType<typeof SidebarPgTree> | null>(null)
const mysqlTreeRef = ref<InstanceType<typeof SidebarMySQLTree> | null>(null)
const sqliteTreeRef = ref<InstanceType<typeof SidebarSQLiteTree> | null>(null)
const clickhouseTreeRef = ref<InstanceType<typeof SidebarClickHouseTree> | null>(null)
const redisTreeRef = ref<InstanceType<typeof SidebarRedisTree> | null>(null)
const mongoTreeRef = ref<InstanceType<typeof SidebarMongoTree> | null>(null)
const duckdbTreeRef = ref<InstanceType<typeof SidebarDuckDBTree> | null>(null)
const sqlserverTreeRef = ref<InstanceType<typeof SidebarSQLServerTree> | null>(null)

const treeExpanded = ref(false)

const toggleExpandAll = () => {
  const tree = pgTreeRef.value || mysqlTreeRef.value || sqliteTreeRef.value || clickhouseTreeRef.value || redisTreeRef.value || mongoTreeRef.value || duckdbTreeRef.value || sqlserverTreeRef.value
  if (!tree) return
  if (treeExpanded.value) {
    tree.collapseAll()
  } else {
    tree.expandAll()
  }
  treeExpanded.value = !treeExpanded.value
}

// Sync sidebar selection when active tab changes
watch(activeTab, (tab) => {
  if (!tab) return
  const type = tab.data.type
  const schema = 'schema' in tab.data ? (tab.data as { schema?: string }).schema : undefined
  if (type === TabType.Table) {
    const name = (tab.data as { tableName: string }).tableName
    selectedNodeId.value = schema ? `table-${schema}-${name}` : `table-${name}`
  } else if (type === TabType.View) {
    const name = (tab.data as { viewName: string }).viewName
    selectedNodeId.value = schema ? `table-${schema}-${name}` : `table-${name}`
  } else if (type === TabType.MaterializedView) {
    const name = (tab.data as { viewName: string }).viewName
    selectedNodeId.value = schema ? `table-${schema}-${name}` : `table-${name}`
  } else if (type === TabType.Routine) {
    const name = (tab.data as { routineName: string }).routineName
    selectedNodeId.value = schema ? `routine-${schema}-${name}` : `routine-${name}`
  } else if (type === TabType.Trigger) {
    const name = (tab.data as { triggerName: string }).triggerName
    selectedNodeId.value = schema ? `trigger-${schema}-${name}` : `trigger-${name}`
  } else if (type === TabType.Event) {
    selectedNodeId.value = `event-${(tab.data as { eventName: string }).eventName}`
  }
})

// Dialog states
const showRenameDialog = ref(false)
const showDropDialog = ref(false)
const showEditViewDialog = ref(false)
const showDropViewDialog = ref(false)
const selectedTable = ref<{ name: string; type: string } | null>(null)
const selectedView = ref<{ name: string; type: string } | null>(null)
const selectedViewDDL = ref<string>('')
const selectedConnectionId = ref<string | null>(null)
const selectedDatabase = ref<string | null>(null)

// Export dialog state
const showExportDialog = ref(false)
const exportDialogData = ref<ExportDialogData | null>(null)

const activeSessionId = computed(() => connectionsStore.activeSessionId)

// Resolve session ID to saved connection ID for persistence APIs
const activeSavedConnectionId = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getSavedConnectionId(activeSessionId.value) || undefined
})

// Database type detection
const activeConnectionType = computed(() => {
  if (!activeSessionId.value) return null
  return connectionsStore.activeConnection?.type ?? null
})
const isRedis = computed(() => activeConnectionType.value === DatabaseType.Redis)
const isMongoDB = computed(() => activeConnectionType.value === DatabaseType.MongoDB)
const isPostgreSQL = computed(() => activeConnectionType.value === DatabaseType.PostgreSQL)
const isMySQL = computed(() => activeConnectionType.value === DatabaseType.MySQL || activeConnectionType.value === DatabaseType.MariaDB)
const isSQLite = computed(() => activeConnectionType.value === DatabaseType.SQLite)
const isClickHouse = computed(() => activeConnectionType.value === DatabaseType.ClickHouse)
const isDuckDB = computed(() => activeConnectionType.value === DatabaseType.DuckDB)
const isSQLServer = computed(() => activeConnectionType.value === DatabaseType.SQLServer)
const supportsCreateTable = computed(() => isPostgreSQL.value || isMySQL.value || isSQLite.value || isClickHouse.value || isMongoDB.value || isDuckDB.value || isSQLServer.value)

const entityCount = computed(() => {
  if ((isPostgreSQL.value || isSQLServer.value) && activeSessionId.value) {
    const schemas = connectionsStore.schemas.get(activeSessionId.value) || []
    return schemas.reduce((sum, s) => sum + (s.tableCount ?? 0), 0)
  }
  return connectionsStore.activeTables.length
})

// Sidebar tabs + search state
const activeSidebarTab = ref<'items' | 'queries' | 'history'>('items')
const searchFilter = ref('')
const historyItems = ref<QueryHistoryItem[]>([])
const savedQueries = ref<SavedQuery[]>([])
const loadingHistory = ref(false)
const loadingSavedQueries = ref(false)
const showSaveQueryDialog = ref(false)
const editingSavedQuery = ref<SavedQuery | null>(null)

const filteredHistory = computed(() => {
  if (!searchFilter.value) return historyItems.value
  const q = searchFilter.value.toLowerCase()
  return historyItems.value.filter(h => h.sql.toLowerCase().includes(q))
})

const filteredSavedQueries = computed(() => {
  if (!searchFilter.value) return savedQueries.value
  const q = searchFilter.value.toLowerCase()
  return savedQueries.value.filter(s =>
    s.name.toLowerCase().includes(q) || s.sql.toLowerCase().includes(q)
  )
})

// Watch activeSessionId to auto-load schema data and pinned entities
watch(() => connectionsStore.activeSessionId, async (newId) => {
  if (newId && connectionsStore.getConnectionState(newId).status === ConnectionStatus.Connected) {
    const connection = connectionsStore.getConnectionForSession(newId)
    if (connection) {
      if (connection.type === DatabaseType.PostgreSQL || connection.type === DatabaseType.SQLServer) {
        await connectionsStore.loadSchemas(newId)
        const schema = connectionsStore.getActiveSchema(newId)
        await connectionsStore.loadTables(newId, connectionsStore.getActiveDatabase(newId), schema)
      } else {
        await connectionsStore.loadTables(newId, connectionsStore.getActiveDatabase(newId))
      }
    }
  }

  if (newId) {
    await pinnedStore.loadPinned(newId)
  } else {
    pinnedStore.pinnedEntities = []
  }
}, { immediate: true })

const activePinnedEntities = computed(() => {
  return pinnedStore.pinnedEntities.filter(e => {
    if (!e.database) return true
    return e.database === currentDatabase.value
  })
})

const handlePinnedClick = (entity: PinnedEntity): void => {
  if (entity.type === TableObjectType.View) {
    openViewTab(entity.name, entity.database, entity.schema)
  } else {
    openTableTab(entity.name, entity.database, entity.schema)
  }
}

const handleUnpin = async (entity: PinnedEntity): Promise<void> => {
  if (!activeSessionId.value) return
  await pinnedStore.unpinEntity(entity.type, entity.name, activeSessionId.value, entity.database, entity.schema)
}

// Listen for refresh-schema events from HeaderBar
const handleRefreshSchema = () => {
  treeExpanded.value = false
  if (activeSessionId.value) {
    refreshTables(activeSessionId.value)
  }
}

const handleSavedQueriesChanged = () => {
  if (activeSidebarTab.value === 'queries') loadSavedQueries()
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  window.addEventListener('zequel:saved-queries-changed', handleSavedQueriesChanged)
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
  window.removeEventListener('zequel:saved-queries-changed', handleSavedQueriesChanged)
})

const currentDatabase = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeSessionId.value) || undefined
})

const refreshTables = async (connectionId: string) => {
  const connection = connectionsStore.getConnectionForSession(connectionId)
  const isSchemaDB = connection?.type === DatabaseType.PostgreSQL || connection?.type === DatabaseType.SQLServer
  const schema = isSchemaDB
    ? connectionsStore.getActiveSchema(connectionId)
    : undefined
  await connectionsStore.loadTables(connectionId, connectionsStore.getActiveDatabase(connectionId), schema)
  if (isSchemaDB) {
    await connectionsStore.loadSchemas(connectionId)
  }
}

// Table operations
const handleRenameTable = async (newName: string) => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!selectedTable.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.renameTable(selectedConnectionId.value, {
      oldName: selectedTable.value.name,
      newName
    })

    if (result.success) {
      showRenameDialog.value = false
      toast.success(`Table renamed to "${newName}"`)
      if (selectedConnectionId.value) {
        await connectionsStore.loadTables(selectedConnectionId.value, connectionsStore.getActiveDatabase(selectedConnectionId.value))
      }
    } else {
      toast.error(result.error || 'Failed to rename table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to rename table')
  }
}

const handleDropTable = async () => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!selectedTable.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.dropTable(selectedConnectionId.value, {
      table: selectedTable.value.name
    })

    if (result.success) {
      showDropDialog.value = false
      toast.success(`Table "${selectedTable.value.name}" dropped`)
      if (selectedConnectionId.value) {
        await connectionsStore.loadTables(selectedConnectionId.value, connectionsStore.getActiveDatabase(selectedConnectionId.value))
      }
    } else {
      toast.error(result.error || 'Failed to drop table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to drop table')
  }
}

const cleanupDialogState = () => {
  setTimeout(() => {
    document.body.style.pointerEvents = ''
  }, 150)
}

const handleExportTable = (data: { name: string; schema?: string }) => {
  if (!activeSessionId.value) return
  exportDialogData.value = {
    title: `Export ${data.name}`,
    tableName: data.name,
    mode: ExportMode.FullTable,
    connectionId: activeSessionId.value,
    schema: data.schema
  }
  showExportDialog.value = true
}

const openCreateTable = () => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  const connId = activeSessionId.value
  if (!connId) return
  const db = connectionsStore.getActiveDatabase(connId)
  const schema = (isPostgreSQL.value || isSQLServer.value) ? connectionsStore.getActiveSchema(connId) : undefined
  openCreateTableTab(db || undefined, schema)
}

// View operations
const openEditView = async (connectionId: string, view: { name: string; type: string }, database?: string) => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  selectedView.value = view

  try {
    const ddl = await window.api.schema.viewDDL(connectionId, view.name)
    const match = ddl.match(/AS\s+(SELECT[\s\S]+?)(?:;?\s*$)/i)
    selectedViewDDL.value = match ? match[1].trim() : ''
    setTimeout(() => {
      showEditViewDialog.value = true
    }, 150)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to load view definition')
  }
}

const handleCreateView = async (viewDef: { name: string; selectStatement: string; replaceIfExists?: boolean }) => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createView(selectedConnectionId.value, {
      view: JSON.parse(JSON.stringify(viewDef))
    })

    if (result.success) {
      showEditViewDialog.value = false
      toast.success('View saved')
      if (selectedConnectionId.value) {
        await connectionsStore.loadTables(selectedConnectionId.value, connectionsStore.getActiveDatabase(selectedConnectionId.value))
      }
    } else {
      toast.error(result.error || 'Failed to create/update view')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create/update view')
  }
}

const handleDropView = async () => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!selectedView.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.dropView(selectedConnectionId.value, {
      viewName: selectedView.value.name
    })

    if (result.success) {
      showDropViewDialog.value = false
      toast.success(`View "${selectedView.value.name}" dropped`)
      if (selectedConnectionId.value) {
        await connectionsStore.loadTables(selectedConnectionId.value, connectionsStore.getActiveDatabase(selectedConnectionId.value))
      }
    } else {
      toast.error(result.error || 'Failed to drop view')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to drop view')
  }
}

// History & Saved Queries
const loadHistory = async () => {
  loadingHistory.value = true
  try {
    historyItems.value = await window.api.history.list(activeSavedConnectionId.value || undefined, 200)
  } catch (err) {
    console.error('Failed to load history:', err)
    historyItems.value = []
  } finally {
    loadingHistory.value = false
  }
}

const loadSavedQueries = async () => {
  loadingSavedQueries.value = true
  try {
    savedQueries.value = await window.api.savedQueries.list(activeSavedConnectionId.value || undefined)
  } catch (err) {
    console.error('Failed to load saved queries:', err)
    savedQueries.value = []
  } finally {
    loadingSavedQueries.value = false
  }
}

// Lazy-load data on tab switch
watch(activeSidebarTab, (tab) => {
  if (tab === 'history') loadHistory()
  else if (tab === 'queries') loadSavedQueries()
})

// Clear dialog state to prevent stale session ID references after session migration
watch(() => connectionsStore.activeSessionId, () => {
  selectedConnectionId.value = null
  selectedTable.value = null
  selectedView.value = null
  showRenameDialog.value = false
  showDropDialog.value = false
  showEditViewDialog.value = false
  showDropViewDialog.value = false
})

// Reload when session changes if on those tabs
watch(() => connectionsStore.activeSessionId, () => {
  if (activeSidebarTab.value === 'history') loadHistory()
  else if (activeSidebarTab.value === 'queries') loadSavedQueries()
})

// History handlers
const handleRunHistory = (item: QueryHistoryItem) => {
  openQueryTab(item.sql)
}

const handleDeleteHistory = async (item: QueryHistoryItem) => {
  try {
    await window.api.history.delete(item.id)
    historyItems.value = historyItems.value.filter(h => h.id !== item.id)
  } catch (err) {
    toast.error('Failed to delete history item')
  }
}

const handleClearHistory = async () => {
  try {
    await window.api.history.clear(activeSavedConnectionId.value || undefined)
    historyItems.value = []
  } catch (err) {
    toast.error('Failed to clear history')
  }
}

const handleCopyHistory = (item: QueryHistoryItem) => {
  copyToClipboard(item.sql, 'SQL copied to clipboard')
}

const handleSaveFromHistory = (item: QueryHistoryItem) => {
  editingSavedQuery.value = { id: 0, name: '', sql: item.sql, createdAt: '', updatedAt: '' } as SavedQuery
  showSaveQueryDialog.value = true
}

// Saved Queries handlers
const handleRunSavedQuery = (query: SavedQuery) => {
  const tab = openQueryTab(query.sql, query.id)
  if (tab) tab.title = query.name
}

const handleEditSavedQuery = (query: SavedQuery) => {
  editingSavedQuery.value = query
  showSaveQueryDialog.value = true
}

const handleDeleteSavedQuery = async (query: SavedQuery) => {
  try {
    await window.api.savedQueries.delete(query.id)
    savedQueries.value = savedQueries.value.filter(q => q.id !== query.id)
  } catch (err) {
    toast.error('Failed to delete saved query')
  }
}

const handleNewSavedQuery = () => {
  editingSavedQuery.value = null
  showSaveQueryDialog.value = true
}

const handleCopySavedQuery = (query: SavedQuery) => {
  copyToClipboard(query.sql, 'SQL copied to clipboard')
}

const handleSaveQuery = async (data: { name: string; sql: string; description: string; id?: number }) => {
  try {
    if (data.id) {
      const updated = await window.api.savedQueries.update(data.id, {
        name: data.name,
        sql: data.sql,
        description: data.description || undefined
      })
      if (updated) {
        const idx = savedQueries.value.findIndex(q => q.id === data.id)
        if (idx !== -1) savedQueries.value[idx] = updated
        toast.success('Query updated')
      }
    } else {
      const saved = await window.api.savedQueries.save(
        data.name,
        data.sql,
        activeSavedConnectionId.value || undefined,
        data.description || undefined
      )
      savedQueries.value.push(saved)
      toast.success('Query saved')
    }
    showSaveQueryDialog.value = false
  } catch (err) {
    toast.error('Failed to save query')
  }
}

</script>

<template>
  <div class="flex h-full flex-col bg-muted/30 border-r overflow-hidden">
    <!-- Fixed header: tabs + search -->
    <div class="flex-shrink-0 px-2 pt-2 space-y-2">
      <div class="inline-flex items-center w-full rounded-md border bg-muted p-0.5">
        <button v-for="tab in (['items', 'queries', 'history'] as const)" :key="tab" tabindex="-1"
          class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeSidebarTab === tab
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'" :data-testid="`sidebar-tab-${tab}`"
          @click="activeSidebarTab = tab">
          {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
        </button>
      </div>
      <div class="relative">
        <IconSearch
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="searchFilter" placeholder="Search..." class="pl-8" />
      </div>
    </div>

    <!-- Items tab: Entities header -->
    <div v-show="activeSidebarTab === 'items'" class="flex-shrink-0">
      <div v-if="activeSessionId" class="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-muted-foreground">Entities</span>
          <span
            class="inline-flex items-center rounded-full bg-muted-foreground/20 px-[5px] py-0.5 text-[10px] font-medium text-foreground">
            {{ entityCount }}
          </span>
        </div>
        <TooltipProvider :delay-duration="300">
          <div class="flex items-center gap-0.5">
            <Tooltip v-if="!isRedis">
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" @click="toggleExpandAll">
                  <IconArrowsDiagonalMinimize2 v-if="treeExpanded" class="h-3.5 w-3.5 -rotate-45" />
                  <IconArrowsDiagonal v-else class="h-3.5 w-3.5 -rotate-45" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ treeExpanded ? 'Collapse All' : 'Expand All' }}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" @click="handleRefreshSchema">
                  <IconRefresh class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Tooltip v-if="supportsCreateTable && !connectionsStore.safeMode">
              <TooltipTrigger as-child>
                <Button data-testid="sidebar-create-table-btn" variant="ghost" size="icon" @click="openCreateTable()">
                  <IconPlus class="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ isMongoDB ? 'New Collection' : 'New Table' }}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>

    <ScrollArea v-show="activeSidebarTab === 'items'" class="flex-1 px-2">
      <div class="space-y-0.5 py-2">
        <!-- Pinned Section -->
        <Collapsible v-if="activePinnedEntities.length > 0" v-model:open="pinnedOpen" data-testid="pinned-section">
          <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 w-full hover:bg-accent/30 rounded-md">
            <IconChevronRight class="size-3.5 text-muted-foreground transition-transform"
              :class="{ 'rotate-90': pinnedOpen }" />
            <IconPinFilled class="size-3.5 text-amber-500" />
            <span class="text-xs font-semibold text-muted-foreground">Pinned</span>
          </CollapsibleTrigger>
          <CollapsibleContent class="ml-3.5 pl-1">
            <ContextMenu v-for="entity in activePinnedEntities" :key="entity.id">
              <ContextMenuTrigger as-child>
                <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :data-testid="`pinned-entity-${entity.name}`" @click="handlePinnedClick(entity)">
                  <component :is="getEntityIcon(entity.type === TableObjectType.View ? 'view' : 'table').icon"
                    :class="['h-4 w-4 shrink-0', getEntityIcon(entity.type === TableObjectType.View ? 'view' : 'table').color]" />
                  <span class="flex-1 truncate text-sm">{{ entity.schema ? `${entity.schema}.` : '' }}{{ entity.name
                  }}</span>
                </div>
              </ContextMenuTrigger>
              <SidebarEntityContextMenu :name="entity.name" :type="entity.type" :schema="entity.schema"
                :db-type="activeConnectionType!" :is-pinned="true" @toggle-pin="handleUnpin(entity)"
                @export="handleExportTable({ name: entity.name, schema: entity.schema })"
                @rename="selectedTable = { name: entity.name, type: entity.type }; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true"
                @drop="selectedTable = { name: entity.name, type: entity.type }; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true"
                @edit-view="() => { if (activeSessionId) openEditView(activeSessionId, { name: entity.name, type: entity.type }, currentDatabase) }"
                @drop-view="selectedView = { name: entity.name, type: entity.type }; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true" />
            </ContextMenu>
          </CollapsibleContent>
        </Collapsible>

        <!-- PostgreSQL: Schema-based tree -->
        <SidebarPgTree ref="pgTreeRef" v-if="isPostgreSQL && activeSessionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @export-table="handleExportTable" />

        <!-- MySQL / MariaDB: Folder-based tree -->
        <SidebarMySQLTree ref="mysqlTreeRef" v-else-if="isMySQL && activeSessionId" :db-type="activeConnectionType!"
          :search-filter="searchFilter" :selected-node-id="selectedNodeId"
          @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @export-table="handleExportTable" />

        <!-- SQLite -->
        <SidebarSQLiteTree ref="sqliteTreeRef" v-else-if="isSQLite && activeSessionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @create-table="openCreateTable()" @export-table="handleExportTable" />

        <!-- DuckDB -->
        <SidebarDuckDBTree ref="duckdbTreeRef" v-else-if="isDuckDB && activeSessionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @create-table="openCreateTable()" @export-table="handleExportTable" />

        <!-- SQL Server: Schema-based tree -->
        <SidebarSQLServerTree ref="sqlserverTreeRef" v-else-if="isSQLServer && activeSessionId"
          :search-filter="searchFilter" :selected-node-id="selectedNodeId"
          @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @export-table="handleExportTable" />

        <!-- ClickHouse -->
        <SidebarClickHouseTree ref="clickhouseTreeRef" v-else-if="isClickHouse && activeSessionId"
          :search-filter="searchFilter" :selected-node-id="selectedNodeId"
          @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @export-table="handleExportTable" />

        <!-- MongoDB -->
        <SidebarMongoTree ref="mongoTreeRef" v-else-if="isMongoDB && activeSessionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => { if (activeSessionId) openEditView(activeSessionId, v, currentDatabase) }"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @export-table="handleExportTable" />

        <!-- Redis -->
        <SidebarRedisTree ref="redisTreeRef" v-else-if="isRedis && activeSessionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeSessionId; selectedDatabase = currentDatabase || null; showDropDialog = true }" />
      </div>
    </ScrollArea>

    <!-- Queries tab -->
    <ScrollArea v-show="activeSidebarTab === 'queries'" class="flex-1 px-2">
      <SidebarSavedQueriesList :queries="filteredSavedQueries" :loading="loadingSavedQueries" @run="handleRunSavedQuery"
        @edit="handleEditSavedQuery" @delete="handleDeleteSavedQuery" @new="handleNewSavedQuery"
        @copy="handleCopySavedQuery" @refresh="loadSavedQueries" />
    </ScrollArea>

    <!-- History tab -->
    <ScrollArea v-show="activeSidebarTab === 'history'" class="flex-1 px-2">
      <SidebarHistoryList :history="filteredHistory" :loading="loadingHistory" @run="handleRunHistory"
        @delete="handleDeleteHistory" @clear="handleClearHistory" @copy="handleCopyHistory"
        @save="handleSaveFromHistory" />
    </ScrollArea>

    <!-- Rename Table Dialog -->
    <RenameTableDialog v-if="selectedTable" :open="showRenameDialog"
      @update:open="(v: boolean) => { showRenameDialog = v; if (!v) cleanupDialogState() }"
      :current-name="selectedTable.name" @rename="handleRenameTable" />

    <!-- Drop Table Confirmation Dialog -->
    <ConfirmDeleteDialog v-if="selectedTable" :open="showDropDialog"
      @update:open="(v: boolean) => { showDropDialog = v; if (!v) cleanupDialogState() }" title="Drop Table"
      :message="`Are you sure you want to drop table '${selectedTable.name}'? This action cannot be undone and all data will be lost.`"
      confirm-text="Drop Table" @confirm="handleDropTable" />

    <!-- Edit View Dialog -->
    <ViewEditorDialog v-if="selectedConnectionId && selectedView" :open="showEditViewDialog"
      @update:open="(v: boolean) => { showEditViewDialog = v; if (!v) cleanupDialogState() }"
      :connection-id="selectedConnectionId" :database="selectedDatabase || ''" mode="edit"
      :existing-view-name="selectedView.name" :existing-select-statement="selectedViewDDL" @save="handleCreateView" />

    <!-- Drop View Confirmation Dialog -->
    <ConfirmDeleteDialog v-if="selectedView" :open="showDropViewDialog"
      @update:open="(v: boolean) => { showDropViewDialog = v; if (!v) cleanupDialogState() }" title="Drop View"
      :message="`Are you sure you want to drop view '${selectedView.name}'? This action cannot be undone.`"
      confirm-text="Drop View" @confirm="handleDropView" />

    <!-- Save Query Dialog -->
    <SaveQueryDialog :open="showSaveQueryDialog"
      @update:open="(v: boolean) => { showSaveQueryDialog = v; if (!v) { editingSavedQuery = null; cleanupDialogState() } }"
      :existing="editingSavedQuery" @save="handleSaveQuery" />

    <!-- Export Dialog -->
    <ExportDialog :open="showExportDialog" :data="exportDialogData"
      @update:open="(v: boolean) => { showExportDialog = v; if (!v) cleanupDialogState() }" />

  </div>
</template>