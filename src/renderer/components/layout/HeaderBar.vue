<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
  IconLayoutSidebarFilled,
  IconLayoutBottombar,
  IconLayoutBottombarFilled,
  IconLayoutSidebarRight,
  IconLayoutSidebarRightFilled,
  IconLockSquareRounded,
  IconLockSquareRoundedFilled,
  IconRefresh,
  IconEye,
  IconEyeOff
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

import DatabaseManagerDialog from '@/components/schema/DatabaseManagerDialog.vue'
import ConfirmDeleteDialog from '@/components/schema/ConfirmDeleteDialog.vue'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { useQueryLogStore } from '@/stores/queryLog'

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
const pendingChangesStore = usePendingChangesStore()
const queryLogStore = useQueryLogStore()
const { openQueryTab, openMonitoringTab, openUsersTab, openERDiagramTab } = useTabs()

const activeSessionId = computed(() => connectionsStore.activeSessionId)
const activeConnection = computed(() => connectionsStore.activeConnection)

const activeState = computed(() => {
  if (!activeSessionId.value) return null
  return connectionsStore.getConnectionState(activeSessionId.value)
})

const handleReconnect = () => {
  if (!activeSessionId.value) return
  connectionsStore.reconnect(activeSessionId.value)
}

const activeDatabase = computed(() => {
  if (!activeSessionId.value) return ''
  return connectionsStore.getActiveDatabase(activeSessionId.value)
})

const environmentLabel = computed(() => {
  const env = activeConnection.value?.environment
  if (!env) return null
  return env.charAt(0).toUpperCase() + env.slice(1)
})

const serverVersion = computed(() => {
  if (!activeSessionId.value) return null
  return connectionsStore.serverVersions.get(activeSessionId.value) || null
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

const savedConnections = computed(() => connectionsStore.sortedConnections)

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

const supportsProcessMonitoring = computed(() => {
  const type = activeConnection.value?.type
  return type === DatabaseType.PostgreSQL || type === DatabaseType.MySQL || type === DatabaseType.MariaDB || type === DatabaseType.ClickHouse || type === DatabaseType.MongoDB || type === DatabaseType.Redis || type === DatabaseType.SQLServer
})

const supportsUserManagement = computed(() => {
  const type = activeConnection.value?.type
  return type === DatabaseType.PostgreSQL || type === DatabaseType.MySQL || type === DatabaseType.MariaDB || type === DatabaseType.ClickHouse || type === DatabaseType.MongoDB || type === DatabaseType.Redis || type === DatabaseType.SQLServer
})

const handleNewQuery = () => {
  if (!activeSessionId.value) return
  openQueryTab('')
}


const handleRefreshData = () => {
  window.dispatchEvent(new Event('zequel:refresh-data'))
}

const handleSearch = () => {
  window.dispatchEvent(new Event('zequel:toggle-command-palette'))
}

const showDiscardWarning = ref(false)
const pendingDisconnectSessionId = ref<string | null>(null)

const switchAwayFrom = (sessionId: string) => {
  if (connectionsStore.activeSessionId === sessionId) {
    const remaining = connectionsStore.connectedIds.filter(cid => cid !== sessionId)
    connectionsStore.setActiveConnection(remaining[0] || null)
  }
}

const handleDisconnect = async () => {
  if (!activeSessionId.value) return
  if (pendingChangesStore.connectionHasPendingChanges(activeSessionId.value)) {
    pendingDisconnectSessionId.value = activeSessionId.value
    showDiscardWarning.value = true
    return
  }
  switchAwayFrom(activeSessionId.value)
  tabsStore.closeTabsForConnection(activeSessionId.value)
  await connectionsStore.disconnect(activeSessionId.value)
}

const handleConfirmDiscard = async () => {
  const sessionId = pendingDisconnectSessionId.value
  if (!sessionId) return
  switchAwayFrom(sessionId)
  pendingChangesStore.clearAllForConnection(sessionId)
  tabsStore.closeTabsForConnection(sessionId)
  await connectionsStore.disconnect(sessionId)
  pendingDisconnectSessionId.value = null
}

onMounted(() => {
  window.addEventListener('zequel:close-active-connection', handleDisconnect)
})

onUnmounted(() => {
  window.removeEventListener('zequel:close-active-connection', handleDisconnect)
})

const handleExport = () => {
  if (!activeSessionId.value) return
  tabsStore.createBackupTab(activeSessionId.value, activeDatabase.value)
}

const handleImport = () => {
  if (!activeSessionId.value) return
  tabsStore.createRestoreTab(activeSessionId.value, activeDatabase.value)
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

const isSwitchingDatabase = ref(false)

const handleSwitchDatabase = async (database: string) => {
  if (isSwitchingDatabase.value) return
  const sessionId = activeSessionId.value
  if (!sessionId) return
  const connection = activeConnection.value
  if (!connection) return

  const previousDatabase = connectionsStore.getActiveDatabase(sessionId)
  isSwitchingDatabase.value = true

  try {
    if (connection.type === DatabaseType.MySQL || connection.type === DatabaseType.MariaDB) {
      // For MySQL/MariaDB, USE switches database on the existing connection
      const escapedDb = database.replace(/`/g, '``')
      await window.api.query.execute(sessionId, `USE \`${escapedDb}\``)
    } else if (connection.type === DatabaseType.SQLServer) {
      // For SQL Server, USE switches database on the existing connection
      const escapedDb = database.replace(/]/g, ']]')
      await window.api.query.execute(sessionId, `USE [${escapedDb}]`)
    } else if (connection.type === DatabaseType.Redis) {
      // For Redis, SELECT switches to the target database number
      const dbNum = parseInt(database.replace(/^db/, ''), 10)
      if (isNaN(dbNum)) throw new Error('Invalid Redis database number')
      await window.api.query.execute(sessionId, `SELECT ${dbNum}`)
    } else {
      // For PostgreSQL, ClickHouse, etc.: disconnect and reconnect with overridden database
      // This returns a NEW sessionId since the old session is destroyed
      const newSessionId = await window.api.connections.connectWithDatabase(sessionId, database)

      // Clear pending changes and query log for old session before migration
      pendingChangesStore.clearAllForConnection(sessionId)
      queryLogStore.clearForConnection(sessionId)
      // Migrate session state (cleans up old session data Maps + connection state,
      // and atomically updates activeSessionId if it matches the old session)
      connectionsStore.migrateSession(sessionId, newSessionId)
      tabsStore.migrateTabsForSession(sessionId, newSessionId)

      connectionsStore.setActiveDatabase(newSessionId, database)

      // PostgreSQL needs schemas reloaded since they differ per database
      if (connection.type === DatabaseType.PostgreSQL) {
        await connectionsStore.loadSchemas(newSessionId)
        const schema = connectionsStore.getActiveSchema(newSessionId)
        await connectionsStore.loadTables(newSessionId, database, schema)
      } else {
        await connectionsStore.loadTables(newSessionId, database)
      }

      window.dispatchEvent(new Event('zequel:refresh-schema'))
      toast.success(`Switched to database "${database}"`)
      return
    }

    // Clear pending changes, query log, and close tabs for the old database (MySQL/MariaDB/SQLServer/Redis path)
    pendingChangesStore.clearAllForConnection(sessionId)
    queryLogStore.clearForConnection(sessionId)
    tabsStore.closeTabsForConnection(sessionId)

    connectionsStore.setActiveDatabase(sessionId, database)
    await connectionsStore.loadTables(sessionId, database)

    window.dispatchEvent(new Event('zequel:refresh-schema'))
    toast.success(`Switched to database "${database}"`)
  } catch (err) {
    // On failure, try to restore the previous database
    if (connection.type === DatabaseType.MySQL || connection.type === DatabaseType.MariaDB) {
      const escapedPrev = previousDatabase.replace(/`/g, '``')
      await window.api.query.execute(sessionId, `USE \`${escapedPrev}\``).catch(() => { })
    } else if (connection.type === DatabaseType.SQLServer) {
      const escapedPrev = previousDatabase.replace(/]/g, ']]')
      await window.api.query.execute(sessionId, `USE [${escapedPrev}]`).catch(() => { })
    } else if (connection.type === DatabaseType.Redis) {
      const prevDbNum = parseInt(previousDatabase.replace(/^db/, ''), 10)
      if (!isNaN(prevDbNum)) await window.api.query.execute(sessionId, `SELECT ${prevDbNum}`).catch(() => { })
    } else {
      // connectWithDatabase connects the new session first, then disconnects the old one.
      // If it throws, the old session is still alive — no recovery needed.
    }
    toast.error(err instanceof Error ? err.message : 'Failed to switch database')
  } finally {
    isSwitchingDatabase.value = false
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
            <Button data-testid="header-connection-picker-btn" variant="ghost" @click="showConnectionPicker = true">
              <IconPlug class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Connection</TooltipContent>
        </Tooltip>

        <Tooltip
          v-if="activeConnection?.type && activeConnection.type !== DatabaseType.SQLite && activeConnection.type !== DatabaseType.DuckDB">
          <TooltipTrigger as-child>
            <Button data-testid="header-dbmanager-btn" variant="ghost" @click="showDatabaseManager = true">
              <IconDatabase class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Database Manager</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button data-testid="header-query-btn" variant="ghost" @click="handleNewQuery">
              <IconSql />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Query</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button data-testid="header-safemode-btn" variant="ghost" @click="connectionsStore.toggleSafeMode()">
              <IconLockSquareRoundedFilled v-if="connectionsStore.safeMode" data-testid="safemode-icon-locked" class="size-4 text-green-500" />
              <IconLockSquareRounded v-else data-testid="safemode-icon-unlocked" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ connectionsStore.safeMode ? 'Safe Mode (Read-Only)' : 'Safe Mode Off' }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button data-testid="header-privacy-btn" variant="ghost" @click="connectionsStore.togglePrivacyMode()">
              <IconEyeOff v-if="connectionsStore.privacyMode" data-testid="privacy-icon-on" class="h-4 w-4" />
              <IconEye v-else data-testid="privacy-icon-off" class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ connectionsStore.privacyMode ? 'Privacy Mode On' : 'Privacy Mode Off' }}</TooltipContent>
        </Tooltip>
      </div>

      <!-- Center: Breadcrumb / Status -->
      <div class="absolute left-1/2 -translate-x-1/2 w-[54%]">
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
        <div v-else data-testid="header-breadcrumb" class="text-xs rounded-md px-2 py-1 truncate"
          :style="{ backgroundColor: (activeConnection?.color || '#6b7280') + '33' }">
          {{ breadcrumbLabel }}
        </div>
      </div>

      <!-- Right: Utility actions -->
      <div class="flex items-center gap-0.5 titlebar-no-drag">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="handleRefreshData">
              <IconRefresh class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh Data</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" @click="handleSearch">
              <IconSearch class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <!-- More menu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button data-testid="header-more-menu-btn" variant="ghost">
              <IconDotsVertical class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem data-testid="header-export-btn" @click="handleExport">
              <IconDownload class="size-4 mr-2" />
              Backup / Export
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="header-import-btn" :disabled="connectionsStore.safeMode" @click="handleImport">
              <IconUpload class="size-4 mr-2" />
              Restore / Import
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="supportsProcessMonitoring" data-testid="header-monitoring-btn"
              @click="handleRunningQueries">
              <IconActivity class="size-4 mr-2" />
              Running Queries
            </DropdownMenuItem>
            <DropdownMenuItem v-if="supportsUserManagement" data-testid="header-users-btn"
              :disabled="connectionsStore.safeMode" @click="handleUserManagement">
              <IconUsers class="size-4 mr-2" />
              User Management
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="header-erdiagram-btn" @click="handleERDiagram">
              <IconSchema class="size-4 mr-2" />
              ER Diagram
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Disconnect -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button data-testid="header-disconnect-btn" variant="ghost" @click="handleDisconnect">
              <IconPlugOff class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>

        <!-- Layout toggles -->
        <div class="flex items-center gap-0.5 ml-1 pl-1.5 border-l border-border">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleSidebar()">
                <IconLayoutSidebarFilled v-if="layoutStore.sidebarVisible" class="size-4" />
                <IconLayoutSidebar v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Sidebar</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleBottomPanel()">
                <IconLayoutBottombarFilled v-if="layoutStore.bottomPanelVisible" class="size-4" />
                <IconLayoutBottombar v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Bottom Panel</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" @click="layoutStore.toggleRightPanel()">
                <IconLayoutSidebarRightFilled v-if="layoutStore.rightPanelVisible" class="size-4" />
                <IconLayoutSidebarRight v-else class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Right Panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- Database Manager Dialog -->
    <DatabaseManagerDialog
      v-if="activeSessionId && activeConnection?.type && activeConnection.type !== DatabaseType.SQLite && activeConnection.type !== DatabaseType.DuckDB"
      v-model:open="showDatabaseManager" :connection-id="activeSessionId" :connection-type="activeConnection.type"
      :current-database="activeDatabase" @switch="handleSwitchDatabase" />

    <!-- Connection Picker Dialog -->
    <Dialog :open="showConnectionPicker"
      @update:open="(v: boolean) => { showConnectionPicker = v; if (!v) resetPickerState() }">
      <DialogContent data-testid="connection-picker-dialog" class="max-w-lg flex flex-col max-h-[50vh]">
        <DialogHeader>
          <DialogTitle data-testid="connection-picker-title">Open Connection</DialogTitle>
          <DialogDescription class="sr-only">
            Select a saved connection to connect to.
          </DialogDescription>
        </DialogHeader>

        <!-- Search -->
        <div class="relative flex-shrink-0">
          <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="connection-picker-search" v-model="pickerSearch" placeholder="Search connections..." class="pl-9" />
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
              :data-testid="`connection-picker-item-${conn.id}`"
              class="flex items-center gap-2 w-full rounded-md py-1.5 px-2 text-left transition-colors hover:bg-accent/50"
              :class="{ 'opacity-75': connectingId === conn.id }" :disabled="connectingId === conn.id"
              @click="handlePickConnection(conn)">
              <div class="w-1 self-stretch rounded-full shrink-0"
                :style="{ backgroundColor: conn.color || '#6b7280' }" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ conn.name }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  <template v-if="conn.type === DatabaseType.SQLite || conn.type === DatabaseType.DuckDB">{{
                    conn.filepath || conn.database }}</template>
                  <template v-else-if="conn.type === DatabaseType.MongoDB && conn.database?.startsWith('mongodb')">{{
                    conn.database }}</template>
                  <template v-else>{{ conn.host }}<template v-if="conn.port">:{{ conn.port }}</template></template>
                </div>
                <div v-if="connectionError.get(conn.id)" class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                  <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                  <span class="line-clamp-2">{{ connectionError.get(conn.id) }}</span>
                </div>
              </div>
              <span v-if="connectionsStore.getSessionsForSavedConnection(conn.id).length > 0 && connectingId !== conn.id"
                class="text-[10px] text-muted-foreground/60 shrink-0">Connected</span>
              <IconLoader2 v-if="connectingId === conn.id" class="h-4 w-4 flex-shrink-0 animate-spin" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <!-- Discard Changes Warning Dialog -->
    <ConfirmDeleteDialog :open="showDiscardWarning" @update:open="showDiscardWarning = $event" title="Warning" :message="`Discard all changes?\nTips: You can commit changes by pressing ${isMac ? '⌘S' : 'Ctrl+S'}.`" confirm-text="Discard" danger-level="warning"
      @confirm="handleConfirmDiscard" />
  </TooltipProvider>
</template>