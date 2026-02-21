<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore, type ERDiagramTabData } from '@/stores/tabs'
import type { Table, Column, ForeignKey } from '@/types/table'
import { IconLoader2 } from '@tabler/icons-vue'
import ERDiagram from '@/components/schema/ERDiagram.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

interface TableWithDetails {
  table: Table
  columns: Column[]
  foreignKeys: ForeignKey[]
}

const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const tables = ref<TableWithDetails[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as ERDiagramTabData | undefined)
const connectionId = computed(() => tabData.value?.connectionId ?? null)
const database = computed(() => {
  if (!connectionId.value) return ''
  return connectionsStore.getActiveDatabase(connectionId.value)
})

const isLoaded = ref(false)

let loadGeneration = 0

const loadSchema = async () => {
  if (!connectionId.value) return
  if (isLoaded.value && tables.value.length > 0) return

  const currentGeneration = ++loadGeneration
  const currentConnectionId = connectionId.value
  const currentDatabase = database.value

  isLoading.value = true
  error.value = null
  tables.value = []

  try {
    // Get all tables
    const tableList = await window.api.schema.tables(currentConnectionId, currentDatabase)

    // Abort if connection changed during async call
    if (currentGeneration !== loadGeneration) return

    // Load columns and foreign keys for each table
    const tablesWithDetails: TableWithDetails[] = []

    for (const table of tableList) {
      if (table.type !== 'table') continue // Skip views

      const [columns, foreignKeys] = await Promise.all([
        window.api.schema.columns(currentConnectionId, table.name),
        window.api.schema.foreignKeys(currentConnectionId, table.name)
      ])

      // Abort if connection changed during async call
      if (currentGeneration !== loadGeneration) return

      tablesWithDetails.push({
        table,
        columns,
        foreignKeys
      })
    }

    tables.value = tablesWithDetails
    isLoaded.value = true
  } catch (e) {
    if (currentGeneration !== loadGeneration) return
    error.value = e instanceof Error ? e.message : 'Failed to load schema'
  } finally {
    if (currentGeneration === loadGeneration) {
      isLoading.value = false
    }
  }
}

const handleTableClick = (tableName: string) => {
  if (!connectionId.value) return
  tabsStore.createTableTab(connectionId.value, tableName, database.value)
}

onMounted(() => {
  loadSchema()
})

watch(connectionId, () => {
  isLoaded.value = false
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
      :tab-id="props.tabId"
      @table-click="handleTableClick"
      class="flex-1"
    />
  </div>
</template>
