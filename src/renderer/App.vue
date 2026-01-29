<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { useGlobalKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import type { ConnectionConfig } from '@/types/connection'
import MainLayout from '@/components/layout/MainLayout.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'

const connectionsStore = useConnectionsStore()
const settingsStore = useSettingsStore()

// Register global keyboard shortcuts
useGlobalKeyboardShortcuts()

const showConnectionDialog = ref(false)

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
  <MainLayout @new-connection="handleNewConnection" />

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
