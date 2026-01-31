<script setup lang="ts">
import { computed, ref } from 'vue'
import type { QueryPlan } from '@/stores/tabs'
import { DatabaseType } from '@/types/connection'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  IconBinaryTree,
  IconTable,
  IconCode,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconCircleCheck
} from '@tabler/icons-vue'

const props = defineProps<{
  plan: QueryPlan | undefined
  dbType: DatabaseType
}>()

const copied = ref(false)
const viewMode = ref<'tree' | 'table' | 'raw'>('tree')

const hasData = computed(() => {
  return props.plan && (props.plan.planText || props.plan.rows.length > 0)
})

const copyPlan = async () => {
  if (!props.plan?.planText) return
  try {
    await navigator.clipboard.writeText(props.plan.planText)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// --- PostgreSQL JSON plan parsing ---

interface PgPlanNode {
  'Node Type': string
  'Relation Name'?: string
  'Alias'?: string
  'Filter'?: string
  'Index Name'?: string
  'Index Cond'?: string
  'Hash Cond'?: string
  'Join Type'?: string
  'Sort Key'?: string[]
  'Group Key'?: string[]
  'Output'?: string[]
  'Startup Cost': number
  'Total Cost': number
  'Plan Rows': number
  'Plan Width': number
  'Actual Startup Time'?: number
  'Actual Total Time'?: number
  'Actual Rows'?: number
  'Actual Loops'?: number
  'Shared Hit Blocks'?: number
  'Shared Read Blocks'?: number
  'Shared Written Blocks'?: number
  Plans?: PgPlanNode[]
  [key: string]: unknown
}

const parsedPgPlan = computed<PgPlanNode | null>(() => {
  if (props.dbType !== DatabaseType.PostgreSQL || !props.plan?.planText) return null
  try {
    const parsed = JSON.parse(props.plan.planText)
    const plan = Array.isArray(parsed) ? parsed[0] : parsed
    return plan?.Plan || null
  } catch {
    return null
  }
})

const pgHasTreeView = computed(() => parsedPgPlan.value !== null)

// PostgreSQL top-level metrics from root node
const pgRootMetrics = computed(() => {
  if (!parsedPgPlan.value) return null
  const root = parsedPgPlan.value
  return {
    nodeType: root['Node Type'],
    totalCost: root['Total Cost'],
    startupCost: root['Startup Cost'],
    planRows: root['Plan Rows'],
    planWidth: root['Plan Width'],
    actualTime: root['Actual Total Time'],
    actualRows: root['Actual Rows'],
    actualLoops: root['Actual Loops'],
    sharedHit: root['Shared Hit Blocks'],
    sharedRead: root['Shared Read Blocks']
  }
})

// Compute the max cost in the plan tree for relative cost highlighting
const getMaxCost = (node: PgPlanNode): number => {
  let max = node['Total Cost'] || 0
  if (node.Plans) {
    for (const child of node.Plans) {
      const childMax = getMaxCost(child)
      if (childMax > max) max = childMax
    }
  }
  return max
}

const pgMaxCost = computed(() => {
  if (!parsedPgPlan.value) return 1
  return getMaxCost(parsedPgPlan.value) || 1
})

// --- MySQL / MariaDB plan parsing ---

interface MySqlRow {
  [key: string]: unknown
  id?: number
  select_type?: string
  table?: string
  type?: string
  possible_keys?: string
  key?: string
  key_len?: string
  ref?: string
  rows?: number
  filtered?: number
  Extra?: string
}

const mysqlRows = computed<MySqlRow[]>(() => {
  if ((props.dbType !== DatabaseType.MySQL && props.dbType !== DatabaseType.MariaDB) || !props.plan) return []
  return props.plan.rows as MySqlRow[]
})

const getMySqlTypeClass = (accessType: string | undefined): string => {
  if (!accessType) return ''
  const t = accessType.toUpperCase()
  // ALL = full table scan (bad), index = full index scan (not great)
  if (t === 'ALL') return 'text-red-500 font-semibold'
  if (t === 'INDEX') return 'text-amber-500 font-medium'
  // ref, eq_ref, const, system = good
  if (['EQ_REF', 'CONST', 'SYSTEM'].includes(t)) return 'text-green-500 font-medium'
  if (t === 'REF' || t === 'REF_OR_NULL') return 'text-green-600'
  if (t === 'RANGE') return 'text-blue-500'
  return ''
}

const getMySqlExtraClass = (extra: string | undefined): string => {
  if (!extra) return ''
  if (extra.includes('Using filesort') || extra.includes('Using temporary')) {
    return 'text-amber-500'
  }
  if (extra.includes('Using index')) {
    return 'text-green-500'
  }
  return ''
}

// --- SQLite EXPLAIN QUERY PLAN parsing ---

interface SqlitePlanRow {
  id?: number | string
  parent?: number | string
  notused?: number | string
  detail?: string
  selectid?: number | string
  order?: number | string
  from?: number | string
  [key: string]: unknown
}

const sqliteRows = computed<SqlitePlanRow[]>(() => {
  if (props.dbType !== DatabaseType.SQLite || !props.plan) return []
  return props.plan.rows as SqlitePlanRow[]
})

// Build a tree structure from SQLite plan rows
interface SqliteTreeNode {
  id: string | number
  detail: string
  children: SqliteTreeNode[]
}

const sqliteTree = computed<SqliteTreeNode[]>(() => {
  if (!sqliteRows.value.length) return []

  const rows = sqliteRows.value
  const nodeMap = new Map<string | number, SqliteTreeNode>()
  const roots: SqliteTreeNode[] = []

  for (const row of rows) {
    const id = row.id ?? row.selectid ?? 0
    const parent = row.parent ?? -1
    const detail = row.detail ?? ''

    const node: SqliteTreeNode = { id, detail: String(detail), children: [] }
    nodeMap.set(id, node)

    const parentNode = nodeMap.get(parent)
    if (parentNode) {
      parentNode.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
})

// Determine the default view mode based on dbType
const defaultViewMode = computed(() => {
  switch (props.dbType) {
    case DatabaseType.PostgreSQL:
      return pgHasTreeView.value ? 'tree' : 'raw'
    case DatabaseType.MySQL:
    case DatabaseType.MariaDB:
      return 'table'
    case DatabaseType.SQLite:
      return 'tree'
    default:
      return 'raw'
  }
})

// Initialize view mode to the best default
const initialized = ref(false)
if (!initialized.value) {
  viewMode.value = defaultViewMode.value
  initialized.value = true
}

const supportsTreeView = computed(() => {
  return (props.dbType === DatabaseType.PostgreSQL && pgHasTreeView.value) || props.dbType === DatabaseType.SQLite
})

const supportsTableView = computed(() => {
  return props.dbType === DatabaseType.MySQL || props.dbType === DatabaseType.MariaDB || (props.plan && props.plan.rows.length > 0)
})
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
      <div class="flex items-center gap-2">
        <IconBinaryTree class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">Query Execution Plan</span>
        <Badge v-if="dbType" variant="outline" class="text-xs">
          {{ dbType }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <!-- View mode toggle -->
        <TooltipProvider :delay-duration="300">
          <div class="flex items-center bg-muted rounded-md p-0.5">
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="h-7 px-2 text-sm rounded-sm transition-colors flex items-center"
                  :class="viewMode === 'raw' ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
                  @click="viewMode = 'raw'"
                >
                  <IconCode class="h-3.5 w-3.5 mr-1" />
                  Raw
                </button>
              </TooltipTrigger>
              <TooltipContent>Raw plan output</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="h-7 px-2 text-sm rounded-sm transition-colors flex items-center disabled:opacity-50 disabled:pointer-events-none"
                  :class="viewMode === 'table' ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
                  :disabled="!supportsTableView"
                  @click="viewMode = 'table'"
                >
                  <IconTable class="h-3.5 w-3.5 mr-1" />
                  Table
                </button>
              </TooltipTrigger>
              <TooltipContent>Tabular view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  class="h-7 px-2 text-sm rounded-sm transition-colors flex items-center disabled:opacity-50 disabled:pointer-events-none"
                  :class="viewMode === 'tree' ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'"
                  :disabled="!supportsTreeView"
                  @click="viewMode = 'tree'"
                >
                  <IconBinaryTree class="h-3.5 w-3.5 mr-1" />
                  Tree
                </button>
              </TooltipTrigger>
              <TooltipContent>Tree visualization</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        <!-- Copy button -->
        <Button
          variant="outline"
          size="sm"
          class="h-7"
          :disabled="!plan?.planText"
          @click="copyPlan"
        >
          <component :is="copied ? IconCheck : IconCopy" class="h-3.5 w-3.5 mr-1" />
          {{ copied ? 'Copied' : 'Copy' }}
        </Button>
      </div>
    </div>

    <!-- Top-level metrics (PostgreSQL JSON plan) -->
    <div v-if="pgRootMetrics" class="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/10">
      <Badge variant="outline">
        {{ pgRootMetrics.nodeType }}
      </Badge>
      <Badge v-if="pgRootMetrics.totalCost != null" variant="secondary">
        Cost: {{ pgRootMetrics.startupCost?.toFixed(2) }}..{{ pgRootMetrics.totalCost?.toFixed(2) }}
      </Badge>
      <Badge v-if="pgRootMetrics.planRows != null" variant="secondary">
        Est. Rows: {{ pgRootMetrics.planRows }}
      </Badge>
      <Badge v-if="pgRootMetrics.actualRows != null" variant="default">
        Actual Rows: {{ pgRootMetrics.actualRows }}
      </Badge>
      <Badge v-if="pgRootMetrics.actualTime != null" variant="default">
        Time: {{ pgRootMetrics.actualTime?.toFixed(3) }}ms
      </Badge>
      <Badge v-if="pgRootMetrics.actualLoops != null" variant="secondary">
        Loops: {{ pgRootMetrics.actualLoops }}
      </Badge>
      <Badge v-if="pgRootMetrics.sharedHit" variant="outline">
        Buffer Hits: {{ pgRootMetrics.sharedHit }}
      </Badge>
      <Badge v-if="pgRootMetrics.sharedRead" variant="outline">
        Buffer Reads: {{ pgRootMetrics.sharedRead }}
      </Badge>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-hidden">
      <!-- No plan data -->
      <div v-if="!hasData" class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <IconBinaryTree class="h-12 w-12 opacity-50" />
        <span>No execution plan available</span>
        <span class="text-sm opacity-75">Click "Explain" to analyze a query</span>
      </div>

      <!-- === RAW VIEW === -->
      <ScrollArea v-else-if="viewMode === 'raw'" class="h-full">
        <pre class="p-4 text-sm font-mono whitespace-pre-wrap leading-relaxed">{{ plan?.planText }}</pre>
      </ScrollArea>

      <!-- === TABLE VIEW === -->
      <ScrollArea v-else-if="viewMode === 'table'" class="h-full">
        <div class="p-4">
          <!-- MySQL / MariaDB specific table with highlighting -->
          <template v-if="(dbType === DatabaseType.MySQL || dbType === DatabaseType.MariaDB) && mysqlRows.length > 0">
            <div class="rounded-md border overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-muted/50">
                  <tr>
                    <th
                      v-for="col in plan!.columns"
                      :key="col"
                      class="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide"
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in mysqlRows"
                    :key="idx"
                    class="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td
                      v-for="col in plan!.columns"
                      :key="col"
                      class="px-3 py-2 font-mono text-xs"
                      :class="{
                        [getMySqlTypeClass(String(row[col] ?? ''))]: col === 'type',
                        [getMySqlExtraClass(String(row[col] ?? ''))]: col === 'Extra' || col === 'extra',
                        'font-semibold': col === 'rows'
                      }"
                    >
                      <template v-if="col === 'type'">
                        <span class="flex items-center gap-1">
                          <IconAlertTriangle
                            v-if="String(row[col] ?? '').toUpperCase() === 'ALL'"
                            class="h-3 w-3 text-red-500"
                          />
                          <IconCircleCheck
                            v-else-if="['EQ_REF', 'CONST', 'SYSTEM'].includes(String(row[col] ?? '').toUpperCase())"
                            class="h-3 w-3 text-green-500"
                          />
                          {{ row[col] }}
                        </span>
                      </template>
                      <template v-else>
                        {{ typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col] }}
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- Legend -->
            <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-red-500" />
                ALL (full table scan)
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-amber-500" />
                INDEX (full index scan)
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-blue-500" />
                RANGE
              </span>
              <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-green-500" />
                REF / EQ_REF / CONST
              </span>
            </div>
          </template>

          <!-- Generic table view for other database types -->
          <template v-else-if="plan && plan.rows.length > 0">
            <div class="rounded-md border overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-muted/50">
                  <tr>
                    <th
                      v-for="col in plan.columns"
                      :key="col"
                      class="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide"
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in plan.rows"
                    :key="idx"
                    class="border-t hover:bg-muted/30 transition-colors"
                  >
                    <td
                      v-for="col in plan.columns"
                      :key="col"
                      class="px-3 py-2 font-mono text-xs"
                    >
                      {{ typeof row[col] === 'object' ? JSON.stringify(row[col]) : row[col] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </ScrollArea>

      <!-- === TREE VIEW === -->
      <ScrollArea v-else-if="viewMode === 'tree'" class="h-full">
        <div class="p-4">
          <!-- PostgreSQL Tree View -->
          <template v-if="dbType === DatabaseType.PostgreSQL && parsedPgPlan">
            <PgPlanTreeNode :node="parsedPgPlan" :depth="0" :max-cost="pgMaxCost" />
          </template>

          <!-- SQLite Tree View -->
          <template v-else-if="dbType === DatabaseType.SQLite && sqliteTree.length > 0">
            <SqliteTreeNodeView
              v-for="(node, idx) in sqliteTree"
              :key="idx"
              :node="node"
              :depth="0"
            />
          </template>

          <div v-else class="text-muted-foreground text-sm">
            Tree view is not available for this plan format.
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h, type PropType } from 'vue'

// --- PostgreSQL recursive plan node ---
const PgPlanTreeNode = defineComponent({
  name: 'PgPlanTreeNode',
  props: {
    node: { type: Object as PropType<Record<string, any>>, required: true },
    depth: { type: Number, default: 0 },
    maxCost: { type: Number, default: 1 }
  },
  setup(props) {
    return () => {
      if (!props.node) return null

      const nodeType = props.node['Node Type'] || 'Unknown'
      const relation = props.node['Relation Name']
      const alias = props.node['Alias']
      const filter = props.node['Filter']
      const indexName = props.node['Index Name']
      const indexCond = props.node['Index Cond']
      const hashCond = props.node['Hash Cond']
      const joinType = props.node['Join Type']
      const sortKey = props.node['Sort Key']
      const groupKey = props.node['Group Key']
      const startupCost = props.node['Startup Cost']
      const totalCost = props.node['Total Cost']
      const planRows = props.node['Plan Rows']
      const planWidth = props.node['Plan Width']
      const actualStartup = props.node['Actual Startup Time']
      const actualTime = props.node['Actual Total Time']
      const actualRows = props.node['Actual Rows']
      const actualLoops = props.node['Actual Loops']
      const sharedHit = props.node['Shared Hit Blocks']
      const sharedRead = props.node['Shared Read Blocks']
      const children = props.node['Plans'] || []

      // Cost level for background highlighting
      const costRatio = (totalCost || 0) / props.maxCost
      let borderColor = 'border-l-green-500'
      let bgColor = ''
      if (costRatio > 0.7) {
        borderColor = 'border-l-red-500'
        bgColor = 'bg-red-500/5'
      } else if (costRatio > 0.3) {
        borderColor = 'border-l-amber-500'
        bgColor = 'bg-amber-500/5'
      }

      return h('div', { class: 'space-y-2' }, [
        h('div', {
          class: `border rounded-md p-3 bg-card border-l-4 ${borderColor} ${bgColor}`,
          style: { marginLeft: `${props.depth * 24}px` }
        }, [
          // Node header
          h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
            h('span', { class: 'font-semibold text-sm' }, nodeType),
            joinType && h('span', {
              class: 'text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400'
            }, joinType),
            relation && h('span', {
              class: 'text-xs text-muted-foreground'
            }, `on ${relation}${alias && alias !== relation ? ` as ${alias}` : ''}`),
            indexName && h('span', {
              class: 'text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }, `idx: ${indexName}`)
          ]),

          // Cost and row metrics
          h('div', { class: 'flex flex-wrap gap-3 mt-1.5 text-xs' }, [
            totalCost != null && h('span', { class: 'text-muted-foreground' },
              `cost: ${startupCost?.toFixed(2)}..${totalCost.toFixed(2)}`
            ),
            planRows != null && h('span', { class: 'text-muted-foreground' },
              `est. rows: ${planRows}`
            ),
            planWidth != null && h('span', { class: 'text-muted-foreground' },
              `width: ${planWidth}`
            ),
            actualRows != null && h('span', { class: 'text-green-600 dark:text-green-400 font-medium' },
              `actual rows: ${actualRows}`
            ),
            actualTime != null && h('span', { class: 'text-amber-600 dark:text-amber-400 font-medium' },
              `time: ${actualTime.toFixed(3)}ms`
            ),
            actualLoops != null && actualLoops > 1 && h('span', { class: 'text-muted-foreground' },
              `loops: ${actualLoops}`
            ),
            sharedHit && h('span', { class: 'text-muted-foreground' },
              `hits: ${sharedHit}`
            ),
            sharedRead && h('span', { class: 'text-muted-foreground' },
              `reads: ${sharedRead}`
            )
          ]),

          // Conditions
          filter && h('div', { class: 'mt-1.5 text-xs text-muted-foreground font-mono' },
            `Filter: ${filter}`
          ),
          indexCond && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' },
            `Index Cond: ${indexCond}`
          ),
          hashCond && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' },
            `Hash Cond: ${hashCond}`
          ),
          sortKey && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' },
            `Sort Key: ${Array.isArray(sortKey) ? sortKey.join(', ') : sortKey}`
          ),
          groupKey && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' },
            `Group Key: ${Array.isArray(groupKey) ? groupKey.join(', ') : groupKey}`
          )
        ]),

        // Recursively render child nodes
        ...children.map((child: any, idx: number) =>
          h(PgPlanTreeNode, {
            key: idx,
            node: child,
            depth: (props.depth || 0) + 1,
            maxCost: props.maxCost
          })
        )
      ])
    }
  }
})

// --- SQLite recursive tree node ---
const SqliteTreeNodeView = defineComponent({
  name: 'SqliteTreeNodeView',
  props: {
    node: { type: Object as PropType<{ id: string | number; detail: string; children: any[] }>, required: true },
    depth: { type: Number, default: 0 }
  },
  setup(props) {
    return () => {
      if (!props.node) return null

      const isScan = props.node.detail.toUpperCase().includes('SCAN')
      const isSearch = props.node.detail.toUpperCase().includes('SEARCH')
      const isUsingIndex = props.node.detail.toUpperCase().includes('USING INDEX')

      let borderColor = 'border-l-muted-foreground'
      if (isScan && !isUsingIndex) {
        borderColor = 'border-l-amber-500'
      } else if (isSearch || isUsingIndex) {
        borderColor = 'border-l-green-500'
      }

      return h('div', { class: 'space-y-2' }, [
        h('div', {
          class: `border rounded-md p-3 bg-card border-l-4 ${borderColor}`,
          style: { marginLeft: `${props.depth * 24}px` }
        }, [
          h('div', { class: 'flex items-center gap-2' }, [
            h('span', { class: 'text-xs text-muted-foreground font-mono' }, `#${props.node.id}`),
            h('span', {
              class: `text-sm ${isScan && !isUsingIndex ? 'text-amber-600 dark:text-amber-400 font-medium' : isSearch || isUsingIndex ? 'text-green-600 dark:text-green-400' : ''}`
            }, props.node.detail)
          ])
        ]),

        // Recursively render children
        ...(props.node.children || []).map((child: any, idx: number) =>
          h(SqliteTreeNodeView, {
            key: idx,
            node: child,
            depth: (props.depth || 0) + 1
          })
        )
      ])
    }
  }
})

export default {}
</script>
