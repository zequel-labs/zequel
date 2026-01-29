<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useSplitViewStore } from '@/stores/splitView'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import StatusBar from './StatusBar.vue'
import PanelContent from './PanelContent.vue'

const emit = defineEmits<{
  (e: 'new-connection'): void
}>()

const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const splitViewStore = useSplitViewStore()

const sidebarSize = ref(20)

const isSplit = computed(() => splitViewStore.isSplit)
const splitDirection = computed(() => splitViewStore.splitDirection)
const mainPanelActiveTab = computed(() => splitViewStore.mainPanel?.activeTabId)
const secondPanelActiveTab = computed(() => splitViewStore.secondPanel?.activeTabId)

function handleSidebarResize(panes: { size: number }[]) {
  if (panes[0]) {
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
    <Splitpanes
      class="flex-1"
      @resize="handleSidebarResize"
    >
      <!-- Sidebar -->
      <Pane :size="sidebarSize" :min-size="15" :max-size="35">
        <Sidebar @new-connection="emit('new-connection')" />
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

    <!-- Status bar -->
    <StatusBar />
  </div>
</template>
