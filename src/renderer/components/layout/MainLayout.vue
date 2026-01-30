<script setup lang="ts">
import { ref, computed, watch, provide, reactive } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { debounce } from '@/lib/utils'
import type { ColumnInfo, CellChange } from '@/types/query'
import ConnectionRail from './ConnectionRail.vue'
import HeaderBar from './HeaderBar.vue'
import HomeView from '@/views/HomeView.vue'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import StatusBar from './StatusBar.vue'
import PanelContent from './PanelContent.vue'
import RowDetailPanel from '@/components/grid/RowDetailPanel.vue'

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
  (e: 'import-from-url'): void
}>()

const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const sidebarWidth = ref(settingsStore.sidebarWidth || 260)
const isResizing = ref(false)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const showConnectionRail = computed(() => connectionsStore.connectedConnections.length > 1)
const sidebarVisible = ref(true)
const rightPanelVisible = ref(false)
const rightPanelWidth = ref(320)
const isResizingRight = ref(false)

const rightPanelData = reactive({
  row: null as Record<string, unknown> | null,
  columns: [] as ColumnInfo[],
  rowIndex: null as number | null,
  pendingChanges: new Map() as Map<string, CellChange>,
  onUpdateCell: null as ((change: CellChange) => void) | null
})

provide('rightPanelVisible', rightPanelVisible)
provide('rightPanelData', rightPanelData)

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
}

function toggleRightPanel() {
  rightPanelVisible.value = !rightPanelVisible.value
}

function startResizeRight(e: MouseEvent) {
  isResizingRight.value = true
  const startX = e.clientX
  const startWidth = rightPanelWidth.value

  function onMouseMove(e: MouseEvent) {
    const delta = startX - e.clientX
    const newWidth = Math.max(200, Math.min(600, startWidth + delta))
    rightPanelWidth.value = newWidth
  }

  function onMouseUp() {
    isResizingRight.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResize(e: MouseEvent) {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  function onMouseMove(e: MouseEvent) {
    const delta = e.clientX - startX
    const newWidth = Math.max(180, Math.min(500, startWidth + delta))
    sidebarWidth.value = newWidth
  }

  function onMouseUp() {
    isResizing.value = false
    settingsStore.setSidebarWidth(sidebarWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// --- Tab Persistence ---

// Track which connections have already had their tabs restored
const restoredConnections = new Set<string>()

// Debounced save: persist tab state for all active connections
const debouncedSaveAllTabs = debounce(() => {
  const connectionIds = new Set(tabsStore.tabs.map(t => t.data.connectionId))
  for (const connectionId of connectionIds) {
    const conn = connectionsStore.connections.find(c => c.id === connectionId)
    const database = conn?.database || ''
    tabsStore.saveTabSession(connectionId, database)
  }
}, 500)

// Auto-save whenever tabs or active tab change
watch(
  () => [tabsStore.tabs, tabsStore.activeTabId],
  () => {
    debouncedSaveAllTabs()
  },
  { deep: true }
)

// Restore tabs when a connection becomes connected
watch(
  () => [...connectionsStore.connectionStates.entries()],
  async (newStates) => {
    for (const [connectionId, state] of newStates) {
      const conn = connectionsStore.connections.find(c => c.id === connectionId)
      const database = conn?.database || ''
      const restoreKey = `${connectionId}:${database}`
      if (state.status === 'connected' && !restoredConnections.has(restoreKey)) {
        restoredConnections.add(restoreKey)
        // Only restore if there are no existing tabs for this connection
        const existingTabs = tabsStore.tabs.filter(t => t.data.connectionId === connectionId)
        if (existingTabs.length === 0) {
          await tabsStore.restoreTabSession(connectionId, database)
        }
      }
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="flex flex-col h-screen">
    <div class="flex flex-1 overflow-hidden">
      <ConnectionRail v-if="showConnectionRail" />

      <!-- Home (no connection selected) -->
      <HomeView v-if="!activeConnectionId" class="flex-1" @new-connection="emit('new-connection')"
        @edit-connection="(id: string) => emit('edit-connection', id)"
        @import-from-url="emit('import-from-url')" />

      <!-- Connected layout (header + sidebar + content + footer) -->
      <div v-else class="flex flex-col flex-1 min-w-0">
        <HeaderBar :inset-left="!showConnectionRail" :sidebar-visible="sidebarVisible" :right-panel-visible="rightPanelVisible" @toggle-sidebar="toggleSidebar" @toggle-right-panel="toggleRightPanel" />
        <div class="flex flex-1 min-h-0">
          <!-- Sidebar (full height) -->
          <div v-show="sidebarVisible" class="flex-shrink-0 relative" :style="{ width: sidebarWidth + 'px' }">
            <Sidebar class="h-full" />
            <!-- Resize handle -->
            <div
              class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10"
              :class="{ 'bg-primary/30': isResizing }"
              @mousedown.prevent="startResize"
            />
          </div>

          <!-- Content + footer column -->
          <div class="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
            <div class=" flex-shrink-0 titlebar-drag" />
            <TabBar v-if="tabsStore.tabs.length > 0" />
            <div class="flex-1 overflow-hidden">
              <PanelContent :tab-id="tabsStore.activeTabId" />
            </div>

            <!-- Status bar -->
            <StatusBar class="flex-shrink-0" />
          </div>

          <!-- Right Panel (same level as sidebar) -->
          <div v-show="rightPanelVisible" class="flex-shrink-0 relative" :style="{ width: rightPanelWidth + 'px' }">
            <!-- Resize handle (left edge) -->
            <div
              class="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10"
              :class="{ 'bg-primary/30': isResizingRight }"
              @mousedown.prevent="startResizeRight"
            />
            <RowDetailPanel
              class="h-full"
              :row="rightPanelData.row"
              :columns="rightPanelData.columns"
              :row-index="rightPanelData.rowIndex"
              :pending-changes="rightPanelData.pendingChanges"
              @update-cell="rightPanelData.onUpdateCell?.($event)"
              @close="rightPanelVisible = false"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>