<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { Column, Routine, Trigger, MySQLEvent } from '@/types/table'
import {
  IconTable,
  IconEye,
  IconLoader2,
  IconSql,
  IconCopy,
  IconTrash,
  IconPencil,
  IconChevronRight,
  IconFunction,
  IconTerminal2,
  IconBolt,
  IconCalendarEvent
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
const { openTableTab, openViewTab, openQueryTab, openRoutineTab, openTriggerTab, openEventTab } = useTabs()

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
const functionsOpen = ref(false)
const proceduresOpen = ref(false)
const triggersOpen = ref(false)
const eventsOpen = ref(false)

// Table column expansion state
const expandedTables = ref<Set<string>>(new Set())
const tableColumns = ref<Map<string, Column[]>>(new Map())
const loadingTableColumns = ref<Set<string>>(new Set())

// Routines, triggers, events
const routines = ref<Routine[]>([])
const triggers = ref<Trigger[]>([])
const events = ref<MySQLEvent[]>([])
const loadingRoutines = ref(false)
const loadingTriggers = ref(false)
const loadingEvents = ref(false)

const activeFunctions = computed(() => routines.value.filter(r => r.type === 'FUNCTION'))
const activeProcedures = computed(() => routines.value.filter(r => r.type === 'PROCEDURE'))

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

const filteredFunctions = computed(() => {
  if (!props.searchFilter) return activeFunctions.value
  const q = props.searchFilter.toLowerCase()
  return activeFunctions.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredProcedures = computed(() => {
  if (!props.searchFilter) return activeProcedures.value
  const q = props.searchFilter.toLowerCase()
  return activeProcedures.value.filter(r => r.name.toLowerCase().includes(q))
})

const filteredTriggers = computed(() => {
  if (!props.searchFilter) return triggers.value
  const q = props.searchFilter.toLowerCase()
  return triggers.value.filter(t => t.name.toLowerCase().includes(q))
})

const filteredEvents = computed(() => {
  if (!props.searchFilter) return events.value
  const q = props.searchFilter.toLowerCase()
  return events.value.filter(e => e.name.toLowerCase().includes(q))
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

const handleRoutineClick = (routine: Routine) => {
  if (!activeConnectionId.value) return
  openRoutineTab(routine.name, routine.type, currentDatabase.value)
}

const handleTriggerClick = (trigger: Trigger) => {
  if (!activeConnectionId.value) return
  openTriggerTab(trigger.name, trigger.table, currentDatabase.value)
}

const handleEventClick = (event: MySQLEvent) => {
  if (!activeConnectionId.value) return
  openEventTab(event.name, currentDatabase.value)
}

const loadRoutines = async () => {
  if (!activeConnectionId.value || loadingRoutines.value) return
  loadingRoutines.value = true
  try {
    routines.value = await window.api.schema.getRoutines(activeConnectionId.value)
  } catch {
    routines.value = []
  } finally {
    loadingRoutines.value = false
  }
}

const loadTriggers = async () => {
  if (!activeConnectionId.value || loadingTriggers.value) return
  loadingTriggers.value = true
  try {
    triggers.value = await window.api.schema.getTriggers(activeConnectionId.value)
  } catch {
    triggers.value = []
  } finally {
    loadingTriggers.value = false
  }
}

const loadEvents = async () => {
  if (!activeConnectionId.value || loadingEvents.value) return
  loadingEvents.value = true
  try {
    events.value = await window.api.schema.getEvents(activeConnectionId.value)
  } catch {
    events.value = []
  } finally {
    loadingEvents.value = false
  }
}

// Clear caches on refresh
const handleRefreshSchema = () => {
  expandedTables.value = new Set()
  tableColumns.value = new Map()
  routines.value = []
  triggers.value = []
  events.value = []
  loadRoutines()
  loadTriggers()
  loadEvents()
}

onMounted(() => {
  window.addEventListener('zequel:refresh-schema', handleRefreshSchema)
  loadRoutines()
  loadTriggers()
  loadEvents()
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
  functionsOpen.value = true
  proceduresOpen.value = true
  triggersOpen.value = true
  eventsOpen.value = true

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
  routines.value = []
  triggers.value = []
  events.value = []
  loadRoutines()
  loadTriggers()
  loadEvents()
})
</script>

<template>
  <!-- Tables Folder -->
  <Collapsible v-model:open="tablesOpen">
    <div class="flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md">
      <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
        <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
          :class="{ 'rotate-90': tablesOpen }" />
        <span class="text-sm font-medium">Tables</span>
      </CollapsibleTrigger>
    </div>
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
                  @click="emit('update:selectedNodeId', `table-${table.name}`); handleTableClick(table)">{{ table.name
                  }}</span>
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
            <ContextMenuItem @click="openQueryTab(`SELECT * FROM \`${table.name}\` LIMIT 100;`)">
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
            <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM \`${table.name}\`;`)">
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
    <div class="flex items-center justify-between px-2 py-1 hover:bg-accent/30 rounded-md">
      <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
        <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
          :class="{ 'rotate-90': viewsOpen }" />
        <span class="text-sm font-medium">Views</span>
      </CollapsibleTrigger>
    </div>
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
            <ContextMenuItem @click="openQueryTab(`SELECT * FROM \`${view.name}\` LIMIT 100;`)">
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
            <ContextMenuItem @click="navigator.clipboard.writeText(`SELECT * FROM \`${view.name}\`;`)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy SELECT Statement
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>

  <!-- Functions Folder -->
  <Collapsible v-if="filteredFunctions.length > 0" v-model:open="functionsOpen">
    <CollapsibleTrigger
      class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': functionsOpen }" />
      <span class="text-sm font-medium">Functions</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="routine in filteredFunctions" :key="routine.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `routine-${routine.name}` }"
              @click="emit('update:selectedNodeId', `routine-${routine.name}`); handleRoutineClick(routine)">
              <IconFunction class="h-4 w-4 text-amber-500" />
              <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="handleRoutineClick(routine)">
              <IconSql class="h-4 w-4 mr-2" />
              View Definition
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="navigator.clipboard.writeText(routine.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem @click="openQueryTab(`SELECT ${routine.name}();`)">
              <IconFunction class="h-4 w-4 mr-2" />
              Generate SELECT Statement
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>

  <!-- Procedures Folder -->
  <Collapsible v-if="filteredProcedures.length > 0" v-model:open="proceduresOpen">
    <CollapsibleTrigger
      class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': proceduresOpen }" />
      <span class="text-sm font-medium">Procedures</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="routine in filteredProcedures" :key="routine.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `routine-${routine.name}` }"
              @click="emit('update:selectedNodeId', `routine-${routine.name}`); handleRoutineClick(routine)">
              <IconTerminal2 class="h-4 w-4 text-green-500" />
              <span class="flex-1 truncate text-sm">{{ routine.name }}</span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="handleRoutineClick(routine)">
              <IconSql class="h-4 w-4 mr-2" />
              View Definition
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="navigator.clipboard.writeText(routine.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem @click="openQueryTab(`CALL ${routine.name}();`)">
              <IconTerminal2 class="h-4 w-4 mr-2" />
              Generate CALL Statement
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>

  <!-- Triggers Folder -->
  <Collapsible v-if="filteredTriggers.length > 0" v-model:open="triggersOpen">
    <CollapsibleTrigger
      class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': triggersOpen }" />
      <span class="text-sm font-medium">Triggers</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="trigger in filteredTriggers" :key="trigger.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `trigger-${trigger.name}` }"
              @click="emit('update:selectedNodeId', `trigger-${trigger.name}`); handleTriggerClick(trigger)">
              <IconBolt class="h-4 w-4 text-yellow-500" />
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
            <ContextMenuItem @click="navigator.clipboard.writeText(trigger.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
            <ContextMenuItem @click="navigator.clipboard.writeText(`DROP TRIGGER ${trigger.name};`)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy DROP Statement
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>

  <!-- Events Folder -->
  <Collapsible v-if="filteredEvents.length > 0" v-model:open="eventsOpen">
    <CollapsibleTrigger
      class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/30 rounded-md w-full">
      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
        :class="{ 'rotate-90': eventsOpen }" />
      <span class="text-sm font-medium">Events</span>
    </CollapsibleTrigger>
    <CollapsibleContent class="ml-2">
      <template v-for="event in filteredEvents" :key="event.name">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
              :class="{ 'bg-accent': selectedNodeId === `event-${event.name}` }"
              @click="emit('update:selectedNodeId', `event-${event.name}`); handleEventClick(event)">
              <IconCalendarEvent class="h-4 w-4 text-pink-500" />
              <span class="flex-1 truncate text-sm">{{ event.name }}</span>
              <span class="text-xs px-1 rounded"
                :class="event.status === 'ENABLED' ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-500'">
                {{ event.status === 'ENABLED' ? 'on' : 'off' }}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="handleEventClick(event)">
              <IconSql class="h-4 w-4 mr-2" />
              View Definition
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="navigator.clipboard.writeText(event.name)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy Name
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>
    </CollapsibleContent>
  </Collapsible>

  <!-- Loading indicator -->
  <div v-if="loadingRoutines || loadingTriggers || loadingEvents" class="px-2 py-1">
    <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
  </div>
</template>
