<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { TabType, StructureTab } from '@/types/table'
import type { Column, Index, ForeignKey, DatabaseSchema } from '@/types/table'
import type { ColumnDefinition, IndexDefinition, ForeignKeyDefinition, TableDefinition, ReferenceAction } from '@/types/schema-operations'
import type { DataTypeInfo } from '@/types/schema-operations'
import { IconTrash, IconPlus } from '@tabler/icons-vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import ColumnInlineEditor from '@/components/schema/ColumnInlineEditor.vue'
import { InlineAutocomplete } from '@/components/ui/inline-autocomplete'
import { useColumnResize } from '@/composables/useColumnResize'

const REFERENCE_ACTIONS: ReferenceAction[] = ['NO ACTION', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT']

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const tab = computed(() => tabsStore.tabs.find(t => t.id === props.tabId))
const tabData = computed(() => {
  if (tab.value?.data.type === TabType.CreateTable) return tab.value.data
  return null
})

const connectionId = computed(() => tabData.value?.connectionId ?? '')
const database = computed(() => tabData.value?.database ?? '')

const isPostgreSQL = computed(() => {
  const connection = connectionsStore.connections.find(c => c.id === connectionId.value)
  return connection?.type === DatabaseType.PostgreSQL
})

// Local state
const tableName = ref('')
const selectedSchema = ref('')
const schemas = ref<DatabaseSchema[]>([])
const columns = ref<Column[]>([])
const indexes = ref<Index[]>([])
const foreignKeys = ref<ForeignKeyDefinition[]>([])
const foreignKeySchemas = ref<string[]>([])
const isCreating = ref(false)
const dataTypes = ref<DataTypeInfo[]>([])

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

// Non-system schemas only (users can only create tables in their own schemas)
const availableSchemas = computed(() =>
  schemas.value.filter(s => !s.isSystem)
)

onMounted(async () => {
  if (connectionId.value) {
    try {
      dataTypes.value = await window.api.schema.getDataTypes(connectionId.value)
    } catch (e) {
      console.error('Failed to load data types:', e)
    }

    if (isPostgreSQL.value) {
      try {
        schemas.value = await window.api.schema.getSchemas(connectionId.value, true)
        const tabSchema = tabData.value?.schema
        if (tabSchema) {
          selectedSchema.value = tabSchema
        } else {
          const publicSchema = availableSchemas.value.find(s => s.name === 'public')
          selectedSchema.value = publicSchema?.name || availableSchemas.value[0]?.name || 'public'
        }
      } catch (e) {
        console.error('Failed to load schemas:', e)
      }
    }
  }
})

const defaultTypeName = computed(() => {
  if (dataTypes.value.length === 0) return 'TEXT'
  const intType = dataTypes.value.find(t => t.name.toLowerCase() === 'integer' || t.name.toLowerCase() === 'int')
  return intType ? intType.name : dataTypes.value[0].name
})

// Column operations
const addColumn = async () => {
  const col: Column = {
    name: '',
    type: defaultTypeName.value,
    nullable: true,
    defaultValue: null,
    primaryKey: false,
    autoIncrement: false,
    unique: false
  }
  columns.value.push(col)
}

const removeColumn = (idx: number) => {
  columns.value.splice(idx, 1)
}

// Index inline operations
const addIndex = () => {
  const baseName = tableName.value.trim() ? `idx_${tableName.value.trim()}` : 'idx_new'
  const existingNames = new Set(indexes.value.map(idx => idx.name))
  let name = baseName
  let i = 1
  while (existingNames.has(name)) {
    name = `${baseName}_${i++}`
  }
  indexes.value.push({
    name,
    columns: [],
    unique: false,
    primary: false,
  })
}

const removeIndex = (i: number) => {
  indexes.value.splice(i, 1)
}

const updateIndexColumns = (index: number, value: string) => {
  indexes.value[index].columns = value.split(',').map(s => s.trim()).filter(Boolean)
}

// Foreign key inline operations
const columnNames = computed(() =>
  columns.value.map(c => c.name).filter(Boolean)
)

const schemaNames = computed(() => {
  const s = connectionsStore.schemas.get(connectionId.value)
  if (!s) return []
  return s.filter(schema => !schema.isSystem).map(schema => schema.name)
})

const getTableNamesForSchema = (schema: string): string[] => {
  const tables = connectionsStore.tables.get(connectionId.value)
  if (!tables) return []
  if (schema) {
    return tables.filter(t => t.schema === schema).map(t => t.name)
  }
  return tables.map(t => t.name)
}

const refTableColumns = ref<Map<string, string[]>>(new Map())

const loadRefTableColumns = async (refTableName: string): Promise<void> => {
  if (!refTableName || refTableColumns.value.has(refTableName)) return
  try {
    const cols = await window.api.schema.columns(connectionId.value, refTableName)
    refTableColumns.value.set(refTableName, cols.map(c => c.name))
    refTableColumns.value = new Map(refTableColumns.value)
  } catch {
    // Ignore errors for invalid table names
  }
}

const getRefColumnNames = (refTableName: string): string[] => {
  return refTableColumns.value.get(refTableName) || []
}

const addForeignKey = () => {
  const baseName = tableName.value.trim() ? `fk_${tableName.value.trim()}` : 'fk_new'
  const existingNames = new Set(foreignKeys.value.map(fk => fk.name))
  let name = baseName
  let i = 1
  while (existingNames.has(name)) {
    name = `${baseName}_${i++}`
  }
  foreignKeys.value.push({
    name,
    columns: [''],
    referencedTable: '',
    referencedColumns: [''],
    onUpdate: 'NO ACTION',
    onDelete: 'NO ACTION',
  })
  foreignKeySchemas.value.push('')
}

const removeForeignKey = (i: number) => {
  foreignKeys.value.splice(i, 1)
  foreignKeySchemas.value.splice(i, 1)
}

const onRefSchemaSelected = (fkIndex: number, schema: string): void => {
  foreignKeySchemas.value[fkIndex] = schema
  foreignKeys.value[fkIndex].referencedTable = ''
  foreignKeys.value[fkIndex].referencedColumns = ['']
}

const onRefTableSelected = (fkIndex: number, refTableName: string): void => {
  foreignKeys.value[fkIndex].referencedTable = refTableName
  foreignKeys.value[fkIndex].referencedColumns = ['']
  if (refTableName) {
    loadRefTableColumns(refTableName)
  }
}

// Create table
const handleCreateTable = async () => {
  if (!tableName.value.trim()) {
    toast.error('Table name is required')
    return
  }

  const validColumns = columns.value.filter(c => c.name.trim())
  if (validColumns.length === 0) {
    toast.error('At least one column with a name is required')
    return
  }

  isCreating.value = true

  try {
    const columnDefs: ColumnDefinition[] = validColumns.map(col => ({
      name: col.name.trim(),
      type: col.type,
      length: col.length,
      precision: col.precision,
      scale: col.scale,
      nullable: col.nullable,
      defaultValue: col.defaultValue as string | number | null | undefined,
      primaryKey: col.primaryKey,
      autoIncrement: col.autoIncrement,
      unique: col.unique,
      comment: col.comment
    }))

    const indexDefs: IndexDefinition[] = indexes.value.map(idx => ({
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
      type: idx.type
    }))

    const fkDefs: ForeignKeyDefinition[] = foreignKeys.value.map(fk => ({
      name: fk.name,
      columns: [...fk.columns],
      referencedTable: fk.referencedTable,
      referencedColumns: [...fk.referencedColumns],
      onUpdate: fk.onUpdate || 'NO ACTION',
      onDelete: fk.onDelete || 'NO ACTION',
    }))

    const tableDef: TableDefinition = {
      name: tableName.value.trim(),
      columns: columnDefs,
      primaryKey: columnDefs.filter(c => c.primaryKey).map(c => c.name),
      indexes: indexDefs.length > 0 ? indexDefs : undefined,
      foreignKeys: fkDefs.length > 0 ? fkDefs : undefined
    }

    const schema = isPostgreSQL.value ? selectedSchema.value : undefined

    const result = await window.api.schema.createTable(connectionId.value, {
      table: JSON.parse(JSON.stringify(tableDef)),
      schema
    })

    if (result.success) {
      toast.success(`Table "${tableName.value}" created`)

      // Reload sidebar: refresh schemas + tables and clear tree caches
      const db = connectionsStore.getActiveDatabase(connectionId.value)
      if (isPostgreSQL.value) {
        await connectionsStore.loadSchemas(connectionId.value)
      }
      await connectionsStore.loadTables(connectionId.value, db, schema)
      window.dispatchEvent(new Event('zequel:refresh-schema'))

      // Open the newly created table, then close the create tab
      tabsStore.createTableTab(connectionId.value, tableName.value.trim(), db, schema)
      tabsStore.closeTab(props.tabId)
    } else {
      toast.error(result.error || 'Failed to create table')
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to create table')
  } finally {
    isCreating.value = false
  }
}

const handleCancel = () => {
  tabsStore.closeTab(props.tabId)
}
</script>

<template>
  <div v-if="tabData" class="flex flex-col h-full">
    <!-- Schema + Table Name -->
    <div class="flex items-center gap-3 px-3 py-2 border-b border-border bg-background">
      <template v-if="isPostgreSQL">
        <label class="text-xs font-medium text-muted-foreground whitespace-nowrap">Schema</label>
        <NativeSelect v-model="selectedSchema" class="h-8 text-sm w-auto py-1" wrapper-class="shrink-0">
          <NativeSelectOption v-for="s in availableSchemas" :key="s.name" :value="s.name">
            {{ s.name }}
          </NativeSelectOption>
        </NativeSelect>
      </template>
      <label class="text-xs font-medium text-muted-foreground whitespace-nowrap">Table Name</label>
      <Input
        v-model="tableName"
        placeholder="Enter table name..."
        class="h-8 text-sm max-w-xs"
      />
    </div>

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
          Indexes ({{ indexes.length }})
        </button>
        <button
          tabindex="-1"
          class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          :class="activeTab === StructureTab.ForeignKeys ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = StructureTab.ForeignKeys"
        >
          Relations ({{ foreignKeys.length }})
        </button>
      </div>

      <!-- Add button -->
      <Button
        v-if="activeTab === StructureTab.Columns" variant="default" size="icon"
        @click="addColumn"
      >
        <IconPlus class="h-3.5 w-3.5" />
      </Button>
      <Button
        v-else-if="activeTab === StructureTab.Indexes" variant="default" size="icon"
        @click="addIndex"
      >
        <IconPlus class="h-3.5 w-3.5" />
      </Button>
      <Button
        v-else-if="activeTab === StructureTab.ForeignKeys" variant="default" size="icon"
        @click="addForeignKey"
      >
        <IconPlus class="h-3.5 w-3.5" />
      </Button>
    </div>

    <!-- Columns Tab (inline editing) -->
    <ColumnInlineEditor
      v-if="activeTab === StructureTab.Columns"
      :columns="columns"
      :data-types="dataTypes"
      @remove="removeColumn"
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
          <tr
            v-for="(idx, i) in indexes"
            :key="'idx-' + i"
            class="group h-8 bg-green-500/10"
          >
            <td class="p-0 border-b border-r border-border">
              <input
                v-model="idx.name"
                placeholder="index_name"
                class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <input
                :value="idx.columns.join(', ')"
                placeholder="col1, col2"
                class="w-full h-8 px-1.5 text-xs font-mono bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
                @blur="updateIndexColumns(i, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-2 py-1 border-b border-r border-border text-muted-foreground">
              BTREE
            </td>
            <td class="px-1 py-0.5 border-b border-r border-border text-center">
              <input
                type="checkbox"
                v-model="idx.unique"
                class="rounded border-input cursor-pointer"
              />
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Remove"
                @click="removeIndex(i)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="indexes.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No indexes added yet
      </div>
    </ScrollArea>

    <!-- Relations Tab -->
    <ScrollArea v-else-if="activeTab === StructureTab.ForeignKeys" class="flex-1">
      <table class="w-full border-collapse text-xs" :class="{ 'select-none': fkResizing }" style="table-layout: fixed;">
        <colgroup>
          <col :style="{ width: `${fkWidths.name}px` }" />
          <col :style="{ width: `${fkWidths.column}px` }" />
          <col v-if="isPostgreSQL" :style="{ width: `${fkWidths.refSchema}px` }" />
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
            <th v-if="isPostgreSQL" class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
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
          <tr
            v-for="(fk, i) in foreignKeys"
            :key="'fk-' + i"
            class="group h-8 bg-green-500/10"
          >
            <td class="p-0 border-b border-r border-border">
              <input
                v-model="fk.name"
                placeholder="fk_name"
                class="w-full h-8 px-1.5 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="fk.columns[0] || ''"
                :items="columnNames"
                placeholder="column"
                @update:model-value="fk.columns = [$event]"
              />
            </td>
            <td v-if="isPostgreSQL" class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="foreignKeySchemas[i] || ''"
                :items="schemaNames"
                placeholder="schema"
                @update:model-value="onRefSchemaSelected(i, $event)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="fk.referencedTable"
                :items="getTableNamesForSchema(foreignKeySchemas[i] || '')"
                placeholder="table"
                @update:model-value="onRefTableSelected(i, $event)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <InlineAutocomplete
                :model-value="fk.referencedColumns[0] || ''"
                :items="getRefColumnNames(fk.referencedTable)"
                placeholder="column"
                @update:model-value="fk.referencedColumns = [$event]"
                @focus="loadRefTableColumns(fk.referencedTable)"
              />
            </td>
            <td class="p-0 border-b border-r border-border">
              <select
                :value="fk.onUpdate || 'NO ACTION'"
                class="w-full h-8 px-1 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none cursor-pointer"
                @change="fk.onUpdate = ($event.target as HTMLSelectElement).value as ReferenceAction"
              >
                <option v-for="action in REFERENCE_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </td>
            <td class="p-0 border-b border-r border-border">
              <select
                :value="fk.onDelete || 'NO ACTION'"
                class="w-full h-8 px-1 text-xs bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none cursor-pointer"
                @change="fk.onDelete = ($event.target as HTMLSelectElement).value as ReferenceAction"
              >
                <option v-for="action in REFERENCE_ACTIONS" :key="action" :value="action">{{ action }}</option>
              </select>
            </td>
            <td class="px-1 py-0.5 border-b border-border text-center">
              <button
                class="p-1 rounded-md hover:bg-red-500/10"
                title="Remove"
                @click="removeForeignKey(i)"
              >
                <IconTrash class="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="foreignKeys.length === 0" class="flex items-center justify-center py-12 text-muted-foreground text-xs">
        No relations added yet
      </div>
    </ScrollArea>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-1 px-3 py-2 border-t border-border bg-background">
      <Button variant="ghost" @click="handleCancel">
        Cancel
      </Button>
      <Button :disabled="isCreating" @click="handleCreateTable">
        {{ isCreating ? 'Creating...' : 'Create Table' }}
      </Button>
    </div>
  </div>
</template>
