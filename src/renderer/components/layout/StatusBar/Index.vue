<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import StatusBarERDiagram from './StatusBarERDiagram.vue'
import StatusBarMonitoring from './StatusBarMonitoring.vue'
import StatusBarUsers from './StatusBarUsers.vue'
import StatusBarTableProperties from './StatusBarTableProperties.vue'
import StatusBarRoutine from './StatusBarRoutine.vue'
import StatusBarTrigger from './StatusBarTrigger.vue'
import StatusBarExtensions from './StatusBarExtensions.vue'
import StatusBarMaterializedView from './StatusBarMaterializedView.vue'
import StatusBarSequence from './StatusBarSequence.vue'
import StatusBarEvent from './StatusBarEvent.vue'
import StatusBarQuery from './StatusBarQuery.vue'
import StatusBarGrid from './StatusBarGrid.vue'

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

const activeTab = computed(() => tabsStore.activeTab)

const isQueryTab = computed(() => activeTab.value?.data.type === TabType.Query)

const showQueryControls = computed(() => {
  if (isQueryTab.value && activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
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
  <StatusBarRoutine v-else-if="statusBarStore.showRoutineControls" />
  <StatusBarTrigger v-else-if="statusBarStore.showTriggerControls" />
  <StatusBarExtensions v-else-if="statusBarStore.showExtensionsControls" />
  <StatusBarMaterializedView v-else-if="statusBarStore.showMaterializedViewControls" />
  <StatusBarSequence v-else-if="statusBarStore.showSequenceControls" />
  <StatusBarEvent v-else-if="statusBarStore.showEventControls" />
  <StatusBarQuery v-else-if="showQueryControls" />
  <StatusBarGrid v-else-if="!isQueryTab && statusBarStore.hasContent" />
</template>
