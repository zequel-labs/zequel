<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useGlobalKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import MainLayout from '@/components/layout/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import QueryView from '@/views/QueryView.vue'
import TableView from '@/views/TableView.vue'
import ViewView from '@/views/ViewView.vue'
import ERDiagramView from '@/views/ERDiagramView.vue'
import RoutineView from '@/views/RoutineView.vue'
import UsersView from '@/views/UsersView.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'

const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()

// Register global keyboard shortcuts
useGlobalKeyboardShortcuts()

const showConnectionDialog = ref(false)

const activeTab = computed(() => tabsStore.activeTab)

const currentView = computed(() => {
  if (!activeTab.value) return 'home'
  return activeTab.value.data.type
})

onMounted(() => {
  // Load initial data
  connectionsStore.loadConnections()
  settingsStore.loadSettings()
})

function handleNewConnection() {
  showConnectionDialog.value = true
}

async function handleSaveConnection(config: ConnectionConfig) {
  await connectionsStore.saveConnection(config)
  showConnectionDialog.value = false
}

function handleCancelDialog() {
  showConnectionDialog.value = false
}
</script>

<template>
  <MainLayout @new-connection="handleNewConnection">
    <!-- Home View (no active tab) -->
    <HomeView v-if="currentView === 'home'" />

    <!-- Query Tab -->
    <QueryView
      v-else-if="currentView === 'query' && activeTab"
      :tab-id="activeTab.id"
    />

    <!-- Table Tab -->
    <TableView
      v-else-if="currentView === 'table' && activeTab"
      :tab-id="activeTab.id"
    />

    <!-- View Tab -->
    <ViewView
      v-else-if="currentView === 'view' && activeTab"
      :tab-id="activeTab.id"
    />

    <!-- ER Diagram Tab -->
    <ERDiagramView
      v-else-if="currentView === 'er-diagram' && activeTab"
    />

    <!-- Routine Tab -->
    <RoutineView
      v-else-if="currentView === 'routine' && activeTab"
      :tab-id="activeTab.id"
    />

    <!-- Users Tab -->
    <UsersView
      v-else-if="currentView === 'users' && activeTab"
      :tab-id="activeTab.id"
    />
  </MainLayout>

  <!-- New Connection Dialog -->
  <Dialog :open="showConnectionDialog" @update:open="showConnectionDialog = $event">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>New Connection</DialogTitle>
      </DialogHeader>
      <ConnectionForm
        @save="handleSaveConnection"
        @cancel="handleCancelDialog"
      />
    </DialogContent>
  </Dialog>
</template>
