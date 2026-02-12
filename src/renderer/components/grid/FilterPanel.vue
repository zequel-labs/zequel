<script setup lang="ts">
import { computed } from 'vue'
import type { DataFilter, FilterOperator, ColumnInfo } from '@/types/table'
import { IconPlus, IconX, IconSearch } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
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

const operatorGroups: { value: FilterOperator }[][] = [
  [
    { value: '=' },
    { value: '<>' },
    { value: '<' },
    { value: '>' },
    { value: '<=' },
    { value: '>=' },
  ],
  [
    { value: 'IN' },
    { value: 'NOT IN' },
  ],
  [
    { value: 'IS NULL' },
    { value: 'IS NOT NULL' },
  ],
  [
    { value: 'BETWEEN' },
    { value: 'NOT BETWEEN' },
  ],
  [
    { value: 'LIKE' },
    { value: 'ILIKE' },
  ],
  [
    { value: 'Contains' },
    { value: 'Not contains' },
  ],
  [
    { value: 'Contains - Case insensitive' },
    { value: 'Not contains - Case insensitive' },
  ],
  [
    { value: 'Has prefix' },
    { value: 'Has suffix' },
  ],
  [
    { value: 'Has prefix - Case insensitive' },
    { value: 'Has suffix - Case insensitive' },
  ],
]

const nullOperators: FilterOperator[] = ['IS NULL', 'IS NOT NULL']
const arrayOperators: FilterOperator[] = ['IN', 'NOT IN']
const betweenOperators: FilterOperator[] = ['BETWEEN', 'NOT BETWEEN']
const likeOperators: FilterOperator[] = ['LIKE', 'ILIKE']

const isNullOperator = (op: FilterOperator): boolean => nullOperators.includes(op)
const isArrayOperator = (op: FilterOperator): boolean => arrayOperators.includes(op)
const isBetweenOperator = (op: FilterOperator): boolean => betweenOperators.includes(op)
const isLikeOperator = (op: FilterOperator): boolean => likeOperators.includes(op)

const getDisplayValue = (filter: DataFilter): string => {
  if ((isArrayOperator(filter.operator) || isBetweenOperator(filter.operator)) && Array.isArray(filter.value)) {
    return filter.value.join(', ')
  }
  return String(filter.value || '')
}

const parseInputValue = (value: string, operator: FilterOperator): unknown => {
  if (isArrayOperator(operator) || isBetweenOperator(operator)) {
    return value.split(',').map(v => v.trim()).filter(v => v !== '')
  }
  return value
}

// Show real filters or a placeholder row when empty
const displayRows = computed<DataFilter[]>(() => {
  if (props.filters.length > 0) return props.filters
  if (props.columns.length > 0) {
    return [{ column: props.columns[0].name, operator: '=' as FilterOperator, value: '' }]
  }
  return []
})

const isPlaceholder = computed(() => props.filters.length === 0)

const addFilter = () => {
  if (props.columns.length === 0) return
  const newFilter: DataFilter = {
    column: props.columns[0].name,
    operator: '=',
    value: ''
  }
  emit('update:filters', [...props.filters, newFilter])
}

const removeFilter = (index: number) => {
  const newFilters = props.filters.filter((_, i) => i !== index)
  emit('update:filters', newFilters)
}

const updateFilter = (index: number, field: keyof DataFilter, value: unknown) => {
  const newFilters = [...props.filters]
  newFilters[index] = { ...newFilters[index], [field]: value }

  if (field === 'operator') {
    const newOperator = value as FilterOperator
    const currentValue = newFilters[index].value

    const needsArray = isArrayOperator(newOperator) || isBetweenOperator(newOperator)

    if (isNullOperator(newOperator)) {
      newFilters[index].value = ''
    } else if (needsArray && !Array.isArray(currentValue)) {
      const strValue = String(currentValue || '')
      newFilters[index].value = strValue ? [strValue] : []
    } else if (!needsArray && Array.isArray(currentValue)) {
      newFilters[index].value = currentValue.join(', ')
    }
  }

  emit('update:filters', newFilters)
}

// Handle updates for both placeholder and real rows
const handleRowUpdate = (index: number, field: keyof DataFilter, value: unknown) => {
  if (isPlaceholder.value) {
    const defaultRow = displayRows.value[0]
    const newFilter: DataFilter = { ...defaultRow, [field]: value }

    if (field === 'operator') {
      const op = value as FilterOperator
      if (isNullOperator(op)) {
        newFilter.value = ''
      } else if (isArrayOperator(op) || isBetweenOperator(op)) {
        newFilter.value = []
      }
    }

    emit('update:filters', [newFilter])
  } else {
    updateFilter(index, field, value)
  }
}

const handleApply = () => {
  // Materialize placeholder into a real filter before applying
  if (isPlaceholder.value && displayRows.value.length > 0) {
    emit('update:filters', [{ ...displayRows.value[0] }])
  }
  emit('apply')
}
</script>

<template>
  <div data-testid="filter-panel" class="flex items-start gap-2 px-2 py-1.5 border-b bg-muted/40">
    <!-- Filter rows -->
    <div class="flex-1 flex flex-col gap-1.5 min-w-0">
      <div v-for="(row, index) in displayRows" :key="index" class="flex items-center gap-2">
        <!-- Column select -->
        <Select :model-value="row.column" @update:model-value="handleRowUpdate(index, 'column', $event)">
          <SelectTrigger :data-testid="`filter-column-${index}`" class="w-[160px] text-sm shrink-0 !h-auto py-0.5">
            <SelectValue :placeholder="row.column" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="col in columns" :key="col.name" :value="col.name">
              {{ col.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Operator select -->
        <Select :model-value="row.operator" @update:model-value="handleRowUpdate(index, 'operator', $event)">
          <SelectTrigger :data-testid="`filter-operator-${index}`" class="w-auto text-sm shrink-0 !h-auto py-0.5">
            <SelectValue :placeholder="row.operator" />
          </SelectTrigger>
          <SelectContent>
            <template v-for="(group, gIndex) in operatorGroups" :key="gIndex">
              <SelectSeparator v-if="gIndex > 0" />
              <SelectGroup>
                <SelectItem v-for="op in group" :key="op.value" :value="op.value">
                  {{ op.value }}
                </SelectItem>
              </SelectGroup>
            </template>
          </SelectContent>
        </Select>

        <!-- Value input with clear button -->
        <div v-if="!isNullOperator(row.operator)" class="relative flex-1 group">
          <Input :data-testid="`filter-value-${index}`" :model-value="getDisplayValue(row)" type="text"
            :placeholder="isBetweenOperator(row.operator) ? 'value1, value2' : isArrayOperator(row.operator) ? 'value1, value2, ...' : isLikeOperator(row.operator) ? '%pattern%' : 'Enter Value'" class="text-sm pr-8 py-0.5"
            @update:model-value="handleRowUpdate(index, 'value', parseInputValue($event, row.operator))"
            @keydown.enter="handleApply" />
          <button v-if="getDisplayValue(row) !== ''"
            :data-testid="`filter-remove-${index}`"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            @click="removeFilter(index)">
            <IconX class="h-3.5 w-3.5" />
          </button>
        </div>
        <Input v-else disabled placeholder="(no value needed)" class="text-sm flex-1 py-0.5" />

      </div>
    </div>

    <!-- Right: Add and Search buttons -->
    <div class="flex items-center space-x-1 shrink-0">
      <Button data-testid="filter-add-btn" variant="ghost" size="icon" @click="addFilter">
        <IconPlus class="h-4 w-4" />
      </Button>
      <Button data-testid="filter-apply-btn" size="icon" @click="handleApply">
        <IconSearch class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>