<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
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
import { IconArrowUp, IconArrowDown, IconArrowsSort, IconCopy, IconCheck, IconDeviceFloppy, IconX, IconPencil, IconGripVertical, IconMaximize, IconArrowBackUp, IconArrowForwardUp, IconCopyPlus } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import CellValueViewer from '@/components/dialogs/CellValueViewer.vue'

interface Props {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  editable?: boolean
  tableName?: string
  showSelection?: boolean
}

interface CellChange {
  rowIndex: number
  column: string
  originalValue: unknown
  newValue: unknown
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
  showSelection: false
})

const emit = defineEmits<{
  (e: 'apply-changes', changes: CellChange[]): void
  (e: 'selection-change', selectedIndices: number[]): void
  (e: 'duplicate-rows', rows: Record<string, unknown>[]): void
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
const editingCell = ref<string | null>(null) // Format: "rowIndex-columnName"
const editValue = ref<string>('')
const pendingChanges = ref<Map<string, CellChange>>(new Map())
const editInputRef = ref<HTMLInputElement[]>([])

// Row selection state
const selectedRows = ref<Set<number>>(new Set())

// Cell viewer state
const cellViewerOpen = ref(false)
const cellViewerValue = ref<unknown>(null)
const cellViewerColumnName = ref('')
const cellViewerColumnType = ref('')

// Undo/Redo stacks
interface UndoEntry {
  type: 'edit'
  cellKey: string
  change: CellChange
  previousChange: CellChange | undefined
}
const undoStack = ref<UndoEntry[]>([])
const redoStack = ref<UndoEntry[]>([])

const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

const columnHelper = createColumnHelper<Record<string, unknown>>()

const hasChanges = computed(() => pendingChanges.value.size > 0)

const changesCount = computed(() => pendingChanges.value.size)

const allSelected = computed(() => {
  return props.rows.length > 0 && selectedRows.value.size === props.rows.length
})

const someSelected = computed(() => {
  return selectedRows.value.size > 0 && selectedRows.value.size < props.rows.length
})

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
    return props.rows
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

function formatCellValue(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function getCellClass(value: unknown, rowIndex: number, columnId: string): string {
  const cellKey = `${rowIndex}-${columnId}`
  const isModified = pendingChanges.value.has(cellKey)

  let classes = ''

  if (isModified) {
    classes += 'bg-yellow-500/20 '
  }

  if (value === null) classes += 'text-muted-foreground/60 italic '
  else if (typeof value === 'number') classes += 'text-blue-500 font-mono '
  else if (typeof value === 'boolean') classes += 'text-purple-500 '

  return classes.trim()
}

function getCellValue(rowIndex: number, columnId: string, originalValue: unknown): unknown {
  const cellKey = `${rowIndex}-${columnId}`
  const change = pendingChanges.value.get(cellKey)
  return change ? change.newValue : originalValue
}

async function copyCell(value: unknown, cellId: string) {
  await navigator.clipboard.writeText(formatCellValue(value))
  copiedCell.value = cellId
  setTimeout(() => {
    copiedCell.value = null
  }, 1500)
}

function getSortIcon(columnId: string) {
  const sortState = sorting.value.find((s) => s.id === columnId)
  if (!sortState) return IconArrowsSort
  return sortState.desc ? IconArrowDown : IconArrowUp
}

function startEditing(rowIndex: number, columnId: string, currentValue: unknown) {
  if (!props.editable) return

  const cellKey = `${rowIndex}-${columnId}`
  editingCell.value = cellKey

  // Check if there's a pending change for this cell
  const existingChange = pendingChanges.value.get(cellKey)
  const valueToEdit = existingChange ? existingChange.newValue : currentValue

  // Show empty string for null values, not "NULL"
  if (valueToEdit === null || valueToEdit === undefined) {
    editValue.value = ''
  } else {
    editValue.value = String(valueToEdit)
  }

  // Focus input after render
  nextTick(() => {
    // editInputRef is an array when inside v-for, get the first (and only) input
    const inputs = editInputRef.value
    const input = Array.isArray(inputs) ? inputs[0] : inputs
    if (input && typeof input.focus === 'function') {
      input.focus()
      input.select()
    }
  })
}

function commitEdit(rowIndex: number, columnId: string, originalValue: unknown) {
  if (!editingCell.value) return

  const cellKey = `${rowIndex}-${columnId}`
  let newValue: unknown = editValue.value

  // Handle special values
  if (editValue.value === 'NULL' || editValue.value === 'null') {
    newValue = null
  } else if (editValue.value === '' && props.columns.find(c => c.name === columnId)?.nullable) {
    newValue = null
  }

  // Get the real original value (not from pending changes)
  const existingChange = pendingChanges.value.get(cellKey)
  const realOriginal = existingChange ? existingChange.originalValue : originalValue

  // Check if value actually changed from original
  if (formatCellValue(newValue) !== formatCellValue(realOriginal)) {
    const newChange: CellChange = {
      rowIndex,
      column: columnId,
      originalValue: realOriginal,
      newValue
    }

    // Push to undo stack
    undoStack.value.push({
      type: 'edit',
      cellKey,
      change: newChange,
      previousChange: existingChange ? { ...existingChange } : undefined
    })
    redoStack.value = [] // Clear redo on new edit

    pendingChanges.value.set(cellKey, newChange)
  } else {
    // Value reverted to original
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

  editingCell.value = null
  editValue.value = ''
}

function cancelEdit() {
  editingCell.value = null
  editValue.value = ''
}

function handleKeydown(event: KeyboardEvent, rowIndex: number, columnId: string, originalValue: unknown) {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitEdit(rowIndex, columnId, originalValue)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelEdit()
  } else if (event.key === 'Tab') {
    event.preventDefault()
    commitEdit(rowIndex, columnId, originalValue)
    // TODO: Move to next cell
  }
}

function applyChanges() {
  const changes = Array.from(pendingChanges.value.values())
  emit('apply-changes', changes)
}

function discardChanges() {
  pendingChanges.value.clear()
  editingCell.value = null
  editValue.value = ''
  undoStack.value = []
  redoStack.value = []
}

function undo() {
  const entry = undoStack.value.pop()
  if (!entry) return

  if (entry.previousChange) {
    pendingChanges.value.set(entry.cellKey, entry.previousChange)
  } else {
    pendingChanges.value.delete(entry.cellKey)
  }

  redoStack.value.push(entry)
}

function redo() {
  const entry = redoStack.value.pop()
  if (!entry) return

  if (formatCellValue(entry.change.newValue) !== formatCellValue(entry.change.originalValue)) {
    pendingChanges.value.set(entry.cellKey, entry.change)
  } else {
    pendingChanges.value.delete(entry.cellKey)
  }

  undoStack.value.push(entry)
}

function duplicateSelectedRows() {
  if (selectedRows.value.size === 0) return
  const rows = Array.from(selectedRows.value)
    .sort((a, b) => a - b)
    .map(i => ({ ...props.rows[i] }))
  emit('duplicate-rows', rows)
}

// Bulk set value for selected cells in a column
function bulkSetColumn(columnId: string, value: unknown) {
  if (selectedRows.value.size === 0) return

  for (const rowIndex of selectedRows.value) {
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

// Row selection methods
function toggleRow(rowIndex: number) {
  if (selectedRows.value.has(rowIndex)) {
    selectedRows.value.delete(rowIndex)
  } else {
    selectedRows.value.add(rowIndex)
  }
  emit('selection-change', Array.from(selectedRows.value))
}

function toggleAllRows() {
  if (allSelected.value) {
    selectedRows.value.clear()
  } else {
    selectedRows.value = new Set(props.rows.map((_, i) => i))
  }
  emit('selection-change', Array.from(selectedRows.value))
}

function clearSelection() {
  selectedRows.value.clear()
  emit('selection-change', [])
}

// Column resizing handlers
function onResizeStart(columnId: string) {
  isResizing.value = true
  resizingColumnId.value = columnId
}

function onResizeEnd() {
  isResizing.value = false
  resizingColumnId.value = null
}

// Column drag and drop handlers
function onDragStart(event: DragEvent, columnId: string) {
  if (!event.dataTransfer) return
  draggedColumnId.value = columnId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', columnId)

  // Add a slight delay to show drag styling
  requestAnimationFrame(() => {
    const target = event.target as HTMLElement
    target.classList.add('opacity-50')
  })
}

function onDragEnd(event: DragEvent) {
  draggedColumnId.value = null
  dragOverColumnId.value = null
  const target = event.target as HTMLElement
  target.classList.remove('opacity-50')
}

function onDragOver(event: DragEvent, columnId: string) {
  event.preventDefault()
  if (!event.dataTransfer) return
  event.dataTransfer.dropEffect = 'move'
  dragOverColumnId.value = columnId
}

function onDragLeave() {
  dragOverColumnId.value = null
}

function onDrop(event: DragEvent, targetColumnId: string) {
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

  // Remove dragged column and insert at target position
  currentOrder.splice(draggedIndex, 1)
  currentOrder.splice(targetIndex, 0, draggedColumnId.value)

  columnOrder.value = currentOrder
  draggedColumnId.value = null
  dragOverColumnId.value = null
}

// Cell viewer
function openCellViewer(value: unknown, columnId: string) {
  const colInfo = props.columns.find(c => c.name === columnId)
  cellViewerValue.value = value
  cellViewerColumnName.value = columnId
  cellViewerColumnType.value = colInfo?.type || ''
  cellViewerOpen.value = true
}

function isLongValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const str = String(value)
  return str.length > 100 || typeof value === 'object'
}

// Column visibility methods
function toggleColumnVisibility(columnId: string) {
  const current = columnVisibility.value[columnId] ?? true
  columnVisibility.value = { ...columnVisibility.value, [columnId]: !current }
}

function showAllColumns() {
  columnVisibility.value = {}
}

function getColumnVisibility() {
  return columnVisibility.value
}

// Reset column sizes
function resetColumnSizes() {
  columnSizing.value = {}
}

// Reset column order
function resetColumnOrder() {
  columnOrder.value = props.columns.map(col => col.name)
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
  bulkSetColumn,
  table
})

// Clear pending changes and selection when rows change (e.g., after refresh)
watch(() => props.rows, () => {
  pendingChanges.value.clear()
  editingCell.value = null
  selectedRows.value.clear()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Changes toolbar -->
    <div
      v-if="hasChanges || selectedRows.size > 0"
      class="flex items-center justify-between px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30"
    >
      <div class="flex items-center gap-2 text-sm">
        <template v-if="hasChanges">
          <IconPencil class="h-4 w-4 text-yellow-600" />
          <span class="text-yellow-700 dark:text-yellow-400">
            {{ changesCount }} {{ changesCount === 1 ? 'change' : 'changes' }} pending
          </span>
        </template>
        <template v-if="selectedRows.size > 0">
          <span class="text-muted-foreground">{{ selectedRows.size }} row{{ selectedRows.size > 1 ? 's' : '' }} selected</span>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="canUndo"
          variant="ghost"
          size="sm"
          title="Undo (Cmd+Z)"
          @click="undo"
        >
          <IconArrowBackUp class="h-4 w-4" />
        </Button>
        <Button
          v-if="canRedo"
          variant="ghost"
          size="sm"
          title="Redo (Cmd+Shift+Z)"
          @click="redo"
        >
          <IconArrowForwardUp class="h-4 w-4" />
        </Button>
        <Button
          v-if="selectedRows.size > 0 && editable"
          variant="ghost"
          size="sm"
          @click="duplicateSelectedRows"
        >
          <IconCopyPlus class="h-4 w-4 mr-1" />
          Duplicate
        </Button>
        <template v-if="hasChanges">
          <Button
            variant="outline"
            size="sm"
            @click="discardChanges"
          >
            <IconX class="h-4 w-4 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            @click="applyChanges"
          >
            <IconDeviceFloppy class="h-4 w-4 mr-1" />
            Apply Changes
          </Button>
        </template>
      </div>
    </div>

    <ScrollArea class="flex-1" orientation="both">
      <table class="w-full border-collapse text-sm" :style="{ width: table.getCenterTotalSize() + 'px' }">
        <thead class="sticky top-0 z-10 bg-muted">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <!-- Selection checkbox header -->
            <th
              v-if="showSelection"
              class="px-3 py-2 text-center font-medium border-b border-r border-border w-10"
            >
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected"
                class="rounded border-input cursor-pointer"
                @change="toggleAllRows"
              />
            </th>
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="[
                'relative px-3 py-2 text-left font-medium border-b border-r border-border whitespace-nowrap select-none',
                dragOverColumnId === header.id ? 'bg-primary/20' : '',
                draggedColumnId === header.id ? 'opacity-50' : ''
              ]"
              :style="{ width: `${header.getSize()}px` }"
              draggable="true"
              @dragstart="onDragStart($event, header.id)"
              @dragend="onDragEnd"
              @dragover="onDragOver($event, header.id)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, header.id)"
            >
              <div class="flex items-center gap-1">
                <!-- Drag handle -->
                <IconGripVertical
                  class="h-3.5 w-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing flex-shrink-0"
                />

                <!-- Header content (clickable for sorting) -->
                <div
                  :class="[
                    'flex items-center gap-2 flex-1 min-w-0',
                    header.column.getCanSort() ? 'cursor-pointer hover:text-foreground' : ''
                  ]"
                  @click="header.column.getToggleSortingHandler()?.($event)"
                >
                  <span class="truncate">
                    <FlexRender
                      :render="header.column.columnDef.header"
                      :props="header.getContext()"
                    />
                  </span>
                  <component
                    v-if="header.column.getCanSort()"
                    :is="getSortIcon(header.id)"
                    class="h-4 w-4 text-muted-foreground flex-shrink-0"
                  />
                </div>
              </div>

              <!-- Resize handle -->
              <div
                :class="[
                  'absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none',
                  'hover:bg-primary/50',
                  resizingColumnId === header.id ? 'bg-primary' : 'bg-transparent'
                ]"
                @mousedown.stop.prevent="(e) => { onResizeStart(header.id); header.getResizeHandler()(e) }"
                @touchstart.stop.prevent="(e) => { onResizeStart(header.id); header.getResizeHandler()(e) }"
                @mouseup="onResizeEnd"
                @touchend="onResizeEnd"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :class="[
              'hover:bg-muted/30 transition-colors',
              selectedRows.has(row.index) ? 'bg-primary/5' : ''
            ]"
          >
            <!-- Selection checkbox cell -->
            <td
              v-if="showSelection"
              class="px-3 py-2 text-center border-b border-r border-border bg-muted/30"
            >
              <input
                type="checkbox"
                :checked="selectedRows.has(row.index)"
                class="rounded border-input cursor-pointer"
                @change="toggleRow(row.index)"
              />
            </td>
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :class="[
                'px-3 py-2 border-b border-r border-border',
                getCellClass(getCellValue(row.index, cell.column.id, cell.getValue()), row.index, cell.column.id)
              ]"
              :style="{ width: `${cell.column.getSize()}px`, maxWidth: `${cell.column.getSize()}px` }"
              @dblclick="startEditing(row.index, cell.column.id, cell.getValue())"
            >
              <!-- Editing mode -->
              <input
                v-if="editingCell === `${row.index}-${cell.column.id}`"
                ref="editInputRef"
                v-model="editValue"
                type="text"
                class="w-full px-1 py-0.5 -my-0.5 bg-background border border-primary rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                @blur="commitEdit(row.index, cell.column.id, cell.getValue())"
                @keydown="handleKeydown($event, row.index, cell.column.id, cell.getValue())"
              />

              <!-- Display mode -->
              <div v-else class="group flex items-center gap-2">
                <span
                  class="truncate"
                  :class="{ 'cursor-text': editable }"
                >
                  {{ formatCellValue(getCellValue(row.index, cell.column.id, cell.getValue())) }}
                </span>
                <div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0">
                  <button
                    v-if="isLongValue(getCellValue(row.index, cell.column.id, cell.getValue()))"
                    class="p-0.5 hover:bg-muted rounded transition-opacity"
                    @click.stop="openCellViewer(getCellValue(row.index, cell.column.id, cell.getValue()), cell.column.id)"
                  >
                    <IconMaximize class="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    class="p-0.5 hover:bg-muted rounded transition-opacity"
                    @click.stop="copyCell(getCellValue(row.index, cell.column.id, cell.getValue()), cell.id)"
                  >
                    <IconCheck v-if="copiedCell === cell.id" class="h-3.5 w-3.5 text-green-500" />
                    <IconCopy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="rows.length === 0"
        class="flex items-center justify-center py-12 text-muted-foreground"
      >
        No data to display
      </div>
    </ScrollArea>

    <!-- Cell Value Viewer Dialog -->
    <CellValueViewer
      :open="cellViewerOpen"
      :value="cellViewerValue"
      :column-name="cellViewerColumnName"
      :column-type="cellViewerColumnType"
      @close="cellViewerOpen = false"
    />
  </div>
</template>
