<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { DatabaseType, ConnectionStatus } from '@/types/connection'
import { usePlatform } from '@/composables/usePlatform'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import ConfirmDeleteDialog from '@/components/schema/ConfirmDeleteDialog.vue'
import { IconDatabase } from '@tabler/icons-vue'
import { viewStateRegistry } from '@/stores/viewStateRegistry'

const { isMac } = usePlatform()
const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()
const pendingChangesStore = usePendingChangesStore()

const activeSessionId = computed(() => connectionsStore.activeSessionId)

const connectedSessions = computed(() => {
  const result: { sessionId: string; name: string; database: string; type: DatabaseType; color: string | null | undefined }[] = []
  for (const [sessionId] of connectionsStore.sessions) {
    const state = connectionsStore.connectionStates.get(sessionId)
    if (state?.status === ConnectionStatus.Connected || state?.status === ConnectionStatus.Reconnecting) {
      const conn = connectionsStore.getConnectionForSession(sessionId)
      if (conn) {
        result.push({
          sessionId,
          name: conn.name,
          database: connectionsStore.getActiveDatabase(sessionId),
          type: conn.type,
          color: conn.color
        })
      }
    }
  }
  return result
})

const showDiscardWarning = ref(false)
const pendingDisconnectId = ref<string | null>(null)
const pendingDisconnectMode = ref<'single' | 'others'>('single')

const handleConnectionClick = (sessionId: string) => {
  connectionsStore.setActiveConnection(sessionId)
}

// Switch activeSessionId away from a departing session BEFORE cleanup
// so PanelContent keeps the remaining connection's tabs mounted
// (prevents loss of in-progress state like backup steps).
const switchAwayFrom = (sessionId: string) => {
  if (connectionsStore.activeSessionId === sessionId) {
    const remaining = connectionsStore.connectedIds.filter(cid => cid !== sessionId)
    connectionsStore.setActiveConnection(remaining[0] || null)
  }
}

const handleCloseConnection = async (sessionId: string) => {
  if (pendingChangesStore.connectionHasPendingChanges(sessionId)) {
    pendingDisconnectId.value = sessionId
    pendingDisconnectMode.value = 'single'
    showDiscardWarning.value = true
    return
  }
  switchAwayFrom(sessionId)
  tabsStore.closeTabsForConnection(sessionId)
  await connectionsStore.disconnect(sessionId)
}

const handleCloseOtherConnections = async (sessionId: string) => {
  const others = connectionsStore.connectedIds.filter(cid => cid !== sessionId)
  const hasChanges = others.some(cid => pendingChangesStore.connectionHasPendingChanges(cid))
  if (hasChanges) {
    pendingDisconnectId.value = sessionId
    pendingDisconnectMode.value = 'others'
    showDiscardWarning.value = true
    return
  }
  connectionsStore.setActiveConnection(sessionId)
  for (const cid of others) {
    tabsStore.closeTabsForConnection(cid)
  }
  await connectionsStore.disconnectOthers(sessionId)
}

const handleConfirmDiscard = async () => {
  if (!pendingDisconnectId.value) return
  if (pendingDisconnectMode.value === 'single') {
    switchAwayFrom(pendingDisconnectId.value)
    pendingChangesStore.clearAllForConnection(pendingDisconnectId.value)
    tabsStore.closeTabsForConnection(pendingDisconnectId.value)
    await connectionsStore.disconnect(pendingDisconnectId.value)
  } else {
    connectionsStore.setActiveConnection(pendingDisconnectId.value)
    const others = connectionsStore.connectedIds.filter(cid => cid !== pendingDisconnectId.value)
    for (const cid of others) {
      pendingChangesStore.clearAllForConnection(cid)
      tabsStore.closeTabsForConnection(cid)
    }
    await connectionsStore.disconnectOthers(pendingDisconnectId.value)
  }
  pendingDisconnectId.value = null
}

const handleMoveToNewWindow = async (sessionId: string) => {
  const savedConnectionId = connectionsStore.getSavedConnectionId(sessionId)
  if (!savedConnectionId) return

  // Collect view state from all mounted tabs for this session
  const sessionTabIds = tabsStore.tabs
    .filter(t => t.data.connectionId === sessionId)
    .map(t => t.id)
  const viewStates = viewStateRegistry.collectForSession(sessionTabIds)

  // Serialize tabs WITH view state BEFORE any cleanup
  const tabState = tabsStore.serializeTabsForSession(sessionId, viewStates)

  try {
    // BigInt-safe serialization: database drivers may return BigInt for large integer columns
    const safeJson = JSON.stringify(tabState.tabs, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
    const activeDatabase = connectionsStore.getActiveDatabase(sessionId)
    const activeSchema = connectionsStore.getActiveSchema(sessionId)
    await window.api.app.openInNewWindow(
      sessionId,
      savedConnectionId,
      JSON.parse(safeJson),
      tabState.activeTabIndex,
      activeDatabase || undefined,
      activeSchema || undefined
    )
  } catch {
    toast.error('Failed to open in new window')
    return
  }

  switchAwayFrom(sessionId)

  // Only clean up after IPC succeeds — avoids data loss if the call fails.
  // Close tabs first, then wait for Vue to flush component unmounts
  // (onBeforeUnmount may re-save pending changes), then clear residual data.
  tabsStore.closeTabsForConnection(sessionId)
  await nextTick()
  pendingChangesStore.clearAllForConnection(sessionId)
  connectionsStore.removeLocalSession(sessionId)
}

const getConnectionLabel = (conn: { name: string; database: string; type: DatabaseType }) => {
  if (conn.type === DatabaseType.Redis || conn.type === DatabaseType.SQLite || conn.type === DatabaseType.DuckDB) return conn.name
  return conn.database || conn.name
}
</script>

<template>
  <div data-testid="connection-rail" class="flex h-full w-20 flex-col items-center border-r bg-muted/30">
    <!-- Platform Titlebar Spacer -->
    <div class="w-full platform-titlebar-spacer" />

    <!-- Connected Databases -->
    <ScrollArea class="flex-1 w-full">
      <div class="flex flex-col items-center gap-1 mt-4">
        <ContextMenu v-for="(session, index) in connectedSessions" :key="session.sessionId">
          <ContextMenuTrigger as-child>
            <button
              :data-testid="`connection-rail-item-${index}`"
              class="relative flex flex-col items-center justify-center gap-1 py-1.5 transition-colors h-16 w-full cursor-pointer"
              :class="activeSessionId === session.sessionId ? 'text-foreground border-r-2 border-primary' : 'text-muted-foreground/80 hover:text-muted-foreground border-r-2 border-transparent'"
              @click="handleConnectionClick(session.sessionId)">
              <IconDatabase class="h-5 w-5" :style="{ color: session.color || undefined }" />
              <span class="text-[10px] line-clamp-2 leading-tight w-full text-center px-1 break-all">
                {{ getConnectionLabel(session) }}
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem data-testid="connection-rail-move-to-window" @click="handleMoveToNewWindow(session.sessionId)">
              Move to New Window
            </ContextMenuItem>
            <ContextMenuItem data-testid="connection-rail-close" @click="handleCloseConnection(session.sessionId)">
              Close Connection
            </ContextMenuItem>
            <ContextMenuItem data-testid="connection-rail-close-others" :disabled="connectedSessions.length < 2" @click="handleCloseOtherConnections(session.sessionId)">
              Close Other Connections
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </ScrollArea>

    <!-- Discard Changes Warning Dialog -->
    <ConfirmDeleteDialog
      :open="showDiscardWarning"
      @update:open="showDiscardWarning = $event"
      title="Warning"
      :message="`Discard all changes?\nTips: You can commit changes by pressing ${isMac ? '⌘S' : 'Ctrl+S'}.`"
      confirm-text="Discard"
      danger-level="warning"
      @confirm="handleConfirmDiscard"
    />
  </div>
</template>
