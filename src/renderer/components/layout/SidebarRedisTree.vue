<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import {
  IconTable,
  IconLoader2,
  IconCopy,
  IconDatabase,
  IconChevronLeft
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

interface Props {
  searchFilter: string
  selectedNodeId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:selectedNodeId', id: string): void
}>()

const connectionsStore = useConnectionsStore()
const { openTableTab } = useTabs()

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const redisDatabases = ref<{ name: string; keys: number }[]>([])
const selectedRedisDb = ref<string | null>(null)
const loadingRedisDbs = ref(false)

const activeTables = computed(() => {
  if (!activeConnectionId.value) return []
  return connectionsStore.tables.get(activeConnectionId.value) || []
})

const filteredTables = computed(() => {
  if (!props.searchFilter) return activeTables.value
  const q = props.searchFilter.toLowerCase()
  return activeTables.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredDatabases = computed(() => {
  if (!props.searchFilter) return redisDatabases.value
  const q = props.searchFilter.toLowerCase()
  return redisDatabases.value.filter(db => db.name.toLowerCase().includes(q))
})

const loadRedisDatabases = async (connectionId: string) => {
  loadingRedisDbs.value = true
  try {
    const dbs = await window.api.schema.databases(connectionId)
    redisDatabases.value = dbs
      .filter(db => !db.name.includes('(empty)'))
      .map(db => ({
        name: db.name,
        keys: parseInt(db.charset || '0', 10) || 0
      }))
  } catch (err) {
    console.error('Failed to load Redis databases:', err)
    redisDatabases.value = []
  } finally {
    loadingRedisDbs.value = false
  }
}

const handleRedisDbClick = async (db: { name: string; keys: number }) => {
  if (!activeConnectionId.value) return
  selectedRedisDb.value = db.name
  await connectionsStore.loadTables(activeConnectionId.value, db.name)
}

const handleBackToDatabases = () => {
  selectedRedisDb.value = null
  if (activeConnectionId.value) {
    connectionsStore.tables.delete(activeConnectionId.value)
  }
}

const handleTableClick = (table: { name: string; type: string }) => {
  if (!activeConnectionId.value) return
  openTableTab(table.name, selectedRedisDb.value || undefined)
}

// Clear caches on refresh
const handleRefreshSchema = () => {
  if (!activeConnectionId.value) return
  if (selectedRedisDb.value) {
    handleRedisDbClick({ name: selectedRedisDb.value, keys: 0 })
  } else {
    loadRedisDatabases(activeConnectionId.value)
  }
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  if (activeConnectionId.value) {
    loadRedisDatabases(activeConnectionId.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

// Reload when connection changes
watch(() => connectionsStore.activeConnectionId, (newId) => {
  selectedRedisDb.value = null
  redisDatabases.value = []
  if (newId) {
    loadRedisDatabases(newId)
  }
})
</script>

<template>
  <!-- Database list -->
  <template v-if="!selectedRedisDb">
    <div v-if="loadingRedisDbs" class="px-2 py-2">
      <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
    <template v-else-if="filteredDatabases.length > 0">
      <div v-for="db in filteredDatabases" :key="db.name"
        class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
        @click="handleRedisDbClick(db)">
        <IconDatabase class="h-4 w-4 text-red-500" />
        <span class="flex-1 truncate text-sm">{{ db.name }}</span>
        <span class="text-xs text-muted-foreground">{{ db.keys }} keys</span>
      </div>
    </template>
    <div v-else class="px-2 py-2 text-sm text-muted-foreground">
      No databases with keys
    </div>
  </template>

  <!-- Back button + keys list -->
  <template v-else>
    <div
      class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md text-sm text-muted-foreground"
      @click="handleBackToDatabases">
      <IconChevronLeft class="h-4 w-4" />
      <span>{{ selectedRedisDb }}</span>
    </div>

    <!-- Redis keys -->
    <template v-for="table in filteredTables" :key="table.name">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
            :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }"
            @click="emit('update:selectedNodeId', `table-${table.name}`); handleTableClick(table)">
            <IconTable class="h-4 w-4 text-blue-500" />
            <span class="flex-1 truncate text-sm">{{ table.name }}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem @click="openTableTab(table.name, selectedRedisDb || undefined)">
            <IconTable class="h-4 w-4 mr-2" />
            View Data
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @click="navigator.clipboard.writeText(table.name)">
            <IconCopy class="h-4 w-4 mr-2" />
            Copy Name
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </template>

    <!-- Empty keys state -->
    <div v-if="filteredTables.length === 0" class="px-2 py-2 text-sm text-muted-foreground">
      No keys found
    </div>
  </template>
</template>
