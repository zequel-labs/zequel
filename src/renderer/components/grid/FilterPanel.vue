<script setup lang="ts">
import { computed } from 'vue'
import type { DataFilter, FilterOperator, ColumnInfo } from '@/types/table'
import { IconPlus, IconTrash, IconFilter, IconX, IconSearch } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface Props {
  columns: ColumnInfo[]
  filters: DataFilter[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:filters', filters: DataFilter[]): void
  (e: 'apply'): void
  (e: 'clear'): void
}>()

const operators: { value: FilterOperator; label: string; icon?: string }[] = [
  { value: '=', label: 'equals (=)' },
  { value: '!=', label: 'not equals (≠)' },
  { value: '>', label: 'greater than (>)' },
  { value: '<', label: 'less than (<)' },
  { value: '>=', label: 'greater or equal (≥)' },
  { value: '<=', label: 'less or equal (≤)' },
  { value: 'LIKE', label: 'contains' },
  { value: 'NOT LIKE', label: 'not contains' },
  { value: 'IN', label: 'in list' },
  { value: 'NOT IN', label: 'not in list' },
  { value: 'IS NULL', label: 'is empty (NULL)' },
  { value: 'IS NOT NULL', label: 'is not empty' }
]

const nullOperators: FilterOperator[] = ['IS NULL', 'IS NOT NULL']
const arrayOperators: FilterOperator[] = ['IN', 'NOT IN']

function isNullOperator(op: FilterOperator): boolean {
  return nullOperators.includes(op)
}

function isArrayOperator(op: FilterOperator): boolean {
  return arrayOperators.includes(op)
}

function getDisplayValue(filter: DataFilter): string {
  if (isArrayOperator(filter.operator) && Array.isArray(filter.value)) {
    return filter.value.join(', ')
  }
  return String(filter.value || '')
}

function parseInputValue(value: string, operator: FilterOperator): unknown {
  if (isArrayOperator(operator)) {
    return value.split(',').map(v => v.trim()).filter(v => v !== '')
  }
  return value
}

function addFilter() {
  if (props.columns.length === 0) return

  const newFilter: DataFilter = {
    column: props.columns[0].name,
    operator: '=',
    value: ''
  }

  emit('update:filters', [...props.filters, newFilter])
}

function removeFilter(index: number) {
  const newFilters = props.filters.filter((_, i) => i !== index)
  emit('update:filters', newFilters)
}

function updateFilter(index: number, field: keyof DataFilter, value: unknown) {
  const newFilters = [...props.filters]
  newFilters[index] = { ...newFilters[index], [field]: value }

  if (field === 'operator') {
    const newOperator = value as FilterOperator
    const currentValue = newFilters[index].value

    if (isNullOperator(newOperator)) {
      newFilters[index].value = ''
    } else if (isArrayOperator(newOperator) && !Array.isArray(currentValue)) {
      const strValue = String(currentValue || '')
      newFilters[index].value = strValue ? [strValue] : []
    } else if (!isArrayOperator(newOperator) && Array.isArray(currentValue)) {
      newFilters[index].value = currentValue.join(', ')
    }
  }

  emit('update:filters', newFilters)
}

// Quick filter functions
function addQuickFilter(column: string, operator: FilterOperator, value?: unknown) {
  const newFilter: DataFilter = {
    column,
    operator,
    value: value ?? ''
  }
  emit('update:filters', [...props.filters, newFilter])
}

// Get column type for smarter input handling
function getColumnType(columnName: string): string {
  const column = props.columns.find(c => c.name === columnName)
  const type = column?.type.toLowerCase() || 'text'

  if (type.includes('int') || type.includes('num') || type.includes('decimal') || type.includes('float') || type.includes('double')) {
    return 'number'
  }
  if (type.includes('date') || type.includes('time')) {
    return 'datetime'
  }
  if (type.includes('bool')) {
    return 'boolean'
  }
  return 'text'
}

// Computed summary
const filterSummary = computed(() => {
  if (props.filters.length === 0) return null
  return props.filters.map(f => {
    const op = operators.find(o => o.value === f.operator)
    const opLabel = op?.label.split(' ')[0] || f.operator
    if (isNullOperator(f.operator)) {
      return `${f.column} ${opLabel}`
    }
    return `${f.column} ${opLabel} "${f.value}"`
  }).join(' AND ')
})

function handleApply() {
  emit('apply')
}

function handleClear() {
  emit('update:filters', [])
  emit('clear')
}
</script>

<template>
  <div class="border-b bg-muted/20">
    <!-- Compact header with summary -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-border/50">
      <IconFilter class="h-4 w-4 text-muted-foreground" />
      <span class="text-sm font-medium">Filters</span>
      <Badge v-if="filters.length > 0" variant="secondary" class="text-xs">
        {{ filters.length }}
      </Badge>
      <span v-if="filterSummary" class="text-xs text-muted-foreground truncate flex-1 ml-2">
        {{ filterSummary }}
      </span>
      <Button
        v-if="filters.length > 0"
        variant="ghost"
        size="sm"
        class="h-7 text-xs ml-auto"
        @click="handleClear"
      >
        <IconX class="h-3 w-3 mr-1" />
        Clear
      </Button>
    </div>

    <div class="p-3 space-y-3">
      <!-- Quick filters for common operations -->
      <div v-if="filters.length === 0 && columns.length > 0" class="flex flex-wrap gap-2">
        <span class="text-xs text-muted-foreground self-center">Quick filters:</span>
        <Button
          v-for="col in columns.slice(0, 3)"
          :key="`quick-${col.name}`"
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          @click="addQuickFilter(col.name, '=')"
        >
          <IconSearch class="h-3 w-3 mr-1" />
          {{ col.name }}
        </Button>
        <Button
          v-if="columns.length > 3"
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          @click="addFilter"
        >
          <IconPlus class="h-3 w-3 mr-1" />
          Custom
        </Button>
      </div>

      <!-- Filter rows -->
      <div v-if="filters.length > 0" class="space-y-2">
        <div
          v-for="(filter, index) in filters"
          :key="index"
          class="flex items-center gap-2 p-2 rounded-lg bg-background border"
        >
          <!-- AND badge for multiple filters -->
          <Badge
            v-if="index > 0"
            variant="outline"
            class="text-[10px] px-1.5 py-0 h-5 font-medium text-muted-foreground"
          >
            AND
          </Badge>

          <!-- Column select -->
          <Select
            :model-value="filter.column"
            @update:model-value="updateFilter(index, 'column', $event)"
          >
            <SelectTrigger class="h-8 w-auto text-xs">
              <SelectValue :placeholder="filter.column" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="col in columns" :key="col.name" :value="col.name" class="text-xs">
                {{ col.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Operator select -->
          <Select
            :model-value="filter.operator"
            @update:model-value="updateFilter(index, 'operator', $event)"
          >
            <SelectTrigger class="h-8 w-auto text-xs">
              <SelectValue :placeholder="filter.operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in operators" :key="op.value" :value="op.value" class="text-xs">
                {{ op.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Value input -->
          <div v-if="!isNullOperator(filter.operator)" class="flex-1 min-w-[150px]">
            <Input
              :model-value="getDisplayValue(filter)"
              :type="getColumnType(filter.column) === 'number' ? 'number' : 'text'"
              :placeholder="isArrayOperator(filter.operator) ? 'value1, value2, value3' : 'Enter value...'"
              class="h-8 text-xs"
              @update:model-value="updateFilter(index, 'value', parseInputValue($event, filter.operator))"
              @keydown.enter="handleApply"
            />
          </div>
          <span v-else class="flex-1 text-xs text-muted-foreground italic">
            (no value needed)
          </span>

          <!-- Remove button -->
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            @click="removeFilter(index)"
          >
            <IconTrash class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="filters.length === 0 && columns.length === 0"
        class="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4"
      >
        <IconFilter class="h-4 w-4" />
        <span>No columns available for filtering</span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          class="h-8"
          @click="addFilter"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Filter
        </Button>

        <div v-if="filters.length > 0" class="flex items-center gap-2 ml-auto">
          <span class="text-xs text-muted-foreground">
            Press Enter to apply
          </span>
          <Button
            size="sm"
            class="h-8"
            @click="handleApply"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
