<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { useStatusBarStore } from '@/stores/statusBar'
import type { DataResult, DataFilter } from '@/types/table'
import type { ColumnInfo, CellChange } from '@/types/query'
import { toast } from 'vue-sonner'
import { IconLoader2 } from '@tabler/icons-vue'
import { isDateValue, formatDateTime } from '@/lib/date'
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


// Quote a SQL identifier with the correct character for the active database
const quoteId = (name: string): string => {
  const conn = connectionsStore.connections.find(c => c.id === tabData.value?.connectionId)
  if (conn?.type === DatabaseType.MySQL || conn?.type === DatabaseType.MariaDB) {
    return `\`${name}\``
  }
  return `"${name}"`
}

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

const handleToggleColumn = (columnId: string) => {
  dataGridRef.value?.toggleColumnVisibility(columnId)
  // Defer to let DataGrid update its internal state
  setTimeout(() => {
    statusBarStore.columns = columnVisibilityItems.value
  }, 0)
}

const handleShowAllColumns = () => {
  dataGridRef.value?.showAllColumns()
  setTimeout(() => {
    statusBarStore.columns = columnVisibilityItems.value
  }, 0)
}

const loadData = async () => {
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
const syncStatusBar = () => {
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

const setupStatusBar = () => {
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

const handlePageChange = (newOffset: number) => {
  offset.value = newOffset
  loadData()
}

const handleToggleFilters = () => {
  showFilters.value = !showFilters.value
  statusBarStore.showFilters = showFilters.value
}

const handleUpdateFilters = (newFilters: DataFilter[]) => {
  filters.value = newFilters
  statusBarStore.activeFiltersCount = newFilters.length
}

const handleApplyFilters = () => {
  offset.value = 0 // Reset to first page when applying filters
  loadData()
}

const handleClearFilters = () => {
  filters.value = []
  offset.value = 0
  statusBarStore.activeFiltersCount = 0
  loadData()
}

const handleRowActivate = (row: Record<string, unknown>, rowIndex: number) => {
  if (!rightPanelData) return
  rightPanelData.row = row
  rightPanelData.rowIndex = rowIndex
  if (dataGridRef.value) {
    rightPanelData.pendingChanges = dataGridRef.value.pendingChanges
  }
}

const handlePanelUpdateCell = (change: CellChange) => {
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

// Parse a CSV line respecting quoted fields (handles commas and quotes inside values)
const parseCsvLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

const handleRefresh = () => {
  loadData()
}

const handleExportPage = async () => {
  if (!dataResult.value) return

  try {
    const headers = dataResult.value.columns.map(c => `"${c.name}"`).join(',')
    const lines = dataResult.value.rows.map(row => {
      return dataResult.value!.columns.map(c => {
        const v = row[c.name]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    })
    const csv = [headers, ...lines].join('\n')
    await navigator.clipboard.writeText(csv)
    toast.success('Page data copied to clipboard as CSV')
  } catch (e) {
    toast.error('Failed to export page data')
  }
}

const handlePasteRows = async () => {
  if (!tabData.value || !dataResult.value) return

  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) {
      toast.error('Clipboard is empty')
      return
    }

    isLoading.value = true
    error.value = null

    // Parse tab-separated or CSV data
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      toast.error('Clipboard data must contain a header row and at least one data row')
      isLoading.value = false
      return
    }

    const isTsv = lines[0].includes('\t')
    const headers = isTsv
      ? lines[0].split('\t').map(h => h.trim())
      : parseCsvLine(lines[0]).map(h => h.trim())
    const dataLines = lines.slice(1)

    // Match clipboard headers to table columns
    const matchedColumns = headers.filter(h =>
      dataResult.value!.columns.some(c => c.name === h)
    )

    if (matchedColumns.length === 0) {
      toast.error('No matching columns found in clipboard data')
      isLoading.value = false
      return
    }

    for (const line of dataLines) {
      if (!line.trim()) continue
      const values = isTsv ? line.split('\t') : parseCsvLine(line)
      const colNames = matchedColumns.map(c => quoteId(c)).join(', ')
      const placeholders = matchedColumns.map(() => '?').join(', ')
      const rowValues = matchedColumns.map(col => {
        const idx = headers.indexOf(col)
        const val = idx >= 0 ? values[idx] : null
        return val === '' || val === 'NULL' ? null : val
      })

      const sql = `INSERT INTO ${quoteId(tabData.value!.tableName)} (${colNames}) VALUES (${placeholders})`
      const result = await window.api.query.execute(tabData.value!.connectionId, sql, rowValues)
      if (result.error) throw new Error(result.error)
    }

    toast.success(`${dataLines.filter(l => l.trim()).length} row(s) pasted`)
    await loadData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to paste rows'
    toast.error(error.value)
  } finally {
    isLoading.value = false
  }
}

const handleImport = async (format: 'csv' | 'json') => {
  // For now, read from clipboard based on format
  if (!tabData.value || !dataResult.value) return

  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) {
      toast.error('Clipboard is empty')
      return
    }

    isLoading.value = true
    error.value = null

    let rows: Record<string, unknown>[] = []

    if (format === 'json') {
      const parsed = JSON.parse(text)
      rows = Array.isArray(parsed) ? parsed : [parsed]
    } else {
      // CSV parsing
      const lines = text.trim().split('\n')
      if (lines.length < 2) {
        toast.error('CSV data must contain a header row and data rows')
        isLoading.value = false
        return
      }
      const headers = parseCsvLine(lines[0]).map(h => h.trim())
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue
        const values = parseCsvLine(lines[i])
        const row: Record<string, unknown> = {}
        headers.forEach((h, idx) => {
          const v = idx < values.length ? values[idx] : ''
          row[h] = v === '' || v === 'NULL' ? null : v
        })
        rows.push(row)
      }
    }

    for (const row of rows) {
      // Include all columns present in the imported data
      const cols = dataResult.value.columns.filter(c => row[c.name] !== undefined)
      if (cols.length === 0) continue

      const colNames = cols.map(c => quoteId(c.name)).join(', ')
      const placeholders = cols.map(() => '?').join(', ')
      const values = cols.map(c => row[c.name] ?? null)

      const sql = `INSERT INTO ${quoteId(tabData.value!.tableName)} (${colNames}) VALUES (${placeholders})`
      const result = await window.api.query.execute(tabData.value!.connectionId, sql, values)
      if (result.error) throw new Error(result.error)
    }

    toast.success(`${rows.length} row(s) imported from ${format.toUpperCase()}`)
    await loadData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : `Failed to import ${format.toUpperCase()}`
    toast.error(error.value)
  } finally {
    isLoading.value = false
  }
}

// Serialize JS values for SQL parameters (e.g. Date → 'YYYY-MM-DD HH:mm:ss')
const sqlValue = (v: unknown): unknown => {
  if (isDateValue(v)) return formatDateTime(v)
  return v
}

interface ApplyChangesPayload {
  edits: CellChange[]
  newRows: Record<string, unknown>[]
  deleteRowIndices: number[]
}

const handleApplyChanges = async (payload: ApplyChangesPayload) => {
  if (!tabData.value || !dataResult.value) return

  const { edits, newRows, deleteRowIndices } = payload
  if (edits.length === 0 && newRows.length === 0 && deleteRowIndices.length === 0) return

  isSaving.value = true
  error.value = null

  try {
    const connection = connectionsStore.activeConnection
    if (!connection) throw new Error('No active connection')

    const isMySQL = connection.type === DatabaseType.MySQL || connection.type === DatabaseType.MariaDB

    // 1. Execute DELETEs first
    for (const rowIndex of deleteRowIndices) {
      const row = dataResult.value.rows[rowIndex]
      if (!row) continue

      let whereClause: string
      let whereValues: unknown[]

      if (primaryKeyColumns.value.length > 0) {
        whereClause = primaryKeyColumns.value
          .map(pk => `${quoteId(pk)} = ?`)
          .join(' AND ')
        whereValues = primaryKeyColumns.value.map(pk => sqlValue(row[pk]))
      } else {
        const conditions: string[] = []
        const values: unknown[] = []
        for (const col of dataResult.value.columns) {
          if (row[col.name] === null) {
            conditions.push(`${quoteId(col.name)} IS NULL`)
          } else {
            conditions.push(`${quoteId(col.name)} = ?`)
            values.push(sqlValue(row[col.name]))
          }
        }
        whereClause = conditions.join(' AND ')
        whereValues = values
      }

      const sql = `DELETE FROM ${quoteId(tabData.value.tableName)} WHERE ${whereClause}`
      const result = await window.api.query.execute(tabData.value.connectionId, sql, whereValues)
      if (result.error) throw new Error(result.error)
    }

    // 2. Execute UPDATEs
    if (edits.length > 0) {
      const changesByRow = new Map<number, CellChange[]>()
      for (const change of edits) {
        if (!change.column || change.column === '_rowNumber') continue
        const existing = changesByRow.get(change.rowIndex) || []
        existing.push(change)
        changesByRow.set(change.rowIndex, existing)
      }

      for (const [rowIndex, rowChanges] of changesByRow) {
        const row = dataResult.value.rows[rowIndex]
        if (!row || rowChanges.length === 0) continue

        const setClauses: string[] = []
        const values: unknown[] = []
        for (const change of rowChanges) {
          if (change.column) {
            setClauses.push(`${quoteId(change.column)} = ?`)
            values.push(sqlValue(change.newValue))
          }
        }

        if (setClauses.length === 0) continue

        let whereClause: string
        let whereValues: unknown[]

        if (primaryKeyColumns.value.length > 0) {
          whereClause = primaryKeyColumns.value
            .map(pk => `${quoteId(pk)} = ?`)
            .join(' AND ')
          whereValues = primaryKeyColumns.value.map(pk => sqlValue(row[pk]))
        } else {
          const originalConditions: string[] = []
          const originalValues: unknown[] = []

          for (const change of rowChanges) {
            if (change.originalValue === null) {
              originalConditions.push(`${quoteId(change.column)} IS NULL`)
            } else {
              originalConditions.push(`${quoteId(change.column)} = ?`)
              originalValues.push(sqlValue(change.originalValue))
            }
          }
          for (const col of dataResult.value.columns) {
            if (!rowChanges.find(c => c.column === col.name)) {
              if (row[col.name] === null) {
                originalConditions.push(`${quoteId(col.name)} IS NULL`)
              } else {
                originalConditions.push(`${quoteId(col.name)} = ?`)
                originalValues.push(sqlValue(row[col.name]))
              }
            }
          }
          whereClause = originalConditions.join(' AND ')
          whereValues = originalValues
        }

        const sql = `UPDATE ${quoteId(tabData.value.tableName)} SET ${setClauses.join(', ')} WHERE ${whereClause}`
        const allValues = [...values, ...whereValues]
        const result = await window.api.query.execute(tabData.value.connectionId, sql, allValues)
        if (result.error) throw new Error(result.error)
      }
    }

    // 3. Execute INSERTs for new rows
    for (const newRow of newRows) {
      // Skip auto-increment PK columns — the DB generates those
      const cols = dataResult.value.columns.filter(c => !(c.primaryKey && c.autoIncrement))
      // Only include columns where the user set a value
      const insertCols = cols.filter(c => newRow[c.name] !== undefined && newRow[c.name] !== null)

      if (insertCols.length === 0) {
        // No values — insert with defaults
        const sql = isMySQL
          ? `INSERT INTO ${quoteId(tabData.value.tableName)} () VALUES ()`
          : `INSERT INTO ${quoteId(tabData.value.tableName)} DEFAULT VALUES`
        const result = await window.api.query.execute(tabData.value.connectionId, sql, [])
        if (result.error) throw new Error(result.error)
      } else {
        const colNames = insertCols.map(c => quoteId(c.name)).join(', ')
        const placeholders = insertCols.map(() => '?').join(', ')
        const values = insertCols.map(c => sqlValue(newRow[c.name] ?? null))

        const sql = `INSERT INTO ${quoteId(tabData.value.tableName)} (${colNames}) VALUES (${placeholders})`
        const result = await window.api.query.execute(tabData.value.connectionId, sql, values)
        if (result.error) throw new Error(result.error)
      }
    }

    // Summarize what was done
    const parts: string[] = []
    if (deleteRowIndices.length > 0) parts.push(`${deleteRowIndices.length} deleted`)
    if (edits.length > 0) parts.push(`${new Set(edits.map(e => e.rowIndex)).size} updated`)
    if (newRows.length > 0) parts.push(`${newRows.length} inserted`)

    await loadData()
    toast.success(`Changes applied: ${parts.join(', ')}`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to apply changes'
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

      <!-- Data Grid -->
      <div v-if="dataResult" class="flex-1 overflow-hidden">
        <DataGrid
          ref="dataGridRef"
          :columns="dataResult.columns"
          :rows="dataResult.rows"
          :editable="true"
          :table-name="tabData?.tableName"
          @apply-changes="handleApplyChanges"
          @row-activate="handleRowActivate"
          @refresh="handleRefresh"
          @export-page="handleExportPage"
          @paste-rows="handlePasteRows"
          @import="handleImport"
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
