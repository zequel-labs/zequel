<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, Position, MarkerType } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import type { Table, Column, ForeignKey } from '@/types/table'
import {
  IconZoomIn,
  IconZoomOut,
  IconFocus2,
  IconLayoutDistributeHorizontal,
  IconTable,
  IconKey,
  IconLink,
  IconLoader2,
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import ERTableNode from './ERTableNode.vue'
import type { ERTableNodeData, ERColumnData } from './ERTableNode.vue'

interface TableWithDetails {
  table: Table
  columns: Column[]
  foreignKeys: ForeignKey[]
}

interface Props {
  tables: TableWithDetails[]
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'table-click', tableName: string): void
}>()

// vue-flow setup
const { fitView, zoomIn, zoomOut } = useVueFlow({
  id: 'er-diagram',
  fitViewOnInit: false,
  defaultEdgeOptions: {
    animated: true,
    type: 'smoothstep',
  },
  minZoom: 0.1,
  maxZoom: 2,
})

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

// Edge color palette for distinguishing FK relationships
const EDGE_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
]

// Header color classes for tables
const HEADER_COLORS = [
  'bg-blue-600 dark:bg-blue-700',
  'bg-violet-600 dark:bg-violet-700',
  'bg-emerald-600 dark:bg-emerald-700',
  'bg-pink-600 dark:bg-pink-700',
  'bg-orange-600 dark:bg-orange-700',
  'bg-cyan-600 dark:bg-cyan-700',
  'bg-amber-600 dark:bg-amber-700',
  'bg-red-600 dark:bg-red-700',
  'bg-indigo-600 dark:bg-indigo-700',
  'bg-teal-600 dark:bg-teal-700',
]

// Node height estimation: header (40px) + columns * 28px + some padding
const NODE_HEADER_HEIGHT = 40
const NODE_COLUMN_HEIGHT = 28
const NODE_PADDING = 4
const NODE_WIDTH = 260
const NODE_GAP_X = 80
const NODE_GAP_Y = 60

function estimateNodeHeight(columnCount: number): number {
  return NODE_HEADER_HEIGHT + columnCount * NODE_COLUMN_HEIGHT + NODE_PADDING
}

/**
 * Topological-sort-aware grid layout.
 * Tables with no FK dependencies go in the leftmost columns.
 * Tables that reference others are placed to the right of their references.
 */
function computeLayout(tables: TableWithDetails[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()
  const tableMap = new Map<string, TableWithDetails>()
  tables.forEach((t) => tableMap.set(t.table.name, t))

  // Build dependency graph: table -> tables it references
  const deps = new Map<string, Set<string>>()
  const reverseDeps = new Map<string, Set<string>>()
  tables.forEach((t) => {
    deps.set(t.table.name, new Set())
    reverseDeps.set(t.table.name, new Set())
  })

  tables.forEach((t) => {
    t.foreignKeys.forEach((fk) => {
      if (tableMap.has(fk.referencedTable) && fk.referencedTable !== t.table.name) {
        deps.get(t.table.name)!.add(fk.referencedTable)
        reverseDeps.get(fk.referencedTable)!.add(t.table.name)
      }
    })
  })

  // Assign layers via topological ordering (Kahn's algorithm)
  const inDegree = new Map<string, number>()
  tables.forEach((t) => inDegree.set(t.table.name, deps.get(t.table.name)!.size))

  const layers: string[][] = []
  const assigned = new Set<string>()

  while (assigned.size < tables.length) {
    // Find all tables with no remaining dependencies
    const layer: string[] = []
    for (const [name, deg] of inDegree) {
      if (deg === 0 && !assigned.has(name)) {
        layer.push(name)
      }
    }

    // If no tables found (circular dependency), pick unassigned ones
    if (layer.length === 0) {
      for (const t of tables) {
        if (!assigned.has(t.table.name)) {
          layer.push(t.table.name)
          break
        }
      }
    }

    layers.push(layer)
    layer.forEach((name) => {
      assigned.add(name)
      // Reduce in-degree for dependents
      reverseDeps.get(name)?.forEach((dep) => {
        const current = inDegree.get(dep) || 0
        inDegree.set(dep, Math.max(0, current - 1))
      })
    })
  }

  // Position tables in layers
  let currentX = 50

  for (const layer of layers) {
    let currentY = 50
    let maxWidth = NODE_WIDTH

    for (const tableName of layer) {
      const tableData = tableMap.get(tableName)
      if (!tableData) continue

      positions.set(tableName, { x: currentX, y: currentY })
      const nodeHeight = estimateNodeHeight(tableData.columns.length)
      currentY += nodeHeight + NODE_GAP_Y
    }

    currentX += maxWidth + NODE_GAP_X
  }

  return positions
}

/**
 * Build the set of all columns that are FK targets (referenced by another table).
 */
function buildFKTargetColumns(tables: TableWithDetails[]): Set<string> {
  const targets = new Set<string>()
  const tableNames = new Set(tables.map((t) => t.table.name))

  tables.forEach((t) => {
    t.foreignKeys.forEach((fk) => {
      if (tableNames.has(fk.referencedTable)) {
        targets.add(`${fk.referencedTable}.${fk.referencedColumn}`)
      }
    })
  })

  return targets
}

/**
 * Build the set of all FK source columns.
 */
function buildFKSourceColumns(tables: TableWithDetails[]): Set<string> {
  const sources = new Set<string>()

  tables.forEach((t) => {
    t.foreignKeys.forEach((fk) => {
      sources.add(`${t.table.name}.${fk.column}`)
    })
  })

  return sources
}

function buildGraph() {
  if (props.tables.length === 0) {
    nodes.value = []
    edges.value = []
    return
  }

  const layout = computeLayout(props.tables)
  const fkTargets = buildFKTargetColumns(props.tables)
  const fkSources = buildFKSourceColumns(props.tables)
  const tableNames = new Set(props.tables.map((t) => t.table.name))

  // Build nodes
  const newNodes: Node[] = props.tables.map((tableData, index) => {
    const pos = layout.get(tableData.table.name) || { x: 0, y: 0 }

    const columnData: ERColumnData[] = tableData.columns.map((col) => ({
      name: col.name,
      type: col.type,
      nullable: col.nullable,
      primaryKey: col.primaryKey,
      isForeignKey: fkSources.has(`${tableData.table.name}.${col.name}`),
      isForeignKeyTarget: fkTargets.has(`${tableData.table.name}.${col.name}`),
    }))

    const nodeData: ERTableNodeData = {
      tableName: tableData.table.name,
      columns: columnData,
      headerColor: HEADER_COLORS[index % HEADER_COLORS.length],
    }

    return {
      id: tableData.table.name,
      type: 'er-table',
      position: { x: pos.x, y: pos.y },
      data: nodeData,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })

  // Build edges
  const newEdges: Edge[] = []
  let edgeColorIndex = 0

  props.tables.forEach((tableData) => {
    tableData.foreignKeys.forEach((fk) => {
      // Only create edge if the referenced table exists in our table list
      if (!tableNames.has(fk.referencedTable)) return

      const color = EDGE_COLORS[edgeColorIndex % EDGE_COLORS.length]
      edgeColorIndex++

      const edgeId = `${tableData.table.name}-${fk.column}-${fk.referencedTable}-${fk.referencedColumn}`

      newEdges.push({
        id: edgeId,
        source: tableData.table.name,
        target: fk.referencedTable,
        sourceHandle: `${tableData.table.name}-${fk.column}-source`,
        targetHandle: `${fk.referencedTable}-${fk.referencedColumn}-target`,
        label: fk.name,
        animated: true,
        type: 'smoothstep',
        style: { stroke: color, strokeWidth: 2 },
        labelStyle: { fill: color, fontWeight: 600, fontSize: 10 },
        labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color,
          width: 20,
          height: 20,
        },
      })
    })
  })

  nodes.value = newNodes
  edges.value = newEdges
}

function handleFitView() {
  fitView({ padding: 0.15, duration: 300 })
}

function handleResetLayout() {
  buildGraph()
  nextTick(() => {
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 })
    }, 100)
  })
}

function handleNodeDoubleClick(event: { event: MouseEvent | TouchEvent; node: Node }) {
  emit('table-click', event.node.id)
}

// Stats
const tableCount = computed(() => props.tables.length)
const relationshipCount = computed(() => edges.value.length)

// Build on mount and when tables change
onMounted(() => {
  buildGraph()
  nextTick(() => {
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 })
    }, 200)
  })
})

watch(
  () => props.tables,
  () => {
    buildGraph()
    nextTick(() => {
      setTimeout(() => {
        fitView({ padding: 0.15, duration: 300 })
      }, 200)
    })
  },
  { deep: true }
)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div class="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30">
      <span class="text-sm font-medium mr-1">ER Diagram</span>
      <span class="text-xs text-muted-foreground">
        {{ tableCount }} tables, {{ relationshipCount }} relationships
      </span>

      <div class="flex items-center gap-0.5 ml-auto">
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="zoomOut({ duration: 200 })">
                <IconZoomOut class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="zoomIn({ duration: 200 })">
                <IconZoomIn class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleFitView">
                <IconFocus2 class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Fit View</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7" @click="handleResetLayout">
                <IconLayoutDistributeHorizontal class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Reset Layout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-2">
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
        <span class="text-sm text-muted-foreground">Loading schema...</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="tables.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <IconTable class="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No tables found</p>
        <p class="text-xs mt-1 opacity-75">Tables will appear here once the schema is loaded</p>
      </div>
    </div>

    <!-- vue-flow diagram -->
    <div v-else class="flex-1 relative">
      <VueFlow
        id="er-diagram"
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-edge-options="{ type: 'smoothstep', animated: true }"
        :min-zoom="0.1"
        :max-zoom="2"
        :snap-to-grid="true"
        :snap-grid="[15, 15]"
        class="er-flow"
        @node-double-click="handleNodeDoubleClick"
      >
        <!-- Custom node type -->
        <template #node-er-table="nodeProps">
          <ERTableNode
            :id="nodeProps.id"
            :data="nodeProps.data"
          />
        </template>

        <!-- Background -->
        <Background :variant="BackgroundVariant.Dots" :gap="20" :size="1" pattern-color="var(--muted-foreground)" :style="{ opacity: 0.15 }" />

        <!-- Controls -->
        <Controls :show-zoom="false" :show-fit-view="false" :show-interactive="false" />

      </VueFlow>
    </div>

    <!-- Legend footer -->
    <div class="flex items-center gap-4 px-3 py-1.5 border-t bg-muted/30 text-xs">
      <div class="flex items-center gap-1">
        <IconKey class="w-3 h-3 text-amber-500" />
        <span class="text-muted-foreground">Primary Key</span>
      </div>
      <div class="flex items-center gap-1">
        <IconLink class="w-3 h-3 text-blue-500" />
        <span class="text-muted-foreground">Foreign Key</span>
      </div>
      <span class="text-muted-foreground ml-auto">
        Scroll to zoom -- Drag to pan -- Double-click to open table
      </span>
    </div>
  </div>
</template>

<style>
/* Vue Flow overrides to match the app theme */
.er-flow {
  --vf-node-bg: var(--card);
  --vf-node-text: var(--foreground);
  --vf-connection-path: var(--muted-foreground);
  --vf-handle: var(--primary);
}

.er-flow .vue-flow__node {
  border-radius: 0.5rem;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.er-flow .vue-flow__node.selected {
  box-shadow: 0 0 0 2px var(--ring);
}

.er-flow .vue-flow__edge-text {
  font-size: 10px;
}

.er-flow .vue-flow__controls {
  border-radius: 0.375rem;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.er-flow .vue-flow__controls-button {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  width: 28px;
  height: 28px;
}

.er-flow .vue-flow__controls-button:hover {
  background: var(--muted);
}

.er-flow .vue-flow__controls-button svg {
  fill: var(--foreground);
}
</style>
