<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
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

const EnumsView = defineAsyncComponent(() =>
  import('@/views/EnumsView.vue').catch(() => ({
    template: '<div class="p-4 text-muted-foreground">Enums view not available</div>'
  }))
)

interface Props {
  tabId: string | null
}

const props = defineProps<Props>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const tab = computed(() => {
  if (!props.tabId) return null
  const found = tabsStore.tabs.find(t => t.id === props.tabId)
  if (!found) return null
  // Hide tab content if it belongs to a different connection
  if (connectionsStore.activeConnectionId && found.data.connectionId !== connectionsStore.activeConnectionId) {
    return null
  }
  return found
})

const viewType = computed(() => {
  if (!tab.value) return 'home'
  return tab.value.data.type
})
</script>

<template>
  <div class="h-full">
    <!-- Empty state (no active tab) -->
    <div v-if="viewType === 'home'" class="flex flex-col items-center justify-center h-full">
      <p class="text-sm text-muted-foreground/50">Open a table or create a new query</p>
    </div>

    <!-- Query Tab -->
    <QueryView
      v-else-if="viewType === 'query' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Table Tab -->
    <TableView
      v-else-if="viewType === 'table' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- View Tab -->
    <ViewView
      v-else-if="viewType === 'view' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- ER Diagram Tab -->
    <ERDiagramView
      v-else-if="viewType === 'er-diagram' && tab"
      :key="tab.id"
    />

    <!-- Routine Tab -->
    <RoutineView
      v-else-if="viewType === 'routine' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Users Tab -->
    <UsersView
      v-else-if="viewType === 'users' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Monitoring Tab -->
    <MonitoringView
      v-else-if="viewType === 'monitoring' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Event Tab (MySQL) -->
    <EventView
      v-else-if="viewType === 'event' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Trigger Tab -->
    <TriggerView
      v-else-if="viewType === 'trigger' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Sequence Tab (PostgreSQL) -->
    <SequenceView
      v-else-if="viewType === 'sequence' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Materialized View Tab (PostgreSQL) -->
    <MaterializedViewView
      v-else-if="viewType === 'materialized-view' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Extensions Tab (PostgreSQL) -->
    <ExtensionsView
      v-else-if="viewType === 'extensions' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />

    <!-- Enums Tab (PostgreSQL) -->
    <EnumsView
      v-else-if="viewType === 'enums' && tab"
      :key="tab.id"
      :tab-id="tab.id"
    />
  </div>
</template>
