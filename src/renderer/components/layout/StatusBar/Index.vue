<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import { formatDuration } from '@/lib/utils'
import StatusBarERDiagram from './StatusBarERDiagram.vue'
import StatusBarMonitoring from './StatusBarMonitoring.vue'
import StatusBarUsers from './StatusBarUsers.vue'
import StatusBarGrid from './StatusBarGrid.vue'

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

const activeTab = computed(() => tabsStore.activeTab)

const hasQueryResult = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return formatDuration(activeTab.value.data.result.executionTime) !== null
  }
  return false
})

const hasContent = computed(() => {
  return statusBarStore.hasContent || hasQueryResult.value
})
</script>

<template>
  <StatusBarERDiagram v-if="statusBarStore.showERDiagramControls" />
  <StatusBarMonitoring v-else-if="statusBarStore.showMonitoringControls" />
  <StatusBarUsers v-else-if="statusBarStore.showUsersControls" />
  <StatusBarGrid v-else-if="hasContent" />
</template>
