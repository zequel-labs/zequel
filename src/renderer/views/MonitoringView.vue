<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTabsStore, type MonitoringTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  IconRefresh,
  IconPlayerStop,
  IconPlayerPlay,
  IconX,
  IconLoader2,
  IconAlertTriangle,
  IconClock,
  IconDatabase,
  IconUser,
  IconServer
} from '@tabler/icons-vue'
import type { DatabaseProcess, ServerStatus } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const processes = ref<DatabaseProcess[]>([])
const serverStatus = ref<ServerStatus | null>(null)
const autoRefresh = ref(false)
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const killingProcess = ref<number | string | null>(null)

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

const isPostgreSQL = computed(() => connection.value?.type === 'postgresql')
const isMySQL = computed(() => connection.value?.type === 'mysql')
const isSQLite = computed(() => connection.value?.type === 'sqlite')

async function loadData() {
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

function startAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  refreshInterval.value = setInterval(loadData, 3000) // Refresh every 3 seconds
}

function stopAutoRefresh() {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
  }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

function confirmKill(process: DatabaseProcess) {
  processToKill.value = process
  forceKill.value = false
  showKillDialog.value = true
}

async function killProcess() {
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
      error.value = result.error || 'Failed to kill process'
    } else {
      // Refresh the list
      await loadData()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to kill process'
  } finally {
    killingProcess.value = null
    processToKill.value = null
  }
}

function formatTime(seconds: number): string {
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

function getCommandBadgeVariant(command: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const cmd = command.toLowerCase()
  if (cmd === 'query' || cmd === 'execute' || cmd === 'active') return 'default'
  if (cmd === 'sleep' || cmd === 'idle') return 'secondary'
  if (cmd === 'killed' || cmd === 'idle in transaction (aborted)') return 'destructive'
  return 'outline'
}

function truncateQuery(query: string | null, maxLength = 100): string {
  if (!query) return '-'
  if (query.length <= maxLength) return query
  return query.substring(0, maxLength) + '...'
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  stopAutoRefresh()
})

watch(connectionId, () => {
  loadData()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <IconServer class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">Process Monitor</h1>
        </div>
        <Badge variant="outline">
          {{ processes.length }} {{ processes.length === 1 ? 'process' : 'processes' }}
        </Badge>
        <Badge v-if="isSQLite" variant="secondary">
          Not available for SQLite
        </Badge>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <Switch
            id="auto-refresh"
            :checked="autoRefresh"
            @update:checked="toggleAutoRefresh"
          />
          <Label for="auto-refresh" class="text-sm">Auto-refresh</Label>
        </div>
        <Button variant="outline" size="sm" @click="loadData" :disabled="loading">
          <IconRefresh v-if="!loading" class="h-4 w-4 mr-2" />
          <IconLoader2 v-else class="h-4 w-4 mr-2 animate-spin" />
          Refresh
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <!-- SQLite Message -->
      <div v-if="isSQLite" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <IconDatabase class="h-16 w-16 opacity-50" />
        <p class="text-lg">Process monitoring is not available for SQLite databases</p>
        <p class="text-sm">SQLite uses a single connection and doesn't support process lists</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading && processes.length === 0" class="flex items-center justify-center h-full">
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error && processes.length === 0" class="flex flex-col items-center justify-center h-full gap-4">
        <IconAlertTriangle class="h-12 w-12 text-destructive" />
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" @click="loadData">
          Retry
        </Button>
      </div>

      <!-- Process List -->
      <div v-else class="space-y-6 max-w-7xl mx-auto">
        <!-- Error Banner -->
        <div v-if="error" class="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
          <IconAlertTriangle class="h-4 w-4 text-destructive" />
          <span class="text-sm text-destructive">{{ error }}</span>
          <Button variant="ghost" size="sm" class="ml-auto h-6 px-2" @click="error = null">
            <IconX class="h-4 w-4" />
          </Button>
        </div>

        <!-- Process Table -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Active Processes</CardTitle>
            <CardDescription>
              Currently running connections and queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div v-if="processes.length === 0" class="text-center py-8 text-muted-foreground">
              No active processes found
            </div>
            <div v-else class="rounded-md border overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/50">
                  <tr>
                    <th class="px-4 py-2 text-left font-medium w-20">ID</th>
                    <th class="px-4 py-2 text-left font-medium">User</th>
                    <th class="px-4 py-2 text-left font-medium">Host</th>
                    <th class="px-4 py-2 text-left font-medium">Database</th>
                    <th class="px-4 py-2 text-left font-medium">Command</th>
                    <th class="px-4 py-2 text-left font-medium">Time</th>
                    <th class="px-4 py-2 text-left font-medium">State</th>
                    <th class="px-4 py-2 text-left font-medium max-w-xs">Query</th>
                    <th class="px-4 py-2 text-center font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="process in processes"
                    :key="process.id"
                    class="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td class="px-4 py-2 font-mono text-xs">{{ process.id }}</td>
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-1">
                        <IconUser class="h-3 w-3 text-muted-foreground" />
                        {{ process.user || '-' }}
                      </div>
                    </td>
                    <td class="px-4 py-2 text-muted-foreground text-xs">
                      {{ process.host || '-' }}
                    </td>
                    <td class="px-4 py-2">
                      <Badge v-if="process.database" variant="outline">
                        {{ process.database }}
                      </Badge>
                      <span v-else class="text-muted-foreground">-</span>
                    </td>
                    <td class="px-4 py-2">
                      <Badge :variant="getCommandBadgeVariant(process.command)">
                        {{ process.command }}
                      </Badge>
                    </td>
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-1">
                        <IconClock class="h-3 w-3 text-muted-foreground" />
                        <span :class="{ 'text-amber-500': process.time > 60, 'text-destructive': process.time > 300 }">
                          {{ formatTime(process.time || 0) }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-2 text-muted-foreground text-xs max-w-[150px] truncate" :title="process.state || undefined">
                      {{ process.state || '-' }}
                    </td>
                    <td class="px-4 py-2 text-xs max-w-xs">
                      <div class="truncate font-mono" :title="process.info || undefined">
                        {{ truncateQuery(process.info) }}
                      </div>
                    </td>
                    <td class="px-4 py-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        :disabled="killingProcess === process.id"
                        @click="confirmKill(process)"
                      >
                        <IconLoader2 v-if="killingProcess === process.id" class="h-4 w-4 animate-spin" />
                        <IconPlayerStop v-else class="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- Server Status -->
        <Card v-if="serverStatus">
          <CardHeader>
            <CardTitle class="text-base">Server Status</CardTitle>
            <CardDescription>
              Key server variables and status information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <!-- MySQL specific -->
              <template v-if="isMySQL">
                <div v-if="serverStatus.status.Threads_connected" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Active Connections</div>
                  <div class="text-xl font-semibold">{{ serverStatus.status.Threads_connected }}</div>
                </div>
                <div v-if="serverStatus.variables.max_connections" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Max Connections</div>
                  <div class="text-xl font-semibold">{{ serverStatus.variables.max_connections }}</div>
                </div>
                <div v-if="serverStatus.status.Uptime" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Uptime</div>
                  <div class="text-xl font-semibold">{{ formatTime(parseInt(serverStatus.status.Uptime)) }}</div>
                </div>
                <div v-if="serverStatus.status.Questions" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Total Queries</div>
                  <div class="text-xl font-semibold">{{ parseInt(serverStatus.status.Questions).toLocaleString() }}</div>
                </div>
                <div v-if="serverStatus.status.Slow_queries" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Slow Queries</div>
                  <div class="text-xl font-semibold">{{ serverStatus.status.Slow_queries }}</div>
                </div>
                <div v-if="serverStatus.variables.version" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">MySQL Version</div>
                  <div class="text-xl font-semibold">{{ serverStatus.variables.version }}</div>
                </div>
              </template>

              <!-- PostgreSQL specific -->
              <template v-if="isPostgreSQL">
                <div v-if="serverStatus.status.connections" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Active Connections</div>
                  <div class="text-xl font-semibold">{{ serverStatus.status.connections }}</div>
                </div>
                <div v-if="serverStatus.status.max_connections" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Max Connections</div>
                  <div class="text-xl font-semibold">{{ serverStatus.status.max_connections }}</div>
                </div>
                <div v-if="serverStatus.variables.server_version" class="bg-muted/30 p-3 rounded-lg col-span-2">
                  <div class="text-xs text-muted-foreground">PostgreSQL Version</div>
                  <div class="text-sm font-semibold truncate">{{ serverStatus.variables.server_version }}</div>
                </div>
              </template>

              <!-- SQLite specific -->
              <template v-if="isSQLite">
                <div v-if="serverStatus.variables.journal_mode" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Journal Mode</div>
                  <div class="text-xl font-semibold">{{ serverStatus.variables.journal_mode }}</div>
                </div>
                <div v-if="serverStatus.variables.page_size" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Page Size</div>
                  <div class="text-xl font-semibold">{{ serverStatus.variables.page_size }}</div>
                </div>
                <div v-if="serverStatus.variables.cache_size" class="bg-muted/30 p-3 rounded-lg">
                  <div class="text-xs text-muted-foreground">Cache Size</div>
                  <div class="text-xl font-semibold">{{ serverStatus.variables.cache_size }}</div>
                </div>
              </template>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Kill Process Confirmation Dialog -->
    <Dialog v-model:open="showKillDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kill Process</DialogTitle>
          <DialogDescription>
            Are you sure you want to kill this process?
          </DialogDescription>
        </DialogHeader>

        <div v-if="processToKill" class="space-y-4">
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

        <DialogFooter>
          <Button variant="outline" @click="showKillDialog = false">
            Cancel
          </Button>
          <Button variant="destructive" @click="killProcess">
            Kill Process
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
