<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { usePinnedStore } from '@/stores/pinned'
import { useSidebarStateStore } from '@/stores/sidebarState'
import { useTabs } from '@/composables/useTabs'
import type { Table, Column, Routine, Trigger, Sequence, MaterializedView, Extension, EnumType } from '@/types/table'
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
const sidebarStateStore = useSidebarStateStore()
const { openTableTab, openViewTab, openQueryTab, openRoutineTab, openTriggerTab, openSequenceTab, openMaterializedViewTab, openExtensionsTab, openEnumsTab } = useTabs()

const activeSessionId = computed(() => connectionsStore.activeSessionId)
const currentDatabase = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeSessionId.value) || undefined
})

// PostgreSQL schema tree state
const expandedSchemas = ref<Set<string>>(new Set())
const schemaTables = ref<Map<string, Table[]>>(new Map())
const loadingSchemaTables = ref<Set<string>>(new Set())

// Routines, triggers, sequences, materialized views, extensions, enums
const allRoutines = ref<Routine[]>([])
const allTriggers = ref<Trigger[]>([])
const allSequences = ref<Sequence[]>([])
const allMaterializedViews = ref<MaterializedView[]>([])
const allExtensions = ref<Extension[]>([])
const allEnums = ref<EnumType[]>([])
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

const pgSchemas = computed(() => {
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

const getSchemaSequences = (schemaName: string): Sequence[] => {
  return allSequences.value.filter(s => s.schema === schemaName)
}

const getSchemaMaterializedViews = (schemaName: string): MaterializedView[] => {
  return allMaterializedViews.value.filter(mv => mv.schema === schemaName)
}

const getSchemaExtensions = (schemaName: string): Extension[] => {
  return allExtensions.value.filter(e => e.schema === schemaName)
}

const getSchemaEnums = (schemaName: string): EnumType[] => {
  return allEnums.value.filter(e => e.schema === schemaName)
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

const getFilteredSequences = (schemaName: string): Sequence[] => {
  const items = getSchemaSequences(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(s => s.name.toLowerCase().includes(q))
}

const getFilteredMaterializedViews = (schemaName: string): MaterializedView[] => {
  const items = getSchemaMaterializedViews(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(mv => mv.name.toLowerCase().includes(q))
}

const getFilteredExtensions = (schemaName: string): Extension[] => {
  const items = getSchemaExtensions(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(e => e.name.toLowerCase().includes(q))
}

const getFilteredEnums = (schemaName: string): EnumType[] => {
  const items = getSchemaEnums(schemaName)
  if (!props.searchFilter) return items
  const q = props.searchFilter.toLowerCase()
  return items.filter(e => e.name.toLowerCase().includes(q))
}

const schemaHasFilteredItems = (schemaName: string): boolean => {
  return getFilteredTables(schemaName).length > 0
    || getFilteredViews(schemaName).length > 0
    || getFilteredFunctions(schemaName).length > 0
    || getFilteredProcedures(schemaName).length > 0
    || getFilteredTriggers(schemaName).length > 0
    || getFilteredSequences(schemaName).length > 0
    || getFilteredMaterializedViews(schemaName).length > 0
    || getFilteredExtensions(schemaName).length > 0
    || getFilteredEnums(schemaName).length > 0
}

const filteredPgSchemas = computed(() => {
  if (!props.searchFilter) return pgSchemas.value
  const q = props.searchFilter.toLowerCase()
  return pgSchemas.value.filter(s => {
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

const handlePgTableClick = async (table: Table, schemaName: string) => {
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

const handleSequenceClick = (seq: Sequence) => {
  if (!activeSessionId.value) return
  openSequenceTab(seq.name, seq.schema, currentDatabase.value)
}

const handleMaterializedViewClick = (mv: MaterializedView) => {
  if (!activeSessionId.value) return
  openMaterializedViewTab(mv.name, mv.schema, currentDatabase.value)
}

const handleExtensionsClick = () => {
  if (!activeSessionId.value) return
  openExtensionsTab(currentDatabase.value)
}

const handleEnumsClick = (schema: string) => {
  if (!activeSessionId.value) return
  openEnumsTab(schema, currentDatabase.value)
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

const loadSequences = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  try {
    const result = await window.api.schema.getSequences(sessionId)
    if (activeSessionId.value !== sessionId) return
    allSequences.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
    allSequences.value = []
  }
}

const loadMaterializedViews = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  try {
    const result = await window.api.schema.getMaterializedViews(sessionId)
    if (activeSessionId.value !== sessionId) return
    allMaterializedViews.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
    allMaterializedViews.value = []
  }
}

const loadExtensions = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  try {
    const result = await window.api.schema.getExtensions(sessionId)
    if (activeSessionId.value !== sessionId) return
    allExtensions.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
    allExtensions.value = []
  }
}

const loadEnums = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId) return
  try {
    const result = await window.api.schema.getEnums(sessionId)
    if (activeSessionId.value !== sessionId) return
    allEnums.value = result
  } catch {
    if (activeSessionId.value !== sessionId) return
    allEnums.value = []
  }
}

// Clear caches on refresh, but keep expanded schemas open
const handleRefreshSchema = async () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  schemaTables.value = new Map()
  allRoutines.value = []
  allTriggers.value = []
  allSequences.value = []
  allMaterializedViews.value = []
  allExtensions.value = []
  allEnums.value = []
  loadRoutines()
  loadTriggers()
  loadSequences()
  loadMaterializedViews()
  loadExtensions()
  loadEnums()

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

// Load schema tables for restored expanded schemas (e.g. after Move to New Window)
const loadRestoredSchemas = async () => {
  const sessionId = activeSessionId.value
  if (!sessionId || expandedSchemas.value.size === 0) return
  const db = connectionsStore.getActiveDatabase(sessionId)
  for (const schemaName of expandedSchemas.value) {
    if (schemaTables.value.has(schemaName)) continue
    loadingSchemaTables.value.add(schemaName)
    loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    try {
      const tbls = await window.api.schema.tables(sessionId, db, schemaName)
      if (activeSessionId.value !== sessionId) return
      schemaTables.value.set(schemaName, tbls)
      schemaTables.value = new Map(schemaTables.value)
    } catch {
      if (activeSessionId.value !== sessionId) return
      schemaTables.value.set(schemaName, [])
      schemaTables.value = new Map(schemaTables.value)
    } finally {
      loadingSchemaTables.value.delete(schemaName)
      loadingSchemaTables.value = new Set(loadingSchemaTables.value)
    }
  }
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  loadRoutines()
  loadTriggers()
  loadSequences()
  loadMaterializedViews()
  loadExtensions()
  loadEnums()
  loadRestoredSchemas()
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const loadSchemaColumns = async (schemaName: string, tables: { name: string }[]) => {
  const sessionId = activeSessionId.value
  if (!sessionId) return

  // Set schema once, then load all columns for that schema sequentially
  // This avoids race conditions with setCurrentSchema
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

  // 1. Open all schemas immediately
  for (const schema of pgSchemas.value) {
    expandedSchemas.value.add(schema.name)
  }
  expandedSchemas.value = new Set(expandedSchemas.value)

  // 2. Load tables for all schemas in parallel
  const db = connectionsStore.getActiveDatabase(sessionId)
  const schemasToLoad = pgSchemas.value.filter(s => !schemaTables.value.has(s.name))
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
  collapsedCategories.value = new Set()
}

defineExpose({ expandAll, collapseAll })

// Sync tree state to sidebar state store
watch(expandedTables, (val) => {
  if (activeSessionId.value) sidebarStateStore.setExpandedTables(activeSessionId.value, val)
})
watch(expandedSchemas, (val) => {
  if (activeSessionId.value) sidebarStateStore.setExpandedSchemas(activeSessionId.value, val)
})
watch(collapsedCategories, (val) => {
  if (activeSessionId.value) sidebarStateStore.setCollapsedCategories(activeSessionId.value, val)
})

// Restore tree state from sidebar state store on mount
const storedExpandedTables = sidebarStateStore.getExpandedTables(activeSessionId.value)
if (storedExpandedTables.size > 0) {
  expandedTables.value = storedExpandedTables
}
const storedExpandedSchemas = sidebarStateStore.getExpandedSchemas(activeSessionId.value)
if (storedExpandedSchemas.size > 0) {
  expandedSchemas.value = storedExpandedSchemas
}
const storedCollapsedCategories = sidebarStateStore.getCollapsedCategories(activeSessionId.value)
if (storedCollapsedCategories.size > 0) {
  collapsedCategories.value = storedCollapsedCategories
}

const clearCaches = () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  expandedSchemas.value = new Set()
  schemaTables.value = new Map()
  collapsedCategories.value = new Set()
  allRoutines.value = []
  allTriggers.value = []
  allSequences.value = []
  allMaterializedViews.value = []
  allExtensions.value = []
  allEnums.value = []
  loadRoutines()
  loadTriggers()
  loadSequences()
  loadMaterializedViews()
  loadExtensions()
  loadEnums()
}

// Clear caches when connection changes
watch(() => connectionsStore.activeSessionId, clearCaches)

// Clear caches when database changes (activeSessionId doesn't change on DB switch)
watch(currentDatabase, clearCaches)
</script>

<template>
  <template v-for="schema in filteredPgSchemas" :key="schema.name">
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
                          @click="emit('update:selectedNodeId', `table-${schema.name}-${table.name}`); handlePgTableClick(table, schema.name)">{{
                            table.name }}</span>
                        <span
                          v-if="activeSessionId && pendingChangesStore.hasPendingChanges(activeSessionId, table.name, currentDatabase, schema.name)"
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
                    :db-type="DatabaseType.PostgreSQL"
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
                          @click="emit('update:selectedNodeId', `table-${schema.name}-${view.name}`); handlePgTableClick(view, schema.name)">{{
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
                    :db-type="DatabaseType.PostgreSQL"
                    :is-pinned="pinnedStore.isPinned(TableObjectType.View, view.name, currentDatabase, schema.name)"
                    @toggle-pin="togglePin(view, schema.name)"
                    @export="emit('export-table', { name: view.name, schema: schema.name })"
                    @edit-view="handlePgTableClick(view, schema.name); emit('edit-view', view)"
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
                    <ContextMenuItem @click="openQueryTab(`SELECT ${routine.name}();`)">
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
                    <ContextMenuItem @click="openQueryTab(`CALL ${routine.name}();`)">
                      <component :is="getEntityIcon('procedure').icon" class="h-4 w-4 mr-2" />
                      Generate CALL Statement
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
                    <ContextMenuItem @click="copyToClipboard(`DROP TRIGGER ${trigger.name};`, 'Statement copied')">
                      <IconCopy class="h-4 w-4 mr-2" />
                      Copy DROP Statement
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              </template>
            </div>
          </div>

          <!-- Sequences folder -->
          <div v-if="getFilteredSequences(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'sequences')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:sequences`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Sequences</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredSequences(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:sequences`)" class="ml-3">
              <template v-for="seq in getFilteredSequences(schema.name)" :key="`seq-${seq.name}`">
                <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :class="{ 'bg-accent': selectedNodeId === `seq-${schema.name}-${seq.name}` }"
                  @click="emit('update:selectedNodeId', `seq-${schema.name}-${seq.name}`); handleSequenceClick(seq)">
                  <span class="w-3 shrink-0"></span>
                  <component :is="getEntityIcon('sequence').icon" :class="['h-4 w-4', getEntityIcon('sequence').color]" />
                  <span class="flex-1 truncate text-sm">{{ seq.name }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Materialized Views folder -->
          <div v-if="getFilteredMaterializedViews(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'materializedViews')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:materializedViews`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Materialized Views</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredMaterializedViews(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:materializedViews`)" class="ml-3">
              <template v-for="mv in getFilteredMaterializedViews(schema.name)" :key="`mv-${mv.name}`">
                <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :class="{ 'bg-accent': selectedNodeId === `mv-${schema.name}-${mv.name}` }"
                  @click="emit('update:selectedNodeId', `mv-${schema.name}-${mv.name}`); handleMaterializedViewClick(mv)">
                  <span class="w-3 shrink-0"></span>
                  <component :is="getEntityIcon('materializedView').icon" :class="['h-4 w-4', getEntityIcon('materializedView').color]" />
                  <span class="flex-1 truncate text-sm">{{ mv.name }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Extensions folder -->
          <div v-if="getFilteredExtensions(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'extensions')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:extensions`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Extensions</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredExtensions(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:extensions`)" class="ml-3">
              <template v-for="ext in getFilteredExtensions(schema.name)" :key="`ext-${ext.name}`">
                <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :class="{ 'bg-accent': selectedNodeId === `ext-${schema.name}-${ext.name}` }"
                  @click="emit('update:selectedNodeId', `ext-${schema.name}-${ext.name}`); handleExtensionsClick()">
                  <span class="w-3 shrink-0"></span>
                  <component :is="getEntityIcon('extensions').icon" :class="['h-4 w-4', getEntityIcon('extensions').color]" />
                  <span class="flex-1 truncate text-sm">{{ ext.name }}</span>
                  <span class="text-[10px] text-muted-foreground/60">{{ ext.version }}</span>
                </div>
              </template>
            </div>
          </div>

          <!-- Enums folder -->
          <div v-if="getFilteredEnums(schema.name).length > 0">
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md"
              @click="toggleCategory(schema.name, 'enums')">
              <IconChevronRight class="size-4 text-muted-foreground transition-transform shrink-0"
                :class="{ 'rotate-90': isCategoryOpen(`${schema.name}:enums`) }" />
              <IconFolderFilled class="size-4 text-foreground/40 shrink-0" />
              <span class="text-sm">Enums</span>
              <span class="text-xs text-muted-foreground">({{ getFilteredEnums(schema.name).length }})</span>
            </div>
            <div v-if="isCategoryOpen(`${schema.name}:enums`)" class="ml-3">
              <template v-for="enumType in getFilteredEnums(schema.name)" :key="`enum-${enumType.name}`">
                <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                  :class="{ 'bg-accent': selectedNodeId === `enum-${schema.name}-${enumType.name}` }"
                  @click="emit('update:selectedNodeId', `enum-${schema.name}-${enumType.name}`); handleEnumsClick(schema.name)">
                  <span class="w-3 shrink-0"></span>
                  <component :is="getEntityIcon('enums').icon" :class="['h-4 w-4', getEntityIcon('enums').color]" />
                  <span class="flex-1 truncate text-sm">{{ enumType.name }}</span>
                  <span class="text-[10px] text-muted-foreground/60">{{ enumType.values.length }} values</span>
                </div>
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