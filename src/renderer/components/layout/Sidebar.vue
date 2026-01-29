<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { Table, Routine, Trigger, MySQLEvent } from '@/types/table'
import {
  IconTable,
  IconEye,
  IconLoader2,
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
  IconPlus,
  IconDatabase
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
import DatabaseManagerDialog from '../schema/DatabaseManagerDialog.vue'

const connectionsStore = useConnectionsStore()
const { openTableTab, openViewTab, openQueryTab, openERDiagramTab, openRoutineTab, openUsersTab, openMonitoringTab, openTriggerTab, openSequenceTab, openMaterializedViewTab, openExtensionsTab, openEnumsTab, openEventTab } = useTabs()

const selectedNodeId = ref<string | null>(null)

// Dialog states
const showDatabaseManager = ref(false)
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

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const connections = computed(() => connectionsStore.connections)

const activeConnectionName = computed(() => {
  if (!activeConnectionId.value) return ''
  const conn = connections.value.find(c => c.id === activeConnectionId.value)
  return conn?.name || ''
})

const activeConnectionType = computed(() => {
  if (!activeConnectionId.value) return null
  const conn = connections.value.find(c => c.id === activeConnectionId.value)
  return conn?.type || null
})

const activeTables = computed(() => {
  if (!activeConnectionId.value) return []
  return connectionsStore.tables.get(activeConnectionId.value) || []
})

const activeRoutines = computed(() => {
  if (!activeConnectionId.value) return []
  return routines.value.get(activeConnectionId.value) || []
})

const activeEvents = computed(() => {
  if (!activeConnectionId.value) return []
  return events.value.get(activeConnectionId.value) || []
})

const activeTriggers = computed(() => {
  if (!activeConnectionId.value) return []
  return triggers.value.get(activeConnectionId.value) || []
})

// Watch activeConnectionId to auto-load schema data
watch(() => connectionsStore.activeConnectionId, async (newId) => {
  if (newId && connectionsStore.getConnectionState(newId).status === 'connected') {
    const connection = connections.value.find(c => c.id === newId)
    if (connection) {
      await connectionsStore.loadTables(newId, connection.database)
      routines.value.delete(newId)
      triggers.value.delete(newId)
      events.value.delete(newId)
      loadRoutines(newId)
      loadTriggers(newId)
      loadEvents(newId)
    }
  }
}, { immediate: true })

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
    const ddl = await window.api.schema.viewDDL(connectionId, view.name)
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

// Database switching
async function handleSwitchDatabase(database: string) {
  const connectionId = activeConnectionId.value
  if (!connectionId) return
  const connection = connections.value.find(c => c.id === connectionId)
  if (!connection) return

  try {
    // Persist the new database to storage
    await connectionsStore.saveConnection({
      id: connection.id,
      name: connection.name,
      type: connection.type,
      host: connection.host || undefined,
      port: connection.port || undefined,
      database,
      username: connection.username || undefined,
      ssl: connection.ssl,
      ssh: connection.ssh || undefined,
      filepath: connection.filepath || undefined,
      color: connection.color || undefined
    })

    if (connection.type === 'postgresql' || connection.type === 'clickhouse') {
      // PostgreSQL and ClickHouse require reconnect to apply the new database
      await connectionsStore.disconnect(connectionId)
      await connectionsStore.connect(connectionId)
      // Watcher on activeConnectionId handles loading tables/routines/triggers/events
    } else {
      // MySQL/MariaDB: explicit USE command to switch server-side context
      if (connection.type === 'mysql' || connection.type === 'mariadb') {
        await window.api.query.execute(connectionId, `USE \`${database}\``)
      }
      // MongoDB/Redis: driver handles context switch internally via loadTables
      await connectionsStore.loadTables(connectionId, database)
      routines.value.delete(connectionId)
      triggers.value.delete(connectionId)
      events.value.delete(connectionId)
      loadRoutines(connectionId)
      loadTriggers(connectionId)
      loadEvents(connectionId)
    }

    toast.success(`Switched to database "${database}"`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to switch database')
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
      const connection = connections.value.find(c => c.id === connectionId)
      if (connection) {
        await connectionsStore.loadTables(connectionId, connection.database)
      }
    } else if (result.errors[0] !== 'Import canceled') {
      const errorMsg = result.errors.length > 0
        ? `Errors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n...and ${result.errors.length - 5} more` : ''}`
        : 'Unknown error'
      alert(`Import completed with errors.\n\nStatements executed: ${result.statements}\n\n${errorMsg}`)
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

    <!-- Explorer Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b">
      <span class="text-sm font-semibold truncate">{{ activeConnectionName }}</span>
      <div class="flex gap-1">
        <Button
          v-if="activeConnectionType && activeConnectionType !== 'sqlite'"
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="Database Manager"
          @click="showDatabaseManager = true"
        >
          <IconDatabase class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="New Query"
          @click="openQueryTab('')"
        >
          <IconSql class="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          title="Refresh"
          @click="refreshTables(activeConnectionId!)"
        >
          <IconRefresh class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <ScrollArea class="flex-1 px-2">
      <div class="space-y-0.5 py-2">
        <!-- Tables & Views -->
        <template v-for="table in activeTables" :key="table.name">
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <div
                class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }"
                @click="selectedNodeId = `table-${table.name}`; handleTableClick(table)"
              >
                <IconTable v-if="table.type === 'table'" class="h-4 w-4 text-blue-500" />
                <IconEye v-else class="h-4 w-4 text-purple-500" />
                <span class="flex-1 truncate text-sm">{{ table.name }}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <!-- Table context menu -->
              <template v-if="table.type === 'table'">
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
              </template>
              <!-- View context menu -->
              <template v-else>
                <ContextMenuItem @click="openViewTab(table.name, connections.find(c => c.id === activeConnectionId)?.database)">
                  <IconEye class="h-4 w-4 mr-2" />
                  View Data
                </ContextMenuItem>
                <ContextMenuItem @click="openQueryTab(`SELECT * FROM &quot;${table.name}&quot; LIMIT 100;`)">
                  <IconSql class="h-4 w-4 mr-2" />
                  Query View
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem @click="openEditView(activeConnectionId!, table, connections.find(c => c.id === activeConnectionId)?.database)">
                  <IconPencil class="h-4 w-4 mr-2" />
                  Edit View
                </ContextMenuItem>
                <ContextMenuItem @click="selectedView = table; selectedConnectionId = activeConnectionId; selectedDatabase = connections.find(c => c.id === activeConnectionId)?.database || null; showDropViewDialog = true">
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

        <!-- Empty tables state -->
        <div
          v-if="activeTables.length === 0 && activeRoutines.length === 0 && !loadingRoutines.has(activeConnectionId || '')"
          class="px-2 py-2 text-sm text-muted-foreground"
        >
          No tables found
        </div>

        <!-- Routines Section -->
        <template v-if="activeRoutines.length > 0">
          <div class="mt-2 pt-2 border-t border-border/50">
            <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Routines
            </div>
            <template v-for="routine in activeRoutines" :key="routine.name">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div
                    class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `routine-${routine.name}` }"
                    @click="selectedNodeId = `routine-${routine.name}`; handleRoutineClick(routine)"
                  >
                    <IconFunction v-if="routine.type === 'FUNCTION'" class="h-4 w-4 text-amber-500" />
                    <IconTerminal2 v-else class="h-4 w-4 text-green-500" />
                    <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ routine.type === 'FUNCTION' ? 'fn' : 'sp' }}</span>
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
        <template v-if="activeEvents.length > 0">
          <div class="mt-2 pt-2 border-t border-border/50">
            <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Events
            </div>
            <template v-for="event in activeEvents" :key="event.name">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div
                    class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `event-${event.name}` }"
                    @click="selectedNodeId = `event-${event.name}`; handleEventClick(event)"
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
          </div>
        </template>

        <!-- Loading events -->
        <div v-if="activeConnectionId && loadingEvents.has(activeConnectionId)" class="px-2 py-1">
          <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>

        <!-- Loading routines -->
        <div v-if="activeConnectionId && loadingRoutines.has(activeConnectionId)" class="px-2 py-1">
          <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
        </div>

        <!-- Triggers Section -->
        <template v-if="activeTriggers.length > 0">
          <div class="mt-2 pt-2 border-t border-border/50">
            <div class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Triggers
            </div>
            <template v-for="trigger in activeTriggers" :key="trigger.name">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div
                    class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `trigger-${trigger.name}` }"
                    @click="selectedNodeId = `trigger-${trigger.name}`; handleTriggerClick(trigger)"
                  >
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
          </div>
        </template>

        <!-- Loading triggers -->
        <div v-if="activeConnectionId && loadingTriggers.has(activeConnectionId)" class="px-2 py-1">
          <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
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

    <!-- Database Manager Dialog -->
    <DatabaseManagerDialog
      v-if="activeConnectionId && activeConnectionType && activeConnectionType !== 'sqlite'"
      v-model:open="showDatabaseManager"
      :connection-id="activeConnectionId"
      :connection-type="activeConnectionType"
      :current-database="connections.find(c => c.id === activeConnectionId)?.database || ''"
      @switch="handleSwitchDatabase"
    />
  </div>
</template>
