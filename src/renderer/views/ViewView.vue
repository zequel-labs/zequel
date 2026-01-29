<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type ViewTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useConnectionsStore } from '@/stores/connections'
import type { DataResult, DataFilter, ColumnInfo } from '@/types/table'
import type { ExportFormat } from '@/components/grid/GridToolbar.vue'
import { IconLoader2, IconCode, IconEye } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'
import GridToolbar from '@/components/grid/GridToolbar.vue'
import FilterPanel from '@/components/grid/FilterPanel.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const connectionsStore = useConnectionsStore()

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as ViewTabData | undefined)

const activeView = computed({
  get: () => tabData.value?.activeView || 'data',
  set: (value) => tabsStore.setViewView(props.tabId, value)
})

const dataResult = ref<DataResult | null>(null)
const viewDDL = ref<string>('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const offset = ref(0)
const showFilters = ref(false)
const filters = ref<DataFilter[]>([])

async function loadData() {
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
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    isLoading.value = false
  }
}

async function loadDDL() {
  if (!tabData.value) return

  isLoading.value = true
  error.value = null

  try {
    viewDDL.value = await window.api.schema.viewDDL(tabData.value.connectionId, tabData.value.viewName)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load DDL'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (activeView.value === 'data') {
    loadData()
  } else {
    loadDDL()
  }
})

watch(activeView, (view) => {
  if (view === 'data' && !dataResult.value) {
    loadData()
  } else if (view === 'ddl' && !viewDDL.value) {
    loadDDL()
  }
})

function handlePageChange(newOffset: number) {
  offset.value = newOffset
  loadData()
}

function handleRefresh() {
  if (activeView.value === 'data') {
    loadData()
  } else {
    loadDDL()
  }
}

// Export functions
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
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

async function handleExport(format: ExportFormat) {
  if (!tabData.value || !dataResult.value) return

  const viewName = tabData.value.viewName

  const fileFilters: { name: string; extensions: string[] }[] = {
    csv: [{ name: 'CSV Files', extensions: ['csv'] }],
    json: [{ name: 'JSON Files', extensions: ['json'] }],
    sql: [{ name: 'SQL Files', extensions: ['sql'] }]
  }[format]

  const defaultName = `${viewName}.${format}`

  const dialogResult = await window.api.app.showSaveDialog({
    title: `Export as ${format.toUpperCase()}`,
    defaultPath: defaultName,
    filters: fileFilters
  })

  if (dialogResult.canceled || !dialogResult.filePath) return

  try {
    isLoading.value = true

    const plainFilters = filters.value.length > 0
      ? filters.value.map(f => ({ column: f.column, operator: f.operator, value: f.value }))
      : undefined

    const allData = await window.api.schema.tableData(
      tabData.value.connectionId,
      viewName,
      {
        offset: 0,
        limit: 100000,
        filters: plainFilters
      }
    )

    let content: string
    switch (format) {
      case 'csv':
        content = generateCsv(allData.columns, allData.rows)
        break
      case 'json':
        content = generateJson(allData.rows)
        break
      case 'sql':
        content = `-- Data exported from view: ${viewName}\n-- Views do not support INSERT export`
        break
    }

    await window.api.app.writeFile(dialogResult.filePath, content)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to export data'
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
  offset.value = 0
  loadData()
}

function handleClearFilters() {
  filters.value = []
  offset.value = 0
  loadData()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- View Tabs -->
    <div class="flex items-center gap-1 px-4 py-2 border-b bg-muted/30">
      <div class="flex items-center gap-2 mr-4">
        <IconEye class="h-4 w-4 text-purple-500" />
        <span class="text-sm font-medium">{{ tabData?.viewName }}</span>
      </div>
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
        :is-loading="isLoading"
        :show-filters="showFilters"
        :active-filters-count="filters.length"
        :editable="false"
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
          :editable="false"
        />
      </div>
    </template>

    <!-- DDL View -->
    <template v-else-if="activeView === 'ddl'">
      <!-- Loading -->
      <div
        v-if="isLoading && !viewDDL"
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

      <!-- DDL Content -->
      <div v-else class="flex-1 p-4 overflow-auto">
        <div class="flex items-center gap-2 mb-4">
          <IconCode class="h-4 w-4 text-muted-foreground" />
          <span class="text-sm text-muted-foreground">View Definition</span>
        </div>
        <pre class="p-4 rounded-lg bg-muted font-mono text-sm whitespace-pre-wrap">{{ viewDDL || '-- No DDL available' }}</pre>
      </div>
    </template>
  </div>
</template>
