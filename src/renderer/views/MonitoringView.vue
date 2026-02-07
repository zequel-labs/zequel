<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTabsStore, type MonitoringTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { DatabaseType } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useColumnResize } from '@/composables/useColumnResize'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import {
  IconRefresh,
  IconTrash,
  IconX,
  IconLoader2,
  IconAlertTriangle
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import type { DatabaseProcess, ServerStatus } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const processes = ref<DatabaseProcess[]>([])
const serverStatus = ref<ServerStatus | null>(null)
const autoRefresh = ref(false)
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const killingProcess = ref<number | string | null>(null)

const { columnWidths, resizingColumn, onResizeStart } = useColumnResize({
  id: 60,
  user: 100,
  database: 100,
  command: 90,
  time: 70,
  state: 120,
  query: 300,
  actions: 40
})

// Confirm kill dialog
const showKillDialog = ref(false)
const processToKill = ref<DatabaseProcess | null>(null)
const forceKill = ref(false)

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as MonitoringTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const connection = computed(() => {
  return connectionsStore.connections.find((c) => c.id === connectionId.value)
})

const isPostgreSQL = computed(() => connection.value?.type === DatabaseType.PostgreSQL)
const isMySQL = computed(() => connection.value?.type === DatabaseType.MySQL)
const isSQLite = computed(() => connection.value?.type === DatabaseType.SQLite)

const loadData = async () => {
  if (!connectionId.value) return

  loading.value = true
  error.value = null

  try {
    const [processesResult, statusResult] = await Promise.all([
      window.api.monitoring.getProcessList(connectionId.value),
      window.api.monitoring.getServerStatus(connectionId.value)
    ])

    processes.value = processesResult
    serverStatus.value = statusResult
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load monitoring data'
    console.error('Error loading monitoring data:', err)
  } finally {
    loading.value = false
  }
}

const startAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  refreshInterval.value = setInterval(loadData, 3000) // Refresh every 3 seconds
}

const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

const toggleAutoRefresh = () => {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const confirmKill = (process: DatabaseProcess) => {
  processToKill.value = process
  forceKill.value = false
  showKillDialog.value = true
}

const killProcess = async () => {
  if (!processToKill.value || !connectionId.value) return

  killingProcess.value = processToKill.value.id
  showKillDialog.value = false

  try {
    const result = await window.api.monitoring.killProcess(
      connectionId.value,
      processToKill.value.id,
      forceKill.value
    )

    if (!result.success) {
      toast.error(result.error || 'Failed to kill process')
    } else {
      toast.success(`Process ${processToKill.value.id} killed`)
      // Remove the killed process from the list immediately
      processes.value = processes.value.filter(p => p.id !== processToKill.value!.id)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to kill process')
  } finally {
    killingProcess.value = null
    processToKill.value = null
  }
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

const truncateQuery = (query: string | null, maxLength = 100): string => {
  if (!query) return '-'
  if (query.length <= maxLength) return query
  return query.substring(0, maxLength) + '...'
}

const setupStatusBar = () => {
  statusBarStore.showMonitoringControls = true
  statusBarStore.monitoringProcessCount = processes.value.length
  statusBarStore.monitoringAutoRefresh = autoRefresh.value
  statusBarStore.registerMonitoringCallbacks({
    onRefresh: loadData,
    onToggleAutoRefresh: toggleAutoRefresh,
  })
}

onMounted(() => {
  setupStatusBar()
  loadData()
})

onUnmounted(() => {
  stopAutoRefresh()
})

// Re-sync statusBar when this tab becomes active
watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch(connectionId, () => {
  loadData()
})

// Keep statusBar in sync
watch(processes, (p) => {
  statusBarStore.monitoringProcessCount = p.length
})

watch(autoRefresh, (val) => {
  statusBarStore.monitoringAutoRefresh = val
})

watch(serverStatus, (s) => {
  if (!s) {
    statusBarStore.monitoringActiveConnections = null
    statusBarStore.monitoringMaxConnections = null
    return
  }
  if (isMySQL.value) {
    statusBarStore.monitoringActiveConnections = s.status.Threads_connected || null
    statusBarStore.monitoringMaxConnections = s.variables.max_connections || null
  } else if (isPostgreSQL.value) {
    statusBarStore.monitoringActiveConnections = s.status.connections || null
    statusBarStore.monitoringMaxConnections = s.status.max_connections || null
  } else {
    statusBarStore.monitoringActiveConnections = null
    statusBarStore.monitoringMaxConnections = null
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- SQLite Message -->
    <div v-if="isSQLite" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <p class="text-sm">Process monitoring is not available for SQLite databases</p>
      <p class="text-xs">SQLite uses a single connection and doesn't support process lists</p>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading && processes.length === 0" class="flex items-center justify-center h-full">
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error && processes.length === 0" class="flex flex-col items-center justify-center h-full gap-4">
      <IconAlertTriangle class="h-8 w-8 text-destructive" />
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="loadData">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- Error Banner -->
      <div v-if="error" class="flex items-center gap-2 px-3 py-1.5 border-b border-destructive/20 bg-destructive/10">
        <IconAlertTriangle class="h-3.5 w-3.5 text-destructive shrink-0" />
        <span class="text-xs text-destructive truncate">{{ error }}</span>
        <Button variant="ghost" size="icon" class="ml-auto h-6 w-6 shrink-0" @click="error = null">
          <IconX class="h-3.5 w-3.5" />
        </Button>
      </div>

      <!-- Process Table -->
      <ScrollArea class="flex-1">
        <div v-if="processes.length === 0" class="flex items-center justify-center h-full py-12 text-muted-foreground text-xs">
          No active processes found
        </div>
        <table v-else class="w-full border-collapse text-xs" :class="{ 'select-none': resizingColumn }" style="table-layout: fixed;">
          <colgroup>
            <col :style="{ width: `${columnWidths.id}px` }" />
            <col :style="{ width: `${columnWidths.user}px` }" />
            <col :style="{ width: `${columnWidths.database}px` }" />
            <col :style="{ width: `${columnWidths.command}px` }" />
            <col :style="{ width: `${columnWidths.time}px` }" />
            <col :style="{ width: `${columnWidths.state}px` }" />
            <col :style="{ width: `${columnWidths.query}px` }" />
            <col :style="{ width: `${columnWidths.actions}px` }" />
          </colgroup>
          <thead class="sticky top-0 z-10 bg-background">
            <tr>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                ID
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'id' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('id', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                User
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'user' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('user', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Database
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'database' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('database', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Command
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'command' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('command', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Time
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'time' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('time', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                State
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'state' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('state', $event)" />
              </th>
              <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
                Query
                <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                  :class="resizingColumn === 'query' ? 'bg-primary' : 'bg-transparent'"
                  @mousedown.stop.prevent="onResizeStart('query', $event)" />
              </th>
              <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap">
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="process in processes"
              :key="process.id"
              class="h-8 hover:bg-muted/30"
            >
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center font-mono truncate">{{ process.id }}</div></td>
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate">{{ process.user || '-' }}</div></td>
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate">{{ process.database || '-' }}</div></td>
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate">{{ process.command }}</div></td>
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-1.5 flex items-center truncate" :class="{ 'text-amber-500': process.time > 60, 'text-destructive': process.time > 300 }">
                  {{ formatTime(process.time || 0) }}
                </div>
              </td>
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center text-muted-foreground truncate" :title="process.state || undefined">{{ process.state || '-' }}</div></td>
              <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center font-mono truncate" :title="process.info || undefined">{{ truncateQuery(process.info) }}</div></td>
              <td class="p-0 border-b border-border">
                <div class="h-8 flex items-center justify-center">
                  <button
                    class="p-1 rounded-md hover:bg-red-500/10"
                    :disabled="killingProcess === process.id"
                    @click="confirmKill(process)"
                  >
                    <IconLoader2 v-if="killingProcess === process.id" class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <IconTrash v-else class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

      </ScrollArea>
    </template>

    <!-- Kill Process Confirmation Dialog -->
    <Dialog v-model:open="showKillDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kill Process</DialogTitle>
          <DialogDescription>
            Are you sure you want to kill this process?
          </DialogDescription>
        </DialogHeader>

        <div v-if="processToKill" class="flex flex-col gap-4">
          <div class="bg-muted rounded-lg p-4 space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Process ID:</span>
              <span class="font-mono">{{ processToKill.id }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">User:</span>
              <span>{{ processToKill.user || '-' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Database:</span>
              <span>{{ processToKill.database || '-' }}</span>
            </div>
            <div v-if="processToKill.info" class="pt-2 border-t">
              <span class="text-muted-foreground block mb-1">Query:</span>
              <code class="text-xs bg-background p-2 rounded block overflow-auto max-h-32">
                {{ processToKill.info }}
              </code>
            </div>
          </div>

          <div v-if="isPostgreSQL" class="flex items-center gap-2">
            <Switch id="force-kill" v-model:checked="forceKill" />
            <Label for="force-kill" class="text-sm">
              Force terminate (pg_terminate_backend)
            </Label>
          </div>
          <p v-if="isPostgreSQL" class="text-xs text-muted-foreground">
            Without force, uses pg_cancel_backend which gracefully cancels the current query.
            Force terminate will immediately terminate the entire backend process.
          </p>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" size="lg" @click="showKillDialog = false">
            Cancel
          </Button>
          <Button variant="destructive" size="lg" @click="killProcess">
            <IconTrash class="h-4 w-4 mr-2" />
            Kill Process
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
