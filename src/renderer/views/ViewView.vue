<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTabsStore, type ViewTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import type { DataResult, DataFilter } from '@/types/table'
import { IconLoader2 } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'

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
const showFilters = ref(false)
const filters = ref<DataFilter[]>([])

// DataGrid ref for column visibility
const dataGridRef = ref<InstanceType<typeof DataGrid> | null>(null)

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
    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    dataResult.value = await window.api.schema.tableData(
      tabData.value.connectionId,
      tabData.value.viewName,
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
  statusBarStore.registerCallbacks({
    onPageChange: handlePageChange,
    onToggleFilters: handleToggleFilters,
    onToggleColumn: handleToggleColumn,
    onShowAllColumns: handleShowAllColumns,
    onApplySettings: (newLimit: number, newOffset: number) => {
      settingsStore.updateGridSettings({ pageSize: newLimit })
      offset.value = newOffset
      loadData()
    }
  })
}

onMounted(() => {
  setupStatusBar()
  loadData()
})

onUnmounted(() => {
  statusBarStore.clear()
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
        :editable="false"
      />
    </div>
  </div>
</template>
