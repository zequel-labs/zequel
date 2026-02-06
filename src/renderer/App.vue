<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useRecentsStore } from '@/stores/recents'
import { useGlobalKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useAutoUpdater } from '@/composables/useAutoUpdater'
import { useTabs } from '@/composables/useTabs'
import { usePlatform } from '@/composables/usePlatform'
import type { ConnectionConfig } from '@/types/connection'
import MainLayout from '@/components/layout/MainLayout.vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'
import CommandPalette from '@/components/dialogs/CommandPalette.vue'
import { SearchResultType, type SearchResult } from '@/types/search'
import KeyboardShortcutsDialog from '@/components/dialogs/KeyboardShortcutsDialog.vue'
import { Sonner } from '@/components/ui/sonner'

const connectionsStore = useConnectionsStore()
const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const recentsStore = useRecentsStore()

// Register global keyboard shortcuts
useGlobalKeyboardShortcuts()

const { openUsersTab, openMonitoringTab } = useTabs()

// Initialize auto-updater listener
useAutoUpdater()

// Notify main process when connection status changes to update menu state
watch(() => connectionsStore.activeConnectionId, (id) => {
  window.electron?.ipcRenderer.send('menu:connection-status', !!id)
}, { immediate: true })

// Set platform CSS variable for titlebar height
const { isMac } = usePlatform()
document.documentElement.style.setProperty('--titlebar-height', isMac.value ? '38px' : '0px')

const showConnectionDialog = ref(false)
const showCommandPalette = ref(false)
const showShortcutsDialog = ref(false)
const editingConnection = ref<import('@/types/connection').SavedConnection | null>(null)

const handleCommandPaletteShortcut = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (!connectionsStore.activeConnectionId) return
    showCommandPalette.value = !showCommandPalette.value
  }
}

// Listeners for custom events dispatched by keyboard shortcuts
const handleToggleShortcutsDialog = () => {
  showShortcutsDialog.value = !showShortcutsDialog.value
}

const handleToggleCommandPalette = () => {
  if (!connectionsStore.activeConnectionId) return
  showCommandPalette.value = !showCommandPalette.value
}

const handleOpenSettings = () => {
  // Dispatch a settings event; this can be extended later when a settings dialog exists
  window.dispatchEvent(new CustomEvent('zequel:settings-requested'))
}

onMounted(() => {
  connectionsStore.loadConnections()
  settingsStore.loadSettings()
  recentsStore.loadRecents()
  window.addEventListener('keydown', handleCommandPaletteShortcut)
  window.addEventListener('zequel:toggle-shortcuts-dialog', handleToggleShortcutsDialog)
  window.addEventListener('zequel:toggle-command-palette', handleToggleCommandPalette)
  window.addEventListener('zequel:open-settings', handleOpenSettings)
  window.electron?.ipcRenderer.on('menu:toggle-shortcuts-dialog', handleToggleShortcutsDialog)
  window.electron?.ipcRenderer.on('menu:toggle-command-palette', handleToggleCommandPalette)
  window.electron?.ipcRenderer.on('menu:open-users', () => {
    if (connectionsStore.activeConnectionId) openUsersTab()
  })
  window.electron?.ipcRenderer.on('menu:open-monitoring', () => {
    if (connectionsStore.activeConnectionId) openMonitoringTab()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleCommandPaletteShortcut)
  window.removeEventListener('zequel:toggle-shortcuts-dialog', handleToggleShortcutsDialog)
  window.removeEventListener('zequel:toggle-command-palette', handleToggleCommandPalette)
  window.removeEventListener('zequel:open-settings', handleOpenSettings)
  window.electron?.ipcRenderer.removeAllListeners('menu:toggle-shortcuts-dialog')
  window.electron?.ipcRenderer.removeAllListeners('menu:toggle-command-palette')
  window.electron?.ipcRenderer.removeAllListeners('menu:open-users')
  window.electron?.ipcRenderer.removeAllListeners('menu:open-monitoring')
})

const handleNewConnection = () => {
  editingConnection.value = null
  showConnectionDialog.value = true
}

const handleEditConnection = (id: string) => {
  const connection = connectionsStore.connections.find(c => c.id === id)
  if (connection) {
    editingConnection.value = connection
    // Delay opening so the DropdownMenu's DismissableLayer fully cleans up
    // pointer-events on <body> before the Dialog layer captures the original value
    setTimeout(() => {
      showConnectionDialog.value = true
    }, 150)
  }
}

const cleanupDialogState = () => {
  editingConnection.value = null
  setTimeout(() => {
    document.body.style.pointerEvents = ''
  }, 150)
}

const handleSaveConnection = async (config: ConnectionConfig) => {
  await connectionsStore.saveConnection(config)
  showConnectionDialog.value = false
  cleanupDialogState()
}

const handleConnectWithConfig = async (config: ConnectionConfig) => {
  try {
    await connectionsStore.connectWithConfig(config)
    showConnectionDialog.value = false
    cleanupDialogState()
  } catch {
    // Error state is managed by the store
  }
}

const handleDialogOpenChange = (open: boolean) => {
  showConnectionDialog.value = open
  if (!open) {
    cleanupDialogState()
  }
}

const handleSearchSelect = (result: SearchResult) => {
  const connectionId = result.connectionId || connectionsStore.activeConnectionId
  if (!connectionId) return

  switch (result.type) {
    case SearchResultType.Table:
      tabsStore.createTableTab(connectionId, result.name, result.database, result.schema)
      break
    case SearchResultType.View:
      tabsStore.createViewTab(connectionId, result.name, result.database, result.schema)
      break
    case SearchResultType.Query:
    case SearchResultType.SavedQuery:
    case SearchResultType.Bookmark:
      if (result.sql) {
        tabsStore.createQueryTab(connectionId, result.sql, result.name)
      }
      break
    case SearchResultType.Column:
      if (result.tableName) {
        tabsStore.createTableTab(connectionId, result.tableName, result.database, result.schema)
      }
      break
    case SearchResultType.Recent:
      if (result.sql) {
        tabsStore.createQueryTab(connectionId, result.sql, result.name)
      } else {
        tabsStore.createTableTab(connectionId, result.name, result.database, result.schema)
      }
      break
  }

  showCommandPalette.value = false
}


</script>

<template>
  <MainLayout @new-connection="handleNewConnection" @edit-connection="handleEditConnection" />

  <!-- New Connection Dialog -->
  <Dialog :open="showConnectionDialog" @update:open="handleDialogOpenChange">
    <DialogContent class="max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
      <DialogHeader>
        <DialogTitle>{{ editingConnection ? 'Edit Connection' : 'New Connection' }}</DialogTitle>
      </DialogHeader>
      <ConnectionForm :connection="editingConnection" @save="handleSaveConnection" @connect="handleConnectWithConfig" />
    </DialogContent>
  </Dialog>

  <!-- Command Palette -->
  <CommandPalette :open="showCommandPalette" @close="showCommandPalette = false" @select="handleSearchSelect" />

  <!-- Keyboard Shortcuts Help Dialog -->
  <KeyboardShortcutsDialog v-model:open="showShortcutsDialog" />

  <!-- Global Toast -->
  <Sonner />
</template>