<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  IconLoader2,
  IconAlertCircle,
  IconCircleCheck,
  IconArrowRight
} from '@tabler/icons-vue'
import { useConnectionsStore } from '@/stores/connections'
import { toast } from 'vue-sonner'

interface ImportColumn {
  name: string
  sampleValues: unknown[]
  detectedType: string
}

interface ImportPreview {
  columns: ImportColumn[]
  rows: Record<string, unknown>[]
  totalRows: number
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
}

interface Props {
  open: boolean
  format: 'csv' | 'json'
  tableName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'imported'): void
}>()

const connectionsStore = useConnectionsStore()

// State
const step = ref<'loading' | 'configure' | 'mapping' | 'importing' | 'done'>('loading')
const isLoading = ref(false)
const error = ref<string | null>(null)

// File data
const filePath = ref<string | null>(null)
const preview = ref<ImportPreview | null>(null)

// Options
const hasHeaders = ref(true)
const delimiter = ref(',')
const truncateTable = ref(false)

// Column mapping
const targetColumns = ref<TargetColumn[]>([])
const columnMappings = ref<ColumnMapping[]>([])

// Import results
const importedRows = ref(0)
const importErrors = ref<string[]>([])

// Computed
const canImport = computed(() => {
  return columnMappings.value.some((m) => m.targetColumn !== '')
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
  step.value = 'loading'
  isLoading.value = false
  error.value = null
  filePath.value = null
  preview.value = null
  hasHeaders.value = true
  delimiter.value = ','
  truncateTable.value = false
  targetColumns.value = []
  columnMappings.value = []
  importedRows.value = 0
  importErrors.value = []
}

const startImport = async () => {
  isLoading.value = true
  error.value = null

  try {
    // Open file dialog and get preview
    const result = await window.api.import.preview(props.format)

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

    // Get target table columns
    const connectionId = connectionsStore.activeConnectionId
    if (!connectionId) {
      throw new Error('No active connection')
    }

    const columnsResult = await window.api.import.getTableColumns(connectionId, props.tableName)
    if (columnsResult.error) {
      throw new Error(columnsResult.error)
    }

    targetColumns.value = columnsResult.columns.map((col: any) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable
    }))

    // Initialize column mappings with auto-mapping
    initializeColumnMappings()

    step.value = 'configure'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    step.value = 'configure'
  } finally {
    isLoading.value = false
  }
}

const initializeColumnMappings = () => {
  if (!preview.value) return

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

  isLoading.value = true
  error.value = null

  try {
    const result = await window.api.import.reparse(filePath.value, props.format, {
      hasHeaders: hasHeaders.value,
      delimiter: props.format === 'csv' ? delimiter.value : undefined
    })

    if (result.error || !result.preview) {
      throw new Error(result.error || 'Failed to reparse file')
    }

    preview.value = result.preview
    initializeColumnMappings()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    isLoading.value = false
  }
}

const goToMapping = () => {
  step.value = 'mapping'
}

const executeImport = async () => {
  const connectionId = connectionsStore.activeConnectionId
  if (!connectionId || !filePath.value) return

  step.value = 'importing'
  isLoading.value = true
  error.value = null
  importErrors.value = []

  try {
    // Filter out unmapped columns
    const mappings = columnMappings.value.filter((m) => m.targetColumn !== '')

    const result = await window.api.import.execute(
      connectionId,
      props.tableName,
      filePath.value,
      props.format,
      mappings,
      {
        hasHeaders: hasHeaders.value,
        delimiter: props.format === 'csv' ? delimiter.value : undefined,
        truncateTable: truncateTable.value,
        batchSize: 100
      }
    )

    importedRows.value = result.insertedRows || 0
    importErrors.value = result.errors || []

    if (result.success) {
      toast.success('Import Successful', {
        description: `${importedRows.value} rows imported into ${props.tableName}`
      })
    } else {
      toast.error('Import Completed with Errors', {
        description: `${importedRows.value} rows imported, ${importErrors.value.length} errors`
      })
    }

    step.value = 'done'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    step.value = 'mapping'
  } finally {
    isLoading.value = false
  }
}

const handleClose = () => {
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
    <DialogContent class="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>
          Import {{ format.toUpperCase() }} into {{ tableName }}
        </DialogTitle>
        <DialogDescription>
          <template v-if="step === 'loading'">Loading file...</template>
          <template v-else-if="step === 'configure'">Configure import options and preview data</template>
          <template v-else-if="step === 'mapping'">Map source columns to table columns</template>
          <template v-else-if="step === 'importing'">Importing data...</template>
          <template v-else>Import complete</template>
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-auto py-4">
        <!-- Error State -->
        <div v-if="error" class="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          <IconAlertCircle class="h-5 w-5 flex-shrink-0" />
          <span class="text-sm">{{ error }}</span>
        </div>

        <!-- Loading State -->
        <div v-if="step === 'loading'" class="flex items-center justify-center py-12">
          <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        </div>

        <!-- Configure Step -->
        <template v-else-if="step === 'configure' && preview">
          <div class="space-y-6">
            <!-- Options -->
            <div class="grid grid-cols-2 gap-4">
              <div class="flex items-center justify-between">
                <Label for="hasHeaders">File has headers</Label>
                <Switch
                  id="hasHeaders"
                  :checked="hasHeaders"
                  @update:checked="hasHeaders = $event; handleReparseFile()"
                />
              </div>

              <div v-if="format === 'csv'" class="flex items-center gap-2">
                <Label for="delimiter">Delimiter</Label>
                <Select v-model="delimiter" @update:model-value="handleReparseFile()">
                  <SelectTrigger class="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=",">Comma (,)</SelectItem>
                    <SelectItem value=";">Semicolon (;)</SelectItem>
                    <SelectItem value="\t">Tab</SelectItem>
                    <SelectItem value="|">Pipe (|)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex items-center justify-between">
                <Label for="truncateTable">Clear table before import</Label>
                <Switch
                  id="truncateTable"
                  :checked="truncateTable"
                  @update:checked="truncateTable = $event"
                />
              </div>
            </div>

            <!-- File Info -->
            <div class="text-sm text-muted-foreground">
              <span class="font-medium">{{ preview.totalRows }}</span> rows,
              <span class="font-medium">{{ preview.columns.length }}</span> columns detected
            </div>

            <!-- Preview Table -->
            <div class="border rounded-lg overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      v-for="col in preview.columns"
                      :key="col.name"
                      class="whitespace-nowrap"
                    >
                      {{ col.name }}
                      <span class="text-xs text-muted-foreground ml-1">({{ col.detectedType }})</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(row, index) in preview.rows.slice(0, 10)" :key="index">
                    <TableCell
                      v-for="col in preview.columns"
                      :key="col.name"
                      class="whitespace-nowrap max-w-[200px] truncate"
                    >
                      {{ formatSampleValue(row[col.name]) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </template>

        <!-- Mapping Step -->
        <template v-else-if="step === 'mapping' && preview">
          <div class="space-y-4">
            <p class="text-sm text-muted-foreground">
              Map each source column to a target column in the table. Unmapped columns will be skipped.
            </p>

            <div class="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-1/3">Source Column</TableHead>
                    <TableHead class="w-16"></TableHead>
                    <TableHead class="w-1/3">Target Column</TableHead>
                    <TableHead>Sample Values</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(mapping, index) in columnMappings" :key="mapping.sourceColumn">
                    <TableCell class="font-medium">
                      {{ mapping.sourceColumn }}
                      <span class="text-xs text-muted-foreground ml-1">
                        ({{ preview.columns[index]?.detectedType }})
                      </span>
                    </TableCell>
                    <TableCell>
                      <IconArrowRight class="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Select
                        :model-value="mapping.targetColumn"
                        @update:model-value="(v) => { mapping.targetColumn = v; mapping.targetType = targetColumns.find(t => t.name === v)?.type || mapping.targetType }"
                      >
                        <SelectTrigger class="w-full">
                          <SelectValue placeholder="Skip column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Skip column</SelectItem>
                          <SelectItem
                            v-for="col in targetColumns"
                            :key="col.name"
                            :value="col.name"
                          >
                            {{ col.name }}
                            <span class="text-xs text-muted-foreground ml-1">({{ col.type }})</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ preview.columns[index]?.sampleValues.slice(0, 3).map(formatSampleValue).join(', ') }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </template>

        <!-- Importing Step -->
        <template v-else-if="step === 'importing'">
          <div class="flex flex-col items-center justify-center py-12 gap-4">
            <IconLoader2 class="h-12 w-12 animate-spin text-primary" />
            <p class="text-muted-foreground">Importing data...</p>
          </div>
        </template>

        <!-- Done Step -->
        <template v-else-if="step === 'done'">
          <div class="space-y-4">
            <div class="flex items-center gap-3 p-4 bg-green-500/10 text-green-600 rounded-lg">
              <IconCircleCheck class="h-6 w-6" />
              <div>
                <p class="font-medium">Import Complete</p>
                <p class="text-sm">{{ importedRows }} rows imported into {{ tableName }}</p>
              </div>
            </div>

            <div v-if="importErrors.length > 0" class="space-y-2">
              <p class="text-sm font-medium text-destructive">
                {{ importErrors.length }} errors occurred:
              </p>
              <div class="max-h-[200px] overflow-auto border rounded-lg p-2">
                <ul class="text-xs space-y-1 text-muted-foreground">
                  <li v-for="(err, index) in importErrors.slice(0, 50)" :key="index">
                    {{ err }}
                  </li>
                  <li v-if="importErrors.length > 50" class="text-muted-foreground">
                    ... and {{ importErrors.length - 50 }} more errors
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </template>
      </div>

      <DialogFooter>
        <template v-if="step === 'configure'">
          <Button variant="outline" @click="handleClose">Cancel</Button>
          <Button :disabled="isLoading" @click="goToMapping">
            Continue to Mapping
          </Button>
        </template>

        <template v-else-if="step === 'mapping'">
          <Button variant="outline" @click="step = 'configure'">Back</Button>
          <Button :disabled="!canImport || isLoading" @click="executeImport">
            <IconLoader2 v-if="isLoading" class="h-4 w-4 mr-2 animate-spin" />
            Import {{ preview?.totalRows }} Rows
          </Button>
        </template>

        <template v-else-if="step === 'done'">
          <Button @click="handleClose">Close</Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
