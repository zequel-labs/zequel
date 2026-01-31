<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import type { Column, Index, ForeignKey } from '@/types/table'
import type { ColumnDefinition, IndexDefinition, ForeignKeyDefinition } from '@/types/schema-operations'
import { IconLink, IconHash, IconLoader2, IconPencil, IconTrash } from '@tabler/icons-vue'
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

const loadStructure = async () => {
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

const formatType = (col: Column): string => {
  let type = col.type
  if (col.length) type += `(${col.length})`
  else if (col.precision && col.scale) type += `(${col.precision},${col.scale})`
  else if (col.precision) type += `(${col.precision})`
  return type
}

const showNotification = (message: string, isError = false) => {
  if (isError) {
    toast.error(message)
  } else {
    toast.success(message)
  }
}

// Column operations
const openAddColumn = () => {
  columnEditorMode.value = 'add'
  editingColumn.value = undefined
  showColumnEditor.value = true
}

const openEditColumn = (col: Column) => {
  columnEditorMode.value = 'edit'
  editingColumn.value = col
  showColumnEditor.value = true
}

const handleSaveColumn = async (columnDef: ColumnDefinition) => {
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

const confirmDropColumn = (col: Column) => {
  deleteType.value = 'column'
  deleteTarget.value = col.name
  deleteSql.value = `ALTER TABLE "${props.tableName}" DROP COLUMN "${col.name}"`
  showDeleteConfirm.value = true
}

const handleDropColumn = async () => {
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
const openAddIndex = () => {
  showIndexEditor.value = true
}

const handleSaveIndex = async (indexDef: IndexDefinition) => {
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

const confirmDropIndex = (idx: Index) => {
  deleteType.value = 'index'
  deleteTarget.value = idx.name
  deleteSql.value = `DROP INDEX "${idx.name}"`
  showDeleteConfirm.value = true
}

const handleDropIndex = async () => {
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
const openAddForeignKey = () => {
  showForeignKeyEditor.value = true
}

const handleSaveForeignKey = async (fkDef: ForeignKeyDefinition) => {
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

const confirmDropForeignKey = (fk: ForeignKey) => {
  deleteType.value = 'foreignKey'
  deleteTarget.value = fk.name
  deleteSql.value = `ALTER TABLE "${props.tableName}" DROP CONSTRAINT "${fk.name}"`
  showDeleteConfirm.value = true
}

const handleDropForeignKey = async () => {
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

const handleDeleteConfirm = async () => {
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
    <!-- Tabs and Actions -->
    <div class="flex items-center justify-between px-2 py-1.5 border-b border-border bg-background">
      <div class="flex items-center gap-1">
        <button :class="[
          'px-2.5 py-1 text-xs rounded-md transition-colors',
          activeTab === 'columns' ? 'bg-muted shadow-sm font-medium' : 'text-muted-foreground hover:bg-muted/50'
        ]" @click="activeTab = 'columns'">
          Columns ({{ columns.length }})
        </button>
        <button :class="[
          'px-2.5 py-1 text-xs rounded-md transition-colors',
          activeTab === 'indexes' ? 'bg-muted shadow-sm font-medium' : 'text-muted-foreground hover:bg-muted/50'
        ]" @click="activeTab = 'indexes'">
          Indexes ({{ indexes.length }})
        </button>
        <button :class="[
          'px-2.5 py-1 text-xs rounded-md transition-colors',
          activeTab === 'foreignKeys' ? 'bg-muted shadow-sm font-medium' : 'text-muted-foreground hover:bg-muted/50'
        ]" @click="activeTab = 'foreignKeys'">
          Foreign Keys ({{ foreignKeys.length }})
        </button>
      </div>

      <!-- Add buttons -->
      <div class="flex items-center gap-1">
        <Button v-if="activeTab === 'columns'" variant="default" size="sm" class="h-6 text-xs px-2" @click="openAddColumn">
          Add Column
        </Button>
        <Button v-else-if="activeTab === 'indexes'" variant="default" size="sm" class="h-6 text-xs px-2" @click="openAddIndex">
          Add Index
        </Button>
        <Button v-else-if="activeTab === 'foreignKeys'" variant="default" size="sm" class="h-6 text-xs px-2" @click="openAddForeignKey">
          Add Foreign Key
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center">
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 p-4">
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500">
        {{ error }}
      </div>
    </div>

    <!-- Columns Tab -->
    <ScrollArea v-else-if="activeTab === 'columns'" class="flex-1">
      <table class="w-full border-collapse text-xs">
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Name</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Type</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Nullable</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Default</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Attributes</th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="col in columns" :key="col.name" class="hover:bg-muted/30 group">
            <td class="px-2 py-1 border-b border-r border-border font-medium">
              {{ col.name }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono">
              {{ formatType(col) }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border">
              <Badge :variant="col.nullable ? 'secondary' : 'outline'" class="text-[10px] px-1.5 py-0">
                {{ col.nullable ? 'YES' : 'NO' }}
              </Badge>
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono text-muted-foreground">
              {{ col.defaultValue ?? '-' }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border">
              <div class="flex gap-1">
                <Badge v-if="col.primaryKey" variant="default" class="text-[10px] px-1.5 py-0">PK</Badge>
                <Badge v-if="col.autoIncrement" variant="secondary" class="text-[10px] px-1.5 py-0">AI</Badge>
                <Badge v-if="col.unique" variant="secondary" class="text-[10px] px-1.5 py-0">UQ</Badge>
              </div>
            </td>
            <td class="px-2 py-1 border-b border-border">
              <div class="flex justify-end gap-1">
                <button class="p-1 rounded-md hover:bg-muted" title="Edit column" @click="openEditColumn(col)">
                  <IconPencil class="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button class="p-1 rounded-md hover:bg-red-500/10" title="Drop column"
                  @click="confirmDropColumn(col)">
                  <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollArea>

    <!-- Indexes Tab -->
    <ScrollArea v-else-if="activeTab === 'indexes'" class="flex-1">
      <table class="w-full border-collapse text-xs">
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Name</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Columns</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Type</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Attributes</th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="idx in indexes" :key="idx.name" class="hover:bg-muted/30 group">
            <td class="px-2 py-1 border-b border-r border-border">
              <div class="flex items-center gap-1.5">
                <IconHash class="h-3.5 w-3.5 text-blue-500" />
                <span class="font-medium">{{ idx.name }}</span>
              </div>
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono">
              {{ idx.columns.join(', ') }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground">
              {{ idx.type || 'BTREE' }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border">
              <div class="flex gap-1">
                <Badge v-if="idx.primary" variant="default" class="text-[10px] px-1.5 py-0">PRIMARY</Badge>
                <Badge v-if="idx.unique && !idx.primary" variant="secondary" class="text-[10px] px-1.5 py-0">UNIQUE</Badge>
              </div>
            </td>
            <td class="px-2 py-1 border-b border-border">
              <div class="flex justify-end gap-1">
                <button v-if="!idx.primary" class="p-1 rounded-md hover:bg-red-500/10" title="Drop index"
                  @click="confirmDropIndex(idx)">
                  <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="indexes.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No indexes found
      </div>
    </ScrollArea>

    <!-- Foreign Keys Tab -->
    <ScrollArea v-else-if="activeTab === 'foreignKeys'" class="flex-1">
      <table class="w-full border-collapse text-xs">
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Name</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">Column</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">References</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">On Update</th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap">On Delete</th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fk in foreignKeys" :key="fk.name" class="hover:bg-muted/30 group">
            <td class="px-2 py-1 border-b border-r border-border">
              <div class="flex items-center gap-1.5">
                <IconLink class="h-3.5 w-3.5 text-purple-500" />
                <span class="font-medium">{{ fk.name }}</span>
              </div>
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono">
              {{ fk.column }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono">
              {{ fk.referencedTable }}.{{ fk.referencedColumn }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground">
              {{ fk.onUpdate || 'NO ACTION' }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground">
              {{ fk.onDelete || 'NO ACTION' }}
            </td>
            <td class="px-2 py-1 border-b border-border">
              <div class="flex justify-end gap-1">
                <button class="p-1 rounded-md hover:bg-red-500/10" title="Drop foreign key"
                  @click="confirmDropForeignKey(fk)">
                  <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="foreignKeys.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No foreign keys found
      </div>
    </ScrollArea>

    <!-- Dialogs -->
    <ColumnEditorDialog v-model:open="showColumnEditor" :mode="columnEditorMode" :table-name="tableName"
      :connection-id="connectionId" :column="editingColumn" :columns="columns" @save="handleSaveColumn" />

    <IndexEditorDialog v-model:open="showIndexEditor" :table-name="tableName" :connection-id="connectionId"
      :columns="columns" @save="handleSaveIndex" />

    <ForeignKeyEditorDialog v-model:open="showForeignKeyEditor" :table-name="tableName" :connection-id="connectionId"
      :database="database" :columns="columns" @save="handleSaveForeignKey" />

    <ConfirmDeleteDialog v-model:open="showDeleteConfirm"
      :title="`Drop ${deleteType === 'column' ? 'Column' : deleteType === 'index' ? 'Index' : 'Foreign Key'}`"
      :message="`Are you sure you want to drop ${deleteType} '${deleteTarget}'? This action cannot be undone.`"
      :sql="deleteSql" confirm-text="Drop" @confirm="handleDeleteConfirm" />
  </div>
</template>