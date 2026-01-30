<script setup lang="ts">
import { ref, computed } from 'vue'
import { isDateValue, formatDateTime } from '@/lib/date'
import type { ColumnInfo, CellChange } from '@/types/query'
import { IconSearch, IconX } from '@tabler/icons-vue'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'

interface Props {
  row?: Record<string, unknown> | null
  columns: ColumnInfo[]
  rowIndex?: number | null
  pendingChanges?: Map<string, CellChange>
}

const props = withDefaults(defineProps<Props>(), {
  row: null,
  rowIndex: null,
  pendingChanges: () => new Map()
})

const emit = defineEmits<{
  (e: 'update-cell', change: CellChange): void
  (e: 'close'): void
}>()

const search = ref('')

const filteredColumns = computed(() => {
  if (!search.value.trim()) return props.columns
  const q = search.value.toLowerCase().trim()
  return props.columns.filter(col => col.name.toLowerCase().includes(q))
})

function getCellValue(columnName: string): unknown {
  if (!props.row || props.rowIndex === null) return null
  const cellKey = `${props.rowIndex}-${columnName}`
  const change = props.pendingChanges.get(cellKey)
  return change ? change.newValue : props.row[columnName]
}

function formatValue(value: unknown): string {
  if (value === null) return ''
  if (value === undefined) return ''
  if (isDateValue(value)) return formatDateTime(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isModified(columnName: string): boolean {
  if (props.rowIndex === null) return false
  return props.pendingChanges.has(`${props.rowIndex}-${columnName}`)
}

function handleInput(col: ColumnInfo, event: Event) {
  if (!props.row || props.rowIndex === null) return
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  let newValue: unknown = target.value

  if (target.value === '' && col.nullable) {
    newValue = null
  }

  const originalValue = props.row[col.name]
  emit('update-cell', {
    rowIndex: props.rowIndex,
    column: col.name,
    originalValue,
    newValue
  })
}

function isLongValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const str = String(value)
  return str.length > 80 || typeof value === 'object'
}
</script>

<template>
  <div class="flex flex-col h-full border-l border-border bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-border">
      <span class="text-xs font-medium text-muted-foreground">
        <template v-if="row && rowIndex !== null">Row {{ rowIndex + 1 }}</template>
        <template v-else>Row Detail</template>
      </span>
      <Button variant="ghost" size="icon" class="h-6 w-6" @click="emit('close')">
        <IconX class="h-3.5 w-3.5" />
      </Button>
    </div>

    <!-- Empty state -->
    <div v-if="!row || rowIndex === null" class="flex-1 flex items-center justify-center p-4">
      <p class="text-xs text-muted-foreground text-center">Click a row to view its details</p>
    </div>

    <!-- Row content -->
    <template v-else>
      <!-- Search -->
      <div class="px-3 py-2 border-b border-border">
        <div class="relative">
          <IconSearch class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="Filter fields..."
            class="h-7 text-xs pl-7"
          />
        </div>
      </div>

      <!-- Fields list -->
      <ScrollArea class="flex-1">
        <div class="p-3 space-y-3">
          <div
            v-for="col in filteredColumns"
            :key="col.name"
            class="space-y-1"
          >
            <!-- Label row -->
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-medium truncate" :class="isModified(col.name) ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'">
                {{ col.name }}
              </label>
              <span class="text-[10px] text-muted-foreground font-mono shrink-0">{{ col.type }}</span>
            </div>

            <!-- Value input -->
            <textarea
              v-if="isLongValue(getCellValue(col.name))"
              :value="formatValue(getCellValue(col.name))"
              rows="3"
              class="w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              :class="{ 'border-yellow-500/50 bg-yellow-500/5': isModified(col.name) }"
              :placeholder="col.nullable ? 'NULL' : ''"
              @change="handleInput(col, $event)"
            />
            <Input
              v-else
              :model-value="formatValue(getCellValue(col.name))"
              class="h-7 text-xs font-mono"
              :class="{ 'border-yellow-500/50 bg-yellow-500/5': isModified(col.name) }"
              :placeholder="col.nullable ? 'NULL' : ''"
              @change="handleInput(col, $event)"
            />

            <!-- Null indicator -->
            <span
              v-if="getCellValue(col.name) === null"
              class="text-[10px] text-muted-foreground/60 italic"
            >NULL</span>
          </div>

          <div v-if="filteredColumns.length === 0" class="py-8 text-center text-xs text-muted-foreground">
            No fields match "{{ search }}"
          </div>
        </div>
      </ScrollArea>
    </template>
  </div>
</template>
