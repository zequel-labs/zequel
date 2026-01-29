<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  useVueTable,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  FlexRender
} from '@tanstack/vue-table'
import type { ColumnInfo } from '@/types/query'
import { IconArrowUp, IconArrowDown, IconArrowsSort, IconCopy, IconCheck, IconDeviceFloppy, IconX, IconPencil } from '@tabler/icons-vue'
import ScrollArea from '../ui/ScrollArea.vue'
import Button from '../ui/Button.vue'

interface Props {
  columns: ColumnInfo[]
  rows: Record<string, unknown>[]
  showRowNumbers?: boolean
  editable?: boolean
  tableName?: string
}

interface CellChange {
  rowIndex: number
  column: string
  originalValue: unknown
  newValue: unknown
}

const props = withDefaults(defineProps<Props>(), {
  showRowNumbers: true,
  editable: false
})

const emit = defineEmits<{
  (e: 'apply-changes', changes: CellChange[]): void
}>()

const sorting = ref<SortingState>([])
const copiedCell = ref<string | null>(null)

// Editing state
const editingCell = ref<string | null>(null) // Format: "rowIndex-columnName"
const editValue = ref<string>('')
const pendingChanges = ref<Map<string, CellChange>>(new Map())
const editInputRef = ref<HTMLInputElement[]>([])

const columnHelper = createColumnHelper<Record<string, unknown>>()

const hasChanges = computed(() => pendingChanges.value.size > 0)

const changesCount = computed(() => pendingChanges.value.size)

const tableColumns = computed(() => {
  const cols = props.columns.map((col) =>
    columnHelper.accessor(col.name, {
      header: col.name,
      cell: (info) => formatCellValue(info.getValue()),
      meta: {
        type: col.type,
        nullable: col.nullable,
        primaryKey: col.primaryKey
      }
    })
  )

  if (props.showRowNumbers) {
    cols.unshift(
      columnHelper.display({
        id: '_rowNumber',
        header: '#',
        cell: (info) => info.row.index + 1,
        size: 50
      })
    )
  }

  return cols
})

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
    }
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
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
  if (!props.editable || columnId === '_rowNumber') return

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
    pendingChanges.value.set(cellKey, {
      rowIndex,
      column: columnId,
      originalValue: realOriginal,
      newValue
    })
  } else {
    // Value reverted to original, remove from pending changes
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
}

// Clear pending changes when rows change (e.g., after refresh)
watch(() => props.rows, () => {
  pendingChanges.value.clear()
  editingCell.value = null
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Changes toolbar -->
    <div
      v-if="hasChanges"
      class="flex items-center justify-between px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/30"
    >
      <div class="flex items-center gap-2 text-sm">
        <IconPencil class="h-4 w-4 text-yellow-600" />
        <span class="text-yellow-700 dark:text-yellow-400">
          {{ changesCount }} {{ changesCount === 1 ? 'change' : 'changes' }} pending
        </span>
      </div>
      <div class="flex items-center gap-2">
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
      </div>
    </div>

    <ScrollArea class="flex-1" orientation="both">
      <table class="w-full border-collapse text-sm">
        <thead class="sticky top-0 z-10 bg-muted">
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :class="[
                'px-3 py-2 text-left font-medium border-b border-r border-border whitespace-nowrap',
                header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-muted/80' : ''
              ]"
              :style="{ width: header.getSize() !== 150 ? `${header.getSize()}px` : undefined }"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-2">
                <FlexRender
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <component
                  v-if="header.column.getCanSort()"
                  :is="getSortIcon(header.id)"
                  class="h-4 w-4 text-muted-foreground"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            class="hover:bg-muted/30 transition-colors"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :class="[
                'px-3 py-2 border-b border-r border-border',
                cell.column.id === '_rowNumber' ? 'text-muted-foreground text-center bg-muted/30' : '',
                getCellClass(getCellValue(row.index, cell.column.id, cell.getValue()), row.index, cell.column.id)
              ]"
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
                  class="truncate max-w-[400px]"
                  :class="{ 'cursor-text': editable && cell.column.id !== '_rowNumber' }"
                >
                  {{ formatCellValue(getCellValue(row.index, cell.column.id, cell.getValue())) }}
                </span>
                <button
                  v-if="cell.column.id !== '_rowNumber'"
                  class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
                  @click.stop="copyCell(getCellValue(row.index, cell.column.id, cell.getValue()), cell.id)"
                >
                  <IconCheck v-if="copiedCell === cell.id" class="h-3.5 w-3.5 text-green-500" />
                  <IconCopy v-else class="h-3.5 w-3.5 text-muted-foreground" />
                </button>
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
  </div>
</template>
