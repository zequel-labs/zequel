<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import { getDbLogo } from '@/lib/db-logos'
import { getEnvironmentTextClass, getConnectionSubtitle } from '@/lib/connection'
import {
  IconDatabase,
  IconLoader2,
  IconCheck,
  IconX,
  IconPlugConnected,
  IconLock,
  IconTerminal2,
  IconAlertCircle,
  IconRefresh
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

interface Props {
  connection: SavedConnection
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'connect', id: string): void
  (e: 'edit', id: string): void
  (e: 'delete', id: string): void
}>()

const connectionsStore = useConnectionsStore()

const testingConnection = ref(false)
const testResult = ref<'success' | 'error' | null>(null)

const connectionState = computed(() => connectionsStore.getConnectionState(props.connection.id))
const isConnected = computed(() => connectionState.value.status === ConnectionStatus.Connected)
const isConnecting = computed(() => connectionState.value.status === ConnectionStatus.Connecting)
const isReconnecting = computed(() => connectionState.value.status === ConnectionStatus.Reconnecting)
const hasError = computed(() => connectionState.value.status === ConnectionStatus.Error)

const dbTypeName = computed(() => {
  const names: Record<string, string> = {
    [DatabaseType.PostgreSQL]: 'PostgreSQL',
    [DatabaseType.MySQL]: 'MySQL',
    [DatabaseType.MariaDB]: 'MariaDB',
    [DatabaseType.SQLite]: 'SQLite',
    [DatabaseType.ClickHouse]: 'ClickHouse',
    [DatabaseType.MongoDB]: 'MongoDB',
    [DatabaseType.Redis]: 'Redis'
  }
  return names[props.connection.type] || props.connection.type
})

const lastConnectedFormatted = computed(() => {
  if (!props.connection.lastConnectedAt) return null
  const date = new Date(props.connection.lastConnectedAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
})


const isSQLite = computed(() => props.connection.type === DatabaseType.SQLite)
const isRedis = computed(() => props.connection.type === DatabaseType.Redis)
const isMongoDB = computed(() => props.connection.type === DatabaseType.MongoDB)

const handleTestConnection = async () => {
  testingConnection.value = true
  testResult.value = null
  try {
    const config: ConnectionConfig = {
      id: props.connection.id,
      name: props.connection.name,
      type: props.connection.type,
      host: props.connection.host || undefined,
      port: props.connection.port || undefined,
      database: props.connection.database,
      username: props.connection.username || undefined,
      filepath: props.connection.filepath || undefined,
      ssl: props.connection.ssl,
      ssh: props.connection.ssh || undefined
    }
    const success = await connectionsStore.testConnection(config)
    testResult.value = success ? 'success' : 'error'
  } catch {
    testResult.value = 'error'
  } finally {
    testingConnection.value = false
    setTimeout(() => { testResult.value = null }, 4000)
  }
}

const handleConnect = () => {
  emit('connect', props.connection.id)
}

const handleSwitchTo = () => {
  connectionsStore.setActiveConnection(props.connection.id)
}

const handleDisconnect = async () => {
  await connectionsStore.disconnect(props.connection.id)
}
</script>

<template>
  <div class="flex items-center justify-center h-full px-6">
    <div class="w-full max-w-lg">
      <!-- Header: Logo + Name -->
      <div class="flex items-center gap-4 mb-6">
        <div class="shrink-0">
          <img v-if="getDbLogo(connection.type)" :src="getDbLogo(connection.type)" :alt="connection.type"
            class="h-12 w-12" />
          <div v-else class="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <IconDatabase class="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-semibold truncate">
            {{ connection.name }}
            <span v-if="connection.environment" :class="getEnvironmentTextClass(connection.environment)" class="font-normal"> ({{ connection.environment }})</span>
          </h2>
          <p class="text-sm text-muted-foreground">{{ dbTypeName }}</p>
        </div>
      </div>

      <!-- Info Grid -->
      <div class="rounded-lg border bg-card p-4 mb-4">
        <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <!-- Host -->
          <template v-if="!isSQLite">
            <div>
              <div class="text-xs text-muted-foreground mb-0.5">Host</div>
              <div class="font-medium truncate">{{ connection.host || 'localhost' }}</div>
            </div>
            <div v-if="!isMongoDB">
              <div class="text-xs text-muted-foreground mb-0.5">Port</div>
              <div class="font-medium">{{ connection.port || '—' }}</div>
            </div>
          </template>

          <!-- SQLite: filepath -->
          <template v-if="isSQLite">
            <div class="col-span-2">
              <div class="text-xs text-muted-foreground mb-0.5">File Path</div>
              <div class="font-medium truncate text-xs">{{ connection.filepath || '—' }}</div>
            </div>
          </template>

          <!-- Database -->
          <div v-if="!isRedis && !isSQLite">
            <div class="text-xs text-muted-foreground mb-0.5">Database</div>
            <div class="font-medium truncate">{{ connection.database || '—' }}</div>
          </div>

          <!-- Username -->
          <div v-if="!isSQLite && !isRedis">
            <div class="text-xs text-muted-foreground mb-0.5">Username</div>
            <div class="font-medium truncate">{{ connection.username || '—' }}</div>
          </div>

          <!-- SSL -->
          <div>
            <div class="text-xs text-muted-foreground mb-0.5">SSL</div>
            <div class="flex items-center gap-1 font-medium">
              <IconLock v-if="connection.ssl" class="h-3.5 w-3.5 text-green-500" />
              <span>{{ connection.ssl ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>

          <!-- SSH -->
          <div>
            <div class="text-xs text-muted-foreground mb-0.5">SSH Tunnel</div>
            <div class="flex items-center gap-1 font-medium">
              <IconTerminal2 v-if="connection.ssh?.enabled" class="h-3.5 w-3.5 text-blue-500" />
              <span>{{ connection.ssh?.enabled ? connection.ssh.host : 'None' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Last Connected -->
      <div v-if="lastConnectedFormatted" class="text-xs text-muted-foreground mb-4">
        Last connected {{ lastConnectedFormatted }}
      </div>

      <!-- Connection Status -->
      <div v-if="hasError && connectionState.error" class="flex items-start gap-2 text-sm text-destructive mb-4 p-3 rounded-lg bg-destructive/10">
        <IconAlertCircle class="h-4 w-4 shrink-0 mt-0.5" />
        <span>{{ connectionState.error }}</span>
      </div>

      <div v-if="isReconnecting" class="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 rounded-lg bg-muted">
        <IconRefresh class="h-4 w-4 animate-spin" />
        <span>Reconnecting{{ connectionState.reconnectAttempt ? ` (attempt ${connectionState.reconnectAttempt})` : '' }}...</span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <template v-if="isConnected">
          <Button class="flex-1" @click="handleSwitchTo">
            <IconPlugConnected class="h-4 w-4 mr-2" />
            Switch To
          </Button>
          <Button variant="outline" @click="handleDisconnect">
            Disconnect
          </Button>
        </template>
        <template v-else>
          <Button class="flex-1" :disabled="isConnecting" @click="handleConnect">
            <IconLoader2 v-if="isConnecting" class="h-4 w-4 mr-2 animate-spin" />
            <IconPlugConnected v-else class="h-4 w-4 mr-2" />
            {{ isConnecting ? 'Connecting...' : 'Connect' }}
          </Button>
          <Button variant="outline" :disabled="testingConnection" @click="handleTestConnection">
            <IconLoader2 v-if="testingConnection" class="h-4 w-4 mr-1.5 animate-spin" />
            <IconCheck v-else-if="testResult === 'success'" class="h-4 w-4 mr-1.5 text-green-500" />
            <IconX v-else-if="testResult === 'error'" class="h-4 w-4 mr-1.5 text-destructive" />
            Test
          </Button>
        </template>
        <Button variant="outline" @click="emit('edit', connection.id)">
          Edit
        </Button>
        <Button variant="outline" class="text-destructive hover:text-destructive" @click="emit('delete', connection.id)">
          Delete
        </Button>
      </div>
    </div>
  </div>
</template>
