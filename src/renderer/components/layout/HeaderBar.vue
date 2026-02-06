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
  IconPlus,
  IconPlugOff,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconActivity,
  IconUsers,
  IconDatabase,
  IconLoader2,
  IconAlertCircle,
  IconFolder,
  IconChevronRight,
  IconPlug,
  IconSchema,
  IconLayoutSidebar,
  IconLayoutBottombar,
  IconLayoutSidebarRight
} from '@tabler/icons-vue'
import { getDbLogo } from '@/lib/db-logos'
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
  DialogScrollContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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

const activeTabTitle = computed(() => tabsStore.activeTab?.title || null)

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

const breadcrumbLabel = computed(() => {
  const parts: string[] = []
  if (dbTypeLabel.value) parts.push(dbTypeLabel.value)
  if (activeConnection.value?.name) parts.push(activeConnection.value.name)
  if (activeDatabase.value) parts.push(activeDatabase.value)
  const tab = tabsStore.activeTab
  if (tab) {
    const data = tab.data as Record<string, unknown>
    const schema = data.schema && typeof data.schema === 'string' ? data.schema : null
    const name = tab.title
    parts.push(schema ? `${schema}.${name}` : name)
  }
  return parts.join(' : ')
})

const showDatabaseManager = ref(false)
const showConnectionPicker = ref(false)
const connectingId = ref<string | null>(null)
const connectionError = ref<Map<string, string>>(new Map())

const pickerSearch = ref('')
const pickerCollapsedFolders = ref<Set<string>>(new Set())

const savedConnections = computed(() => {
  const connectedIds = connectionsStore.connectedIds
  return connectionsStore.sortedConnections.filter(c => !connectedIds.includes(c.id))
})

const pickerGrouped = computed(() => {
  const grouped: Record<string, typeof savedConnections.value> = {}
  const ungrouped: typeof savedConnections.value = []

  for (const conn of savedConnections.value) {
    if (conn.folder) {
      if (!grouped[conn.folder]) grouped[conn.folder] = []
      grouped[conn.folder].push(conn)
    } else {
      ungrouped.push(conn)
    }
  }

  return { grouped, ungrouped }
})

const pickerFolderNames = computed(() =>
  Object.keys(pickerGrouped.value.grouped).sort((a, b) => a.localeCompare(b))
)

const pickerMatchesSearch = (conn: { name: string }) => {
  if (!pickerSearch.value.trim()) return true
  return conn.name.toLowerCase().includes(pickerSearch.value.toLowerCase().trim())
}

const pickerFolderHasMatches = (folder: string) => {
  if (!pickerSearch.value.trim()) return true
  return (pickerGrouped.value.grouped[folder] || []).some(c => pickerMatchesSearch(c))
}

const pickerHasResults = computed(() => {
  if (!pickerSearch.value.trim()) return savedConnections.value.length > 0
  return savedConnections.value.some(c => pickerMatchesSearch(c))
})

const togglePickerFolder = (folder: string) => {
  if (pickerCollapsedFolders.value.has(folder)) {
    pickerCollapsedFolders.value.delete(folder)
  } else {
    pickerCollapsedFolders.value.add(folder)
  }
}

const resetPickerState = () => {
  pickerSearch.value = ''
  pickerCollapsedFolders.value.clear()
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

const dbTypeLabel = computed(() => {
  const type = activeConnection.value?.type
  if (!type) return ''
  const labels: Record<string, string> = {
    [DatabaseType.PostgreSQL]: 'PostgreSQL',
    [DatabaseType.MySQL]: 'MySQL',
    [DatabaseType.MariaDB]: 'MariaDB',
    [DatabaseType.SQLite]: 'SQLite',
    [DatabaseType.MongoDB]: 'MongoDB',
    [DatabaseType.Redis]: 'Redis',
    [DatabaseType.ClickHouse]: 'ClickHouse'
  }
  return labels[type] || type
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
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showConnectionPicker = true">
              <IconPlug class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Connection</TooltipContent>
        </Tooltip>

        <Tooltip v-if="activeConnection?.type && activeConnection.type !== DatabaseType.SQLite">
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showDatabaseManager = true">
              <IconDatabase class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Database Manager</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleNewQuery">
              <IconSql class="h-4 w-4" />
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
          <Button variant="ghost" size="sm" class="h-5 px-1.5 text-xs" @click="handleReconnect">
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
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleSearch">
              <IconSearch class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <!-- More menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7">
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
            <DropdownMenuItem @click="handleRunningQueries">
              <IconActivity class="h-4 w-4 mr-2" />
              Running Queries
            </DropdownMenuItem>
            <DropdownMenuItem @click="handleUserManagement">
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
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleDisconnect">
              <IconPlugOff class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>

        <!-- Layout toggles -->
        <div class="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="layoutStore.toggleSidebar()">
                <IconLayoutSidebar class="h-4 w-4" :class="layoutStore.sidebarVisible ? 'text-primary' : 'text-muted-foreground'" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="layoutStore.toggleBottomPanel()">
                <IconLayoutBottombar class="h-4 w-4"
                  :class="layoutStore.bottomPanelVisible ? 'text-primary' : 'text-muted-foreground'" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Bottom Panel</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="layoutStore.toggleRightPanel()">
                <IconLayoutSidebarRight class="h-4 w-4"
                  :class="layoutStore.rightPanelVisible ? 'text-primary' : 'text-muted-foreground'" />
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
      <DialogScrollContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Connection</DialogTitle>
          <DialogDescription>
            Select a saved connection to connect to.
          </DialogDescription>
        </DialogHeader>

        <!-- Search -->
        <div class="relative">
          <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="pickerSearch" placeholder="Search connections..." class="pl-8" />
        </div>

        <div v-if="savedConnections.length === 0" class="py-8 text-center text-muted-foreground text-sm">
          No saved connections available.
        </div>

        <div v-else-if="!pickerHasResults" class="py-8 text-center text-muted-foreground text-sm">
          No connections match "{{ pickerSearch }}"
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <!-- Folders -->
          <template v-for="folder in pickerFolderNames" :key="folder">
            <div v-show="pickerFolderHasMatches(folder)">
              <!-- Folder Header -->
              <button
                class="flex items-center gap-1.5 w-full py-1.5 px-1 rounded hover:bg-accent/50 transition-colors text-left"
                @click="togglePickerFolder(folder)">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform"
                  :class="{ 'rotate-90': !pickerCollapsedFolders.has(folder) }" />
                <IconFolder class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="text-sm font-medium truncate">{{ folder }}</span>
                <Badge variant="secondary" class="text-[10px] ml-1 shrink-0">
                  {{ (pickerGrouped.grouped[folder] || []).length }}
                </Badge>
              </button>

              <!-- Folder Connections -->
              <div v-if="!pickerCollapsedFolders.has(folder)" class="ml-5 border-l pl-2">
                <template v-for="conn in pickerGrouped.grouped[folder]" :key="conn.id">
                  <button v-show="pickerMatchesSearch(conn)"
                    class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    :class="{ 'opacity-75': connectingId === conn.id }" :disabled="connectingId === conn.id"
                    @click="handlePickConnection(conn)">
                    <img v-if="getDbLogo(conn.type)" :src="getDbLogo(conn.type)" :alt="conn.type"
                      class="h-5 w-5 flex-shrink-0" />
                    <IconDatabase v-else class="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm truncate">{{ conn.name }}</div>
                      <div class="text-xs text-muted-foreground truncate">
                        <template v-if="conn.type === DatabaseType.SQLite">{{ conn.filepath || conn.database
                          }}</template>
                        <template
                          v-else-if="conn.type === DatabaseType.MongoDB && conn.database?.startsWith('mongodb')">{{
                            conn.database }}</template>
                        <template v-else>{{ conn.host }}<template v-if="conn.port">:{{ conn.port
                        }}</template></template>
                      </div>
                      <div v-if="connectionError.get(conn.id)"
                        class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                        <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                        <span class="line-clamp-2">{{ connectionError.get(conn.id) }}</span>
                      </div>
                    </div>
                    <IconLoader2 v-if="connectingId === conn.id" class="h-4 w-4 flex-shrink-0 animate-spin" />
                  </button>
                </template>
              </div>
            </div>
          </template>

          <!-- Ungrouped connections -->
          <template v-if="pickerGrouped.ungrouped.length > 0">
            <div v-if="pickerFolderNames.length > 0" class="flex items-center gap-1.5 py-1.5 px-1">
              <IconDatabase class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-sm font-medium text-muted-foreground">No Folder</span>
              <Badge variant="secondary" class="text-[10px] ml-1 shrink-0">
                {{ pickerGrouped.ungrouped.length }}
              </Badge>
            </div>

            <div :class="{ 'ml-5 border-l pl-2': pickerFolderNames.length > 0 }">
              <template v-for="conn in pickerGrouped.ungrouped" :key="conn.id">
                <button v-show="pickerMatchesSearch(conn)"
                  class="flex items-center gap-3 w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  :class="{ 'opacity-75': connectingId === conn.id }" :disabled="connectingId === conn.id"
                  @click="handlePickConnection(conn)">
                  <img v-if="getDbLogo(conn.type)" :src="getDbLogo(conn.type)" :alt="conn.type"
                    class="h-5 w-5 flex-shrink-0" />
                  <IconDatabase v-else class="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{{ conn.name }}</div>
                    <div class="text-xs text-muted-foreground truncate">
                      <template v-if="conn.type === DatabaseType.SQLite">{{ conn.filepath || conn.database }}</template>
                      <template
                        v-else-if="conn.type === DatabaseType.MongoDB && conn.database?.startsWith('mongodb')">{{
                          conn.database }}</template>
                      <template v-else>{{ conn.host }}<template v-if="conn.port">:{{ conn.port }}</template></template>
                    </div>
                    <div v-if="connectionError.get(conn.id)"
                      class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                      <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                      <span class="line-clamp-2">{{ connectionError.get(conn.id) }}</span>
                    </div>
                  </div>
                  <IconLoader2 v-if="connectingId === conn.id" class="h-4 w-4 flex-shrink-0 animate-spin" />
                </button>
              </template>
            </div>
          </template>
        </div>
      </DialogScrollContent>
    </Dialog>
  </TooltipProvider>
</template>