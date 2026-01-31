<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconCode } from '@tabler/icons-vue'
import type { Column } from '@/types/table'

interface Props {
  open: boolean
  tableName: string
  connectionId: string
  columns: Column[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', values: Record<string, unknown>): void
  (e: 'close'): void
}>()

const showSqlPreview = ref(false)

// Form state - keyed by column name
const values = ref<Record<string, string>>({})
const isNull = ref<Record<string, boolean>>({})

// Filter columns that should be editable (exclude auto-increment)
const editableColumns = computed(() => {
  return props.columns.filter((col) => !col.autoIncrement)
})

// Get the final values for insert
const insertValues = computed<Record<string, unknown>>(() => {
  const result: Record<string, unknown> = {}
  for (const col of editableColumns.value) {
    if (isNull.value[col.name]) {
      result[col.name] = null
    } else if (values.value[col.name] !== undefined && values.value[col.name] !== '') {
      // Try to parse as number if column type is numeric
      const numericTypes = ['INTEGER', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']
      const isNumeric = numericTypes.some((t) => col.type.toUpperCase().includes(t))
      if (isNumeric && !isNaN(Number(values.value[col.name]))) {
        result[col.name] = Number(values.value[col.name])
      } else {
        result[col.name] = values.value[col.name]
      }
    }
  }
  return result
})

// SQL preview
const sqlPreview = computed(() => {
  const cols = Object.keys(insertValues.value)
  if (cols.length === 0) {
    return '-- No values to insert'
  }
  const columnList = cols.map((c) => `"${c}"`).join(', ')
  const valueList = cols.map((c) => {
    const val = insertValues.value[c]
    if (val === null) return 'NULL'
    if (typeof val === 'number') return val
    return `'${String(val).replace(/'/g, "''")}'`
  }).join(', ')
  return `INSERT INTO "${props.tableName}" (${columnList})\nVALUES (${valueList})`
})

// Determine input type based on column type
const getInputType = (col: Column): string => {
  const type = col.type.toUpperCase()
  if (type.includes('INT') || type.includes('DECIMAL') || type.includes('NUMERIC') ||
      type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('REAL')) {
    return 'number'
  }
  if (type.includes('DATE') && !type.includes('TIME')) {
    return 'date'
  }
  if (type.includes('TIME') && !type.includes('DATE') && !type.includes('STAMP')) {
    return 'time'
  }
  if (type.includes('DATETIME') || type.includes('TIMESTAMP')) {
    return 'datetime-local'
  }
  return 'text'
}

// Determine if column should use textarea
const useTextarea = (col: Column): boolean => {
  const type = col.type.toUpperCase()
  return type.includes('TEXT') || type.includes('BLOB') || type.includes('JSON')
}

const resetForm = () => {
  values.value = {}
  isNull.value = {}
  for (const col of editableColumns.value) {
    values.value[col.name] = ''
    isNull.value[col.name] = col.nullable && !col.defaultValue
  }
  showSqlPreview.value = false
}

const toggleNull = (columnName: string) => {
  isNull.value[columnName] = !isNull.value[columnName]
  if (isNull.value[columnName]) {
    values.value[columnName] = ''
  }
}

const handleSave = () => {
  emit('save', insertValues.value)
}

const handleClose = () => {
  emit('update:open', false)
  emit('close')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Insert Row</DialogTitle>
        <DialogDescription>
          Add a new row to table '{{ tableName }}'
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <ScrollArea class="max-h-96">
          <div class="space-y-4 pr-4">
            <div
              v-for="col in editableColumns"
              :key="col.name"
              class="space-y-2"
            >
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium flex items-center gap-2">
                  {{ col.name }}
                  <span class="text-xs text-muted-foreground font-normal">
                    {{ col.type }}
                    <template v-if="!col.nullable">(required)</template>
                  </span>
                </label>
                <label
                  v-if="col.nullable"
                  class="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="isNull[col.name]"
                    @change="toggleNull(col.name)"
                    class="rounded border-input"
                  />
                  NULL
                </label>
              </div>

              <!-- Textarea for text/blob types -->
              <textarea
                v-if="useTextarea(col)"
                v-model="values[col.name]"
                :disabled="isNull[col.name]"
                :placeholder="col.defaultValue !== null && col.defaultValue !== undefined ? `Default: ${col.defaultValue}` : ''"
                class="w-full px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
              />

              <!-- Input for other types -->
              <Input
                v-else
                v-model="values[col.name]"
                :type="getInputType(col)"
                :disabled="isNull[col.name]"
                :placeholder="col.defaultValue !== null && col.defaultValue !== undefined ? `Default: ${col.defaultValue}` : ''"
                :class="{ 'bg-muted': isNull[col.name] }"
              />
            </div>

            <div
              v-if="columns.some(c => c.autoIncrement)"
              class="p-3 rounded-md bg-muted text-sm text-muted-foreground"
            >
              <strong>Note:</strong> Auto-increment columns ({{ columns.filter(c => c.autoIncrement).map(c => c.name).join(', ') }}) are automatically populated.
            </div>
          </div>
        </ScrollArea>

        <!-- SQL Preview -->
        <div class="space-y-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            @click="showSqlPreview = !showSqlPreview"
          >
            <IconCode class="h-4 w-4" />
            {{ showSqlPreview ? 'Hide' : 'Show' }} SQL Preview
          </button>
          <pre
            v-if="showSqlPreview"
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto whitespace-pre-wrap"
          >{{ sqlPreview }}</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">Cancel</Button>
        <Button @click="handleSave">
          Insert Row
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
