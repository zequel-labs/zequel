import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  // ER Diagram
  const showERDiagramControls = ref(false)
  const erDiagramTableCount = ref(0)
  const erDiagramRelationshipCount = ref(0)

  // Monitoring
  const showMonitoringControls = ref(false)
  const monitoringProcessCount = ref(0)
  const monitoringAutoRefresh = ref(false)

  // Users
  const showUsersControls = ref(false)
  const usersCount = ref(0)

  // Track which tab owns the statusBar (to prevent stale unmount clearing)
  const ownerTabId = ref<string | null>(null)

  // Structure changes
  const structureChangesCount = ref(0)

  // Data changes (edits, new rows, deletes in the grid)
  const dataChangesCount = ref(0)

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
  let onAddRow: (() => void) | null = null
  let onApplyStructureChanges: (() => void) | null = null
  let onDiscardStructureChanges: (() => void) | null = null
  let onApplyDataChanges: (() => void) | null = null
  let onDiscardDataChanges: (() => void) | null = null

  // Monitoring callbacks
  let onMonitoringRefresh: (() => void) | null = null
  let onMonitoringToggleAutoRefresh: (() => void) | null = null

  // Users callbacks
  let onUsersRefresh: (() => void) | null = null

  // ER Diagram callbacks
  let onERZoomIn: (() => void) | null = null
  let onERZoomOut: (() => void) | null = null
  let onERFitView: (() => void) | null = null
  let onERResetLayout: (() => void) | null = null

  const registerCallbacks = (cbs: {
    onPageChange?: (offset: number) => void
    onToggleFilters?: () => void
    onToggleColumn?: (id: string) => void
    onShowAllColumns?: () => void
    onApplySettings?: (limit: number, offset: number) => void
    onViewChange?: (view: string) => void
    onAddRow?: () => void
  }) => {
    // Mutually exclusive: clear other controls when grid registers
    showERDiagramControls.value = false
    showMonitoringControls.value = false
    showUsersControls.value = false

    onPageChange = cbs.onPageChange ?? null
    onToggleFilters = cbs.onToggleFilters ?? null
    onToggleColumn = cbs.onToggleColumn ?? null
    onShowAllColumns = cbs.onShowAllColumns ?? null
    onApplySettings = cbs.onApplySettings ?? null
    onViewChange = cbs.onViewChange ?? null
    onAddRow = cbs.onAddRow ?? null
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

  const addRow = () => {
    onAddRow?.()
  }

  const applyStructureChanges = () => {
    onApplyStructureChanges?.()
  }

  const discardStructureChanges = () => {
    onDiscardStructureChanges?.()
  }

  const setStructureCallbacks = (cbs: {
    onApply?: () => void
    onDiscard?: () => void
  }) => {
    onApplyStructureChanges = cbs.onApply ?? null
    onDiscardStructureChanges = cbs.onDiscard ?? null
  }

  const applyDataChanges = () => {
    onApplyDataChanges?.()
  }

  const discardDataChanges = () => {
    onDiscardDataChanges?.()
  }

  const setDataCallbacks = (cbs: {
    onApply?: () => void
    onDiscard?: () => void
  }) => {
    onApplyDataChanges = cbs.onApply ?? null
    onDiscardDataChanges = cbs.onDiscard ?? null
  }

  const registerMonitoringCallbacks = (cbs: {
    onRefresh?: () => void
    onToggleAutoRefresh?: () => void
  }) => {
    // Mutually exclusive
    showGridControls.value = false
    showERDiagramControls.value = false
    showUsersControls.value = false

    onMonitoringRefresh = cbs.onRefresh ?? null
    onMonitoringToggleAutoRefresh = cbs.onToggleAutoRefresh ?? null
  }

  const monitoringRefresh = () => {
    onMonitoringRefresh?.()
  }

  const monitoringToggleAutoRefresh = () => {
    onMonitoringToggleAutoRefresh?.()
  }

  const registerERDiagramCallbacks = (cbs: {
    onZoomIn?: () => void
    onZoomOut?: () => void
    onFitView?: () => void
    onResetLayout?: () => void
  }) => {
    // Mutually exclusive: clear other controls when ER diagram registers
    showGridControls.value = false
    showMonitoringControls.value = false
    showUsersControls.value = false

    onERZoomIn = cbs.onZoomIn ?? null
    onERZoomOut = cbs.onZoomOut ?? null
    onERFitView = cbs.onFitView ?? null
    onERResetLayout = cbs.onResetLayout ?? null
  }

  const erZoomIn = () => {
    onERZoomIn?.()
  }

  const erZoomOut = () => {
    onERZoomOut?.()
  }

  const erFitView = () => {
    onERFitView?.()
  }

  const erResetLayout = () => {
    onERResetLayout?.()
  }

  const registerUsersCallbacks = (cbs: {
    onRefresh?: () => void
  }) => {
    // Mutually exclusive
    showGridControls.value = false
    showERDiagramControls.value = false
    showMonitoringControls.value = false

    onUsersRefresh = cbs.onRefresh ?? null
  }

  const usersRefresh = () => {
    onUsersRefresh?.()
  }

  const clear = (tabId?: string) => {
    // If a tabId is provided, only clear if this tab still owns the statusBar
    if (tabId && ownerTabId.value !== tabId) return

    ownerTabId.value = null
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
    onAddRow = null
    structureChangesCount.value = 0
    onApplyStructureChanges = null
    onDiscardStructureChanges = null
    dataChangesCount.value = 0
    onApplyDataChanges = null
    onDiscardDataChanges = null
    showMonitoringControls.value = false
    monitoringProcessCount.value = 0
    monitoringAutoRefresh.value = false
    onMonitoringRefresh = null
    onMonitoringToggleAutoRefresh = null
    showERDiagramControls.value = false
    erDiagramTableCount.value = 0
    erDiagramRelationshipCount.value = 0
    onERZoomIn = null
    onERZoomOut = null
    onERFitView = null
    onERResetLayout = null
    showUsersControls.value = false
    usersCount.value = 0
    onUsersRefresh = null
  }

  const hasContent = computed(() => {
    return viewTabs.value.length > 0
      || showGridControls.value
      || structureChangesCount.value > 0
      || dataChangesCount.value > 0
      || showERDiagramControls.value
      || showMonitoringControls.value
      || showUsersControls.value
  })

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
    showERDiagramControls,
    erDiagramTableCount,
    erDiagramRelationshipCount,
    showMonitoringControls,
    monitoringProcessCount,
    monitoringAutoRefresh,
    showUsersControls,
    usersCount,
    ownerTabId,
    viewTabs,
    activeView,
    structureChangesCount,
    dataChangesCount,
    hasContent,

    // Actions
    registerCallbacks,
    pageChange,
    toggleFilters,
    toggleColumn,
    showAllColumns,
    applySettings,
    changeView,
    addRow,
    applyStructureChanges,
    discardStructureChanges,
    setStructureCallbacks,
    applyDataChanges,
    discardDataChanges,
    setDataCallbacks,
    registerMonitoringCallbacks,
    monitoringRefresh,
    monitoringToggleAutoRefresh,
    registerERDiagramCallbacks,
    erZoomIn,
    erZoomOut,
    erFitView,
    erResetLayout,
    registerUsersCallbacks,
    usersRefresh,
    clear
  }
})
