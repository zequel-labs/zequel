<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import type { DataResult, DataFilter, ColumnInfo } from '@/types/table'
import type { CellChange } from '@/types/query'
import type { ExportFormat, ImportFormat } from '@/components/grid/GridToolbar.vue'
import { toast } from 'vue-sonner'
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

// Export helper functions
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function generateCsv(columns: ColumnInfo[], rows: Record<string, unknown>[]): string {
  const header = columns.map(col => escapeCsvValue(col.name)).join(',')
  const dataRows = rows.map(row =>
    columns.map(col => escapeCsvValue(row[col.name])).join(',')
  )
  return [header, ...dataRows].join('\n')
}

function generateJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, null, 2)
}

function escapeIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

function escapeSqlValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  const str = String(value)
  return `'${str.replace(/'/g, "''")}'`
}

function generateSql(tableName: string, columns: ColumnInfo[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return `-- No data to export from ${tableName}`

  const columnNames = columns.map(col => escapeIdentifier(col.name)).join(', ')
  const statements = rows.map(row => {
    const values = columns.map(col => escapeSqlValue(row[col.name])).join(', ')
    return `INSERT INTO ${escapeIdentifier(tableName)} (${columnNames}) VALUES (${values});`
  })

  return `-- Export from table: ${tableName}\n-- Rows: ${rows.length}\n\n${statements.join('\n')}`
}

async function handleExport(format: ExportFormat) {
  if (!tabData.value || !dataResult.value) return

  const tableName = tabData.value.tableName

  // Define file filters based on format
  const fileFilters: { name: string; extensions: string[] }[] = {
    csv: [{ name: 'CSV Files', extensions: ['csv'] }],
    json: [{ name: 'JSON Files', extensions: ['json'] }],
    sql: [{ name: 'SQL Files', extensions: ['sql'] }]
  }[format]

  const defaultName = `${tableName}.${format}`

  // Show save dialog
  const dialogResult = await window.api.app.showSaveDialog({
    title: `Export as ${format.toUpperCase()}`,
    defaultPath: defaultName,
    filters: fileFilters
  })

  if (dialogResult.canceled || !dialogResult.filePath) return

  try {
    isLoading.value = true

    // Load all data for export (respecting current filters)
    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    // Fetch all rows (up to a reasonable limit)
    const allData = await window.api.schema.tableData(
      tabData.value.connectionId,
      tableName,
      {
        offset: 0,
        limit: 100000, // Max 100k rows for export
        filters: plainFilters
      }
    )

    // Generate content based on format
    let content: string
    switch (format) {
      case 'csv':
        content = generateCsv(allData.columns, allData.rows)
        break
      case 'json':
        content = generateJson(allData.rows)
        break
      case 'sql':
        content = generateSql(tableName, allData.columns, allData.rows)
        break
    }

    // Write file
    await window.api.app.writeFile(dialogResult.filePath, content)

  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to export data'
  } finally {
    isLoading.value = false
  }
}

// Import helper functions
function parseCsv(content: string): Record<string, unknown>[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  // Parse header
  const headers = parseCsvLine(lines[0])

  // Parse data rows
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      let value: unknown = values[index] ?? null
      // Try to parse numbers
      if (value !== null && value !== '' && !isNaN(Number(value))) {
        value = Number(value)
      }
      row[header] = value === '' ? null : value
    })
    rows.push(row)
  }
  return rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++ // Skip next quote
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

function parseJson(content: string): Record<string, unknown>[] {
  const data = JSON.parse(content)
  if (Array.isArray(data)) {
    return data
  }
  throw new Error('JSON must be an array of objects')
}

async function handleImport(format: ImportFormat) {
  if (!tabData.value || !dataResult.value) return

  const tableName = tabData.value.tableName
  const columns = dataResult.value.columns

  // Define file filters based on format
  const fileFilters: { name: string; extensions: string[] }[] = {
    csv: [{ name: 'CSV Files', extensions: ['csv'] }],
    json: [{ name: 'JSON Files', extensions: ['json'] }],
    sql: [{ name: 'SQL Files', extensions: ['sql'] }]
  }[format]

  // Show open dialog
  const dialogResult = await window.api.app.showOpenDialog({
    title: `Import ${format.toUpperCase()}`,
    filters: fileFilters,
    properties: ['openFile']
  })

  if (dialogResult.canceled || !dialogResult.filePaths[0]) return

  try {
    isLoading.value = true
    error.value = null

    // Read file content
    const content = await window.api.app.readFile(dialogResult.filePaths[0])

    let rows: Record<string, unknown>[]

    // Parse content based on format
    switch (format) {
      case 'csv':
        rows = parseCsv(content)
        break
      case 'json':
        rows = parseJson(content)
        break
      case 'sql':
        // For SQL, we execute the statements directly
        const result = await window.api.query.execute(tabData.value.connectionId, content)
        if (result.error) {
          throw new Error(result.error)
        }
        toast.success(`SQL executed successfully. ${result.rowsAffected ?? 0} rows affected.`)
        await loadData()
        return
    }

    if (rows.length === 0) {
      toast.warning('No data to import')
      return
    }

    // Get column names that exist in the table
    const tableColumnNames = columns.map(c => c.name)
    const importColumnNames = Object.keys(rows[0]).filter(name => tableColumnNames.includes(name))

    if (importColumnNames.length === 0) {
      throw new Error('No matching columns found between import file and table')
    }

    // Insert rows
    let successCount = 0
    let errorCount = 0

    for (const row of rows) {
      try {
        const columnList = importColumnNames.map(escapeIdentifier).join(', ')
        const values = importColumnNames.map(col => {
          const value = row[col]
          if (value === null || value === undefined) return 'NULL'
          if (typeof value === 'number') return String(value)
          if (typeof value === 'boolean') return value ? '1' : '0'
          return `'${String(value).replace(/'/g, "''")}'`
        }).join(', ')

        const sql = `INSERT INTO ${escapeIdentifier(tableName)} (${columnList}) VALUES (${values})`
        const result = await window.api.query.execute(tabData.value.connectionId, sql)

        if (result.error) {
          errorCount++
        } else {
          successCount++
        }
      } catch {
        errorCount++
      }
    }

    // Reload data
    await loadData()

    if (errorCount > 0) {
      toast.warning(`Imported ${successCount} rows with ${errorCount} errors`)
    } else {
      toast.success(`Successfully imported ${successCount} rows`)
    }

  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to import data'
    toast.error(error.value)
  } finally {
    isLoading.value = false
  }
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
        @import="handleImport"
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
      :database="tabData.database || connectionsStore.activeDatabases[0]?.name || ''"
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
