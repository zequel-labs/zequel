<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useTabsStore, type QueryTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { RoutineType } from '@/types/table'
import { useQuery } from '@/composables/useQuery'
import { toast } from 'vue-sonner'
import { IconPlayerPlay, IconLoader2, IconReportAnalytics, IconCode } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import SqlEditor, { type SchemaMetadata } from '@/components/editor/SqlEditor.vue'
import QueryResults from '@/components/editor/QueryResults.vue'
import QueryPlanView from '@/components/editor/QueryPlanView.vue'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const { executeQuery, explainQuery, isExplaining } = useQuery()

const editorRef = ref<InstanceType<typeof SqlEditor> | null>(null)
const schemaMetadata = ref<SchemaMetadata | undefined>(undefined)

const tab = computed(() => tabsStore.tabs.find((t) => t.id === props.tabId))
const tabData = computed(() => tab.value?.data as QueryTabData | undefined)
const connectionId = computed(() => tabData.value?.connectionId)
const database = computed(() => {
  if (!connectionsStore.activeConnectionId) return ''
  return connectionsStore.getActiveDatabase(connectionsStore.activeConnectionId)
})

const sql = computed({
  get: () => tabData.value?.sql || '',
  set: (value) => tabsStore.setTabSql(props.tabId, value)
})

const result = computed(() => tabData.value?.result)
const results = computed(() => tabData.value?.results)
const activeResultIndex = computed(() => tabData.value?.activeResultIndex ?? 0)
const totalExecutionTime = computed(() => {
  if (tabData.value?.results && tabData.value.results.length > 1) {
    return tabData.value.results.reduce((sum, r) => sum + (r.executionTime || 0), 0)
  }
  return undefined
})

const handleActiveResultIndexChange = (index: number) => {
  tabsStore.setTabActiveResultIndex(props.tabId, index)
}
const queryPlan = computed(() => tabData.value?.queryPlan)
const isExecuting = computed(() => tabData.value?.isExecuting || false)
const dialect = computed(() => connectionsStore.activeConnection?.type || DatabaseType.PostgreSQL)
const showPlan = computed({
  get: () => tabData.value?.showPlan || false,
  set: (value) => tabsStore.setTabShowPlan(props.tabId, value)
})

// Determine if the current db type supports EXPLAIN
const supportsExplain = computed(() => {
  const dbType = connectionsStore.activeConnection?.type
  return dbType === DatabaseType.PostgreSQL || dbType === DatabaseType.MySQL || dbType === DatabaseType.MariaDB || dbType === DatabaseType.SQLite || dbType === DatabaseType.ClickHouse
})

const handleExecute = async () => {
  const query = sql.value.trim()
  if (!query) return
  // Hide plan view when executing
  showPlan.value = false
  await executeQuery(query, props.tabId)
}

const handleExecuteSelected = async () => {
  const selected = editorRef.value?.getSelectedText()
  const query = selected?.trim() || sql.value.trim()
  if (!query) return
  showPlan.value = false
  await executeQuery(query, props.tabId)
}

const handleExplain = async (analyze = false) => {
  const query = sql.value.trim()
  if (!query) return
  await explainQuery(query, props.tabId, analyze)
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
  try {
    await window.api.savedQueries.save(name, query, connectionId.value)
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

const handleGlobalSaveQuery = () => {
  handleSaveQuery()
}

const isPostgreSQL = computed(() => {
  const conn = connectionsStore.connections.find(c => c.id === connectionId.value)
  return conn?.type === DatabaseType.PostgreSQL
})

const loadSchemaMetadata = async () => {
  if (!connectionId.value) {
    schemaMetadata.value = undefined
    return
  }

  try {
    // Load tables with columns from the active schema
    const tables = await window.api.schema.tables(connectionId.value, database.value)
    const tablesWithColumns: SchemaMetadata['tables'] = []

    for (const table of tables) {
      if (table.type === 'table') {
        const columns = await window.api.schema.columns(connectionId.value, table.name)
        tablesWithColumns.push({
          name: table.name,
          schema: table.schema,
          columns: columns.map(c => ({ name: c.name, type: c.type }))
        })
      }
    }

    // For PostgreSQL, also load table names from other schemas (without columns)
    if (isPostgreSQL.value) {
      const allSchemas = connectionsStore.schemas.get(connectionId.value) || []
      const activeSchema = connectionsStore.getActiveSchema(connectionId.value)
      for (const s of allSchemas) {
        if (s.name === activeSchema || s.isSystem) continue
        try {
          const otherTables = await window.api.schema.tables(connectionId.value, database.value, s.name)
          for (const table of otherTables) {
            if (table.type === 'table') {
              tablesWithColumns.push({
                name: table.name,
                schema: s.name,
                columns: []
              })
            }
          }
        } catch {
          // Non-critical, skip schema
        }
      }
    }

    // Get views
    const views = tables
      .filter(t => t.type === 'view')
      .map(v => ({ name: v.name, schema: v.schema }))

    // Get routines
    const routines = await window.api.schema.getRoutines(connectionId.value)
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

onMounted(() => {
  loadSchemaMetadata()
  window.addEventListener('zequel:format-sql', handleGlobalFormatSql)
  window.addEventListener('zequel:save-query', handleGlobalSaveQuery)
})

onUnmounted(() => {
  window.removeEventListener('zequel:format-sql', handleGlobalFormatSql)
  window.removeEventListener('zequel:save-query', handleGlobalSaveQuery)
})

watch(connectionId, () => {
  loadSchemaMetadata()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <TooltipProvider :delay-duration="300">
        <!-- Run button -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              :disabled="isExecuting || !sql.trim()"
              @click="handleExecute"
            >
              <IconLoader2 v-if="isExecuting" class="h-4 w-4 mr-1 animate-spin" />
              <IconPlayerPlay v-else class="h-4 w-4 mr-1" />
              {{ isExecuting ? 'Running...' : 'Run' }}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Execute query</span>
            <kbd class="ml-1.5 text-xs bg-primary-foreground/20 px-1 py-0.5 rounded">Ctrl+Enter</kbd>
          </TooltipContent>
        </Tooltip>

        <div class="h-4 border-l mx-1" />

        <!-- Explain button -->
        <Tooltip v-if="supportsExplain">
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              :disabled="isExplaining || isExecuting || !sql.trim()"
              @click="handleExplain(false)"
            >
              <IconLoader2 v-if="isExplaining" class="h-4 w-4 mr-1 animate-spin" />
              <IconReportAnalytics v-else class="h-4 w-4 mr-1" />
              Explain
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Show query execution plan</span>
            <kbd class="ml-1.5 text-xs bg-primary-foreground/20 px-1 py-0.5 rounded">Ctrl+Shift+E</kbd>
          </TooltipContent>
        </Tooltip>

        <!-- Analyze button -->
        <Tooltip v-if="supportsExplain">
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              :disabled="isExplaining || isExecuting || !sql.trim()"
              @click="handleExplain(true)"
            >
              <IconLoader2 v-if="isExplaining" class="h-4 w-4 mr-1 animate-spin" />
              <IconReportAnalytics v-else class="h-4 w-4 mr-1" />
              Analyze
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Run query and show actual execution statistics</span>
          </TooltipContent>
        </Tooltip>

        <div class="h-4 border-l mx-1" />

        <!-- Format button -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              :disabled="!sql.trim()"
              @click="handleFormat"
            >
              <IconCode class="h-4 w-4 mr-1" />
              Format
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <span>Format SQL</span>
            <kbd class="ml-1.5 text-xs bg-primary-foreground/20 px-1 py-0.5 rounded">Shift+Alt+F</kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div class="flex-1" />

      <!-- Results / Plan toggle -->
      <div v-if="queryPlan" class="flex items-center bg-muted rounded-md p-0.5">
        <button
          class="h-7 px-3 text-sm rounded-sm transition-colors"
          :class="!showPlan ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
          @click="showPlan = false"
        >
          Results
        </button>
        <button
          class="h-7 px-3 text-sm rounded-sm transition-colors"
          :class="showPlan ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
          @click="showPlan = true"
        >
          Plan
        </button>
      </div>

      <span class="text-xs text-muted-foreground ml-2">
        Ctrl+Enter to run
      </span>
    </div>

    <!-- Editor and Results -->
    <Splitpanes class="flex-1" horizontal>
      <Pane :size="50" :min-size="20">
        <SqlEditor
          ref="editorRef"
          v-model="sql"
          :schema="schemaMetadata"
          :dialect="dialect"
          @execute="handleExecute"
          @execute-selected="handleExecuteSelected"
          @explain="handleExplain(false)"
        />
      </Pane>

      <Pane :size="50" :min-size="20">
        <QueryResults
          v-if="!showPlan"
          :result="result"
          :results="results"
          :active-result-index="activeResultIndex"
          :is-executing="isExecuting"
          :total-execution-time="totalExecutionTime"
          @update:active-result-index="handleActiveResultIndexChange"
        />
        <QueryPlanView
          v-else
          :plan="queryPlan"
          :db-type="dialect"
        />
      </Pane>
    </Splitpanes>
  </div>
</template>
