<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { IconCode, IconPlus, IconX } from '@tabler/icons-vue'
import type { Column, Table } from '@/types/table'
import type { ForeignKeyDefinition, ReferenceAction } from '@/types/schema-operations'

interface Props {
  open: boolean
  tableName: string
  connectionId: string
  database: string
  columns: Column[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', foreignKey: ForeignKeyDefinition): void
  (e: 'close'): void
}>()

const showSqlPreview = ref(false)
const tables = ref<Table[]>([])
const referencedColumns = ref<Column[]>([])
const isLoading = ref(false)

// Form state
const name = ref('')
const sourceColumns = ref<string[]>([])
const referencedTable = ref('')
const refColumns = ref<string[]>([])
const onUpdate = ref<ReferenceAction>('NO ACTION')
const onDelete = ref<ReferenceAction>('NO ACTION')

const actionOptions = [
  { value: 'NO ACTION', label: 'NO ACTION' },
  { value: 'CASCADE', label: 'CASCADE' },
  { value: 'SET NULL', label: 'SET NULL' },
  { value: 'SET DEFAULT', label: 'SET DEFAULT' },
  { value: 'RESTRICT', label: 'RESTRICT' }
]

// Foreign key definition
const foreignKeyDefinition = computed<ForeignKeyDefinition>(() => ({
  name: name.value,
  columns: sourceColumns.value,
  referencedTable: referencedTable.value,
  referencedColumns: refColumns.value,
  onUpdate: onUpdate.value,
  onDelete: onDelete.value
}))

// SQL preview
const sqlPreview = computed(() => {
  const fk = foreignKeyDefinition.value
  const cols = fk.columns.map((c) => `"${c}"`).join(', ')
  const refCols = fk.referencedColumns.map((c) => `"${c}"`).join(', ')
  return `ALTER TABLE "${props.tableName}" ADD CONSTRAINT "${fk.name}"\n` +
    `  FOREIGN KEY (${cols})\n` +
    `  REFERENCES "${fk.referencedTable}" (${refCols})\n` +
    `  ON UPDATE ${fk.onUpdate}\n` +
    `  ON DELETE ${fk.onDelete}`
})

// Auto-generate FK name
const generateFKName = computed(() => {
  if (sourceColumns.value.length === 0 || !referencedTable.value) return ''
  return `fk_${props.tableName}_${sourceColumns.value.join('_')}_${referencedTable.value}`
})

async function loadTables() {
  try {
    isLoading.value = true
    tables.value = await window.api.schema.tables(props.connectionId, props.database)
  } catch (e) {
    console.error('Failed to load tables:', e)
  } finally {
    isLoading.value = false
  }
}

async function loadReferencedColumns() {
  if (!referencedTable.value) {
    referencedColumns.value = []
    return
  }

  try {
    referencedColumns.value = await window.api.schema.columns(
      props.connectionId,
      referencedTable.value
    )
  } catch (e) {
    console.error('Failed to load columns:', e)
    referencedColumns.value = []
  }
}

function addSourceColumn(columnName: string) {
  if (!sourceColumns.value.includes(columnName)) {
    sourceColumns.value.push(columnName)
    updateName()
  }
}

function removeSourceColumn(index: number) {
  sourceColumns.value.splice(index, 1)
  // Also remove corresponding ref column
  if (refColumns.value.length > index) {
    refColumns.value.splice(index, 1)
  }
  updateName()
}

function addRefColumn(columnName: string) {
  if (!refColumns.value.includes(columnName) && refColumns.value.length < sourceColumns.value.length) {
    refColumns.value.push(columnName)
  }
}

function removeRefColumn(index: number) {
  refColumns.value.splice(index, 1)
}

function updateName() {
  if (!name.value || name.value.startsWith('fk_')) {
    name.value = generateFKName.value
  }
}

function resetForm() {
  name.value = ''
  sourceColumns.value = []
  referencedTable.value = ''
  refColumns.value = []
  onUpdate.value = 'NO ACTION'
  onDelete.value = 'NO ACTION'
  showSqlPreview.value = false
  referencedColumns.value = []
}

function handleSave() {
  if (!name.value.trim() ||
      sourceColumns.value.length === 0 ||
      !referencedTable.value ||
      refColumns.value.length !== sourceColumns.value.length) {
    return
  }
  emit('save', foreignKeyDefinition.value)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    resetForm()
    await loadTables()
  }
})

watch(referencedTable, () => {
  refColumns.value = []
  loadReferencedColumns()
  updateName()
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add Foreign Key</DialogTitle>
        <DialogDescription>
          Create a foreign key constraint on table '{{ tableName }}'
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- FK Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Constraint Name</label>
          <Input v-model="name" placeholder="fk_table_column_reference" required />
        </div>

        <!-- Source Columns -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Source Columns (from this table)</label>

          <!-- Selected source columns -->
          <div v-if="sourceColumns.length > 0" class="flex flex-wrap gap-2">
            <div
              v-for="(col, index) in sourceColumns"
              :key="col"
              class="flex items-center gap-1 px-2 py-1 rounded-md bg-muted"
            >
              <span class="font-mono text-sm">{{ col }}</span>
              <button
                type="button"
                class="text-muted-foreground hover:text-red-500"
                @click="removeSourceColumn(index)"
              >
                <IconX class="h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- Available columns -->
          <div class="flex flex-wrap gap-2 p-2 border rounded-md">
            <button
              v-for="col in columns"
              :key="col.name"
              type="button"
              :class="[
                'px-2 py-1 rounded-md text-sm font-mono',
                sourceColumns.includes(col.name)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              ]"
              @click="addSourceColumn(col.name)"
            >
              {{ col.name }}
            </button>
          </div>
        </div>

        <!-- Referenced Table -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Referenced Table</label>
          <Select v-model="referencedTable">
            <SelectTrigger>
              <SelectValue placeholder="Select table..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="t in tables.filter(t => t.type === 'table')"
                :key="t.name"
                :value="t.name"
              >
                {{ t.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Referenced Columns -->
        <div v-if="referencedTable" class="space-y-2">
          <label class="text-sm font-medium">
            Referenced Columns
            <span class="text-muted-foreground font-normal">
              (select {{ sourceColumns.length }} columns in order)
            </span>
          </label>

          <!-- Selected ref columns -->
          <div v-if="refColumns.length > 0" class="flex flex-wrap gap-2">
            <div
              v-for="(col, index) in refColumns"
              :key="col"
              class="flex items-center gap-1 px-2 py-1 rounded-md bg-muted"
            >
              <span class="text-xs text-muted-foreground">{{ sourceColumns[index] }} →</span>
              <span class="font-mono text-sm">{{ col }}</span>
              <button
                type="button"
                class="text-muted-foreground hover:text-red-500"
                @click="removeRefColumn(index)"
              >
                <IconX class="h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- Available ref columns -->
          <div class="flex flex-wrap gap-2 p-2 border rounded-md">
            <button
              v-for="col in referencedColumns"
              :key="col.name"
              type="button"
              :disabled="refColumns.length >= sourceColumns.length"
              :class="[
                'px-2 py-1 rounded-md text-sm font-mono',
                refColumns.includes(col.name)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80 disabled:opacity-50'
              ]"
              @click="addRefColumn(col.name)"
            >
              {{ col.name }}
            </button>
          </div>
        </div>

        <!-- ON UPDATE / ON DELETE -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">ON UPDATE</label>
            <Select v-model="onUpdate">
              <SelectTrigger>
                <SelectValue :placeholder="onUpdate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">ON DELETE</label>
            <Select v-model="onDelete">
              <SelectTrigger>
                <SelectValue :placeholder="onDelete" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in actionOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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
        <Button
          @click="handleSave"
          :disabled="!name.trim() || sourceColumns.length === 0 || !referencedTable || refColumns.length !== sourceColumns.length"
        >
          Add Foreign Key
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
