<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { usePendingChangesStore } from '@/stores/pendingChanges'
import { DatabaseType } from '@/types/connection'
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

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const showDiscardWarning = ref(false)
const pendingDisconnectId = ref<string | null>(null)
const pendingDisconnectMode = ref<'single' | 'others'>('single')

const handleConnectionClick = (id: string) => {
  connectionsStore.setActiveConnection(id)
}

const handleCloseConnection = async (id: string) => {
  if (pendingChangesStore.connectionHasPendingChanges(id)) {
    pendingDisconnectId.value = id
    pendingDisconnectMode.value = 'single'
    showDiscardWarning.value = true
    return
  }
  tabsStore.closeTabsForConnection(id)
  await connectionsStore.disconnect(id)
}

const handleCloseOtherConnections = async (id: string) => {
  const others = connectionsStore.connectedIds.filter(cid => cid !== id)
  const hasChanges = others.some(cid => pendingChangesStore.connectionHasPendingChanges(cid))
  if (hasChanges) {
    pendingDisconnectId.value = id
    pendingDisconnectMode.value = 'others'
    showDiscardWarning.value = true
    return
  }
  for (const cid of others) {
    tabsStore.closeTabsForConnection(cid)
  }
  await connectionsStore.disconnectOthers(id)
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

const getConnectionLabel = (conn: { name: string; database: string; type: string }) => {
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
        <ContextMenu v-for="conn in connectedConnections" :key="conn.id">
          <ContextMenuTrigger as-child>
            <button
              class="relative flex flex-col items-center justify-center gap-1 py-1.5 transition-colors h-16 w-full cursor-pointer"
              :class="activeConnectionId === conn.id ? 'text-foreground border-r-2 border-primary' : 'text-muted-foreground/80 hover:text-muted-foreground border-r-2 border-transparent'"
              @click="handleConnectionClick(conn.id)">
              <IconDatabase class="h-5 w-5" :style="{ color: conn.color || undefined }" />
              <span class="text-[10px] line-clamp-2 leading-tight w-full text-center px-1 break-all">
                {{ getConnectionLabel(conn) }}
              </span>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="handleCloseConnection(conn.id)">
              Close Connection
            </ContextMenuItem>
            <ContextMenuItem :disabled="connectedConnections.length < 2" @click="handleCloseOtherConnections(conn.id)">
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
