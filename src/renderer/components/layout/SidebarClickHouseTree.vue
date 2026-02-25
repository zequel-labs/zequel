<script setup lang="ts">
import { useSidebarTree } from '@/composables/useSidebarTree'
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

const {
  connectionsStore, pendingChangesStore, pinnedStore,
  activeSessionId, currentDatabase,
  filteredTablesOnly, filteredViewsOnly,
  tablesOpen, viewsOpen,
  expandedTables, tableColumns, loadingTableColumns,
  toggleTableExpand, togglePin, handleTableClick,
  expandAll, collapseAll,
} = useSidebarTree({ searchFilter: () => props.searchFilter })

defineExpose({ expandAll, collapseAll })
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
