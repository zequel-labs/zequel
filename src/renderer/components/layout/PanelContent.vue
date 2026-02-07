<script setup lang="ts">
import { computed, watch, defineAsyncComponent } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import QueryView from '@/views/QueryView.vue'
import TableView from '@/views/TableView.vue'
import ViewView from '@/views/ViewView.vue'
import ERDiagramView from '@/views/ERDiagramView.vue'
import RoutineView from '@/views/RoutineView.vue'
import UsersView from '@/views/UsersView.vue'

// Lazy load monitoring view (might not exist yet)
const MonitoringView = defineAsyncComponent(() =>
  import('@/views/MonitoringView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Monitoring view not available</div>'
  }))
)

// Lazy load event view (MySQL-specific)
const EventView = defineAsyncComponent(() =>
  import('@/views/EventView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Event view not available</div>'
  }))
)

// Lazy load trigger view
const TriggerView = defineAsyncComponent(() =>
  import('@/views/TriggerView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Trigger view not available</div>'
  }))
)

// PostgreSQL-specific views
const SequenceView = defineAsyncComponent(() =>
  import('@/views/SequenceView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Sequence view not available</div>'
  }))
)

const MaterializedViewView = defineAsyncComponent(() =>
  import('@/views/MaterializedViewView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Materialized view not available</div>'
  }))
)

const ExtensionsView = defineAsyncComponent(() =>
  import('@/views/ExtensionsView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Extensions view not available</div>'
  }))
)

const CreateTableView = defineAsyncComponent(() =>
  import('@/views/CreateTableView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Create table view not available</div>'
  }))
)

interface Props {
  tabId: string | null
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

// Clear status bar when switching tabs — views that need it will re-configure via their own activeTabId watcher
watch(() => tabsStore.activeTabId, () => {
  statusBarStore.clear()
})

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

// Get all tabs for the current connection (these stay mounted)
const connectionTabs = computed(() => {
  if (!activeConnectionId.value) return []
  return tabsStore.tabs.filter(t => t.data.connectionId === activeConnectionId.value)
})

const hasActiveTab = computed(() => {
  if (!props.tabId) return false
  return connectionTabs.value.some(t => t.id === props.tabId)
})
</script>

<template>
  <div class="h-full relative">
    <!-- Empty state (no active tab) -->
    <div v-if="!hasActiveTab" class="flex flex-col items-center justify-center h-full">
      <p class="text-sm text-muted-foreground/50">Open a table or create a new query</p>
    </div>

    <!-- Render all connection tabs, show/hide with v-show -->
    <template v-for="tab in connectionTabs" :key="tab.id">
      <!-- Query Tab -->
      <div v-if="tab.data.type === TabType.Query" v-show="tab.id === tabId" class="h-full">
        <QueryView :tab-id="tab.id" />
      </div>

      <!-- Table Tab -->
      <div v-else-if="tab.data.type === TabType.Table" v-show="tab.id === tabId" class="h-full">
        <TableView :tab-id="tab.id" />
      </div>

      <!-- View Tab -->
      <div v-else-if="tab.data.type === TabType.View" v-show="tab.id === tabId" class="h-full">
        <ViewView :tab-id="tab.id" />
      </div>

      <!-- ER Diagram Tab -->
      <div v-else-if="tab.data.type === TabType.ERDiagram" v-show="tab.id === tabId" class="h-full">
        <ERDiagramView :tab-id="tab.id" />
      </div>

      <!-- Routine Tab -->
      <div v-else-if="tab.data.type === TabType.Routine" v-show="tab.id === tabId" class="h-full">
        <RoutineView :tab-id="tab.id" />
      </div>

      <!-- Users Tab -->
      <div v-else-if="tab.data.type === TabType.Users" v-show="tab.id === tabId" class="h-full">
        <UsersView :tab-id="tab.id" />
      </div>

      <!-- Monitoring Tab -->
      <div v-else-if="tab.data.type === TabType.Monitoring" v-show="tab.id === tabId" class="h-full">
        <MonitoringView :tab-id="tab.id" />
      </div>

      <!-- Event Tab (MySQL) -->
      <div v-else-if="tab.data.type === TabType.Event" v-show="tab.id === tabId" class="h-full">
        <EventView :tab-id="tab.id" />
      </div>

      <!-- Trigger Tab -->
      <div v-else-if="tab.data.type === TabType.Trigger" v-show="tab.id === tabId" class="h-full">
        <TriggerView :tab-id="tab.id" />
      </div>

      <!-- Sequence Tab (PostgreSQL) -->
      <div v-else-if="tab.data.type === TabType.Sequence" v-show="tab.id === tabId" class="h-full">
        <SequenceView :tab-id="tab.id" />
      </div>

      <!-- Materialized View Tab (PostgreSQL) -->
      <div v-else-if="tab.data.type === TabType.MaterializedView" v-show="tab.id === tabId" class="h-full">
        <MaterializedViewView :tab-id="tab.id" />
      </div>

      <!-- Extensions Tab (PostgreSQL) -->
      <div v-else-if="tab.data.type === TabType.Extensions" v-show="tab.id === tabId" class="h-full">
        <ExtensionsView :tab-id="tab.id" />
      </div>

      <!-- Create Table Tab -->
      <div v-else-if="tab.data.type === TabType.CreateTable" v-show="tab.id === tabId" class="h-full">
        <CreateTableView :tab-id="tab.id" />
      </div>
    </template>
  </div>
</template>
