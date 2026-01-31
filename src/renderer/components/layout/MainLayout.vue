<script setup lang="ts">
import { ref, computed, watch, provide, reactive, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useQueryLogStore } from '@/stores/queryLog'
import { ConnectionStatus } from '@/types/connection'
import { TabType } from '@/types/table'
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
import BottomPanel from './BottomPanel.vue'

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
}>()

const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const queryLogStore = useQueryLogStore()

onMounted(() => {
  queryLogStore.init()
  connectionsStore.initConnectionStatusListener()
})

const sidebarWidth = ref(settingsStore.sidebarWidth || 260)
const isResizing = ref(false)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

// When the active connection changes, switch tabs to that connection's last active tab
watch(activeConnectionId, (newId) => {
  if (newId) {
    tabsStore.switchToConnection(newId)
  }
})
const showConnectionRail = computed(() => connectionsStore.connectedConnections.length > 1)
const sidebarVisible = ref(true)
const rightPanelVisible = ref(false)
const rightPanelWidth = ref(320)
const isResizingRight = ref(false)
const bottomPanelVisible = ref(false)
const bottomPanelHeight = ref(200)
const isResizingBottom = ref(false)

const rightPanelData = reactive({
  row: null as Record<string, unknown> | null,
  columns: [] as ColumnInfo[],
  rowIndex: null as number | null,
  pendingChanges: new Map() as Map<string, CellChange>,
  onUpdateCell: null as ((change: CellChange) => void) | null
})

provide('rightPanelVisible', rightPanelVisible)
provide('rightPanelData', rightPanelData)

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const toggleRightPanel = () => {
  rightPanelVisible.value = !rightPanelVisible.value
}

const toggleBottomPanel = () => {
  bottomPanelVisible.value = !bottomPanelVisible.value
}

const startResizeBottom = (e: MouseEvent) => {
  isResizingBottom.value = true
  const startY = e.clientY
  const startHeight = bottomPanelHeight.value

  const onMouseMove = (e: MouseEvent) => {
    const delta = startY - e.clientY
    const newHeight = Math.max(100, Math.min(500, startHeight + delta))
    bottomPanelHeight.value = newHeight
  }

  const onMouseUp = () => {
    isResizingBottom.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const startResizeRight = (e: MouseEvent) => {
  isResizingRight.value = true
  const startX = e.clientX
  const startWidth = rightPanelWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX
    const newWidth = Math.max(200, Math.min(600, startWidth + delta))
    rightPanelWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizingRight.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX
    const newWidth = Math.max(180, Math.min(500, startWidth + delta))
    sidebarWidth.value = newWidth
  }

  const onMouseUp = () => {
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
    const database = connectionsStore.getActiveDatabase(connectionId)
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
      const database = connectionsStore.getActiveDatabase(connectionId)
      const restoreKey = `${connectionId}:${database}`
      if (state.status === ConnectionStatus.Connected && !restoredConnections.has(restoreKey)) {
        restoredConnections.add(restoreKey)
        // Only restore if there are no existing tabs for this connection
        const existingTabs = tabsStore.tabs.filter(t => t.data.connectionId === connectionId)
        if (existingTabs.length === 0) {
          const isActive = connectionsStore.activeConnectionId === connectionId
          await tabsStore.restoreTabSession(connectionId, database, isActive)
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
      <HomeView v-if="!activeConnectionId" class="flex-1" />

      <!-- Connected layout (header + sidebar + content + footer) -->
      <div v-else class="flex flex-col flex-1 min-w-0">
        <HeaderBar :inset-left="!showConnectionRail" :sidebar-visible="sidebarVisible" :right-panel-visible="rightPanelVisible" :bottom-panel-visible="bottomPanelVisible" @toggle-sidebar="toggleSidebar" @toggle-right-panel="toggleRightPanel" @toggle-bottom-panel="toggleBottomPanel" />
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

            <!-- Status bar (hidden for ER diagrams) -->
            <StatusBar v-if="tabsStore.activeTab?.data.type !== TabType.ERDiagram" class="flex-shrink-0" />

            <!-- Bottom Panel (below status bar) -->
            <div v-show="bottomPanelVisible" class="flex-shrink-0 relative" :style="{ height: bottomPanelHeight + 'px' }">
              <!-- Resize handle (top edge) -->
              <div
                class="absolute top-0 left-0 w-full h-1 cursor-row-resize hover:bg-primary/30 transition-colors z-10"
                :class="{ 'bg-primary/30': isResizingBottom }"
                @mousedown.prevent="startResizeBottom"
              />
              <BottomPanel
                class="h-full"
                @close="bottomPanelVisible = false"
              />
            </div>
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