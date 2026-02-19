<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { IconDatabase } from '@tabler/icons-vue'

const connectionsStore = useConnectionsStore()

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const handleConnectionClick = (id: string) => {
  connectionsStore.setActiveConnection(id)
}

const handleCloseConnection = async (id: string) => {
  await connectionsStore.disconnect(id)
}

const handleCloseOtherConnections = async (id: string) => {
  await connectionsStore.disconnectOthers(id)
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
  </div>
</template>