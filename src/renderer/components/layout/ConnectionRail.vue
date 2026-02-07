<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconDatabase } from '@tabler/icons-vue'

const connectionsStore = useConnectionsStore()

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const handleConnectionClick = (id: string) => {
  connectionsStore.setActiveConnection(id)
}

const getConnectionLabel = (conn: { name: string; database: string; type: string }) => {
  if (conn.type === DatabaseType.Redis || conn.type === DatabaseType.SQLite) return conn.name
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
        <button v-for="conn in connectedConnections" :key="conn.id"
          class="relative flex flex-col items-center justify-center gap-1 py-1.5 transition-colors h-16 w-full cursor-pointer"
          :class="activeConnectionId === conn.id ? 'text-foreground border-r-2 border-primary' : 'text-muted-foreground/80 hover:text-muted-foreground border-r-2 border-transparent'"
          @click="handleConnectionClick(conn.id)">
          <IconDatabase class="h-5 w-5" />
          <span class="text-[10px] line-clamp-2 leading-tight w-full text-center px-1 break-all">
            {{ getConnectionLabel(conn) }}
          </span>
        </button>
      </div>
    </ScrollArea>
  </div>
</template>