<script setup lang="ts">
import { ref, computed } from 'vue'
import { isDateValue, formatDateTime } from '@/lib/date'
import type { ColumnInfo, CellChange } from '@/types/query'
import { IconSearch, IconX, IconCopy, IconCheck } from '@tabler/icons-vue'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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

const activeTab = ref<'data' | 'json'>('data')
const search = ref('')
const jsonCopied = ref(false)

const filteredColumns = computed(() => {
  if (!search.value.trim()) return props.columns
  const q = search.value.toLowerCase().trim()
  return props.columns.filter(col => col.name.toLowerCase().includes(q))
})

const getCellValue = (columnName: string): unknown => {
  if (!props.row || props.rowIndex === null) return null
  const cellKey = `${props.rowIndex}-${columnName}`
  const change = props.pendingChanges.get(cellKey)
  return change ? change.newValue : props.row[columnName]
}

const formatValue = (value: unknown): string => {
  if (value === null) return ''
  if (value === undefined) return ''
  if (isDateValue(value)) return formatDateTime(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const isModified = (columnName: string): boolean => {
  if (props.rowIndex === null) return false
  return props.pendingChanges.has(`${props.rowIndex}-${columnName}`)
}

const handleInput = (col: ColumnInfo, event: Event) => {
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

const isLongValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  const str = String(value)
  return str.length > 80 || typeof value === 'object'
}

const rowJson = computed(() => {
  if (!props.row) return ''
  const obj: Record<string, unknown> = {}
  for (const col of props.columns) {
    obj[col.name] = getCellValue(col.name)
  }
  return JSON.stringify(obj, null, 2)
})

const rowJsonHtml = computed(() => {
  if (!rowJson.value) return ''
  return rowJson.value.replace(
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false)|(null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, bool, nul, num) => {
      if (key) return `<span class="text-blue-500 dark:text-blue-400">${key}</span>:`
      if (str) return `<span class="text-green-600 dark:text-green-400">${str}</span>`
      if (bool) return `<span class="text-amber-600 dark:text-amber-400">${bool}</span>`
      if (nul) return `<span class="text-red-400 dark:text-red-500">${nul}</span>`
      if (num) return `<span class="text-purple-600 dark:text-purple-400">${num}</span>`
      return match
    }
  )
})

const copyJson = async () => {
  await navigator.clipboard.writeText(rowJson.value)
  jsonCopied.value = true
  setTimeout(() => { jsonCopied.value = false }, 2000)
}
</script>

<template>
  <div class="flex flex-col h-full border-l border-border bg-background">
    <!-- Empty state -->
    <template v-if="!row || rowIndex === null">
      <div class="flex items-center justify-end px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="emit('close')">
          <IconX class="h-3.5 w-3.5" />
        </Button>
      </div>
      <div class="flex-1 flex items-center justify-center p-4">
        <p class="text-xs text-muted-foreground text-center">Click a row to view its details</p>
      </div>
    </template>

    <!-- Row content -->
    <template v-else>
      <!-- Tabs + Close -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="inline-flex items-center rounded-md border bg-muted p-0.5">
          <button
            tabindex="-1"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all"
            :class="activeTab === 'data' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="activeTab = 'data'"
          >
            Data
          </button>
          <button
            tabindex="-1"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all"
            :class="activeTab === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            @click="activeTab = 'json'"
          >
            JSON
          </button>
        </div>
        <Button variant="ghost" size="icon" class="h-6 w-6" @click="emit('close')">
          <IconX class="h-3.5 w-3.5" />
        </Button>
      </div>

      <!-- Data tab -->
      <template v-if="activeTab === 'data'">
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
              class="space-y-2"
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
            </div>

            <div v-if="filteredColumns.length === 0" class="py-8 text-center text-xs text-muted-foreground">
              No fields match "{{ search }}"
            </div>
          </div>
        </ScrollArea>
      </template>

      <!-- JSON tab -->
      <template v-else-if="activeTab === 'json'">
        <ScrollArea class="flex-1">
          <div class="relative">
            <TooltipProvider :delay-duration="300">
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    class="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    @click="copyJson"
                  >
                    <component :is="jsonCopied ? IconCheck : IconCopy" class="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{{ jsonCopied ? 'Copied!' : 'Copy JSON' }}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <pre class="p-3 pr-8 text-xs font-mono text-foreground whitespace-pre-wrap break-all" v-html="rowJsonHtml" />
          </div>
        </ScrollArea>
      </template>
    </template>
  </div>
</template>
