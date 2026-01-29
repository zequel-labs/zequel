<script setup lang="ts">
import type { DataFilter, FilterOperator, ColumnInfo } from '@/types/table'
import { IconPlus, IconTrash, IconFilter } from '@tabler/icons-vue'
import Button from '../ui/Button.vue'
import Input from '../ui/Input.vue'

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

const operators: { value: FilterOperator; label: string }[] = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<=', label: 'less or equal' },
  { value: 'LIKE', label: 'contains' },
  { value: 'NOT LIKE', label: 'not contains' },
  { value: 'IN', label: 'in list' },
  { value: 'NOT IN', label: 'not in list' },
  { value: 'IS NULL', label: 'is null' },
  { value: 'IS NOT NULL', label: 'is not null' }
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

  // Handle operator changes
  if (field === 'operator') {
    const newOperator = value as FilterOperator
    const currentValue = newFilters[index].value

    // Clear value if operator is NULL/NOT NULL
    if (isNullOperator(newOperator)) {
      newFilters[index].value = ''
    }
    // Convert to array if switching to IN/NOT IN
    else if (isArrayOperator(newOperator) && !Array.isArray(currentValue)) {
      const strValue = String(currentValue || '')
      newFilters[index].value = strValue ? [strValue] : []
    }
    // Convert from array if switching from IN/NOT IN to other operators
    else if (!isArrayOperator(newOperator) && Array.isArray(currentValue)) {
      newFilters[index].value = currentValue.join(', ')
    }
  }

  emit('update:filters', newFilters)
}

function handleApply() {
  emit('apply')
}

function handleClear() {
  emit('update:filters', [])
  emit('clear')
}
</script>

<template>
  <div class="border-b bg-muted/20 p-3 space-y-3">
    <!-- Filters list -->
    <div v-if="filters.length > 0" class="space-y-2">
      <div
        v-for="(filter, index) in filters"
        :key="index"
        class="flex items-center gap-2"
      >
        <!-- Column select -->
        <select
          :value="filter.column"
          class="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          @change="updateFilter(index, 'column', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="col in columns" :key="col.name" :value="col.name">
            {{ col.name }}
          </option>
        </select>

        <!-- Operator select -->
        <select
          :value="filter.operator"
          class="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          @change="updateFilter(index, 'operator', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="op in operators" :key="op.value" :value="op.value">
            {{ op.label }}
          </option>
        </select>

        <!-- Value input (hidden for NULL operators) -->
        <Input
          v-if="!isNullOperator(filter.operator)"
          :model-value="getDisplayValue(filter)"
          :placeholder="isArrayOperator(filter.operator) ? 'val1, val2, val3...' : 'Value...'"
          class="h-9 w-48"
          @update:model-value="updateFilter(index, 'value', parseInputValue($event, filter.operator))"
          @keydown.enter="handleApply"
        />

        <!-- Remove button -->
        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9 text-muted-foreground hover:text-destructive"
          @click="removeFilter(index)"
        >
          <IconTrash class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex items-center gap-2 text-sm text-muted-foreground py-2"
    >
      <IconFilter class="h-4 w-4" />
      <span>No filters applied. Click "Add Filter" to filter the data.</span>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        @click="addFilter"
      >
        <IconPlus class="h-4 w-4 mr-1" />
        Add Filter
      </Button>

      <div v-if="filters.length > 0" class="flex items-center gap-2 ml-auto">
        <Button
          variant="ghost"
          size="sm"
          @click="handleClear"
        >
          Clear All
        </Button>
        <Button
          size="sm"
          @click="handleApply"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  </div>
</template>
