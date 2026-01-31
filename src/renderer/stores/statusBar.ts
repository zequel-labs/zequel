import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface StatusBarColumn {
  id: string
  name: string
  visible: boolean
}

export const useStatusBarStore = defineStore('statusBar', () => {
  // Pagination
  const totalCount = ref(0)
  const offset = ref(0)
  const limit = ref(100)
  const isLoading = ref(false)

  // Filters
  const showFilters = ref(false)
  const activeFiltersCount = ref(0)

  // Columns
  const columns = ref<StatusBarColumn[]>([])

  // Whether the status bar should show grid controls (only for table/view tabs)
  const showGridControls = ref(false)

  // View tabs (Data / Structure) for table tabs
  const viewTabs = ref<string[]>([])
  const activeView = ref<string>('data')

  // Callbacks (set by the active view)
  let onPageChange: ((offset: number) => void) | null = null
  let onToggleFilters: (() => void) | null = null
  let onToggleColumn: ((id: string) => void) | null = null
  let onShowAllColumns: (() => void) | null = null
  let onApplySettings: ((limit: number, offset: number) => void) | null = null
  let onViewChange: ((view: string) => void) | null = null

  const registerCallbacks = (cbs: {
    onPageChange?: (offset: number) => void
    onToggleFilters?: () => void
    onToggleColumn?: (id: string) => void
    onShowAllColumns?: () => void
    onApplySettings?: (limit: number, offset: number) => void
    onViewChange?: (view: string) => void
  }) => {
    onPageChange = cbs.onPageChange ?? null
    onToggleFilters = cbs.onToggleFilters ?? null
    onToggleColumn = cbs.onToggleColumn ?? null
    onShowAllColumns = cbs.onShowAllColumns ?? null
    onApplySettings = cbs.onApplySettings ?? null
    onViewChange = cbs.onViewChange ?? null
  }

  const changeView = (view: string) => {
    activeView.value = view
    onViewChange?.(view)
  }

  const pageChange = (newOffset: number) => {
    onPageChange?.(newOffset)
  }

  const toggleFilters = () => {
    onToggleFilters?.()
  }

  const toggleColumn = (id: string) => {
    onToggleColumn?.(id)
  }

  const showAllColumns = () => {
    onShowAllColumns?.()
  }

  const applySettings = (newLimit: number, newOffset: number) => {
    onApplySettings?.(newLimit, newOffset)
  }

  const clear = () => {
    totalCount.value = 0
    offset.value = 0
    limit.value = 100
    isLoading.value = false
    showFilters.value = false
    activeFiltersCount.value = 0
    columns.value = []
    showGridControls.value = false
    viewTabs.value = []
    activeView.value = 'data'
    onPageChange = null
    onToggleFilters = null
    onToggleColumn = null
    onShowAllColumns = null
    onApplySettings = null
    onViewChange = null
  }

  return {
    // State
    totalCount,
    offset,
    limit,
    isLoading,
    showFilters,
    activeFiltersCount,
    columns,
    showGridControls,
    viewTabs,
    activeView,

    // Actions
    registerCallbacks,
    pageChange,
    toggleFilters,
    toggleColumn,
    showAllColumns,
    applySettings,
    changeView,
    clear
  }
})
