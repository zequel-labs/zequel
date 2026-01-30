<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useRecentsStore } from '@/stores/recents'
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
import ImportConnectionDialog from '@/components/connection/ImportConnectionDialog.vue'
import CommandPalette, { type SearchResult } from '@/components/dialogs/CommandPalette.vue'
import KeyboardShortcutsDialog from '@/components/dialogs/KeyboardShortcutsDialog.vue'
import { Sonner } from '@/components/ui/sonner'

const connectionsStore = useConnectionsStore()
const settingsStore = useSettingsStore()
const tabsStore = useTabsStore()
const recentsStore = useRecentsStore()

// Register global keyboard shortcuts
useGlobalKeyboardShortcuts()

const showConnectionDialog = ref(false)
const showImportDialog = ref(false)
const showCommandPalette = ref(false)
const showShortcutsDialog = ref(false)
const editingConnection = ref<import('@/types/connection').SavedConnection | null>(null)

function handleCommandPaletteShortcut(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    showCommandPalette.value = !showCommandPalette.value
  }
}

// Listeners for custom events dispatched by keyboard shortcuts
function handleToggleShortcutsDialog() {
  showShortcutsDialog.value = !showShortcutsDialog.value
}

function handleToggleCommandPalette() {
  showCommandPalette.value = !showCommandPalette.value
}

function handleOpenSettings() {
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
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleCommandPaletteShortcut)
  window.removeEventListener('zequel:toggle-shortcuts-dialog', handleToggleShortcutsDialog)
  window.removeEventListener('zequel:toggle-command-palette', handleToggleCommandPalette)
  window.removeEventListener('zequel:open-settings', handleOpenSettings)
})

function handleNewConnection() {
  editingConnection.value = null
  showConnectionDialog.value = true
}

function handleEditConnection(id: string) {
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

function handleImportFromUrl() {
  showImportDialog.value = true
}

function cleanupDialogState() {
  editingConnection.value = null
  setTimeout(() => {
    document.body.style.pointerEvents = ''
  }, 150)
}

async function handleSaveConnection(config: ConnectionConfig) {
  await connectionsStore.saveConnection(config)
  showConnectionDialog.value = false
  cleanupDialogState()
}

function handleImportDialogOpenChange(open: boolean) {
  showImportDialog.value = open
  if (!open) {
    setTimeout(() => {
      document.body.style.pointerEvents = ''
    }, 150)
  }
}

async function handleImportSave(config: ConnectionConfig) {
  await connectionsStore.saveConnection(config)
  showImportDialog.value = false
  setTimeout(() => {
    document.body.style.pointerEvents = ''
  }, 150)
}

function handleCancelDialog() {
  showConnectionDialog.value = false
  cleanupDialogState()
}

function handleDialogOpenChange(open: boolean) {
  showConnectionDialog.value = open
  if (!open) {
    cleanupDialogState()
  }
}

function handleSearchSelect(result: SearchResult) {
  const connectionId = result.connectionId || connectionsStore.activeConnectionId
  if (!connectionId) return

  switch (result.type) {
    case 'table':
      tabsStore.createTableTab(connectionId, result.name, result.database, result.schema)
      break
    case 'view':
      tabsStore.createViewTab(connectionId, result.name, result.database, result.schema)
      break
    case 'query':
    case 'saved_query':
    case 'bookmark':
      if (result.sql) {
        tabsStore.createQueryTab(connectionId, result.sql, result.name)
      }
      break
    case 'column':
      if (result.tableName) {
        tabsStore.createTableTab(connectionId, result.tableName, result.database, result.schema)
      }
      break
    case 'recent':
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
  <MainLayout
    @new-connection="handleNewConnection"
    @edit-connection="handleEditConnection"
    @import-from-url="handleImportFromUrl"
  />

  <!-- New Connection Dialog -->
  <Dialog :open="showConnectionDialog" @update:open="handleDialogOpenChange">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ editingConnection ? 'Edit Connection' : 'New Connection' }}</DialogTitle>
      </DialogHeader>
      <ConnectionForm
        :connection="editingConnection"
        @save="handleSaveConnection"
        @cancel="handleCancelDialog"
      />
    </DialogContent>
  </Dialog>

  <!-- Import from URL Dialog -->
  <ImportConnectionDialog
    :open="showImportDialog"
    @update:open="handleImportDialogOpenChange"
    @save="handleImportSave"
  />

  <!-- Command Palette -->
  <CommandPalette
    :open="showCommandPalette"
    @close="showCommandPalette = false"
    @select="handleSearchSelect"
  />

  <!-- Keyboard Shortcuts Help Dialog -->
  <KeyboardShortcutsDialog v-model:open="showShortcutsDialog" />

  <!-- Global Toast -->
  <Sonner />
</template>
