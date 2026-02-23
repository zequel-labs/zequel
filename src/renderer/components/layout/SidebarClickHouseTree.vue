<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { usePinnedStore } from '@/stores/pinned'
import { useTabs } from '@/composables/useTabs'
import { useSidebarFolder } from '@/composables/useSidebarFolder'
import type { Column } from '@/types/table'
import { TableObjectType } from '@/types/table'
import {
  IconLoader2,
  IconChevronRight
} from '@tabler/icons-vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import {
  ContextMenu,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { DatabaseType } from '@/types/connection'
import { getEntityIcon } from '@/lib/utils'
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
const { openTableTab, openViewTab } = useTabs()

const activeSessionId = computed(() => connectionsStore.activeSessionId)
const currentDatabase = computed(() => {
  if (!activeSessionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeSessionId.value) || undefined
})

const activeTables = computed(() => {
  if (!activeSessionId.value) return []
  return connectionsStore.tables.get(activeSessionId.value) || []
})

const activeTablesOnly = computed(() => activeTables.value.filter(t => t.type === 'table'))
const activeViewsOnly = computed(() => activeTables.value.filter(t => t.type !== 'table'))

// Folder collapse state
const tablesOpen = useSidebarFolder(() => props.searchFilter, true)
const viewsOpen = useSidebarFolder(() => props.searchFilter)

// Table column expansion state
const expandedTables = ref<Set<string>>(new Set())
const tableColumns = ref<Map<string, Column[]>>(new Map())
const loadingTableColumns = ref<Set<string>>(new Set())

const filteredTablesOnly = computed(() => {
  if (!props.searchFilter) return activeTablesOnly.value
  const q = props.searchFilter.toLowerCase()
  return activeTablesOnly.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredViewsOnly = computed(() => {
  if (!props.searchFilter) return activeViewsOnly.value
  const q = props.searchFilter.toLowerCase()
  return activeViewsOnly.value.filter(t => t.name.toLowerCase().includes(q))
})

const toggleTableExpand = async (tableName: string) => {
  if (expandedTables.value.has(tableName)) {
    expandedTables.value.delete(tableName)
    expandedTables.value = new Set(expandedTables.value)
    return
  }

  expandedTables.value.add(tableName)
  expandedTables.value = new Set(expandedTables.value)

  if (!tableColumns.value.has(tableName) && activeSessionId.value) {
    loadingTableColumns.value.add(tableName)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      const cols = await window.api.schema.columns(activeSessionId.value, tableName)
      tableColumns.value.set(tableName, cols)
      tableColumns.value = new Map(tableColumns.value)
    } catch {
      tableColumns.value.set(tableName, [])
      tableColumns.value = new Map(tableColumns.value)
    } finally {
      loadingTableColumns.value.delete(tableName)
      loadingTableColumns.value = new Set(loadingTableColumns.value)
    }
  }
}

const togglePin = async (table: { name: string; type: string }): Promise<void> => {
  if (!activeSessionId.value) return
  const type = table.type === 'view' ? TableObjectType.View : TableObjectType.Table
  if (pinnedStore.isPinned(type, table.name, currentDatabase.value)) {
    await pinnedStore.unpinEntity(type, table.name, activeSessionId.value, currentDatabase.value)
  } else {
    await pinnedStore.pinEntity(type, table.name, activeSessionId.value, currentDatabase.value)
  }
}

const handleTableClick = (table: { name: string; type: string }) => {
  if (!activeSessionId.value) return
  if (table.type === 'view') {
    openViewTab(table.name, currentDatabase.value)
  } else {
    openTableTab(table.name, currentDatabase.value)
  }
}

// Clear caches on refresh
const handleRefreshSchema = () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
})

onUnmounted(() => {
  window.removeEventListener('zequel:refresh-schema', handleRefreshSchema)
})

const loadTableColumns = async (tableName: string) => {
  if (tableColumns.value.has(tableName) || loadingTableColumns.value.has(tableName)) return
  if (!activeSessionId.value) return

  loadingTableColumns.value.add(tableName)
  loadingTableColumns.value = new Set(loadingTableColumns.value)
  try {
    const cols = await window.api.schema.columns(activeSessionId.value, tableName)
    tableColumns.value.set(tableName, cols)
    tableColumns.value = new Map(tableColumns.value)
  } catch {
    tableColumns.value.set(tableName, [])
    tableColumns.value = new Map(tableColumns.value)
  } finally {
    loadingTableColumns.value.delete(tableName)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
  }
}

const expandAll = () => {
  tablesOpen.value = true
  viewsOpen.value = true

  // Mark all tables as expanded immediately (spinners show)
  for (const table of activeTablesOnly.value) {
    expandedTables.value.add(table.name)
  }
  expandedTables.value = new Set(expandedTables.value)

  // Fire off column loads in parallel
  Promise.all(activeTablesOnly.value.map(t => loadTableColumns(t.name)))
}

const collapseAll = () => {
  expandedTables.value = new Set()
}

defineExpose({ expandAll, collapseAll })

// Clear caches when connection changes
watch(() => connectionsStore.activeSessionId, () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
})
</script>

<template>
  <!-- Tables Folder -->
  <Collapsible v-model:open="tablesOpen">
    <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': tablesOpen }" />
      <span class="text-sm font-medium">Tables</span>
      <span class="text-xs text-muted-foreground">({{ filteredTablesOnly.length }})</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="table in filteredTablesOnly" :key="table.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div>
              <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                :data-testid="`sidebar-table-${table.name}`"
                :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }">
                <IconChevronRight class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                  :class="{ 'rotate-90': expandedTables.has(table.name) }"
                  @click.stop="toggleTableExpand(table.name)" />
                <component :is="getEntityIcon('table').icon" :class="['h-4 w-4 shrink-0', getEntityIcon('table').color]" />
                <span class="flex-1 truncate text-sm" data-testid="sidebar-table-name"
                  @click="emit('update:selectedNodeId', `table-${table.name}`); handleTableClick(table)">{{ table.name }}</span>
                <span
                  v-if="activeSessionId && pendingChangesStore.hasPendingChanges(activeSessionId, table.name, currentDatabase)"
                  class="h-2 w-2 rounded-full bg-yellow-500 shrink-0"
                />
              </div>
              <div v-if="expandedTables.has(table.name)" class="ml-3.5 border-l border-border pl-2">
                <div v-if="loadingTableColumns.has(table.name)" class="px-2 py-1">
                  <IconLoader2 class="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
                <template v-else-if="tableColumns.get(table.name)">
                  <div v-for="col in tableColumns.get(table.name)" :key="col.name"
                    class="flex items-center gap-2 px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/30 rounded-sm cursor-default">
                    <span class="flex-1 truncate">{{ col.name }}</span>
                    <span class="shrink-0 text-[10px] opacity-70 lowercase">{{ col.type }}{{
                      col.length ?
                        `(${col.length})` : '' }}{{ col.precision ? `(${col.precision}${col.scale ?
                        `,${col.scale}` : ''})` : '' }}</span>
                  </div>
                </template>
              </div>
            </div>
          </ContextMenuTrigger>
          <SidebarEntityContextMenu
            :name="table.name"
            :type="TableObjectType.Table"
            :db-type="DatabaseType.ClickHouse"
            :is-pinned="pinnedStore.isPinned(TableObjectType.Table, table.name, currentDatabase)"
            @toggle-pin="togglePin(table)"
            @export="emit('export-table', { name: table.name })"
            @rename="emit('rename-table', table)"
            @drop="emit('drop-table', table)"
          />
        </ContextMenu>
      </template>
      <div v-if="filteredTablesOnly.length === 0" class="px-2 py-1 text-sm text-muted-foreground">
        No tables found
      </div>
    </CollapsibleContent>
  </Collapsible>

  <!-- Views Folder -->
  <Collapsible v-if="filteredViewsOnly.length > 0" v-model:open="viewsOpen">
    <CollapsibleTrigger class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': viewsOpen }" />
      <span class="text-sm font-medium">Views</span>
      <span class="text-xs text-muted-foreground">({{ filteredViewsOnly.length }})</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="view in filteredViewsOnly" :key="view.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `table-${view.name}` }"
              @click="emit('update:selectedNodeId', `table-${view.name}`); handleTableClick(view)">
              <span class="w-3 shrink-0"></span>
              <component :is="getEntityIcon('view').icon" :class="['h-4 w-4', getEntityIcon('view').color]" />
              <span class="flex-1 truncate text-sm">{{ view.name }}</span>
            </div>
          </ContextMenuTrigger>
          <SidebarEntityContextMenu
            :name="view.name"
            :type="TableObjectType.View"
            :db-type="DatabaseType.ClickHouse"
            :is-pinned="pinnedStore.isPinned(TableObjectType.View, view.name, currentDatabase)"
            @toggle-pin="togglePin(view)"
            @export="emit('export-table', { name: view.name })"
            @edit-view="emit('edit-view', view)"
            @drop-view="emit('drop-view', view)"
          />
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>
</template>
