<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { SearchResultType, type SearchResult } from '@/types/search'
import {
  Dialog,
  DialogContent
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  IconSearch,
  IconTable,
  IconEye,
  IconCode,
  IconDatabase,
  IconBookmark,
  IconHistory,
  IconColumns
} from '@tabler/icons-vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { useRecentsStore } from '@/stores/recents'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', result: SearchResult): void
}>()

const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const recentsStore = useRecentsStore()

const searchQuery = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// Cache schema data
const schemaCache = ref<{
  tables: SearchResult[]
  columns: SearchResult[]
  savedQueries: SearchResult[]
  bookmarks: SearchResult[]
}>({
  tables: [],
  columns: [],
  savedQueries: [],
  bookmarks: []
})

const isLoading = ref(false)

async function loadSchemaData() {
  const connectionId = connectionsStore.activeConnectionId
  if (!connectionId) return

  isLoading.value = true

  try {
    const connection = connectionsStore.activeConnection
    const database = connectionsStore.activeDatabases[0]?.name || connection?.database || ''

    // Load tables and views
    const tables = await window.api.schema.tables(connectionId, database)
    const tableResults: SearchResult[] = []
    const columnResults: SearchResult[] = []

    for (const table of tables) {
      tableResults.push({
        id: `table-${table.name}`,
        type: table.type === 'view' ? SearchResultType.View : SearchResultType.Table,
        name: table.name,
        detail: `${table.type} - ${table.rowCount ?? '?'} rows`,
        connectionId,
        database
      })

      // Load columns for each table
      try {
        const columns = await window.api.schema.columns(connectionId, table.name)
        for (const col of columns) {
          columnResults.push({
            id: `col-${table.name}-${col.name}`,
            type: SearchResultType.Column,
            name: col.name,
            detail: `${table.name}.${col.name} (${col.type})`,
            connectionId,
            database,
            tableName: table.name
          })
        }
      } catch {
        // Ignore column loading errors
      }
    }

    // Load saved queries
    const savedQueries = await window.api.savedQueries.list(connectionId) as { id: number; name: string; sql?: string }[] | null
    const savedQueryResults: SearchResult[] = (savedQueries || []).map((q) => ({
      id: `query-${q.id}`,
      type: SearchResultType.SavedQuery,
      name: q.name,
      detail: q.sql?.substring(0, 80),
      connectionId,
      sql: q.sql
    }))

    // Load bookmarks
    const bookmarks = await window.api.bookmarks.list(connectionId) as { id: number; name: string; folder?: string; sql?: string }[] | null
    const bookmarkResults: SearchResult[] = (bookmarks || []).map((b) => ({
      id: `bookmark-${b.id}`,
      type: SearchResultType.Bookmark,
      name: b.name,
      detail: b.folder ? `${b.folder}/${b.name}` : b.name,
      connectionId,
      sql: b.sql
    }))

    schemaCache.value = {
      tables: tableResults,
      columns: columnResults,
      savedQueries: savedQueryResults,
      bookmarks: bookmarkResults
    }
  } catch (error) {
    console.error('Failed to load schema data for search:', error)
  } finally {
    isLoading.value = false
  }
}

const filteredResults = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) {
    // Show recents when no search query
    return recentsStore.items.slice(0, 10).map((item) => ({
      id: `recent-${item.id}`,
      type: SearchResultType.Recent,
      name: item.name,
      detail: item.type,
      connectionId: item.connectionId,
      sql: item.sql
    }))
  }

  const results: SearchResult[] = []

  // Search tables and views
  for (const table of schemaCache.value.tables) {
    if (table.name.toLowerCase().includes(query)) {
      results.push(table)
    }
  }

  // Search columns
  for (const column of schemaCache.value.columns) {
    if (column.name.toLowerCase().includes(query) || column.detail?.toLowerCase().includes(query)) {
      results.push(column)
    }
  }

  // Search saved queries
  for (const sq of schemaCache.value.savedQueries) {
    if (sq.name.toLowerCase().includes(query) || sq.sql?.toLowerCase().includes(query)) {
      results.push(sq)
    }
  }

  // Search bookmarks
  for (const bm of schemaCache.value.bookmarks) {
    if (bm.name.toLowerCase().includes(query) || bm.detail?.toLowerCase().includes(query)) {
      results.push(bm)
    }
  }

  return results.slice(0, 50) // Limit results
})

// Watch for dialog open
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      searchQuery.value = ''
      selectedIndex.value = 0
      await loadSchemaData()
      await nextTick()
      inputRef.value?.focus()
    }
  }
)

// Reset selection when results change
watch(filteredResults, () => {
  selectedIndex.value = 0
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredResults.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const result = filteredResults.value[selectedIndex.value]
    if (result) {
      handleSelect(result)
    }
  }
}

function handleSelect(result: SearchResult) {
  emit('select', result)
  emit('close')
}

function getIcon(type: SearchResultType) {
  switch (type) {
    case SearchResultType.Table: return IconTable
    case SearchResultType.View: return IconEye
    case SearchResultType.Query:
    case SearchResultType.SavedQuery: return IconCode
    case SearchResultType.Column: return IconColumns
    case SearchResultType.Bookmark: return IconBookmark
    case SearchResultType.Recent: return IconHistory
    default: return IconDatabase
  }
}

function getTypeLabel(type: SearchResultType): string {
  switch (type) {
    case SearchResultType.Table: return 'Table'
    case SearchResultType.View: return 'View'
    case SearchResultType.Query:
    case SearchResultType.SavedQuery: return 'Query'
    case SearchResultType.Column: return 'Column'
    case SearchResultType.Bookmark: return 'Bookmark'
    case SearchResultType.Recent: return 'Recent'
    default: return type
  }
}

</script>

<template>
  <Dialog :open="open" @update:open="emit('close')">
    <DialogContent class="max-w-2xl p-0 overflow-hidden">
      <!-- Search Input -->
      <div class="flex items-center gap-2 px-4 py-3 border-b">
        <IconSearch class="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Search tables, columns, queries..."
          class="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
          @keydown="handleKeyDown"
        />
        <kbd class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
      </div>

      <!-- Results -->
      <div class="max-h-[400px] overflow-auto p-2">
        <div v-if="isLoading" class="flex items-center justify-center py-8 text-muted-foreground text-sm">
          Loading...
        </div>

        <div v-else-if="filteredResults.length === 0" class="flex items-center justify-center py-8 text-muted-foreground text-sm">
          {{ searchQuery ? 'No results found' : 'Type to search...' }}
        </div>

        <template v-else>
          <div
            v-if="!searchQuery"
            class="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            Recent
          </div>

          <button
            v-for="(result, index) in filteredResults"
            :key="result.id"
            class="flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors"
            :class="index === selectedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'"
            @click="handleSelect(result)"
            @mouseenter="selectedIndex = index"
          >
            <component
              :is="getIcon(result.type)"
              class="h-4 w-4 shrink-0"
              :class="{
                'text-blue-500': result.type === SearchResultType.Table,
                'text-purple-500': result.type === SearchResultType.View,
                'text-green-500': result.type === SearchResultType.Query || result.type === SearchResultType.SavedQuery,
                'text-orange-500': result.type === SearchResultType.Column,
                'text-yellow-500': result.type === SearchResultType.Bookmark,
                'text-muted-foreground': result.type === SearchResultType.Recent
              }"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ result.name }}</div>
              <div v-if="result.detail" class="text-xs text-muted-foreground truncate">
                {{ result.detail }}
              </div>
            </div>
            <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {{ getTypeLabel(result.type) }}
            </span>
          </button>
        </template>
      </div>

      <!-- Footer -->
      <div class="flex items-center gap-4 px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <div class="flex items-center gap-1">
          <kbd class="bg-muted px-1 py-0.5 rounded">↑↓</kbd>
          <span>Navigate</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="bg-muted px-1 py-0.5 rounded">↵</kbd>
          <span>Open</span>
        </div>
        <div class="flex items-center gap-1">
          <kbd class="bg-muted px-1 py-0.5 rounded">ESC</kbd>
          <span>Close</span>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
