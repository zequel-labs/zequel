<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import { IconDatabase, IconPlus, IconFileCode } from '@tabler/icons-vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'
import ConnectionList from '@/components/connection/ConnectionList.vue'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'

const connectionsStore = useConnectionsStore()
const { openQueryTab } = useTabs()

const showConnectionDialog = ref(false)
const editingConnection = ref<SavedConnection | null>(null)

onMounted(() => {
  connectionsStore.loadConnections()
})

function handleNewConnection() {
  editingConnection.value = null
  showConnectionDialog.value = true
}

function handleEditConnection(connection: SavedConnection) {
  editingConnection.value = connection
  showConnectionDialog.value = true
}

async function handleSaveConnection(config: ConnectionConfig) {
  await connectionsStore.saveConnection(config)
  showConnectionDialog.value = false
  editingConnection.value = null
}

async function handleDeleteConnection(connection: SavedConnection) {
  if (confirm(`Are you sure you want to delete "${connection.name}"?`)) {
    await connectionsStore.deleteConnection(connection.id)
  }
}

async function handleConnect(connection: SavedConnection) {
  try {
    await connectionsStore.connect(connection.id)
    // Optionally open a new query tab after connecting
    openQueryTab()
  } catch (error) {
    console.error('Failed to connect:', error)
  }
}

function handleCancelDialog() {
  showConnectionDialog.value = false
  editingConnection.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b">
      <div>
        <h1 class="text-2xl font-bold">Welcome to DB Studio</h1>
        <p class="text-muted-foreground mt-1">
          Manage your database connections and explore your data
        </p>
      </div>
      <Button @click="handleNewConnection">
        <IconPlus class="h-4 w-4 mr-2" />
        New Connection
      </Button>
    </div>

    <!-- Quick Actions -->
    <div class="px-6 py-4 border-b bg-muted/30">
      <h2 class="text-sm font-medium mb-3">Quick Actions</h2>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="!connectionsStore.isConnected"
          @click="openQueryTab()"
        >
          <IconFileCode class="h-4 w-4 mr-2" />
          New Query
        </Button>
      </div>
    </div>

    <!-- Connections -->
    <div class="flex-1 overflow-auto p-6">
      <h2 class="text-lg font-semibold mb-4">Your Connections</h2>
      <ConnectionList
        @edit="handleEditConnection"
        @delete="handleDeleteConnection"
        @connect="handleConnect"
      />
    </div>

    <!-- Connection Dialog -->
    <Dialog
      :open="showConnectionDialog"
      :title="editingConnection ? 'Edit Connection' : 'New Connection'"
      class="max-w-xl"
      @update:open="showConnectionDialog = $event"
    >
      <ConnectionForm
        :connection="editingConnection"
        @save="handleSaveConnection"
        @cancel="handleCancelDialog"
      />
    </Dialog>
  </div>
</template>
