<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { VueFlow, useVueFlow, Position, MarkerType } from '@vue-flow/core'
import type { Node, Edge } from '@vue-flow/core'
import { Background, BackgroundVariant } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/controls/dist/style.css'

import ELK from 'elkjs/lib/elk.bundled.js'
import type { Table, Column, ForeignKey } from '@/types/table'
import {
  IconTable,
  IconLoader2,
} from '@tabler/icons-vue'
import { useStatusBarStore } from '@/stores/statusBar'
import { useTabsStore } from '@/stores/tabs'
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
  tabId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'table-click', tableName: string): void
}>()

// vue-flow setup
const { fitView, zoomIn, zoomOut } = useVueFlow('er-diagram')

const nodes = ref<Node[]>([])
const edges = ref<Edge[]>([])

const EDGE_COLOR = 'var(--foreground)'

const elk = new ELK()

// Node size estimation
const NODE_HEADER_HEIGHT = 40
const NODE_COLUMN_HEIGHT = 28
const NODE_PADDING = 4
const NODE_WIDTH = 260

const estimateNodeHeight = (columnCount: number): number => {
  return NODE_HEADER_HEIGHT + columnCount * NODE_COLUMN_HEIGHT + NODE_PADDING
}

/**
 * Compute layout using ELK for proper hierarchical positioning
 * with edge crossing minimization and vertical alignment.
 */
const computeLayout = async (tables: TableWithDetails[]): Promise<Map<string, { x: number; y: number }>> => {
  const tableNames = new Set(tables.map((t) => t.table.name))

  const edges: { id: string; sources: string[]; targets: string[] }[] = []
  tables.forEach((t) => {
    t.foreignKeys.forEach((fk) => {
      if (tableNames.has(fk.referencedTable) && fk.referencedTable !== t.table.name) {
        edges.push({
          id: `${t.table.name}-${fk.column}`,
          sources: [t.table.name],
          targets: [fk.referencedTable],
        })
      }
    })
  })

  const graph = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      // Minimize total edge length — keeps connected tables close vertically
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      // Orthogonal edges (right-angle bends), standard for ER diagrams
      'elk.edgeRouting': 'ORTHOGONAL',
      // Pack disconnected table groups together instead of spreading them out
      'elk.layered.compaction.connectedComponents': 'true',
      // Reduce wasted space after layout
      'elk.layered.compaction.postCompaction.strategy': 'EDGE_LENGTH',
      // Spacing
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
    },
    children: tables.map((t) => ({
      id: t.table.name,
      width: NODE_WIDTH,
      height: estimateNodeHeight(t.columns.length),
    })),
    edges,
  })

  // ELK returns top-left coordinates directly
  const positions = new Map<string, { x: number; y: number }>()
  for (const child of graph.children ?? []) {
    positions.set(child.id, { x: child.x ?? 0, y: child.y ?? 0 })
  }

  return positions
}

/**
 * Build the set of all columns that are FK targets (referenced by another table).
 */
const buildFKTargetColumns = (tables: TableWithDetails[]): Set<string> => {
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
const buildFKSourceColumns = (tables: TableWithDetails[]): Set<string> => {
  const sources = new Set<string>()

  tables.forEach((t) => {
    t.foreignKeys.forEach((fk) => {
      sources.add(`${t.table.name}.${fk.column}`)
    })
  })

  return sources
}

const buildGraph = async () => {
  if (props.tables.length === 0) {
    nodes.value = []
    edges.value = []
    return
  }

  const layout = await computeLayout(props.tables)
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
      headerColor: 'bg-foreground',
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
  props.tables.forEach((tableData) => {
    tableData.foreignKeys.forEach((fk) => {
      // Only create edge if the referenced table exists in our table list
      if (!tableNames.has(fk.referencedTable)) return

      const edgeId = `${tableData.table.name}-${fk.column}-${fk.referencedTable}-${fk.referencedColumn}`

      newEdges.push({
        id: edgeId,
        source: tableData.table.name,
        target: fk.referencedTable,
        sourceHandle: `${tableData.table.name}-${fk.column}-source`,
        targetHandle: `${fk.referencedTable}-${fk.referencedColumn}-target`,
        animated: true,
        type: 'smoothstep',
        style: { stroke: EDGE_COLOR, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: EDGE_COLOR,
          width: 20,
          height: 20,
        },
      })
    })
  })

  nodes.value = newNodes
  edges.value = newEdges
}

const handleFitView = () => {
  fitView({ padding: 0.15, duration: 300 })
}

const handleResetLayout = () => {
  buildGraph()
  nextTick(() => {
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 })
    }, 100)
  })
}

const handleNodeDoubleClick = (event: { event: MouseEvent | TouchEvent; node: Node }) => {
  emit('table-click', event.node.id)
}

// StatusBar integration
const statusBarStore = useStatusBarStore()
const tabsStore = useTabsStore()

const setupStatusBar = () => {
  statusBarStore.showERDiagramControls = true
  statusBarStore.erDiagramTableCount = props.tables.length
  statusBarStore.erDiagramRelationshipCount = edges.value.length
  statusBarStore.registerERDiagramCallbacks({
    onZoomIn: () => zoomIn({ duration: 200 }),
    onZoomOut: () => zoomOut({ duration: 200 }),
    onFitView: handleFitView,
    onResetLayout: handleResetLayout,
  })
}

// Build on mount and when tables change
onMounted(() => {
  buildGraph()
  nextTick(() => {
    setTimeout(() => {
      fitView({ padding: 0.15, duration: 300 })
    }, 200)
  })

  setupStatusBar()
})

// Re-sync statusBar when this tab becomes active again
watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
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

// Keep status bar counts in sync
watch(
  () => props.tables.length,
  (count) => {
    statusBarStore.erDiagramTableCount = count
  }
)

watch(
  edges,
  (newEdges) => {
    statusBarStore.erDiagramRelationshipCount = newEdges.length
  }
)
</script>

<template>
  <div class="flex flex-col h-full">
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
