<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import StatusBarERDiagram from './StatusBarERDiagram.vue'
import StatusBarMonitoring from './StatusBarMonitoring.vue'
import StatusBarUsers from './StatusBarUsers.vue'
import StatusBarTableProperties from './StatusBarTableProperties.vue'
import StatusBarQuery from './StatusBarQuery.vue'
import StatusBarGrid from './StatusBarGrid.vue'

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

const activeTab = computed(() => tabsStore.activeTab)

const showQueryControls = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return true
  }
  return false
})
</script>

<template>
  <StatusBarERDiagram v-if="statusBarStore.showERDiagramControls" />
  <StatusBarMonitoring v-else-if="statusBarStore.showMonitoringControls" />
  <StatusBarUsers v-else-if="statusBarStore.showUsersControls" />
  <StatusBarTableProperties v-else-if="statusBarStore.showTablePropertiesControls" />
  <StatusBarQuery v-else-if="showQueryControls" />
  <StatusBarGrid v-else-if="statusBarStore.hasContent" />
</template>
