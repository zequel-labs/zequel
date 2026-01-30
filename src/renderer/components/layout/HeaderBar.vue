<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import {
  IconSql,
  IconRefresh,
  IconSearch,
  IconPlus,
  IconPlugConnectedX,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconActivity,
  IconUsers,
  IconDatabase,
  IconLoader2
} from '@tabler/icons-vue'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import DatabaseManagerDialog from '../schema/DatabaseManagerDialog.vue'

const connectionsStore = useConnectionsStore()
const { openQueryTab, openMonitoringTab, openUsersTab } = useTabs()

const showDatabaseManager = ref(false)
const showConnectionPicker = ref(false)
const connectingId = ref<string | null>(null)
const connectionError = ref<string | null>(null)

const savedConnections = computed(() => {
  const connectedIds = connectionsStore.connectedIds
  return connectionsStore.sortedConnections.filter(c => !connectedIds.includes(c.id))
})

const dbTypeLabels: Record<string, string> = {
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  sqlite: 'SQLite',
  mongodb: 'MongoDB',
  redis: 'Redis',
  clickhouse: 'ClickHouse'
}

async function handlePickConnection(connection: { id: string; name: string }) {
  connectingId.value = connection.id
  connectionError.value = null
  try {
    await connectionsStore.connect(connection.id)
    showConnectionPicker.value = false
    toast.success(`Connected to "${connection.name}"`)
  } catch (e) {
    connectionError.value = e instanceof Error ? e.message : 'Connection failed'
    toast.error(connectionError.value!)
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
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mariadb: 'MariaDB',
    sqlite: 'SQLite',
    mongodb: 'MongoDB',
    redis: 'Redis',
    clickhouse: 'ClickHouse'
  }
  return labels[type] || type
})

function handleNewQuery() {
  openQueryTab('')
}

function handleRefresh() {
  if (!activeConnectionId.value || !activeConnection.value) return
  connectionsStore.loadTables(activeConnectionId.value, activeConnection.value.database)
  window.dispatchEvent(new Event('zequel:refresh-schema'))
}

function handleSearch() {
  window.dispatchEvent(new Event('zequel:toggle-command-palette'))
}

function handleDisconnect() {
  if (!activeConnectionId.value) return
  connectionsStore.disconnect(activeConnectionId.value)
}

async function handleExport() {
  if (!activeConnectionId.value) return
  try {
    const result = await window.api.backup.export(activeConnectionId.value)
    if (result.success) {
      alert(`Database exported successfully to:\n${result.filePath}`)
    } else if (result.error !== 'Export canceled') {
      alert(`Export failed: ${result.error}`)
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Export failed')
  }
}

async function handleImport() {
  if (!activeConnectionId.value) return
  try {
    const result = await window.api.backup.import(activeConnectionId.value)
    if (result.success) {
      alert(`Import successful!\n\nStatements executed: ${result.statements}`)
      if (activeConnection.value) {
        await connectionsStore.loadTables(activeConnectionId.value, activeConnection.value.database)
      }
    } else if (result.errors[0] !== 'Import canceled') {
      const errorMsg = result.errors.length > 0
        ? `Errors:\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? `\n...and ${result.errors.length - 5} more` : ''}`
        : 'Unknown error'
      alert(`Import completed with errors.\n\nStatements executed: ${result.statements}\n\n${errorMsg}`)
      if (activeConnection.value) {
        await connectionsStore.loadTables(activeConnectionId.value, activeConnection.value.database)
      }
    }
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Import failed')
  }
}

function handleRunningQueries() {
  openMonitoringTab()
}

function handleUserManagement() {
  openUsersTab()
}

async function handleSwitchDatabase(database: string) {
  const connectionId = activeConnectionId.value
  if (!connectionId) return
  const connection = activeConnection.value
  if (!connection) return

  try {
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
      await connectionsStore.disconnect(connectionId)
      await connectionsStore.connect(connectionId)
    } else {
      if (connection.type === 'mysql' || connection.type === 'mariadb') {
        await window.api.query.execute(connectionId, `USE \`${database}\``)
      }
      await connectionsStore.loadTables(connectionId, database)
      window.dispatchEvent(new Event('zequel:refresh-schema'))
    }

    toast.success(`Switched to database "${database}"`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to switch database')
  }
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-sm titlebar-drag">
      <!-- Left: Connection info -->
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-medium truncate">{{ activeConnection?.name }}</span>
        <span class="text-muted-foreground">|</span>
        <span class="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          {{ dbTypeLabel }}
        </span>
        <span class="text-muted-foreground">|</span>
        <span class="truncate text-muted-foreground">{{ activeConnection?.database }}</span>
      </div>

      <!-- Right: Action buttons -->
      <div class="flex items-center gap-0.5 titlebar-no-drag">
        <Tooltip v-if="activeConnection?.type && activeConnection.type !== 'sqlite'">
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

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleRefresh">
              <IconRefresh class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleSearch">
              <IconSearch class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search</TooltipContent>
        </Tooltip>

        <!-- Separator -->
        <div class="w-px h-4 bg-border mx-1" />

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="showConnectionPicker = true">
              <IconPlus class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Connection</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleDisconnect">
              <IconPlugConnectedX class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <!-- Database Manager Dialog -->
    <DatabaseManagerDialog
      v-if="activeConnectionId && activeConnection?.type && activeConnection.type !== 'sqlite'"
      v-model:open="showDatabaseManager"
      :connection-id="activeConnectionId"
      :connection-type="activeConnection.type"
      :current-database="activeConnection.database || ''"
      @switch="handleSwitchDatabase"
    />

    <!-- Connection Picker Dialog -->
    <Dialog v-model:open="showConnectionPicker">
      <DialogContent class="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <IconDatabase class="h-5 w-5" />
            Open Connection
          </DialogTitle>
          <DialogDescription>
            Select a saved connection to connect to.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea class="flex-1 min-h-0" style="max-height: 350px;">
          <div v-if="savedConnections.length === 0" class="py-8 text-center text-muted-foreground text-sm">
            No saved connections available.
          </div>
          <div v-else class="flex flex-col gap-1 pr-4">
            <button
              v-for="conn in savedConnections"
              :key="conn.id"
              class="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              :disabled="connectingId === conn.id"
              @click="handlePickConnection(conn)"
            >
              <IconDatabase class="h-4 w-4 flex-shrink-0" :style="conn.color ? { color: conn.color } : {}" />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm truncate">{{ conn.name }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  <template v-if="conn.type === 'sqlite'">{{ conn.filepath || conn.database }}</template>
                  <template v-else>{{ conn.host }}<template v-if="conn.port">:{{ conn.port }}</template></template>
                </div>
              </div>
              <IconLoader2 v-if="connectingId === conn.id" class="h-4 w-4 flex-shrink-0 animate-spin" />
              <Badge v-else variant="secondary" class="flex-shrink-0 text-[10px]">
                {{ dbTypeLabels[conn.type] || conn.type }}
              </Badge>
            </button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
