<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { Column, Index, ForeignKey } from '@/types/table'
import type { ColumnDefinition, IndexDefinition, ForeignKeyDefinition } from '@/types/schema-operations'
import { IconKey, IconLink, IconHash, IconLoader2, IconPlus, IconPencil, IconTrash } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ColumnEditorDialog from '../schema/ColumnEditorDialog.vue'
import IndexEditorDialog from '../schema/IndexEditorDialog.vue'
import ForeignKeyEditorDialog from '../schema/ForeignKeyEditorDialog.vue'
import ConfirmDeleteDialog from '../schema/ConfirmDeleteDialog.vue'

interface Props {
  tableName: string
  connectionId: string
  database: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

const connectionsStore = useConnectionsStore()

const columns = ref<Column[]>([])
const indexes = ref<Index[]>([])
const foreignKeys = ref<ForeignKey[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const operationError = ref<string | null>(null)
const operationSuccess = ref<string | null>(null)

const activeTab = ref<'columns' | 'indexes' | 'foreignKeys'>('columns')

// Dialog states
const showColumnEditor = ref(false)
const columnEditorMode = ref<'add' | 'edit'>('add')
const editingColumn = ref<Column | undefined>(undefined)

const showIndexEditor = ref(false)
const showForeignKeyEditor = ref(false)

const showDeleteConfirm = ref(false)
const deleteType = ref<'column' | 'index' | 'foreignKey'>('column')
const deleteTarget = ref<string>('')
const deleteSql = ref<string>('')

async function loadStructure() {
  isLoading.value = true
  error.value = null

  try {
    const [cols, idxs, fks] = await Promise.all([
      window.api.schema.columns(props.connectionId, props.tableName),
      window.api.schema.indexes(props.connectionId, props.tableName),
      window.api.schema.foreignKeys(props.connectionId, props.tableName)
    ])

    columns.value = cols
    indexes.value = idxs
    foreignKeys.value = fks
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load table structure'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadStructure)

watch(
  () => [props.tableName, props.connectionId],
  loadStructure
)

function formatType(col: Column): string {
  let type = col.type
  if (col.length) type += `(${col.length})`
  else if (col.precision && col.scale) type += `(${col.precision},${col.scale})`
  else if (col.precision) type += `(${col.precision})`
  return type
}

function showNotification(message: string, isError = false) {
  if (isError) {
    operationError.value = message
    operationSuccess.value = null
  } else {
    operationSuccess.value = message
    operationError.value = null
  }
  setTimeout(() => {
    operationError.value = null
    operationSuccess.value = null
  }, 5000)
}

// Column operations
function openAddColumn() {
  columnEditorMode.value = 'add'
  editingColumn.value = undefined
  showColumnEditor.value = true
}

function openEditColumn(col: Column) {
  columnEditorMode.value = 'edit'
  editingColumn.value = col
  showColumnEditor.value = true
}

async function handleSaveColumn(columnDef: ColumnDefinition) {
  try {
    let result
    if (columnEditorMode.value === 'add') {
      result = await window.api.schema.addColumn(props.connectionId, {
        table: props.tableName,
        column: columnDef
      })
    } else {
      result = await window.api.schema.modifyColumn(props.connectionId, {
        table: props.tableName,
        oldName: editingColumn.value!.name,
        newDefinition: columnDef
      })
    }

    if (result.success) {
      showNotification(`Column ${columnEditorMode.value === 'add' ? 'added' : 'modified'} successfully`)
      showColumnEditor.value = false
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Operation failed', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Operation failed', true)
  }
}

function confirmDropColumn(col: Column) {
  deleteType.value = 'column'
  deleteTarget.value = col.name
  deleteSql.value = `ALTER TABLE "${props.tableName}" DROP COLUMN "${col.name}"`
  showDeleteConfirm.value = true
}

async function handleDropColumn() {
  try {
    const result = await window.api.schema.dropColumn(props.connectionId, {
      table: props.tableName,
      columnName: deleteTarget.value
    })

    if (result.success) {
      showNotification('Column dropped successfully')
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Failed to drop column', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to drop column', true)
  }
}

// Index operations
function openAddIndex() {
  showIndexEditor.value = true
}

async function handleSaveIndex(indexDef: IndexDefinition) {
  try {
    const result = await window.api.schema.createIndex(props.connectionId, {
      table: props.tableName,
      index: indexDef
    })

    if (result.success) {
      showNotification('Index created successfully')
      showIndexEditor.value = false
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Failed to create index', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to create index', true)
  }
}

function confirmDropIndex(idx: Index) {
  deleteType.value = 'index'
  deleteTarget.value = idx.name
  deleteSql.value = `DROP INDEX "${idx.name}"`
  showDeleteConfirm.value = true
}

async function handleDropIndex() {
  try {
    const result = await window.api.schema.dropIndex(props.connectionId, {
      table: props.tableName,
      indexName: deleteTarget.value
    })

    if (result.success) {
      showNotification('Index dropped successfully')
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Failed to drop index', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to drop index', true)
  }
}

// Foreign key operations
function openAddForeignKey() {
  showForeignKeyEditor.value = true
}

async function handleSaveForeignKey(fkDef: ForeignKeyDefinition) {
  try {
    const result = await window.api.schema.addForeignKey(props.connectionId, {
      table: props.tableName,
      foreignKey: fkDef
    })

    if (result.success) {
      showNotification('Foreign key created successfully')
      showForeignKeyEditor.value = false
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Failed to create foreign key', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to create foreign key', true)
  }
}

function confirmDropForeignKey(fk: ForeignKey) {
  deleteType.value = 'foreignKey'
  deleteTarget.value = fk.name
  deleteSql.value = `ALTER TABLE "${props.tableName}" DROP CONSTRAINT "${fk.name}"`
  showDeleteConfirm.value = true
}

async function handleDropForeignKey() {
  try {
    const result = await window.api.schema.dropForeignKey(props.connectionId, {
      table: props.tableName,
      constraintName: deleteTarget.value
    })

    if (result.success) {
      showNotification('Foreign key dropped successfully')
      await loadStructure()
      emit('refresh')
    } else {
      showNotification(result.error || 'Failed to drop foreign key', true)
    }
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to drop foreign key', true)
  }
}

async function handleDeleteConfirm() {
  showDeleteConfirm.value = false
  if (deleteType.value === 'column') {
    await handleDropColumn()
  } else if (deleteType.value === 'index') {
    await handleDropIndex()
  } else if (deleteType.value === 'foreignKey') {
    await handleDropForeignKey()
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Notification banner -->
    <div
      v-if="operationError || operationSuccess"
      :class="[
        'px-4 py-2 text-sm',
        operationError ? 'bg-red-500/10 text-red-500 border-b border-red-500/30' : 'bg-green-500/10 text-green-500 border-b border-green-500/30'
      ]"
    >
      {{ operationError || operationSuccess }}
    </div>

    <!-- Tabs and Actions -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
      <div class="flex items-center gap-1">
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            activeTab === 'columns' ? 'bg-background shadow-sm' : 'hover:bg-muted'
          ]"
          @click="activeTab = 'columns'"
        >
          Columns ({{ columns.length }})
        </button>
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            activeTab === 'indexes' ? 'bg-background shadow-sm' : 'hover:bg-muted'
          ]"
          @click="activeTab = 'indexes'"
        >
          Indexes ({{ indexes.length }})
        </button>
        <button
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-colors',
            activeTab === 'foreignKeys' ? 'bg-background shadow-sm' : 'hover:bg-muted'
          ]"
          @click="activeTab = 'foreignKeys'"
        >
          Foreign Keys ({{ foreignKeys.length }})
        </button>
      </div>

      <!-- Add buttons -->
      <div class="flex items-center gap-2">
        <Button
          v-if="activeTab === 'columns'"
          variant="outline"
          size="sm"
          @click="openAddColumn"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Column
        </Button>
        <Button
          v-else-if="activeTab === 'indexes'"
          variant="outline"
          size="sm"
          @click="openAddIndex"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Index
        </Button>
        <Button
          v-else-if="activeTab === 'foreignKeys'"
          variant="outline"
          size="sm"
          @click="openAddForeignKey"
        >
          <IconPlus class="h-4 w-4 mr-1" />
          Add Foreign Key
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex-1 flex items-center justify-center"
    >
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="flex-1 p-4"
    >
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- Columns Tab -->
    <ScrollArea v-else-if="activeTab === 'columns'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Type</th>
            <th class="px-4 py-2 text-left font-medium border-b">Nullable</th>
            <th class="px-4 py-2 text-left font-medium border-b">Default</th>
            <th class="px-4 py-2 text-left font-medium border-b">Attributes</th>
            <th class="px-4 py-2 text-right font-medium border-b w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="col in columns"
            :key="col.name"
            class="hover:bg-muted/30 group"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconKey v-if="col.primaryKey" class="h-4 w-4 text-yellow-500" />
                <span class="font-medium">{{ col.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono text-blue-500">
              {{ formatType(col) }}
            </td>
            <td class="px-4 py-2 border-b">
              <Badge :variant="col.nullable ? 'secondary' : 'outline'">
                {{ col.nullable ? 'YES' : 'NO' }}
              </Badge>
            </td>
            <td class="px-4 py-2 border-b font-mono text-muted-foreground">
              {{ col.defaultValue ?? '-' }}
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex gap-1">
                <Badge v-if="col.primaryKey" variant="default">PK</Badge>
                <Badge v-if="col.autoIncrement" variant="secondary">AI</Badge>
                <Badge v-if="col.unique" variant="secondary">UQ</Badge>
              </div>
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-1.5 rounded-md hover:bg-muted"
                  title="Edit column"
                  @click="openEditColumn(col)"
                >
                  <IconPencil class="h-4 w-4 text-muted-foreground" />
                </button>
                <button
                  class="p-1.5 rounded-md hover:bg-red-500/10"
                  title="Drop column"
                  @click="confirmDropColumn(col)"
                >
                  <IconTrash class="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollArea>

    <!-- Indexes Tab -->
    <ScrollArea v-else-if="activeTab === 'indexes'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Columns</th>
            <th class="px-4 py-2 text-left font-medium border-b">Type</th>
            <th class="px-4 py-2 text-left font-medium border-b">Attributes</th>
            <th class="px-4 py-2 text-right font-medium border-b w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="idx in indexes"
            :key="idx.name"
            class="hover:bg-muted/30 group"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconHash class="h-4 w-4 text-blue-500" />
                <span class="font-medium">{{ idx.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono">
              {{ idx.columns.join(', ') }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ idx.type || 'BTREE' }}
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex gap-1">
                <Badge v-if="idx.primary" variant="default">PRIMARY</Badge>
                <Badge v-if="idx.unique && !idx.primary" variant="secondary">UNIQUE</Badge>
              </div>
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  v-if="!idx.primary"
                  class="p-1.5 rounded-md hover:bg-red-500/10"
                  title="Drop index"
                  @click="confirmDropIndex(idx)"
                >
                  <IconTrash class="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="indexes.length === 0"
        class="p-8 text-center text-muted-foreground"
      >
        No indexes found
      </div>
    </ScrollArea>

    <!-- Foreign Keys Tab -->
    <ScrollArea v-else-if="activeTab === 'foreignKeys'" class="flex-1">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-muted">
          <tr>
            <th class="px-4 py-2 text-left font-medium border-b">Name</th>
            <th class="px-4 py-2 text-left font-medium border-b">Column</th>
            <th class="px-4 py-2 text-left font-medium border-b">References</th>
            <th class="px-4 py-2 text-left font-medium border-b">On Update</th>
            <th class="px-4 py-2 text-left font-medium border-b">On Delete</th>
            <th class="px-4 py-2 text-right font-medium border-b w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fk in foreignKeys"
            :key="fk.name"
            class="hover:bg-muted/30 group"
          >
            <td class="px-4 py-2 border-b">
              <div class="flex items-center gap-2">
                <IconLink class="h-4 w-4 text-purple-500" />
                <span class="font-medium">{{ fk.name }}</span>
              </div>
            </td>
            <td class="px-4 py-2 border-b font-mono">
              {{ fk.column }}
            </td>
            <td class="px-4 py-2 border-b font-mono text-blue-500">
              {{ fk.referencedTable }}.{{ fk.referencedColumn }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ fk.onUpdate || 'NO ACTION' }}
            </td>
            <td class="px-4 py-2 border-b text-muted-foreground">
              {{ fk.onDelete || 'NO ACTION' }}
            </td>
            <td class="px-4 py-2 border-b">
              <div class="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  class="p-1.5 rounded-md hover:bg-red-500/10"
                  title="Drop foreign key"
                  @click="confirmDropForeignKey(fk)"
                >
                  <IconTrash class="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div
        v-if="foreignKeys.length === 0"
        class="p-8 text-center text-muted-foreground"
      >
        No foreign keys found
      </div>
    </ScrollArea>

    <!-- Dialogs -->
    <ColumnEditorDialog
      v-model:open="showColumnEditor"
      :mode="columnEditorMode"
      :table-name="tableName"
      :connection-id="connectionId"
      :column="editingColumn"
      :columns="columns"
      @save="handleSaveColumn"
    />

    <IndexEditorDialog
      v-model:open="showIndexEditor"
      :table-name="tableName"
      :connection-id="connectionId"
      :columns="columns"
      @save="handleSaveIndex"
    />

    <ForeignKeyEditorDialog
      v-model:open="showForeignKeyEditor"
      :table-name="tableName"
      :connection-id="connectionId"
      :database="database"
      :columns="columns"
      @save="handleSaveForeignKey"
    />

    <ConfirmDeleteDialog
      v-model:open="showDeleteConfirm"
      :title="`Drop ${deleteType === 'column' ? 'Column' : deleteType === 'index' ? 'Index' : 'Foreign Key'}`"
      :message="`Are you sure you want to drop ${deleteType} '${deleteTarget}'? This action cannot be undone.`"
      :sql="deleteSql"
      confirm-text="Drop"
      @confirm="handleDeleteConfirm"
    />
  </div>
</template>
