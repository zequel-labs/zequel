<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { usePendingChangesStore } from '@/stores/pendingChanges'

import { useTabs } from '@/composables/useTabs'
import {
  IconCopy,
  IconTrash,
  IconPencil
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { copyToClipboard, getEntityIcon } from '@/lib/utils'

interface Props {
  searchFilter: string
  selectedNodeId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:selectedNodeId', id: string): void
  (e: 'rename-table', table: { name: string; type: string }): void
  (e: 'drop-table', table: { name: string; type: string }): void
}>()

const connectionsStore = useConnectionsStore()
const pendingChangesStore = usePendingChangesStore()

const { openTableTab } = useTabs()

const activeSessionId = computed(() => connectionsStore.activeSessionId)
const currentDatabase = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeSessionId.value) || 'db0'
})

const activeTables = computed(() => {
  if (!activeSessionId.value) return []
  return connectionsStore.tables.get(activeSessionId.value) || []
})

const filteredTables = computed(() => {
  if (!props.searchFilter) return activeTables.value
  const q = props.searchFilter.toLowerCase()
  return activeTables.value.filter(t => t.name.toLowerCase().includes(q))
})

const handleTableClick = (table: { name: string; type: string }) => {
  if (!activeSessionId.value) return
  openTableTab(table.name, currentDatabase.value)
}

// Clear caches on refresh
const handleRefreshSchema = () => {
  // Nothing to clear — tables are managed by the store
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const expandAll = () => {
  // Redis keys have no columns to expand — no-op
}

const collapseAll = () => {
  // No-op
}

defineExpose({ expandAll, collapseAll })

// Clear state when connection changes
watch(() => connectionsStore.activeSessionId, () => {
  // Tables are managed by the store; nothing local to clear
})
</script>

<template>
  <!-- Keys list -->
  <template v-for="table in filteredTables" :key="table.name">
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
          :data-testid="`sidebar-redis-key-${table.name}`"
          :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }"
          @click="emit('update:selectedNodeId', `table-${table.name}`); handleTableClick(table)">
          <component :is="getEntityIcon('table').icon" :class="['h-4 w-4 shrink-0', getEntityIcon('table').color]" />
          <span class="flex-1 truncate text-sm">{{ table.name }}</span>
          <span
            v-if="pendingChangesStore.hasPendingChanges(activeSessionId!, table.name, currentDatabase)"
            class="h-2 w-2 rounded-full bg-yellow-500 shrink-0"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem @click="openTableTab(table.name, currentDatabase)">
          <component :is="getEntityIcon('table').icon" class="h-4 w-4 mr-2" />
          View Data
        </ContextMenuItem>
        <template v-if="!connectionsStore.safeMode">
          <ContextMenuSeparator />
          <ContextMenuItem @click="emit('rename-table', table)">
            <IconPencil class="h-4 w-4 mr-2" />
            Rename Key
          </ContextMenuItem>
          <ContextMenuItem @click="emit('drop-table', table)">
            <IconTrash class="h-4 w-4 mr-2" />
            Delete Key
          </ContextMenuItem>
        </template>
        <ContextMenuSeparator />
        <ContextMenuItem @click="copyToClipboard(table.name, 'Name copied')">
          <IconCopy class="h-4 w-4 mr-2" />
          Copy Name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </template>

  <!-- Empty state -->
  <div v-if="filteredTables.length === 0" class="px-2 py-1 text-sm text-muted-foreground">
    No keys found
  </div>
</template>
