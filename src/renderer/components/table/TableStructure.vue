<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { StructureTab, ColumnChangeStatus } from '@/types/table'
import type { Column, Index, ForeignKey, Trigger } from '@/types/table'
import type { ColumnDefinition, IndexDefinition, ForeignKeyDefinition, ReferenceAction } from '@/types/schema-operations'
import type { DataTypeInfo } from '@/types/schema-operations'
import { DatabaseType } from '@/types/connection'
import { useColumnResize } from '@/composables/useColumnResize'
import { IconLoader2, IconTrash, IconArrowBackUp, IconRefresh, IconPlus } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ColumnInlineEditor from '../schema/ColumnInlineEditor.vue'
import { InlineAutocomplete } from '@/components/ui/inline-autocomplete'

const REFERENCE_ACTIONS: ReferenceAction[] = ['NO ACTION', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT']

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
const statusBarStore = useStatusBarStore()

const isPostgres = computed(() =>
  connectionsStore.activeConnection?.type === DatabaseType.PostgreSQL
)

const columns = ref<Column[]>([])
const originalColumns = ref<Column[]>([])
const originalColumnCount = ref(0)
const pendingDropIndices = ref(new Set<number>())
const isApplying = ref(false)

const indexes = ref<Index[]>([])
const foreignKeys = ref<ForeignKey[]>([])
const triggers = ref<Trigger[]>([])
const dataTypes = ref<DataTypeInfo[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const activeTab = ref<StructureTab>(StructureTab.Columns)

// Column resize for Indexes tab
const { columnWidths: idxWidths, resizingColumn: idxResizing, onResizeStart: idxResizeStart } = useColumnResize({
  name: 200,
  columns: 250,
  type: 120,
  unique: 80,
  actions: 48,
})

// Column resize for Relations tab
const { columnWidths: fkWidths, resizingColumn: fkResizing, onResizeStart: fkResizeStart } = useColumnResize({
  name: 180,
  column: 130,
  refSchema: 120,
  refTable: 150,
  refColumn: 130,
  onUpdate: 120,
  onDelete: 120,
  actions: 48,
})

// Column resize for Triggers tab
const { columnWidths: trigWidths, resizingColumn: trigResizing, onResizeStart: trigResizeStart } = useColumnResize({
  name: 200,
  timing: 120,
  event: 120,
  actions: 48,
})

// Pending state for indexes
const pendingNewIndexes = ref<IndexDefinition[]>([])
const pendingDropIndexNames = ref<Set<string>>(new Set())

// Pending state for foreign keys
const pendingNewForeignKeys = ref<ForeignKeyDefinition[]>([])
const pendingNewFkSchemas = ref<string[]>([])
const pendingDropFKNames = ref<Set<string>>(new Set())

// Pending state for triggers
const pendingDropTriggerNames = ref<Set<string>>(new Set())

// Change detection
const getColumnStatus = (index: number): ColumnChangeStatus => {
  if (pendingDropIndices.value.has(index)) return ColumnChangeStatus.Dropped
  if (index >= originalColumnCount.value) return ColumnChangeStatus.Added
  const current = columns.value[index]
  const original = originalColumns.value[index]
  if (!current || !original) return ColumnChangeStatus.Unchanged
  if (
    current.name !== original.name ||
    current.type !== original.type ||
    current.nullable !== original.nullable ||
    current.primaryKey !== original.primaryKey ||
    current.autoIncrement !== original.autoIncrement ||
    current.unique !== original.unique ||
    current.defaultValue !== original.defaultValue ||
    current.length !== original.length ||
    current.precision !== original.precision ||
    current.scale !== original.scale ||
    current.comment !== original.comment
  ) {
    return ColumnChangeStatus.Modified
  }
  return ColumnChangeStatus.Unchanged
}

const columnStatuses = computed(() => columns.value.map((_, i) => getColumnStatus(i)))

const changesCount = computed(() => {
  const columnChanges = columnStatuses.value.filter(s => s !== ColumnChangeStatus.Unchanged).length
  return columnChanges
    + pendingNewIndexes.value.length
    + pendingDropIndexNames.value.size
    + pendingNewForeignKeys.value.length
    + pendingDropFKNames.value.size
    + pendingDropTriggerNames.value.size
})

// Sync pending count to status bar
watch(changesCount, (count) => {
  statusBarStore.structureChangesCount = count
}, { immediate: true })

const loadStructure = async () => {
  isLoading.value = true
  error.value = null

  try {
    const [cols, idxs, fks, trgs] = await Promise.all([
      window.api.schema.columns(props.connectionId, props.tableName),
      window.api.schema.indexes(props.connectionId, props.tableName),
      window.api.schema.foreignKeys(props.connectionId, props.tableName),
      window.api.schema.getTriggers(props.connectionId, props.tableName)
    ])

    columns.value = cols
    originalColumns.value = JSON.parse(JSON.stringify(cols))
    originalColumnCount.value = cols.length
    pendingDropIndices.value.clear()
    indexes.value = idxs
    foreignKeys.value = fks
    triggers.value = trgs

    // Clear all pending state
    pendingNewIndexes.value = []
    pendingDropIndexNames.value = new Set()
    pendingNewForeignKeys.value = []
    pendingNewFkSchemas.value = []
    pendingDropFKNames.value = new Set()
    pendingDropTriggerNames.value = new Set()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load table structure'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  statusBarStore.setStructureCallbacks({
    onApply: applyChanges,
    onDiscard: discardChanges,
  })
  await Promise.all([
    loadStructure(),
    loadDataTypes()
  ])
})

onUnmounted(() => {
  statusBarStore.structureChangesCount = 0
  statusBarStore.setStructureCallbacks({})
})

const loadDataTypes = async (): Promise<void> => {
  try {
    dataTypes.value = await window.api.schema.getDataTypes(props.connectionId)
  } catch (e) {
    console.error('Failed to load data types:', e)
  }
}

watch(
  () => [props.tableName, props.connectionId],
  loadStructure
)

const showNotification = (message: string, isError = false) => {
  if (isError) {
    toast.error(message)
  } else {
    toast.success(message)
  }
}

// Column operations — Add locally (no API call)
const addColumn = () => {
  const defaultType = dataTypes.value.length > 0
    ? (dataTypes.value.find(t => t.name.toLowerCase() === 'integer' || t.name.toLowerCase() === 'int')?.name ?? dataTypes.value[0].name)
    : 'TEXT'

  const baseName = 'new_column'
  const existingNames = new Set(columns.value.map(c => c.name))
  let name = baseName
  let i = 1
  while (existingNames.has(name)) {
    name = `${baseName}_${i++}`
  }

  columns.value.push({
    name,
    type: defaultType,
    nullable: true,
    defaultValue: null,
    primaryKey: false,
    autoIncrement: false,
    unique: false,
  })
}

// Toggle drop column — no confirm dialog needed
const toggleDropColumn = (index: number) => {
  if (index >= originalColumnCount.value) {
    // New pending column — remove it from the list
    columns.value.splice(index, 1)
  } else {
    // Existing column — toggle drop mark
    if (pendingDropIndices.value.has(index)) {
      pendingDropIndices.value.delete(index)
    } else {
      pendingDropIndices.value.add(index)
    }
    // Trigger reactivity
    pendingDropIndices.value = new Set(pendingDropIndices.value)
  }
}

// Index inline operations
const addIndex = () => {
  const baseName = `idx_${props.tableName}`
  const existingNames = new Set([
    ...indexes.value.map(idx => idx.name),
    ...pendingNewIndexes.value.map(idx => idx.name)
  ])
  let name = baseName
  let i = 1
  while (existingNames.has(name)) {
    name = `${baseName}_${i++}`
  }
  pendingNewIndexes.value.push({ name, columns: [], unique: false })
}

const toggleDropIndex = (indexName: string) => {
  if (pendingDropIndexNames.value.has(indexName)) {
    pendingDropIndexNames.value.delete(indexName)
  } else {
    pendingDropIndexNames.value.add(indexName)
  }
  pendingDropIndexNames.value = new Set(pendingDropIndexNames.value)
}

const removeNewIndex = (i: number) => {
  pendingNewIndexes.value.splice(i, 1)
}

const updateNewIndexColumns = (index: number, value: string) => {
  pendingNewIndexes.value[index].columns = value.split(',').map(s => s.trim()).filter(Boolean)
}

// Foreign key inline operations
const addForeignKey = () => {
  const baseName = `fk_${props.tableName}`
  const existingNames = new Set([
    ...foreignKeys.value.map(fk => fk.name),
    ...pendingNewForeignKeys.value.map(fk => fk.name)
  ])
  let name = baseName
  let i = 1
  while (existingNames.has(name)) {
    name = `${baseName}_${i++}`
  }
  pendingNewForeignKeys.value.push({
    name,
    columns: [''],
    referencedTable: '',
    referencedColumns: [''],
    onUpdate: 'NO ACTION',
    onDelete: 'NO ACTION',
  })
  pendingNewFkSchemas.value.push('')
}

const toggleDropForeignKey = (fkName: string) => {
  if (pendingDropFKNames.value.has(fkName)) {
    pendingDropFKNames.value.delete(fkName)
  } else {
    pendingDropFKNames.value.add(fkName)
  }
  pendingDropFKNames.value = new Set(pendingDropFKNames.value)
}

const removeNewForeignKey = (i: number) => {
  pendingNewForeignKeys.value.splice(i, 1)
  pendingNewFkSchemas.value.splice(i, 1)
}

const columnNames = computed(() =>
  columns.value.map(c => c.name)
)

const schemaNames = computed(() => {
  const schemas = connectionsStore.schemas.get(props.connectionId)
  if (!schemas) return []
  return schemas.filter(s => !s.isSystem).map(s => s.name)
})

const getTableNamesForSchema = (schema: string): string[] => {
  const tables = connectionsStore.tables.get(props.connectionId)
  if (!tables) return []
  if (schema) {
    return tables.filter(t => t.schema === schema).map(t => t.name)
  }
  return tables.map(t => t.name)
}

// Cache of columns for referenced tables (keyed by table name)
const refTableColumns = ref<Map<string, string[]>>(new Map())

const loadRefTableColumns = async (tableName: string): Promise<void> => {
  if (!tableName || refTableColumns.value.has(tableName)) return
  try {
    const cols = await window.api.schema.columns(props.connectionId, tableName)
    refTableColumns.value.set(tableName, cols.map(c => c.name))
    refTableColumns.value = new Map(refTableColumns.value)
  } catch {
    // Ignore errors for invalid table names
  }
}

const getRefColumnNames = (tableName: string): string[] => {
  return refTableColumns.value.get(tableName) || []
}

const onRefSchemaSelected = (fkIndex: number, schema: string): void => {
  pendingNewFkSchemas.value[fkIndex] = schema
  pendingNewForeignKeys.value[fkIndex].referencedTable = ''
  pendingNewForeignKeys.value[fkIndex].referencedColumns = ['']
}

const onRefTableSelected = (fkIndex: number, tableName: string): void => {
  pendingNewForeignKeys.value[fkIndex].referencedTable = tableName
  pendingNewForeignKeys.value[fkIndex].referencedColumns = ['']
  if (tableName) {
    loadRefTableColumns(tableName)
  }
}

// Trigger inline operations
const toggleDropTrigger = (triggerName: string) => {
  if (pendingDropTriggerNames.value.has(triggerName)) {
    pendingDropTriggerNames.value.delete(triggerName)
  } else {
    pendingDropTriggerNames.value.add(triggerName)
  }
  pendingDropTriggerNames.value = new Set(pendingDropTriggerNames.value)
}

// Validate pending changes before applying
const validateChanges = (): string | null => {
  // Validate columns
  const activeNames = new Set<string>()
  for (let i = 0; i < columns.value.length; i++) {
    if (pendingDropIndices.value.has(i)) continue
    const col = columns.value[i]
    if (!col.name.trim()) {
      return 'Column name cannot be empty'
    }
    if (activeNames.has(col.name.trim().toLowerCase())) {
      return `Duplicate column name: '${col.name}'`
    }
    activeNames.add(col.name.trim().toLowerCase())
  }

  // Validate new indexes
  for (const idx of pendingNewIndexes.value) {
    if (!idx.name.trim()) {
      return 'Index name cannot be empty'
    }
    if (idx.columns.length === 0 || idx.columns.every(c => !c.trim())) {
      return `Index '${idx.name}' must have at least one column`
    }
  }

  // Validate new foreign keys
  for (const fk of pendingNewForeignKeys.value) {
    if (!fk.name.trim()) {
      return 'Foreign key name cannot be empty'
    }
    if (!fk.columns[0]?.trim()) {
      return `Foreign key '${fk.name}' must have a column`
    }
    if (!fk.referencedTable.trim()) {
      return `Foreign key '${fk.name}' must have a referenced table`
    }
    if (!fk.referencedColumns[0]?.trim()) {
      return `Foreign key '${fk.name}' must have a referenced column`
    }
  }

  return null
}

// Apply all pending changes
const applyChanges = async () => {
  if (isApplying.value) return

  const validationError = validateChanges()
  if (validationError) {
    showNotification(validationError, true)
    return
  }

  isApplying.value = true

  try {
    // 1. Drop triggers (no dependencies)
    for (const triggerName of pendingDropTriggerNames.value) {
      const result = await window.api.schema.dropTrigger(props.connectionId, {
        triggerName,
        table: props.tableName,
      })
      if (!result.success) {
        showNotification(result.error || `Failed to drop trigger '${triggerName}'`, true)
        await loadStructure()
        return
      }
    }

    // 2. Drop foreign keys (before indexes they may depend on)
    for (const fkName of pendingDropFKNames.value) {
      const result = await window.api.schema.dropForeignKey(props.connectionId, {
        table: props.tableName,
        constraintName: fkName,
      })
      if (!result.success) {
        showNotification(result.error || `Failed to drop foreign key '${fkName}'`, true)
        await loadStructure()
        return
      }
    }

    // 3. Drop indexes (before columns they reference)
    for (const idxName of pendingDropIndexNames.value) {
      const result = await window.api.schema.dropIndex(props.connectionId, {
        table: props.tableName,
        indexName: idxName,
      })
      if (!result.success) {
        showNotification(result.error || `Failed to drop index '${idxName}'`, true)
        await loadStructure()
        return
      }
    }

    // 4. Drop columns (safe now that indexes/FKs are gone)
    const dropIndices = Array.from(pendingDropIndices.value).sort((a, b) => b - a)
    for (const idx of dropIndices) {
      const originalCol = originalColumns.value[idx]
      const result = await window.api.schema.dropColumn(props.connectionId, {
        table: props.tableName,
        columnName: originalCol.name,
      })
      if (!result.success) {
        showNotification(result.error || `Failed to drop column '${originalCol.name}'`, true)
        await loadStructure()
        return
      }
    }

    // 5. Modify columns
    for (let i = 0; i < originalColumnCount.value; i++) {
      if (pendingDropIndices.value.has(i)) continue
      if (getColumnStatus(i) !== ColumnChangeStatus.Modified) continue

      const col = columns.value[i]
      const original = originalColumns.value[i]
      const newDefinition: ColumnDefinition = {
        name: col.name,
        type: col.type,
        length: col.length,
        precision: col.precision,
        scale: col.scale,
        nullable: col.nullable,
        defaultValue: col.defaultValue as string | number | null | undefined,
        primaryKey: col.primaryKey,
        autoIncrement: col.autoIncrement,
        unique: col.unique,
        comment: col.comment,
      }

      const result = await window.api.schema.modifyColumn(props.connectionId, {
        table: props.tableName,
        oldName: original.name,
        newDefinition,
      })
      if (!result.success) {
        showNotification(result.error || `Failed to modify column '${original.name}'`, true)
        await loadStructure()
        return
      }
    }

    // 6. Add columns
    for (let i = originalColumnCount.value; i < columns.value.length; i++) {
      const col = columns.value[i]
      const result = await window.api.schema.addColumn(props.connectionId, {
        table: props.tableName,
        column: {
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          defaultValue: col.defaultValue as string | number | null | undefined,
          primaryKey: col.primaryKey,
          autoIncrement: col.autoIncrement,
          unique: col.unique,
          length: col.length,
          precision: col.precision,
          scale: col.scale,
          comment: col.comment,
        },
      })
      if (!result.success) {
        showNotification(result.error || `Failed to add column '${col.name}'`, true)
        await loadStructure()
        return
      }
    }

    // 7. Create new indexes (columns exist now)
    for (const idx of pendingNewIndexes.value) {
      if (idx.columns.length === 0) continue
      const result = await window.api.schema.createIndex(props.connectionId, {
        table: props.tableName,
        index: { name: idx.name, columns: [...idx.columns], unique: idx.unique, type: idx.type },
      })
      if (!result.success) {
        showNotification(result.error || `Failed to create index '${idx.name}'`, true)
        await loadStructure()
        return
      }
    }

    // 8. Create new foreign keys (columns and indexes exist now)
    for (const fk of pendingNewForeignKeys.value) {
      if (!fk.referencedTable || fk.columns.every(c => !c)) continue
      const fkIndex = pendingNewForeignKeys.value.indexOf(fk)
      const refSchema = pendingNewFkSchemas.value[fkIndex] || undefined
      const result = await window.api.schema.addForeignKey(props.connectionId, {
        table: props.tableName,
        foreignKey: {
          name: fk.name,
          columns: [...fk.columns],
          referencedTable: fk.referencedTable,
          referencedSchema: refSchema,
          referencedColumns: [...fk.referencedColumns],
          onUpdate: fk.onUpdate || 'NO ACTION',
          onDelete: fk.onDelete || 'NO ACTION',
        },
      })
      if (!result.success) {
        showNotification(result.error || `Failed to create foreign key '${fk.name}'`, true)
        await loadStructure()
        return
      }
    }

    showNotification('Structure changes applied successfully')
    await loadStructure()
    emit('refresh')
  } catch (e) {
    showNotification(e instanceof Error ? e.message : 'Failed to apply changes', true)
    await loadStructure()
  } finally {
    isApplying.value = false
  }
}

// Discard all pending changes
const discardChanges = () => {
  columns.value = JSON.parse(JSON.stringify(originalColumns.value))
  pendingDropIndices.value.clear()
  pendingDropIndices.value = new Set(pendingDropIndices.value)
  pendingNewIndexes.value = []
  pendingDropIndexNames.value = new Set()
  pendingNewForeignKeys.value = []
  pendingNewFkSchemas.value = []
  pendingDropFKNames.value = new Set()
  pendingDropTriggerNames.value = new Set()
}

defineExpose({
  reload: loadStructure
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Tabs and Actions -->
    <div class="flex items-center justify-between px-2 py-1.5 border-b border-border bg-background">
      <div class="inline-flex items-center rounded-md border bg-muted p-0.5">
        <button
          tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeTab === StructureTab.Columns ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = StructureTab.Columns"
        >
          Columns ({{ columns.length }})
        </button>
        <button
          tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeTab === StructureTab.Indexes ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = StructureTab.Indexes"
        >
          Indexes ({{ indexes.length + pendingNewIndexes.length }})
        </button>
        <button
          tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeTab === StructureTab.ForeignKeys ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = StructureTab.ForeignKeys"
        >
          Relations ({{ foreignKeys.length + pendingNewForeignKeys.length }})
        </button>
        <button
          tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeTab === StructureTab.Triggers ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = StructureTab.Triggers"
        >
          Triggers ({{ triggers.length }})
        </button>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="sm" class="h-6 w-6 p-0" :disabled="isLoading" @click="loadStructure">
                <IconRefresh class="h-3.5 w-3.5" :class="isLoading ? 'animate-spin' : ''" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button v-if="activeTab === StructureTab.Columns" variant="default" size="icon" class="h-6 w-6" @click="addColumn">
          <IconPlus class="h-3.5 w-3.5" />
        </Button>
        <Button v-else-if="activeTab === StructureTab.Indexes" variant="default" size="icon" class="h-6 w-6" @click="addIndex">
          <IconPlus class="h-3.5 w-3.5" />
        </Button>
        <Button v-else-if="activeTab === StructureTab.ForeignKeys" variant="default" size="icon" class="h-6 w-6" @click="addForeignKey">
          <IconPlus class="h-3.5 w-3.5" />
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

    <!-- Columns Tab (inline editing) -->
    <ColumnInlineEditor
      v-else-if="activeTab === StructureTab.Columns"
      :columns="columns"
      :data-types="dataTypes"
      :column-statuses="columnStatuses"
      @remove="toggleDropColumn"
    />

    <!-- Indexes Tab -->
    <ScrollArea v-else-if="activeTab === StructureTab.Indexes" class="flex-1">
      <table class="w-full border-collapse text-xs" :class="{ 'select-none': idxResizing }" style="table-layout: fixed;">
        <colgroup>
          <col :style="{ width: `${idxWidths.name}px` }" />
          <col :style="{ width: `${idxWidths.columns}px` }" />
          <col :style="{ width: `${idxWidths.type}px` }" />
          <col :style="{ width: `${idxWidths.unique}px` }" />
          <col :style="{ width: `${idxWidths.actions}px` }" />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Name
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="idxResizing === 'name' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="idxResizeStart('name', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Columns
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="idxResizing === 'columns' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="idxResizeStart('columns', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Type
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="idxResizing === 'type' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="idxResizeStart('type', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-center font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Unique
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="idxResizing === 'unique' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="idxResizeStart('unique', $event)" />
            </th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap">
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Existing indexes -->
          <tr
            v-for="idx in indexes"
            :key="idx.name"
            class="group h-8"
            :class="pendingDropIndexNames.has(idx.name) ? 'bg-red-500/10 line-through opacity-60' : 'hover:bg-muted/30'"
          >
            <td class="px-2 py-1 border-b border-r border-border font-medium overflow-hidden text-ellipsis whitespace-nowrap" :title="idx.name">
              {{ idx.name }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono overflow-hidden text-ellipsis whitespace-nowrap" :title="Array.isArray(idx.columns) ? idx.columns.join(', ') : String(idx.columns || '')">
              {{ Array.isArray(idx.columns) ? idx.columns.join(', ') : String(idx.columns || '') }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ idx.type || 'BTREE' }}
            </td>
            <td class="px-1 py-0.5 border-b border-r border-border text-center">
              <input
                type="checkbox"
                :checked="idx.unique || idx.primary"
                disabled
                class="rounded border-input cursor-default disabled:opacity-50"
              />
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                v-if="pendingDropIndexNames.has(idx.name)"
                class="p-1 rounded-md hover:bg-green-500/10"
                title="Restore index"
                @click="toggleDropIndex(idx.name)"
              >
                <IconArrowBackUp class="h-3.5 w-3.5 text-green-500" />
              </button>
              <button
                v-else
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Drop index"
                @click="toggleDropIndex(idx.name)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>

          <!-- New indexes (pending creation) -->
          <tr
            v-for="(newIdx, i) in pendingNewIndexes"
            :key="'new-idx-' + i"
            class="group h-8 bg-green-500/10"
          >
            <td class="p-0 border-b border-r border-border">
              <input
                v-model="newIdx.name"
                placeholder="index_name"
                class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <input
                :value="newIdx.columns.join(', ')"
                placeholder="col1, col2"
                class="w-full h-8 px-1.5 text-xs font-mono bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
                @blur="updateNewIndexColumns(i, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground">
              BTREE
            </td>
            <td class="px-1 py-0.5 border-b border-r border-border text-center">
              <input
                type="checkbox"
                v-model="newIdx.unique"
                class="rounded border-input cursor-pointer"
              />
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Remove"
                @click="removeNewIndex(i)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="indexes.length === 0 && pendingNewIndexes.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No indexes found
      </div>
    </ScrollArea>

    <!-- Foreign Keys Tab -->
    <ScrollArea v-else-if="activeTab === StructureTab.ForeignKeys" class="flex-1">
      <table class="w-full border-collapse text-xs" :class="{ 'select-none': fkResizing }" style="table-layout: fixed;">
        <colgroup>
          <col :style="{ width: `${fkWidths.name}px` }" />
          <col :style="{ width: `${fkWidths.column}px` }" />
          <col v-if="isPostgres" :style="{ width: `${fkWidths.refSchema}px` }" />
          <col :style="{ width: `${fkWidths.refTable}px` }" />
          <col :style="{ width: `${fkWidths.refColumn}px` }" />
          <col :style="{ width: `${fkWidths.onUpdate}px` }" />
          <col :style="{ width: `${fkWidths.onDelete}px` }" />
          <col :style="{ width: `${fkWidths.actions}px` }" />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Name
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'name' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('name', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Column
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'column' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('column', $event)" />
            </th>
            <th v-if="isPostgres" class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Ref. Schema
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'refSchema' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('refSchema', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Ref. Table
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'refTable' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('refTable', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Ref. Column
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'refColumn' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('refColumn', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              On Update
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'onUpdate' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('onUpdate', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              On Delete
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="fkResizing === 'onDelete' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="fkResizeStart('onDelete', $event)" />
            </th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap">
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Existing foreign keys -->
          <tr
            v-for="fk in foreignKeys"
            :key="fk.name"
            class="group h-8"
            :class="pendingDropFKNames.has(fk.name) ? 'bg-red-500/10 line-through opacity-60' : 'hover:bg-muted/30'"
          >
            <td class="px-2 py-1 border-b border-r border-border font-medium overflow-hidden text-ellipsis whitespace-nowrap" :title="fk.name">
              {{ fk.name }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.column }}
            </td>
            <td v-if="isPostgres" class="px-2 py-1 border-b border-r border-border font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.referencedSchema || '' }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.referencedTable }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.referencedColumn }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.onUpdate || 'NO ACTION' }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ fk.onDelete || 'NO ACTION' }}
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                v-if="pendingDropFKNames.has(fk.name)"
                class="p-1 rounded-md hover:bg-green-500/10"
                title="Restore foreign key"
                @click="toggleDropForeignKey(fk.name)"
              >
                <IconArrowBackUp class="h-3.5 w-3.5 text-green-500" />
              </button>
              <button
                v-else
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Drop foreign key"
                @click="toggleDropForeignKey(fk.name)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>

          <!-- New foreign keys (pending creation) -->
          <tr
            v-for="(newFk, i) in pendingNewForeignKeys"
            :key="'new-fk-' + i"
            class="group h-8 bg-green-500/10"
          >
            <td class="p-0 border-b border-r border-border">
              <input
                v-model="newFk.name"
                placeholder="fk_name"
                class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="newFk.columns[0] || ''"
                :items="columnNames"
                placeholder="column"
                @update:model-value="newFk.columns = [$event]"
              />
            </td>
            <td v-if="isPostgres" class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="pendingNewFkSchemas[i] || ''"
                :items="schemaNames"
                placeholder="schema"
                @update:model-value="onRefSchemaSelected(i, $event)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="newFk.referencedTable"
                :items="getTableNamesForSchema(pendingNewFkSchemas[i] || '')"
                placeholder="table"
                @update:model-value="onRefTableSelected(i, $event)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="newFk.referencedColumns[0] || ''"
                :items="getRefColumnNames(newFk.referencedTable)"
                placeholder="column"
                @update:model-value="newFk.referencedColumns = [$event]"
                @focus="loadRefTableColumns(newFk.referencedTable)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <select
                :value="newFk.onUpdate || 'NO ACTION'"
                class="w-full h-8 px-1 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none cursor-pointer"
                @change="newFk.onUpdate = ($event.target as HTMLSelectElement).value as ReferenceAction"
              >
                <option v-for="action in REFERENCE_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </td>
            <td class="p-0 border-b border-r border-border">
              <select
                :value="newFk.onDelete || 'NO ACTION'"
                class="w-full h-8 px-1 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none cursor-pointer"
                @change="newFk.onDelete = ($event.target as HTMLSelectElement).value as ReferenceAction"
              >
                <option v-for="action in REFERENCE_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Remove"
                @click="removeNewForeignKey(i)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="foreignKeys.length === 0 && pendingNewForeignKeys.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No foreign keys found
      </div>
    </ScrollArea>

    <!-- Triggers Tab -->
    <ScrollArea v-else-if="activeTab === StructureTab.Triggers" class="flex-1">
      <table class="w-full border-collapse text-xs" :class="{ 'select-none': trigResizing }" style="table-layout: fixed;">
        <colgroup>
          <col :style="{ width: `${trigWidths.name}px` }" />
          <col :style="{ width: `${trigWidths.timing}px` }" />
          <col :style="{ width: `${trigWidths.event}px` }" />
          <col />
          <col :style="{ width: `${trigWidths.actions}px` }" />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Name
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="trigResizing === 'name' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="trigResizeStart('name', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Timing
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="trigResizing === 'timing' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="trigResizeStart('timing', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Event
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="trigResizing === 'event' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="trigResizeStart('event', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Definition
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="trigResizing === 'definition' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="trigResizeStart('definition', $event)" />
            </th>
            <th class="px-2 py-1.5 text-right font-medium border-b border-border whitespace-nowrap">
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="trigger in triggers"
            :key="trigger.name"
            class="group h-8"
            :class="pendingDropTriggerNames.has(trigger.name) ? 'bg-red-500/10 line-through opacity-60' : 'hover:bg-muted/30'"
          >
            <td class="px-2 py-1 border-b border-r border-border font-medium overflow-hidden text-ellipsis whitespace-nowrap" :title="trigger.name">
              {{ trigger.name }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ trigger.timing }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
              {{ trigger.event }}
            </td>
            <td class="px-2 py-1 border-b border-r border-border font-mono text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap" :title="trigger.definition || ''">
              {{ trigger.definition || '' }}
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                v-if="pendingDropTriggerNames.has(trigger.name)"
                class="p-1 rounded-md hover:bg-green-500/10"
                title="Restore trigger"
                @click="toggleDropTrigger(trigger.name)"
              >
                <IconArrowBackUp class="h-3.5 w-3.5 text-green-500" />
              </button>
              <button
                v-else
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Drop trigger"
                @click="toggleDropTrigger(trigger.name)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="triggers.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No triggers found
      </div>
    </ScrollArea>
  </div>
</template>
