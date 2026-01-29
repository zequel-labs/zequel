<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useRecentsStore } from '@/stores/recents'
import { useTabs } from '@/composables/useTabs'
import type { Table, Routine, Trigger, MySQLEvent } from '@/types/table'
import {
  IconDatabase,
  IconPlus,
  IconChevronRight,
  IconChevronDown,
  IconTable,
  IconEye,
  IconLoader2,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconSchema,
  IconFunction,
  IconTerminal2,
  IconUsers,
  IconDownload,
  IconUpload,
  IconActivity,
  IconBolt,
  IconCalendarEvent,
  IconHistory,
  IconX
} from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import RenameTableDialog from '../schema/RenameTableDialog.vue'
import ConfirmDeleteDialog from '../schema/ConfirmDeleteDialog.vue'
import CreateTableDialog from '../schema/CreateTableDialog.vue'
import ViewEditorDialog from '../schema/ViewEditorDialog.vue'

interface TreeNode {
  id: string
  label: string
  type: 'database' | 'schema' | 'tables' | 'table' | 'view'
  children?: TreeNode[]
  data?: any
}

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
}>()

const connectionsStore = useConnectionsStore()
const recentsStore = useRecentsStore()
const { openTableTab, openViewTab, openQueryTab, openERDiagramTab, openRoutineTab, openUsersTab, openMonitoringTab, openTriggerTab, openSequenceTab, openMaterializedViewTab, openExtensionsTab, openEnumsTab, openEventTab } = useTabs()

// Recents section state
const showRecents = ref(true)

const expandedNodes = ref<Set<string>>(new Set())
const selectedNodeId = ref<string | null>(null)
const loadingNodes = ref<Set<string>>(new Set())

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

// Backup state
const backupInProgress = ref(false)

const connections = computed(() => connectionsStore.sortedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

onMounted(() => {
  connectionsStore.loadConnections()
  recentsStore.loadRecents()
})

function getConnectionState(id: string) {
  return connectionsStore.getConnectionState(id)
}

function isConnected(id: string) {
  return getConnectionState(id).status === 'connected'
}

async function loadRoutines(connectionId: string) {
  if (loadingRoutines.value.has(connectionId) || routines.value.has(connectionId)) return

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
  if (loadingTriggers.value.has(connectionId) || triggers.value.has(connectionId)) return

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
  if (loadingEvents.value.has(connectionId) || events.value.has(connectionId)) return

  // Only load events for MySQL connections
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

async function handleConnectionClick(connectionId: string) {
  const state = getConnectionState(connectionId)

  if (state.status === 'connected') {
    // Already connected, toggle expand
    toggleNode(`conn-${connectionId}`)
    // Load routines, triggers, and events if expanding
    if (expandedNodes.value.has(`conn-${connectionId}`)) {
      loadRoutines(connectionId)
      loadTriggers(connectionId)
      loadEvents(connectionId)
    }
  } else if (state.status !== 'connecting') {
    // Not connected, try to connect
    try {
      await connectionsStore.connect(connectionId)
      expandedNodes.value.add(`conn-${connectionId}`)
      // Load routines, triggers, and events after connection
      loadRoutines(connectionId)
      loadTriggers(connectionId)
      loadEvents(connectionId)
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }
}

async function handleDisconnect(connectionId: string) {
  await connectionsStore.disconnect(connectionId)
  expandedNodes.value.delete(`conn-${connectionId}`)
  routines.value.delete(connectionId)
  triggers.value.delete(connectionId)
  events.value.delete(connectionId)
}

function toggleNode(nodeId: string) {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId)
  } else {
    expandedNodes.value.add(nodeId)
  }
}

async function handleDatabaseClick(connectionId: string, database: string) {
  const nodeId = `db-${connectionId}-${database}`

  if (!expandedNodes.value.has(nodeId)) {
    loadingNodes.value.add(nodeId)
    try {
      await connectionsStore.loadTables(connectionId, database)
      expandedNodes.value.add(nodeId)
    } finally {
      loadingNodes.value.delete(nodeId)
    }
  } else {
    toggleNode(nodeId)
  }
}

function handleTableClick(connectionId: string, table: { name: string; type: string }, database?: string) {
  if (table.type === 'view') {
    openViewTab(table.name, database)
    recentsStore.addRecentView(table.name, connectionId, database)
  } else {
    openTableTab(table.name, database)
    recentsStore.addRecentTable(table.name, connectionId, database)
  }
}

function handleRecentClick(item: { type: string; name: string; connectionId: string; database?: string; sql?: string }) {
  // First connect if not connected
  const connection = connections.value.find(c => c.id === item.connectionId)
  if (!connection) return

  if (!isConnected(item.connectionId)) {
    connectionsStore.connect(item.connectionId).then(() => {
      openRecentItem(item)
    })
  } else {
    openRecentItem(item)
  }
}

function openRecentItem(item: { type: string; name: string; database?: string; sql?: string }) {
  if (item.type === 'table') {
    openTableTab(item.name, item.database)
  } else if (item.type === 'view') {
    openViewTab(item.name, item.database)
  } else if (item.type === 'query' && item.sql) {
    openQueryTab(item.sql)
  }
}

function getConnectionName(connectionId: string): string {
  const connection = connections.value.find(c => c.id === connectionId)
  return connection?.name || 'Unknown'
}


function handleRoutineClick(connectionId: string, routine: Routine, database?: string) {
  openRoutineTab(routine.name, routine.type, database)
}

function handleTriggerClick(connectionId: string, trigger: Trigger, database?: string) {
  openTriggerTab(trigger.name, trigger.table, database)
}

function handleEventClick(connectionId: string, event: MySQLEvent, database?: string) {
  openEventTab(event.name, database)
}

async function refreshTables(connectionId: string) {
  const connection = connections.value.find(c => c.id === connectionId)
  if (connection) {
    await connectionsStore.loadTables(connectionId, connection.database)
    // Also refresh routines, triggers, and events
    routines.value.delete(connectionId)
    triggers.value.delete(connectionId)
    events.value.delete(connectionId)
    loadRoutines(connectionId)
    loadTriggers(connectionId)
    loadEvents(connectionId)
  }
}

async function handleDeleteConnection(connectionId: string) {
  if (confirm('Are you sure you want to delete this connection?')) {
    await connectionsStore.deleteConnection(connectionId)
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
      // Refresh tables
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      alert(result.error || 'Failed to rename table')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to rename table')
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
      // Refresh tables
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      alert(result.error || 'Failed to drop table')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to drop table')
  }
}

function openCreateTable(connectionId: string, database?: string) {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  showCreateTableDialog.value = true
}

async function handleCreateTable(tableDef: any) {
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createTable(selectedConnectionId.value, {
      table: tableDef
    })

    if (result.success) {
      showCreateTableDialog.value = false
      // Refresh tables
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      alert(result.error || 'Failed to create table')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to create table')
  }
}

// View operations
function openCreateView(connectionId: string, database?: string) {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  showCreateViewDialog.value = true
}

async function openEditView(connectionId: string, view: { name: string; type: string }, database?: string) {
  selectedConnectionId.value = connectionId
  selectedDatabase.value = database || null
  selectedView.value = view

  try {
    // Fetch view DDL to get the SELECT statement
    const ddl = await window.api.schema.viewDDL(connectionId, view.name)
    // Extract SELECT statement from DDL (basic extraction)
    const match = ddl.match(/AS\s+(SELECT[\s\S]+?)(?:;?\s*$)/i)
    selectedViewDDL.value = match ? match[1].trim() : ''
    showEditViewDialog.value = true
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to load view definition')
  }
}

async function handleCreateView(viewDef: any) {
  if (!selectedConnectionId.value) return

  try {
    const result = await window.api.schema.createView(selectedConnectionId.value, {
      view: viewDef
    })

    if (result.success) {
      showCreateViewDialog.value = false
      showEditViewDialog.value = false
      // Refresh tables
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      alert(result.error || 'Failed to create/update view')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to create/update view')
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
      // Refresh tables
      const connection = connections.value.find(c => c.id === selectedConnectionId.value)
      if (connection) {
        await connectionsStore.loadTables(selectedConnectionId.value, connection.database)
      }
    } else {
      alert(result.error || 'Failed to drop view')
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to drop view')
  }
}

// Backup/Restore functions
async function handleExportBackup(connectionId: string) {
  backupInProgress.value = true
  try {
    const result = await window.api.backup.export(connectionId)
    if (result.success) {
      alert(`Database exported successfully to:\n${result.filePath}`)
    } else if (result.error !== 'Export canceled') {
      alert(`Export failed: ${result.error}`)
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Export failed')
  } finally {
    backupInProgress.value = false
  }
}

async function handleImportBackup(connectionId: string) {
  backupInProgress.value = true
  try {
    const result = await window.api.backup.import(connectionId)
    if (result.success) {
      alert(`Import successful!\n\nStatements executed: ${result.statements}`)
      // Refresh tables
      const connection = connections.value.find(c => c.id === connectionId)
      if (connection) {
        await connectionsStore.loadTables(connectionId, connection.database)
      }
    } else if (result.errors[0] !== 'Import canceled') {
      const errorMsg = result.errors.length > 0
        ? `Errors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n...and ${result.errors.length - 5} more` : ''}`
        : 'Unknown error'
      alert(`Import completed with errors.\n\nStatements executed: ${result.statements}\n\n${errorMsg}`)
      // Still refresh tables
      const connection = connections.value.find(c => c.id === connectionId)
      if (connection) {
        await connectionsStore.loadTables(connectionId, connection.database)
      }
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Import failed')
  } finally {
    backupInProgress.value = false
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-muted/30">
    <!-- macOS Traffic Light Area -->
    <div class="h-[38px] flex-shrink-0 titlebar-drag" />

    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2">
      <h2 class="text-sm font-semibold">Connections</h2>
      <div class="flex items-center gap-1">
        <Button
          v-if="activeConnectionId"
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="New Query (⌘N)"
          @click="openQueryTab('')"
        >
          <IconSql class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="New Connection"
          @click="emit('new-connection')"
        >
          <IconPlus class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Connections List -->
    <ScrollArea class="flex-1 px-2">
      <div class="space-y-1 pb-4">
        <!-- Recents Section -->
        <div v-if="recentsStore.items.length > 0" class="mb-3">
          <div
            class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
            @click="showRecents = !showRecents"
          >
            <button class="p-0.5 hover:bg-muted rounded">
              <IconChevronRight
                v-if="!showRecents"
                class="h-4 w-4 text-muted-foreground"
              />
              <IconChevronDown v-else class="h-4 w-4 text-muted-foreground" />
            </button>
            <IconHistory class="h-4 w-4 text-muted-foreground" />
            <span class="flex-1 text-sm font-medium text-muted-foreground">Recents</span>
            <button
              class="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
              title="Clear recents"
              @click.stop="recentsStore.clearRecents()"
            >
              <IconX class="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          <div v-if="showRecents" class="ml-4 mt-1 space-y-0.5">
            <div
              v-for="item in recentsStore.items.slice(0, 10)"
              :key="item.id"
              class="group flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-accent/50 rounded-md"
              @click="handleRecentClick(item)"
            >
              <IconSql v-if="item.type === 'query'" class="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              <IconEye v-else-if="item.type === 'view'" class="h-3.5 w-3.5 text-purple-500 shrink-0" />
              <IconTable v-else class="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span class="truncate flex-1">{{ item.name }}</span>
              <span class="text-[10px] text-muted-foreground truncate max-w-[80px]">{{ getConnectionName(item.connectionId) }}</span>
              <button
                class="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                @click.stop="recentsStore.removeRecent(item.id)"
              >
                <IconX class="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>

        <template v-for="connection in connections" :key="connection.id">
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <div
                class="group rounded-md"
                :class="{ 'bg-accent': activeConnectionId === connection.id }"
              >
                <!-- Connection Item -->
                <div
                  class="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-md"
                  @click="handleConnectionClick(connection.id)"
                >
                  <button
                    class="p-0.5 hover:bg-muted rounded"
                    @click.stop="toggleNode(`conn-${connection.id}`)"
                  >
                    <IconChevronRight
                      v-if="!expandedNodes.has(`conn-${connection.id}`)"
                      class="h-4 w-4 text-muted-foreground"
                    />
                    <IconChevronDown v-else class="h-4 w-4 text-muted-foreground" />
                  </button>

                  <div class="relative">
                    <IconDatabase
                      class="h-4 w-4 shrink-0"
                      :class="isConnected(connection.id) ? 'text-green-500' : 'text-muted-foreground'"
                      :style="connection.color && isConnected(connection.id) ? { color: connection.color } : {}"
                    />
                    <span
                      v-if="connection.color"
                      class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background"
                      :style="{ backgroundColor: connection.color }"
                    />
                  </div>

                  <span class="flex-1 truncate text-sm">{{ connection.name }}</span>

                  <IconLoader2
                    v-if="getConnectionState(connection.id).status === 'connecting'"
                    class="h-4 w-4 animate-spin text-muted-foreground"
                  />

                  <button
                    v-else-if="isConnected(connection.id)"
                    class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
                    title="Disconnect"
                    @click.stop="handleDisconnect(connection.id)"
                  >
                    <IconPlugConnectedX class="h-4 w-4 text-muted-foreground" />
                  </button>

                  <button
                    v-else
                    class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded"
                    title="Connect"
                    @click.stop="handleConnectionClick(connection.id)"
                  >
                    <IconPlugConnected class="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <!-- Tables (directly under connection) -->
                <div
                  v-if="expandedNodes.has(`conn-${connection.id}`) && isConnected(connection.id)"
                  class="ml-6 space-y-0.5"
                >
                  <template v-for="table in connectionsStore.tables.get(connection.id)" :key="table.name">
                    <ContextMenu>
                      <ContextMenuTrigger as-child>
                        <div
                          class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                          :class="{ 'bg-accent': selectedNodeId === `table-${connection.id}-${table.name}` }"
                          @click="selectedNodeId = `table-${connection.id}-${table.name}`; handleTableClick(connection.id, table, connection.database)"
                        >
                          <IconTable v-if="table.type === 'table'" class="h-4 w-4 text-blue-500" />
                          <IconEye v-else class="h-4 w-4 text-purple-500" />
                          <span class="flex-1 truncate text-sm">{{ table.name }}</span>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <!-- Table context menu -->
                        <template v-if="table.type === 'table'">
                          <ContextMenuItem @click="openTableTab(table.name, connection.database)">
                            <IconTable class="h-4 w-4 mr-2" />
                            View Data
                          </ContextMenuItem>
                          <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${table.name}&quot; LIMIT 100;`)">
                            <IconSql class="h-4 w-4 mr-2" />
                            Query Table
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem @click="selectedTable = table; selectedConnectionId = connection.id; selectedDatabase = connection.database || null; showRenameDialog = true">
                            <IconPencil class="h-4 w-4 mr-2" />
                            Rename Table
                          </ContextMenuItem>
                          <ContextMenuItem @click="selectedTable = table; selectedConnectionId = connection.id; selectedDatabase = connection.database || null; showDropDialog = true">
                            <IconTrash class="h-4 w-4 mr-2" />
                            Drop Table
                          </ContextMenuItem>
                        </template>
                        <!-- View context menu -->
                        <template v-else>
                          <ContextMenuItem @click="openViewTab(table.name, connection.database)">
                            <IconEye class="h-4 w-4 mr-2" />
                            View Data
                          </ContextMenuItem>
                          <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${table.name}&quot; LIMIT 100;`)">
                            <IconSql class="h-4 w-4 mr-2" />
                            Query View
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem @click="openEditView(connection.id, table, connection.database)">
                            <IconPencil class="h-4 w-4 mr-2" />
                            Edit View
                          </ContextMenuItem>
                          <ContextMenuItem @click="selectedView = table; selectedConnectionId = connection.id; selectedDatabase = connection.database || null; showDropViewDialog = true">
                            <IconTrash class="h-4 w-4 mr-2" />
                            Drop View
                          </ContextMenuItem>
                        </template>
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

                  <!-- Loading state -->
                  <div
                    v-if="connectionsStore.tables.get(connection.id)?.length === 0 && (!routines.get(connection.id) || routines.get(connection.id)?.length === 0)"
                    class="px-2 py-2 text-sm text-muted-foreground"
                  >
                    No tables found
                  </div>

                  <!-- Routines Section -->
                  <template v-if="routines.get(connection.id)?.length">
                    <div class="mt-2 pt-2 border-t border-border/50">
                      <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Routines
                      </div>
                      <template v-for="routine in routines.get(connection.id)" :key="routine.name">
                        <ContextMenu>
                          <ContextMenuTrigger as-child>
                            <div
                              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                              :class="{ 'bg-accent': selectedNodeId === `routine-${connection.id}-${routine.name}` }"
                              @click="selectedNodeId = `routine-${connection.id}-${routine.name}`; handleRoutineClick(connection.id, routine, connection.database)"
                            >
                              <IconFunction v-if="routine.type === 'FUNCTION'" class="h-4 w-4 text-amber-500" />
                              <IconTerminal2 v-else class="h-4 w-4 text-green-500" />
                              <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                              <span class="text-xs text-muted-foreground">{{ routine.type === 'FUNCTION' ? 'fn' : 'sp' }}</span>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem @click="handleRoutineClick(connection.id, routine, connection.database)">
                              <IconSql class="h-4 w-4 mr-2" />
                              View Definition
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem @click="navigator.clipboard.writeText(routine.name)">
                              <IconCopy class="h-4 w-4 mr-2" />
                              Copy Name
                            </ContextMenuItem>
                            <ContextMenuItem v-if="routine.type === 'PROCEDURE'" @click="openQueryTab(`CALL ${routine.name}();`)">
                              <IconTerminal2 class="h-4 w-4 mr-2" />
                              Generate CALL Statement
                            </ContextMenuItem>
                            <ContextMenuItem v-else @click="openQueryTab(`SELECT ${routine.name}();`)">
                              <IconFunction class="h-4 w-4 mr-2" />
                              Generate SELECT Statement
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      </template>
                    </div>
                  </template>

                  <!-- Events Section (MySQL only) -->
                  <template v-if="events.get(connection.id)?.length">
                    <div class="mt-2 pt-2 border-t border-border/50">
                      <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Events
                      </div>
                      <template v-for="event in events.get(connection.id)" :key="event.name">
                        <ContextMenu>
                          <ContextMenuTrigger as-child>
                            <div
                              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                              :class="{ 'bg-accent': selectedNodeId === `event-${connection.id}-${event.name}` }"
                              @click="selectedNodeId = `event-${connection.id}-${event.name}`; handleEventClick(connection.id, event, connection.database)"
                            >
                              <IconCalendarEvent class="h-4 w-4 text-pink-500" />
                              <span class="flex-1 truncate text-sm">{{ event.name }}</span>
                              <span
                                class="text-xs px-1 rounded"
                                :class="event.status === 'ENABLED' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-500'"
                              >
                                {{ event.status === 'ENABLED' ? 'on' : 'off' }}
                              </span>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem @click="handleEventClick(connection.id, event, connection.database)">
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
                    </div>
                  </template>

                  <!-- Loading events -->
                  <div v-if="loadingEvents.has(connection.id)" class="px-2 py-1">
                    <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>

                  <!-- Loading routines -->
                  <div v-if="loadingRoutines.has(connection.id)" class="px-2 py-1">
                    <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>

                  <!-- Triggers Section -->
                  <template v-if="triggers.get(connection.id)?.length">
                    <div class="mt-2 pt-2 border-t border-border/50">
                      <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Triggers
                      </div>
                      <template v-for="trigger in triggers.get(connection.id)" :key="trigger.name">
                        <ContextMenu>
                          <ContextMenuTrigger as-child>
                            <div
                              class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                              :class="{ 'bg-accent': selectedNodeId === `trigger-${connection.id}-${trigger.name}` }"
                              @click="selectedNodeId = `trigger-${connection.id}-${trigger.name}`; handleTriggerClick(connection.id, trigger, connection.database)"
                            >
                              <IconBolt class="h-4 w-4 text-yellow-500" />
                              <span class="flex-1 truncate text-sm">{{ trigger.name }}</span>
                              <span class="text-xs text-muted-foreground">{{ trigger.timing?.toLowerCase() }}</span>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem @click="handleTriggerClick(connection.id, trigger, connection.database)">
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
                    </div>
                  </template>

                  <!-- Loading triggers -->
                  <div v-if="loadingTriggers.has(connection.id)" class="px-2 py-1">
                    <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem v-if="isConnected(connection.id)" @click="handleDisconnect(connection.id)">
                <IconPlugConnectedX class="h-4 w-4 mr-2" />
                Disconnect
              </ContextMenuItem>
              <ContextMenuItem v-else @click="handleConnectionClick(connection.id)">
                <IconPlugConnected class="h-4 w-4 mr-2" />
                Connect
              </ContextMenuItem>
              <template v-if="isConnected(connection.id)">
                <ContextMenuItem @click="refreshTables(connection.id)">
                  <IconRefresh class="h-4 w-4 mr-2" />
                  Refresh Tables
                </ContextMenuItem>
                <ContextMenuItem @click="openCreateTable(connection.id, connection.database)">
                  <IconPlus class="h-4 w-4 mr-2" />
                  Create Table
                </ContextMenuItem>
                <ContextMenuItem @click="openCreateView(connection.id, connection.database)">
                  <IconEye class="h-4 w-4 mr-2" />
                  Create View
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem @click="openERDiagramTab(connection.database)">
                  <IconSchema class="h-4 w-4 mr-2" />
                  ER Diagram
                </ContextMenuItem>
                <ContextMenuItem @click="openUsersTab(connection.database)">
                  <IconUsers class="h-4 w-4 mr-2" />
                  View Users
                </ContextMenuItem>
                <ContextMenuItem @click="openMonitoringTab(connection.database)">
                  <IconActivity class="h-4 w-4 mr-2" />
                  Process Monitor
                </ContextMenuItem>
                <!-- PostgreSQL-specific menu items -->
                <template v-if="connection.type === 'postgresql'">
                  <ContextMenuSeparator />
                  <ContextMenuItem @click="openExtensionsTab(connection.database)">
                    <IconPlus class="h-4 w-4 mr-2" />
                    Extensions
                  </ContextMenuItem>
                  <ContextMenuItem @click="openEnumsTab(undefined, connection.database)">
                    <IconTable class="h-4 w-4 mr-2" />
                    Enum Types
                  </ContextMenuItem>
                </template>
                <ContextMenuSeparator />
                <ContextMenuItem @click="handleExportBackup(connection.id)" :disabled="backupInProgress">
                  <IconDownload class="h-4 w-4 mr-2" />
                  Export Backup
                </ContextMenuItem>
                <ContextMenuItem @click="handleImportBackup(connection.id)" :disabled="backupInProgress">
                  <IconUpload class="h-4 w-4 mr-2" />
                  Import SQL
                </ContextMenuItem>
              </template>
              <ContextMenuSeparator />
              <ContextMenuItem @click="emit('edit-connection', connection.id)">
                <IconPencil class="h-4 w-4 mr-2" />
                Edit Connection
              </ContextMenuItem>
              <ContextMenuItem @click="handleDeleteConnection(connection.id)">
                <IconTrash class="h-4 w-4 mr-2" />
                Delete Connection
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </template>

        <!-- Empty state -->
        <div
          v-if="connections.length === 0"
          class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
        >
          <IconDatabase class="h-12 w-12 mb-3 opacity-50" />
          <p class="text-sm">No connections yet</p>
          <Button
            variant="link"
            class="mt-2"
            @click="emit('new-connection')"
          >
            Create your first connection
          </Button>
        </div>
      </div>
    </ScrollArea>

    <!-- Rename Table Dialog -->
    <RenameTableDialog
      v-if="selectedTable"
      v-model:open="showRenameDialog"
      :current-name="selectedTable.name"
      @rename="handleRenameTable"
    />

    <!-- Drop Table Confirmation Dialog -->
    <ConfirmDeleteDialog
      v-if="selectedTable"
      v-model:open="showDropDialog"
      title="Drop Table"
      :message="`Are you sure you want to drop table '${selectedTable.name}'? This action cannot be undone and all data will be lost.`"
      :sql="`DROP TABLE &quot;${selectedTable.name}&quot;`"
      confirm-text="Drop Table"
      @confirm="handleDropTable"
    />

    <!-- Create Table Dialog -->
    <CreateTableDialog
      v-if="selectedConnectionId"
      v-model:open="showCreateTableDialog"
      :connection-id="selectedConnectionId"
      :database="selectedDatabase || ''"
      @save="handleCreateTable"
    />

    <!-- Create View Dialog -->
    <ViewEditorDialog
      v-if="selectedConnectionId"
      v-model:open="showCreateViewDialog"
      :connection-id="selectedConnectionId"
      :database="selectedDatabase || ''"
      mode="create"
      @save="handleCreateView"
    />

    <!-- Edit View Dialog -->
    <ViewEditorDialog
      v-if="selectedConnectionId && selectedView"
      v-model:open="showEditViewDialog"
      :connection-id="selectedConnectionId"
      :database="selectedDatabase || ''"
      mode="edit"
      :existing-view-name="selectedView.name"
      :existing-select-statement="selectedViewDDL"
      @save="handleCreateView"
    />

    <!-- Drop View Confirmation Dialog -->
    <ConfirmDeleteDialog
      v-if="selectedView"
      v-model:open="showDropViewDialog"
      title="Drop View"
      :message="`Are you sure you want to drop view '${selectedView.name}'? This action cannot be undone.`"
      :sql="`DROP VIEW &quot;${selectedView.name}&quot;`"
      confirm-text="Drop View"
      @confirm="handleDropView"
    />
  </div>
</template>
