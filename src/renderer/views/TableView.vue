<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch, nextTick } from 'vue'
import { useTabsStore, type TableTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import { useLayoutStore } from '@/stores/layout'
import { DatabaseType } from '@/types/connection'
import { useStatusBarStore } from '@/stores/statusBar'
import { usePendingChangesStore } from '@/stores/pendingChanges'
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
import { viewStateRegistry } from '@/stores/viewStateRegistry'
import type { TableViewState, DataGridState } from '@/types/viewState'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()
const layoutStore = useLayoutStore()
const statusBarStore = useStatusBarStore()
const pendingChangesStore = usePendingChangesStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as TableTabData | undefined)

// Snapshot of tab identity fields for use during unmount.
// When closeTab() removes the tab from the store, tabData.value becomes
// undefined BEFORE Vue unmounts this component, so onBeforeUnmount/onUnmounted
// can't read tabData.  We keep a plain copy that survives store removal.
type TabIdentity = Pick<TableTabData, 'connectionId' | 'tableName' | 'database' | 'schema'>
let tabDataSnapshot: TabIdentity | undefined
watch(tabData, (data) => {
  if (data) {
    tabDataSnapshot = {
      connectionId: data.connectionId,
      tableName: data.tableName,
      database: data.database,
      schema: data.schema
    }
  }
}, { immediate: true })

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
  if (!tabData.value?.connectionId) return null
  const conn = connectionsStore.getConnectionForSession(tabData.value.connectionId)
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
  const conn = tabData.value?.connectionId ? connectionsStore.getConnectionForSession(tabData.value.connectionId) : null
  if (conn?.type === DatabaseType.MySQL || conn?.type === DatabaseType.MariaDB || conn?.type === DatabaseType.ClickHouse) {
    return `\`${name.replace(/`/g, '``')}\``
  }
  if (conn?.type === DatabaseType.SQLServer) {
    return `[${name.replace(/]/g, ']]')}]`
  }
  return `"${name.replace(/"/g, '""')}"`
}

// Find primary key columns for UPDATE queries
const primaryKeyColumns = computed(() => {
  if (!dataResult.value) return []
  return dataResult.value.columns.filter(col => col.primaryKey).map(col => col.name)
})

// Pending changes restore flag
const isInitialLoad = ref(true)

// Export dialog state
const showExportDialog = ref(false)
const exportDialogData = ref<ExportDialogData | null>(null)

// DataGrid ref for column visibility
const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)
const structureRef = ref<InstanceType<typeof TableStructure> | null>(null)

// Cached grid state — preserved when switching from data → structure view
// so the collector can still report grid state even when DataGrid is unmounted.
let cachedGridState: DataGridState | undefined

// Register viewState collector for Move to New Window
viewStateRegistry.register(props.tabId, (): TableViewState | null => {
  // Use live grid state if DataGrid is mounted, otherwise use cached state
  const grid: DataGridState | undefined = dataGridRef.value?.table ? {
    sorting: [...dataGridRef.value.table.getState().sorting],
    columnSizing: { ...dataGridRef.value.table.getState().columnSizing },
    columnOrder: [...dataGridRef.value.table.getState().columnOrder],
    columnVisibility: { ...dataGridRef.value.table.getState().columnVisibility },
    pendingChanges: Array.from(dataGridRef.value.pendingChanges.entries()),
    pendingNewRows: [...dataGridRef.value.pendingNewRows],
    pendingDeleteRows: Array.from(dataGridRef.value.pendingDeleteRows)
  } : cachedGridState

  return {
    kind: 'table' as const,
    dataResult: dataResult.value,
    offset: offset.value,
    filters: [...filters.value],
    error: error.value,
    grid
  }
})

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

let loadGeneration = 0

const loadData = async (skipCount = false) => {
  if (!tabData.value) return

  const snapshotConnectionId = tabData.value.connectionId
  const snapshotTableName = tabData.value.tableName
  const currentGeneration = ++loadGeneration
  isLoading.value = true
  error.value = null

  try {
    // Convert reactive filters to plain objects to avoid IPC serialization issues
    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    const result = await window.api.schema.tableData(
      snapshotConnectionId,
      snapshotTableName,
      {
        offset: offset.value,
        limit: settingsStore.gridSettings.pageSize,
        filters: plainFilters,
        knownTotalCount: skipCount ? dataResult.value?.totalCount : undefined
      }
    )

    // Discard stale response if a newer loadData call was made
    if (currentGeneration !== loadGeneration) return

    dataResult.value = result
    syncStatusBar()
  } catch (e) {
    if (currentGeneration !== loadGeneration) return
    error.value = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    if (currentGeneration === loadGeneration) {
      isLoading.value = false
      statusBarStore.isLoading = false
    }
  }

  // After the initial load, restore any saved pending changes.
  // We await nextTick so that Vue flushes the DOM update and the DataGrid
  // (behind v-if="dataResult") is actually rendered and dataGridRef is set.
  if (isInitialLoad.value && dataResult.value) {
    isInitialLoad.value = false
    await nextTick()
    restoreSavedChanges()
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
  statusBarStore.dataChangesCount = dataGridRef.value?.changesCount ?? 0
}

const setupStatusBar = () => {
  statusBarStore.ownerTabId = props.tabId
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
    onViewChange: (view) => {
      const prev = activeView.value
      activeView.value = view
      if (view !== prev) {
        if (view === 'data') {
          loadData()
        } else if (view === 'structure') {
          structureRef.value?.reload()
        }
      }
    },
    onAddRow: () => {
      if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
      dataGridRef.value?.addNewRow()
    },
    onExportData: () => {
      if (!dataResult.value || !tabData.value) return
      exportDialogData.value = {
        title: `Export ${tabData.value.tableName}`,
        tableName: tabData.value.tableName,
        mode: ExportMode.InMemory,
        columns: dataResult.value.columns.map(c => ({ name: c.name, type: c.type })),
        rows: dataResult.value.rows,
        connectionId: tabData.value.connectionId,
        schema: tabData.value.schema
      }
      showExportDialog.value = true
    }
  })
  statusBarStore.setDataCallbacks({
    onApply: () => {
      if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
      dataGridRef.value?.applyChanges()
    },
    onDiscard: () => {
      dataGridRef.value?.discardChanges()
    }
  })
  statusBarStore.showGridControls = true
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

const handleCommitChanges = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
  if (statusBarStore.structureChangesCount > 0) {
    statusBarStore.applyStructureChanges()
  } else if (statusBarStore.dataChangesCount > 0) {
    statusBarStore.applyDataChanges()
  }
}

const handleDiscardChanges = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  if (statusBarStore.structureChangesCount > 0) {
    statusBarStore.discardStructureChanges()
  } else if (statusBarStore.dataChangesCount > 0) {
    statusBarStore.discardDataChanges()
  }
}

const restoreSavedChanges = (): void => {
  if (!tabData.value || !dataGridRef.value) return
  const { connectionId, tableName, database, schema } = tabData.value
  const saved = pendingChangesStore.getSavedChanges(connectionId, tableName, database, schema)
  if (!saved) return
  dataGridRef.value.restoreChanges(saved.changes, saved.newRows, saved.deleteRows)
  // Update live count before clearing saved so the sidebar dot never flickers
  const count = dataGridRef.value.changesCount
  pendingChangesStore.updateLiveCount(connectionId, tableName, count, database, schema)
  pendingChangesStore.clearSavedChanges(connectionId, tableName, database, schema)
}

onMounted(() => {
  setupStatusBar()

  // Check for viewState transferred via Move to New Window
  const restoredState = (tab.value as (typeof tab.value) & { _viewState?: TableViewState })?._viewState

  if (restoredState?.dataResult) {
    // Restore from transferred state instead of fetching from DB
    dataResult.value = restoredState.dataResult
    offset.value = restoredState.offset
    filters.value = restoredState.filters ?? []
    error.value = restoredState.error ?? null
    isInitialLoad.value = false

    // Clean up transient viewState
    delete (tab.value as (typeof tab.value) & { _viewState?: TableViewState })._viewState

    // Restore DataGrid state after DOM update
    nextTick(() => {
      if (dataGridRef.value && restoredState.grid) {
        dataGridRef.value.restoreGridState(restoredState.grid)
      }
      syncStatusBar()
    })

    loadForeignKeys()
  } else {
    // Normal path: consume initialFilters and load from DB
    if (tabData.value?.initialFilters?.length) {
      filters.value = tabData.value.initialFilters
      statusBarStore.activeFiltersCount = filters.value.length
      tabsStore.updateTabData(props.tabId, { initialFilters: undefined })
    }

    if (activeView.value === 'data') {
      loadData()
    }
    loadForeignKeys()
  }

  window.addEventListener('zequel:refresh-data', handleRefreshDataEvent)
  window.addEventListener('zequel:commit-changes', handleCommitChanges)
  window.addEventListener('zequel:discard-changes', handleDiscardChanges)
})

onBeforeUnmount(() => {
  if (!tabDataSnapshot) return

  // Check live DataGrid first (user is on data view)
  if (dataGridRef.value?.hasChanges) {
    pendingChangesStore.saveChanges({
      connectionId: tabDataSnapshot.connectionId,
      tableName: tabDataSnapshot.tableName,
      database: tabDataSnapshot.database,
      schema: tabDataSnapshot.schema,
      changes: Array.from(dataGridRef.value.pendingChanges.entries()),
      newRows: [...dataGridRef.value.pendingNewRows],
      deleteRows: Array.from(dataGridRef.value.pendingDeleteRows)
    })
  } else if (cachedGridState && (
    cachedGridState.pendingChanges.length > 0 ||
    cachedGridState.pendingNewRows.length > 0 ||
    cachedGridState.pendingDeleteRows.length > 0
  )) {
    // DataGrid is unmounted (user is on structure view) — use cached state
    pendingChangesStore.saveChanges({
      connectionId: tabDataSnapshot.connectionId,
      tableName: tabDataSnapshot.tableName,
      database: tabDataSnapshot.database,
      schema: tabDataSnapshot.schema,
      changes: cachedGridState.pendingChanges,
      newRows: cachedGridState.pendingNewRows,
      deleteRows: cachedGridState.pendingDeleteRows
    })
  }
})

onUnmounted(() => {
  viewStateRegistry.unregister(props.tabId)
  if (tabDataSnapshot) {
    pendingChangesStore.removeLiveCount(
      tabDataSnapshot.connectionId,
      tabDataSnapshot.tableName,
      tabDataSnapshot.database,
      tabDataSnapshot.schema
    )
  }
  statusBarStore.clear(props.tabId)
  window.removeEventListener('zequel:refresh-data', handleRefreshDataEvent)
  window.removeEventListener('zequel:commit-changes', handleCommitChanges)
  window.removeEventListener('zequel:discard-changes', handleDiscardChanges)
})

// Sync data grid changes count to status bar and pending changes store
watch(() => dataGridRef.value?.changesCount, (count) => {
  statusBarStore.dataChangesCount = count ?? 0
  if (tabData.value) {
    pendingChangesStore.updateLiveCount(
      tabData.value.connectionId,
      tabData.value.tableName,
      count ?? 0,
      tabData.value.database,
      tabData.value.schema
    )
  }
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

watch(activeView, (view, oldView) => {
  // Cache grid state when leaving data view (DataGrid will be unmounted by v-if)
  if (oldView === 'data' && view !== 'data' && dataGridRef.value?.table) {
    cachedGridState = {
      sorting: [...dataGridRef.value.table.getState().sorting],
      columnSizing: { ...dataGridRef.value.table.getState().columnSizing },
      columnOrder: [...dataGridRef.value.table.getState().columnOrder],
      columnVisibility: { ...dataGridRef.value.table.getState().columnVisibility },
      pendingChanges: Array.from(dataGridRef.value.pendingChanges.entries()),
      pendingNewRows: [...dataGridRef.value.pendingNewRows],
      pendingDeleteRows: Array.from(dataGridRef.value.pendingDeleteRows)
    }
  }
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
  if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '') || !dataGridRef.value) return
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
    rows: dataResult.value.rows,
    connectionId: tabData.value.connectionId,
    schema: tabData.value.schema
  }
  showExportDialog.value = true
}

const handlePasteRows = async () => {
  if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
  if (!tabData.value || !dataResult.value) return

  // Snapshot values that must survive across awaits
  const snapshotConnectionId = tabData.value.connectionId
  const snapshotTableName = tabData.value.tableName
  const snapshotColumns = dataResult.value.columns
  const connType = activeConnectionType.value
  const snapshotIsMongo = connType === DatabaseType.MongoDB

  // Snapshot-safe identifier quoting — avoids reading reactive state mid-loop
  const snapshotQuoteId = (name: string): string => {
    if (connType === DatabaseType.MySQL || connType === DatabaseType.MariaDB || connType === DatabaseType.ClickHouse) {
      return `\`${name.replace(/`/g, '``')}\``
    }
    if (connType === DatabaseType.SQLServer) {
      return `[${name.replace(/]/g, ']]')}]`
    }
    return `"${name.replace(/"/g, '""')}"`
  }

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
      snapshotColumns.some(c => c.name === h)
    )

    if (matchedColumns.length === 0) {
      toast.error('No matching columns found in clipboard data')
      isLoading.value = false
      return
    }

    for (const line of dataLines) {
      if (!line.trim()) continue
      const values = isTsv ? line.split('\t') : parseCsvLine(line)

      if (snapshotIsMongo) {
        const rowValues: Record<string, unknown> = {}
        for (const col of matchedColumns) {
          const idx = headers.indexOf(col)
          const val = idx >= 0 ? values[idx] : null
          rowValues[col] = val === '' || val === 'NULL' ? null : val
        }
        const result = await window.api.schema.insertRow(snapshotConnectionId, {
          table: snapshotTableName,
          values: rowValues
        })
        if (!result.success) throw new Error(result.error || 'Failed to insert row')
      } else {
        const colNames = matchedColumns.map(c => snapshotQuoteId(c)).join(', ')
        const placeholders = matchedColumns.map(() => '?').join(', ')
        const rowValues = matchedColumns.map(col => {
          const idx = headers.indexOf(col)
          const val = idx >= 0 ? values[idx] : null
          return val === '' || val === 'NULL' ? null : val
        })

        const sql = `INSERT INTO ${snapshotQuoteId(snapshotTableName)} (${colNames}) VALUES (${placeholders})`
        const result = await window.api.query.execute(snapshotConnectionId, sql, rowValues)
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
  if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
  if (!tabData.value || !dataResult.value) return

  // Snapshot values that must survive across awaits
  const snapshotConnectionId = tabData.value.connectionId
  const snapshotTableName = tabData.value.tableName
  const snapshotColumns = dataResult.value.columns
  const connType = activeConnectionType.value
  const snapshotIsMongo = connType === DatabaseType.MongoDB

  // Snapshot-safe identifier quoting — avoids reading reactive state mid-loop
  const snapshotQuoteId = (name: string): string => {
    if (connType === DatabaseType.MySQL || connType === DatabaseType.MariaDB || connType === DatabaseType.ClickHouse) {
      return `\`${name.replace(/`/g, '``')}\``
    }
    if (connType === DatabaseType.SQLServer) {
      return `[${name.replace(/]/g, ']]')}]`
    }
    return `"${name.replace(/"/g, '""')}"`
  }

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
      const cols = snapshotColumns.filter(c => row[c.name] !== undefined)
      if (cols.length === 0) continue

      if (snapshotIsMongo) {
        const values: Record<string, unknown> = {}
        for (const c of cols) {
          values[c.name] = row[c.name] ?? null
        }
        const result = await window.api.schema.insertRow(snapshotConnectionId, {
          table: snapshotTableName,
          values
        })
        if (!result.success) throw new Error(result.error || 'Failed to insert row')
      } else {
        const colNames = cols.map(c => snapshotQuoteId(c.name)).join(', ')
        const placeholders = cols.map(() => '?').join(', ')
        const values = cols.map(c => row[c.name] ?? null)

        const sql = `INSERT INTO ${snapshotQuoteId(snapshotTableName)} (${colNames}) VALUES (${placeholders})`
        const result = await window.api.query.execute(snapshotConnectionId, sql, values)
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
const buildMongoPkValues = (row: Record<string, unknown>, columns: { name: string }[]): Record<string, unknown> => {
  if (row._id !== undefined && row._id !== null) {
    return { _id: row._id }
  }
  const pkValues: Record<string, unknown> = {}
  for (const col of columns) {
    if (row[col.name] !== null && row[col.name] !== undefined) {
      pkValues[col.name] = row[col.name]
    }
  }
  return pkValues
}

const handleApplyChangesMongo = async (
  payload: ApplyChangesPayload,
  connId: string,
  table: string,
  rows: Record<string, unknown>[],
  columns: DataResult['columns']
) => {
  const { edits, newRows, deleteRowIndices } = payload

  // 1. Deletes
  for (const rowIndex of deleteRowIndices) {
    const row = rows[rowIndex]
    if (!row) continue
    const result = await window.api.schema.deleteRow(connId, {
      table,
      primaryKeyValues: buildMongoPkValues(row, columns)
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
      const row = rows[rowIndex]
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
        primaryKeyValues: buildMongoPkValues(row, columns),
        values
      })
      if (!result.success) throw new Error(result.error || 'Failed to update row')
    }
  }

  // 3. Inserts
  for (const newRow of newRows) {
    const values: Record<string, unknown> = {}
    for (const col of columns) {
      if (newRow[col.name] !== undefined && newRow[col.name] !== null) {
        values[col.name] = newRow[col.name]
      }
    }
    if (Object.keys(values).length === 0) continue
    const result = await window.api.schema.insertRow(connId, { table, values })
    if (!result.success) throw new Error(result.error || 'Failed to insert row')
  }
}

const handleApplyChangesRedis = async (
  payload: ApplyChangesPayload,
  connId: string,
  table: string,
  rows: Record<string, unknown>[],
  columns: DataResult['columns']
) => {
  const { edits, newRows, deleteRowIndices } = payload

  // 1. Deletes
  for (const rowIndex of deleteRowIndices) {
    const row = rows[rowIndex]
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
      const row = rows[rowIndex]
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
    for (const col of columns) {
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
  if (connectionsStore.isSafeModeForSession(tabData.value?.connectionId ?? '')) { toast.info('Safe Mode is enabled'); return }
  if (!tabData.value || !dataResult.value) return

  // Snapshot values that must survive across awaits (tab may be closed mid-apply)
  const snapshotConnectionId = tabData.value.connectionId
  const snapshotTableName = tabData.value.tableName
  const snapshotRows = dataResult.value.rows
  const snapshotColumns = dataResult.value.columns

  const { edits, newRows, deleteRowIndices } = payload
  if (edits.length === 0 && newRows.length === 0 && deleteRowIndices.length === 0) return

  isSaving.value = true
  error.value = null

  try {
    const connType = activeConnectionType.value
    if (!connType) throw new Error('No active connection')
    const snapshotPrimaryKeys = primaryKeyColumns.value

    // Snapshot-safe identifier quoting — avoids reading reactive tabData mid-apply
    const snapshotQuoteId = (name: string): string => {
      if (connType === DatabaseType.MySQL || connType === DatabaseType.MariaDB || connType === DatabaseType.ClickHouse) {
        return `\`${name.replace(/`/g, '``')}\``
      }
      if (connType === DatabaseType.SQLServer) {
        return `[${name.replace(/]/g, ']]')}]`
      }
      return `"${name.replace(/"/g, '""')}"`
    }

    if (connType === DatabaseType.MongoDB) {
      await handleApplyChangesMongo(payload, snapshotConnectionId, snapshotTableName, snapshotRows, snapshotColumns)
    } else if (connType === DatabaseType.Redis) {
      await handleApplyChangesRedis(payload, snapshotConnectionId, snapshotTableName, snapshotRows, snapshotColumns)
      // Refresh sidebar keys list so new/deleted keys appear
      const db = connectionsStore.getActiveDatabase(snapshotConnectionId)
      await connectionsStore.loadTables(snapshotConnectionId, db)
    } else {
      const isMySQL = connType === DatabaseType.MySQL || connType === DatabaseType.MariaDB
      const snapshotIsClickHouse = connType === DatabaseType.ClickHouse

      // 1. Execute DELETEs first
      for (const rowIndex of deleteRowIndices) {
        const row = snapshotRows[rowIndex]
        if (!row) continue

        let whereClause: string
        let whereValues: unknown[]

        if (snapshotPrimaryKeys.length > 0) {
          whereClause = snapshotPrimaryKeys
            .map(pk => `${snapshotQuoteId(pk)} = ?`)
            .join(' AND ')
          whereValues = snapshotPrimaryKeys.map(pk => sqlValue(row[pk]))
        } else {
          const conditions: string[] = []
          const values: unknown[] = []
          for (const col of snapshotColumns) {
            if (row[col.name] === null) {
              conditions.push(`${snapshotQuoteId(col.name)} IS NULL`)
            } else {
              conditions.push(`${snapshotQuoteId(col.name)} = ?`)
              values.push(sqlValue(row[col.name]))
            }
          }
          whereClause = conditions.join(' AND ')
          whereValues = values
        }

        const sql = `DELETE FROM ${snapshotQuoteId(snapshotTableName)} WHERE ${whereClause}`
        const result = await window.api.query.execute(snapshotConnectionId, sql, whereValues)
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
          const row = snapshotRows[rowIndex]
          if (!row || rowChanges.length === 0) continue

          const setClauses: string[] = []
          const values: unknown[] = []
          for (const change of rowChanges) {
            if (change.column) {
              setClauses.push(`${snapshotQuoteId(change.column)} = ?`)
              values.push(sqlValue(change.newValue))
            }
          }

          if (setClauses.length === 0) continue

          let whereClause: string
          let whereValues: unknown[]

          if (snapshotPrimaryKeys.length > 0) {
            whereClause = snapshotPrimaryKeys
              .map(pk => `${snapshotQuoteId(pk)} = ?`)
              .join(' AND ')
            whereValues = snapshotPrimaryKeys.map(pk => sqlValue(row[pk]))
          } else {
            const originalConditions: string[] = []
            const originalValues: unknown[] = []

            for (const change of rowChanges) {
              if (change.originalValue === null) {
                originalConditions.push(`${snapshotQuoteId(change.column)} IS NULL`)
              } else {
                originalConditions.push(`${snapshotQuoteId(change.column)} = ?`)
                originalValues.push(sqlValue(change.originalValue))
              }
            }
            for (const col of snapshotColumns) {
              if (!rowChanges.find(c => c.column === col.name)) {
                if (row[col.name] === null) {
                  originalConditions.push(`${snapshotQuoteId(col.name)} IS NULL`)
                } else {
                  originalConditions.push(`${snapshotQuoteId(col.name)} = ?`)
                  originalValues.push(sqlValue(row[col.name]))
                }
              }
            }
            whereClause = originalConditions.join(' AND ')
            whereValues = originalValues
          }

          const quotedTable = snapshotQuoteId(snapshotTableName)
          const sql = snapshotIsClickHouse
            ? `ALTER TABLE ${quotedTable} UPDATE ${setClauses.join(', ')} WHERE ${whereClause}`
            : `UPDATE ${quotedTable} SET ${setClauses.join(', ')} WHERE ${whereClause}`
          const allValues = [...values, ...whereValues]
          const result = await window.api.query.execute(snapshotConnectionId, sql, allValues)
          if (result.error) throw new Error(result.error)
        }
      }

      // 3. Execute INSERTs for new rows
      for (const newRow of newRows) {
        // Skip auto-increment PK columns — the DB generates those
        const cols = snapshotColumns.filter(c => !(c.primaryKey && c.autoIncrement))
        // Only include columns where the user set a value
        const insertCols = cols.filter(c => newRow[c.name] !== undefined && newRow[c.name] !== null)

        if (insertCols.length === 0) {
          // No values — insert with defaults
          const sql = (isMySQL || snapshotIsClickHouse)
            ? `INSERT INTO ${snapshotQuoteId(snapshotTableName)} () VALUES ()`
            : `INSERT INTO ${snapshotQuoteId(snapshotTableName)} DEFAULT VALUES`
          const result = await window.api.query.execute(snapshotConnectionId, sql, [])
          if (result.error) throw new Error(result.error)
        } else {
          const colNames = insertCols.map(c => snapshotQuoteId(c.name)).join(', ')
          const placeholders = insertCols.map(() => '?').join(', ')
          const values = insertCols.map(c => sqlValue(newRow[c.name] ?? null))

          const sql = `INSERT INTO ${snapshotQuoteId(snapshotTableName)} (${colNames}) VALUES (${placeholders})`
          const result = await window.api.query.execute(snapshotConnectionId, sql, values)
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
    // Reset the flag so pending edits are preserved for the user to retry
    if (dataGridRef.value) dataGridRef.value.applyInProgress = false
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
          :editable="!connectionsStore.isSafeModeForSession(tabData?.connectionId ?? '')"
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
