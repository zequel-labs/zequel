<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import type { DataResult, DataFilter } from '@/types/table'
import type { CellChange } from '@/types/query'
import { IconLoader2 } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'
import GridToolbar from '@/components/grid/GridToolbar.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'
import TableStructure from '@/components/table/TableStructure.vue'
import TableInfo from '@/components/table/TableInfo.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as TableTabData | undefined)

const activeView = computed({
  get: () => tabData.value?.activeView || 'data',
  set: (value) => tabsStore.setTableView(props.tabId, value)
})

const dataResult = ref<DataResult | null>(null)
const isLoading = ref(false)
const isSaving = ref(false)
const error = ref<string | null>(null)
const offset = ref(0)
const showFilters = ref(false)
const filters = ref<DataFilter[]>([])

// Find primary key columns for UPDATE queries
const primaryKeyColumns = computed(() => {
  if (!dataResult.value) return []
  return dataResult.value.columns.filter(col => col.primaryKey).map(col => col.name)
})

async function loadData() {
  if (!tabData.value) return

  isLoading.value = true
  error.value = null

  try {
    dataResult.value = await window.api.schema.tableData(
      tabData.value.connectionId,
      tabData.value.tableName,
      {
        offset: offset.value,
        limit: settingsStore.gridSettings.pageSize,
        filters: filters.value.length > 0 ? filters.value : undefined
      }
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (activeView.value === 'data') {
    loadData()
  }
})

watch(activeView, (view) => {
  if (view === 'data' && !dataResult.value) {
    loadData()
  }
})

function handlePageChange(newOffset: number) {
  offset.value = newOffset
  loadData()
}

function handleRefresh() {
  loadData()
}

function handleExport() {
  // TODO: Implement export functionality
  console.log('Export not implemented')
}

function handleToggleFilters() {
  showFilters.value = !showFilters.value
}

function handleUpdateFilters(newFilters: DataFilter[]) {
  filters.value = newFilters
}

function handleApplyFilters() {
  offset.value = 0 // Reset to first page when applying filters
  loadData()
}

function handleClearFilters() {
  filters.value = []
  offset.value = 0
  loadData()
}

async function handleApplyChanges(changes: CellChange[]) {
  if (!tabData.value || !dataResult.value || changes.length === 0) return

  isSaving.value = true
  error.value = null

  try {
    const connection = connectionsStore.activeConnection
    if (!connection) throw new Error('No active connection')

    // Group changes by row
    const changesByRow = new Map<number, CellChange[]>()
    for (const change of changes) {
      // Skip invalid changes
      if (!change.column || change.column === '_rowNumber') continue

      const existing = changesByRow.get(change.rowIndex) || []
      existing.push(change)
      changesByRow.set(change.rowIndex, existing)
    }

    // Execute UPDATE for each row
    for (const [rowIndex, rowChanges] of changesByRow) {
      const row = dataResult.value.rows[rowIndex]
      if (!row || rowChanges.length === 0) continue

      // Build SET clause
      const setClauses: string[] = []
      const values: unknown[] = []
      for (const change of rowChanges) {
        if (change.column) {
          setClauses.push(`"${change.column}" = ?`)
          values.push(change.newValue)
        }
      }

      if (setClauses.length === 0) continue

      // Build WHERE clause using primary keys or all original values
      let whereClause: string
      let whereValues: unknown[]

      if (primaryKeyColumns.value.length > 0) {
        // Use primary key(s)
        whereClause = primaryKeyColumns.value
          .map(pk => `"${pk}" = ?`)
          .join(' AND ')
        whereValues = primaryKeyColumns.value.map(pk => row[pk])
      } else {
        // Use all columns with original values (risky but necessary without PK)
        const originalConditions: string[] = []
        const originalValues: unknown[] = []

        for (const change of rowChanges) {
          if (change.originalValue === null) {
            originalConditions.push(`"${change.column}" IS NULL`)
          } else {
            originalConditions.push(`"${change.column}" = ?`)
            originalValues.push(change.originalValue)
          }
        }
        // Add other columns from the row for safety
        for (const col of dataResult.value.columns) {
          if (!rowChanges.find(c => c.column === col.name)) {
            if (row[col.name] === null) {
              originalConditions.push(`"${col.name}" IS NULL`)
            } else {
              originalConditions.push(`"${col.name}" = ?`)
              originalValues.push(row[col.name])
            }
          }
        }
        whereClause = originalConditions.join(' AND ')
        whereValues = originalValues
      }

      const sql = `UPDATE "${tabData.value.tableName}" SET ${setClauses.join(', ')} WHERE ${whereClause}`
      const allValues = [...values, ...whereValues]

      const result = await window.api.query.execute(tabData.value.connectionId, sql, allValues)

      if (result.error) {
        throw new Error(result.error)
      }
    }

    // Reload data after successful updates
    await loadData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save changes'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- View Tabs -->
    <div class="flex items-center gap-1 px-4 py-2 border-b bg-muted/30">
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeView === 'data' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeView = 'data'"
      >
        Data
      </button>
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeView === 'structure' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeView = 'structure'"
      >
        Structure
      </button>
      <button
        :class="[
          'px-3 py-1.5 text-sm rounded-md transition-colors',
          activeView === 'ddl' ? 'bg-background shadow-sm' : 'hover:bg-muted'
        ]"
        @click="activeView = 'ddl'"
      >
        DDL
      </button>
    </div>

    <!-- Data View -->
    <template v-if="activeView === 'data'">
      <!-- Toolbar -->
      <GridToolbar
        v-if="dataResult"
        :total-count="dataResult.totalCount"
        :offset="dataResult.offset"
        :limit="dataResult.limit"
        :is-loading="isLoading || isSaving"
        :show-filters="showFilters"
        :active-filters-count="filters.length"
        @refresh="handleRefresh"
        @export="handleExport"
        @filter="handleToggleFilters"
        @page-change="handlePageChange"
      />

      <!-- Filter Panel -->
      <FilterPanel
        v-if="showFilters && dataResult"
        :columns="dataResult.columns"
        :filters="filters"
        @update:filters="handleUpdateFilters"
        @apply="handleApplyFilters"
        @clear="handleClearFilters"
      />

      <!-- Loading -->
      <div
        v-if="isLoading && !dataResult"
        class="flex-1 flex items-center justify-center"
      >
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="flex-1 p-4"
      >
        <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
          {{ error }}
        </div>
      </div>

      <!-- Data Grid -->
      <div v-else-if="dataResult" class="flex-1 overflow-hidden">
        <DataGrid
          :columns="dataResult.columns"
          :rows="dataResult.rows"
          :show-row-numbers="settingsStore.gridSettings.showRowNumbers"
          :editable="true"
          :table-name="tabData?.tableName"
          @apply-changes="handleApplyChanges"
        />
      </div>
    </template>

    <!-- Structure View -->
    <TableStructure
      v-else-if="activeView === 'structure' && tabData"
      :table-name="tabData.tableName"
      :connection-id="tabData.connectionId"
      class="flex-1"
    />

    <!-- DDL View -->
    <TableInfo
      v-else-if="activeView === 'ddl' && tabData"
      :table-name="tabData.tableName"
      :connection-id="tabData.connectionId"
      class="flex-1"
    />
  </div>
</template>
