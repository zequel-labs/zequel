<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, markRaw } from 'vue'
import { copyToClipboard } from '@/lib/utils'
import { formatCellValue } from '@/lib/format'
import { isDateValue, formatDateTime, isDateColumnType } from '@/lib/date'
import { isBooleanColumnType, parseBooleanValue } from '@/lib/boolean'
import DateCellEditor from '@/components/grid/DateCellEditor.vue'
import { Checkbox } from '@/components/ui/checkbox'
import {
  useVueTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
  type VisibilityState,
  FlexRender
} from '@tanstack/vue-table'
import type { ColumnInfo } from '@/types/query'
import type { ForeignKey } from '@/types/table'
import type { DataGridState } from '@/types/viewState'
import { IconArrowUp, IconArrowDown, IconArrowsSort, IconCopy, IconCheck, IconDeviceFloppy, IconX, IconPencil, IconGripVertical, IconMaximize, IconArrowBackUp, IconArrowForwardUp, IconCopyPlus, IconTrash, IconClipboard, IconPlus, IconRefresh, IconDownload, IconUpload, IconEye, IconEyeOff, IconFileTypeCsv, IconJson, IconFileTypeSql, IconColumns, IconArrowRight } from '@tabler/icons-vue'
import { useConnectionsStore } from '@/stores/connections'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { Button } from '@/components/ui/button'
import CellValueViewer from '@/components/dialogs/CellValueViewer.vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Props {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  editable?: boolean
  tableName?: string
  readOnlyColumns?: string[]
  foreignKeys?: ForeignKey[]
}

interface CellChange {
  rowIndex: number
  column: string
  originalValue: unknown
  newValue: unknown
}

export interface ApplyChangesPayload {
  edits: CellChange[]
  newRows: Record<string, unknown>[]
  deleteRowIndices: number[]
}

const connectionsStore = useConnectionsStore()

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

const emit = defineEmits<{
  (e: 'apply-changes', payload: ApplyChangesPayload): void
  (e: 'selection-change', selectedIndices: number[]): void
  (e: 'row-activate', row: Record<string, unknown>, rowIndex: number): void
  (e: 'refresh'): void
  (e: 'export-page'): void
  (e: 'paste-rows'): void
  (e: 'import', format: 'csv' | 'json'): void
  (e: 'navigate-fk', fk: ForeignKey, value: unknown): void
}>()

const sorting = ref<SortingState>([])
const copiedCell = ref<string | null>(null)

// Column sizing state
const columnSizing = ref<ColumnSizingState>({})

// Column order state
const columnOrder = ref<ColumnOrderState>([])

// Column visibility state
const columnVisibility = ref<VisibilityState>({})

// Resizing state
const isResizing = ref(false)
const resizingColumnId = ref<string | null>(null)

// Drag and drop state
const draggedColumnId = ref<string | null>(null)
const dragOverColumnId = ref<string | null>(null)

// Editing state
const editingCell = ref<string | null>(null)
const editingDateCell = ref<string | null>(null)
const editValue = ref<string>('')
const pendingChanges = ref<Map<string, CellChange>>(new Map())
const editInputRef = ref<HTMLInputElement[]>([])

// Row selection state
const selectedRows = ref<Set<number>>(new Set())

// Active row state (for right panel)
const activeRowIndex = ref<number | null>(null)

// Cell viewer state
const cellViewerOpen = ref(false)
const cellViewerValue = ref<unknown>(null)
const cellViewerColumnName = ref('')
const cellViewerColumnType = ref('')

// Context menu state
const contextMenuRowIndex = ref<number | null>(null)
const contextMenuColumnId = ref<string | null>(null)

// Pending additions and deletions
const pendingNewRows = ref<Record<string, unknown>[]>([])
const pendingDeleteRows = ref<Set<number>>(new Set())

// Combined rows: original data + pending new rows
const allRows = computed(() => {
  if (pendingNewRows.value.length === 0) return props.rows
  return [...props.rows, ...pendingNewRows.value]
})

// FK lookup map for fast detection
const fkMap = computed(() => {
  const map = new Map<string, ForeignKey>()
  if (props.foreignKeys) {
    for (const fk of props.foreignKeys) {
      map.set(fk.column, fk)
    }
  }
  return map
})

// Undo/Redo stacks
type UndoEntry =
  | { type: 'edit'; cellKey: string; change: CellChange; previousChange: CellChange | undefined }
  | { type: 'add'; count: number }
  | { type: 'mark-delete'; indices: number[] }
  | { type: 'unmark-delete'; indices: number[] }
  | { type: 'delete-new'; items: { index: number; row: Record<string, unknown> }[] }
const undoStack = ref<UndoEntry[]>([])
const redoStack = ref<UndoEntry[]>([])

const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

const columnHelper = createColumnHelper<Record<string, unknown>>()

const hasChanges = computed(() =>
  pendingChanges.value.size > 0 || pendingDeleteRows.value.size > 0 || pendingNewRows.value.length > 0
)

const editedRowCount = computed(() => {
  const rowIndices = new Set<number>()
  for (const change of pendingChanges.value.values()) {
    rowIndices.add(change.rowIndex)
  }
  return rowIndices.size
})

const changesCount = computed(() =>
  editedRowCount.value + pendingDeleteRows.value.size + pendingNewRows.value.length
)

const tableColumns = computed(() => {
  return props.columns.map((col) =>
    columnHelper.accessor(col.name, {
      header: col.name,
      cell: (info) => formatCellValue(info.getValue()),
      size: 150,
      minSize: 50,
      maxSize: 800,
      meta: {
        type: col.type,
        nullable: col.nullable,
        primaryKey: col.primaryKey
      }
    })
  )
})

// Initialize column order when columns change
watch(() => props.columns, (newColumns) => {
  columnOrder.value = newColumns.map(col => col.name)
}, { immediate: true })

const table = useVueTable({
  get data() {
    return allRows.value
  },
  get columns() {
    return tableColumns.value
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get columnSizing() {
      return columnSizing.value
    },
    get columnOrder() {
      return columnOrder.value
    },
    get columnVisibility() {
      return columnVisibility.value
    }
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onColumnSizingChange: (updater) => {
    columnSizing.value = typeof updater === 'function' ? updater(columnSizing.value) : updater
  },
  onColumnOrderChange: (updater) => {
    columnOrder.value = typeof updater === 'function' ? updater(columnOrder.value) : updater
  },
  onColumnVisibilityChange: (updater) => {
    columnVisibility.value = typeof updater === 'function' ? updater(columnVisibility.value) : updater
  },
  columnResizeMode: 'onChange',
  enableColumnResizing: true,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel()
})

// Virtual scrolling
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const ROW_HEIGHT = 28

const rowVirtualizer = useVirtualizer(computed(() => ({
  count: table.getRowModel().rows.length,
  getScrollElement: () => scrollContainerRef.value,
  estimateSize: () => ROW_HEIGHT,
  overscan: 20,
})))

const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())


const getCellClass = (value: unknown, rowIndex: number, columnId: string): string => {
  const cellKey = `${rowIndex}-${columnId}`
  const isModified = pendingChanges.value.has(cellKey)

  let classes = ''

  if (isModified) {
    classes += 'bg-yellow-500/20 '
  }

  if (value === null) classes += 'text-muted-foreground/60 italic '

  return classes.trim()
}

const getRowClass = (rowIndex: number, virtualIndex: number): string[] => {
  const isSelected = selectedRows.value.has(rowIndex)
  const isDeleted = pendingDeleteRows.value.has(rowIndex)
  const isNew = rowIndex >= props.rows.length

  const classes = ['cursor-pointer']

  if (isDeleted) classes.push('line-through')

  if (isSelected) {
    classes.push('bg-blue-500', 'text-white', 'dark:text-white')
  } else if (isDeleted) {
    classes.push('bg-red-500/20', 'text-black', 'dark:text-white')
  } else if (isNew) {
    classes.push('bg-green-500/20 dark:bg-green-500/20', 'text-black dark:text-white')
  } else if (activeRowIndex.value === rowIndex) {
    classes.push('bg-primary/10')
  } else if (virtualIndex % 2 === 1) {
    classes.push('bg-muted/60')
  }

  return classes
}

const AUTO_GENERATED = Symbol('auto')

const displayCellValue = (value: unknown): string => {
  if (value === AUTO_GENERATED) return '(auto)'
  return formatCellValue(value)
}

const getCellValue = (rowIndex: number, columnId: string, originalValue: unknown): unknown => {
  // For new rows, the value is already in allRows via pendingNewRows
  if (rowIndex >= props.rows.length) {
    // Read-only columns in new rows are auto-generated
    if (props.readOnlyColumns?.includes(columnId) && originalValue === undefined) {
      return AUTO_GENERATED
    }
    return originalValue
  }
  const cellKey = `${rowIndex}-${columnId}`
  const change = pendingChanges.value.get(cellKey)
  return change ? change.newValue : originalValue
}

const copyCell = async (value: unknown, cellId: string) => {
  const success = await copyToClipboard(formatCellValue(value), '')
  if (success) {
    copiedCell.value = cellId
    setTimeout(() => { copiedCell.value = null }, 1500)
  }
}

const getSortIcon = (columnId: string) => {
  const sortState = sorting.value.find((s) => s.id === columnId)
  if (!sortState) return IconArrowsSort
  return sortState.desc ? IconArrowDown : IconArrowUp
}

const isSorted = (columnId: string): boolean => {
  return sorting.value.some((s) => s.id === columnId)
}


const getColumnType = (columnId: string): string => {
  const col = props.columns.find(c => c.name === columnId)
  return col?.type ?? ''
}

const isColumnNullable = (columnId: string): boolean => {
  const col = props.columns.find(c => c.name === columnId)
  return col?.nullable ?? false
}

const isBooleanColumn = (columnId: string): boolean => {
  return isBooleanColumnType(getColumnType(columnId))
}

const toggleBooleanCell = (rowIndex: number, columnId: string, currentValue: unknown) => {
  if (!props.editable) return
  if (rowIndex < props.rows.length && props.readOnlyColumns?.includes(columnId)) return
  if (pendingDeleteRows.value.has(rowIndex)) return

  const displayedValue = getCellValue(rowIndex, columnId, currentValue)
  const parsed = parseBooleanValue(displayedValue)
  const nullable = isColumnNullable(columnId)

  // Always toggle between true ↔ false.
  // NULL is only reachable via right-click "Set NULL".
  // If the current value is NULL, the first click sets it to true.
  const nextValue = parsed === true ? 'false' : 'true'

  applyEdit(rowIndex, columnId, currentValue, nextValue)
}

const startEditing = (rowIndex: number, columnId: string, currentValue: unknown) => {
  if (!props.editable) return
  // Read-only columns apply only to existing rows, not new rows
  if (rowIndex < props.rows.length && props.readOnlyColumns?.includes(columnId)) return
  // Don't allow editing deleted rows
  if (pendingDeleteRows.value.has(rowIndex)) return

  const cellKey = `${rowIndex}-${columnId}`

  // For new rows, get value directly
  let valueToEdit: unknown
  if (rowIndex >= props.rows.length) {
    valueToEdit = currentValue
  } else {
    const existingChange = pendingChanges.value.get(cellKey)
    valueToEdit = existingChange ? existingChange.newValue : currentValue
  }

  // Set value BEFORE showing the input so it's ready when the input renders
  if (valueToEdit === null || valueToEdit === undefined) {
    editValue.value = ''
  } else if (isDateValue(valueToEdit)) {
    editValue.value = formatDateTime(valueToEdit)
  } else if (typeof valueToEdit === 'object') {
    editValue.value = JSON.stringify(valueToEdit)
  } else {
    editValue.value = String(valueToEdit)
  }

  // Use date picker for date/datetime/timestamp columns
  const colType = getColumnType(columnId)
  if (isDateColumnType(colType)) {
    editingDateCell.value = cellKey
    editingCell.value = null
    return
  }

  editingCell.value = cellKey

  nextTick(() => {
    const inputs = editInputRef.value
    const input = Array.isArray(inputs) ? inputs[0] : inputs
    if (input && typeof input.focus === 'function') {
      // Ensure the DOM value matches in case v-model didn't sync
      input.value = editValue.value
      input.focus()
      input.select()
    }
  })
}

const applyEdit = (rowIndex: number, columnId: string, originalValue: unknown, rawValue: string) => {
  let newValue: unknown = rawValue

  if (rawValue === 'NULL' || rawValue === 'null') {
    newValue = null
  } else if (rawValue === '' && props.columns.find(c => c.name === columnId)?.nullable) {
    newValue = null
  } else if (typeof originalValue === 'object' && originalValue !== null && !isDateValue(originalValue)) {
    try {
      const parsed = JSON.parse(rawValue)
      // markRaw prevents Vue from wrapping in reactive Proxy, which would fail
      // Electron's contextBridge structured clone when sent through IPC
      newValue = typeof parsed === 'object' && parsed !== null ? markRaw(parsed) : parsed
    } catch {
      // Keep as string if not valid JSON
    }
  }

  // For new rows, update pendingNewRows directly
  if (rowIndex >= props.rows.length) {
    const newRowIdx = rowIndex - props.rows.length
    pendingNewRows.value[newRowIdx] = { ...pendingNewRows.value[newRowIdx], [columnId]: newValue }
    return
  }

  // Existing row: use pendingChanges
  const cellKey = `${rowIndex}-${columnId}`
  const existingChange = pendingChanges.value.get(cellKey)
  const realOriginal = existingChange ? existingChange.originalValue : originalValue

  if (formatCellValue(newValue) !== formatCellValue(realOriginal)) {
    const newChange: CellChange = {
      rowIndex,
      column: columnId,
      originalValue: realOriginal,
      newValue
    }

    undoStack.value.push({
      type: 'edit',
      cellKey,
      change: newChange,
      previousChange: existingChange ? { ...existingChange } : undefined
    })
    redoStack.value = []

    pendingChanges.value.set(cellKey, newChange)
  } else {
    if (existingChange) {
      undoStack.value.push({
        type: 'edit',
        cellKey,
        change: { rowIndex, column: columnId, originalValue: realOriginal, newValue: realOriginal },
        previousChange: { ...existingChange }
      })
      redoStack.value = []
    }
    pendingChanges.value.delete(cellKey)
  }
}

const commitEdit = (rowIndex: number, columnId: string, originalValue: unknown) => {
  if (!editingCell.value) return
  applyEdit(rowIndex, columnId, originalValue, editValue.value)
  editingCell.value = null
  editValue.value = ''
}

const cancelEdit = () => {
  editingCell.value = null
  editingDateCell.value = null
  editValue.value = ''
}

const handleDateSave = (rowIndex: number, columnId: string, originalValue: unknown, value: string | null) => {
  applyEdit(rowIndex, columnId, originalValue, value === null ? 'NULL' : value)
  editingDateCell.value = null
  editValue.value = ''
}

const handleDateCancel = () => {
  editingDateCell.value = null
  editValue.value = ''
}

const navigateToNextCell = (rowIndex: number, currentColumnId: string, reverse: boolean) => {
  const visibleColumns = table.getVisibleLeafColumns()
  const currentIdx = visibleColumns.findIndex(c => c.id === currentColumnId)
  if (currentIdx < 0) return

  const direction = reverse ? -1 : 1
  const isExistingRow = rowIndex < props.rows.length

  for (let i = currentIdx + direction; i >= 0 && i < visibleColumns.length; i += direction) {
    const col = visibleColumns[i]
    if (col.id === '_rowNumber') continue
    if (isExistingRow && props.readOnlyColumns?.includes(col.id)) continue

    // Get the current value for this cell
    const row = table.getRowModel().rows.find(r => r.index === rowIndex)
    const cellValue = row
      ? getCellValue(rowIndex, col.id, row.getValue(col.id))
      : undefined

    nextTick(() => startEditing(rowIndex, col.id, cellValue))
    return
  }
}

const handleKeydown = (event: KeyboardEvent, rowIndex: number, columnId: string, originalValue: unknown) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitEdit(rowIndex, columnId, originalValue)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    commitEdit(rowIndex, columnId, originalValue)
    navigateToNextCell(rowIndex, columnId, event.shiftKey)
  }
}

const applyChanges = () => {
  // Collect edits only for existing rows, excluding deleted rows
  const edits = Array.from(pendingChanges.value.values())
    .filter(c => !pendingDeleteRows.value.has(c.rowIndex))

  emit('apply-changes', {
    edits,
    newRows: [...pendingNewRows.value],
    deleteRowIndices: Array.from(pendingDeleteRows.value).sort((a, b) => a - b)
  })
}

const discardChanges = () => {
  pendingChanges.value.clear()
  pendingDeleteRows.value.clear()
  pendingNewRows.value = []
  editingCell.value = null
  editingDateCell.value = null
  editValue.value = ''
  undoStack.value = []
  redoStack.value = []
}

const undo = () => {
  const entry = undoStack.value.pop()
  if (!entry) return

  if (entry.type === 'edit') {
    if (entry.previousChange) {
      pendingChanges.value.set(entry.cellKey, entry.previousChange)
    } else {
      pendingChanges.value.delete(entry.cellKey)
    }
  } else if (entry.type === 'add') {
    pendingNewRows.value.splice(pendingNewRows.value.length - entry.count, entry.count)
  } else if (entry.type === 'mark-delete') {
    for (const idx of entry.indices) pendingDeleteRows.value.delete(idx)
  } else if (entry.type === 'unmark-delete') {
    for (const idx of entry.indices) pendingDeleteRows.value.add(idx)
  } else if (entry.type === 'delete-new') {
    for (const item of [...entry.items].sort((a, b) => a.index - b.index)) {
      pendingNewRows.value.splice(item.index, 0, item.row)
    }
  }

  redoStack.value.push(entry)
}

const redo = () => {
  const entry = redoStack.value.pop()
  if (!entry) return

  if (entry.type === 'edit') {
    if (formatCellValue(entry.change.newValue) !== formatCellValue(entry.change.originalValue)) {
      pendingChanges.value.set(entry.cellKey, entry.change)
    } else {
      pendingChanges.value.delete(entry.cellKey)
    }
  } else if (entry.type === 'add') {
    for (let i = 0; i < entry.count; i++) {
      const row: Record<string, unknown> = {}
      for (const col of props.columns) row[col.name] = null
      pendingNewRows.value.push(row)
    }
  } else if (entry.type === 'mark-delete') {
    for (const idx of entry.indices) pendingDeleteRows.value.add(idx)
  } else if (entry.type === 'unmark-delete') {
    for (const idx of entry.indices) pendingDeleteRows.value.delete(idx)
  } else if (entry.type === 'delete-new') {
    for (const item of [...entry.items].sort((a, b) => b.index - a.index)) {
      pendingNewRows.value.splice(item.index, 1)
    }
  }

  undoStack.value.push(entry)
}

// Pending operations — all staged, applied together

const duplicateSelectedRows = () => {
  if (selectedRows.value.size === 0) return
  const autoIncrementPks = props.columns.filter(c => c.primaryKey && c.autoIncrement).map(c => c.name)
  const rows = Array.from(selectedRows.value)
    .sort((a, b) => a - b)
    .map(i => {
      const src = allRows.value[i]
      const copy = src ? { ...src } : {}
      for (const pk of autoIncrementPks) copy[pk] = null
      return copy
    })
  pendingNewRows.value.push(...rows)
  undoStack.value.push({ type: 'add', count: rows.length })
  redoStack.value = []
}

const addNewRow = () => {
  const row: Record<string, unknown> = {}
  for (const col of props.columns) {
    if (props.readOnlyColumns?.includes(col.name)) continue
    row[col.name] = null
  }
  pendingNewRows.value.push(row)
  undoStack.value.push({ type: 'add', count: 1 })
  redoStack.value = []
}

const deleteSelectedRows = () => {
  if (selectedRows.value.size === 0) return

  const addedExisting: number[] = []
  const removedExisting: number[] = []
  const removedNew: { index: number; row: Record<string, unknown> }[] = []

  for (const rowIndex of selectedRows.value) {
    if (rowIndex >= props.rows.length) {
      const newIdx = rowIndex - props.rows.length
      removedNew.push({ index: newIdx, row: { ...pendingNewRows.value[newIdx] } })
    } else {
      // Toggle: click delete again to undo
      if (pendingDeleteRows.value.has(rowIndex)) {
        pendingDeleteRows.value.delete(rowIndex)
        removedExisting.push(rowIndex)
      } else {
        pendingDeleteRows.value.add(rowIndex)
        addedExisting.push(rowIndex)
      }
    }
  }

  // Remove new rows in reverse order to maintain indices
  const sortedNewIndices = removedNew.map(r => r.index).sort((a, b) => b - a)
  for (const idx of sortedNewIndices) {
    pendingNewRows.value.splice(idx, 1)
  }

  // Push undo entries
  if (addedExisting.length > 0) {
    undoStack.value.push({ type: 'mark-delete', indices: addedExisting })
  }
  if (removedExisting.length > 0) {
    undoStack.value.push({ type: 'unmark-delete', indices: removedExisting })
  }
  if (removedNew.length > 0) {
    undoStack.value.push({ type: 'delete-new', items: removedNew })
  }
  redoStack.value = []

  selectedRows.value.clear()
  emit('selection-change', [])
}

// Bulk set value for selected cells in a column
const bulkSetColumn = (columnId: string, value: unknown) => {
  if (selectedRows.value.size === 0) return

  for (const rowIndex of selectedRows.value) {
    // For new rows, update directly
    if (rowIndex >= props.rows.length) {
      const newRowIdx = rowIndex - props.rows.length
      pendingNewRows.value[newRowIdx] = { ...pendingNewRows.value[newRowIdx], [columnId]: value }
      continue
    }

    const cellKey = `${rowIndex}-${columnId}`
    const originalValue = props.rows[rowIndex]?.[columnId]
    const existingChange = pendingChanges.value.get(cellKey)
    const realOriginal = existingChange ? existingChange.originalValue : originalValue

    if (formatCellValue(value) !== formatCellValue(realOriginal)) {
      const newChange: CellChange = {
        rowIndex,
        column: columnId,
        originalValue: realOriginal,
        newValue: value
      }

      undoStack.value.push({
        type: 'edit',
        cellKey,
        change: newChange,
        previousChange: existingChange ? { ...existingChange } : undefined
      })

      pendingChanges.value.set(cellKey, newChange)
    }
  }
  redoStack.value = []
}

const clearSelection = () => {
  selectedRows.value.clear()
  activeRowIndex.value = null
  emit('selection-change', [])
}

const handleContainerClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('tr') || target.closest('tr')?.getAttribute('aria-hidden') === 'true') {
    clearSelection()
  }
}

const handleRowClick = (rowIndex: number, event: MouseEvent) => {
  const metaKey = event.metaKey || event.ctrlKey
  const shiftKey = event.shiftKey

  if (shiftKey && activeRowIndex.value !== null) {
    const start = Math.min(activeRowIndex.value, rowIndex)
    const end = Math.max(activeRowIndex.value, rowIndex)
    if (!metaKey) selectedRows.value.clear()
    for (let i = start; i <= end; i++) {
      selectedRows.value.add(i)
    }
  } else if (metaKey) {
    if (selectedRows.value.has(rowIndex)) {
      selectedRows.value.delete(rowIndex)
    } else {
      selectedRows.value.add(rowIndex)
    }
  } else {
    selectedRows.value.clear()
  }

  activeRowIndex.value = rowIndex
  emit('selection-change', Array.from(selectedRows.value))
  emit('row-activate', allRows.value[rowIndex], rowIndex)
}

// Column resizing handlers
const onResizeStart = (columnId: string) => {
  isResizing.value = true
  resizingColumnId.value = columnId
}

const onResizeEnd = () => {
  isResizing.value = false
  resizingColumnId.value = null
}

// Column drag and drop handlers
const onDragStart = (event: DragEvent, columnId: string) => {
  if (!event.dataTransfer) return
  draggedColumnId.value = columnId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', columnId)

  requestAnimationFrame(() => {
    const target = event.target as HTMLElement
    target.classList.add('opacity-50')
  })
}

const onDragEnd = (event: DragEvent) => {
  draggedColumnId.value = null
  dragOverColumnId.value = null
  const target = event.target as HTMLElement
  target.classList.remove('opacity-50')
}

const onDragOver = (event: DragEvent, columnId: string) => {
  event.preventDefault()
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = 'move'
  dragOverColumnId.value = columnId
}

const onDragLeave = () => {
  dragOverColumnId.value = null
}

const onDrop = (event: DragEvent, targetColumnId: string) => {
  event.preventDefault()

  if (!draggedColumnId.value || draggedColumnId.value === targetColumnId) {
    draggedColumnId.value = null
    dragOverColumnId.value = null
    return
  }

  const currentOrder = [...columnOrder.value]
  const draggedIndex = currentOrder.indexOf(draggedColumnId.value)
  const targetIndex = currentOrder.indexOf(targetColumnId)

  if (draggedIndex === -1 || targetIndex === -1) return

  currentOrder.splice(draggedIndex, 1)
  currentOrder.splice(targetIndex, 0, draggedColumnId.value)

  columnOrder.value = currentOrder
  draggedColumnId.value = null
  dragOverColumnId.value = null
}

// Cell viewer
const openCellViewer = (value: unknown, columnId: string) => {
  const colInfo = props.columns.find(c => c.name === columnId)
  cellViewerValue.value = value
  cellViewerColumnName.value = columnId
  cellViewerColumnType.value = colInfo?.type || ''
  cellViewerOpen.value = true
}

const isLongValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  const str = String(value)
  return str.length > 100 || typeof value === 'object'
}

// Column visibility methods
const toggleColumnVisibility = (columnId: string) => {
  const current = columnVisibility.value[columnId] ?? true
  columnVisibility.value = { ...columnVisibility.value, [columnId]: !current }
}

const showAllColumns = () => {
  columnVisibility.value = {}
}

const getColumnVisibility = () => {
  return columnVisibility.value
}

const resetColumnSizes = () => {
  columnSizing.value = {}
}

const resetColumnOrder = () => {
  columnOrder.value = props.columns.map(col => col.name)
}

// Context menu handlers
const handleRowContextMenu = (rowIndex: number, event: MouseEvent) => {
  const target = event.target as HTMLElement
  const td = target.closest('td')
  if (td) {
    const cellIndex = Array.from(td.parentElement?.children || []).indexOf(td)
    const visibleColumns = table.getVisibleLeafColumns()
    if (cellIndex >= 0 && cellIndex < visibleColumns.length) {
      contextMenuColumnId.value = visibleColumns[cellIndex].id
    }
  }

  if (!selectedRows.value.has(rowIndex)) {
    selectedRows.value.clear()
    selectedRows.value.add(rowIndex)
    emit('selection-change', [rowIndex])
  }

  contextMenuRowIndex.value = rowIndex
  activeRowIndex.value = rowIndex
  emit('row-activate', allRows.value[rowIndex], rowIndex)
}

const copySelectedRows = async () => {
  if (selectedRows.value.size === 0) return
  const visibleColumns = table.getVisibleLeafColumns()
  const headers = visibleColumns.map(c => c.id)
  const lines = [headers.join('\t')]
  const sortedIndices = Array.from(selectedRows.value).sort((a, b) => a - b)
  for (const i of sortedIndices) {
    const row = allRows.value[i]
    if (!row) continue
    lines.push(visibleColumns.map(c => formatCellValue(getCellValue(i, c.id, row[c.id]))).join('\t'))
  }
  await copyToClipboard(lines.join('\n'), '')
}

const copyCellValue = async () => {
  if (contextMenuRowIndex.value === null || !contextMenuColumnId.value) return
  const row = allRows.value[contextMenuRowIndex.value]
  if (!row) return
  const value = getCellValue(contextMenuRowIndex.value, contextMenuColumnId.value, row[contextMenuColumnId.value])
  await copyToClipboard(formatCellValue(value), '')
}

const copyAllColumnValues = async () => {
  if (!contextMenuColumnId.value) return
  const colId = contextMenuColumnId.value
  const values = allRows.value.map((row, i) => formatCellValue(getCellValue(i, colId, row[colId])))
  await copyToClipboard(values.join('\n'), '')
}

const copyRowsAs = async (format: 'json' | 'csv' | 'sql' | 'tsv') => {
  if (selectedRows.value.size === 0) return
  const visibleColumns = table.getVisibleLeafColumns()
  const sortedIndices = Array.from(selectedRows.value).sort((a, b) => a - b)

  const getRowData = (i: number) => {
    const row = allRows.value[i]
    if (!row) return {}
    const obj: Record<string, unknown> = {}
    for (const col of visibleColumns) {
      obj[col.id] = getCellValue(i, col.id, row[col.id])
    }
    return obj
  }

  let text = ''
  if (format === 'json') {
    const data = sortedIndices.map(getRowData)
    text = JSON.stringify(data, null, 2)
  } else if (format === 'csv') {
    const headers = visibleColumns.map(c => `"${c.id}"`).join(',')
    const lines = sortedIndices.map(i => {
      const row = getRowData(i)
      return visibleColumns.map(c => {
        const v = row[c.id]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    })
    text = [headers, ...lines].join('\n')
  } else if (format === 'sql') {
    const tableName = props.tableName || 'table_name'
    const colNames = visibleColumns.map(c => `"${c.id}"`).join(', ')
    text = sortedIndices.map(i => {
      const row = getRowData(i)
      const values = visibleColumns.map(c => {
        const v = row[c.id]
        if (v === null) return 'NULL'
        if (typeof v === 'number') return String(v)
        return `'${String(v).replace(/'/g, "''")}'`
      }).join(', ')
      return `INSERT INTO "${tableName}" (${colNames}) VALUES (${values});`
    }).join('\n')
  } else {
    const headers = visibleColumns.map(c => c.id).join('\t')
    const lines = sortedIndices.map(i => {
      const row = getRowData(i)
      return visibleColumns.map(c => formatCellValue(row[c.id])).join('\t')
    })
    text = [headers, ...lines].join('\n')
  }

  await copyToClipboard(text, 'Rows copied')
}

const setValueForSelected = (value: unknown) => {
  if (selectedRows.value.size === 0 || !contextMenuColumnId.value) return
  bulkSetColumn(contextMenuColumnId.value, value)
}

const openQuickLookEditor = () => {
  if (contextMenuRowIndex.value === null || !contextMenuColumnId.value) return
  const row = allRows.value[contextMenuRowIndex.value]
  if (!row) return
  const value = getCellValue(contextMenuRowIndex.value, contextMenuColumnId.value, row[contextMenuColumnId.value])
  openCellViewer(value, contextMenuColumnId.value)
}

const restoreChanges = (
  changes: [string, CellChange][],
  newRows: Record<string, unknown>[],
  deleteRows: number[]
): void => {
  for (const [key, change] of changes) {
    const row = props.rows[change.rowIndex]
    if (!row) continue
    if (String(row[change.column] ?? 'NULL') !== String(change.originalValue ?? 'NULL')) continue
    pendingChanges.value.set(key, change)
  }
  pendingNewRows.value = [...newRows]
  for (const idx of deleteRows) {
    if (idx < props.rows.length) pendingDeleteRows.value.add(idx)
  }
  undoStack.value = []
  redoStack.value = []
}

const restoreGridState = (state: DataGridState): void => {
  if (state.sorting) sorting.value = state.sorting
  if (state.columnSizing) columnSizing.value = state.columnSizing
  if (state.columnOrder?.length) columnOrder.value = state.columnOrder
  if (state.columnVisibility) columnVisibility.value = state.columnVisibility
  if (state.pendingChanges?.length || state.pendingNewRows?.length || state.pendingDeleteRows?.length) {
    restoreChanges(state.pendingChanges ?? [], state.pendingNewRows ?? [], state.pendingDeleteRows ?? [])
  }
}

// Expose methods for parent components
defineExpose({
  clearSelection,
  getSelectedRows: () => Array.from(selectedRows.value),
  resetColumnSizes,
  resetColumnOrder,
  toggleColumnVisibility,
  showAllColumns,
  getColumnVisibility,
  undo,
  redo,
  duplicateSelectedRows,
  addNewRow,
  bulkSetColumn,
  table,
  pendingChanges,
  pendingNewRows,
  pendingDeleteRows,
  hasChanges,
  changesCount,
  applyChanges,
  discardChanges,
  commitEdit,
  startEditing,
  restoreChanges,
  restoreGridState
})

// Clear all pending state when rows change (e.g., after refresh / apply)
watch(() => props.rows, () => {
  pendingChanges.value.clear()
  pendingDeleteRows.value.clear()
  pendingNewRows.value = []
  undoStack.value = []
  redoStack.value = []
  editingCell.value = null
  editingDateCell.value = null
  selectedRows.value.clear()
  activeRowIndex.value = null
})

// Global keyboard shortcut for undo/redo
const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Skip when editing a cell or when not editable (safe mode)
  if (editingCell.value || editingDateCell.value || !props.editable) return

  const isMeta = e.metaKey || e.ctrlKey

  if (isMeta && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if (isMeta && e.key === 'z' && e.shiftKey) {
    e.preventDefault()
    redo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

</script>

<template>
  <div class="flex flex-col h-full">
    <ContextMenu>
      <ContextMenuTrigger as-child>
        <div ref="scrollContainerRef" data-testid="data-grid-scroll-container" class="flex-1 overflow-auto" @click="handleContainerClick">
          <table class="w-full border-collapse text-xs" data-testid="data-grid-table" :style="{ minWidth: table.getCenterTotalSize() + 'px' }">
            <thead class="sticky top-0 z-10 bg-background">
              <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                <th v-for="header in headerGroup.headers" :key="header.id" :data-testid="`grid-header-${header.id}`" :class="[
                  'relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap select-none',
                  dragOverColumnId === header.id ? 'bg-primary/20' : '',
                  draggedColumnId === header.id ? 'opacity-50' : ''
                ]" :style="{ width: `${header.getSize()}px` }" draggable="true"
                  @contextmenu.stop
                  @dragstart="onDragStart($event, header.id)" @dragend="onDragEnd"
                  @dragover="onDragOver($event, header.id)" @dragleave="onDragLeave" @drop="onDrop($event, header.id)">
                  <ContextMenu>
                    <ContextMenuTrigger as-child>
                      <div class="flex items-center gap-1">
                        <IconGripVertical class="h-3.5 w-3.5 text-muted-foreground/50 cursor-move flex-shrink-0" />

                        <div :class="[
                          'flex items-center gap-1.5 flex-1 min-w-0',
                          header.column.getCanSort() ? 'cursor-pointer hover:text-foreground' : ''
                        ]" @click="header.column.getToggleSortingHandler()?.($event)">
                          <span class="truncate">
                            <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
                          </span>
                          <component v-if="header.column.getCanSort()" :is="getSortIcon(header.id)" :data-testid="`grid-sort-indicator-${header.id}`" :class="[
                            'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                            isSorted(header.id) ? 'text-primary' : 'text-muted-foreground/40'
                          ]" />
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent class="w-48">
                      <ContextMenuItem @click="toggleColumnVisibility(header.id)">
                        <IconEyeOff class="h-4 w-4 mr-2" />
                        Hide Column
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem @click="showAllColumns()">
                        <IconEye class="h-4 w-4 mr-2" />
                        Show All Columns
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  <div :class="[
                    'absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none',
                    'hover:bg-primary/50',
                    resizingColumnId === header.id ? 'bg-primary' : 'bg-transparent'
                  ]" @mousedown.stop.prevent="(e) => { onResizeStart(header.id); header.getResizeHandler()(e) }"
                    @touchstart.stop.prevent="(e) => { onResizeStart(header.id); header.getResizeHandler()(e) }"
                    @mouseup="onResizeEnd" @touchend="onResizeEnd" />
                </th>
                <th class="border-b border-border" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="virtualRows.length > 0" aria-hidden="true">
                <td :style="{ height: `${virtualRows[0].start}px`, padding: 0 }" />
              </tr>
              <template v-for="virtualRow in virtualRows" :key="table.getRowModel().rows[virtualRow.index].id">
              <tr v-for="row in [table.getRowModel().rows[virtualRow.index]]" :key="row.id"
                :data-testid="`grid-row-${row.index}`"
                :class="getRowClass(row.index, virtualRow.index)"
                @click="handleRowClick(row.index, $event)"
                @contextmenu="handleRowContextMenu(row.index, $event)">
                <template v-for="cell in row.getVisibleCells()" :key="cell.id">
                <td v-for="cellVal in [getCellValue(row.index, cell.column.id, cell.getValue())]" :key="cell.id" :class="[
                  'border-b border-r border-border',
                  getCellClass(cellVal, row.index, cell.column.id)
                ]" :style="{ width: `${cell.column.getSize()}px`, maxWidth: `${cell.column.getSize()}px` }"
                  :data-testid="`grid-cell-${row.index}-${cell.column.id}`"
                  @dblclick="!isBooleanColumn(cell.column.id) && startEditing(row.index, cell.column.id, cell.getValue())">
                  <div class="relative px-2 py-1">
                    <div class="group flex items-center gap-2"
                      :class="{ 'invisible': editingCell === `${row.index}-${cell.column.id}` || editingDateCell === `${row.index}-${cell.column.id}` }">
                      <Checkbox
                        v-if="isBooleanColumn(cell.column.id)"
                        :model-value="parseBooleanValue(cellVal) === null ? 'indeterminate' : parseBooleanValue(cellVal)!"
                        :disabled="!editable"
                        :class="connectionsStore.privacyMode ? 'blur-sm' : ''"
                        @update:model-value="toggleBooleanCell(row.index, cell.column.id, cell.getValue())"
                        @click.stop
                      />
                      <span v-else class="truncate flex-1" :class="[editable ? 'cursor-text' : '', connectionsStore.privacyMode ? 'blur-sm select-none' : '']">
                        {{ displayCellValue(cellVal) }}
                      </span>
                      <div class="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                        <TooltipProvider v-if="fkMap.get(cell.column.id) && cellVal != null" :delay-duration="300">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <button
                                class="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                @click.stop="emit('navigate-fk', fkMap.get(cell.column.id)!, cellVal)">
                                <IconArrowRight class="h-3.5 w-3.5 text-blue-500" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">View record in {{ fkMap.get(cell.column.id)!.referencedTable }}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <button
                          v-if="isLongValue(cellVal)"
                          class="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          @click.stop="openCellViewer(cellVal, cell.column.id)">
                          <IconMaximize class="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          v-if="!fkMap.has(cell.column.id)"
                          class="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          @click.stop="copyCell(cellVal, cell.id)">
                          <IconCheck v-if="copiedCell === cell.id" class="h-3.5 w-3.5 text-green-500" />
                          <IconCopy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    <input
                      v-if="editingCell === `${row.index}-${cell.column.id}`"
                      ref="editInputRef" v-model="editValue" type="text" data-testid="grid-cell-edit-input"
                      :class="['absolute inset-0 px-2 bg-background border border-primary text-xs text-foreground focus:outline-none', connectionsStore.privacyMode ? 'blur-sm select-none' : '']"
                      @blur="commitEdit(row.index, cell.column.id, cell.getValue())"
                      @keydown="handleKeydown($event, row.index, cell.column.id, cell.getValue())" />

                    <DateCellEditor
                      v-if="editingDateCell === `${row.index}-${cell.column.id}`"
                      :model-value="editValue"
                      :column-type="getColumnType(cell.column.id)"
                      :nullable="isColumnNullable(cell.column.id)"
                      @save="handleDateSave(row.index, cell.column.id, cell.getValue(), $event)"
                      @cancel="handleDateCancel"
                    />

                  </div>
                </td>
                </template>
                <td class="border-b border-border" />
              </tr>
              </template>
              <tr v-if="virtualRows.length > 0" aria-hidden="true">
                <td :style="{ height: `${totalSize - virtualRows[virtualRows.length - 1].end}px`, padding: 0 }" />
              </tr>
            </tbody>
          </table>

          <div v-if="rows.length === 0 && pendingNewRows.length === 0"
            class="flex items-center justify-center py-12 text-muted-foreground">
            No data to display
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent class="w-64">
        <ContextMenuItem @click="openQuickLookEditor">
          <IconEye class="h-4 w-4 mr-2" />
          Quick Look Editor
          <ContextMenuShortcut>&#8984;&#8629;</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem data-testid="grid-ctx-refresh" @click="emit('refresh')">
          <IconRefresh class="h-4 w-4 mr-2" />
          Refresh
          <ContextMenuShortcut>&#8997;&#8984;R</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <template v-if="editable">
          <ContextMenuItem data-testid="grid-ctx-paste" @click="emit('paste-rows')">
            <IconClipboard class="h-4 w-4 mr-2" />
            Paste
            <ContextMenuShortcut>&#8984;V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem data-testid="grid-ctx-add-row" @click="addNewRow">
            <IconPlus class="h-4 w-4 mr-2" />
            Add Row
            <ContextMenuShortcut>&#8984;I</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem @click="duplicateSelectedRows">
            <IconCopyPlus class="h-4 w-4 mr-2" />
            Duplicate
            <ContextMenuShortcut>&#8984;D</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <IconPencil class="h-4 w-4 mr-2" />
              Set Value
              <ContextMenuShortcut>&#8997;&#8629;</ContextMenuShortcut>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent class="w-48">
              <ContextMenuItem @click="setValueForSelected(null)">
                NULL
              </ContextMenuItem>
              <ContextMenuItem @click="setValueForSelected('')">
                Empty String
              </ContextMenuItem>
              <ContextMenuItem @click="setValueForSelected('DEFAULT')">
                DEFAULT
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </template>

        <ContextMenuSeparator />

        <ContextMenuItem @click="copySelectedRows">
          <IconCopy class="h-4 w-4 mr-2" />
          Copy
          <ContextMenuShortcut>&#8984;C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem data-testid="grid-ctx-copy-cell" @click="copyCellValue">
          <IconClipboard class="h-4 w-4 mr-2" />
          Copy Cell Value
          <ContextMenuShortcut>&#8679;&#8984;C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem @click="copyAllColumnValues">
          <IconColumns class="h-4 w-4 mr-2" />
          Copy All Column Values
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <IconCopy class="h-4 w-4 mr-2" />
            Copy Rows As
          </ContextMenuSubTrigger>
          <ContextMenuSubContent class="w-48">
            <ContextMenuItem @click="copyRowsAs('json')">
              <IconJson class="h-4 w-4 mr-2" />
              JSON
            </ContextMenuItem>
            <ContextMenuItem @click="copyRowsAs('csv')">
              <IconFileTypeCsv class="h-4 w-4 mr-2" />
              CSV
            </ContextMenuItem>
            <ContextMenuItem @click="copyRowsAs('sql')">
              <IconFileTypeSql class="h-4 w-4 mr-2" />
              SQL INSERT
            </ContextMenuItem>
            <ContextMenuItem @click="copyRowsAs('tsv')">
              Tab-separated
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <template v-if="editable">
          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <IconUpload class="h-4 w-4 mr-2" />
              Import
            </ContextMenuSubTrigger>
            <ContextMenuSubContent class="w-40">
              <ContextMenuItem @click="emit('import', 'csv')">
                <IconFileTypeCsv class="h-4 w-4 mr-2" />
                CSV
              </ContextMenuItem>
              <ContextMenuItem @click="emit('import', 'json')">
                <IconJson class="h-4 w-4 mr-2" />
                JSON
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </template>

        <ContextMenuItem @click="emit('export-page')">
          <IconDownload class="h-4 w-4 mr-2" />
          Export current page...
        </ContextMenuItem>

        <template v-if="editable">
          <ContextMenuSeparator />

          <ContextMenuItem data-testid="grid-ctx-delete" class="text-red-600 focus:text-red-600 focus:bg-red-500/10" @click="deleteSelectedRows">
            <IconTrash class="h-4 w-4 mr-2" />
            Delete
            <ContextMenuShortcut>&#9003;</ContextMenuShortcut>
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenu>

    <!-- Cell Value Viewer Dialog -->
    <CellValueViewer :open="cellViewerOpen" :value="cellViewerValue" :column-name="cellViewerColumnName"
      :column-type="cellViewerColumnType" @close="cellViewerOpen = false" />
  </div>
</template>