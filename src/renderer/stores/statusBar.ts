import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface StatusBarColumn {
  id: string
  name: string
  visible: boolean
}

export type ViewTab = 'data' | 'structure'

export const useStatusBarStore = defineStore('statusBar', () => {
  // Pagination
  const totalCount = ref(0)
  const offset = ref(0)
  const limit = ref(100)
  const isLoading = ref(false)

  // Filters
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
  const monitoringActiveConnections = ref<string | null>(null)
  const monitoringMaxConnections = ref<string | null>(null)

  // Users
  const showUsersControls = ref(false)
  const usersCount = ref(0)

  // Table Properties
  const showTablePropertiesControls = ref(false)
  const tablePropertiesCount = ref(0)
  const tablePropertiesHasDdl = ref(false)

  // Routine (Function / Procedure)
  const showRoutineControls = ref(false)
  const routineType = ref<string>('')
  const routineHasParams = ref(false)

  // Trigger
  const showTriggerControls = ref(false)
  const triggerInfo = ref('')

  // Sequence
  const showSequenceControls = ref(false)

  // Materialized View
  const showMaterializedViewControls = ref(false)

  // Extensions
  const showExtensionsControls = ref(false)
  const extensionsActiveTab = ref<'installed' | 'available'>('installed')

  // Event
  const showEventControls = ref(false)
  const eventStatus = ref('')

  // Track which tab owns the statusBar (to prevent stale unmount clearing)
  const ownerTabId = ref<string | null>(null)

  // Structure changes
  const structureChangesCount = ref(0)

  // Data changes (edits, new rows, deletes in the grid)
  const dataChangesCount = ref(0)

  // View tabs (Data / Structure) for table tabs
  const viewTabs = ref<ViewTab[]>([])
  const activeView = ref<ViewTab>('data')

  // Callbacks (set by the active view)
  // Most callbacks are plain `let` — they're called imperatively, not observed by templates.
  // onAddRow is a ref because canAddRow is a computed that depends on it reactively.
  let onPageChange: ((offset: number) => void) | null = null
  let onToggleColumn: ((id: string) => void) | null = null
  let onShowAllColumns: (() => void) | null = null
  let onApplySettings: ((limit: number, offset: number) => void) | null = null
  let onViewChange: ((view: ViewTab) => void) | null = null
  const onAddRow = ref<(() => void) | null>(null)
  let onApplyStructureChanges: (() => void) | null = null
  let onDiscardStructureChanges: (() => void) | null = null
  let onApplyDataChanges: (() => void) | null = null
  let onDiscardDataChanges: (() => void) | null = null

  // Export callback
  let onExportData: (() => void) | null = null

  // Monitoring callbacks
  let onMonitoringRefresh: (() => void) | null = null
  let onMonitoringToggleAutoRefresh: (() => void) | null = null

  // Users callbacks
  let onUsersRefresh: (() => void) | null = null
  let onUsersCreate: (() => void) | null = null

  // Table Properties callbacks
  let onTablePropertiesRefresh: (() => void) | null = null
  let onTablePropertiesCopyDdl: (() => void) | null = null

  // Routine callbacks
  let onRoutineRefresh: (() => void) | null = null

  // Trigger callbacks
  let onTriggerRefresh: (() => void) | null = null

  // Sequence callbacks
  let onSequenceRefresh: (() => void) | null = null
  let onSequenceGetNextValue: (() => void) | null = null

  // Materialized View callbacks
  let onMaterializedViewRefresh: (() => void) | null = null
  let onMaterializedViewRefreshData: (() => void) | null = null

  // Extensions callbacks
  let onExtensionsRefresh: (() => void) | null = null
  let onExtensionsTabChange: ((tab: 'installed' | 'available') => void) | null = null

  // Event callbacks
  let onEventRefresh: (() => void) | null = null
  let onEventCopyDefinition: (() => void) | null = null
  let onEventToggleStatus: (() => void) | null = null

  // ER Diagram callbacks
  let onERZoomIn: (() => void) | null = null
  let onERZoomOut: (() => void) | null = null
  let onERFitView: (() => void) | null = null
  let onERResetLayout: (() => void) | null = null

  // Mutually exclusive controls: only one view type is active at a time
  const clearAllControls = () => {
    showGridControls.value = false
    showERDiagramControls.value = false
    showMonitoringControls.value = false
    showUsersControls.value = false
    showTablePropertiesControls.value = false
    showRoutineControls.value = false
    showTriggerControls.value = false
    showEventControls.value = false
    showSequenceControls.value = false
    showMaterializedViewControls.value = false
    showExtensionsControls.value = false
  }

  const registerCallbacks = (cbs: {
    onPageChange?: (offset: number) => void
    onToggleColumn?: (id: string) => void
    onShowAllColumns?: () => void
    onApplySettings?: (limit: number, offset: number) => void
    onViewChange?: (view: ViewTab) => void
    onAddRow?: () => void
    onExportData?: () => void
  }) => {
    clearAllControls()

    onPageChange = cbs.onPageChange ?? null
    onToggleColumn = cbs.onToggleColumn ?? null
    onShowAllColumns = cbs.onShowAllColumns ?? null
    onApplySettings = cbs.onApplySettings ?? null
    onViewChange = cbs.onViewChange ?? null
    onAddRow.value = cbs.onAddRow ?? null
    onExportData = cbs.onExportData ?? null
  }

  const changeView = (view: 'data' | 'structure') => {
    activeView.value = view
    onViewChange?.(view)
  }

  const pageChange = (newOffset: number) => {
    onPageChange?.(newOffset)
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

  const canAddRow = computed(() => onAddRow.value !== null)

  const addRow = () => {
    onAddRow.value?.()
  }

  const exportData = () => {
    onExportData?.()
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
    clearAllControls()

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
    clearAllControls()

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
    onCreate?: () => void
  }) => {
    clearAllControls()

    onUsersRefresh = cbs.onRefresh ?? null
    onUsersCreate = cbs.onCreate ?? null
  }

  const usersRefresh = () => {
    onUsersRefresh?.()
  }

  const usersCreate = () => {
    onUsersCreate?.()
  }

  const registerTablePropertiesCallbacks = (cbs: {
    onRefresh?: () => void
    onCopyDdl?: () => void
  }) => {
    clearAllControls()

    onTablePropertiesRefresh = cbs.onRefresh ?? null
    onTablePropertiesCopyDdl = cbs.onCopyDdl ?? null
  }

  const tablePropertiesRefresh = () => {
    onTablePropertiesRefresh?.()
  }

  const tablePropertiesCopyDdl = () => {
    onTablePropertiesCopyDdl?.()
  }

  const registerRoutineCallbacks = (cbs: {
    onRefresh?: () => void
  }) => {
    clearAllControls()

    onRoutineRefresh = cbs.onRefresh ?? null
  }

  const routineRefresh = () => {
    onRoutineRefresh?.()
  }

  const registerTriggerCallbacks = (cbs: {
    onRefresh?: () => void
  }) => {
    clearAllControls()

    onTriggerRefresh = cbs.onRefresh ?? null
  }

  const triggerRefresh = () => {
    onTriggerRefresh?.()
  }

  const registerExtensionsCallbacks = (cbs: {
    onRefresh?: () => void
    onTabChange?: (tab: 'installed' | 'available') => void
  }) => {
    clearAllControls()

    onExtensionsRefresh = cbs.onRefresh ?? null
    onExtensionsTabChange = cbs.onTabChange ?? null
  }

  const extensionsRefresh = () => {
    onExtensionsRefresh?.()
  }

  const extensionsTabChange = (tab: 'installed' | 'available') => {
    extensionsActiveTab.value = tab
    onExtensionsTabChange?.(tab)
  }

  const registerMaterializedViewCallbacks = (cbs: {
    onRefresh?: () => void
    onRefreshData?: () => void
  }) => {
    clearAllControls()

    onMaterializedViewRefresh = cbs.onRefresh ?? null
    onMaterializedViewRefreshData = cbs.onRefreshData ?? null
  }

  const materializedViewRefresh = () => {
    onMaterializedViewRefresh?.()
  }

  const materializedViewRefreshData = () => {
    onMaterializedViewRefreshData?.()
  }

  const registerSequenceCallbacks = (cbs: {
    onRefresh?: () => void
    onGetNextValue?: () => void
  }) => {
    clearAllControls()

    onSequenceRefresh = cbs.onRefresh ?? null
    onSequenceGetNextValue = cbs.onGetNextValue ?? null
  }

  const sequenceRefresh = () => {
    onSequenceRefresh?.()
  }

  const sequenceGetNextValue = () => {
    onSequenceGetNextValue?.()
  }

  const registerEventCallbacks = (cbs: {
    onRefresh?: () => void
    onCopyDefinition?: () => void
    onToggleStatus?: () => void
  }) => {
    clearAllControls()

    onEventRefresh = cbs.onRefresh ?? null
    onEventCopyDefinition = cbs.onCopyDefinition ?? null
    onEventToggleStatus = cbs.onToggleStatus ?? null
  }

  const eventRefresh = () => {
    onEventRefresh?.()
  }

  const eventCopyDefinition = () => {
    onEventCopyDefinition?.()
  }

  const eventToggleStatus = () => {
    onEventToggleStatus?.()
  }

  const clear = (tabId?: string) => {
    // If a tabId is provided, only clear if this tab still owns the statusBar
    if (tabId && ownerTabId.value !== tabId) return

    ownerTabId.value = null
    totalCount.value = 0
    offset.value = 0
    limit.value = 100
    isLoading.value = false
    activeFiltersCount.value = 0
    columns.value = []
    showGridControls.value = false
    viewTabs.value = []
    activeView.value = 'data'
    onPageChange = null
    onToggleColumn = null
    onShowAllColumns = null
    onApplySettings = null
    onViewChange = null
    onAddRow.value = null
    onExportData = null
    structureChangesCount.value = 0
    onApplyStructureChanges = null
    onDiscardStructureChanges = null
    dataChangesCount.value = 0
    onApplyDataChanges = null
    onDiscardDataChanges = null
    showMonitoringControls.value = false
    monitoringProcessCount.value = 0
    monitoringAutoRefresh.value = false
    monitoringActiveConnections.value = null
    monitoringMaxConnections.value = null
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
    onUsersCreate = null
    showTablePropertiesControls.value = false
    tablePropertiesCount.value = 0
    tablePropertiesHasDdl.value = false
    onTablePropertiesRefresh = null
    onTablePropertiesCopyDdl = null
    showRoutineControls.value = false
    routineType.value = ''
    routineHasParams.value = false
    onRoutineRefresh = null
    showTriggerControls.value = false
    triggerInfo.value = ''
    onTriggerRefresh = null
    showEventControls.value = false
    eventStatus.value = ''
    onEventRefresh = null
    onEventCopyDefinition = null
    onEventToggleStatus = null
    showSequenceControls.value = false
    onSequenceRefresh = null
    onSequenceGetNextValue = null
    showMaterializedViewControls.value = false
    onMaterializedViewRefresh = null
    onMaterializedViewRefreshData = null
    showExtensionsControls.value = false
    extensionsActiveTab.value = 'installed'
    onExtensionsRefresh = null
    onExtensionsTabChange = null
  }

  const hasContent = computed(() => {
    return viewTabs.value.length > 0
      || showGridControls.value
      || structureChangesCount.value > 0
      || dataChangesCount.value > 0
      || showERDiagramControls.value
      || showMonitoringControls.value
      || showUsersControls.value
      || showTablePropertiesControls.value
      || showRoutineControls.value
      || showTriggerControls.value
      || showEventControls.value
      || showSequenceControls.value
      || showMaterializedViewControls.value
      || showExtensionsControls.value
  })

  return {
    // State
    totalCount,
    offset,
    limit,
    isLoading,
    activeFiltersCount,
    columns,
    showGridControls,
    showERDiagramControls,
    erDiagramTableCount,
    erDiagramRelationshipCount,
    showMonitoringControls,
    monitoringProcessCount,
    monitoringAutoRefresh,
    monitoringActiveConnections,
    monitoringMaxConnections,
    showUsersControls,
    usersCount,
    showTablePropertiesControls,
    tablePropertiesCount,
    tablePropertiesHasDdl,
    showRoutineControls,
    routineType,
    routineHasParams,
    showTriggerControls,
    triggerInfo,
    showSequenceControls,
    showMaterializedViewControls,
    showExtensionsControls,
    extensionsActiveTab,
    showEventControls,
    eventStatus,
    ownerTabId,
    viewTabs,
    activeView,
    structureChangesCount,
    dataChangesCount,
    hasContent,

    // Actions
    registerCallbacks,
    pageChange,
    toggleColumn,
    showAllColumns,
    applySettings,
    changeView,
    canAddRow,
    addRow,
    exportData,
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
    usersCreate,
    registerTablePropertiesCallbacks,
    tablePropertiesRefresh,
    tablePropertiesCopyDdl,
    registerRoutineCallbacks,
    routineRefresh,
    registerTriggerCallbacks,
    triggerRefresh,
    registerExtensionsCallbacks,
    extensionsRefresh,
    extensionsTabChange,
    registerMaterializedViewCallbacks,
    materializedViewRefresh,
    materializedViewRefreshData,
    registerSequenceCallbacks,
    sequenceRefresh,
    sequenceGetNextValue,
    registerEventCallbacks,
    eventRefresh,
    eventCopyDefinition,
    eventToggleStatus,
    clear
  }
})
