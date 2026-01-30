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
import DataTypeCombobox from './DataTypeCombobox.vue'
import { IconCode } from '@tabler/icons-vue'
import type { Column } from '@/types/table'
import type { ColumnDefinition, DataTypeInfo } from '@/types/schema-operations'

interface Props {
  open: boolean
  mode: 'add' | 'edit'
  tableName: string
  connectionId: string
  column?: Column
  columns?: Column[] // For afterColumn selection
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'add'
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', column: ColumnDefinition): void
  (e: 'close'): void
}>()

const dataTypes = ref<DataTypeInfo[]>([])
const isLoading = ref(false)
const showSqlPreview = ref(false)

// Form state
const name = ref('')
const type = ref('')
const length = ref<number | undefined>(undefined)
const precision = ref<number | undefined>(undefined)
const scale = ref<number | undefined>(undefined)
const nullable = ref(true)
const defaultValue = ref<string>('')
const hasDefault = ref(false)
const primaryKey = ref(false)
const autoIncrement = ref(false)
const unique = ref(false)
const comment = ref('')
const afterColumn = ref<string>('')

// Get current data type info
const currentTypeInfo = computed(() => {
  return dataTypes.value.find((t) => t.name === type.value)
})

const showLength = computed(() => currentTypeInfo.value?.hasLength)
const showPrecision = computed(() => currentTypeInfo.value?.hasPrecision)

const afterColumnOptions = computed(() => {
  const options = [{ value: '', label: '(At end)' }, { value: 'FIRST', label: 'FIRST' }]
  if (props.columns) {
    for (const col of props.columns) {
      if (col.name !== props.column?.name) {
        options.push({ value: col.name, label: `After ${col.name}` })
      }
    }
  }
  return options
})

// Build column definition
const columnDefinition = computed<ColumnDefinition>(() => ({
  name: name.value,
  type: type.value,
  length: showLength.value ? length.value : undefined,
  precision: showPrecision.value ? precision.value : undefined,
  scale: showPrecision.value ? scale.value : undefined,
  nullable: nullable.value,
  defaultValue: hasDefault.value ? (defaultValue.value || null) : undefined,
  primaryKey: primaryKey.value,
  autoIncrement: autoIncrement.value,
  unique: unique.value,
  comment: comment.value || undefined,
  afterColumn: afterColumn.value || undefined
}))

// SQL preview
const sqlPreview = computed(() => {
  const col = columnDefinition.value
  let def = `"${col.name}" ${col.type}`
  if (col.length) def += `(${col.length})`
  else if (col.precision !== undefined && col.scale !== undefined) def += `(${col.precision},${col.scale})`
  else if (col.precision !== undefined) def += `(${col.precision})`
  if (col.primaryKey) def += ' PRIMARY KEY'
  if (col.autoIncrement) def += ' AUTOINCREMENT'
  if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
  if (col.unique && !col.primaryKey) def += ' UNIQUE'
  if (col.defaultValue !== undefined) {
    const val = typeof col.defaultValue === 'string' && col.defaultValue !== ''
      ? `'${col.defaultValue}'`
      : (col.defaultValue === null ? 'NULL' : col.defaultValue)
    def += ` DEFAULT ${val}`
  }

  if (props.mode === 'add') {
    return `ALTER TABLE "${props.tableName}" ADD COLUMN ${def}`
  } else {
    return `-- Column definition:\n${def}`
  }
})

async function loadDataTypes() {
  try {
    dataTypes.value = await window.api.schema.getDataTypes(props.connectionId)
    if (dataTypes.value.length > 0 && !type.value) {
      type.value = dataTypes.value[0].name
    }
  } catch (e) {
    console.error('Failed to load data types:', e)
  }
}

function resetForm() {
  if (props.mode === 'edit' && props.column) {
    name.value = props.column.name
    type.value = props.column.type
    length.value = props.column.length
    precision.value = props.column.precision
    scale.value = props.column.scale
    nullable.value = props.column.nullable
    hasDefault.value = props.column.defaultValue !== undefined && props.column.defaultValue !== null
    defaultValue.value = props.column.defaultValue !== undefined && props.column.defaultValue !== null
      ? String(props.column.defaultValue)
      : ''
    primaryKey.value = props.column.primaryKey
    autoIncrement.value = props.column.autoIncrement
    unique.value = props.column.unique
    comment.value = props.column.comment || ''
  } else {
    name.value = ''
    type.value = dataTypes.value.length > 0 ? dataTypes.value[0].name : ''
    length.value = undefined
    precision.value = undefined
    scale.value = undefined
    nullable.value = true
    hasDefault.value = false
    defaultValue.value = ''
    primaryKey.value = false
    autoIncrement.value = false
    unique.value = false
    comment.value = ''
    afterColumn.value = ''
  }
}

function handleSave() {
  if (!name.value.trim()) return
  emit('save', columnDefinition.value)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}

// Apply default length/precision when type changes
watch(type, (newType) => {
  const typeInfo = dataTypes.value.find((t) => t.name === newType)
  if (typeInfo) {
    if (typeInfo.hasLength && typeInfo.defaultLength && !length.value) {
      length.value = typeInfo.defaultLength
    }
    if (typeInfo.hasPrecision && typeInfo.defaultPrecision && !precision.value) {
      precision.value = typeInfo.defaultPrecision
      scale.value = typeInfo.defaultScale
    }
  }
})

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    loadDataTypes()
    resetForm()
    showSqlPreview.value = false
  }
})

onMounted(() => {
  if (props.open) {
    loadDataTypes()
    resetForm()
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ mode === 'add' ? 'Add Column' : 'Edit Column' }}</DialogTitle>
        <DialogDescription>
          {{ mode === 'add' ? 'Add a new column to' : 'Modify column in' }} table '{{ tableName }}'
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- Column Name -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Column Name</label>
          <Input v-model="name" placeholder="column_name" required />
        </div>

        <!-- Type and Length/Precision -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Data Type</label>
            <DataTypeCombobox
              :model-value="type"
              @update:model-value="type = $event"
              :data-types="dataTypes"
            />
          </div>
          <div v-if="showLength" class="space-y-2">
            <label class="text-sm font-medium">Length</label>
            <Input v-model.number="length" type="number" min="1" />
          </div>
          <div v-else-if="showPrecision" class="space-y-2">
            <label class="text-sm font-medium">Precision</label>
            <Input v-model.number="precision" type="number" min="1" />
          </div>
        </div>

        <!-- Scale (for precision types) -->
        <div v-if="showPrecision" class="space-y-2">
          <label class="text-sm font-medium">Scale</label>
          <Input v-model.number="scale" type="number" min="0" />
        </div>

        <!-- Constraints -->
        <div class="space-y-3">
          <label class="text-sm font-medium">Constraints</label>
          <div class="flex flex-wrap gap-4">
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="primaryKey"
                class="rounded border-input"
              />
              Primary Key
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="autoIncrement"
                :disabled="!primaryKey"
                class="rounded border-input"
              />
              Auto Increment
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="unique"
                :disabled="primaryKey"
                class="rounded border-input"
              />
              Unique
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="nullable"
                :disabled="primaryKey"
                class="rounded border-input"
              />
              Nullable
            </label>
          </div>
        </div>

        <!-- Default Value -->
        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              v-model="hasDefault"
              class="rounded border-input"
            />
            Default Value
          </label>
          <Input
            v-if="hasDefault"
            v-model="defaultValue"
            placeholder="Enter default value (leave empty for NULL)"
          />
        </div>

        <!-- After Column (MySQL) -->
        <div v-if="mode === 'add' && afterColumnOptions.length > 2" class="space-y-2">
          <label class="text-sm font-medium">Position</label>
          <Select v-model="afterColumn">
            <SelectTrigger>
              <SelectValue :placeholder="afterColumn || '(At end)'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in afterColumnOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Comment -->
        <div class="space-y-2">
          <label class="text-sm font-medium">Comment (optional)</label>
          <Input v-model="comment" placeholder="Column description" />
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
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto"
          >{{ sqlPreview }}</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">Cancel</Button>
        <Button @click="handleSave" :disabled="!name.trim()">
          {{ mode === 'add' ? 'Add Column' : 'Save Changes' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
