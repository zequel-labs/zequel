<script setup lang="ts">
import { ref } from 'vue'
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { useSettingsStore } from '@/stores/settings'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import StatusBar from './StatusBar.vue'

const emit = defineEmits<{
  (e: 'new-connection'): void
}>()

const settingsStore = useSettingsStore()
const sidebarSize = ref(20)

function handleSidebarResize(panes: { size: number }[]) {
  if (panes[0]) {
    settingsStore.setSidebarWidth(panes[0].size * 14) // Convert percentage to approximate pixels
  }
}
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
        <div class="flex flex-col h-full">
          <!-- Tab bar -->
          <TabBar />

          <!-- Content area -->
          <div class="flex-1 overflow-hidden">
            <slot />
          </div>
        </div>
      </Pane>
    </Splitpanes>

    <!-- Status bar -->
    <StatusBar />
  </div>
</template>
