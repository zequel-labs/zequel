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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { IconLoader2 } from '@tabler/icons-vue'
import { ExportMode, ExportFormat } from '@/types/table'
import { useRowTransfer } from '@/composables/useRowTransfer'
import RowTransferProgress from '@/components/backup/RowTransferProgress.vue'
import { toPlainObject } from '@/lib/utils'

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
const transfer = useRowTransfer()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const format = ref<ExportFormat>(ExportFormat.CSV)
const isExporting = ref(false)

// CSV options
const delimiter = ref(',')
const includeHeaders = ref(true)
// NULL becomes an empty cell by default, like TablePlus's "Convert NULL to EMPTY"; unchecked keeps \N for exact re-import.
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

const fileExtension = computed(() => format.value as string)

const fileName = ref('')
const defaultFileName = computed(() => `${fileName.value.trim() || props.data?.tableName || 'export'}.${fileExtension.value}`)

const resetForm = () => {
  format.value = ExportFormat.CSV
  delimiter.value = ','
  includeHeaders.value = true
  nullAsEmpty.value = true
  fileName.value = props.data?.tableName || 'export'
  prettyPrint.value = true
  includeSchema.value = false
  createTable.value = false
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})

const showExportSuccess = (filePath: string) => {
  toast.success('Export complete', {
    action: {
      label: 'Show in Folder',
      onClick: () => window.api.app.showItemInFolder(filePath)
    }
  })
}

const handleExport = async () => {
  if (!props.data) return

  const data = toPlainObject(props.data)
  isExporting.value = true

  try {
    // Show native save dialog first
    const filterName = format.value === ExportFormat.CSV ? 'CSV Files'
      : format.value === ExportFormat.JSON ? 'JSON Files'
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
    const operationId = transfer.begin()

    if (data.mode === ExportMode.FullTable && data.connectionId && data.tableName) {
      // Full-table export: main process fetches data
      const exportResult = await window.api.export.tableToFile(
        data.connectionId,
        data.tableName,
        filePath,
        {
          operationId,
          format: format.value,
          delimiter: format.value === ExportFormat.CSV ? delimiter.value : undefined,
          includeHeaders: format.value === ExportFormat.CSV ? includeHeaders.value : undefined,
          nullAsEmpty: format.value === ExportFormat.CSV ? nullAsEmpty.value : undefined,
          prettyPrint: format.value === ExportFormat.JSON ? prettyPrint.value : undefined,
          schema: data.schema,
          includeSchema: format.value === ExportFormat.SQL ? includeSchema.value : undefined,
          createTable: format.value === ExportFormat.SQL ? createTable.value : undefined
        }
      )

      if (exportResult.success) {
        showExportSuccess(filePath)
        emit('update:open', false)
      } else {
        toast.error(exportResult.error || 'Export failed')
      }
    } else if (data.columns && data.rows) {
      // In-memory export: sanitize to strip Vue proxies and non-cloneable values
      const exportResult = await window.api.export.toFile({
        operationId,
        format: format.value,
        columns: toPlainObject(data.columns),
        rows: toPlainObject(data.rows),
        tableName: data.tableName,
        includeHeaders: format.value === ExportFormat.CSV ? includeHeaders.value : undefined,
        delimiter: format.value === ExportFormat.CSV ? delimiter.value : undefined,
        filePath,
        nullAsEmpty: format.value === ExportFormat.CSV ? nullAsEmpty.value : undefined,
        prettyPrint: format.value === ExportFormat.JSON ? prettyPrint.value : undefined,
        includeSchema: format.value === ExportFormat.SQL ? includeSchema.value : undefined,
        schema: format.value === ExportFormat.SQL ? data.schema : undefined,
        connectionId: data.connectionId
      })

      if (exportResult.success) {
        showExportSuccess(filePath)
        emit('update:open', false)
      } else {
        toast.error(exportResult.error || 'Export failed')
      }
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export failed')
  } finally {
    await transfer.finish()
    isExporting.value = false
  }
}

const handleClose = () => {
  if (isExporting.value) return
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent class="max-w-md gap-3 p-4" data-testid="export-dialog">
      <DialogHeader class="items-center">
        <DialogTitle class="text-[13px] font-semibold">{{ data?.title || 'Export Data' }}</DialogTitle>
        <DialogDescription class="sr-only">Choose a format and configure export options.</DialogDescription>
      </DialogHeader>

      <template v-if="isExporting">
        <RowTransferProgress v-if="transfer.progress.value" :progress="transfer.progress.value" />
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" class="h-7 text-[13px]" :disabled="transfer.progress.value?.status === 'cancelling'" @click="transfer.cancel">Stop Export</Button>
        </div>
      </template>
      <div class="flex flex-col gap-3" :class="isExporting ? 'pointer-events-none opacity-50' : ''">
        <!-- Formats, like TablePlus's export sheet -->
        <div class="mx-auto inline-flex items-center rounded-md bg-secondary p-0.5">
          <button v-for="f in [ExportFormat.CSV, ExportFormat.JSON, ExportFormat.SQL]" :key="f" :data-testid="`export-format-${f}`"
            class="min-w-16 rounded px-3 py-0.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="format === f ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
            :aria-pressed="format === f" @click="format = f">
            {{ f.toUpperCase() }}
          </button>
        </div>

        <div class="min-h-36 rounded-md border bg-muted/40 p-3 text-[13px]">
          <div v-if="format === ExportFormat.CSV" data-testid="export-csv-options" class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input data-testid="export-null-as-empty" type="checkbox" v-model="nullAsEmpty" class="size-3.5 accent-primary" />
              Convert NULL to EMPTY
            </label>
            <label class="flex items-center gap-2">
              <input data-testid="export-include-headers" type="checkbox" v-model="includeHeaders" class="size-3.5 accent-primary" />
              Put field names in the first row
            </label>
            <div class="mt-1 grid grid-cols-[5rem_1fr] items-center gap-x-2">
              <label for="export-delimiter" class="text-right text-muted-foreground">Delimiter</label>
              <Select v-model="delimiter">
                <SelectTrigger id="export-delimiter" data-testid="export-delimiter-select" class="h-7 w-32 border-transparent bg-background text-[13px] shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in delimiterOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p v-if="!nullAsEmpty" class="text-[11px] text-muted-foreground">NULL is written as \N so it can be imported back exactly.</p>
          </div>

          <div v-else-if="format === ExportFormat.JSON" data-testid="export-json-options" class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input data-testid="export-pretty-print" type="checkbox" v-model="prettyPrint" class="size-3.5 accent-primary" />
              Pretty print
            </label>
          </div>

          <div v-else-if="format === ExportFormat.SQL" data-testid="export-sql-options" class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input data-testid="export-include-schema" type="checkbox" v-model="includeSchema" class="size-3.5 accent-primary" />
              Include schema name
            </label>
            <label class="flex items-center gap-2">
              <input data-testid="export-create-table" type="checkbox" v-model="createTable" class="size-3.5 accent-primary" />
              Include table structure
            </label>
          </div>
        </div>

        <div class="flex items-center gap-2 text-[13px]">
          <label for="export-file-name" class="shrink-0">File name:</label>
          <Input id="export-file-name" v-model="fileName" class="h-7 text-[13px]" />
        </div>

        <div class="flex justify-end gap-2">
          <Button data-testid="export-cancel-btn" variant="secondary" size="sm" class="h-7 text-[13px]" type="button" :disabled="isExporting" @click="handleClose">Cancel</Button>
          <Button data-testid="export-submit-btn" variant="secondary" size="sm" class="h-7 text-[13px]" :disabled="isExporting" @click="handleExport">
            <IconLoader2 v-if="isExporting" class="mr-1 size-3.5 animate-spin" />Export…
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
