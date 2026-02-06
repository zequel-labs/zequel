<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { sanitizeName } from '@/lib/utils'
import type { Column } from '@/types/table'
import { ColumnChangeStatus } from '@/types/table'
import type { DataTypeInfo } from '@/types/schema-operations'
import { useColumnResize } from '@/composables/useColumnResize'
import { IconTrash, IconArrowBackUp } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props {
  columns: Column[]
  dataTypes: DataTypeInfo[]
  columnStatuses?: ColumnChangeStatus[]
}

const props = withDefaults(defineProps<Props>(), {
  columnStatuses: () => [],
})

const emit = defineEmits<{
  (e: 'remove', index: number): void
}>()

const { columnWidths, resizingColumn, onResizeStart } = useColumnResize({
  name: 200,
  type: 180,
  primaryKey: 100,
  autoIncrement: 120,
  unique: 80,
  nullable: 80,
  default: 150,
  actions: 48
})

// Row styling based on column status
const isDropped = (index: number): boolean =>
  props.columnStatuses?.[index] === ColumnChangeStatus.Dropped

const getRowClass = (index: number): string => {
  switch (props.columnStatuses?.[index]) {
    case ColumnChangeStatus.Added: return 'bg-green-500/10'
    case ColumnChangeStatus.Dropped: return 'bg-red-500/10 line-through opacity-60'
    case ColumnChangeStatus.Modified: return 'bg-yellow-500/5'
    default: return ''
  }
}

// Auto-focus last name input when a column is added
watch(() => props.columns.length, async (newLen, oldLen) => {
  if (newLen > oldLen) {
    await nextTick()
    const inputs = document.querySelectorAll<HTMLInputElement>('[data-col-name-input]')
    const lastInput = inputs[inputs.length - 1]
    lastInput?.focus()
  }
})

const handleNameKeydown = (index: number, event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    (event.target as HTMLInputElement).blur()
  }
}

const handleDefaultKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Enter') {
    (event.target as HTMLInputElement).blur()
  }
}

const updateColumnType = (index: number, typeName: string): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  col.type = typeName

  // Reset dimensional fields based on the new type's metadata
  const typeInfo = props.dataTypes.find(dt => dt.name === typeName)
  if (typeInfo?.hasLength) {
    col.length = typeInfo.defaultLength
    col.precision = undefined
    col.scale = undefined
  } else if (typeInfo?.hasPrecision) {
    col.length = undefined
    col.precision = typeInfo.defaultPrecision
    col.scale = typeInfo.defaultScale
  } else {
    col.length = undefined
    col.precision = undefined
    col.scale = undefined
  }
}

// Type combobox: freetext input + custom dropdown
const activeTypeIndex = ref<number | null>(null)
const typeFilter = ref('')

const typeSuggestions = computed(() =>
  props.dataTypes.map((dt: DataTypeInfo) => {
    if (dt.hasLength && dt.defaultLength != null) {
      return `${dt.name}(${dt.defaultLength})`
    }
    if (dt.hasPrecision && dt.defaultPrecision != null) {
      if (dt.defaultScale != null) {
        return `${dt.name}(${dt.defaultPrecision},${dt.defaultScale})`
      }
      return `${dt.name}(${dt.defaultPrecision})`
    }
    return dt.name
  })
)

const filteredTypeSuggestions = computed(() => {
  if (activeTypeIndex.value === null) return []
  const currentFormatted = formatColumnType(props.columns[activeTypeIndex.value])
  // Show all when text hasn't been changed yet (just focused)
  if (typeFilter.value === currentFormatted) return typeSuggestions.value
  const filter = typeFilter.value.toLowerCase().trim()
  if (!filter) return typeSuggestions.value
  return typeSuggestions.value.filter(s => s.toLowerCase().includes(filter))
})

const formatColumnType = (col: Column): string => {
  const base = col.type
  if (col.length != null) {
    return `${base}(${col.length})`
  }
  if (col.precision != null && col.scale != null) {
    return `${base}(${col.precision},${col.scale})`
  }
  if (col.precision != null) {
    return `${base}(${col.precision})`
  }
  return base
}

const parseTypeString = (raw: string): { type: string; length?: number; precision?: number; scale?: number } => {
  const match = raw.match(/^([\w\s]+?)\s*(?:\((\d+)(?:,\s*(\d+))?\))?\s*$/)
  if (!match) {
    return { type: raw.trim() }
  }

  const typeName = match[1].trim()
  const num1 = match[2] != null ? parseInt(match[2], 10) : undefined
  const num2 = match[3] != null ? parseInt(match[3], 10) : undefined

  const typeInfo = props.dataTypes.find(dt => dt.name.toLowerCase() === typeName.toLowerCase())

  if (typeInfo) {
    if (typeInfo.hasPrecision) {
      return { type: typeInfo.name, precision: num1, scale: num2 }
    }
    if (typeInfo.hasLength) {
      return { type: typeInfo.name, length: num1 }
    }
    return { type: typeInfo.name }
  }

  // Unknown type: single number → length; two numbers → precision,scale
  if (num2 != null) {
    return { type: typeName, precision: num1, scale: num2 }
  }
  return { type: typeName, length: num1 }
}

const commitTypeFromInput = (index: number, rawValue: string): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  const parsed = parseTypeString(rawValue)

  if (parsed.type.toLowerCase() !== col.type.toLowerCase()) {
    updateColumnType(index, parsed.type)
  }

  col.length = parsed.length
  col.precision = parsed.precision
  col.scale = parsed.scale
}

const onTypeFocus = (index: number, event: FocusEvent): void => {
  if (isDropped(index)) return
  activeTypeIndex.value = index
  typeFilter.value = formatColumnType(props.columns[index])
  nextTick(() => (event.target as HTMLInputElement).select())
}

const onTypeBlur = (index: number, event: FocusEvent): void => {
  if (activeTypeIndex.value === null) return
  commitTypeFromInput(index, (event.target as HTMLInputElement).value)
  activeTypeIndex.value = null
}

const selectTypeSuggestion = (index: number, suggestion: string): void => {
  activeTypeIndex.value = null
  commitTypeFromInput(index, suggestion)
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}

const resetTypeInput = (index: number, event: KeyboardEvent): void => {
  activeTypeIndex.value = null
  const input = event.target as HTMLInputElement
  input.value = formatColumnType(props.columns[index])
  input.blur()
}

const togglePrimaryKey = (index: number): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  col.primaryKey = !col.primaryKey
  if (col.primaryKey) {
    col.nullable = false
  }
}

const toggleAutoIncrement = (index: number): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  col.autoIncrement = !col.autoIncrement
}

const toggleUnique = (index: number): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  col.unique = !col.unique
}

const toggleNullable = (index: number): void => {
  if (isDropped(index)) return
  const col = props.columns[index]
  if (!col.primaryKey) {
    col.nullable = !col.nullable
  }
}
</script>

<template>
  <ScrollArea class="flex-1">
    <table class="w-full border-collapse text-xs" :class="{ 'select-none': resizingColumn }" style="table-layout: fixed;">
      <colgroup>
        <col :style="{ width: `${columnWidths.name}px` }" />
        <col :style="{ width: `${columnWidths.type}px` }" />
        <col :style="{ width: `${columnWidths.primaryKey}px` }" />
        <col :style="{ width: `${columnWidths.autoIncrement}px` }" />
        <col :style="{ width: `${columnWidths.unique}px` }" />
        <col :style="{ width: `${columnWidths.nullable}px` }" />
        <col />
        <col :style="{ width: `${columnWidths.actions}px` }" />
      </colgroup>
      <thead class="sticky top-0 z-10 bg-background">
        <tr>
          <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Name
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'name' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('name', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Type
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'type' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('type', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-center font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Primary Key
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'primaryKey' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('primaryKey', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-center font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Auto Increment
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'autoIncrement' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('autoIncrement', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-center font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Unique
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'unique' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('unique', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-center font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Nullable
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'nullable' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('nullable', $event)" />
          </th>
          <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
            Default
            <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
              :class="resizingColumn === 'default' ? 'bg-primary' : 'bg-transparent'"
              @mousedown.stop.prevent="onResizeStart('default', $event)" />
          </th>
          <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap">
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(col, idx) in columns" :key="idx" class="group h-8" :class="getRowClass(idx)">
          <!-- Name -->
          <td class="p-0 border-b border-r border-border">
            <input
              :value="col.name"
              data-col-name-input
              placeholder="column_name"
              :disabled="isDropped(idx)"
              class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              @input="col.name = sanitizeName(($event.target as HTMLInputElement).value)"
              @keydown="handleNameKeydown(idx, $event)"
            />
          </td>
          <!-- Type (freetext combobox with autocomplete) -->
          <td class="p-0 border-b border-r border-border relative">
            <input
              :value="activeTypeIndex === idx ? typeFilter : formatColumnType(col)"
              :disabled="isDropped(idx)"
              class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
              @focus="onTypeFocus(idx, $event)"
              @input="typeFilter = ($event.target as HTMLInputElement).value"
              @blur="onTypeBlur(idx, $event)"
              @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
              @keydown.escape.prevent="resetTypeInput(idx, $event)"
            />
            <div
              v-if="activeTypeIndex === idx && filteredTypeSuggestions.length > 0"
              class="absolute z-50 top-full left-0 w-full max-h-48 overflow-y-auto bg-popover border border-border rounded-b-md shadow-md"
            >
              <div
                v-for="suggestion in filteredTypeSuggestions"
                :key="suggestion"
                class="px-1.5 py-1 text-xs cursor-pointer hover:bg-accent truncate"
                @mousedown.prevent="selectTypeSuggestion(idx, suggestion)"
              >
                {{ suggestion }}
              </div>
            </div>
          </td>
          <!-- Primary Key -->
          <td class="px-1 py-0.5 border-b border-r border-border text-center">
            <input
              type="checkbox"
              :checked="col.primaryKey"
              :disabled="isDropped(idx)"
              class="rounded border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @change="togglePrimaryKey(idx)"
            />
          </td>
          <!-- Auto Increment -->
          <td class="px-1 py-0.5 border-b border-r border-border text-center">
            <input
              type="checkbox"
              :checked="col.autoIncrement"
              :disabled="isDropped(idx)"
              class="rounded border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @change="toggleAutoIncrement(idx)"
            />
          </td>
          <!-- Unique -->
          <td class="px-1 py-0.5 border-b border-r border-border text-center">
            <input
              type="checkbox"
              :checked="col.unique"
              :disabled="col.primaryKey || isDropped(idx)"
              class="rounded border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @change="toggleUnique(idx)"
            />
          </td>
          <!-- Nullable -->
          <td class="px-1 py-0.5 border-b border-r border-border text-center">
            <input
              type="checkbox"
              :checked="col.nullable"
              :disabled="col.primaryKey || isDropped(idx)"
              class="rounded border-input cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @change="toggleNullable(idx)"
            />
          </td>
          <!-- Default -->
          <td class="p-0 border-b border-r border-border">
            <input
              :value="col.defaultValue ?? ''"
              :disabled="isDropped(idx)"
              @input="col.defaultValue = ($event.target as HTMLInputElement).value || null"
              @keydown="handleDefaultKeydown($event)"
              placeholder="NULL"
              class="w-full h-8 px-1.5 text-xs font-mono bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </td>
          <!-- Actions -->
          <td class="px-1 py-0.5 border-b border-border text-center">
            <button
              v-if="isDropped(idx)"
              class="p-1 rounded-md hover:bg-green-500/10"
              title="Restore column"
              @click="emit('remove', idx)"
            >
              <IconArrowBackUp class="h-3.5 w-3.5 text-green-500" />
            </button>
            <button
              v-else
              class="p-1 rounded-md hover:bg-red-500/10"
              title="Remove column"
              @click="emit('remove', idx)"
            >
              <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="columns.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
      No columns added yet. Click "Add Column" to get started.
    </div>
  </ScrollArea>
</template>
