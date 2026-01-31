<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { getDbLogo } from '@/lib/db-logos'
import { ScrollArea } from '@/components/ui/scroll-area'

const connectionsStore = useConnectionsStore()

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

function handleConnectionClick(id: string) {
  connectionsStore.setActiveConnection(id)
}

function getConnectionLabel(conn: { name: string; database: string; type: string }) {
  if (conn.type === DatabaseType.Redis || conn.type === DatabaseType.SQLite) return conn.name
  return conn.database || conn.name
}
</script>

<template>
  <div class="flex h-full w-20 flex-col items-center border-r bg-muted/30">
    <!-- macOS Traffic Light Area -->
    <div class="h-[38px] w-full flex-shrink-0 titlebar-drag" />

    <!-- Connected Databases -->
    <ScrollArea class="flex-1 w-full">
      <div class="flex flex-col items-center gap-1 px-1 mt-4">
        <button
          v-for="conn in connectedConnections"
          :key="conn.id"
          class="relative flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors h-16 w-16"
          :class="activeConnectionId === conn.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
          @click="handleConnectionClick(conn.id)">
          <img v-if="getDbLogo(conn.type)" :src="getDbLogo(conn.type)!" :alt="conn.type" class="h-5 w-5" />
          <span class="text-[10px] line-clamp-2 leading-tight w-full text-center px-1">
            {{ getConnectionLabel(conn) }}
          </span>
        </button>
      </div>
    </ScrollArea>
  </div>
</template>
