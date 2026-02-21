<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { usePinnedStore } from '@/stores/pinned'
import { useTabs } from '@/composables/useTabs'
import type { Table, Column, Routine, Trigger } from '@/types/table'
import { RoutineType, TableObjectType } from '@/types/table'
import {
  IconLoader2,
  IconSql,
  IconCopy,
  IconChevronRight,
  IconFolderFilled
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { DatabaseType } from '@/types/connection'
import { copyToClipboard, getEntityIcon } from '@/lib/utils'
import SidebarEntityContextMenu from './SidebarEntityContextMenu.vue'

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
  (e: 'export-table', data: { name: string; schema?: string }): void
}>()

const connectionsStore = useConnectionsStore()
const pendingChangesStore = usePendingChangesStore()
const pinnedStore = usePinnedStore()
const { openTableTab, openViewTab, openQueryTab, openRoutineTab, openTriggerTab } = useTabs()

const quoteSqlIdentifier = (name: string): string => {
  if (name === '*') return '*'
  return `[${name.replace(/\]/g, ']]')}]`
}

const activeSessionId = computed(() => connectionsStore.activeSessionId)
const currentDatabase = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeSessionId.value) || undefined
})

// SQL Server schema tree state
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

// Category folder collapse state (empty = all expanded by default)
const collapsedCategories = ref<Set<string>>(new Set())

const toggleCategory = (schemaName: string, category: string) => {
  const key = `${schemaName}:${category}`
  if (collapsedCategories.value.has(key)) {
    collapsedCategories.value.delete(key)
  } else {
    collapsedCategories.value.add(key)
  }
  collapsedCategories.value = new Set(collapsedCategories.value)
}

const isSchemaExpanded = (name: string): boolean => !!props.searchFilter || expandedSchemas.value.has(name)
const isCategoryOpen = (key: string): boolean => !!props.searchFilter || !collapsedCategories.value.has(key)

const sqlserverSchemas = computed(() => {
  if (!activeSessionId.value) return []
  return connectionsStore.schemas.get(activeSessionId.value) || []
})

const getSchemaTablesOnly = (schemaName: string): Table[] => {
  const tbls = schemaTables.value.get(schemaName) || []
  return tbls.filter(t => t.type !== 'view')
}

const getSchemaViewsOnly = (schemaName: string): Table[] => {
  const tbls = schemaTables.value.get(schemaName) || []
  return tbls.filter(t => t.type === 'view')
}

const getSchemaFunctions = (schemaName: string): Routine[] => {
  return allRoutines.value.filter(r => r.schema === schemaName && r.type !== RoutineType.Procedure)
}

const getSchemaProcedures = (schemaName: string): Routine[] => {
  return allRoutines.value.filter(r => r.schema === schemaName && r.type === RoutineType.Procedure)
}

const getSchemaTriggers = (schemaName: string): Trigger[] => {
  return allTriggers.value.filter(t => t.schema === schemaName)
}

const getFilteredTables = (schemaName: string): Table[] => {
  const items = getSchemaTablesOnly(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(t => t.name.toLowerCase().includes(q))
}

const getFilteredViews = (schemaName: string): Table[] => {
  const items = getSchemaViewsOnly(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(t => t.name.toLowerCase().includes(q))
}

const getFilteredFunctions = (schemaName: string): Routine[] => {
  const items = getSchemaFunctions(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(r => r.name.toLowerCase().includes(q))
}

const getFilteredProcedures = (schemaName: string): Routine[] => {
  const items = getSchemaProcedures(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(r => r.name.toLowerCase().includes(q))
}

const getFilteredTriggers = (schemaName: string): Trigger[] => {
  const items = getSchemaTriggers(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(t => t.name.toLowerCase().includes(q))
}

const schemaHasAnyItems = (schemaName: string): boolean => {
  const tbls = schemaTables.value.get(schemaName) || []
  if (tbls.length > 0) return true
  if (allRoutines.value.some(r => r.schema === schemaName)) return true
  if (allTriggers.value.some(t => t.schema === schemaName)) return true
  return false
}

const schemaHasFilteredItems = (schemaName: string): boolean => {
  return getFilteredTables(schemaName).length > 0
    || getFilteredViews(schemaName).length > 0
    || getFilteredFunctions(schemaName).length > 0
    || getFilteredProcedures(schemaName).length > 0
    || getFilteredTriggers(schemaName).length > 0
}

const filteredSchemas = computed(() => {
  if (!props.searchFilter) return sqlserverSchemas.value
  const q = props.searchFilter.toLowerCase()
  return sqlserverSchemas.value.filter(s => {
    if (s.name.toLowerCase().includes(q)) return true
    return schemaHasFilteredItems(s.name)
  })
})

const toggleSchemaExpand = async (schemaName: string) => {
  if (expandedSchemas.value.has(schemaName)) {
    expandedSchemas.value.delete(schemaName)
    expandedSchemas.value = new Set(expandedSchemas.value)
    return
  }

  expandedSchemas.value.add(schemaName)
  expandedSchemas.value = new Set(expandedSchemas.value)

  const sessionId = activeSessionId.value
  if (!schemaTables.value.has(schemaName) && sessionId) {
    loadingSchemaTables.value.add(schemaName)
    loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    try {
      const db = connectionsStore.getActiveDatabase(sessionId)
      const tbls = await window.api.schema.tables(sessionId, db, schemaName)
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

  const sessionId = activeSessionId.value
  if (!tableColumns.value.has(key) && sessionId) {
    loadingTableColumns.value.add(key)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      if (schema) {
        await window.api.schema.setCurrentSchema(sessionId, schema)
      }
      const cols = await window.api.schema.columns(sessionId, tableName)
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

const handleTableClick = async (table: Table, schemaName: string) => {
  if (!activeSessionId.value) return
  await connectionsStore.setActiveSchema(activeSessionId.value, schemaName)
  if (table.type === 'view') {
    openViewTab(table.name, currentDatabase.value, schemaName)
  } else {
    openTableTab(table.name, currentDatabase.value, schemaName)
  }
}

const handleRoutineClick = (routine: Routine) => {
  if (!activeSessionId.value) return
  openRoutineTab(routine.name, routine.type, currentDatabase.value)
}

const handleTriggerClick = (trigger: Trigger) => {
  if (!activeSessionId.value) return
  openTriggerTab(trigger.name, trigger.table, currentDatabase.value)
}

const togglePin = async (item: { name: string; type: string }, schema: string): Promise<void> => {
  if (!activeSessionId.value) return
  const type = item.type === 'view' ? TableObjectType.View : TableObjectType.Table
  if (pinnedStore.isPinned(type, item.name, currentDatabase.value, schema)) {
    await pinnedStore.unpinEntity(type, item.name, activeSessionId.value, currentDatabase.value, schema)
  } else {
    await pinnedStore.pinEntity(type, item.name, activeSessionId.value, currentDatabase.value, schema)
  }
}

const loadRoutines = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId || loadingRoutines.value) return
  loadingRoutines.value = true
  try {
    const result = await window.api.schema.getRoutines(sessionId)
    if (activeSessionId.value !== sessionId) return
    allRoutines.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
    allRoutines.value = []
  } finally {
    loadingRoutines.value = false
  }
}

const loadTriggers = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId || loadingTriggers.value) return
  loadingTriggers.value = true
  try {
    const result = await window.api.schema.getTriggers(sessionId)
    if (activeSessionId.value !== sessionId) return
    allTriggers.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
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
  const refreshSessionId = activeSessionId.value
  if (refreshSessionId && expandedSchemas.value.size > 0) {
    const db = connectionsStore.getActiveDatabase(refreshSessionId)
    for (const schemaName of expandedSchemas.value) {
      if (activeSessionId.value !== refreshSessionId) return
      try {
        const tbls = await window.api.schema.tables(refreshSessionId, db, schemaName)
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
  const sessionId = activeSessionId.value
  if (!sessionId) return

  await window.api.schema.setCurrentSchema(sessionId, schemaName)

  for (const t of tables) {
    if (activeSessionId.value !== sessionId) return
    const key = getTableKey(t.name, schemaName)
    if (tableColumns.value.has(key) || loadingTableColumns.value.has(key)) continue

    loadingTableColumns.value.add(key)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      const cols = await window.api.schema.columns(sessionId, t.name)
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
  const sessionId = activeSessionId.value
  if (!sessionId) return

  collapsedCategories.value = new Set()

  for (const schema of sqlserverSchemas.value) {
    expandedSchemas.value.add(schema.name)
  }
  expandedSchemas.value = new Set(expandedSchemas.value)

  const db = connectionsStore.getActiveDatabase(sessionId)
  const schemasToLoad = sqlserverSchemas.value.filter(s => !schemaTables.value.has(s.name))
  await Promise.all(schemasToLoad.map(async (schema) => {
    loadingSchemaTables.value.add(schema.name)
    loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    try {
      const tbls = await window.api.schema.tables(sessionId, db, schema.name)
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

  for (const schema of sqlserverSchemas.value) {
    const tbls = schemaTables.value.get(schema.name) || []
    for (const t of tbls) {
      expandedTables.value.add(getTableKey(t.name, schema.name))
    }
  }
  expandedTables.value = new Set(expandedTables.value)

  for (const schema of sqlserverSchemas.value) {
    const tbls = schemaTables.value.get(schema.name) || []
    if (tbls.length > 0) {
      await loadSchemaColumns(schema.name, tbls)
    }
  }
}

const collapseAll = () => {
  expandedSchemas.value = new Set()
  expandedTables.value = new Set()
  collapsedCategories.value = new Set()
}

defineExpose({ expandAll, collapseAll })

const clearCaches = () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  expandedSchemas.value = new Set()
  schemaTables.value = new Map()
  collapsedCategories.value = new Set()
  allRoutines.value = []
  allTriggers.value = []
  loadRoutines()
  loadTriggers()
}

// Clear caches when connection changes
watch(() => connectionsStore.activeSessionId, clearCaches)

// Clear caches when database changes (activeSessionId doesn't change on DB switch)
watch(currentDatabase, clearCaches)
</script>

<template>
  <template v-for="schema in filteredSchemas" :key="schema.name">
    <div>
      <div :data-testid="`sidebar-schema-${schema.name}`"
        class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
        @click="toggleSchemaExpand(schema.name)">
        <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
          :class="{ 'rotate-90': isSchemaExpanded(schema.name) }" />
        <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
        <span class="flex-1 truncate text-sm">{{ schema.name }}</span>
      </div>
      <div v-if="isSchemaExpanded(schema.name)" class="ml-3.5 pl-1">
        <div v-if="loadingSchemaTables.has(schema.name)" class="px-2 py-1">
          <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <!-- Tables folder -->
          <div v-if="getFilteredTables(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'tables')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:tables`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Tables</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredTables(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:tables`)" class="ml-3">
              <template v-for="table in getFilteredTables(schema.name)" :key="`table-${table.name}`">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div>
                      <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                        :class="{ 'bg-accent': selectedNodeId === `table-${schema.name}-${table.name}` }"
                        :data-testid="`sidebar-table-${table.name}`">
                        <IconChevronRight class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                          :class="{ 'rotate-90': expandedTables.has(getTableKey(table.name, schema.name)) }"
                          @click.stop="toggleTableExpand(table.name, schema.name)" />
                        <component :is="getEntityIcon(schema.isSystem ? 'systemTable' : 'table').icon"
                          :class="['h-4 w-4 shrink-0', getEntityIcon(schema.isSystem ? 'systemTable' : 'table').color]" />
                        <span class="flex-1 truncate text-sm" data-testid="sidebar-table-name"
                          @click="emit('update:selectedNodeId', `table-${schema.name}-${table.name}`); handleTableClick(table, schema.name)">{{
                            table.name }}</span>
                        <span
                          v-if="pendingChangesStore.hasPendingChanges(activeSessionId!, table.name, currentDatabase, schema.name)"
                          class="h-2 w-2 rounded-full bg-yellow-500 shrink-0"
                        />
                      </div>
                      <div v-if="expandedTables.has(getTableKey(table.name, schema.name))"
                        class="ml-3.5 border-l border-border pl-2">
                        <div v-if="loadingTableColumns.has(getTableKey(table.name, schema.name))" class="px-2 py-1">
                          <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
                        </div>
                        <template v-else-if="tableColumns.get(getTableKey(table.name, schema.name))">
                          <div v-for="col in tableColumns.get(getTableKey(table.name, schema.name))" :key="col.name"
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
                  <SidebarEntityContextMenu
                    :name="table.name"
                    :type="TableObjectType.Table"
                    :schema="schema.name"
                    :db-type="DatabaseType.SQLServer"
                    :is-pinned="pinnedStore.isPinned(TableObjectType.Table, table.name, currentDatabase, schema.name)"
                    @toggle-pin="togglePin(table, schema.name)"
                    @export="emit('export-table', { name: table.name, schema: schema.name })"
                    @rename="emit('rename-table', table)"
                    @drop="emit('drop-table', table)"
                  />
                </ContextMenu>
              </template>
            </div>
          </div>

          <!-- Views folder -->
          <div v-if="getFilteredViews(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'views')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:views`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Views</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredViews(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:views`)" class="ml-3">
              <template v-for="view in getFilteredViews(schema.name)" :key="`view-${view.name}`">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div>
                      <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                        :class="{ 'bg-accent': selectedNodeId === `table-${schema.name}-${view.name}` }"
                        :data-testid="`sidebar-table-${view.name}`">
                        <IconChevronRight class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                          :class="{ 'rotate-90': expandedTables.has(getTableKey(view.name, schema.name)) }"
                          @click.stop="toggleTableExpand(view.name, schema.name)" />
                        <component :is="getEntityIcon(schema.isSystem ? 'systemView' : 'view').icon"
                          :class="['h-4 w-4 shrink-0', getEntityIcon(schema.isSystem ? 'systemView' : 'view').color]" />
                        <span class="flex-1 truncate text-sm" data-testid="sidebar-table-name"
                          @click="emit('update:selectedNodeId', `table-${schema.name}-${view.name}`); handleTableClick(view, schema.name)">{{
                            view.name }}</span>
                      </div>
                      <div v-if="expandedTables.has(getTableKey(view.name, schema.name))"
                        class="ml-3.5 border-l border-border pl-2">
                        <div v-if="loadingTableColumns.has(getTableKey(view.name, schema.name))" class="px-2 py-1">
                          <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
                        </div>
                        <template v-else-if="tableColumns.get(getTableKey(view.name, schema.name))">
                          <div v-for="col in tableColumns.get(getTableKey(view.name, schema.name))" :key="col.name"
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
                  <SidebarEntityContextMenu
                    :name="view.name"
                    :type="TableObjectType.View"
                    :schema="schema.name"
                    :db-type="DatabaseType.SQLServer"
                    :is-pinned="pinnedStore.isPinned(TableObjectType.View, view.name, currentDatabase, schema.name)"
                    @toggle-pin="togglePin(view, schema.name)"
                    @export="emit('export-table', { name: view.name, schema: schema.name })"
                    @edit-view="handleTableClick(view, schema.name); emit('edit-view', view)"
                    @drop-view="emit('drop-view', view)"
                  />
                </ContextMenu>
              </template>
            </div>
          </div>

          <!-- Functions folder -->
          <div v-if="getFilteredFunctions(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'functions')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:functions`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Functions</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredFunctions(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:functions`)" class="ml-3">
              <template v-for="routine in getFilteredFunctions(schema.name)" :key="`function-${routine.name}`">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `routine-${schema.name}-${routine.name}` }"
                      @click="emit('update:selectedNodeId', `routine-${schema.name}-${routine.name}`); handleRoutineClick(routine)">
                      <span class="w-3 shrink-0"></span>
                      <component :is="getEntityIcon('function').icon" :class="['h-4 w-4', getEntityIcon('function').color]" />
                      <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleRoutineClick(routine)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="copyToClipboard(routine.name, 'Name copied')">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`SELECT ${quoteSqlIdentifier(schema.name)}.${quoteSqlIdentifier(routine.name)}();`)">
                      <component :is="getEntityIcon('function').icon" class="h-4 w-4 mr-2" />
                      Generate SELECT Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </div>
          </div>

          <!-- Procedures folder -->
          <div v-if="getFilteredProcedures(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'procedures')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:procedures`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Procedures</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredProcedures(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:procedures`)" class="ml-3">
              <template v-for="routine in getFilteredProcedures(schema.name)" :key="`procedure-${routine.name}`">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `routine-${schema.name}-${routine.name}` }"
                      @click="emit('update:selectedNodeId', `routine-${schema.name}-${routine.name}`); handleRoutineClick(routine)">
                      <span class="w-3 shrink-0"></span>
                      <component :is="getEntityIcon('procedure').icon" :class="['h-4 w-4', getEntityIcon('procedure').color]" />
                      <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleRoutineClick(routine)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="copyToClipboard(routine.name, 'Name copied')">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="openQueryTab(`EXEC ${quoteSqlIdentifier(schema.name)}.${quoteSqlIdentifier(routine.name)};`)">
                      <component :is="getEntityIcon('procedure').icon" class="h-4 w-4 mr-2" />
                      Generate EXEC Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </div>
          </div>

          <!-- Triggers folder -->
          <div v-if="getFilteredTriggers(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'triggers')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:triggers`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Triggers</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredTriggers(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:triggers`)" class="ml-3">
              <template v-for="trigger in getFilteredTriggers(schema.name)" :key="`trigger-${trigger.name}`">
                <ContextMenu>
                  <ContextMenuTrigger as-child>
                    <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                      :class="{ 'bg-accent': selectedNodeId === `trigger-${schema.name}-${trigger.name}` }"
                      @click="emit('update:selectedNodeId', `trigger-${schema.name}-${trigger.name}`); handleTriggerClick(trigger)">
                      <span class="w-3 shrink-0"></span>
                      <component :is="getEntityIcon('trigger').icon" :class="['h-4 w-4', getEntityIcon('trigger').color]" />
                      <span class="flex-1 truncate text-sm">{{ trigger.name }}</span>
                      <span class="text-xs text-muted-foreground">{{ trigger.timing?.toLowerCase() }}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem @click="handleTriggerClick(trigger)">
                      <IconSql class="h-4 w-4 mr-2" />
                      View Definition
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem @click="copyToClipboard(trigger.name, 'Name copied')">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy Name
                    </ContextMenuItem>
                    <ContextMenuItem @click="copyToClipboard(`DROP TRIGGER ${quoteSqlIdentifier(schema.name)}.${quoteSqlIdentifier(trigger.name)};`, 'Statement copied')">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy DROP Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </div>
          </div>

          <div v-if="!schemaHasFilteredItems(schema.name) && !loadingSchemaTables.has(schema.name)"
            class="px-2 py-1 text-xs text-muted-foreground">
            No items found
          </div>
        </template>
      </div>
    </div>
  </template>
</template>
