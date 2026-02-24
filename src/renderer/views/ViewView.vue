<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTabsStore, type ViewTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import type { DataResult, DataFilter } from '@/types/table'
import { IconLoader2 } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'
import ExportDialog, { type ExportDialogData } from '@/components/dialogs/ExportDialog.vue'
import { ExportMode } from '@/types/table'
import { viewStateRegistry } from '@/stores/viewStateRegistry'
import type { ViewViewState, DataGridState } from '@/types/viewState'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const statusBarStore = useStatusBarStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as ViewTabData | undefined)

const dataResult = ref<DataResult | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const offset = ref(0)
const filters = ref<DataFilter[]>([])

let loadGeneration = 0

// Export dialog state
const showExportDialog = ref(false)
const exportDialogData = ref<ExportDialogData | null>(null)

// DataGrid ref for column visibility
const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)

// Register viewState collector for Move to New Window
viewStateRegistry.register(props.tabId, (): ViewViewState | null => {
  const grid: DataGridState | undefined = dataGridRef.value?.table ? {
    sorting: [...dataGridRef.value.table.getState().sorting],
    columnSizing: { ...dataGridRef.value.table.getState().columnSizing },
    columnOrder: [...dataGridRef.value.table.getState().columnOrder],
    columnVisibility: { ...dataGridRef.value.table.getState().columnVisibility },
    pendingChanges: [],
    pendingNewRows: [],
    pendingDeleteRows: []
  } : undefined

  return {
    kind: 'view' as const,
    dataResult: dataResult.value,
    offset: offset.value,
    filters: [...filters.value],
    error: error.value,
    grid
  }
})

const columnVisibilityItems = computed(() => {
  if (!dataResult.value) return []
  const visibility = dataGridRef.value?.getColumnVisibility() || {}
  return dataResult.value.columns.map(col => ({
    id: col.name,
    name: col.name,
    visible: visibility[col.name] !== false
  }))
})

const handleToggleColumn = async (columnId: string) => {
  dataGridRef.value?.toggleColumnVisibility(columnId)
  await nextTick()
  statusBarStore.columns = columnVisibilityItems.value
}

const handleShowAllColumns = async () => {
  dataGridRef.value?.showAllColumns()
  await nextTick()
  statusBarStore.columns = columnVisibilityItems.value
}

const loadData = async (skipCount = false) => {
  if (!tabData.value) return

  const gen = ++loadGeneration
  isLoading.value = true
  error.value = null

  try {
    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    const result = await window.api.schema.tableData(
      tabData.value.connectionId,
      tabData.value.viewName,
      {
        offset: offset.value,
        limit: settingsStore.gridSettings.pageSize,
        filters: plainFilters,
        knownTotalCount: skipCount ? dataResult.value?.totalCount : undefined
      }
    )
    if (gen !== loadGeneration) return
    dataResult.value = result
    syncStatusBar()
  } catch (e) {
    if (gen !== loadGeneration) return
    error.value = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    if (gen === loadGeneration) {
      isLoading.value = false
      statusBarStore.isLoading = false
    }
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
  statusBarStore.registerCallbacks({
    onPageChange: handlePageChange,
    onToggleColumn: handleToggleColumn,
    onShowAllColumns: handleShowAllColumns,
    onApplySettings: (newLimit: number, newOffset: number) => {
      settingsStore.updateGridSettings({ pageSize: newLimit })
      offset.value = newOffset
      loadData(true)
    },
    onExportData: () => {
      if (!dataResult.value || !tabData.value) return
      exportDialogData.value = {
        title: `Export ${tabData.value.viewName}`,
        tableName: tabData.value.viewName,
        mode: ExportMode.InMemory,
        columns: dataResult.value.columns.map(c => ({ name: c.name, type: c.type })),
        rows: dataResult.value.rows
      }
      showExportDialog.value = true
    }
  })
}

const handleRefreshDataEvent = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  loadData()
}

onMounted(() => {
  setupStatusBar()

  // Check for viewState transferred via Move to New Window
  const restoredState = (tab.value as (typeof tab.value) & { _viewState?: ViewViewState })?._viewState

  if (restoredState?.dataResult) {
    dataResult.value = restoredState.dataResult
    offset.value = restoredState.offset
    filters.value = restoredState.filters ?? []
    error.value = restoredState.error ?? null

    delete (tab.value as (typeof tab.value) & { _viewState?: ViewViewState })._viewState

    nextTick(() => {
      if (dataGridRef.value && restoredState.grid) {
        dataGridRef.value.restoreGridState(restoredState.grid)
      }
      syncStatusBar()
    })
  } else {
    loadData()
  }

  window.addEventListener('zequel:refresh-data', handleRefreshDataEvent)
})

onUnmounted(() => {
  viewStateRegistry.unregister(props.tabId)
  statusBarStore.clear(props.tabId)
  window.removeEventListener('zequel:refresh-data', handleRefreshDataEvent)
})

// Re-sync statusBar when this tab becomes active (fixes stale callbacks
// when switching between multiple tabs that stay mounted via v-show)
watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
    if (dataResult.value) {
      syncStatusBar()
    }
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
  offset.value = 0
  loadData()
}

const handleClearFilters = () => {
  filters.value = []
  offset.value = 0
  statusBarStore.activeFiltersCount = 0
  loadData()
}
</script>

<template>
  <div class="flex flex-col h-full">
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
      class="flex-1 p-4"
    >
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- Data Grid -->
    <div v-if="dataResult" class="flex-1 overflow-hidden">
      <DataGrid
        ref="dataGridRef"
        :columns="dataResult.columns"
        :rows="dataResult.rows"
        :editable="false"
      />
    </div>

    <!-- Export Dialog -->
    <ExportDialog
      :open="showExportDialog"
      :data="exportDialogData"
      @update:open="showExportDialog = $event"
    />
  </div>
</template>
