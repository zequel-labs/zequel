<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { Table } from '@/types/table'
import {
  IconChevronRight,
  IconChevronDown,
  IconDatabase,
  IconTable,
  IconEye,
  IconFolderOpen,
  IconLoader2
} from '@tabler/icons-vue'

const emit = defineEmits<{
  (e: 'select-table', table: Table): void
  (e: 'open-table', table: Table): void
}>()

const connectionsStore = useConnectionsStore()

const expandedDatabases = ref<Set<string>>(new Set())
const loadingDatabases = ref<Set<string>>(new Set())
const selectedTable = ref<string | null>(null)

const connectionId = computed(() => connectionsStore.activeConnectionId)
const databases = computed(() => connectionsStore.activeDatabases)
const tables = computed(() => connectionsStore.activeTables)

async function toggleDatabase(dbName: string) {
  if (expandedDatabases.value.has(dbName)) {
    expandedDatabases.value.delete(dbName)
  } else {
    if (connectionId.value) {
      loadingDatabases.value.add(dbName)
      try {
        await connectionsStore.loadTables(connectionId.value, dbName)
        expandedDatabases.value.add(dbName)
      } finally {
        loadingDatabases.value.delete(dbName)
      }
    }
  }
}

function handleTableClick(table: Table) {
  selectedTable.value = table.name
  emit('select-table', table)
}

function handleTableDoubleClick(table: Table) {
  emit('open-table', table)
}
</script>

<template>
  <div class="space-y-1">
    <template v-for="database in databases" :key="database.name">
      <div
        class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
        @click="toggleDatabase(database.name)"
      >
        <button class="p-0.5">
          <IconLoader2
            v-if="loadingDatabases.has(database.name)"
            class="h-4 w-4 animate-spin text-muted-foreground"
          />
          <IconChevronRight
            v-else-if="!expandedDatabases.has(database.name)"
            class="h-4 w-4 text-muted-foreground"
          />
          <IconChevronDown v-else class="h-4 w-4 text-muted-foreground" />
        </button>

        <IconFolderOpen class="h-4 w-4 text-yellow-500" />
        <span class="flex-1 truncate text-sm">{{ database.name }}</span>
      </div>

      <div
        v-if="expandedDatabases.has(database.name)"
        class="ml-6 space-y-0.5"
      >
        <div
          v-for="table in tables"
          :key="table.name"
          :class="[
            'flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md',
            selectedTable === table.name ? 'bg-accent' : 'hover:bg-accent/50'
          ]"
          @click="handleTableClick(table)"
          @dblclick="handleTableDoubleClick(table)"
        >
          <IconTable v-if="table.type === 'table'" class="h-4 w-4 text-blue-500" />
          <IconEye v-else class="h-4 w-4 text-purple-500" />
          <span class="flex-1 truncate text-sm">{{ table.name }}</span>
          <span
            v-if="table.rowCount !== undefined"
            class="text-xs text-muted-foreground"
          >
            {{ table.rowCount }}
          </span>
        </div>

        <div
          v-if="tables.length === 0 && !loadingDatabases.has(database.name)"
          class="px-2 py-2 text-sm text-muted-foreground"
        >
          No tables found
        </div>
      </div>
    </template>

    <div
      v-if="databases.length === 0"
      class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
    >
      <IconDatabase class="h-8 w-8 mb-2 opacity-50" />
      <span class="text-sm">Connect to a database to browse tables</span>
    </div>
  </div>
</template>
