<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useTabsStore, type QueryTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useQuery } from '@/composables/useQuery'
import { IconPlayerPlay, IconLoader2, IconReportAnalytics, IconCode } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
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
  const fromList = connectionsStore.activeDatabases[0]?.name
  if (fromList) return fromList
  return connectionsStore.activeConnection?.database || ''
})

const sql = computed({
  get: () => tabData.value?.sql || '',
  set: (value) => tabsStore.setTabSql(props.tabId, value)
})

const result = computed(() => tabData.value?.result)
const queryPlan = computed(() => tabData.value?.queryPlan)
const isExecuting = computed(() => tabData.value?.isExecuting || false)
const dialect = computed(() => connectionsStore.activeConnection?.type || 'postgresql')
const showPlan = computed({
  get: () => tabData.value?.showPlan || false,
  set: (value) => tabsStore.setTabShowPlan(props.tabId, value)
})

async function handleExecute() {
  const query = sql.value.trim()
  if (!query) return
  // Hide plan view when executing
  showPlan.value = false
  await executeQuery(query, props.tabId)
}

async function handleExecuteSelected() {
  const selected = editorRef.value?.getSelectedText()
  const query = selected?.trim() || sql.value.trim()
  if (!query) return
  showPlan.value = false
  await executeQuery(query, props.tabId)
}

async function handleExplain(analyze = false) {
  const query = sql.value.trim()
  if (!query) return
  await explainQuery(query, props.tabId, analyze)
}

function handleFormat() {
  editorRef.value?.formatCode()
}

async function loadSchemaMetadata() {
  if (!connectionId.value) {
    schemaMetadata.value = undefined
    return
  }

  try {
    // Load tables with columns
    const tables = await window.api.schema.tables(connectionId.value, database.value)
    const tablesWithColumns: SchemaMetadata['tables'] = []

    for (const table of tables) {
      if (table.type === 'table') {
        const columns = await window.api.schema.columns(connectionId.value, table.name)
        tablesWithColumns.push({
          name: table.name,
          columns: columns.map(c => ({ name: c.name, type: c.type }))
        })
      }
    }

    // Get views
    const views = tables
      .filter(t => t.type === 'view')
      .map(v => ({ name: v.name }))

    // Get routines
    const routines = await window.api.schema.getRoutines(connectionId.value)
    const procedures = routines
      .filter(r => r.type === 'PROCEDURE')
      .map(r => ({ name: r.name }))
    const functions = routines
      .filter(r => r.type === 'FUNCTION')
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
})

watch(connectionId, () => {
  loadSchemaMetadata()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <Button
        size="sm"
        :disabled="isExecuting || !sql.trim()"
        @click="handleExecute"
      >
        <IconLoader2 v-if="isExecuting" class="h-4 w-4 mr-1 animate-spin" />
        <IconPlayerPlay v-else class="h-4 w-4 mr-1" />
        {{ isExecuting ? 'Running...' : 'Run' }}
      </Button>

      <div class="h-4 border-l mx-1" />

      <Button
        size="sm"
        variant="outline"
        :disabled="isExplaining || isExecuting || !sql.trim()"
        @click="handleExplain(false)"
      >
        <IconLoader2 v-if="isExplaining" class="h-4 w-4 mr-1 animate-spin" />
        <IconReportAnalytics v-else class="h-4 w-4 mr-1" />
        Explain
      </Button>

      <Button
        size="sm"
        variant="outline"
        :disabled="isExplaining || isExecuting || !sql.trim()"
        @click="handleExplain(true)"
        title="Run query and show actual execution statistics"
      >
        <IconLoader2 v-if="isExplaining" class="h-4 w-4 mr-1 animate-spin" />
        <IconReportAnalytics v-else class="h-4 w-4 mr-1" />
        Analyze
      </Button>

      <div class="h-4 border-l mx-1" />

      <Button
        size="sm"
        variant="outline"
        :disabled="!sql.trim()"
        @click="handleFormat"
        title="Format SQL (Shift+Alt+F)"
      >
        <IconCode class="h-4 w-4 mr-1" />
        Format
      </Button>

      <div class="flex-1" />

      <div v-if="queryPlan" class="flex items-center border rounded-md">
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-3 rounded-r-none"
          :class="{ 'bg-muted': !showPlan }"
          @click="showPlan = false"
        >
          Results
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="h-7 px-3 rounded-l-none"
          :class="{ 'bg-muted': showPlan }"
          @click="showPlan = true"
        >
          Plan
        </Button>
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
        />
      </Pane>

      <Pane :size="50" :min-size="20">
        <QueryResults
          v-if="!showPlan"
          :result="result"
          :is-executing="isExecuting"
        />
        <QueryPlanView
          v-else
          :plan="queryPlan"
        />
      </Pane>
    </Splitpanes>
  </div>
</template>
