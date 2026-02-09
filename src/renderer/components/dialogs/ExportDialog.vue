<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IconLoader2 } from '@tabler/icons-vue'
import { ExportMode } from '@/types/table'

export interface ExportDialogData {
  title: string
  tableName?: string
  mode: ExportMode
  columns?: { name: string; type: string }[]
  rows?: Record<string, unknown>[]
  connectionId?: string
  schema?: string
}

interface Props {
  open: boolean
  data: ExportDialogData | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

type ExportFormat = 'csv' | 'json' | 'sql'

const format = ref<ExportFormat>('csv')
const isExporting = ref(false)

// CSV options
const delimiter = ref(',')
const includeHeaders = ref(true)
const nullAsEmpty = ref(true)

// JSON options
const prettyPrint = ref(true)

// SQL options
const includeSchema = ref(false)
const createTable = ref(false)

const delimiterOptions = [
  { label: 'Comma (,)', value: ',' },
  { label: 'Semicolon (;)', value: ';' },
  { label: 'Tab (\\t)', value: '\t' },
  { label: 'Pipe (|)', value: '|' },
]

const fileExtension = computed(() => {
  switch (format.value) {
    case 'csv': return 'csv'
    case 'json': return 'json'
    case 'sql': return 'sql'
  }
})

const defaultFileName = computed(() => {
  const name = props.data?.tableName || 'export'
  return `${name}.${fileExtension.value}`
})

const resetForm = () => {
  format.value = 'csv'
  delimiter.value = ','
  includeHeaders.value = true
  nullAsEmpty.value = true
  prettyPrint.value = true
  includeSchema.value = false
  createTable.value = false
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})

const handleExport = async () => {
  if (!props.data) return

  isExporting.value = true

  try {
    // Show native save dialog first
    const filterName = format.value === 'csv' ? 'CSV Files'
      : format.value === 'json' ? 'JSON Files'
      : 'SQL Files'

    const result = await window.api.app.showSaveDialog({
      title: 'Export Data',
      defaultPath: defaultFileName.value,
      filters: [
        { name: filterName, extensions: [fileExtension.value] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      isExporting.value = false
      return
    }

    const filePath = result.filePath

    if (props.data.mode === ExportMode.FullTable && props.data.connectionId && props.data.tableName) {
      // Full-table export: main process fetches data
      const exportResult = await window.api.export.tableToFile(
        props.data.connectionId,
        props.data.tableName,
        filePath,
        {
          format: format.value,
          delimiter: format.value === 'csv' ? delimiter.value : undefined,
          includeHeaders: format.value === 'csv' ? includeHeaders.value : undefined,
          nullAsEmpty: format.value === 'csv' ? nullAsEmpty.value : undefined,
          prettyPrint: format.value === 'json' ? prettyPrint.value : undefined,
          schema: props.data.schema,
          includeSchema: format.value === 'sql' ? includeSchema.value : undefined,
          createTable: format.value === 'sql' ? createTable.value : undefined
        }
      )

      if (exportResult.success) {
        toast.success(`Exported to ${filePath}`)
        emit('update:open', false)
      } else {
        toast.error(exportResult.error || 'Export failed')
      }
    } else if (props.data.columns && props.data.rows) {
      // In-memory export: send data directly
      const exportResult = await window.api.export.toFile({
        format: format.value,
        columns: props.data.columns,
        rows: props.data.rows,
        tableName: props.data.tableName,
        includeHeaders: format.value === 'csv' ? includeHeaders.value : undefined,
        delimiter: format.value === 'csv' ? delimiter.value : undefined,
        filePath,
        nullAsEmpty: format.value === 'csv' ? nullAsEmpty.value : undefined,
        prettyPrint: format.value === 'json' ? prettyPrint.value : undefined,
        includeSchema: format.value === 'sql' ? includeSchema.value : undefined,
        schema: format.value === 'sql' ? props.data.schema : undefined
      })

      if (exportResult.success) {
        toast.success(`Exported to ${filePath}`)
        emit('update:open', false)
      } else {
        toast.error(exportResult.error || 'Export failed')
      }
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed')
  } finally {
    isExporting.value = false
  }
}

const handleClose = () => {
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ data?.title || 'Export Data' }}</DialogTitle>
        <DialogDescription>
          Choose a format and configure export options.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <!-- Format tabs -->
        <div class="inline-flex items-center w-full rounded-md border bg-muted p-0.5">
          <button
            v-for="f in (['csv', 'json', 'sql'] as const)"
            :key="f"
            :data-testid="`export-format-${f}`"
            class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none"
            :class="format === f
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'"
            @click="format = f"
          >
            {{ f.toUpperCase() }}
          </button>
        </div>

        <!-- CSV Options -->
        <div v-if="format === 'csv'" data-testid="export-csv-options" class="flex flex-col gap-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Delimiter</Label>
            <div class="inline-flex items-center rounded-md border bg-muted p-0.5">
              <button
                v-for="opt in delimiterOptions"
                :key="opt.value"
                class="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium transition-all"
                :class="delimiter === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'"
                @click="delimiter = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input data-testid="export-include-headers" type="checkbox" v-model="includeHeaders" class="rounded border-border" />
            Include headers
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input data-testid="export-null-as-empty" type="checkbox" v-model="nullAsEmpty" class="rounded border-border" />
            NULL as empty string
          </label>
        </div>

        <!-- JSON Options -->
        <div v-else-if="format === 'json'" data-testid="export-json-options" class="flex flex-col gap-3">
          <label class="flex items-center gap-2 text-sm">
            <input data-testid="export-pretty-print" type="checkbox" v-model="prettyPrint" class="rounded border-border" />
            Pretty print
          </label>
        </div>

        <!-- SQL Options -->
        <div v-else-if="format === 'sql'" data-testid="export-sql-options" class="flex flex-col gap-3">
          <label v-if="data?.schema" class="flex items-center gap-2 text-sm">
            <input data-testid="export-include-schema" type="checkbox" v-model="includeSchema" class="rounded border-border" />
            Include table schema (if applicable)
          </label>
          <label v-if="data?.mode === ExportMode.FullTable" class="flex items-center gap-2 text-sm">
            <input data-testid="export-create-table" type="checkbox" v-model="createTable" class="rounded border-border" />
            Create table before inserting
          </label>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button data-testid="export-cancel-btn" variant="outline" size="lg" type="button" @click="handleClose" :disabled="isExporting">
            Cancel
          </Button>
          <Button data-testid="export-submit-btn" size="lg" @click="handleExport" :disabled="isExporting">
            <IconLoader2 v-if="isExporting" class="h-4 w-4 mr-1 animate-spin" />
            Export
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
