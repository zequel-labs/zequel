import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ColumnInfo, CellChange } from '@/types/query'

export const useLayoutStore = defineStore('layout', () => {
  // Sidebar
  const sidebarVisible = ref(true)
  const sidebarWidth = ref(260)

  const toggleSidebar = () => {
    sidebarVisible.value = !sidebarVisible.value
  }

  // Right panel (visibility + resize)
  const rightPanelVisible = ref(false)
  const rightPanelWidth = ref(320)

  const toggleRightPanel = () => {
    rightPanelVisible.value = !rightPanelVisible.value
  }

  // Bottom panel
  const bottomPanelVisible = ref(false)
  const bottomPanelHeight = ref(200)

  const toggleBottomPanel = () => {
    bottomPanelVisible.value = !bottomPanelVisible.value
  }

  // Right panel data (row detail)
  const rightPanelRow = ref<Record<string, unknown> | null>(null)
  const rightPanelColumns = ref<ColumnInfo[]>([])
  const rightPanelRowIndex = ref<number | null>(null)
  const rightPanelPendingChanges = ref<Map<string, CellChange>>(new Map())
  const rightPanelOnUpdateCell = ref<((change: CellChange) => void) | null>(null)

  const clearRightPanel = () => {
    rightPanelRow.value = null
    rightPanelColumns.value = []
    rightPanelRowIndex.value = null
    rightPanelPendingChanges.value = new Map()
    rightPanelOnUpdateCell.value = null
  }

  const setRightPanelRow = (
    row: Record<string, unknown>,
    rowIndex: number,
    pendingChanges?: Map<string, CellChange>
  ) => {
    rightPanelRow.value = row
    rightPanelRowIndex.value = rowIndex
    if (pendingChanges) {
      rightPanelPendingChanges.value = pendingChanges
    }
  }

  const setRightPanelColumns = (
    columns: ColumnInfo[],
    onUpdateCell: (change: CellChange) => void
  ) => {
    rightPanelColumns.value = columns
    rightPanelOnUpdateCell.value = onUpdateCell
  }

  return {
    // Sidebar
    sidebarVisible,
    sidebarWidth,
    toggleSidebar,

    // Right panel
    rightPanelVisible,
    rightPanelWidth,
    toggleRightPanel,

    // Bottom panel
    bottomPanelVisible,
    bottomPanelHeight,
    toggleBottomPanel,

    // Right panel data
    rightPanelRow,
    rightPanelColumns,
    rightPanelRowIndex,
    rightPanelPendingChanges,
    rightPanelOnUpdateCell,
    clearRightPanel,
    setRightPanelRow,
    setRightPanelColumns,
  }
})
