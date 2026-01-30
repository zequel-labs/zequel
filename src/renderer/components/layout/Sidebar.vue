<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { Table, Routine, Trigger, MySQLEvent } from '@/types/table'
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
  IconPlus
} from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
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
  return connection?.type === 'redis'
})
const isMongoDB = computed(() => {
  if (!activeConnectionId.value) return false
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  return connection?.type === 'mongodb'
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

// Watch activeConnectionId to auto-load schema data
watch(() => connectionsStore.activeConnectionId, async (newId) => {
  selectedRedisDb.value = null
  if (newId && connectionsStore.getConnectionState(newId).status === 'connected') {
    const connection = connections.value.find(c => c.id === newId)
    if (connection) {
      if (connection.type === 'redis') {
        await loadRedisDatabases(newId)
      } else {
        await connectionsStore.loadTables(newId, connection.database)
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
async function loadRedisDatabases(connectionId: string) {
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

async function handleRedisDbClick(db: { name: string; keys: number }) {
  if (!activeConnectionId.value) return
  selectedRedisDb.value = db.name
  await connectionsStore.loadTables(activeConnectionId.value, db.name)
}

function handleBackToDatabases() {
  selectedRedisDb.value = null
  if (activeConnectionId.value) {
    connectionsStore.tables.delete(activeConnectionId.value)
  }
}

// Listen for refresh-schema events from HeaderBar
function handleRefreshSchema() {
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

async function loadRoutines(connectionId: string) {
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

async function loadTriggers(connectionId: string) {
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

async function loadEvents(connectionId: string) {
  if (loadingEvents.value.has(connectionId)) return

  const connection = connections.value.find(c => c.id === connectionId)
  if (!connection || connection.type !== 'mysql') return

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

function handleTableClick(table: { name: string; type: string }) {
  if (!activeConnectionId.value) return
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  if (table.type === 'view') {
    openViewTab(table.name, connection?.database)
  } else {
    openTableTab(table.name, connection?.database)
  }
}

function handleRoutineClick(routine: Routine) {
  if (!activeConnectionId.value) return
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  openRoutineTab(routine.name, routine.type, connection?.database)
}

function handleTriggerClick(trigger: Trigger) {
  if (!activeConnectionId.value) return
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  openTriggerTab(trigger.name, trigger.table, connection?.database)
}

function handleEventClick(event: MySQLEvent) {
  if (!activeConnectionId.value) return
  const connection = connections.value.find(c => c.id === activeConnectionId.value)
  openEventTab(event.name, connection?.database)
}

async function refreshTables(connectionId: string) {
  const connection = connections.value.find(c => c.id === connectionId)
  if (connection) {
    await connectionsStore.loadTables(connectionId, connection.database)
    routines.value.delete(connectionId)
    triggers.value.delete(connectionId)
    events.value.delete(connectionId)
    loadRoutines(connectionId)
    loadTriggers(connectionId)
    loadEvents(connectionId)
  }
}

// Table operations
async function handleRenameTable(newName: string) {
  if (!selectedTable.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.renameTable(selectedConnectionId.value, {
      oldName: selectedTable.value.name,
      newName
    })

    if (result.success) {
      showRenameDialog.value = false
      toast.success(`Table renamed to "${newName}"`)
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      toast.error(result.error || 'Failed to rename table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to rename table')
  }
}

async function handleDropTable() {
  if (!selectedTable.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.dropTable(selectedConnectionId.value, {
      table: selectedTable.value.name
    })

    if (result.success) {
      showDropDialog.value = false
      toast.success(`Table "${selectedTable.value.name}" dropped`)
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      toast.error(result.error || 'Failed to drop table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to drop table')
  }
}

function cleanupDialogState() {
  setTimeout(() => {
    document.body.style.pointerEvents = ''
  }, 150)
}

function openCreateTable(connectionId: string, database?: string) {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  setTimeout(() => {
    showCreateTableDialog.value = true
  }, 150)
}

async function handleCreateTable(tableDef: any) {
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createTable(selectedConnectionId.value, {
      table: JSON.parse(JSON.stringify(tableDef))
    })

    if (result.success) {
      showCreateTableDialog.value = false
      cleanupDialogState()
      toast.success(`Table "${tableDef.name}" created`)
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
      openTableTab(tableDef.name, connection?.database)
    } else {
      toast.error(result.error || 'Failed to create table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create table')
  }
}

// View operations
function openCreateView(connectionId: string, database?: string) {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  setTimeout(() => {
    showCreateViewDialog.value = true
  }, 150)
}

async function openEditView(connectionId: string, view: { name: string; type: string }, database?: string) {
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

async function handleCreateView(viewDef: any) {
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createView(selectedConnectionId.value, {
      view: JSON.parse(JSON.stringify(viewDef))
    })

    if (result.success) {
      showCreateViewDialog.value = false
      showEditViewDialog.value = false
      toast.success('View saved')
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      toast.error(result.error || 'Failed to create/update view')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create/update view')
  }
}

async function handleDropView() {
  if (!selectedView.value || !selectedConnectionId.value) return

  try {
    const result = await window.api.schema.dropView(selectedConnectionId.value, {
      viewName: selectedView.value.name
    })

    if (result.success) {
      showDropViewDialog.value = false
      toast.success(`View "${selectedView.value.name}" dropped`)
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      toast.error(result.error || 'Failed to drop view')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to drop view')
  }
}

</script>

<template>
  <div class="flex h-full flex-col bg-muted/30 border-r overflow-hidden">
    <!-- macOS Traffic Light Area -->
    <div class=" flex-shrink-0 titlebar-drag" />

    <ScrollArea class="flex-1 px-2">
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
              <Button variant="ghost" size="icon" class="h-5 w-5" @click.stop="openCreateTable(activeConnectionId!, connections.find(c => c.id === activeConnectionId)?.database)">
                <IconPlus class="h-3.5 w-3.5" />
              </Button>
            </div>
            <CollapsibleContent class="ml-2">
              <template v-for="table in activeTablesOnly" :key="table.name">
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
                    <ContextMenuItem @click="openTableTab(table.name, connections.find(c => c.id === activeConnectionId)?.database)">
                      <IconTable class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${table.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query Table
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="selectedTable = table; selectedConnectionId = activeConnectionId; selectedDatabase = connections.find(c => c.id === activeConnectionId)?.database || null; showRenameDialog = true">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Rename Table
                    </ContextMenuItem>
                    <ContextMenuItem @click="selectedTable = table; selectedConnectionId = activeConnectionId; selectedDatabase = connections.find(c => c.id === activeConnectionId)?.database || null; showDropDialog = true">
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
              <div v-if="activeTablesOnly.length === 0" class="px-2 py-1 text-sm text-muted-foreground">
                No tables found
              </div>
            </CollapsibleContent>
          </Collapsible>

          <!-- Views Folder -->
          <Collapsible v-if="activeViewsOnly.length > 0" v-model:open="viewsOpen">
            <div class="flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md">
              <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': viewsOpen }" />
                <span class="text-sm font-medium">Views</span>
              </CollapsibleTrigger>
              <Button variant="ghost" size="icon" class="h-5 w-5" @click.stop="openCreateView(activeConnectionId!, connections.find(c => c.id === activeConnectionId)?.database)">
                <IconPlus class="h-3.5 w-3.5" />
              </Button>
            </div>
            <CollapsibleContent class="ml-2">
              <template v-for="view in activeViewsOnly" :key="view.name">
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
                    <ContextMenuItem @click="openViewTab(view.name, connections.find(c => c.id === activeConnectionId)?.database)">
                      <IconEye class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${view.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query View
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="openEditView(activeConnectionId!, view, connections.find(c => c.id === activeConnectionId)?.database)">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Edit View
                    </ContextMenuItem>
                    <ContextMenuItem @click="selectedView = view; selectedConnectionId = activeConnectionId; selectedDatabase = connections.find(c => c.id === activeConnectionId)?.database || null; showDropViewDialog = true">
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
          <Collapsible v-if="activeFunctions.length > 0" v-model:open="functionsOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': functionsOpen }" />
              <span class="text-sm font-medium">Functions</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="routine in activeFunctions" :key="routine.name">
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
          <Collapsible v-if="activeProcedures.length > 0" v-model:open="proceduresOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': proceduresOpen }" />
              <span class="text-sm font-medium">Procedures</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="routine in activeProcedures" :key="routine.name">
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
          <Collapsible v-if="activeTriggers.length > 0" v-model:open="triggersOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': triggersOpen }" />
              <span class="text-sm font-medium">Triggers</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="trigger in activeTriggers" :key="trigger.name">
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
          <Collapsible v-if="activeEvents.length > 0" v-model:open="eventsOpen">
            <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform" :class="{ 'rotate-90': eventsOpen }" />
              <span class="text-sm font-medium">Events</span>
            </CollapsibleTrigger>
            <CollapsibleContent class="ml-2">
              <template v-for="event in activeEvents" :key="event.name">
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

  </div>
</template>