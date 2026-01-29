<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { Table, Column, ForeignKey } from '@/types/table'
import { IconLoader2 } from '@tabler/icons-vue'
import ERDiagram from '@/components/schema/ERDiagram.vue'
import { useTabs } from '@/composables/useTabs'

interface TableWithDetails {
  table: Table
  columns: Column[]
  foreignKeys: ForeignKey[]
}

const connectionsStore = useConnectionsStore()
const { openTableTab } = useTabs()

const tables = ref<TableWithDetails[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const connectionId = computed(() => connectionsStore.activeConnectionId)
const activeConnection = computed(() => connectionsStore.activeConnection)
const database = computed(() => {
  // First try to get from active databases list
  const fromList = connectionsStore.activeDatabases[0]?.name
  if (fromList) return fromList
  // Fall back to connection's configured database
  return activeConnection.value?.database || ''
})

async function loadSchema() {
  if (!connectionId.value) return

  isLoading.value = true
  error.value = null
  tables.value = []

  try {
    // Get all tables
    const tableList = await window.api.schema.tables(connectionId.value, database.value)

    // Load columns and foreign keys for each table
    const tablesWithDetails: TableWithDetails[] = []

    for (const table of tableList) {
      if (table.type !== 'table') continue // Skip views

      const [columns, foreignKeys] = await Promise.all([
        window.api.schema.columns(connectionId.value, table.name),
        window.api.schema.foreignKeys(connectionId.value, table.name)
      ])

      tablesWithDetails.push({
        table,
        columns,
        foreignKeys
      })
    }

    tables.value = tablesWithDetails
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load schema'
  } finally {
    isLoading.value = false
  }
}

function handleTableClick(tableName: string) {
  openTableTab(tableName, database.value)
}

onMounted(() => {
  loadSchema()
})

watch(connectionId, () => {
  loadSchema()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-2">
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        <span class="text-sm text-muted-foreground">Loading schema...</span>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 p-4">
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- ER Diagram -->
    <ERDiagram
      v-else
      :tables="tables"
      :loading="isLoading"
      @table-click="handleTableClick"
      class="flex-1"
    />
  </div>
</template>
