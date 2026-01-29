<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useSplitViewStore } from '@/stores/splitView'
import { useConnectionsStore } from '@/stores/connections'
import ConnectionRail from './ConnectionRail.vue'
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

const sidebarSize = ref(settingsStore.sidebarWidth / 14)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)
const isSplit = computed(() => splitViewStore.isSplit)
const splitDirection = computed(() => splitViewStore.splitDirection)
const mainPanelActiveTab = computed(() => splitViewStore.mainPanel?.activeTabId)
const secondPanelActiveTab = computed(() => splitViewStore.secondPanel?.activeTabId)

function handleSidebarResize(panes: { size: number }[]) {
  if (panes[0]) {
    sidebarSize.value = panes[0].size
    settingsStore.setSidebarWidth(panes[0].size * 14)
  }
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
</script>

<template>
  <div class="flex flex-col h-screen">
    <div class="flex flex-1 overflow-hidden">
      <!-- Always visible -->
      <ConnectionRail @new-connection="emit('new-connection')" />

      <!-- Home (no connection selected) -->
      <HomeView
        v-if="!activeConnectionId"
        class="flex-1"
        @new-connection="emit('new-connection')"
        @edit-connection="(id: string) => emit('edit-connection', id)"
      />

      <!-- Connected layout (explorer + content) -->
      <Splitpanes
        v-else
        class="flex-1"
        @resize="handleSidebarResize"
      >
        <!-- Sidebar / Explorer -->
        <Pane :size="sidebarSize" :min-size="15" :max-size="35">
          <Sidebar />
        </Pane>

        <!-- Main content -->
        <Pane :size="100 - sidebarSize">
          <!-- Split view -->
          <Splitpanes
            v-if="isSplit"
            class="h-full"
            :horizontal="splitDirection === 'horizontal'"
          >
            <!-- Main panel -->
            <Pane :size="50" :min-size="20">
              <div
                class="flex flex-col h-full"
                :class="{ 'ring-2 ring-primary/50': splitViewStore.activePanelId === 'main' }"
                @click="splitViewStore.setActivePanel('main')"
              >
                <TabBar panel-id="main" />
                <div class="flex-1 overflow-hidden">
                  <PanelContent :tab-id="mainPanelActiveTab" />
                </div>
              </div>
            </Pane>

            <!-- Secondary panel -->
            <Pane :size="50" :min-size="20">
              <div
                class="flex flex-col h-full"
                :class="{ 'ring-2 ring-primary/50': splitViewStore.activePanelId === 'secondary' }"
                @click="splitViewStore.setActivePanel('secondary')"
              >
                <TabBar panel-id="secondary" />
                <div class="flex-1 overflow-hidden">
                  <PanelContent :tab-id="secondPanelActiveTab" />
                </div>
              </div>
            </Pane>
          </Splitpanes>

          <!-- Single panel (no split) -->
          <div v-else class="flex flex-col h-full">
            <TabBar panel-id="main" />
            <div class="flex-1 overflow-hidden">
              <PanelContent :tab-id="mainPanelActiveTab" />
            </div>
          </div>
        </Pane>
      </Splitpanes>
    </div>

    <!-- Status bar -->
    <StatusBar />
  </div>
</template>
