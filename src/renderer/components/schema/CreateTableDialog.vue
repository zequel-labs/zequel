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
import DataTypeCombobox from './DataTypeCombobox.vue'
import { IconCode, IconPlus, IconTrash } from '@tabler/icons-vue'
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

function sanitizeName(value: string): string {
  return value.replace(/\s/g, '_')
}

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

function setPrimaryKey(index: number, checked: boolean) {
  if (checked) {
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
    <DialogContent class="max-w-5xl max-h-[90vh]">
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
            <Input :model-value="tableName" @update:model-value="tableName = sanitizeName($event)" placeholder="table_name" required />
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

          <ScrollArea class="max-h-96">
            <div class="border rounded-md">
              <table class="w-full">
                <thead>
                  <tr class="bg-muted text-xs font-medium border-b">
                    <th class="text-left px-3 py-2 whitespace-nowrap">Name</th>
                    <th class="text-left px-3 py-2 whitespace-nowrap">Type</th>
                    <th class="text-left px-3 py-2 whitespace-nowrap w-20">Length</th>
                    <th class="text-center px-2 py-2 whitespace-nowrap">Primary Key</th>
                    <th class="text-center px-2 py-2 whitespace-nowrap">Auto Increment</th>
                    <th class="text-center px-2 py-2 whitespace-nowrap">Not Null</th>
                    <th class="text-center px-2 py-2 whitespace-nowrap">Unique</th>
                    <th class="text-left px-3 py-2 whitespace-nowrap">Default</th>
                    <th class="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(col, index) in columns"
                    :key="index"
                    class="border-b last:border-0 hover:bg-muted/30"
                  >
                    <!-- Name -->
                    <td class="px-2 py-1.5">
                      <Input
                        :model-value="col.name"
                        @update:model-value="col.name = sanitizeName($event)"
                        placeholder="column_name"
                        class="h-8 text-sm"
                      />
                    </td>

                    <!-- Type (Combobox) -->
                    <td class="px-2 py-1.5 min-w-[160px]">
                      <DataTypeCombobox
                        :model-value="col.type"
                        @update:model-value="col.type = $event"
                        :data-types="dataTypes"
                        size="sm"
                      />
                    </td>

                    <!-- Length/Precision -->
                    <td class="px-2 py-1.5">
                      <Input
                        v-if="getTypeInfo(col.type)?.hasLength"
                        v-model.number="col.length"
                        type="number"
                        class="h-8 text-sm w-20"
                        min="1"
                      />
                      <Input
                        v-else-if="getTypeInfo(col.type)?.hasPrecision"
                        v-model.number="col.precision"
                        type="number"
                        class="h-8 text-sm w-20"
                        min="1"
                        placeholder="P"
                      />
                      <span v-else class="text-muted-foreground text-sm px-2">-</span>
                    </td>

                    <!-- Primary Key -->
                    <td class="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        :checked="col.primaryKey"
                        @change="setPrimaryKey(index, ($event.target as HTMLInputElement).checked)"
                        class="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      />
                    </td>

                    <!-- Auto Increment -->
                    <td class="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        v-model="col.autoIncrement"
                        :disabled="!col.primaryKey"
                        class="h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    <!-- Not Null -->
                    <td class="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        :checked="!col.nullable"
                        @change="col.nullable = !($event.target as HTMLInputElement).checked"
                        :disabled="col.primaryKey"
                        class="h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    <!-- Unique -->
                    <td class="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        v-model="col.unique"
                        :disabled="col.primaryKey"
                        class="h-4 w-4 rounded border-input accent-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    <!-- Default -->
                    <td class="px-2 py-1.5">
                      <Input
                        v-model="col.defaultValue"
                        placeholder="NULL"
                        class="h-8 text-sm min-w-[100px]"
                      />
                    </td>

                    <!-- Delete -->
                    <td class="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        class="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        :disabled="columns.length <= 1"
                        @click="removeColumn(index)"
                      >
                        <IconTrash class="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollArea>
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
