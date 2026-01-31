<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import type { Table, Routine, Trigger, MySQLEvent } from '@/types/table'
import type { QueryHistoryItem } from '@/types/query'
import type { SavedQuery } from '@/types/electron'
import {
  IconTable,
  IconEye,
  IconLoader2,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconSchema,
  IconFunction,
  IconTerminal2,
  IconBolt,
  IconCalendarEvent,
  IconDatabase,
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconSearch
} from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import RenameTableDialog from '../schema/RenameTableDialog.vue'
import ConfirmDeleteDialog from '../schema/ConfirmDeleteDialog.vue'
import CreateTableDialog from '../schema/CreateTableDialog.vue'
import ViewEditorDialog from '../schema/ViewEditorDialog.vue'
import SidebarHistoryList from './SidebarHistoryList.vue'
import SidebarSavedQueriesList from './SidebarSavedQueriesList.vue'
import SaveQueryDialog from '../dialogs/SaveQueryDialog.vue'

const connectionsStore = useConnectionsStore()
const { openTableTab, openViewTab, openQueryTab, openERDiagramTab, openRoutineTab, openTriggerTab, openSequenceTab, openMaterializedViewTab, openExtensionsTab, openEnumsTab, openEventTab } = useTabs()

const selectedNodeId = ref<string | null>(null)

// Dialog states
const showRenameDialog = ref(false)
const showDropDialog = ref(false)
const showCreateTableDialog = ref(false)
const showCreateViewDialog = ref(false)
const showEditViewDialog = ref(false)
const showDropViewDialog = ref(false)
const selectedTable = ref<{ name: string; type: string } | null>(null)
const selectedView = ref<{ name: string; type: string } | null>(null)
const selectedViewDDL = ref<string>('')
const selectedConnectionId = ref<string | null>(null)
const selectedDatabase = ref<string | null>(null)

// Routines state
const routines = ref<Map<string, Routine[]>>(new Map())
const loadingRoutines = ref<Set<string>>(new Set())

// Triggers state
const triggers = ref<Map<string, Trigger[]>>(new Map())
const loadingTriggers = ref<Set<string>>(new Set())

// Events state (MySQL-specific)
const events = ref<Map<string, MySQLEvent[]>>(new Map())
const loadingEvents = ref<Set<string>>(new Set())

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const connections = computed(() => connectionsStore.connections)

// Redis-specific state
const isRedis = computed(() => {
  if (!activeConnectionId.value) return false
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  return connection?.type === DatabaseType.Redis
})
const isMongoDB = computed(() => {
  if (!activeConnectionId.value) return false
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  return connection?.type === DatabaseType.MongoDB
})
const redisDatabases = ref<{ name: string; keys: number }[]>([])
const selectedRedisDb = ref<string | null>(null)
const loadingRedisDbs = ref(false)

const activeTables = computed(() => {
  if (!activeConnectionId.value) return []
  return connectionsStore.tables.get(activeConnectionId.value) || []
})

const activeTablesOnly = computed(() => activeTables.value.filter(t => t.type === 'table'))
const activeViewsOnly = computed(() => activeTables.value.filter(t => t.type !== 'table'))

const activeRoutines = computed(() => {
  if (!activeConnectionId.value) return []
  return routines.value.get(activeConnectionId.value) || []
})

const activeFunctions = computed(() => activeRoutines.value.filter(r => r.type === 'FUNCTION'))
const activeProcedures = computed(() => activeRoutines.value.filter(r => r.type === 'PROCEDURE'))

const activeEvents = computed(() => {
  if (!activeConnectionId.value) return []
  return events.value.get(activeConnectionId.value) || []
})

const activeTriggers = computed(() => {
  if (!activeConnectionId.value) return []
  return triggers.value.get(activeConnectionId.value) || []
})

// Collapsible folder state
const tablesOpen = ref(true)
const viewsOpen = ref(false)
const functionsOpen = ref(false)
const proceduresOpen = ref(false)
const triggersOpen = ref(false)
const eventsOpen = ref(false)

// Sidebar tabs + search state
const activeSidebarTab = ref<'items' | 'queries' | 'history'>('items')
const searchFilter = ref('')
const historyItems = ref<QueryHistoryItem[]>([])
const savedQueries = ref<SavedQuery[]>([])
const loadingHistory = ref(false)
const loadingSavedQueries = ref(false)
const showSaveQueryDialog = ref(false)
const editingSavedQuery = ref<SavedQuery | null>(null)

// Filtered computeds for search
const filteredTablesOnly = computed(() => {
  if (!searchFilter.value) return activeTablesOnly.value
  const q = searchFilter.value.toLowerCase()
  return activeTablesOnly.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredViewsOnly = computed(() => {
  if (!searchFilter.value) return activeViewsOnly.value
  const q = searchFilter.value.toLowerCase()
  return activeViewsOnly.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredFunctions = computed(() => {
  if (!searchFilter.value) return activeFunctions.value
  const q = searchFilter.value.toLowerCase()
  return activeFunctions.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredProcedures = computed(() => {
  if (!searchFilter.value) return activeProcedures.value
  const q = searchFilter.value.toLowerCase()
  return activeProcedures.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredTriggers = computed(() => {
  if (!searchFilter.value) return activeTriggers.value
  const q = searchFilter.value.toLowerCase()
  return activeTriggers.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredEvents = computed(() => {
  if (!searchFilter.value) return activeEvents.value
  const q = searchFilter.value.toLowerCase()
  return activeEvents.value.filter(e => e.name.toLowerCase().includes(q))
})

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
  selectedRedisDb.value = null
  if (newId && connectionsStore.getConnectionState(newId).status === ConnectionStatus.Connected) {
    const connection = connections.value.find(c => c.id === newId)
    if (connection) {
      if (connection.type === DatabaseType.Redis) {
        await loadRedisDatabases(newId)
      } else {
        await connectionsStore.loadTables(newId, connectionsStore.getActiveDatabase(newId))
        routines.value.delete(newId)
        triggers.value.delete(newId)
        events.value.delete(newId)
        loadRoutines(newId)
        loadTriggers(newId)
        loadEvents(newId)
      }
    }
  }
}, { immediate: true })

// Redis helpers
const loadRedisDatabases = async (connectionId: string) => {
  loadingRedisDbs.value = true
  try {
    const dbs = await window.api.schema.databases(connectionId)
    redisDatabases.value = dbs
      .filter(db => !db.name.includes('(empty)'))
      .map(db => ({
        name: db.name,
        keys: parseInt(db.charset || '0', 10) || 0
      }))
  } catch (err) {
    console.error('Failed to load Redis databases:', err)
    redisDatabases.value = []
  } finally {
    loadingRedisDbs.value = false
  }
}

const handleRedisDbClick = async (db: { name: string; keys: number }) => {
  if (!activeConnectionId.value) return
  selectedRedisDb.value = db.name
  await connectionsStore.loadTables(activeConnectionId.value, db.name)
}

const handleBackToDatabases = () => {
  selectedRedisDb.value = null
  if (activeConnectionId.value) {
    connectionsStore.tables.delete(activeConnectionId.value)
  }
}

// Listen for refresh-schema events from HeaderBar
const handleRefreshSchema = () => {
  if (activeConnectionId.value) {
    if (isRedis.value) {
      if (selectedRedisDb.value) {
        handleRedisDbClick({ name: selectedRedisDb.value, keys: 0 })
      } else {
        loadRedisDatabases(activeConnectionId.value)
      }
    } else {
      refreshTables(activeConnectionId.value)
    }
  }
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const loadRoutines = async (connectionId: string) => {
  if (loadingRoutines.value.has(connectionId)) return

  loadingRoutines.value.add(connectionId)
  try {
    const result = await window.api.schema.getRoutines(connectionId)
    routines.value.set(connectionId, result)
  } catch (err) {
    console.error('Failed to load routines:', err)
    routines.value.set(connectionId, [])
  } finally {
    loadingRoutines.value.delete(connectionId)
  }
}

const loadTriggers = async (connectionId: string) => {
  if (loadingTriggers.value.has(connectionId)) return

  loadingTriggers.value.add(connectionId)
  try {
    const result = await window.api.schema.getTriggers(connectionId)
    triggers.value.set(connectionId, result)
  } catch (err) {
    console.error('Failed to load triggers:', err)
    triggers.value.set(connectionId, [])
  } finally {
    loadingTriggers.value.delete(connectionId)
  }
}

const loadEvents = async (connectionId: string) => {
  if (loadingEvents.value.has(connectionId)) return

  const connection = connections.value.find(c => c.id === connectionId)
  if (!connection || connection.type !== DatabaseType.MySQL) return

  loadingEvents.value.add(connectionId)
  try {
    const result = await window.api.schema.getEvents(connectionId)
    events.value.set(connectionId, result)
  } catch (err) {
    console.error('Failed to load events:', err)
    events.value.set(connectionId, [])
  } finally {
    loadingEvents.value.delete(connectionId)
  }
}

const currentDatabase = computed(() => {
  if (!activeConnectionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeConnectionId.value) || undefined
})

const handleTableClick = (table: { name: string; type: string }) => {
  if (!activeConnectionId.value) return
  if (table.type === 'view') {
    openViewTab(table.name, currentDatabase.value)
  } else {
    openTableTab(table.name, currentDatabase.value)
  }
}

const handleRoutineClick = (routine: Routine) => {
  if (!activeConnectionId.value) return
  openRoutineTab(routine.name, routine.type, currentDatabase.value)
}

const handleTriggerClick = (trigger: Trigger) => {
  if (!activeConnectionId.value) return
  openTriggerTab(trigger.name, trigger.table, currentDatabase.value)
}

const handleEventClick = (event: MySQLEvent) => {
  if (!activeConnectionId.value) return
  openEventTab(event.name, currentDatabase.value)
}

const refreshTables = async (connectionId: string) => {
  await connectionsStore.loadTables(connectionId, connectionsStore.getActiveDatabase(connectionId))
  routines.value.delete(connectionId)
  triggers.value.delete(connectionId)
  events.value.delete(connectionId)
  loadRoutines(connectionId)
  loadTriggers(connectionId)
  loadEvents(connectionId)
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

const openCreateTable = (connectionId: string, database?: string) => {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  setTimeout(() => {
    showCreateTableDialog.value = true
  }, 150)
}

const handleCreateTable = async (tableDef: any) => {
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createTable(selectedConnectionId.value, {
      table: JSON.parse(JSON.stringify(tableDef))
    })

    if (result.success) {
      showCreateTableDialog.value = false
      cleanupDialogState()
      toast.success(`Table "${tableDef.name}" created`)
      if (selectedConnectionId.value) {
        const db = connectionsStore.getActiveDatabase(selectedConnectionId.value)
        await connectionsStore.loadTables(selectedConnectionId.value, db)
        openTableTab(tableDef.name, db || undefined)
      }
    } else {
      toast.error(result.error || 'Failed to create table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create table')
  }
}

// View operations
const openCreateView = (connectionId: string, database?: string) => {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  setTimeout(() => {
    showCreateViewDialog.value = true
  }, 150)
}

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
      showCreateViewDialog.value = false
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
    <!-- macOS Traffic Light Area -->
    <div class=" flex-shrink-0 titlebar-drag" />

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
        <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input v-model="searchFilter" placeholder="Search..." class="h-8 pl-8 text-sm" />
      </div>
    </div>

    <!-- Items tab -->
    <ScrollArea v-show="activeSidebarTab === 'items'" class="flex-1 px-2">
      <div class="space-y-0.5 py-2">
        <!-- Redis: Database list -->
        <template v-if="isRedis && !selectedRedisDb">
          <div v-if="loadingRedisDbs" class="px-2 py-2">
            <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <template v-else-if="redisDatabases.length > 0">
            <div v-for="db in redisDatabases" :key="db.name"
              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              @click="handleRedisDbClick(db)">
              <IconDatabase class="h-4 w-4 text-red-500" />
              <span class="flex-1 truncate text-sm">{{ db.name }}</span>
              <span class="text-xs text-muted-foreground">{{ db.keys }} keys</span>
            </div>
          </template>
          <div v-else class="px-2 py-2 text-sm text-muted-foreground">
            No databases with keys
          </div>
        </template>

        <!-- Redis: Back button + keys list -->
        <template v-else-if="isRedis && selectedRedisDb">
          <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md text-sm text-muted-foreground"
            @click="handleBackToDatabases">
            <IconChevronLeft class="h-4 w-4" />
            <span>{{ selectedRedisDb }}</span>
          </div>

          <!-- Redis keys (using activeTables) -->
          <template v-for="table in activeTables" :key="table.name">
            <ContextMenu>
              <ContextMenuTrigger as-child>
                <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }"
                  @click="selectedNodeId = `table-${table.name}`; handleTableClick(table)">
                  <IconTable class="h-4 w-4 text-blue-500" />
                  <span class="flex-1 truncate text-sm">{{ table.name }}</span>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  @click="openTableTab(table.name, selectedRedisDb || undefined)">
                  <IconTable class="h-4 w-4 mr-2" />
                  View Data
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem @click="navigator.clipboard.writeText(table.name)">
                  <IconCopy class="h-4 w-4 mr-2" />
                  Copy Name
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </template>

          <!-- Empty keys state -->
          <div v-if="activeTables.length === 0" class="px-2 py-2 text-sm text-muted-foreground">
            No keys found
          </div>
        </template>

        <!-- Non-Redis: Tables & Views -->
        <template v-else>
          <!-- Tables Folder (always open by default) -->
          <Collapsible v-if="activeConnectionId && !isMongoDB" v-model:open="tablesOpen">
            <div class="flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md">
              <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': tablesOpen }" />
                <span class="text-sm font-medium">Tables</span>
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" class="h-5 w-5" @click.stop="openCreateTable(activeConnectionId!, currentDatabase)">
                <IconPlus class="h-3.5 w-3.5" />
              </Button>
            </div>
            <CollapsibleContent class="ml-2">
              <template v-for="table in filteredTablesOnly" :key="table.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }"
                      @click="selectedNodeId = `table-${table.name}`; handleTableClick(table)">
                      <IconTable class="h-4 w-4 text-blue-500" />
                      <span class="flex-1 truncate text-sm">{{ table.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="openTableTab(table.name, currentDatabase)">
                      <IconTable class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${table.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query Table
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="selectedTable = table; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showRenameDialog = true">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Rename Table
                    </ContextMenuItem>
                    <ContextMenuItem @click="selectedTable = table; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropDialog = true">
                      <IconTrash class="h-4 w-4 mr-2" />
                      Drop Table
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(table.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM &quot;${table.name}&quot;;`)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy SELECT Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
              <div v-if="filteredTablesOnly.length === 0" class="px-2 py-1 text-sm text-muted-foreground">
                No tables found
              </div>
            </CollapsibleContent>
          </Collapsible>

          <!-- Views Folder -->
          <Collapsible v-if="filteredViewsOnly.length > 0" v-model:open="viewsOpen">
            <div class="flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md">
              <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': viewsOpen }" />
                <span class="text-sm font-medium">Views</span>
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" class="h-5 w-5" @click.stop="openCreateView(activeConnectionId!, currentDatabase)">
                <IconPlus class="h-3.5 w-3.5" />
              </Button>
            </div>
            <CollapsibleContent class="ml-2">
              <template v-for="view in filteredViewsOnly" :key="view.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `table-${view.name}` }"
                      @click="selectedNodeId = `table-${view.name}`; handleTableClick(view)">
                      <IconEye class="h-4 w-4 text-purple-500" />
                      <span class="flex-1 truncate text-sm">{{ view.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="openViewTab(view.name, currentDatabase)">
                      <IconEye class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${view.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query View
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="openEditView(activeConnectionId!, view, currentDatabase)">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Edit View
                    </ContextMenuItem>
                    <ContextMenuItem @click="selectedView = view; selectedConnectionId = activeConnectionId; selectedDatabase = currentDatabase || null; showDropViewDialog = true">
                      <IconTrash class="h-4 w-4 mr-2" />
                      Drop View
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(view.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM &quot;${view.name}&quot;;`)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy SELECT Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </CollapsibleContent>
          </Collapsible>

          <!-- Functions Folder -->
          <Collapsible v-if="filteredFunctions.length > 0" v-model:open="functionsOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': functionsOpen }" />
              <span class="text-sm font-medium">Functions</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="routine in filteredFunctions" :key="routine.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `routine-${routine.name}` }"
                      @click="selectedNodeId = `routine-${routine.name}`; handleRoutineClick(routine)">
                      <IconFunction class="h-4 w-4 text-amber-500" />
                      <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleRoutineClick(routine)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(routine.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT ${routine.name}();`)">
                      <IconFunction class="h-4 w-4 mr-2" />
                      Generate SELECT Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </CollapsibleContent>
          </Collapsible>

          <!-- Procedures Folder -->
          <Collapsible v-if="filteredProcedures.length > 0" v-model:open="proceduresOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': proceduresOpen }" />
              <span class="text-sm font-medium">Procedures</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="routine in filteredProcedures" :key="routine.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `routine-${routine.name}` }"
                      @click="selectedNodeId = `routine-${routine.name}`; handleRoutineClick(routine)">
                      <IconTerminal2 class="h-4 w-4 text-green-500" />
                      <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleRoutineClick(routine)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(routine.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`CALL ${routine.name}();`)">
                      <IconTerminal2 class="h-4 w-4 mr-2" />
                      Generate CALL Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </CollapsibleContent>
          </Collapsible>

          <!-- Triggers Folder -->
          <Collapsible v-if="filteredTriggers.length > 0" v-model:open="triggersOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': triggersOpen }" />
              <span class="text-sm font-medium">Triggers</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="trigger in filteredTriggers" :key="trigger.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `trigger-${trigger.name}` }"
                      @click="selectedNodeId = `trigger-${trigger.name}`; handleTriggerClick(trigger)">
                      <IconBolt class="h-4 w-4 text-yellow-500" />
                      <span class="flex-1 truncate text-sm">{{ trigger.name }}</span>
                      <span class="text-xs text-muted-foreground">{{ trigger.timing?.toLowerCase() }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleTriggerClick(trigger)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(trigger.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="navigator.clipboard.writeText(`DROP TRIGGER ${trigger.name};`)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy DROP Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </CollapsibleContent>
          </Collapsible>

          <!-- Events Folder (MySQL only) -->
          <Collapsible v-if="filteredEvents.length > 0" v-model:open="eventsOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': eventsOpen }" />
              <span class="text-sm font-medium">Events</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="event in filteredEvents" :key="event.name">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `event-${event.name}` }"
                      @click="selectedNodeId = `event-${event.name}`; handleEventClick(event)">
                      <IconCalendarEvent class="h-4 w-4 text-pink-500" />
                      <span class="flex-1 truncate text-sm">{{ event.name }}</span>
                      <span class="text-xs px-1 rounded"
                        :class="event.status === 'ENABLED' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-500'">
                        {{ event.status === 'ENABLED' ? 'on' : 'off' }}
                      </span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleEventClick(event)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="navigator.clipboard.writeText(event.name)">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </CollapsibleContent>
          </Collapsible>

          <!-- Loading indicators -->
          <div v-if="activeConnectionId && loadingEvents.has(activeConnectionId)" class="px-2 py-1">
            <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div v-if="activeConnectionId && loadingRoutines.has(activeConnectionId)" class="px-2 py-1">
            <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
          <div v-if="activeConnectionId && loadingTriggers.has(activeConnectionId)" class="px-2 py-1">
            <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </template>
      </div>
    </ScrollArea>

    <!-- Queries tab -->
    <ScrollArea v-show="activeSidebarTab === 'queries'" class="flex-1 px-2">
      <SidebarSavedQueriesList
        :queries="filteredSavedQueries"
        :loading="loadingSavedQueries"
        @run="handleRunSavedQuery"
        @edit="handleEditSavedQuery"
        @delete="handleDeleteSavedQuery"
        @new="handleNewSavedQuery"
        @copy="handleCopySavedQuery"
      />
    </ScrollArea>

    <!-- History tab -->
    <ScrollArea v-show="activeSidebarTab === 'history'" class="flex-1 px-2">
      <SidebarHistoryList
        :history="filteredHistory"
        :loading="loadingHistory"
        @run="handleRunHistory"
        @delete="handleDeleteHistory"
        @clear="handleClearHistory"
        @copy="handleCopyHistory"
        @save="handleSaveFromHistory"
      />
    </ScrollArea>

    <!-- Rename Table Dialog -->
    <RenameTableDialog v-if="selectedTable" :open="showRenameDialog"
      @update:open="(v: boolean) => { showRenameDialog = v; if (!v) cleanupDialogState() }"
      :current-name="selectedTable.name" @rename="handleRenameTable" />

    <!-- Drop Table Confirmation Dialog -->
    <ConfirmDeleteDialog v-if="selectedTable" :open="showDropDialog"
      @update:open="(v: boolean) => { showDropDialog = v; if (!v) cleanupDialogState() }"
      title="Drop Table"
      :message="`Are you sure you want to drop table '${selectedTable.name}'? This action cannot be undone and all data will be lost.`"
      :sql="`DROP TABLE &quot;${selectedTable.name}&quot;`" confirm-text="Drop Table" @confirm="handleDropTable" />

    <!-- Create Table Dialog -->
    <CreateTableDialog v-if="selectedConnectionId" :open="showCreateTableDialog"
      @update:open="(v: boolean) => { showCreateTableDialog = v; if (!v) cleanupDialogState() }"
      :connection-id="selectedConnectionId" :database="selectedDatabase || ''" @save="handleCreateTable" />

    <!-- Create View Dialog -->
    <ViewEditorDialog v-if="selectedConnectionId" :open="showCreateViewDialog"
      @update:open="(v: boolean) => { showCreateViewDialog = v; if (!v) cleanupDialogState() }"
      :connection-id="selectedConnectionId" :database="selectedDatabase || ''" mode="create" @save="handleCreateView" />

    <!-- Edit View Dialog -->
    <ViewEditorDialog v-if="selectedConnectionId && selectedView" :open="showEditViewDialog"
      @update:open="(v: boolean) => { showEditViewDialog = v; if (!v) cleanupDialogState() }"
      :connection-id="selectedConnectionId" :database="selectedDatabase || ''" mode="edit"
      :existing-view-name="selectedView.name" :existing-select-statement="selectedViewDDL" @save="handleCreateView" />

    <!-- Drop View Confirmation Dialog -->
    <ConfirmDeleteDialog v-if="selectedView" :open="showDropViewDialog"
      @update:open="(v: boolean) => { showDropViewDialog = v; if (!v) cleanupDialogState() }"
      title="Drop View"
      :message="`Are you sure you want to drop view '${selectedView.name}'? This action cannot be undone.`"
      :sql="`DROP VIEW &quot;${selectedView.name}&quot;`" confirm-text="Drop View" @confirm="handleDropView" />

    <!-- Save Query Dialog -->
    <SaveQueryDialog
      :open="showSaveQueryDialog"
      @update:open="(v: boolean) => { showSaveQueryDialog = v; if (!v) { editingSavedQuery = null; cleanupDialogState() } }"
      :existing="editingSavedQuery"
      @save="handleSaveQuery"
    />

  </div>
</template>