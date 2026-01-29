<script setup lang="ts">
import { computed } from 'vue'
import type { QueryPlan } from '@/stores/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Copy, Check, TreePine, Table as TableIcon } from 'lucide-vue-next'
import { ref } from 'vue'

const props = defineProps<{
  plan: QueryPlan | undefined
}>()

const copied = ref(false)
const viewMode = ref<'tree' | 'table' | 'raw'>('raw')

const hasData = computed(() => {
  return props.plan && (props.plan.planText || props.plan.rows.length > 0)
})

async function copyPlan() {
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

// Parse JSON plan for tree view (if applicable)
const parsedPlan = computed(() => {
  if (!props.plan?.planText) return null
  try {
    return JSON.parse(props.plan.planText)
  } catch {
    return null
  }
})

// Helper to extract key metrics from plan
const metrics = computed(() => {
  if (!parsedPlan.value) return null

  const plan = Array.isArray(parsedPlan.value) ? parsedPlan.value[0] : parsedPlan.value
  if (!plan || !plan.Plan) return null

  const root = plan.Plan
  return {
    nodeType: root['Node Type'],
    totalCost: root['Total Cost'],
    startupCost: root['Startup Cost'],
    planRows: root['Plan Rows'],
    planWidth: root['Plan Width'],
    actualTime: root['Actual Total Time'],
    actualRows: root['Actual Rows'],
    sharedHit: root['Shared Hit Blocks'],
    sharedRead: root['Shared Read Blocks']
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
      <div class="flex items-center gap-2">
        <TreePine class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">Query Execution Plan</span>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center border rounded-md">
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 rounded-r-none"
            :class="{ 'bg-muted': viewMode === 'raw' }"
            @click="viewMode = 'raw'"
          >
            Raw
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 rounded-none border-x"
            :class="{ 'bg-muted': viewMode === 'table' }"
            @click="viewMode = 'table'"
          >
            <TableIcon class="h-3 w-3 mr-1" />
            Table
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="h-7 px-2 rounded-l-none"
            :class="{ 'bg-muted': viewMode === 'tree' }"
            :disabled="!parsedPlan"
            @click="viewMode = 'tree'"
          >
            <TreePine class="h-3 w-3 mr-1" />
            Tree
          </Button>
        </div>
        <Button variant="outline" size="sm" class="h-7" @click="copyPlan" :disabled="!plan?.planText">
          <component :is="copied ? Check : Copy" class="h-3 w-3 mr-1" />
          {{ copied ? 'Copied' : 'Copy' }}
        </Button>
      </div>
    </div>

    <!-- Metrics Summary (if JSON plan) -->
    <div v-if="metrics" class="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/10">
      <Badge variant="outline">
        Node: {{ metrics.nodeType }}
      </Badge>
      <Badge v-if="metrics.totalCost" variant="secondary">
        Cost: {{ metrics.startupCost?.toFixed(2) }}..{{ metrics.totalCost?.toFixed(2) }}
      </Badge>
      <Badge v-if="metrics.planRows" variant="secondary">
        Est. Rows: {{ metrics.planRows }}
      </Badge>
      <Badge v-if="metrics.actualRows !== undefined" variant="default">
        Actual Rows: {{ metrics.actualRows }}
      </Badge>
      <Badge v-if="metrics.actualTime !== undefined" variant="default">
        Time: {{ metrics.actualTime?.toFixed(3) }}ms
      </Badge>
      <Badge v-if="metrics.sharedHit" variant="outline">
        Buffer Hits: {{ metrics.sharedHit }}
      </Badge>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <!-- No Plan -->
      <div v-if="!hasData" class="flex items-center justify-center h-full text-muted-foreground">
        No execution plan available. Click "Explain" to analyze a query.
      </div>

      <!-- Raw View -->
      <ScrollArea v-else-if="viewMode === 'raw'" class="h-full">
        <pre class="p-4 text-sm font-mono whitespace-pre-wrap">{{ plan?.planText }}</pre>
      </ScrollArea>

      <!-- Table View -->
      <ScrollArea v-else-if="viewMode === 'table'" class="h-full">
        <div class="p-4">
          <div v-if="plan && plan.rows.length > 0" class="rounded-md border overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th
                    v-for="col in plan.columns"
                    :key="col"
                    class="px-3 py-2 text-left font-medium"
                  >
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in plan.rows"
                  :key="idx"
                  class="border-t"
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
        </div>
      </ScrollArea>

      <!-- Tree View (JSON) -->
      <ScrollArea v-else-if="viewMode === 'tree' && parsedPlan" class="h-full">
        <div class="p-4">
          <PlanNode :node="Array.isArray(parsedPlan) ? parsedPlan[0]?.Plan : parsedPlan?.Plan" />
        </div>
      </ScrollArea>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

// Recursive Plan Node component
const PlanNode = defineComponent({
  name: 'PlanNode',
  props: {
    node: Object,
    depth: { type: Number, default: 0 }
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
      const totalCost = props.node['Total Cost']
      const planRows = props.node['Plan Rows']
      const actualRows = props.node['Actual Rows']
      const actualTime = props.node['Actual Total Time']
      const children = props.node['Plans'] || []

      return h('div', { class: 'space-y-2' }, [
        h('div', {
          class: 'border rounded-md p-3 bg-card',
          style: { marginLeft: `${props.depth * 20}px` }
        }, [
          // Node header
          h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
            h('span', { class: 'font-medium text-sm' }, nodeType),
            relation && h('span', { class: 'text-xs text-muted-foreground' }, `on ${relation}${alias && alias !== relation ? ` (${alias})` : ''}`),
            indexName && h('span', { class: 'text-xs text-blue-500' }, `using ${indexName}`)
          ]),
          // Metrics
          h('div', { class: 'flex flex-wrap gap-2 mt-1 text-xs' }, [
            totalCost && h('span', { class: 'text-muted-foreground' }, `cost: ${totalCost.toFixed(2)}`),
            planRows && h('span', { class: 'text-muted-foreground' }, `rows: ${planRows}`),
            actualRows !== undefined && h('span', { class: 'text-green-600' }, `actual: ${actualRows}`),
            actualTime !== undefined && h('span', { class: 'text-amber-600' }, `time: ${actualTime.toFixed(3)}ms`)
          ]),
          // Conditions
          filter && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' }, `Filter: ${filter}`),
          indexCond && h('div', { class: 'mt-1 text-xs text-muted-foreground font-mono' }, `Index Cond: ${indexCond}`)
        ]),
        // Child nodes
        ...children.map((child: any, idx: number) =>
          h(PlanNode, { key: idx, node: child, depth: (props.depth || 0) + 1 })
        )
      ])
    }
  }
})

export default {}
</script>
