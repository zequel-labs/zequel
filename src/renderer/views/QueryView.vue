<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { formatNumber } from '@/lib/utils'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useTabsStore, type QueryTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { useLayoutStore } from '@/stores/layout'
import { DatabaseType } from '@/types/connection'
import type { SqlDialect } from '@/lib/sql-formatter'
import { RoutineType } from '@/types/table'
import { useQuery } from '@/composables/useQuery'
import { toast } from 'vue-sonner'
import { IconChevronDown, IconLoader2 } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import SqlEditor, { type SchemaMetadata } from '@/components/editor/SqlEditor.vue'
import QueryResults from '@/components/editor/QueryResults.vue'
import ExportDialog, { type ExportDialogData } from '@/components/dialogs/ExportDialog.vue'
import { ExportMode } from '@/types/table'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const settingsStore = useSettingsStore()
const statusBarStore = useStatusBarStore()
const layoutStore = useLayoutStore()
const { executeQuery } = useQuery()

const editorRef = ref<InstanceType<typeof SqlEditor> | null>(null)
const schemaMetadata = ref<SchemaMetadata | undefined>(undefined)

// Export dialog state
const showExportDialog = ref(false)
const exportDialogData = ref<ExportDialogData | null>(null)

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as QueryTabData | undefined)
const connectionId = computed(() => tabData.value?.connectionId)
const database = computed(() => {
  if (!connectionsStore.activeSessionId) return ''
  return connectionsStore.getActiveDatabase(connectionsStore.activeSessionId)
})

const sql = computed({
  get: () => tabData.value?.sql || '',
  set: (value) => tabsStore.setTabSql(props.tabId, value)
})

const result = computed(() => tabData.value?.result)

const handleRowActivate = (row: Record<string, unknown>, rowIndex: number) => {
  layoutStore.setRightPanelRow(row, rowIndex)
}
const isExecuting = computed(() => tabData.value?.isExecuting || false)
const dialect = computed(() => (connectionsStore.activeConnection?.type || DatabaseType.PostgreSQL) as SqlDialect)

// Limit options
const limitOptions = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000]
const queryLimit = ref<number | null>(settingsStore.querySettings.defaultLimit)
const limitLabel = computed(() => {
  if (queryLimit.value === null) return 'No limit'
  return `Limit ${formatNumber(queryLimit.value)}`
})

// Persist limit preference
watch(queryLimit, (newLimit) => {
  settingsStore.updateQuerySettings({ defaultLimit: newLimit })
})

// Run mode: 'current' runs current statement, 'all' runs everything
type RunMode = 'current' | 'all'
const runMode = ref<RunMode>('current')
const runLabel = computed(() => runMode.value === 'all' ? 'Run All' : 'Run Current')

// Transaction state
const isManualCommit = ref(false)
const isTransactionActive = ref(false)
const supportsTransactions = ref(false)

const checkTransactionSupport = async () => {
  if (!connectionId.value) return
  try {
    const status = await window.api.transaction.status(connectionId.value)
    supportsTransactions.value = status.supportsTransactions
    isTransactionActive.value = status.inTransaction
  } catch {
    supportsTransactions.value = false
  }
}

const toggleCommitMode = async (mode: 'auto' | 'manual') => {
  if (mode === 'auto' && isTransactionActive.value) {
    try {
      await window.api.transaction.rollback(connectionId.value!)
      isTransactionActive.value = false
      toast.info('Transaction rolled back')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rollback transaction')
      return
    }
  }
  isManualCommit.value = mode === 'manual'
}

const handleBeginTransaction = async () => {
  if (!connectionId.value) return
  try {
    await window.api.transaction.begin(connectionId.value)
    isTransactionActive.value = true
    toast.info('Transaction started')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to begin transaction')
  }
}

const handleCommitTransaction = async () => {
  if (!connectionId.value) return
  try {
    await window.api.transaction.commit(connectionId.value)
    isTransactionActive.value = false
    toast.success('Transaction committed')
    window.dispatchEvent(new Event('zequel:refresh-data'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to commit')
  }
}

const handleRollbackTransaction = async () => {
  if (!connectionId.value) return
  try {
    await window.api.transaction.rollback(connectionId.value)
    isTransactionActive.value = false
    toast.info('Transaction rolled back')
    window.dispatchEvent(new Event('zequel:refresh-data'))
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Failed to rollback')
  }
}

const appendLimit = (query: string, limit: number | null): string => {
  if (limit === null) return query
  // Only append LIMIT to single SELECT queries
  if (!/^\s*select\b/i.test(query)) return query
  if (/\blimit\b/i.test(query)) return query
  // Strip trailing semicolons before appending
  const trimmed = query.replace(/;\s*$/, '')
  // Don't append to multi-statement queries (semicolons still remain after stripping trailing one)
  if (trimmed.includes(';')) return query
  return `${trimmed} LIMIT ${limit}`
}

const runQuery = async (rawSql: string) => {
  const query = rawSql.trim()
  if (!query) return
  await executeQuery(appendLimit(query, queryLimit.value), props.tabId, isTransactionActive.value || undefined)
}

const handleRunAll = () => runQuery(sql.value)

const handleRunCurrent = () => {
  const selected = editorRef.value?.getSelectedText()
  runQuery(selected?.trim() || sql.value)
}

const handleRunDefault = () => runMode.value === 'all' ? handleRunAll() : handleRunCurrent()

// SqlEditor emits these
const handleExecute = handleRunCurrent
const handleExecuteSelected = handleRunAll

const handleSaveSqlAs = async () => {
  const query = sql.value.trim()
  if (!query) return
  try {
    const result = await window.api.app.showSaveDialog({
      title: 'Save SQL File',
      defaultPath: 'query.sql',
      filters: [
        { name: 'SQL Files', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePath) {
      await window.api.app.writeFile(result.filePath, query)
      if (tabData.value) tabData.value.isDirty = false
      toast.success('SQL file saved')
    }
  } catch (error) {
    toast.error('Failed to save SQL file')
    console.error('Failed to save SQL file:', error)
  }
}

const handleExportData = () => {
  if (!result.value || !result.value.columns || !result.value.rows) return
  exportDialogData.value = {
    title: 'Export query results',
    tableName: 'query_results',
    mode: ExportMode.InMemory,
    columns: result.value.columns.map(c => ({ name: c.name, type: c.type })),
    rows: result.value.rows
  }
  showExportDialog.value = true
}

const handleFormat = () => {
  editorRef.value?.formatCode()
}

const handleSaveQuery = async () => {
  // Only save if this tab is the active tab and has SQL content
  if (tabsStore.activeTabId !== props.tabId) return
  const query = sql.value.trim()
  if (!query || !connectionId.value) return

  const name = tab.value?.title || 'Untitled Query'
  const savedConnectionId = connectionId.value ? (connectionsStore.getSavedConnectionId(connectionId.value) ?? connectionId.value) : undefined
  try {
    if (tabData.value?.savedQueryId) {
      await window.api.savedQueries.update(tabData.value.savedQueryId, { sql: query })
    } else {
      const saved = await window.api.savedQueries.save(name, query, savedConnectionId)
      if (tabData.value && saved?.id) tabData.value.savedQueryId = saved.id
    }
    if (tabData.value) tabData.value.isDirty = false
    window.dispatchEvent(new Event('zequel:saved-queries-changed'))
    toast.success('Query saved')
  } catch (error) {
    toast.error('Failed to save query')
    console.error('Failed to save query:', error)
  }
}

const handleGlobalFormatSql = () => {
  // Only respond if this tab is active
  if (tabsStore.activeTabId !== props.tabId) return
  handleFormat()
}

const handleGlobalCommitChanges = () => {
  handleSaveQuery()
}

const handleGlobalSaveSqlAs = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  handleSaveSqlAs()
}

const isPostgreSQL = computed(() => {
  if (!connectionId.value) return false
  const conn = connectionsStore.getConnectionForSession(connectionId.value)
  return conn?.type === DatabaseType.PostgreSQL
})

let schemaLoadId = 0

const loadSchemaMetadata = async () => {
  const currentLoadId = ++schemaLoadId
  if (!connectionId.value) {
    schemaMetadata.value = undefined
    return
  }

  try {
    // Load tables and views from the active schema
    const tables = await window.api.schema.tables(connectionId.value, database.value)

    // Abort if a newer load was triggered while we were waiting
    if (currentLoadId !== schemaLoadId) return

    // Fetch columns for all tables and views in parallel
    const tableEntries = tables.filter(t => t.type === 'table')
    const viewEntries = tables.filter(t => t.type === 'view')

    const columnPromises = tableEntries.map(t =>
      window.api.schema.columns(connectionId.value!, t.name)
        .then(cols => ({ entry: t, cols }))
        .catch(() => ({ entry: t, cols: [] as Array<{ name: string; type: string }> }))
    )

    const viewColumnPromises = viewEntries.map(v =>
      window.api.schema.columns(connectionId.value!, v.name)
        .then(cols => ({ entry: v, cols }))
        .catch(() => ({ entry: v, cols: [] as Array<{ name: string; type: string }> }))
    )

    const [tableResults, viewResults, routines] = await Promise.all([
      Promise.all(columnPromises),
      Promise.all(viewColumnPromises),
      window.api.schema.getRoutines(connectionId.value)
        .catch(() => [] as Array<{ name: string; type: RoutineType }>)
    ])

    // Abort if a newer load was triggered while we were waiting
    if (currentLoadId !== schemaLoadId) return

    const tablesWithColumns: SchemaMetadata['tables'] = tableResults.map(({ entry, cols }) => ({
      name: entry.name,
      schema: entry.schema,
      columns: cols.map(c => ({ name: c.name, type: c.type }))
    }))

    // For PostgreSQL, also load table names from other schemas (without columns)
    if (isPostgreSQL.value) {
      const allSchemas = connectionsStore.schemas.get(connectionId.value) || []
      const activeSchema = connectionsStore.getActiveSchema(connectionId.value)
      const otherSchemas = allSchemas.filter(s => s.name !== activeSchema && !s.isSystem)

      const otherSchemaResults = await Promise.allSettled(
        otherSchemas.map(s =>
          window.api.schema.tables(connectionId.value!, database.value, s.name)
            .then(schemaTables => ({ schemaName: s.name, tables: schemaTables }))
        )
      )

      for (const result of otherSchemaResults) {
        if (result.status === 'fulfilled') {
          for (const table of result.value.tables) {
            if (table.type === 'table') {
              tablesWithColumns.push({
                name: table.name,
                schema: result.value.schemaName,
                columns: []
              })
            }
          }
        }
      }
    }

    // Build views with columns
    const views = viewResults.map(({ entry, cols }) => ({
      name: entry.name,
      schema: entry.schema,
      columns: cols.map(c => ({ name: c.name, type: c.type }))
    }))

    const procedures = routines
      .filter(r => r.type === RoutineType.Procedure)
      .map(r => ({ name: r.name }))
    const functions = routines
      .filter(r => r.type === RoutineType.Function)
      .map(r => ({ name: r.name }))

    schemaMetadata.value = {
      tables: tablesWithColumns,
      views,
      procedures,
      functions
    }
  } catch (error) {
    console.error('Failed to load schema metadata for autocomplete:', error)
    schemaMetadata.value = undefined
  }
}

const syncRightPanelColumns = () => {
  if (result.value?.columns) {
    layoutStore.setRightPanelColumns(result.value.columns, () => { })
  }
}

const setupStatusBar = () => {
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showGridControls = true
  statusBarStore.registerCallbacks({
    onExportData: handleExportData
  })
}

onMounted(() => {
  loadSchemaMetadata()
  checkTransactionSupport()
  setupStatusBar()
  window.addEventListener('zequel:format-sql', handleGlobalFormatSql)
  window.addEventListener('zequel:commit-changes', handleGlobalCommitChanges)
  window.addEventListener('zequel:save-sql-as', handleGlobalSaveSqlAs)
})

onUnmounted(async () => {
  if (isTransactionActive.value && connectionId.value) {
    try {
      await window.api.transaction.rollback(connectionId.value)
    } catch { /* ignore */ }
    isTransactionActive.value = false
  }
  statusBarStore.clear(props.tabId)
  window.removeEventListener('zequel:format-sql', handleGlobalFormatSql)
  window.removeEventListener('zequel:commit-changes', handleGlobalCommitChanges)
  window.removeEventListener('zequel:save-sql-as', handleGlobalSaveSqlAs)
})

watch(connectionId, () => {
  loadSchemaMetadata()
  checkTransactionSupport()
})

watch(result, () => {
  if (tabsStore.activeTabId === props.tabId) {
    syncRightPanelColumns()
  }
})

watch(() => tabsStore.activeTabId, (newId) => {
  if (newId === props.tabId) {
    syncRightPanelColumns()
  }
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Editor and Results -->
    <Splitpanes class="flex-1" horizontal>
      <Pane :size="50" :min-size="20">
        <SqlEditor ref="editorRef" v-model="sql" :schema="schemaMetadata" :dialect="dialect" @execute="handleExecute"
          @execute-selected="handleExecuteSelected" />
      </Pane>

      <Pane :size="50" :min-size="20">
        <div class="flex flex-col h-full">
          <!-- Action bar -->
          <div class="flex items-center justify-between gap-2 px-3 py-1 border-b border-border bg-muted/30">
            <!-- Left: Transaction controls -->
            <div v-if="supportsTransactions && !settingsStore.safeMode" class="flex items-center gap-2">
              <!-- Auto/Manual toggle (hidden when transaction active) -->
              <div v-if="!isTransactionActive" class="inline-flex items-center rounded-md border bg-muted p-0.5">
                <button @click="toggleCommitMode('auto')"
                  :class="!isManualCommit ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all">
                  Auto
                </button>
                <button @click="toggleCommitMode('manual')"
                  :class="isManualCommit ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2.5 py-0.5 text-xs font-medium transition-all">
                  Manual
                </button>
              </div>

              <!-- Transaction active indicator (replaces toggle) -->
              <div v-if="isTransactionActive"
                class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                       text-amber-600 dark:text-amber-400 bg-amber-500/10 shadow-[0_0_6px_0_rgba(245,158,11,0.4)] animate-pulse">
                Transaction active
              </div>

              <!-- Begin / Commit / Rollback buttons -->
              <template v-if="isManualCommit || isTransactionActive">
                <Button v-if="!isTransactionActive" variant="outline" @click="handleBeginTransaction">
                  Begin
                </Button>
                <Button variant="outline" :disabled="!isTransactionActive" @click="handleRollbackTransaction">
                  Rollback
                </Button>
                <Button variant="default" :disabled="!isTransactionActive" @click="handleCommitTransaction">
                  Commit
                </Button>
              </template>
            </div>
            <div v-else />

            <!-- Right: existing controls (Limit, Beautify, Run) -->
            <div class="flex items-center gap-2">
              <!-- Limit selector -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="inline-flex items-center rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <span class="px-3 py-1">{{ limitLabel }}</span>
                    <span class="border-l border-border px-1.5 py-1">
                      <IconChevronDown class="h-3 w-3" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  <DropdownMenuItem @click="queryLimit = null">
                    No limit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem v-for="opt in limitOptions" :key="opt" @click="queryLimit = opt">
                    {{ formatNumber(opt) }} rows
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <!-- Beautify button -->
              <button data-testid="query-format-btn"
                class="inline-flex items-center rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                :disabled="!sql.trim()" @click="handleFormat">
                Beautify <kbd class="ml-1 text-[10px] opacity-70">&#x2318;I</kbd>
              </button>

              <!-- Run button (split button) -->
              <div class="inline-flex items-center rounded-md border border-border text-xs text-muted-foreground">
                <button data-testid="query-run-btn"
                  class="inline-flex items-center px-3 py-1 hover:text-foreground hover:bg-accent transition-colors rounded-l-md"
                  :disabled="isExecuting || !sql.trim()" @click="handleRunDefault">
                  <IconLoader2 v-if="isExecuting" class="inline h-3 w-3 mr-1 animate-spin" />
                  <template v-if="isExecuting">Running...</template>
                  <template v-else>
                    {{ runLabel }}
                    <kbd class="ml-1 text-[10px] opacity-70">{{ runMode === 'all' ? '&#x21E7;&#x2318;&#x21B5;' :
                      '&#x2318;&#x21B5;' }}</kbd>
                  </template>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      class="inline-flex items-center border-l border-border px-1.5 py-1 hover:text-foreground hover:bg-accent transition-colors rounded-r-md">
                      <IconChevronDown class="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="handleRunAll">
                      Run All
                      <DropdownMenuShortcut>&#x21E7;&#x2318;&#x21B5;</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleRunCurrent">
                      Run Current
                      <DropdownMenuShortcut>&#x2318;&#x21B5;</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem @click="handleSaveQuery">
                      Add to Queries
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleSaveSqlAs">
                      Save SQL as...
                      <DropdownMenuShortcut>&#x21E7;&#x2318;S</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Default</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem @click="runMode = 'all'">
                          <span :class="{ 'opacity-0': runMode !== 'all' }" class="mr-1.5">&#x2713;</span>
                          Run All
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="runMode = 'current'">
                          <span :class="{ 'opacity-0': runMode !== 'current' }" class="mr-1.5">&#x2713;</span>
                          Run Current
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <QueryResults class="flex-1 min-h-0" data-testid="query-results" :result="result" :is-executing="isExecuting"
            @row-activate="handleRowActivate" />
        </div>
      </Pane>
    </Splitpanes>

    <!-- Export Dialog -->
    <ExportDialog :open="showExportDialog" :data="exportDialogData" @update:open="showExportDialog = $event" />
  </div>
</template>