<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { IconFilter, IconX } from '@tabler/icons-vue'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface Props {
  columnId: string
  columnType: string
  filterValue?: {
    operator: string
    value: string
  }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'apply', filter: { operator: string; value: string }): void
  (e: 'clear'): void
}>()

const isOpen = ref(false)
const operator = ref('contains')
const filterInput = ref('')

// Determine if the column is numeric based on its SQL type
const isNumericColumn = computed(() => {
  const t = props.columnType.toLowerCase()
  return (
    t.includes('int') ||
    t.includes('num') ||
    t.includes('decimal') ||
    t.includes('float') ||
    t.includes('double') ||
    t.includes('real') ||
    t.includes('money') ||
    t.includes('serial')
  )
})

const hasActiveFilter = computed(() => !!props.filterValue)

const textOperators = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'startsWith', label: 'Starts with' },
  { value: 'endsWith', label: 'Ends with' },
  { value: 'isNull', label: 'IS NULL' },
  { value: 'isNotNull', label: 'IS NOT NULL' }
]

const numberOperators = [
  { value: 'eq', label: '= (equals)' },
  { value: 'neq', label: '!= (not equals)' },
  { value: 'gt', label: '> (greater than)' },
  { value: 'lt', label: '< (less than)' },
  { value: 'gte', label: '>= (greater or equal)' },
  { value: 'lte', label: '<= (less or equal)' },
  { value: 'isNull', label: 'IS NULL' },
  { value: 'isNotNull', label: 'IS NOT NULL' }
]

const operators = computed(() => {
  return isNumericColumn.value ? numberOperators : textOperators
})

const isNullOperator = computed(() => {
  return operator.value === 'isNull' || operator.value === 'isNotNull'
})

// Sync local state when external filter changes
watch(
  () => props.filterValue,
  (val) => {
    if (val) {
      operator.value = val.operator
      filterInput.value = val.value
    } else {
      operator.value = isNumericColumn.value ? 'eq' : 'contains'
      filterInput.value = ''
    }
  },
  { immediate: true }
)

// Reset operator default when popover opens with no filter
watch(isOpen, (open) => {
  if (open && !props.filterValue) {
    operator.value = isNumericColumn.value ? 'eq' : 'contains'
    filterInput.value = ''
  }
})

const applyFilter = () => {
  if (isNullOperator.value) {
    emit('apply', { operator: operator.value, value: '' })
  } else if (filterInput.value.trim() !== '') {
    emit('apply', { operator: operator.value, value: filterInput.value.trim() })
  }
  isOpen.value = false
}

const clearFilter = () => {
  operator.value = isNumericColumn.value ? 'eq' : 'contains'
  filterInput.value = ''
  emit('clear')
  isOpen.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    applyFilter()
  }
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        :class="[
          'p-0.5 rounded transition-colors flex-shrink-0',
          hasActiveFilter
            ? 'text-primary hover:text-primary/80'
            : 'text-muted-foreground/50 hover:text-muted-foreground'
        ]"
        @click.stop
      >
        <span v-if="hasActiveFilter" class="relative">
          <IconFilter class="h-3.5 w-3.5" />
          <span class="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
        </span>
        <IconFilter v-else class="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      class="w-64 p-3"
      :side-offset="8"
      align="start"
      @click.stop
    >
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Filter: {{ columnId }}</span>
          <button
            v-if="hasActiveFilter"
            class="text-xs text-muted-foreground hover:text-foreground"
            @click="clearFilter"
          >
            Clear
          </button>
        </div>

        <!-- Operator select -->
        <Select v-model="operator">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="op in operators"
              :key="op.value"
              :value="op.value"
              class="text-xs"
            >
              {{ op.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Value input (hidden for null operators) -->
        <Input
          v-if="!isNullOperator"
          v-model="filterInput"
          :type="isNumericColumn ? 'number' : 'text'"
          :placeholder="isNumericColumn ? 'Enter number...' : 'Enter text...'"
          class="h-8 text-xs"
          @keydown="handleKeydown"
        />

        <div v-if="isNullOperator" class="text-xs text-muted-foreground italic">
          No value needed
        </div>

        <!-- Action buttons -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            class="flex-1 h-7 text-xs"
            @click="clearFilter"
          >
            <IconX class="h-3 w-3 mr-1" />
            Clear
          </Button>
          <Button
            class="flex-1 h-7 text-xs"
            @click="applyFilter"
          >
            <IconFilter class="h-3 w-3 mr-1" />
            Apply
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
