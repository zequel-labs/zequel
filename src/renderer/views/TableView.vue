<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import { useLayoutStore } from '@/stores/layout'
import { DatabaseType } from '@/types/connection'
import { useStatusBarStore } from '@/stores/statusBar'
import type { DataResult, DataFilter, ForeignKey } from '@/types/table'
import type { CellChange } from '@/types/query'
import { toast } from 'vue-sonner'
import { IconLoader2 } from '@tabler/icons-vue'
import { isDateValue, formatDateTime } from '@/lib/date'
import DataGrid from '@/components/grid/DataGrid.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'
import TableStructure from '@/components/table/TableStructure.vue'
import ExportDialog, { type ExportDialogData } from '@/components/dialogs/ExportDialog.vue'
import { ExportMode } from '@/types/table'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()
const layoutStore = useLayoutStore()
const statusBarStore = useStatusBarStore()

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
const filters = ref<DataFilter[]>([])

const activeConnectionType = computed(() => {
  const conn = connectionsStore.connections.find(c => c.id === tabData.value?.connectionId)
  return conn?.type ?? null
})
const isMongoDB = computed(() => activeConnectionType.value === DatabaseType.MongoDB)
const isRedis = computed(() => activeConnectionType.value === DatabaseType.Redis)
const isClickHouse = computed(() => activeConnectionType.value === DatabaseType.ClickHouse)
const supportsForeignKeys = computed(() => {
  return [DatabaseType.PostgreSQL, DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.SQLite, DatabaseType.DuckDB, DatabaseType.SQLServer].includes(activeConnectionType.value as DatabaseType)
})
const readOnlyColumns = computed(() => {
  if (isMongoDB.value) return ['_id']
  if (isRedis.value) return ['key', 'type']
  return []
})

// Foreign key metadata for FK navigation
const foreignKeys = ref<ForeignKey[]>([])

const loadForeignKeys = async () => {
  if (!tabData.value || !supportsForeignKeys.value) return
  try {
    foreignKeys.value = await window.api.schema.foreignKeys(
      tabData.value.connectionId,
      tabData.value.tableName
    )
  } catch {
    foreignKeys.value = []
  }
}

// Quote a SQL identifier with the correct character for the active database
const quoteId = (name: string): string => {
  const conn = connectionsStore.connections.find(c => c.id === tabData.value?.connectionId)
  if (conn?.type === DatabaseType.MySQL || conn?.type === DatabaseType.MariaDB || conn?.type === DatabaseType.ClickHouse) {
    return `\`${name}\``
  }
  if (conn?.type === DatabaseType.SQLServer) {
    return `[${name}]`
  }
  return `"${name}"`
}

// Find primary key columns for UPDATE queries
const primaryKeyColumns = computed(() => {
  if (!dataResult.value) return []
  return dataResult.value.columns.filter(col => col.primaryKey).map(col => col.name)
})

// Export dialog state
const showExportDialog = ref(false)
const exportDialogData = ref<ExportDialogData | null>(null)

// DataGrid ref for column visibility
const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)
const structureRef = ref<InstanceType<typeof TableStructure> | null>(null)

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

const loadData = async (skipCount = false) => {
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
        filters: plainFilters,
        knownTotalCount: skipCount ? dataResult.value?.totalCount : undefined
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
  statusBarStore.activeFiltersCount = filters.value.length
  statusBarStore.columns = columnVisibilityItems.value
  statusBarStore.showGridControls = true
}

const setupStatusBar = () => {
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showGridControls = true
  statusBarStore.viewTabs = ['data', 'structure']
  statusBarStore.activeView = activeView.value
  statusBarStore.registerCallbacks({
    onPageChange: handlePageChange,
    onToggleColumn: handleToggleColumn,
    onShowAllColumns: handleShowAllColumns,
    onApplySettings: (newLimit: number, newOffset: number) => {
      settingsStore.updateGridSettings({ pageSize: newLimit })
      offset.value = newOffset
      loadData(true)
    },
    onViewChange: (view: string) => {
      const prev = activeView.value
      activeView.value = view as 'data' | 'structure'
      if (view !== prev) {
        if (view === 'data') {
          loadData()
        } else if (view === 'structure') {
          structureRef.value?.reload()
        }
      }
    },
    onAddRow: () => {
      if (settingsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
      dataGridRef.value?.addNewRow()
    },
    onExportData: () => {
      if (!dataResult.value || !tabData.value) return
      exportDialogData.value = {
        title: `Export ${tabData.value.tableName}`,
        tableName: tabData.value.tableName,
        mode: ExportMode.InMemory,
        columns: dataResult.value.columns.map(c => ({ name: c.name, type: c.type })),
        rows: dataResult.value.rows
      }
      showExportDialog.value = true
    }
  })
  statusBarStore.setDataCallbacks({
    onApply: () => {
      if (settingsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
      dataGridRef.value?.applyChanges()
    },
    onDiscard: () => {
      dataGridRef.value?.discardChanges()
    }
  })
}

const handleNavigateFk = (fk: ForeignKey, value: unknown) => {
  if (!tabData.value) return
  const filter: DataFilter = { column: fk.referencedColumn, operator: '=', value }
  tabsStore.createTableTab(
    tabData.value.connectionId,
    fk.referencedTable,
    tabData.value.database,
    fk.referencedSchema || tabData.value.schema,
    [filter]
  )
}

const handleRefreshDataEvent = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  loadData()
}

onMounted(() => {
  setupStatusBar()

  // Consume initialFilters from tab data (applied once on first load)
  if (tabData.value?.initialFilters?.length) {
    filters.value = tabData.value.initialFilters
    statusBarStore.activeFiltersCount = filters.value.length
    // Clear from tab data so they don't re-apply on re-mount
    tabsStore.updateTabData(props.tabId, { initialFilters: undefined })
  }

  if (activeView.value === 'data') {
    loadData()
  }
  loadForeignKeys()
  window.addEventListener('zequel:refresh-data', handleRefreshDataEvent)
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
  window.removeEventListener('zequel:refresh-data', handleRefreshDataEvent)
})

// Sync data grid changes count to status bar
watch(() => dataGridRef.value?.changesCount, (count) => {
  statusBarStore.dataChangesCount = count ?? 0
})

// Sync right panel columns when data result changes
watch(dataResult, (newResult) => {
  if (tabsStore.activeTabId !== props.tabId) return
  if (newResult) {
    layoutStore.setRightPanelColumns(newResult.columns, handlePanelUpdateCell)
  }
})

// Re-sync statusBar and right panel when this tab becomes active (fixes bug
// where callbacks point to a different tab after switching between tabs)
watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
    if (dataResult.value) {
      syncStatusBar()
      layoutStore.setRightPanelColumns(dataResult.value.columns, handlePanelUpdateCell)
    }
  }
})

watch(activeView, (view) => {
  statusBarStore.activeView = view
  if (view === 'data' && !dataResult.value) {
    loadData()
  }
})

const handlePageChange = (newOffset: number) => {
  offset.value = newOffset
  loadData(true)
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
  const pendingChanges = dataGridRef.value?.pendingChanges
  layoutStore.setRightPanelRow(row, rowIndex, pendingChanges)
}

const handlePanelUpdateCell = (change: CellChange) => {
  if (settingsStore.safeMode || !dataGridRef.value) return
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

const handleExportPage = () => {
  if (!dataResult.value || !tabData.value) return

  exportDialogData.value = {
    title: `Export current page — ${tabData.value.tableName}`,
    tableName: tabData.value.tableName,
    mode: ExportMode.InMemory,
    columns: dataResult.value.columns.map(c => ({ name: c.name, type: c.type })),
    rows: dataResult.value.rows
  }
  showExportDialog.value = true
}

const handlePasteRows = async () => {
  if (settingsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
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

    const connection = connectionsStore.activeConnection
    const isMongo = connection?.type === DatabaseType.MongoDB

    for (const line of dataLines) {
      if (!line.trim()) continue
      const values = isTsv ? line.split('\t') : parseCsvLine(line)

      if (isMongo) {
        const rowValues: Record<string, unknown> = {}
        for (const col of matchedColumns) {
          const idx = headers.indexOf(col)
          const val = idx >= 0 ? values[idx] : null
          rowValues[col] = val === '' || val === 'NULL' ? null : val
        }
        const result = await window.api.schema.insertRow(tabData.value!.connectionId, {
          table: tabData.value!.tableName,
          values: rowValues
        })
        if (!result.success) throw new Error(result.error || 'Failed to insert row')
      } else {
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
  if (settingsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
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

    const connection = connectionsStore.activeConnection
    const isMongo = connection?.type === DatabaseType.MongoDB

    for (const row of rows) {
      // Include all columns present in the imported data
      const cols = dataResult.value.columns.filter(c => row[c.name] !== undefined)
      if (cols.length === 0) continue

      if (isMongo) {
        const values: Record<string, unknown> = {}
        for (const c of cols) {
          values[c.name] = row[c.name] ?? null
        }
        const result = await window.api.schema.insertRow(tabData.value!.connectionId, {
          table: tabData.value!.tableName,
          values
        })
        if (!result.success) throw new Error(result.error || 'Failed to insert row')
      } else {
        const colNames = cols.map(c => quoteId(c.name)).join(', ')
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map(c => row[c.name] ?? null)

        const sql = `INSERT INTO ${quoteId(tabData.value!.tableName)} (${colNames}) VALUES (${placeholders})`
        const result = await window.api.query.execute(tabData.value!.connectionId, sql, values)
        if (result.error) throw new Error(result.error)
      }
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

// Build MongoDB primary key filter from a row (prefers _id, falls back to all non-null fields)
const buildMongoPkValues = (row: Record<string, unknown>): Record<string, unknown> => {
  if (row._id !== undefined && row._id !== null) {
    return { _id: row._id }
  }
  const pkValues: Record<string, unknown> = {}
  if (dataResult.value) {
    for (const col of dataResult.value.columns) {
      if (row[col.name] !== null && row[col.name] !== undefined) {
        pkValues[col.name] = row[col.name]
      }
    }
  }
  return pkValues
}

const handleApplyChangesMongo = async (payload: ApplyChangesPayload) => {
  if (!tabData.value || !dataResult.value) return

  const { edits, newRows, deleteRowIndices } = payload
  const connId = tabData.value.connectionId
  const table = tabData.value.tableName

  // 1. Deletes
  for (const rowIndex of deleteRowIndices) {
    const row = dataResult.value.rows[rowIndex]
    if (!row) continue
    const result = await window.api.schema.deleteRow(connId, {
      table,
      primaryKeyValues: buildMongoPkValues(row)
    })
    if (!result.success) throw new Error(result.error || 'Failed to delete row')
  }

  // 2. Updates
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

      const values: Record<string, unknown> = {}
      for (const change of rowChanges) {
        if (change.column) {
          values[change.column] = change.newValue
        }
      }
      if (Object.keys(values).length === 0) continue

      const result = await window.api.schema.updateRow(connId, {
        table,
        primaryKeyValues: buildMongoPkValues(row),
        values
      })
      if (!result.success) throw new Error(result.error || 'Failed to update row')
    }
  }

  // 3. Inserts
  for (const newRow of newRows) {
    const values: Record<string, unknown> = {}
    for (const col of dataResult.value.columns) {
      if (newRow[col.name] !== undefined && newRow[col.name] !== null) {
        values[col.name] = newRow[col.name]
      }
    }
    if (Object.keys(values).length === 0) continue
    const result = await window.api.schema.insertRow(connId, { table, values })
    if (!result.success) throw new Error(result.error || 'Failed to insert row')
  }
}

const handleApplyChangesRedis = async (payload: ApplyChangesPayload) => {
  if (!tabData.value || !dataResult.value) return

  const { edits, newRows, deleteRowIndices } = payload
  const connId = tabData.value.connectionId
  const table = tabData.value.tableName

  // 1. Deletes
  for (const rowIndex of deleteRowIndices) {
    const row = dataResult.value.rows[rowIndex]
    if (!row) continue
    const result = await window.api.schema.deleteRow(connId, {
      table,
      primaryKeyValues: { key: row['key'] }
    })
    if (!result.success) throw new Error(result.error || 'Failed to delete key')
  }

  // 2. Updates
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

      const values: Record<string, unknown> = {}
      for (const change of rowChanges) {
        if (change.column) {
          values[change.column] = change.newValue
        }
      }
      if (Object.keys(values).length === 0) continue

      const result = await window.api.schema.updateRow(connId, {
        table,
        primaryKeyValues: { key: row['key'] },
        values
      })
      if (!result.success) throw new Error(result.error || 'Failed to update key')
    }
  }

  // 3. Inserts
  for (const newRow of newRows) {
    const values: Record<string, unknown> = {}
    for (const col of dataResult.value.columns) {
      if (newRow[col.name] !== undefined && newRow[col.name] !== null) {
        values[col.name] = newRow[col.name]
      }
    }
    if (Object.keys(values).length === 0) continue
    const result = await window.api.schema.insertRow(connId, { table, values })
    if (!result.success) throw new Error(result.error || 'Failed to insert key')
  }
}

const handleApplyChanges = async (payload: ApplyChangesPayload) => {
  if (settingsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!tabData.value || !dataResult.value) return

  const { edits, newRows, deleteRowIndices } = payload
  if (edits.length === 0 && newRows.length === 0 && deleteRowIndices.length === 0) return

  isSaving.value = true
  error.value = null

  try {
    const connection = connectionsStore.activeConnection
    if (!connection) throw new Error('No active connection')

    if (connection.type === DatabaseType.MongoDB) {
      await handleApplyChangesMongo(payload)
    } else if (connection.type === DatabaseType.Redis) {
      await handleApplyChangesRedis(payload)
      // Refresh sidebar keys list so new/deleted keys appear
      const connId = tabData.value.connectionId
      const db = connectionsStore.getActiveDatabase(connId)
      await connectionsStore.loadTables(connId, db)
    } else {
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

          const tableName = quoteId(tabData.value.tableName)
          const sql = isClickHouse.value
            ? `ALTER TABLE ${tableName} UPDATE ${setClauses.join(', ')} WHERE ${whereClause}`
            : `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClause}`
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
          const sql = (isMySQL || isClickHouse.value)
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
  <div data-testid="table-view" class="flex flex-col h-full">
    <!-- Data View -->
    <template v-if="activeView === 'data'">
      <!-- Filter Panel -->
      <FilterPanel
        v-if="dataResult"
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
        v-else-if="error && !dataResult"
        data-testid="table-error"
        class="flex-1 flex items-center justify-center text-destructive text-sm"
      >
        {{ error }}
      </div>

      <!-- Data Grid -->
      <div v-if="dataResult" class="flex-1 overflow-hidden">
        <DataGrid
          ref="dataGridRef"
          :columns="dataResult.columns"
          :rows="dataResult.rows"
          :editable="!settingsStore.safeMode"
          :read-only-columns="readOnlyColumns"
          :table-name="tabData?.tableName"
          :foreign-keys="foreignKeys"
          @apply-changes="handleApplyChanges"
          @row-activate="handleRowActivate"
          @refresh="handleRefresh"
          @export-page="handleExportPage"
          @paste-rows="handlePasteRows"
          @import="handleImport"
          @navigate-fk="handleNavigateFk"
        />
      </div>
    </template>

    <!-- Structure View -->
    <TableStructure
      ref="structureRef"
      v-else-if="activeView === 'structure' && tabData"
      :table-name="tabData.tableName"
      :connection-id="tabData.connectionId"
      :database="tabData.database || (tabData.connectionId ? connectionsStore.getActiveDatabase(tabData.connectionId) : '')"
      class="flex-1"
    />

    <!-- Export Dialog -->
    <ExportDialog
      :open="showExportDialog"
      :data="exportDialogData"
      @update:open="showExportDialog = $event"
    />
  </div>
</template>
