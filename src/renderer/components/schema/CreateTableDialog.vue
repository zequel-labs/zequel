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
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconCode, IconPlus, IconTrash, IconGripVertical } from '@tabler/icons-vue'
import type { ColumnDefinition, TableDefinition, DataTypeInfo } from '@/types/schema-operations'

interface Props {
  open: boolean
  connectionId: string
  database?: string
}

const props = withDefaults(defineProps<Props>(), {
  database: ''
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', table: TableDefinition): void
  (e: 'close'): void
}>()

const showSqlPreview = ref(false)
const dataTypes = ref<DataTypeInfo[]>([])

// Form state
const tableName = ref('')
const columns = ref<ColumnDefinition[]>([])
const tableComment = ref('')

// Default column template
function createDefaultColumn(): ColumnDefinition {
  return {
    name: '',
    type: dataTypes.value.length > 0 ? dataTypes.value[0].name : 'TEXT',
    nullable: true,
    primaryKey: false,
    autoIncrement: false,
    unique: false
  }
}

// Table definition
const tableDefinition = computed<TableDefinition>(() => ({
  name: tableName.value,
  columns: columns.value.filter((c) => c.name.trim()),
  comment: tableComment.value || undefined
}))

// SQL preview
const sqlPreview = computed(() => {
  const table = tableDefinition.value
  if (!table.name || table.columns.length === 0) {
    return '-- Enter table name and at least one column'
  }

  const columnDefs: string[] = []

  for (const col of table.columns) {
    let def = `  "${col.name}" ${col.type}`
    if (col.length) def += `(${col.length})`
    else if (col.precision !== undefined && col.scale !== undefined) def += `(${col.precision},${col.scale})`
    if (col.primaryKey) def += ' PRIMARY KEY'
    if (col.autoIncrement) def += ' AUTOINCREMENT'
    if (!col.nullable && !col.primaryKey) def += ' NOT NULL'
    if (col.unique && !col.primaryKey) def += ' UNIQUE'
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      const val = typeof col.defaultValue === 'string' && col.defaultValue !== ''
        ? `'${col.defaultValue}'`
        : col.defaultValue
      def += ` DEFAULT ${val}`
    }
    columnDefs.push(def)
  }

  return `CREATE TABLE "${table.name}" (\n${columnDefs.join(',\n')}\n);`
})

async function loadDataTypes() {
  try {
    dataTypes.value = await window.api.schema.getDataTypes(props.connectionId)
  } catch (e) {
    console.error('Failed to load data types:', e)
  }
}

function addColumn() {
  columns.value.push(createDefaultColumn())
}

function removeColumn(index: number) {
  columns.value.splice(index, 1)
}

function setPrimaryKey(index: number, value: boolean) {
  // Only one column can be primary key for now (simplification)
  if (value) {
    columns.value.forEach((col, i) => {
      col.primaryKey = i === index
    })
    columns.value[index].nullable = false
  } else {
    columns.value[index].primaryKey = false
  }
}

function getTypeInfo(typeName: string): DataTypeInfo | undefined {
  return dataTypes.value.find((t) => t.name === typeName)
}

function resetForm() {
  tableName.value = ''
  tableComment.value = ''
  columns.value = [
    {
      name: 'id',
      type: dataTypes.value.find((t) => t.category === 'numeric')?.name || 'INTEGER',
      nullable: false,
      primaryKey: true,
      autoIncrement: true,
      unique: false
    },
    createDefaultColumn()
  ]
  showSqlPreview.value = false
}

function handleSave() {
  const table = tableDefinition.value
  if (!table.name.trim() || table.columns.length === 0) return
  emit('save', table)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    await loadDataTypes()
    resetForm()
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-4xl max-h-[90vh]" @close="handleClose">
      <DialogHeader>
        <DialogTitle>Create Table</DialogTitle>
        <DialogDescription>
          {{ database ? `Create a new table in database '${database}'` : 'Create a new table' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- Table Name -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Table Name</label>
            <Input v-model="tableName" placeholder="table_name" required />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium">Comment (optional)</label>
            <Input v-model="tableComment" placeholder="Table description" />
          </div>
        </div>

        <!-- Columns -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium">Columns</label>
            <Button type="button" variant="outline" size="sm" @click="addColumn">
              <IconPlus class="h-4 w-4 mr-1" />
              Add Column
            </Button>
          </div>

          <ScrollArea class="max-h-80">
            <div class="border rounded-md">
              <!-- Header -->
              <div class="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-medium border-b">
                <div class="col-span-3">Name</div>
                <div class="col-span-2">Type</div>
                <div class="col-span-1">Length</div>
                <div class="col-span-1 text-center">PK</div>
                <div class="col-span-1 text-center">AI</div>
                <div class="col-span-1 text-center">NN</div>
                <div class="col-span-1 text-center">UQ</div>
                <div class="col-span-2">Default</div>
              </div>

              <!-- Column rows -->
              <div
                v-for="(col, index) in columns"
                :key="index"
                class="grid grid-cols-12 gap-2 px-3 py-2 items-center border-b last:border-0 hover:bg-muted/30"
              >
                <!-- Name -->
                <div class="col-span-3">
                  <Input
                    v-model="col.name"
                    placeholder="column_name"
                    class="h-8 text-sm"
                  />
                </div>

                <!-- Type -->
                <div class="col-span-2">
                  <Select v-model="col.type">
                    <SelectTrigger class="h-8 text-sm">
                      <SelectValue :placeholder="col.type || 'Select type'" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="t in dataTypes" :key="t.name" :value="t.name">
                        {{ t.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Length/Precision -->
                <div class="col-span-1">
                  <Input
                    v-if="getTypeInfo(col.type)?.hasLength"
                    v-model.number="col.length"
                    type="number"
                    class="h-8 text-sm"
                    min="1"
                  />
                  <Input
                    v-else-if="getTypeInfo(col.type)?.hasPrecision"
                    v-model.number="col.precision"
                    type="number"
                    class="h-8 text-sm"
                    min="1"
                    placeholder="P,S"
                  />
                  <span v-else class="text-muted-foreground">-</span>
                </div>

                <!-- Primary Key -->
                <div class="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    :checked="col.primaryKey"
                    @change="setPrimaryKey(index, ($event.target as HTMLInputElement).checked)"
                    class="rounded border-input"
                  />
                </div>

                <!-- Auto Increment -->
                <div class="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    v-model="col.autoIncrement"
                    :disabled="!col.primaryKey"
                    class="rounded border-input"
                  />
                </div>

                <!-- Not Null (inverse of nullable) -->
                <div class="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    :checked="!col.nullable"
                    @change="col.nullable = !($event.target as HTMLInputElement).checked"
                    :disabled="col.primaryKey"
                    class="rounded border-input"
                  />
                </div>

                <!-- Unique -->
                <div class="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    v-model="col.unique"
                    :disabled="col.primaryKey"
                    class="rounded border-input"
                  />
                </div>

                <!-- Default -->
                <div class="col-span-1">
                  <Input
                    v-model="col.defaultValue"
                    placeholder="default"
                    class="h-8 text-sm"
                  />
                </div>

                <!-- Delete button -->
                <div class="col-span-1 flex justify-center">
                  <button
                    type="button"
                    class="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                    :disabled="columns.length <= 1"
                    @click="removeColumn(index)"
                  >
                    <IconTrash class="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <p class="text-xs text-muted-foreground">
            PK = Primary Key, AI = Auto Increment, NN = Not Null, UQ = Unique
          </p>
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
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto whitespace-pre-wrap max-h-40"
          >{{ sqlPreview }}</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">Cancel</Button>
        <Button
          @click="handleSave"
          :disabled="!tableName.trim() || columns.filter(c => c.name.trim()).length === 0"
        >
          Create Table
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
