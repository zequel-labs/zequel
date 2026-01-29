<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { SavedConnection } from '@/types/connection'
import { IconDatabase, IconDotsVertical, IconPencil, IconTrash, IconPlugConnected } from '@tabler/icons-vue'
import Button from '../ui/Button.vue'
import DropdownMenu from '../ui/DropdownMenu.vue'

const emit = defineEmits<{
  (e: 'edit', connection: SavedConnection): void
  (e: 'delete', connection: SavedConnection): void
  (e: 'connect', connection: SavedConnection): void
}>()

const connectionsStore = useConnectionsStore()
const connections = computed(() => connectionsStore.sortedConnections)

function getTypeIcon(type: string) {
  return IconDatabase
}

function getTypeColor(type: string) {
  switch (type) {
    case 'postgresql':
      return 'text-blue-500'
    case 'mysql':
      return 'text-orange-500'
    case 'sqlite':
      return 'text-green-500'
    default:
      return 'text-gray-500'
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Never'
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getMenuItems(connection: SavedConnection) {
  return [
    { label: 'Connect', value: 'connect', icon: IconPlugConnected },
    { label: 'Edit', value: 'edit', icon: IconPencil },
    { separator: true, label: '' },
    { label: 'Delete', value: 'delete', icon: IconTrash }
  ]
}

function handleMenuSelect(value: string, connection: SavedConnection) {
  switch (value) {
    case 'connect':
      emit('connect', connection)
      break
    case 'edit':
      emit('edit', connection)
      break
    case 'delete':
      emit('delete', connection)
      break
  }
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="connection in connections"
      :key="connection.id"
      class="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
    >
      <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
        <component
          :is="getTypeIcon(connection.type)"
          :class="['h-5 w-5', getTypeColor(connection.type)]"
        />
      </div>

      <div class="flex-1 min-w-0">
        <h3 class="font-medium truncate">{{ connection.name }}</h3>
        <p class="text-sm text-muted-foreground truncate">
          {{ connection.type === 'sqlite' ? connection.filepath || connection.database : `${connection.host}:${connection.port}/${connection.database}` }}
        </p>
      </div>

      <div class="text-sm text-muted-foreground hidden md:block">
        <span>Last connected: </span>
        <span>{{ formatDate(connection.lastConnectedAt) }}</span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          @click="emit('connect', connection)"
        >
          <IconPlugConnected class="h-4 w-4 mr-1" />
          Connect
        </Button>

        <DropdownMenu
          :items="getMenuItems(connection)"
          @select="handleMenuSelect($event, connection)"
        >
          <template #trigger>
            <Button variant="ghost" size="icon" class="h-8 w-8">
              <IconDotsVertical class="h-4 w-4" />
            </Button>
          </template>
        </DropdownMenu>
      </div>
    </div>

    <div
      v-if="connections.length === 0"
      class="flex flex-col items-center justify-center py-12 text-center"
    >
      <IconDatabase class="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 class="text-lg font-medium mb-2">No connections yet</h3>
      <p class="text-muted-foreground mb-4">
        Create your first database connection to get started
      </p>
    </div>
  </div>
</template>
