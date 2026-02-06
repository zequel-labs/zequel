<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import { TabType } from '@/types/table'
import type { QueryHistoryItem } from '@/types/query'
import type { SavedQuery } from '@/types/electron'
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2
} from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RenameTableDialog from '../schema/RenameTableDialog.vue'
import CreateSchemaDialog from '../schema/CreateSchemaDialog.vue'
import ConfirmDeleteDialog from '../schema/ConfirmDeleteDialog.vue'
import ViewEditorDialog from '../schema/ViewEditorDialog.vue'
import SidebarHistoryList from './SidebarHistoryList.vue'
import SidebarSavedQueriesList from './SidebarSavedQueriesList.vue'
import SidebarPgTree from './SidebarPgTree.vue'
import SidebarMySQLTree from './SidebarMySQLTree.vue'
import SidebarSQLiteTree from './SidebarSQLiteTree.vue'
import SidebarClickHouseTree from './SidebarClickHouseTree.vue'
import SidebarRedisTree from './SidebarRedisTree.vue'
import SaveQueryDialog from '../dialogs/SaveQueryDialog.vue'

const connectionsStore = useConnectionsStore()
const { activeTab, openQueryTab, openCreateTableTab } = useTabs()

const selectedNodeId = ref<string | null>(null)

// Tree refs for expand/collapse
const pgTreeRef = ref<InstanceType<typeof SidebarPgTree> | null>(null)
const mysqlTreeRef = ref<InstanceType<typeof SidebarMySQLTree> | null>(null)
const sqliteTreeRef = ref<InstanceType<typeof SidebarSQLiteTree> | null>(null)
const clickhouseTreeRef = ref<InstanceType<typeof SidebarClickHouseTree> | null>(null)

const treeExpanded = ref(false)

const toggleExpandAll = () => {
  const tree = pgTreeRef.value || mysqlTreeRef.value || sqliteTreeRef.value || clickhouseTreeRef.value
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

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const connections = computed(() => connectionsStore.connections)

// Database type detection
const activeConnectionType = computed(() => {
  if (!activeConnectionId.value) return null
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  return connection?.type ?? null
})
const isRedis = computed(() => activeConnectionType.value === DatabaseType.Redis)
const isMongoDB = computed(() => activeConnectionType.value === DatabaseType.MongoDB)
const isPostgreSQL = computed(() => activeConnectionType.value === DatabaseType.PostgreSQL)
const isMySQL = computed(() => activeConnectionType.value === DatabaseType.MySQL || activeConnectionType.value === DatabaseType.MariaDB)
const isSQLite = computed(() => activeConnectionType.value === DatabaseType.SQLite)
const isClickHouse = computed(() => activeConnectionType.value === DatabaseType.ClickHouse)

const entityCount = computed(() => connectionsStore.activeTables.length)

// Schema selector state (PostgreSQL only)
const showCreateSchemaDialog = ref(false)

const handleCreateSchema = () => {
  setTimeout(() => {
    showCreateSchemaDialog.value = true
  }, 150)
}

const handleSchemaCreated = async (schemaName: string) => {
  if (!activeConnectionId.value) return
  await connectionsStore.loadSchemas(activeConnectionId.value)
  await connectionsStore.setActiveSchema(activeConnectionId.value, schemaName)
  cleanupDialogState()
}


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

// Watch activeConnectionId to auto-load schema data
watch(() => connectionsStore.activeConnectionId, async (newId) => {
  if (newId && connectionsStore.getConnectionState(newId).status === ConnectionStatus.Connected) {
    const connection = connections.value.find(c => c.id === newId)
    if (connection) {
      if (connection.type === DatabaseType.Redis) {
        // SidebarRedisTree handles its own loading
      } else if (connection.type === DatabaseType.PostgreSQL) {
        await connectionsStore.loadSchemas(newId)
        const schema = connectionsStore.getActiveSchema(newId)
        await connectionsStore.loadTables(newId, connectionsStore.getActiveDatabase(newId), schema)
      } else {
        await connectionsStore.loadTables(newId, connectionsStore.getActiveDatabase(newId))
      }
    }
  }
}, { immediate: true })

// Listen for refresh-schema events from HeaderBar
const handleRefreshSchema = () => {
  treeExpanded.value = false
  if (activeConnectionId.value && !isRedis.value) {
    refreshTables(activeConnectionId.value)
  }
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const currentDatabase = computed(() => {
  if (!activeConnectionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeConnectionId.value) || undefined
})

const refreshTables = async (connectionId: string) => {
  const connection = connections.value.find(c => c.id === connectionId)
  const schema = connection?.type === DatabaseType.PostgreSQL
    ? connectionsStore.getActiveSchema(connectionId)
    : undefined
  await connectionsStore.loadTables(connectionId, connectionsStore.getActiveDatabase(connectionId), schema)
  if (connection?.type === DatabaseType.PostgreSQL) {
    await connectionsStore.loadSchemas(connectionId)
  }
}

// Table operations
const handleRenameTable = async (newName: string) => {
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

const openCreateTable = () => {
  const connId = activeConnectionId.value
  if (!connId) return
  const db = connectionsStore.getActiveDatabase(connId)
  const schema = isPostgreSQL.value ? connectionsStore.getActiveSchema(connId) : undefined
  openCreateTableTab(db || undefined, schema)
}

// View operations
const openEditView = async (connectionId: string, view: { name: string; type: string }, database?: string) => {
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

const handleCreateView = async (viewDef: any) => {
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
    historyItems.value = await window.api.history.list(activeConnectionId.value || undefined, 200)
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
    savedQueries.value = await window.api.savedQueries.list(activeConnectionId.value || undefined)
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

// Reload when connection changes if on those tabs
watch(() => connectionsStore.activeConnectionId, () => {
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
    await window.api.history.clear(activeConnectionId.value || undefined)
    historyItems.value = []
  } catch (err) {
    toast.error('Failed to clear history')
  }
}

const handleCopyHistory = (item: QueryHistoryItem) => {
  navigator.clipboard.writeText(item.sql)
  toast.success('SQL copied to clipboard')
}

const handleSaveFromHistory = (item: QueryHistoryItem) => {
  editingSavedQuery.value = { id: 0, name: '', sql: item.sql, createdAt: '', updatedAt: '' } as SavedQuery
  showSaveQueryDialog.value = true
}

// Saved Queries handlers
const handleRunSavedQuery = (query: SavedQuery) => {
  openQueryTab(query.sql)
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
  navigator.clipboard.writeText(query.sql)
  toast.success('SQL copied to clipboard')
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
        activeConnectionId.value || undefined,
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
      <Tabs v-model="activeSidebarTab">
        <TabsList class="w-full h-7 p-0.5 rounded-md">
          <TabsTrigger value="items" class="text-xs h-6 px-2 rounded-sm">Items</TabsTrigger>
          <TabsTrigger value="queries" class="text-xs h-6 px-2 rounded-sm">Queries</TabsTrigger>
          <TabsTrigger value="history" class="text-xs h-6 px-2 rounded-sm">History</TabsTrigger>
        </TabsList>
      </Tabs>
      <div class="relative">
        <IconSearch
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="searchFilter" placeholder="Search..." class="h-8 pl-8 text-sm" />
      </div>
    </div>

    <!-- Items tab: Entities header -->
    <div v-show="activeSidebarTab === 'items'" class="flex-shrink-0">
      <div v-if="activeConnectionId && !isMongoDB"
        class="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Entities</span>
          <span
            class="text-xs font-medium text-muted-foreground bg-muted-foreground/30 rounded-full px-1.5 py-0.5 leading-none">
            {{ entityCount }}
          </span>
        </div>
        <TooltipProvider :delay-duration="300">
        <div class="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" @click="toggleExpandAll">
                <IconArrowsDiagonalMinimize2 v-if="treeExpanded" class="size-3 -rotate-45" />
                <IconArrowsDiagonal v-else class="size-3 -rotate-45" />
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
          <Tooltip v-if="isPostgreSQL || isMySQL || isSQLite">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" @click="openCreateTable()">
                <IconPlus class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Table</TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>
      </div>
    </div>

    <ScrollArea v-show="activeSidebarTab === 'items'" class="flex-1 px-2">
      <div class="space-y-0.5 py-2">
        <!-- PostgreSQL: Schema-based tree -->
        <SidebarPgTree ref="pgTreeRef" v-if="isPostgreSQL && activeConnectionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => openEditView(activeConnectionId!, v, currentDatabase)"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }" />

        <!-- MySQL / MariaDB: Folder-based tree -->
        <SidebarMySQLTree ref="mysqlTreeRef" v-else-if="isMySQL && activeConnectionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => openEditView(activeConnectionId!, v, currentDatabase)"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }" />

        <!-- SQLite -->
        <SidebarSQLiteTree ref="sqliteTreeRef" v-else-if="isSQLite && activeConnectionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => openEditView(activeConnectionId!, v, currentDatabase)"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }"
          @create-table="openCreateTable()" />

        <!-- ClickHouse -->
        <SidebarClickHouseTree ref="clickhouseTreeRef" v-else-if="isClickHouse && activeConnectionId"
          :search-filter="searchFilter" :selected-node-id="selectedNodeId"
          @update:selected-node-id="selectedNodeId = $event"
          @rename-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showRenameDialog = true }"
          @drop-table="(t) => { selectedTable = t; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropDialog = true }"
          @edit-view="(v) => openEditView(activeConnectionId!, v, currentDatabase)"
          @drop-view="(v) => { selectedView = v; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true }" />

        <!-- Redis -->
        <SidebarRedisTree v-else-if="isRedis && activeConnectionId" :search-filter="searchFilter"
          :selected-node-id="selectedNodeId" @update:selected-node-id="selectedNodeId = $event" />
      </div>
    </ScrollArea>

    <!-- Queries tab -->
    <ScrollArea v-show="activeSidebarTab === 'queries'" class="flex-1 px-2">
      <SidebarSavedQueriesList :queries="filteredSavedQueries" :loading="loadingSavedQueries" @run="handleRunSavedQuery"
        @edit="handleEditSavedQuery" @delete="handleDeleteSavedQuery" @new="handleNewSavedQuery"
        @copy="handleCopySavedQuery" />
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

    <!-- Create Schema Dialog (PostgreSQL only) -->
    <CreateSchemaDialog v-if="activeConnectionId" :open="showCreateSchemaDialog"
      @update:open="(v: boolean) => { showCreateSchemaDialog = v; if (!v) cleanupDialogState() }"
      :connection-id="activeConnectionId" @created="handleSchemaCreated" />

  </div>
</template>