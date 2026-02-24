<script setup lang="ts">
import { computed, watch, defineAsyncComponent } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'

// All views are lazy-loaded to keep the initial bundle small.
// Heavy dependencies (Monaco, Vue Flow, TanStack) only load when first needed.
const QueryView = defineAsyncComponent(() => import('@/views/QueryView.vue'))
const TableView = defineAsyncComponent(() => import('@/views/TableView.vue'))
const ViewView = defineAsyncComponent(() => import('@/views/ViewView.vue'))
const ERDiagramView = defineAsyncComponent(() => import('@/views/ERDiagramView.vue'))
const RoutineView = defineAsyncComponent(() => import('@/views/RoutineView.vue'))
const UsersView = defineAsyncComponent(() => import('@/views/UsersView.vue'))
const MonitoringView = defineAsyncComponent(() => import('@/views/MonitoringView.vue'))
const EventView = defineAsyncComponent(() => import('@/views/EventView.vue'))
const TriggerView = defineAsyncComponent(() => import('@/views/TriggerView.vue'))
const SequenceView = defineAsyncComponent(() => import('@/views/SequenceView.vue'))
const MaterializedViewView = defineAsyncComponent(() => import('@/views/MaterializedViewView.vue'))
const ExtensionsView = defineAsyncComponent(() => import('@/views/ExtensionsView.vue'))
const EnumsView = defineAsyncComponent(() => import('@/views/EnumsView.vue'))
const CreateTableView = defineAsyncComponent(() => import('@/views/CreateTableView.vue'))
const BackupView = defineAsyncComponent(() => import('@/views/BackupView.vue'))
const RestoreView = defineAsyncComponent(() => import('@/views/RestoreView.vue'))
const TablePropertiesView = defineAsyncComponent(() => import('@/views/TablePropertiesView.vue'))

interface Props {
  tabId: string | null
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

// Clear status bar when switching tabs — views that need it will re-configure via their own activeTabId watcher
watch(() => tabsStore.activeTabId, () => {
  statusBarStore.clear()
})

// Render ALL tabs across all connections so they stay mounted when switching.
// v-show hides inactive tabs without destroying them, preserving loaded data.
const allTabs = computed(() => tabsStore.tabs)

const hasActiveTab = computed(() => {
  if (!props.tabId) return false
  return allTabs.value.some(t => t.id === props.tabId)
})
</script>

<template>
  <div class="h-full relative">
    <!-- Empty state (no active tab) -->
    <div v-if="!hasActiveTab" class="flex flex-col items-center justify-center h-full">
      <p class="text-sm text-muted-foreground/50">Open a table or create a new query</p>
    </div>

    <!-- Render all tabs across connections, show/hide with v-show -->
    <template v-for="tab in allTabs" :key="tab.id">
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

      <!-- Enums Tab (PostgreSQL) -->
      <div v-else-if="tab.data.type === TabType.Enums" v-show="tab.id === tabId" class="h-full">
        <EnumsView :tab-id="tab.id" />
      </div>

      <!-- Create Table Tab -->
      <div v-else-if="tab.data.type === TabType.CreateTable" v-show="tab.id === tabId" class="h-full">
        <CreateTableView :tab-id="tab.id" />
      </div>

      <!-- Backup Tab -->
      <div v-else-if="tab.data.type === TabType.Backup" v-show="tab.id === tabId" class="h-full">
        <BackupView :tab-id="tab.id" />
      </div>

      <!-- Restore Tab -->
      <div v-else-if="tab.data.type === TabType.Restore" v-show="tab.id === tabId" class="h-full">
        <RestoreView :tab-id="tab.id" />
      </div>

      <!-- Table Properties Tab -->
      <div v-else-if="tab.data.type === TabType.TableProperties" v-show="tab.id === tabId" class="h-full">
        <TablePropertiesView :tab-id="tab.id" />
      </div>
    </template>
  </div>
</template>
