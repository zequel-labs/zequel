<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useQueryLogStore } from '@/stores/queryLog'
import { useLayoutStore } from '@/stores/layout'
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
const layoutStore = useLayoutStore()

onMounted(() => {
  queryLogStore.init()
  connectionsStore.initConnectionStatusListener()
})

layoutStore.sidebarWidth = settingsStore.sidebarWidth || 260
const isResizing = ref(false)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

// When the active connection changes, switch tabs to that connection's last active tab
watch(activeConnectionId, (newId) => {
  if (newId) {
    tabsStore.switchToConnection(newId)
  }
})
const showConnectionRail = computed(() => connectionsStore.connectedConnections.length > 1)
const isResizingRight = ref(false)
const isResizingBottom = ref(false)

// Clear right panel data when switching tabs
watch(() => tabsStore.activeTabId, () => {
  layoutStore.clearRightPanel()
})

onMounted(() => {
  window.electron?.ipcRenderer.on('menu:toggle-sidebar', layoutStore.toggleSidebar)
  window.electron?.ipcRenderer.on('menu:toggle-bottom-panel', layoutStore.toggleBottomPanel)
  window.electron?.ipcRenderer.on('menu:toggle-right-panel', layoutStore.toggleRightPanel)
})

onUnmounted(() => {
  window.electron?.ipcRenderer.removeAllListeners('menu:toggle-sidebar')
  window.electron?.ipcRenderer.removeAllListeners('menu:toggle-bottom-panel')
  window.electron?.ipcRenderer.removeAllListeners('menu:toggle-right-panel')
})

const startResizeBottom = (e: MouseEvent) => {
  isResizingBottom.value = true
  const startY = e.clientY
  const startHeight = layoutStore.bottomPanelHeight

  const onMouseMove = (e: MouseEvent) => {
    const delta = startY - e.clientY
    const newHeight = Math.max(100, Math.min(500, startHeight + delta))
    layoutStore.bottomPanelHeight = newHeight
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
  const startWidth = layoutStore.rightPanelWidth

  const onMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX
    const newWidth = Math.max(200, Math.min(600, startWidth + delta))
    layoutStore.rightPanelWidth = newWidth
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
  const startWidth = layoutStore.sidebarWidth

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX
    const newWidth = Math.max(180, Math.min(500, startWidth + delta))
    layoutStore.sidebarWidth = newWidth
  }

  const onMouseUp = () => {
    isResizing.value = false
    settingsStore.setSidebarWidth(layoutStore.sidebarWidth)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

</script>

<template>
  <div class="flex flex-col h-screen">
    <div class="flex flex-1 overflow-hidden">
      <ConnectionRail v-if="showConnectionRail" />

      <!-- Home (no connection selected) -->
      <HomeView v-if="!activeConnectionId" class="flex-1" />

      <!-- Connected layout (header + sidebar + content + footer) -->
      <div v-else class="flex flex-col flex-1 min-w-0">
        <HeaderBar :inset-left="!showConnectionRail" />
        <div class="flex flex-1 min-h-0">
          <!-- Sidebar (full height) -->
          <div v-show="layoutStore.sidebarVisible" class="flex-shrink-0 relative" :style="{ width: layoutStore.sidebarWidth + 'px' }">
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
            <TabBar v-if="tabsStore.tabs.length > 0" />
            <div class="flex-1 overflow-hidden">
              <PanelContent :tab-id="tabsStore.activeTabId" />
            </div>

            <!-- Status bar (only visible for data/query tabs) -->
            <StatusBar v-if="tabsStore.activeTab" class="flex-shrink-0" />

            <!-- Bottom Panel (below status bar) -->
            <div v-show="layoutStore.bottomPanelVisible" class="flex-shrink-0 relative" :style="{ height: layoutStore.bottomPanelHeight + 'px' }">
              <!-- Resize handle (top edge) -->
              <div
                class="absolute top-0 left-0 w-full h-1 cursor-row-resize hover:bg-primary/30 transition-colors z-10"
                :class="{ 'bg-primary/30': isResizingBottom }"
                @mousedown.prevent="startResizeBottom"
              />
              <BottomPanel
                class="h-full"
                @close="layoutStore.bottomPanelVisible = false"
              />
            </div>
          </div>

          <!-- Right Panel (same level as sidebar) -->
          <div v-show="layoutStore.rightPanelVisible" class="flex-shrink-0 relative" :style="{ width: layoutStore.rightPanelWidth + 'px' }">
            <!-- Resize handle (left edge) -->
            <div
              class="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10"
              :class="{ 'bg-primary/30': isResizingRight }"
              @mousedown.prevent="startResizeRight"
            />
            <RowDetailPanel
              class="h-full"
              :row="layoutStore.rightPanelRow"
              :columns="layoutStore.rightPanelColumns"
              :row-index="layoutStore.rightPanelRowIndex"
              :pending-changes="layoutStore.rightPanelPendingChanges"
              @update-cell="layoutStore.rightPanelOnUpdateCell?.($event)"
              @close="layoutStore.rightPanelVisible = false"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>