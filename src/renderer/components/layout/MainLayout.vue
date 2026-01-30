<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useSplitViewStore } from '@/stores/splitView'
import { useConnectionsStore } from '@/stores/connections'
import { debounce } from '@/lib/utils'
import ConnectionRail from './ConnectionRail.vue'
import HeaderBar from './HeaderBar.vue'
import HomeView from '@/views/HomeView.vue'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import StatusBar from './StatusBar.vue'
import PanelContent from './PanelContent.vue'

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
}>()

const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const splitViewStore = useSplitViewStore()
const connectionsStore = useConnectionsStore()

const sidebarWidth = ref(settingsStore.sidebarWidth || 260)
const isResizing = ref(false)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const isSplit = computed(() => splitViewStore.isSplit)
const splitDirection = computed(() => splitViewStore.splitDirection)
const mainPanelActiveTab = computed(() => splitViewStore.mainPanel?.activeTabId)
const secondPanelActiveTab = computed(() => splitViewStore.secondPanel?.activeTabId)

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

// Sync split view with tabs store
watch(
  () => tabsStore.tabs,
  () => {
    splitViewStore.syncWithTabs()
  },
  { deep: true, immediate: true }
)

// When a new tab is created, add it to the active panel
watch(
  () => tabsStore.activeTabId,
  (newTabId) => {
    if (newTabId) {
      const existingPanel = splitViewStore.getPanelForTab(newTabId)
      if (!existingPanel) {
        splitViewStore.addTabToPanel(newTabId)
      }
    }
  }
)

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
      <ConnectionRail v-if="connectionsStore.hasActiveConnections" />

      <!-- Home (no connection selected) -->
      <HomeView v-if="!activeConnectionId" class="flex-1" @new-connection="emit('new-connection')"
        @edit-connection="(id: string) => emit('edit-connection', id)" />

      <!-- Connected layout (header + sidebar + content + footer) -->
      <div v-else class="flex flex-col flex-1 min-w-0">
        <HeaderBar />
        <div class="flex flex-1 min-h-0">
          <!-- Sidebar (full height) -->
          <div class="flex-shrink-0 relative" :style="{ width: sidebarWidth + 'px' }">
            <Sidebar class="h-full" />
            <!-- Resize handle -->
            <div
              class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10"
              :class="{ 'bg-primary/30': isResizing }"
              @mousedown.prevent="startResize"
            />
          </div>

          <!-- Content + footer column -->
          <div class="flex flex-col flex-1 min-w-0">
            <!-- Split view -->
            <Splitpanes v-if="isSplit" class="flex-1 min-h-0" :horizontal="splitDirection === 'horizontal'">
              <!-- Main panel -->
              <Pane :size="50" :min-size="20">
                <div class="flex flex-col h-full"
                  :class="{ 'ring-2 ring-primary/50': splitViewStore.activePanelId === 'main' }"
                  @click="splitViewStore.setActivePanel('main')">
                  <div class=" flex-shrink-0 titlebar-drag" />
                  <TabBar panel-id="main" />
                  <div class="flex-1 overflow-hidden">
                    <PanelContent :tab-id="mainPanelActiveTab" />
                  </div>
                </div>
              </Pane>

              <!-- Secondary panel -->
              <Pane :size="50" :min-size="20">
                <div class="flex flex-col h-full"
                  :class="{ 'ring-2 ring-primary/50': splitViewStore.activePanelId === 'secondary' }"
                  @click="splitViewStore.setActivePanel('secondary')">
                  <div v-if="splitDirection !== 'horizontal'" class=" flex-shrink-0 titlebar-drag" />
                  <TabBar panel-id="secondary" />
                  <div class="flex-1 overflow-hidden">
                    <PanelContent :tab-id="secondPanelActiveTab" />
                  </div>
                </div>
              </Pane>
            </Splitpanes>

            <!-- Single panel (no split) -->
            <div v-else class="flex flex-col flex-1 min-h-0">
              <div class=" flex-shrink-0 titlebar-drag" />
              <TabBar panel-id="main" />
              <div class="flex-1 overflow-hidden">
                <PanelContent :tab-id="mainPanelActiveTab" />
              </div>
            </div>

            <!-- Status bar -->
            <StatusBar class="flex-shrink-0" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>