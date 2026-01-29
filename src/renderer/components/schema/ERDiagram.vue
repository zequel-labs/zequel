<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Table, Column, ForeignKey } from '@/types/table'
import { IconTable, IconKey, IconLink, IconZoomIn, IconZoomOut, IconRefresh } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

interface TablePosition {
  name: string
  x: number
  y: number
  width: number
  height: number
}

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

const svgRef = ref<SVGSVGElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const positions = ref<Map<string, TablePosition>>(new Map())
const dragging = ref<{ tableName: string; offsetX: number; offsetY: number } | null>(null)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

const TABLE_WIDTH = 200
const TABLE_HEADER_HEIGHT = 32
const COLUMN_HEIGHT = 24
const TABLE_PADDING = 10
const TABLE_GAP_X = 60
const TABLE_GAP_Y = 40

// Calculate table height based on columns
function getTableHeight(columnCount: number): number {
  return TABLE_HEADER_HEIGHT + (columnCount * COLUMN_HEIGHT) + (TABLE_PADDING * 2)
}

// Initialize table positions in a grid layout
function initializePositions() {
  const newPositions = new Map<string, TablePosition>()
  const columns = Math.ceil(Math.sqrt(props.tables.length))

  // Start at a position that allows panning in all directions
  const START_X = 200
  const START_Y = 200

  props.tables.forEach((tableData, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const height = getTableHeight(tableData.columns.length)

    newPositions.set(tableData.table.name, {
      name: tableData.table.name,
      x: START_X + col * (TABLE_WIDTH + TABLE_GAP_X),
      y: START_Y + row * (height + TABLE_GAP_Y),
      width: TABLE_WIDTH,
      height
    })
  })

  positions.value = newPositions
}

onMounted(() => {
  initializePositions()
})

watch(() => props.tables, () => {
  initializePositions()
}, { deep: true })

// Get all relationships for drawing lines
const relationships = computed(() => {
  const rels: { from: string; fromColumn: string; to: string; toColumn: string }[] = []

  for (const tableData of props.tables) {
    for (const fk of tableData.foreignKeys) {
      rels.push({
        from: tableData.table.name,
        fromColumn: fk.column,
        to: fk.referencedTable,
        toColumn: fk.referencedColumn
      })
    }
  }

  return rels
})

// Calculate connection points for relationships
function getConnectionPoints(from: string, to: string) {
  const fromPos = positions.value.get(from)
  const toPos = positions.value.get(to)

  if (!fromPos || !toPos) return null

  const fromCenterX = fromPos.x + fromPos.width / 2
  const fromCenterY = fromPos.y + fromPos.height / 2
  const toCenterX = toPos.x + toPos.width / 2
  const toCenterY = toPos.y + toPos.height / 2

  // Determine which sides to connect
  let startX, startY, endX, endY

  if (fromCenterX < toCenterX - TABLE_WIDTH / 2) {
    // From is to the left of To
    startX = fromPos.x + fromPos.width
    endX = toPos.x
  } else if (fromCenterX > toCenterX + TABLE_WIDTH / 2) {
    // From is to the right of To
    startX = fromPos.x
    endX = toPos.x + toPos.width
  } else {
    // Tables are aligned horizontally
    startX = fromCenterX
    endX = toCenterX
  }

  if (fromCenterY < toCenterY - 50) {
    startY = fromPos.y + fromPos.height
    endY = toPos.y
  } else if (fromCenterY > toCenterY + 50) {
    startY = fromPos.y
    endY = toPos.y + toPos.height
  } else {
    startY = fromCenterY
    endY = toCenterY
  }

  // Create bezier curve control points
  const midX = (startX + endX) / 2
  const midY = (startY + endY) / 2

  return {
    startX,
    startY,
    endX,
    endY,
    path: `M ${startX} ${startY} Q ${midX} ${startY} ${midX} ${midY} Q ${midX} ${endY} ${endX} ${endY}`
  }
}

// Drag handling
function startDrag(e: MouseEvent, tableName: string) {
  e.preventDefault()
  const pos = positions.value.get(tableName)
  if (!pos) return

  dragging.value = {
    tableName,
    offsetX: e.clientX / zoom.value - pos.x,
    offsetY: e.clientY / zoom.value - pos.y
  }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return

  const pos = positions.value.get(dragging.value.tableName)
  if (!pos) return

  positions.value.set(dragging.value.tableName, {
    ...pos,
    x: e.clientX / zoom.value - dragging.value.offsetX,
    y: e.clientY / zoom.value - dragging.value.offsetY
  })

  // Force reactivity
  positions.value = new Map(positions.value)
}

function endDrag() {
  dragging.value = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
}

// Pan handling
function startPan(e: MouseEvent) {
  if (dragging.value) return
  isPanning.value = true
  panStart.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
  document.addEventListener('mousemove', onPan)
  document.addEventListener('mouseup', endPan)
}

function onPan(e: MouseEvent) {
  if (!isPanning.value) return
  pan.value = {
    x: e.clientX - panStart.value.x,
    y: e.clientY - panStart.value.y
  }
}

function endPan() {
  isPanning.value = false
  document.removeEventListener('mousemove', onPan)
  document.removeEventListener('mouseup', onPan)
}

// Zoom
function handleZoom(delta: number) {
  zoom.value = Math.max(0.1, Math.min(2, zoom.value + delta))
}

function handleWheelZoom(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    handleZoom(delta)
  }
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
  initializePositions()
}

// Check if column is primary key
function isPrimaryKey(tableData: TableWithDetails, columnName: string): boolean {
  return tableData.columns.some(c => c.name === columnName && c.primaryKey)
}

// Check if column is foreign key
function isForeignKey(tableData: TableWithDetails, columnName: string): boolean {
  return tableData.foreignKeys.some(fk => fk.column === columnName)
}
</script>

<template>
  <div class="flex flex-col h-full" ref="containerRef">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
      <span class="text-sm font-medium">ER Diagram</span>
      <span class="text-xs text-muted-foreground">
        {{ tables.length }} tables, {{ relationships.length }} relationships
      </span>

      <div class="flex items-center gap-1 ml-auto">
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="handleZoom(-0.1)" title="Zoom out">
          <IconZoomOut class="h-4 w-4" />
        </Button>
        <span class="text-xs text-muted-foreground w-12 text-center">
          {{ Math.round(zoom * 100) }}%
        </span>
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="handleZoom(0.1)" title="Zoom in">
          <IconZoomIn class="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" class="h-8 w-8" @click="resetView" title="Reset view">
          <IconRefresh class="h-4 w-4" />
        </Button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-muted-foreground">Loading schema...</div>
    </div>

    <!-- Empty state -->
    <div v-else-if="tables.length === 0" class="flex-1 flex items-center justify-center">
      <div class="text-center text-muted-foreground">
        <IconTable class="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No tables found</p>
      </div>
    </div>

    <!-- Diagram -->
    <div
      v-else
      class="flex-1 overflow-hidden bg-background cursor-grab"
      :class="{ 'cursor-grabbing': isPanning }"
      @mousedown="startPan"
      @wheel="handleWheelZoom"
    >
      <svg
        ref="svgRef"
        width="10000"
        height="10000"
        :style="{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }"
      >
        <!-- Grid pattern -->
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" class="text-muted/20" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="10000" height="10000" fill="url(#grid)" />

        <!-- Relationship lines -->
        <g>
          <template v-for="rel in relationships" :key="`${rel.from}-${rel.to}`">
            <template v-if="getConnectionPoints(rel.from, rel.to)">
              <path
                :d="getConnectionPoints(rel.from, rel.to)!.path"
                fill="none"
                stroke="currentColor"
                class="text-muted-foreground"
                stroke-width="2"
                marker-end="url(#arrowhead)"
              />
            </template>
          </template>
        </g>

        <!-- Arrow marker -->
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
            fill="currentColor"
            class="text-muted-foreground"
          >
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
        </defs>

        <!-- Tables -->
        <g v-for="tableData in tables" :key="tableData.table.name">
          <template v-if="positions.get(tableData.table.name)">
            <g
              :transform="`translate(${positions.get(tableData.table.name)!.x}, ${positions.get(tableData.table.name)!.y})`"
              class="cursor-move"
              @mousedown.stop="startDrag($event, tableData.table.name)"
              @dblclick="emit('table-click', tableData.table.name)"
            >
              <!-- Table background -->
              <rect
                :width="TABLE_WIDTH"
                :height="getTableHeight(tableData.columns.length)"
                rx="6"
                class="fill-background stroke-border"
                stroke-width="1"
              />

              <!-- Table header -->
              <rect
                :width="TABLE_WIDTH"
                height="32"
                rx="6"
                class="fill-muted"
              />
              <rect
                :width="TABLE_WIDTH"
                height="16"
                y="16"
                class="fill-muted"
              />

              <!-- Table icon and name -->
              <foreignObject x="8" y="7" width="16" height="16">
                <IconTable :size="16" class="text-blue-500" />
              </foreignObject>
              <text
                x="32"
                y="21"
                class="text-xs font-medium fill-foreground"
              >
                {{ tableData.table.name.length > 20 ? tableData.table.name.slice(0, 20) + '...' : tableData.table.name }}
              </text>

              <!-- Columns -->
              <g :transform="`translate(0, ${TABLE_HEADER_HEIGHT + TABLE_PADDING})`">
                <g v-for="(col, colIndex) in tableData.columns" :key="col.name" :transform="`translate(0, ${colIndex * COLUMN_HEIGHT})`">
                  <rect
                    :width="TABLE_WIDTH"
                    :height="COLUMN_HEIGHT"
                    class="fill-transparent hover:fill-muted/50"
                  />
                  <!-- Key icon -->
                  <foreignObject v-if="isPrimaryKey(tableData, col.name)" x="6" y="4" width="14" height="14">
                    <IconKey :size="14" class="text-yellow-500" />
                  </foreignObject>
                  <foreignObject v-else-if="isForeignKey(tableData, col.name)" x="6" y="4" width="14" height="14">
                    <IconLink :size="14" class="text-purple-500" />
                  </foreignObject>
                  <!-- Column name -->
                  <text
                    x="24"
                    y="15"
                    class="text-[11px] fill-foreground"
                  >
                    {{ col.name.length > 16 ? col.name.slice(0, 16) + '...' : col.name }}
                  </text>
                  <!-- Column type -->
                  <text
                    :x="TABLE_WIDTH - 8"
                    y="15"
                    text-anchor="end"
                    class="text-[10px] fill-muted-foreground"
                  >
                    {{ col.type.length > 10 ? col.type.slice(0, 10) : col.type }}
                  </text>
                </g>
              </g>
            </g>
          </template>
        </g>
      </svg>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 px-4 py-2 border-t bg-muted/30 text-xs">
      <div class="flex items-center gap-1">
        <IconKey class="w-3 h-3 text-yellow-500" />
        <span class="text-muted-foreground">Primary Key</span>
      </div>
      <div class="flex items-center gap-1">
        <IconLink class="w-3 h-3 text-purple-500" />
        <span class="text-muted-foreground">Foreign Key</span>
      </div>
      <span class="text-muted-foreground ml-auto">
        Drag tables to rearrange • Double-click to open • Ctrl+Scroll to zoom
      </span>
    </div>
  </div>
</template>
