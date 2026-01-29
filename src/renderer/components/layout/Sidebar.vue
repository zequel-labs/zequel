<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
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
  IconCode,
  IconCopy,
  IconTrash,
  IconPencil
} from '@tabler/icons-vue'
import ScrollArea from '../ui/ScrollArea.vue'
import Button from '../ui/Button.vue'
import ContextMenu from '../ui/ContextMenu.vue'

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
const { openTableTab, openQueryTab } = useTabs()

const expandedNodes = ref<Set<string>>(new Set())
const selectedNodeId = ref<string | null>(null)
const loadingNodes = ref<Set<string>>(new Set())

const connections = computed(() => connectionsStore.sortedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

onMounted(() => {
  connectionsStore.loadConnections()
})

function getConnectionState(id: string) {
  return connectionsStore.getConnectionState(id)
}

function isConnected(id: string) {
  return getConnectionState(id).status === 'connected'
}

async function handleConnectionClick(connectionId: string) {
  const state = getConnectionState(connectionId)

  if (state.status === 'connected') {
    // Already connected, toggle expand
    toggleNode(`conn-${connectionId}`)
  } else if (state.status !== 'connecting') {
    // Not connected, try to connect
    try {
      await connectionsStore.connect(connectionId)
      expandedNodes.value.add(`conn-${connectionId}`)
    } catch (error) {
      console.error('Connection failed:', error)
    }
  }
}

async function handleDisconnect(connectionId: string) {
  await connectionsStore.disconnect(connectionId)
  expandedNodes.value.delete(`conn-${connectionId}`)
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
  openTableTab(table.name, database)
}

function handleTableDoubleClick(connectionId: string, tableName: string) {
  openQueryTab(`SELECT * FROM "${tableName}" LIMIT 100;`)
}

async function refreshTables(connectionId: string) {
  const connection = connections.value.find(c => c.id === connectionId)
  if (connection) {
    await connectionsStore.loadTables(connectionId, connection.database)
  }
}

function getConnectionMenuItems(connectionId: string) {
  const connected = isConnected(connectionId)
  return [
    {
      label: connected ? 'Disconnect' : 'Connect',
      icon: connected ? IconPlugConnectedX : IconPlugConnected,
      onClick: () => connected ? handleDisconnect(connectionId) : handleConnectionClick(connectionId)
    },
    ...(connected ? [{
      label: 'Refresh Tables',
      icon: IconRefresh,
      onClick: () => refreshTables(connectionId)
    }] : []),
    { separator: true },
    {
      label: 'Edit Connection',
      icon: IconPencil,
      onClick: () => emit('edit-connection', connectionId)
    },
    {
      label: 'Delete Connection',
      icon: IconTrash,
      onClick: () => handleDeleteConnection(connectionId)
    }
  ]
}

function getTableMenuItems(connectionId: string, table: { name: string; type: string }) {
  return [
    {
      label: 'View Data',
      icon: IconTable,
      onClick: () => openTableTab(table.name)
    },
    {
      label: 'Query Table',
      icon: IconCode,
      shortcut: '⌘↵',
      onClick: () => openQueryTab(`SELECT * FROM "${table.name}" LIMIT 100;`)
    },
    { separator: true },
    {
      label: 'Copy Name',
      icon: IconCopy,
      onClick: () => navigator.clipboard.writeText(table.name)
    },
    {
      label: 'Copy SELECT Statement',
      icon: IconCopy,
      onClick: () => navigator.clipboard.writeText(`SELECT * FROM "${table.name}";`)
    }
  ]
}

async function handleDeleteConnection(connectionId: string) {
  if (confirm('Are you sure you want to delete this connection?')) {
    await connectionsStore.deleteConnection(connectionId)
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
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        @click="emit('new-connection')"
      >
        <IconPlus class="h-4 w-4" />
      </Button>
    </div>

    <!-- Connections List -->
    <ScrollArea class="flex-1 px-2">
      <div class="space-y-1 pb-4">
        <template v-for="connection in connections" :key="connection.id">
          <ContextMenu :items="getConnectionMenuItems(connection.id)">
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

                <IconDatabase
                  class="h-4 w-4 shrink-0"
                  :class="isConnected(connection.id) ? 'text-green-500' : 'text-muted-foreground'"
                />

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
                  <ContextMenu :items="getTableMenuItems(connection.id, table)">
                    <div
                      class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `table-${connection.id}-${table.name}` }"
                      @click="selectedNodeId = `table-${connection.id}-${table.name}`; handleTableClick(connection.id, table, connection.database)"
                      @dblclick="handleTableDoubleClick(connection.id, table.name)"
                    >
                      <IconTable v-if="table.type === 'table'" class="h-4 w-4 text-blue-500" />
                      <IconEye v-else class="h-4 w-4 text-purple-500" />
                      <span class="flex-1 truncate text-sm">{{ table.name }}</span>
                    </div>
                  </ContextMenu>
                </template>

                <!-- Loading state -->
                <div
                  v-if="connectionsStore.tables.get(connection.id)?.length === 0"
                  class="px-2 py-2 text-sm text-muted-foreground"
                >
                  No tables found
                </div>
              </div>
            </div>
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
  </div>
</template>
