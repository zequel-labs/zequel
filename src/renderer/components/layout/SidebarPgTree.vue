<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { Table, Column, Routine, Trigger } from '@/types/table'
import { RoutineType } from '@/types/table'
import {
  IconTable,
  IconEye,
  IconLoader2,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconChevronRight,
  IconFolderFilled,
  IconFunction,
  IconTerminal2,
  IconBolt
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

interface Props {
  searchFilter: string
  selectedNodeId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:selectedNodeId', id: string): void
  (e: 'rename-table', table: { name: string; type: string }): void
  (e: 'drop-table', table: { name: string; type: string }): void
  (e: 'edit-view', view: { name: string; type: string }): void
  (e: 'drop-view', view: { name: string; type: string }): void
}>()

const connectionsStore = useConnectionsStore()
const { openTableTab, openViewTab, openQueryTab, openRoutineTab, openTriggerTab } = useTabs()

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const currentDatabase = computed(() => {
  if (!activeConnectionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeConnectionId.value) || undefined
})

// PostgreSQL schema tree state
const expandedSchemas = ref<Set<string>>(new Set())
const schemaTables = ref<Map<string, Table[]>>(new Map())
const loadingSchemaTables = ref<Set<string>>(new Set())

// Routines and triggers (loaded once, grouped by schema)
const allRoutines = ref<Routine[]>([])
const allTriggers = ref<Trigger[]>([])
const loadingRoutines = ref(false)
const loadingTriggers = ref(false)

// Table column expansion state
const expandedTables = ref<Set<string>>(new Set())
const tableColumns = ref<Map<string, Column[]>>(new Map())
const loadingTableColumns = ref<Set<string>>(new Set())

interface SchemaItem {
  type: 'table' | 'view' | 'function' | 'procedure' | 'trigger'
  name: string
  entity: Table | Routine | Trigger
}

const pgSchemas = computed(() => {
  if (!activeConnectionId.value) return []
  return connectionsStore.schemas.get(activeConnectionId.value) || []
})

const filteredPgSchemas = computed(() => {
  if (!props.searchFilter) return pgSchemas.value
  const q = props.searchFilter.toLowerCase()
  return pgSchemas.value.filter(s => {
    if (s.name.toLowerCase().includes(q)) return true
    const items = getSchemaItems(s.name)
    return items.some(item => item.name.toLowerCase().includes(q))
  })
})

const getSchemaItems = (schemaName: string): SchemaItem[] => {
  const items: SchemaItem[] = []

  const tbls = schemaTables.value.get(schemaName) || []
  for (const t of tbls) {
    items.push({ type: t.type === 'view' ? 'view' : 'table', name: t.name, entity: t })
  }

  for (const r of allRoutines.value) {
    if (r.schema === schemaName) {
      items.push({
        type: r.type === RoutineType.Procedure ? 'procedure' : 'function',
        name: r.name,
        entity: r
      })
    }
  }

  for (const t of allTriggers.value) {
    if (t.schema === schemaName) {
      items.push({ type: 'trigger', name: t.name, entity: t })
    }
  }

  return items
}

const getSchemaItemsFiltered = (schemaName: string): SchemaItem[] => {
  const items = getSchemaItems(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(item => item.name.toLowerCase().includes(q))
}

const toggleSchemaExpand = async (schemaName: string) => {
  if (expandedSchemas.value.has(schemaName)) {
    expandedSchemas.value.delete(schemaName)
    expandedSchemas.value = new Set(expandedSchemas.value)
    return
  }

  expandedSchemas.value.add(schemaName)
  expandedSchemas.value = new Set(expandedSchemas.value)

  if (!schemaTables.value.has(schemaName) && activeConnectionId.value) {
    loadingSchemaTables.value.add(schemaName)
    loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    try {
      const db = connectionsStore.getActiveDatabase(activeConnectionId.value)
      const tbls = await window.api.schema.tables(activeConnectionId.value, db, schemaName)
      schemaTables.value.set(schemaName, tbls)
      schemaTables.value = new Map(schemaTables.value)
    } catch {
      schemaTables.value.set(schemaName, [])
      schemaTables.value = new Map(schemaTables.value)
    } finally {
      loadingSchemaTables.value.delete(schemaName)
      loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    }
  }
}

const getTableKey = (tableName: string, schema?: string): string => {
  return schema ? `${schema}.${tableName}` : tableName
}

const toggleTableExpand = async (tableName: string, schema?: string) => {
  const key = getTableKey(tableName, schema)
  if (expandedTables.value.has(key)) {
    expandedTables.value.delete(key)
    expandedTables.value = new Set(expandedTables.value)
    return
  }

  expandedTables.value.add(key)
  expandedTables.value = new Set(expandedTables.value)

  if (!tableColumns.value.has(key) && activeConnectionId.value) {
    loadingTableColumns.value.add(key)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      if (schema) {
        await window.api.schema.setCurrentSchema(activeConnectionId.value, schema)
      }
      const cols = await window.api.schema.columns(activeConnectionId.value, tableName)
      tableColumns.value.set(key, cols)
      tableColumns.value = new Map(tableColumns.value)
    } catch {
      tableColumns.value.set(key, [])
      tableColumns.value = new Map(tableColumns.value)
    } finally {
      loadingTableColumns.value.delete(key)
      loadingTableColumns.value = new Set(loadingTableColumns.value)
    }
  }
}

const handlePgTableClick = (table: Table, schemaName: string) => {
  if (!activeConnectionId.value) return
  connectionsStore.setActiveSchema(activeConnectionId.value, schemaName)
  if (table.type === 'view') {
    openViewTab(table.name, currentDatabase.value, schemaName)
  } else {
    openTableTab(table.name, currentDatabase.value, schemaName)
  }
}

const handleRoutineClick = (routine: Routine) => {
  if (!activeConnectionId.value) return
  openRoutineTab(routine.name, routine.type, currentDatabase.value)
}

const handleTriggerClick = (trigger: Trigger) => {
  if (!activeConnectionId.value) return
  openTriggerTab(trigger.name, trigger.table, currentDatabase.value)
}

const loadRoutines = async () => {
  if (!activeConnectionId.value || loadingRoutines.value) return
  loadingRoutines.value = true
  try {
    allRoutines.value = await window.api.schema.getRoutines(activeConnectionId.value)
  } catch {
    allRoutines.value = []
  } finally {
    loadingRoutines.value = false
  }
}

const loadTriggers = async () => {
  if (!activeConnectionId.value || loadingTriggers.value) return
  loadingTriggers.value = true
  try {
    allTriggers.value = await window.api.schema.getTriggers(activeConnectionId.value)
  } catch {
    allTriggers.value = []
  } finally {
    loadingTriggers.value = false
  }
}

// Clear caches on refresh, but keep expanded schemas open
const handleRefreshSchema = async () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  schemaTables.value = new Map()
  allRoutines.value = []
  allTriggers.value = []
  loadRoutines()
  loadTriggers()

  // Reload tables for schemas that were expanded
  if (activeConnectionId.value && expandedSchemas.value.size > 0) {
    const db = connectionsStore.getActiveDatabase(activeConnectionId.value)
    for (const schemaName of expandedSchemas.value) {
      try {
        const tbls = await window.api.schema.tables(activeConnectionId.value, db, schemaName)
        schemaTables.value.set(schemaName, tbls)
        schemaTables.value = new Map(schemaTables.value)
      } catch {
        schemaTables.value.set(schemaName, [])
        schemaTables.value = new Map(schemaTables.value)
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  loadRoutines()
  loadTriggers()
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const loadSchemaColumns = async (schemaName: string, tables: { name: string }[]) => {
  if (!activeConnectionId.value) return

  // Set schema once, then load all columns for that schema sequentially
  // This avoids race conditions with setCurrentSchema
  await window.api.schema.setCurrentSchema(activeConnectionId.value, schemaName)

  for (const t of tables) {
    const key = getTableKey(t.name, schemaName)
    if (tableColumns.value.has(key) || loadingTableColumns.value.has(key)) continue

    loadingTableColumns.value.add(key)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      const cols = await window.api.schema.columns(activeConnectionId.value!, t.name)
      tableColumns.value.set(key, cols)
      tableColumns.value = new Map(tableColumns.value)
    } catch {
      tableColumns.value.set(key, [])
      tableColumns.value = new Map(tableColumns.value)
    } finally {
      loadingTableColumns.value.delete(key)
      loadingTableColumns.value = new Set(loadingTableColumns.value)
    }
  }
}

const expandAll = async () => {
  if (!activeConnectionId.value) return

  // 1. Open all schemas immediately
  for (const schema of pgSchemas.value) {
    expandedSchemas.value.add(schema.name)
  }
  expandedSchemas.value = new Set(expandedSchemas.value)

  // 2. Load tables for all schemas in parallel
  const db = connectionsStore.getActiveDatabase(activeConnectionId.value)
  const schemasToLoad = pgSchemas.value.filter(s => !schemaTables.value.has(s.name))
  await Promise.all(schemasToLoad.map(async (schema) => {
    loadingSchemaTables.value.add(schema.name)
    loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    try {
      const tbls = await window.api.schema.tables(activeConnectionId.value!, db, schema.name)
      schemaTables.value.set(schema.name, tbls)
      schemaTables.value = new Map(schemaTables.value)
    } catch {
      schemaTables.value.set(schema.name, [])
      schemaTables.value = new Map(schemaTables.value)
    } finally {
      loadingSchemaTables.value.delete(schema.name)
      loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    }
  }))

  // 3. Mark all tables as expanded immediately
  for (const schema of pgSchemas.value) {
    const tbls = schemaTables.value.get(schema.name) || []
    for (const t of tbls) {
      expandedTables.value.add(getTableKey(t.name, schema.name))
    }
  }
  expandedTables.value = new Set(expandedTables.value)

  // 4. Load columns one schema at a time (avoids setCurrentSchema race condition)
  // Each schema loads sequentially, but shows spinners immediately
  for (const schema of pgSchemas.value) {
    const tbls = schemaTables.value.get(schema.name) || []
    if (tbls.length > 0) {
      await loadSchemaColumns(schema.name, tbls)
    }
  }
}

const collapseAll = () => {
  expandedSchemas.value = new Set()
  expandedTables.value = new Set()
}

defineExpose({ expandAll, collapseAll })

const clearCaches = () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  expandedSchemas.value = new Set()
  schemaTables.value = new Map()
  allRoutines.value = []
  allTriggers.value = []
  loadRoutines()
  loadTriggers()
}

// Clear caches when connection changes
watch(() => connectionsStore.activeConnectionId, clearCaches)

// Clear caches when database changes (activeConnectionId doesn't change on DB switch)
watch(currentDatabase, clearCaches)
</script>

<template>
  <template v-for="schema in filteredPgSchemas" :key="schema.name">
    <div>
      <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
        @click="toggleSchemaExpand(schema.name)">
        <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
          :class="{ 'rotate-90': expandedSchemas.has(schema.name) }" />
        <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
        <span class="flex-1 truncate text-sm">{{ schema.name }}</span>
      </div>
      <div v-if="expandedSchemas.has(schema.name)" class="ml-3.5 pl-1">
        <div v-if="loadingSchemaTables.has(schema.name)" class="px-2 py-1">
          <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <template v-for="item in getSchemaItemsFiltered(schema.name)" :key="`${item.type}-${item.name}`">
            <!-- Table / View -->
            <template v-if="item.type === 'table' || item.type === 'view'">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div>
                    <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `table-${schema.name}-${item.name}` }">
                      <IconChevronRight class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                        :class="{ 'rotate-90': expandedTables.has(getTableKey(item.name, schema.name)) }"
                        @click.stop="toggleTableExpand(item.name, schema.name)" />
                      <component
                        :is="(schema.isSystem && item.type === 'view') ? IconTable : (item.type === 'view' ? IconEye : IconTable)"
                        :class="schema.isSystem
                          ? (item.type === 'view' ? 'h-4 w-4 text-blue-500 shrink-0' : 'h-4 w-4 text-amber-500 shrink-0')
                          : (item.type === 'view' ? 'h-4 w-4 text-purple-500 shrink-0' : 'h-4 w-4 text-blue-500 shrink-0')" />
                      <span class="flex-1 truncate text-sm"
                        @click="emit('update:selectedNodeId', `table-${schema.name}-${item.name}`); handlePgTableClick(item.entity as Table, schema.name)">{{
                          item.name }}</span>
                    </div>
                    <div v-if="expandedTables.has(getTableKey(item.name, schema.name))"
                      class="ml-3.5 border-l border-border pl-2">
                      <div v-if="loadingTableColumns.has(getTableKey(item.name, schema.name))" class="px-2 py-1">
                        <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
                      </div>
                      <template v-else-if="tableColumns.get(getTableKey(item.name, schema.name))">
                        <div v-for="col in tableColumns.get(getTableKey(item.name, schema.name))" :key="col.name"
                          class="flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/30 rounded-sm cursor-default">
                          <span class="flex-1 truncate">{{ col.name }}</span>
                          <span class="shrink-0 text-[10px] opacity-70 lowercase">{{ col.type }}{{
                            col.length ? `(${col.length})` : '' }}{{ col.precision ?
                              `(${col.precision}${col.scale ?
                                `,${col.scale}` : ''})` : '' }}</span>
                        </div>
                      </template>
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <template v-if="item.type === 'view'">
                    <ContextMenuItem @click="openViewTab(item.name, currentDatabase)">
                      <IconEye class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem
                      @click="openQueryTab(`SELECT * FROM &quot;${schema.name}&quot;.&quot;${item.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query View
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      @click="handlePgTableClick(item.entity as Table, schema.name); emit('edit-view', item.entity as Table)">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Edit View
                    </ContextMenuItem>
                    <ContextMenuItem @click="emit('drop-view', item.entity as Table)">
                      <IconTrash class="h-4 w-4 mr-2" />
                      Drop View
                    </ContextMenuItem>
                  </template>
                  <template v-else>
                    <ContextMenuItem @click="handlePgTableClick(item.entity as Table, schema.name)">
                      <IconTable class="h-4 w-4 mr-2" />
                      View Data
                    </ContextMenuItem>
                    <ContextMenuItem
                      @click="openQueryTab(`SELECT * FROM &quot;${schema.name}&quot;.&quot;${item.name}&quot; LIMIT 100;`)">
                      <IconSql class="h-4 w-4 mr-2" />
                      Query Table
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="emit('rename-table', item.entity as Table)">
                      <IconPencil class="h-4 w-4 mr-2" />
                      Rename Table
                    </ContextMenuItem>
                    <ContextMenuItem @click="emit('drop-table', item.entity as Table)">
                      <IconTrash class="h-4 w-4 mr-2" />
                      Drop Table
                    </ContextMenuItem>
                  </template>
                  <ContextMenuSeparator />
                  <ContextMenuItem @click="navigator.clipboard.writeText(item.name)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy Name
                  </ContextMenuItem>
                  <ContextMenuItem
                    @click="navigator.clipboard.writeText(`SELECT * FROM &quot;${schema.name}&quot;.&quot;${item.name}&quot;;`)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy SELECT Statement
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </template>

            <!-- Function -->
            <template v-else-if="item.type === 'function'">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `routine-${schema.name}-${item.name}` }"
                    @click="emit('update:selectedNodeId', `routine-${schema.name}-${item.name}`); handleRoutineClick(item.entity as Routine)">
                    <IconFunction class="h-4 w-4 text-amber-500" />
                    <span class="flex-1 truncate text-sm">{{ item.name }}</span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem @click="handleRoutineClick(item.entity as Routine)">
                    <IconSql class="h-4 w-4 mr-2" />
                    View Definition
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem @click="navigator.clipboard.writeText(item.name)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy Name
                  </ContextMenuItem>
                  <ContextMenuItem @click="openQueryTab(`SELECT ${item.name}();`)">
                    <IconFunction class="h-4 w-4 mr-2" />
                    Generate SELECT Statement
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </template>

            <!-- Procedure -->
            <template v-else-if="item.type === 'procedure'">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `routine-${schema.name}-${item.name}` }"
                    @click="emit('update:selectedNodeId', `routine-${schema.name}-${item.name}`); handleRoutineClick(item.entity as Routine)">
                    <IconTerminal2 class="h-4 w-4 text-green-500" />
                    <span class="flex-1 truncate text-sm">{{ item.name }}</span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem @click="handleRoutineClick(item.entity as Routine)">
                    <IconSql class="h-4 w-4 mr-2" />
                    View Definition
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem @click="navigator.clipboard.writeText(item.name)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy Name
                  </ContextMenuItem>
                  <ContextMenuItem @click="openQueryTab(`CALL ${item.name}();`)">
                    <IconTerminal2 class="h-4 w-4 mr-2" />
                    Generate CALL Statement
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </template>

            <!-- Trigger -->
            <template v-else-if="item.type === 'trigger'">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                    :class="{ 'bg-accent': selectedNodeId === `trigger-${schema.name}-${item.name}` }"
                    @click="emit('update:selectedNodeId', `trigger-${schema.name}-${item.name}`); handleTriggerClick(item.entity as Trigger)">
                    <IconBolt class="h-4 w-4 text-yellow-500" />
                    <span class="flex-1 truncate text-sm">{{ item.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ (item.entity as Trigger).timing?.toLowerCase()
                      }}</span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem @click="handleTriggerClick(item.entity as Trigger)">
                    <IconSql class="h-4 w-4 mr-2" />
                    View Definition
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem @click="navigator.clipboard.writeText(item.name)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy Name
                  </ContextMenuItem>
                  <ContextMenuItem @click="navigator.clipboard.writeText(`DROP TRIGGER ${item.name};`)">
                    <IconCopy class="h-4 w-4 mr-2" />
                    Copy DROP Statement
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </template>
          </template>
          <div v-if="getSchemaItemsFiltered(schema.name).length === 0" class="px-2 py-1 text-xs text-muted-foreground">
            No items found
          </div>
        </template>
      </div>
    </div>
  </template>
</template>