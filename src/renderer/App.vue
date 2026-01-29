<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import MainLayout from '@/components/layout/MainLayout.vue'
import HomeView from '@/views/HomeView.vue'
import QueryView from '@/views/QueryView.vue'
import TableView from '@/views/TableView.vue'
import Dialog from '@/components/ui/Dialog.vue'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'

const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()

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
  </MainLayout>

  <!-- New Connection Dialog -->
  <Dialog
    :open="showConnectionDialog"
    title="New Connection"
    class="max-w-xl"
    @update:open="showConnectionDialog = $event"
  >
    <ConnectionForm
      @save="handleSaveConnection"
      @cancel="handleCancelDialog"
    />
  </Dialog>
</template>
