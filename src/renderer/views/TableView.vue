<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import type { DataResult, DataFilter } from '@/types/table'
import type { ColumnInfo, CellChange } from '@/types/query'
import { toast } from 'vue-sonner'
import { IconLoader2 } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'
import TableStructure from '@/components/table/TableStructure.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as TableTabData | undefined)

const activeView = computed({
  get: () => tabData.value?.activeView || 'data',
  set: (value) => tabsStore.setTableView(props.tabId, value)
})

const rightPanelData = inject<{
  row: Record<string, unknown> | null
  columns: ColumnInfo[]
  rowIndex: number | null
  pendingChanges: Map<string, CellChange>
  onUpdateCell: ((change: CellChange) => void) | null
}>('rightPanelData')

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

// DataGrid ref for column visibility
const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)

// Column visibility items for toolbar
const columnVisibilityItems = computed(() => {
  if (!dataResult.value) return []
  const visibility = dataGridRef.value?.getColumnVisibility() || {}
  return dataResult.value.columns.map(col => ({
    id: col.name,
    name: col.name,
    visible: visibility[col.name] !== false
  }))
})

function handleToggleColumn(columnId: string) {
  dataGridRef.value?.toggleColumnVisibility(columnId)
  // Defer to let DataGrid update its internal state
  setTimeout(() => {
    statusBarStore.columns = columnVisibilityItems.value
  }, 0)
}

function handleShowAllColumns() {
  dataGridRef.value?.showAllColumns()
  setTimeout(() => {
    statusBarStore.columns = columnVisibilityItems.value
  }, 0)
}

async function loadData() {
  if (!tabData.value) return

  isLoading.value = true
  error.value = null

  try {
    // Convert reactive filters to plain objects to avoid IPC serialization issues
    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    dataResult.value = await window.api.schema.tableData(
      tabData.value.connectionId,
      tabData.value.tableName,
      {
        offset: offset.value,
        limit: settingsStore.gridSettings.pageSize,
        filters: plainFilters
      }
    )
    syncStatusBar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    isLoading.value = false
    statusBarStore.isLoading = false
  }
}

// StatusBar store integration
function syncStatusBar() {
  if (!dataResult.value) return
  statusBarStore.totalCount = dataResult.value.totalCount
  statusBarStore.offset = offset.value
  statusBarStore.limit = dataResult.value.limit
  statusBarStore.isLoading = isLoading.value
  statusBarStore.showFilters = showFilters.value
  statusBarStore.activeFiltersCount = filters.value.length
  statusBarStore.columns = columnVisibilityItems.value
  statusBarStore.showGridControls = true
}

function setupStatusBar() {
  statusBarStore.showGridControls = true
  statusBarStore.viewTabs = ['data', 'structure']
  statusBarStore.activeView = activeView.value
  statusBarStore.registerCallbacks({
    onPageChange: handlePageChange,
    onToggleFilters: handleToggleFilters,
    onToggleColumn: handleToggleColumn,
    onShowAllColumns: handleShowAllColumns,
    onApplySettings: (newLimit: number, newOffset: number) => {
      settingsStore.updateGridSettings({ pageSize: newLimit })
      offset.value = newOffset
      loadData()
    },
    onViewChange: (view: string) => {
      activeView.value = view as 'data' | 'structure'
    }
  })
}

onMounted(() => {
  setupStatusBar()
  if (activeView.value === 'data') {
    loadData()
  }
})

onUnmounted(() => {
  statusBarStore.clear()
  if (rightPanelData) {
    rightPanelData.row = null
    rightPanelData.columns = []
    rightPanelData.rowIndex = null
    rightPanelData.pendingChanges = new Map()
    rightPanelData.onUpdateCell = null
  }
})

// Sync right panel data when result changes
watch(dataResult, (newResult) => {
  if (!rightPanelData) return
  rightPanelData.columns = newResult?.columns || []
  rightPanelData.row = null
  rightPanelData.rowIndex = null
  rightPanelData.onUpdateCell = handlePanelUpdateCell
})

watch(activeView, (view) => {
  statusBarStore.activeView = view
  if (view === 'data' && !dataResult.value) {
    loadData()
  }
})

function handlePageChange(newOffset: number) {
  offset.value = newOffset
  loadData()
}

async function handleDuplicateRows(rows: Record<string, unknown>[]) {
  if (!tabData.value || !dataResult.value || rows.length === 0) return

  try {
    isLoading.value = true
    error.value = null

    for (const row of rows) {
      // Build INSERT from row data, excluding primary key columns
      const cols = dataResult.value.columns.filter(c => !c.primaryKey)
      const colNames = cols.map(c => `"${c.name}"`).join(', ')
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map(c => row[c.name] ?? null)

      const sql = `INSERT INTO "${tabData.value.tableName}" (${colNames}) VALUES (${placeholders})`
      const result = await window.api.query.execute(tabData.value.connectionId, sql, values)

      if (result.error) {
        throw new Error(result.error)
      }
    }

    toast.success(`${rows.length} row${rows.length > 1 ? 's' : ''} duplicated`)
    await loadData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to duplicate rows'
    toast.error(error.value)
  } finally {
    isLoading.value = false
  }
}

function handleToggleFilters() {
  showFilters.value = !showFilters.value
  statusBarStore.showFilters = showFilters.value
}

function handleUpdateFilters(newFilters: DataFilter[]) {
  filters.value = newFilters
  statusBarStore.activeFiltersCount = newFilters.length
}

function handleApplyFilters() {
  offset.value = 0 // Reset to first page when applying filters
  loadData()
}

function handleClearFilters() {
  filters.value = []
  offset.value = 0
  statusBarStore.activeFiltersCount = 0
  loadData()
}

function handleRowActivate(row: Record<string, unknown>, rowIndex: number) {
  if (!rightPanelData) return
  rightPanelData.row = row
  rightPanelData.rowIndex = rowIndex
  if (dataGridRef.value) {
    rightPanelData.pendingChanges = dataGridRef.value.pendingChanges
  }
}

function handlePanelUpdateCell(change: CellChange) {
  if (!dataGridRef.value) return
  const cellKey = `${change.rowIndex}-${change.column}`
  const existingChange = dataGridRef.value.pendingChanges.get(cellKey)
  const realOriginal = existingChange ? existingChange.originalValue : change.originalValue

  const formatValue = (v: unknown) => {
    if (v === null) return 'NULL'
    if (v === undefined) return ''
    return String(v)
  }

  if (formatValue(change.newValue) !== formatValue(realOriginal)) {
    dataGridRef.value.pendingChanges.set(cellKey, {
      rowIndex: change.rowIndex,
      column: change.column,
      originalValue: realOriginal,
      newValue: change.newValue
    })
  } else {
    dataGridRef.value.pendingChanges.delete(cellKey)
  }
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
    toast.success('Changes saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save changes'
    toast.error(error.value)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Data View -->
    <template v-if="activeView === 'data'">
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
          ref="dataGridRef"
          :columns="dataResult.columns"
          :rows="dataResult.rows"
          :editable="true"
          :show-selection="true"
          :table-name="tabData?.tableName"
          @apply-changes="handleApplyChanges"
          @duplicate-rows="handleDuplicateRows"
          @row-activate="handleRowActivate"
        />
      </div>
    </template>

    <!-- Structure View -->
    <TableStructure
      v-else-if="activeView === 'structure' && tabData"
      :table-name="tabData.tableName"
      :connection-id="tabData.connectionId"
      :database="tabData.database || connectionsStore.activeDatabases[0]?.name || ''"
      class="flex-1"
    />

  </div>
</template>
