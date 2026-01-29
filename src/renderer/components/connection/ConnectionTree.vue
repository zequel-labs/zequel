<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { Table, Database } from '@/types/table'
import {
  IconChevronRight,
  IconChevronDown,
  IconDatabase,
  IconTable,
  IconEye,
  IconFolderOpen,
  IconLoader2,
  IconPlus,
  IconPencil,
  IconTrash
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

const emit = defineEmits<{
  (e: 'select-table', table: Table): void
  (e: 'open-table', table: Table): void
  (e: 'create-table', database: string): void
  (e: 'rename-table', table: Table, database: string): void
  (e: 'drop-table', table: Table, database: string): void
  (e: 'open-view', table: Table): void
  (e: 'create-view', database: string): void
  (e: 'edit-view', table: Table, database: string): void
  (e: 'drop-view', table: Table, database: string): void
}>()

const connectionsStore = useConnectionsStore()

const expandedDatabases = ref<Set<string>>(new Set())
const loadingDatabases = ref<Set<string>>(new Set())
const selectedTable = ref<string | null>(null)

const connectionId = computed(() => connectionsStore.activeConnectionId)
const databases = computed(() => connectionsStore.activeDatabases)
const tables = computed(() => connectionsStore.activeTables)

// Get active database name
const activeDatabase = computed(() => {
  // Return the first expanded database or the first database
  for (const db of databases.value) {
    if (expandedDatabases.value.has(db.name)) {
      return db.name
    }
  }
  return databases.value[0]?.name || ''
})

async function toggleDatabase(dbName: string) {
  if (expandedDatabases.value.has(dbName)) {
    expandedDatabases.value.delete(dbName)
  } else {
    if (connectionId.value) {
      loadingDatabases.value.add(dbName)
      try {
        await connectionsStore.loadTables(connectionId.value, dbName)
        expandedDatabases.value.add(dbName)
      } finally {
        loadingDatabases.value.delete(dbName)
      }
    }
  }
}

function handleTableClick(table: Table) {
  selectedTable.value = table.name
  emit('select-table', table)
}

function handleTableDoubleClick(table: Table) {
  if (table.type === 'view') {
    emit('open-view', table)
  } else {
    emit('open-table', table)
  }
}
</script>

<template>
  <div class="space-y-1">
    <template v-for="database in databases" :key="database.name">
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div
            class="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent/50 rounded-md"
            @click="toggleDatabase(database.name)"
          >
            <button class="p-0.5">
              <IconLoader2
                v-if="loadingDatabases.has(database.name)"
                class="h-4 w-4 animate-spin text-muted-foreground"
              />
              <IconChevronRight
                v-else-if="!expandedDatabases.has(database.name)"
                class="h-4 w-4 text-muted-foreground"
              />
              <IconChevronDown v-else class="h-4 w-4 text-muted-foreground" />
            </button>

            <IconFolderOpen class="h-4 w-4 text-yellow-500" />
            <span class="flex-1 truncate text-sm">{{ database.name }}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem @click="emit('create-table', database.name)">
            <IconPlus class="h-4 w-4 mr-2" />
            Create Table
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem @click="emit('create-view', database.name)">
            <IconEye class="h-4 w-4 mr-2" />
            Create View
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <div
        v-if="expandedDatabases.has(database.name)"
        class="ml-6 space-y-0.5"
      >
        <ContextMenu v-for="table in tables" :key="table.name">
          <ContextMenuTrigger as-child>
            <div
              :class="[
                'flex items-center gap-2 px-2 py-1 cursor-pointer rounded-md',
                selectedTable === table.name ? 'bg-accent' : 'hover:bg-accent/50'
              ]"
              @click="handleTableClick(table)"
              @dblclick="handleTableDoubleClick(table)"
            >
              <IconTable v-if="table.type === 'table'" class="h-4 w-4 text-blue-500" />
              <IconEye v-else class="h-4 w-4 text-purple-500" />
              <span class="flex-1 truncate text-sm">{{ table.name }}</span>
              <span
                v-if="table.rowCount !== undefined"
                class="text-xs text-muted-foreground"
              >
                {{ table.rowCount }}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <!-- Table context menu -->
            <template v-if="table.type === 'table'">
              <ContextMenuItem @click="emit('open-table', table)">
                <IconTable class="h-4 w-4 mr-2" />
                Open Table
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem @click="emit('rename-table', table, activeDatabase)">
                <IconPencil class="h-4 w-4 mr-2" />
                Rename Table
              </ContextMenuItem>
              <ContextMenuItem @click="emit('drop-table', table, activeDatabase)">
                <IconTrash class="h-4 w-4 mr-2" />
                Drop Table
              </ContextMenuItem>
            </template>
            <!-- View context menu -->
            <template v-else>
              <ContextMenuItem @click="emit('open-view', table)">
                <IconEye class="h-4 w-4 mr-2" />
                Open View
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem @click="emit('edit-view', table, activeDatabase)">
                <IconPencil class="h-4 w-4 mr-2" />
                Edit View
              </ContextMenuItem>
              <ContextMenuItem @click="emit('drop-view', table, activeDatabase)">
                <IconTrash class="h-4 w-4 mr-2" />
                Drop View
              </ContextMenuItem>
            </template>
          </ContextMenuContent>
        </ContextMenu>

        <div
          v-if="tables.length === 0 && !loadingDatabases.has(database.name)"
          class="px-2 py-2 text-sm text-muted-foreground"
        >
          No tables found
        </div>
      </div>
    </template>

    <div
      v-if="databases.length === 0"
      class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
    >
      <IconDatabase class="h-8 w-8 mb-2 opacity-50" />
      <span class="text-sm">Connect to a database to browse tables</span>
    </div>
  </div>
</template>
