<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { Column } from '@/types/table'
import {
  IconTable,
  IconEye,
  IconLoader2,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconChevronRight
} from '@tabler/icons-vue'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
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
const { openTableTab, openViewTab, openQueryTab } = useTabs()

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const currentDatabase = computed(() => {
  if (!activeConnectionId.value) return undefined
  return connectionsStore.getActiveDatabase(activeConnectionId.value) || undefined
})

const activeTables = computed(() => {
  if (!activeConnectionId.value) return []
  return connectionsStore.tables.get(activeConnectionId.value) || []
})

const activeTablesOnly = computed(() => activeTables.value.filter(t => t.type === 'table'))
const activeViewsOnly = computed(() => activeTables.value.filter(t => t.type !== 'table'))

// Folder collapse state
const tablesOpen = ref(true)
const viewsOpen = ref(false)

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

  if (!tableColumns.value.has(tableName) && activeConnectionId.value) {
    loadingTableColumns.value.add(tableName)
    loadingTableColumns.value = new Set(loadingTableColumns.value)
    try {
      const cols = await window.api.schema.columns(activeConnectionId.value, tableName)
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

const handleTableClick = (table: { name: string; type: string }) => {
  if (!activeConnectionId.value) return
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
  if (!activeConnectionId.value) return

  loadingTableColumns.value.add(tableName)
  loadingTableColumns.value = new Set(loadingTableColumns.value)
  try {
    const cols = await window.api.schema.columns(activeConnectionId.value, tableName)
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
watch(() => connectionsStore.activeConnectionId, () => {
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
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="table in filteredTablesOnly" :key="table.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div>
              <div class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
                :class="{ 'bg-accent': selectedNodeId === `table-${table.name}` }">
                <IconChevronRight class="h-3 w-3 text-muted-foreground transition-transform shrink-0"
                  :class="{ 'rotate-90': expandedTables.has(table.name) }"
                  @click.stop="toggleTableExpand(table.name)" />
                <IconTable class="h-4 w-4 text-blue-500 shrink-0" />
                <span class="flex-1 truncate text-sm"
                  @click="emit('update:selectedNodeId', `table-${table.name}`); handleTableClick(table)">{{ table.name }}</span>
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
          <ContextMenuContent>
            <ContextMenuItem @click="openTableTab(table.name, currentDatabase)">
              <IconTable class="h-4 w-4 mr-2" />
              View Data
            </ContextMenuItem>
            <ContextMenuItem @click="openQueryTab(`SELECT * FROM ${table.name} LIMIT 100`)">
              <IconSql class="h-4 w-4 mr-2" />
              Query Table
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="emit('rename-table', table)">
              <IconPencil class="h-4 w-4 mr-2" />
              Rename Table
            </ContextMenuItem>
            <ContextMenuItem @click="emit('drop-table', table)">
              <IconTrash class="h-4 w-4 mr-2" />
              Drop Table
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="navigator.clipboard.writeText(table.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM ${table.name}`)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy SELECT Statement
            </ContextMenuItem>
          </ContextMenuContent>
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
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="view in filteredViewsOnly" :key="view.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `table-${view.name}` }"
              @click="emit('update:selectedNodeId', `table-${view.name}`); handleTableClick(view)">
              <IconEye class="h-4 w-4 text-purple-500" />
              <span class="flex-1 truncate text-sm">{{ view.name }}</span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="openViewTab(view.name, currentDatabase)">
              <IconEye class="h-4 w-4 mr-2" />
              View Data
            </ContextMenuItem>
            <ContextMenuItem @click="openQueryTab(`SELECT * FROM ${view.name} LIMIT 100`)">
              <IconSql class="h-4 w-4 mr-2" />
              Query View
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="emit('edit-view', view)">
              <IconPencil class="h-4 w-4 mr-2" />
              Edit View
            </ContextMenuItem>
            <ContextMenuItem @click="emit('drop-view', view)">
              <IconTrash class="h-4 w-4 mr-2" />
              Drop View
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="navigator.clipboard.writeText(view.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM ${view.name}`)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy SELECT Statement
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>
</template>
