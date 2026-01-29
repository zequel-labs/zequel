<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import {
  IconDatabase,
  IconPlus,
  IconLoader2,
  IconAlertCircle,
  IconDotsVertical,
  IconPencil,
  IconTrash
} from '@tabler/icons-vue'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
}>()

const connectionsStore = useConnectionsStore()

const connectingId = ref<string | null>(null)
const connectionError = ref<Map<string, string>>(new Map())

const connections = computed(() => connectionsStore.sortedConnections)

onMounted(() => {
  connectionsStore.loadConnections()
})

function isConnecting(id: string) {
  return connectionsStore.getConnectionState(id).status === 'connecting'
}

async function handleConnect(id: string) {
  if (isConnecting(id)) return

  const state = connectionsStore.getConnectionState(id)
  if (state.status === 'connected') {
    connectionsStore.setActiveConnection(id)
    return
  }

  connectingId.value = id
  connectionError.value.delete(id)
  try {
    await connectionsStore.connect(id)
  } catch (e) {
    connectionError.value.set(id, e instanceof Error ? e.message : 'Connection failed')
  } finally {
    connectingId.value = null
  }
}

async function handleDeleteConnection(id: string) {
  if (confirm('Are you sure you want to delete this connection?')) {
    await connectionsStore.deleteConnection(id)
  }
}

function getDisplayHost(connection: { host: string | null; port: number | null; filepath: string | null; type: string }) {
  if (connection.type === 'sqlite' && connection.filepath) {
    return connection.filepath.split('/').pop() || connection.filepath
  }
  if (connection.host) {
    return connection.port ? `${connection.host}:${connection.port}` : connection.host
  }
  return 'localhost'
}

function getTypeBadgeVariant(type: string) {
  switch (type) {
    case 'postgresql': return 'default'
    case 'mysql': return 'secondary'
    case 'mariadb': return 'secondary'
    case 'sqlite': return 'outline'
    default: return 'outline'
  }
}

function getTypeLabel(type: string) {
  switch (type) {
    case 'postgresql': return 'PostgreSQL'
    case 'mysql': return 'MySQL'
    case 'mariadb': return 'MariaDB'
    case 'sqlite': return 'SQLite'
    case 'clickhouse': return 'ClickHouse'
    case 'mongodb': return 'MongoDB'
    case 'redis': return 'Redis'
    default: return type
  }
}
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- macOS Traffic Light Area -->
    <div class="h-[38px] flex-shrink-0 titlebar-drag" />

    <ScrollArea class="flex-1">
      <div class="max-w-4xl mx-auto px-8 py-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight">Zequel</h1>
          <p class="text-sm text-muted-foreground mt-1">Select a connection to get started</p>
        </div>

        <!-- Connection Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- New Connection Card -->
          <Card
            class="cursor-pointer border-dashed border-2 hover:border-primary/50 hover:bg-accent/30 transition-colors"
            @click="emit('new-connection')"
          >
            <CardContent class="flex flex-col items-center justify-center py-8">
              <div class="rounded-full bg-muted p-3 mb-3">
                <IconPlus class="h-6 w-6 text-muted-foreground" />
              </div>
              <span class="text-sm font-medium text-muted-foreground">New Connection</span>
            </CardContent>
          </Card>

          <!-- Saved Connection Cards -->
          <Card
            v-for="connection in connections"
            :key="connection.id"
            class="cursor-pointer hover:bg-accent/30 transition-colors group"
            :class="{ 'opacity-75': isConnecting(connection.id) }"
            :style="connection.color ? { borderLeftWidth: '3px', borderLeftColor: connection.color } : {}"
            @click="handleConnect(connection.id)"
          >
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <IconLoader2
                    v-if="isConnecting(connection.id)"
                    class="h-4 w-4 animate-spin text-muted-foreground shrink-0"
                  />
                  <IconDatabase
                    v-else
                    class="h-4 w-4 shrink-0 text-muted-foreground"
                    :style="connection.color ? { color: connection.color } : {}"
                  />
                  <span class="font-semibold text-sm truncate">{{ connection.name }}</span>
                </div>
                <div class="flex items-center gap-1">
                  <Badge :variant="getTypeBadgeVariant(connection.type)" class="text-[10px] shrink-0">
                    {{ getTypeLabel(connection.type) }}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <button
                        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                        @click.stop
                      >
                        <IconDotsVertical class="h-4 w-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click.stop="emit('edit-connection', connection.id)">
                        <IconPencil class="h-4 w-4 mr-2" />
                        Edit Connection
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        class="text-destructive focus:text-destructive"
                        @click.stop="handleDeleteConnection(connection.id)"
                      >
                        <IconTrash class="h-4 w-4 mr-2" />
                        Delete Connection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="text-xs text-muted-foreground space-y-0.5">
                <div class="truncate">{{ getDisplayHost(connection) }}</div>
                <div v-if="connection.database" class="truncate">{{ connection.database }}</div>
              </div>
              <!-- Error message -->
              <div
                v-if="connectionError.get(connection.id)"
                class="mt-2 flex items-start gap-1.5 text-xs text-destructive"
              >
                <IconAlertCircle class="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span class="truncate">{{ connectionError.get(connection.id) }}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
