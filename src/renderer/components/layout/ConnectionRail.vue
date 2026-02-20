<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { DatabaseType, ConnectionStatus } from '@/types/connection'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import ConfirmDeleteDialog from '@/components/schema/ConfirmDeleteDialog.vue'
import { IconDatabase } from '@tabler/icons-vue'

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
          database: conn.database,
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

const handleCloseConnection = async (sessionId: string) => {
  if (pendingChangesStore.connectionHasPendingChanges(sessionId)) {
    pendingDisconnectId.value = sessionId
    pendingDisconnectMode.value = 'single'
    showDiscardWarning.value = true
    return
  }
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
  for (const cid of others) {
    tabsStore.closeTabsForConnection(cid)
  }
  await connectionsStore.disconnectOthers(sessionId)
}

const handleConfirmDiscard = async () => {
  if (!pendingDisconnectId.value) return
  if (pendingDisconnectMode.value === 'single') {
    pendingChangesStore.clearAllForConnection(pendingDisconnectId.value)
    tabsStore.closeTabsForConnection(pendingDisconnectId.value)
    await connectionsStore.disconnect(pendingDisconnectId.value)
  } else {
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

  if (pendingChangesStore.connectionHasPendingChanges(sessionId)) {
    pendingChangesStore.clearAllForConnection(sessionId)
  }

  try {
    await window.api.app.openInNewWindow(sessionId, savedConnectionId)
  } catch {
    return
  }
  tabsStore.closeTabsForConnection(sessionId)
  connectionsStore.removeLocalSession(sessionId)
}

const getConnectionLabel = (conn: { name: string; database: string; type: DatabaseType }) => {
  if (conn.type === DatabaseType.Redis || conn.type === DatabaseType.SQLite || conn.type === DatabaseType.DuckDB) return conn.name
  return conn.database || conn.name
}
</script>

<template>
  <div class="flex h-full w-20 flex-col items-center border-r bg-muted/30">
    <!-- Platform Titlebar Spacer -->
    <div class="w-full platform-titlebar-spacer" />

    <!-- Connected Databases -->
    <ScrollArea class="flex-1 w-full">
      <div class="flex flex-col items-center gap-1 mt-4">
        <ContextMenu v-for="session in connectedSessions" :key="session.sessionId">
          <ContextMenuTrigger as-child>
            <button
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
            <ContextMenuItem @click="handleMoveToNewWindow(session.sessionId)">
              Move to New Window
            </ContextMenuItem>
            <ContextMenuItem @click="handleCloseConnection(session.sessionId)">
              Close Connection
            </ContextMenuItem>
            <ContextMenuItem :disabled="connectedSessions.length < 2" @click="handleCloseOtherConnections(session.sessionId)">
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
      message="Discard all changes?
Tips: You can commit changes by pressing ⌘S."
      confirm-text="Discard"
      danger-level="warning"
      @confirm="handleConfirmDiscard"
    />
  </div>
</template>
