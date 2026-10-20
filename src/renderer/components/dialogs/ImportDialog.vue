<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { cn, toPlainObject } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  IconLoader2,
  IconAlertCircle,
  IconCircleCheck
} from '@tabler/icons-vue'
import { Checkbox } from '@/components/ui/checkbox'

import { useRowTransfer } from '@/composables/useRowTransfer'
import RowTransferProgress from '@/components/backup/RowTransferProgress.vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'

interface ImportColumn {
  name: string
  sampleValues: unknown[]
  detectedType: string
}

interface ImportPreview {
  columns: ImportColumn[]
  rows: Record<string, unknown>[]
  totalRows: number | null
  hasHeaders: boolean
}

interface ColumnMapping {
  sourceColumn: string
  targetColumn: string
  targetType: string
}

interface TargetColumn {
  name: string
  type: string
  nullable: boolean
  /** A MongoDB field taken from the file rather than the collection. */
  fromFile?: boolean
}

interface Props {
  open: boolean
  format: 'csv' | 'json'
  tableName: string
  connectionId: string
  schema?: string
}

const props = defineProps<Props>()
const transfer = useRowTransfer()
const connectionsStore = useConnectionsStore()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported'): void
}>()


// State
const step = ref<'loading' | 'configure' | 'importing' | 'done'>('loading')
const isLoading = ref(false)
const error = ref<string | null>(null)
let previewGeneration = 0
const importFormat = ref(props.format)

// File data
const filePath = ref<string | null>(null)
const preview = ref<ImportPreview | null>(null)

// Options
const hasHeaders = ref(true)
const delimiter = ref(',')
const nullToken = ref('\\N')
const truncateTable = ref(false)

// Column mapping
const targetColumns = ref<TargetColumn[]>([])
const columnMappings = ref<ColumnMapping[]>([])

// Connection snapshot — captured when dialog opens, used throughout import lifecycle
const importConnectionId = ref<string | null>(null)
const importTableName = ref('')
const importSchema = ref<string>()

const safeMode = computed(() => connectionsStore.isSafeModeForSession(importConnectionId.value || props.connectionId))
const privacyMode = computed(() => connectionsStore.isPrivacyModeForSession(importConnectionId.value || props.connectionId))

// Import results
const importedRows = ref(0)
const importErrors = ref<string[]>([])

// Computed
const canImport = computed(() => {
  const targets = columnMappings.value.map(mapping => mapping.targetColumn).filter(Boolean)
  return !safeMode.value && targets.length > 0 && new Set(targets).size === targets.length
})

// Watch for dialog open
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await startImport()
    } else {
      resetState()
    }
  }
)

const resetState = () => {
  previewGeneration++
  step.value = 'loading'
  isLoading.value = false
  error.value = null
  filePath.value = null
  preview.value = null
  hasHeaders.value = true
  delimiter.value = ','
  nullToken.value = '\\N'
  truncateTable.value = false
  targetColumns.value = []
  columnMappings.value = []
  importConnectionId.value = null
  importedRows.value = 0
  importErrors.value = []
}

const startImport = async () => {
  const generation = ++previewGeneration
  // Snapshot connection before file dialog opens (user could switch while dialog is open)
  const connectionId = props.connectionId
  if (!connectionId) return
  importConnectionId.value = connectionId
  importTableName.value = props.tableName
  importSchema.value = props.schema
  importFormat.value = props.format

  isLoading.value = true
  error.value = null

  try {
    // Open file dialog and get preview
    const result = await window.api.import.preview(importFormat.value)
    if (generation !== previewGeneration) return

    if (result.error || !result.preview || !result.filePath) {
      if (result.error !== 'Import canceled') {
        error.value = result.error || 'Failed to read file'
      }
      emit('close')
      return
    }

    filePath.value = result.filePath
    preview.value = result.preview
    hasHeaders.value = result.preview.hasHeaders

    const columnsResult = await window.api.import.getTableColumns(connectionId, importTableName.value, importSchema.value)
    if (generation !== previewGeneration) return
    if (columnsResult.error) {
      throw new Error(columnsResult.error)
    }

    targetColumns.value = columnsResult.columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable
    }))

    // Initialize column mappings with auto-mapping
    initializeColumnMappings()

    step.value = 'configure'
  } catch (e) {
    if (generation !== previewGeneration) return
    error.value = e instanceof Error ? e.message : String(e)
    step.value = 'configure'
  } finally {
    if (generation === previewGeneration) isLoading.value = false
  }
}

// MongoDB is schemaless: the file's top-level fields are valid targets, even in an empty collection.
const withFileFields = (): void => {
  const collection = targetColumns.value.filter(column => !column.fromFile)
  const isMongoDB = connectionsStore.getConnectionForSession(importConnectionId.value ?? '')?.type === DatabaseType.MongoDB
  if (!isMongoDB || !preview.value) { targetColumns.value = collection; return }
  const names = preview.value.columns.map(column => column.name)
  // JSON previews also list flattened paths such as "address.city"; documents import top-level fields.
  const fields = names.filter(name => !names.some(parent => name.startsWith(parent + '.')) && !collection.some(column => column.name === name))
  targetColumns.value = [...collection, ...fields.map(name => ({ name, type: 'Any', nullable: true, fromFile: true }))]
}

const initializeColumnMappings = () => {
  if (!preview.value) return
  withFileFields()

  columnMappings.value = preview.value.columns.map((sourceCol) => {
    // Try to find matching target column (case-insensitive)
    const matchingTarget = targetColumns.value.find(
      (t) => t.name.toLowerCase() === sourceCol.name.toLowerCase()
    )

    return {
      sourceColumn: sourceCol.name,
      targetColumn: matchingTarget?.name || '',
      targetType: matchingTarget?.type || sourceCol.detectedType
    }
  })
}

const handleReparseFile = async () => {
  if (!filePath.value) return
  const generation = ++previewGeneration

  isLoading.value = true
  error.value = null

  try {
    const result = await window.api.import.reparse(filePath.value, importFormat.value, {
      hasHeaders: hasHeaders.value,
      delimiter: importFormat.value === 'csv' ? delimiter.value : undefined,
      nullToken: nullToken.value
    })
    if (generation !== previewGeneration) return

    if (result.error || !result.preview) {
      throw new Error(result.error || 'Failed to reparse file')
    }

    preview.value = result.preview
    initializeColumnMappings()
  } catch (e) {
    if (generation !== previewGeneration) return
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (generation === previewGeneration) isLoading.value = false
  }
}

// Like TablePlus: match source columns to table columns by name, or by position.
const matchMode = ref<'name' | 'order'>('name')
const fileName = computed(() => filePath.value?.split(/[\\/]/).pop() ?? '')

const applyMatchMode = (): void => {
  if (!preview.value) return
  if (matchMode.value === 'name') {
    initializeColumnMappings()
    return
  }
  columnMappings.value = preview.value.columns.map((sourceCol, index) => {
    const target = targetColumns.value[index]
    return { sourceColumn: sourceCol.name, targetColumn: target?.name || '', targetType: target?.type || sourceCol.detectedType }
  })
}

const setMapping = (mapping: ColumnMapping, target: string): void => {
  mapping.targetColumn = target === SKIP ? '' : target
  mapping.targetType = targetColumns.value.find(column => column.name === mapping.targetColumn)?.type || mapping.targetType
}
const SKIP = '__skip__'

const executeImport = async () => {
  const connectionId = importConnectionId.value
  if (!connectionId || !filePath.value) return
  if (safeMode.value) {
    error.value = 'Safe Mode is enabled for this connection. Turn it off to import data.'
    return
  }

  step.value = 'importing'
  isLoading.value = true
  error.value = null
  importErrors.value = []

  try {
    // Filter out unmapped columns
    const mappings = columnMappings.value.filter((m) => m.targetColumn !== '')

    const result = await window.api.import.execute(
      connectionId,
      importTableName.value,
      filePath.value,
      importFormat.value,
      toPlainObject(mappings),
      {
        hasHeaders: hasHeaders.value,
        delimiter: importFormat.value === 'csv' ? delimiter.value : undefined,
        nullToken: nullToken.value,
        truncateTable: truncateTable.value,
        batchSize: 500,
        operationId: transfer.begin(),
        schema: importSchema.value
      }
    )

    await transfer.finish()
    importedRows.value = result.insertedRows || 0
    importErrors.value = result.errors || []

    if (result.success) {
      toast.success('Import Successful', {
        description: `${importedRows.value} rows imported into ${importTableName.value}`
      })
    } else {
      toast.error(result.cancelled ? 'Import stopped' : 'Import stopped with an error', {
        description: `${importedRows.value} rows imported, ${importErrors.value.length} errors`
      })
    }

    step.value = 'done'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    step.value = 'configure'
  } finally {
    isLoading.value = false
  }
}

const handleClose = () => {
  if (step.value === 'importing') return
  if (step.value === 'done') {
    emit('imported')
  }
  emit('close')
}

const formatSampleValue = (value: unknown): string => {
  if (value === null || value === undefined) return '(null)'
  if (value === '') return '(empty)'
  if (typeof value === 'object') return JSON.stringify(value)
  const str = String(value)
  return str.length > 30 ? str.substring(0, 30) + '...' : str
}
</script>

<template>
  <Dialog :open="open" @update:open="handleClose">
    <DialogContent data-testid="import-dialog" class="flex max-h-[90vh] max-w-5xl flex-col gap-3 overflow-hidden p-4">
      <DialogHeader class="items-center">
        <DialogTitle class="text-[13px] font-semibold">Import {{ format.toUpperCase() }} Wizard</DialogTitle>
        <DialogDescription class="sr-only">Import {{ format.toUpperCase() }} into {{ tableName }}</DialogDescription>
      </DialogHeader>

      <div v-if="error" class="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-[13px] text-destructive">
        <IconAlertCircle class="size-4 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="step === 'loading'" class="flex items-center justify-center py-16">
        <IconLoader2 class="size-6 animate-spin text-muted-foreground" />
      </div>

      <!-- Single screen: target, options and inline column mapping, like TablePlus's CSV wizard -->
      <template v-else-if="step === 'configure' && preview">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <div class="flex items-center gap-2">
            <span>Table</span>
            <span class="rounded-md bg-secondary px-2 py-1 font-medium">{{ tableName }}</span>
          </div>
          <label v-if="format === 'csv'" class="flex items-center gap-2">
            <Checkbox data-testid="import-headers-toggle" :model-value="hasHeaders"
              @update:model-value="(value) => { hasHeaders = value === true; handleReparseFile() }" />
            First line is header
          </label>
          <span class="ml-auto truncate text-muted-foreground" :title="filePath ?? ''">{{ fileName }}</span>
        </div>

        <div class="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>
            First {{ Math.min(preview.rows.length, 100) }} rows of the file ·
            {{ preview.totalRows ?? preview.rows.length }}{{ preview.totalRows === null ? '+' : '' }} rows, {{ preview.columns.length }} columns
          </span>
          <Select v-model="matchMode" @update:model-value="applyMatchMode">
            <SelectTrigger aria-label="Match columns" class="h-7 w-56 border-transparent bg-secondary text-[12px] shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Match Columns by Name</SelectItem>
              <SelectItem value="order">Match Columns by Order</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="min-h-64 flex-1 overflow-auto rounded-md border">
          <table class="w-max min-w-full border-collapse text-[12px]">
            <thead class="sticky top-0 z-10 bg-card">
              <tr>
                <th v-for="mapping in columnMappings" :key="`target-${mapping.sourceColumn}`" class="min-w-44 border-b border-r px-1 py-1 text-left font-normal last:border-r-0">
                  <Select :model-value="mapping.targetColumn || SKIP" @update:model-value="(value) => setMapping(mapping, String(value))">
                    <SelectTrigger :aria-label="`Target for ${mapping.sourceColumn}`"
                      class="h-7 w-full border-transparent font-mono text-[12px] shadow-none"
                      :class="mapping.targetColumn ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'bg-transparent text-muted-foreground'">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="SKIP">Do not import</SelectItem>
                      <SelectItem v-for="col in targetColumns" :key="col.name" :value="col.name">
                        {{ col.name }} <span class="ml-1 text-muted-foreground">{{ col.type }}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </th>
              </tr>
              <tr>
                <th v-for="mapping in columnMappings" :key="`source-${mapping.sourceColumn}`" class="border-b border-r px-2 py-1 text-left font-semibold last:border-r-0">
                  {{ mapping.sourceColumn }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in preview.rows.slice(0, 100)" :key="index" class="even:bg-muted/40">
                <td v-for="col in preview.columns" :key="col.name"
                  :class="cn('max-w-64 truncate border-r px-2 py-0.5 font-mono last:border-r-0', privacyMode ? 'blur-sm select-none' : '')">
                  {{ formatSampleValue(row[col.name]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
          <div v-if="format === 'csv'" class="flex items-center gap-2">
            <Label for="import-delimiter">Delimiter</Label>
            <Select v-model="delimiter" @update:model-value="handleReparseFile()">
              <SelectTrigger id="import-delimiter" data-testid="import-delimiter-select" class="h-7 w-28 border-transparent bg-secondary text-[13px] shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma ,</SelectItem>
                <SelectItem value=";">Semicolon ;</SelectItem>
                <SelectItem value="\t">Tab</SelectItem>
                <SelectItem value="|">Pipe |</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="format === 'csv'" class="flex items-center gap-2">
            <Label for="import-null-token">NULL</Label>
            <Input id="import-null-token" v-model="nullToken" class="h-7 w-16 font-mono text-[13px]" @change="handleReparseFile()" />
          </div>
          <div class="flex items-center gap-2">
            <Label for="import-insert-option">Insert option</Label>
            <Select :model-value="truncateTable ? 'replace' : 'append'" @update:model-value="(value) => { truncateTable = value === 'replace' }">
              <SelectTrigger id="import-insert-option" class="h-7 w-40 border-transparent bg-secondary text-[13px] shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="append">APPEND</SelectItem>
                <SelectItem value="replace">CLEAR TABLE FIRST</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="safeMode" class="text-[12px] text-muted-foreground" role="status">Safe Mode is enabled. Turn it off to import data.</p>
          <div class="ml-auto flex gap-2">
            <Button data-testid="import-cancel-btn" variant="secondary" size="sm" class="h-7 text-[13px]" @click="handleClose">Cancel</Button>
            <Button data-testid="import-submit-btn" variant="secondary" size="sm" class="h-7 text-[13px]" :disabled="!canImport || isLoading" @click="executeImport">
              <IconLoader2 v-if="isLoading" class="mr-1.5 size-3.5 animate-spin" />Import
            </Button>
          </div>
        </div>
      </template>

      <template v-else-if="step === 'importing'">
        <RowTransferProgress v-if="transfer.progress.value" :progress="transfer.progress.value" />
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" class="h-7 text-[13px]" :disabled="transfer.progress.value?.status === 'cancelling'" @click="transfer.cancel">Stop Import</Button>
        </div>
      </template>

      <template v-else-if="step === 'done'">
        <div class="flex items-center gap-3 rounded-md bg-muted p-3">
          <IconCircleCheck class="size-5" />
          <div class="text-[13px]">
            <p class="font-medium">{{ importErrors.length ? 'Import stopped' : 'Import complete' }}</p>
            <p class="text-muted-foreground">{{ importedRows }} rows imported into {{ tableName }}</p>
          </div>
        </div>
        <div v-if="importErrors.length > 0" class="space-y-1">
          <p class="text-[13px] font-medium text-destructive">{{ importErrors.length }} errors occurred:</p>
          <ul class="max-h-48 space-y-1 overflow-auto rounded-md border p-2 text-[12px] text-muted-foreground">
            <li v-for="(err, index) in importErrors.slice(0, 50)" :key="index">{{ err }}</li>
            <li v-if="importErrors.length > 50">… and {{ importErrors.length - 50 }} more errors</li>
          </ul>
        </div>
        <div class="flex justify-end">
          <Button variant="secondary" size="sm" class="h-7 text-[13px]" @click="handleClose">Close</Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
