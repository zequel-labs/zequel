<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { useLayoutStore } from '@/stores/layout'
import { useTabs } from '@/composables/useTabs'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import {
  IconSql,
  IconSearch,
  IconPlugOff,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconActivity,
  IconUsers,
  IconDatabase,
  IconLoader2,
  IconAlertCircle,
  IconPlug,
  IconSchema,
  IconLayoutSidebar,
  IconLayoutBottombar,
  IconLayoutSidebarRight
} from '@tabler/icons-vue'
import { usePlatform } from '@/composables/usePlatform'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import DatabaseManagerDialog from '../schema/DatabaseManagerDialog.vue'

interface Props {
  insetLeft?: boolean
}

withDefaults(defineProps<Props>(), {
  insetLeft: false,
})

const { isMac } = usePlatform()
const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const layoutStore = useLayoutStore()
const { openQueryTab, openMonitoringTab, openUsersTab, openERDiagramTab } = useTabs()

const activeState = computed(() => {
  if (!activeConnectionId.value) return null
  return connectionsStore.getConnectionState(activeConnectionId.value)
})

const handleReconnect = () => {
  if (!activeConnectionId.value) return
  connectionsStore.reconnect(activeConnectionId.value)
}

const activeDatabase = computed(() => {
  if (!activeConnectionId.value) return ''
  return connectionsStore.getActiveDatabase(activeConnectionId.value)
})

const environmentLabel = computed(() => {
  const env = activeConnection.value?.environment
  if (!env) return null
  return env.charAt(0).toUpperCase() + env.slice(1)
})

const serverVersion = computed(() => {
  if (!activeConnectionId.value) return null
  return connectionsStore.serverVersions.get(activeConnectionId.value) || null
})

const breadcrumbLabel = computed(() => {
  const prefix = environmentLabel.value || ''
  const parts: string[] = []
  if (serverVersion.value) parts.push(serverVersion.value)
  if (activeConnection.value?.name) parts.push(activeConnection.value.name)
  if (activeDatabase.value) parts.push(activeDatabase.value)
  const tab = tabsStore.activeTab
  if (tab) {
    const data = tab.data as Record<string, unknown>
    const schema = data.schema && typeof data.schema === 'string' ? data.schema : null
    const name = tab.title
    parts.push(schema ? `${schema}.${name}` : name)
  }
  const trail = parts.join(' : ')
  if (prefix && trail) return `${prefix} | ${trail}`
  if (prefix) return prefix
  return trail
})

const showDatabaseManager = ref(false)
const showConnectionPicker = ref(false)
const connectingId = ref<string | null>(null)
const connectionError = ref<Map<string, string>>(new Map())

const pickerSearch = ref('')

const savedConnections = computed(() => {
  const connectedIds = connectionsStore.connectedIds
  return connectionsStore.sortedConnections.filter(c => !connectedIds.includes(c.id))
})

const filteredConnections = computed(() => {
  const query = pickerSearch.value.toLowerCase().trim()
  if (!query) return savedConnections.value
  return savedConnections.value.filter(c => c.name.toLowerCase().includes(query))
})

const resetPickerState = () => {
  pickerSearch.value = ''
}


const handlePickConnection = async (connection: { id: string; name: string }) => {
  connectingId.value = connection.id
  connectionError.value.delete(connection.id)
  try {
    await connectionsStore.connect(connection.id)
    showConnectionPicker.value = false
    toast.success(`Connected to "${connection.name}"`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed'
    connectionError.value.set(connection.id, msg)
    toast.error(msg)
  } finally {
    connectingId.value = null
  }
}

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const activeConnection = computed(() => {
  if (!activeConnectionId.value) return null
  return connectionsStore.connections.find(c => c.id === activeConnectionId.value) || null
})

const supportsProcessMonitoring = computed(() => {
  const type = activeConnection.value?.type
  return type === DatabaseType.PostgreSQL || type === DatabaseType.MySQL || type === DatabaseType.MariaDB || type === DatabaseType.ClickHouse || type === DatabaseType.MongoDB || type === DatabaseType.Redis
})

const supportsUserManagement = computed(() => {
  const type = activeConnection.value?.type
  return type === DatabaseType.PostgreSQL || type === DatabaseType.MySQL || type === DatabaseType.MariaDB || type === DatabaseType.ClickHouse || type === DatabaseType.MongoDB || type === DatabaseType.Redis
})

const handleNewQuery = () => {
  openQueryTab('')
}


const handleSearch = () => {
  window.dispatchEvent(new Event('zequel:toggle-command-palette'))
}

const handleDisconnect = () => {
  if (!activeConnectionId.value) return
  connectionsStore.disconnect(activeConnectionId.value)
  tabsStore.closeTabsForConnection(activeConnectionId.value)
}

const handleExport = async () => {
  if (!activeConnectionId.value) return
  try {
    const result = await window.api.backup.export(activeConnectionId.value)
    if (result.success) {
      toast.success(`Database exported successfully to: ${result.filePath}`)
    } else if (result.error !== 'Export canceled') {
      toast.error(`Export failed: ${result.error}`)
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed')
  }
}

const handleImport = async () => {
  if (!activeConnectionId.value) return
  try {
    const result = await window.api.backup.import(activeConnectionId.value)
    if (result.success) {
      toast.success(`Import successful! Statements executed: ${result.statements}`)
      if (activeConnection.value) {
        await connectionsStore.loadTables(activeConnectionId.value, activeDatabase.value)
      }
    } else if (result.errors[0] !== 'Import canceled') {
      const errorMsg = result.errors.length > 0
        ? result.errors.slice(0, 3).join('; ')
        : 'Unknown error'
      toast.error(`Import completed with errors (${result.statements} statements). ${errorMsg}`)
      if (activeConnection.value) {
        await connectionsStore.loadTables(activeConnectionId.value, activeDatabase.value)
      }
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Import failed')
  }
}

const handleRunningQueries = () => {
  openMonitoringTab()
}

const handleUserManagement = () => {
  openUsersTab()
}

const handleERDiagram = () => {
  if (!activeConnection.value) return
  openERDiagramTab(activeDatabase.value)
}

const handleSwitchDatabase = async (database: string) => {
  const connectionId = activeConnectionId.value
  if (!connectionId) return
  const connection = activeConnection.value
  if (!connection) return

  const previousDatabase = connectionsStore.getActiveDatabase(connectionId)

  try {
    if (connection.type === DatabaseType.MySQL || connection.type === DatabaseType.MariaDB) {
      // For MySQL/MariaDB, USE switches database on the existing connection
      await window.api.query.execute(connectionId, `USE \`${database}\``)
    } else {
      // For PostgreSQL, ClickHouse, etc.: disconnect and reconnect with overridden database
      await window.api.connections.connectWithDatabase(connectionId, database)
    }

    // Close tabs for the old database
    tabsStore.closeTabsForConnection(connectionId)

    connectionsStore.setActiveDatabase(connectionId, database)
    await connectionsStore.loadTables(connectionId, database)

    window.dispatchEvent(new Event('zequel:refresh-schema'))
    toast.success(`Switched to database "${database}"`)
  } catch (err) {
    // On failure, try to restore the previous database
    if (connection.type === DatabaseType.MySQL || connection.type === DatabaseType.MariaDB) {
      await window.api.query.execute(connectionId, `USE \`${previousDatabase}\``).catch(() => { })
    } else {
      // connectWithDatabase disconnects first — if the new connect failed, attempt to
      // reconnect with the previous database. If that also fails, mark the connection as errored.
      try {
        await window.api.connections.connectWithDatabase(connectionId, previousDatabase)
      } catch {
        connectionsStore.connectionStates.set(connectionId, {
          id: connectionId,
          status: ConnectionStatus.Error,
          error: 'Database switch failed and could not restore previous connection'
        })
      }
    }
    toast.error(err instanceof Error ? err.message : 'Failed to switch database')
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="relative flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-sm titlebar-drag"
      :class="{ 'pl-20': insetLeft && isMac }">
      <!-- Left: Primary actions -->
      <div class="flex items-center gap-0.5 titlebar-no-drag">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="showConnectionPicker = true">
              <IconPlug class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Connection</TooltipContent>
        </Tooltip>

        <Tooltip v-if="activeConnection?.type && activeConnection.type !== DatabaseType.SQLite">
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="showDatabaseManager = true">
              <IconDatabase class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Database Manager</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="handleNewQuery">
              <IconSql />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Query</TooltipContent>
        </Tooltip>

      </div>

      <!-- Center: Breadcrumb / Status -->
      <div class="absolute left-1/2 -translate-x-1/2 w-[60%]">
        <!-- Reconnecting banner -->
        <div v-if="activeState?.status === ConnectionStatus.Reconnecting"
          class="flex items-center justify-center gap-2 text-xs bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 rounded-md px-2 py-1">
          <IconLoader2 class="h-3.5 w-3.5 animate-spin" />
          <span>Reconnecting...{{ activeState.reconnectAttempt ? ` (attempt ${activeState.reconnectAttempt})` : ''
          }}</span>
        </div>
        <!-- Error banner with retry -->
        <div v-else-if="activeState?.status === ConnectionStatus.Error && activeState.error"
          class="flex items-center justify-center gap-2 text-xs bg-destructive/15 text-destructive rounded-md px-2 py-1 titlebar-no-drag">
          <IconAlertCircle class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ activeState.error }}</span>
          <Button variant="ghost" size="sm" @click="handleReconnect">
            Retry
          </Button>
        </div>
        <!-- Normal breadcrumb -->
        <div v-else class="text-xs rounded-md px-2 py-1 truncate"
          :style="{ backgroundColor: (activeConnection?.color || '#6b7280') + '33' }">
          {{ breadcrumbLabel }}
        </div>
      </div>

      <!-- Right: Utility actions -->
      <div class="flex items-center gap-0.5 titlebar-no-drag">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="handleSearch">
              <IconSearch class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <!-- More menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost">
              <IconDotsVertical class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="handleExport">
              <IconDownload class="h-4 w-4 mr-2" />
              Backup / Export
            </DropdownMenuItem>
            <DropdownMenuItem @click="handleImport">
              <IconUpload class="h-4 w-4 mr-2" />
              Restore / Import
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="supportsProcessMonitoring" @click="handleRunningQueries">
              <IconActivity class="h-4 w-4 mr-2" />
              Running Queries
            </DropdownMenuItem>
            <DropdownMenuItem v-if="supportsUserManagement" @click="handleUserManagement">
              <IconUsers class="h-4 w-4 mr-2" />
              User Management
            </DropdownMenuItem>
            <DropdownMenuItem @click="handleERDiagram">
              <IconSchema class="h-4 w-4 mr-2" />
              ER Diagram
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Disconnect -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="handleDisconnect">
              <IconPlugOff class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>

        <!-- Layout toggles -->
        <div class="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleSidebar()">
                <IconLayoutSidebar class="h-4 w-4"
                  :class="layoutStore.sidebarVisible ? 'text-foreground' : 'text-muted-foreground/30'" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleBottomPanel()">
                <IconLayoutBottombar class="h-4 w-4"
                  :class="layoutStore.bottomPanelVisible ? 'text-foreground' : 'text-muted-foreground/30'" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Bottom Panel</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleRightPanel()">
                <IconLayoutSidebarRight class="h-4 w-4"
                  :class="layoutStore.rightPanelVisible ? 'text-foreground' : 'text-muted-foreground/30'" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Right Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- Database Manager Dialog -->
    <DatabaseManagerDialog
      v-if="activeConnectionId && activeConnection?.type && activeConnection.type !== DatabaseType.SQLite"
      v-model:open="showDatabaseManager" :connection-id="activeConnectionId" :connection-type="activeConnection.type"
      :current-database="activeDatabase" @switch="handleSwitchDatabase" />

    <!-- Connection Picker Dialog -->
    <Dialog :open="showConnectionPicker"
      @update:open="(v: boolean) => { showConnectionPicker = v; if (!v) resetPickerState() }">
      <DialogContent class="max-w-lg flex flex-col max-h-[50vh]">
        <DialogHeader>
          <DialogTitle>Open Connection</DialogTitle>
          <DialogDescription class="sr-only">
            Select a saved connection to connect to.
          </DialogDescription>
        </DialogHeader>

        <!-- Search -->
        <div class="relative flex-shrink-0">
          <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="pickerSearch" placeholder="Search connections..." class="pl-9" />
        </div>

        <!-- Connection list (scrollable) -->
        <div class="flex-1 min-h-0 overflow-y-auto -mx-5 px-5 -mb-5 pb-5">
          <div v-if="savedConnections.length === 0" class="py-8 text-center text-muted-foreground text-sm">
            No saved connections available.
          </div>

          <div v-else-if="filteredConnections.length === 0" class="py-8 text-center text-muted-foreground text-sm">
            No connections match "{{ pickerSearch }}"
          </div>

          <div v-else class="space-y-0.5">
            <button v-for="conn in filteredConnections" :key="conn.id"
              class="flex items-center gap-2 w-full rounded-md py-1.5 px-2 text-left transition-colors hover:bg-accent/50"
              :class="{ 'opacity-75': connectingId === conn.id }" :disabled="connectingId === conn.id"
              @click="handlePickConnection(conn)">
              <div class="w-1 self-stretch rounded-full shrink-0"
                :style="{ backgroundColor: conn.color || '#6b7280' }" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ conn.name }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  <template v-if="conn.type === DatabaseType.SQLite">{{ conn.filepath || conn.database }}</template>
                  <template v-else-if="conn.type === DatabaseType.MongoDB && conn.database?.startsWith('mongodb')">{{
                    conn.database }}</template>
                  <template v-else>{{ conn.host }}<template v-if="conn.port">:{{ conn.port }}</template></template>
                </div>
                <div v-if="connectionError.get(conn.id)" class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                  <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                  <span class="line-clamp-2">{{ connectionError.get(conn.id) }}</span>
                </div>
              </div>
              <IconLoader2 v-if="connectingId === conn.id" class="h-4 w-4 flex-shrink-0 animate-spin" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>