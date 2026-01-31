<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import {
  IconDatabase,
  IconSql,
  IconRefresh,
  IconSchema,
  IconPlugConnectedX
} from '@tabler/icons-vue'
import { getDbLogo } from '@/lib/db-logos'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  TooltipProvider
} from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

const connectionsStore = useConnectionsStore()
const { openQueryTab, openERDiagramTab } = useTabs()

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

function handleConnectionClick(id: string) {
  connectionsStore.setActiveConnection(id)
}

async function handleDisconnect(id: string) {
  await connectionsStore.disconnect(id)
}

function handleNewQuery(id: string) {
  connectionsStore.setActiveConnection(id)
  openQueryTab('')
}

function handleRefreshTables(id: string) {
  const connection = connectionsStore.connections.find(c => c.id === id)
  if (connection) {
    connectionsStore.loadTables(id, connection.database)
  }
}

function handleERDiagram(id: string) {
  connectionsStore.setActiveConnection(id)
  const connection = connectionsStore.connections.find(c => c.id === id)
  if (connection) {
    openERDiagramTab(connection.database)
  }
}

function getConnectionLabel(conn: { name: string; database: string; type: string }) {
  if (conn.type === 'redis' || conn.type === 'sqlite') return conn.name
  return conn.database || conn.name
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex h-full w-20 flex-col items-center border-r bg-muted/30">
      <!-- macOS Traffic Light Area -->
      <div class="h-[38px] w-full flex-shrink-0 titlebar-drag" />

      <!-- Connected Databases -->
      <ScrollArea class="flex-1 w-full">
        <div class="flex flex-col items-center gap-1 px-1 mt-4">
          <template v-for="conn in connectedConnections" :key="conn.id">
            <ContextMenu>
              <ContextMenuTrigger as-child>
                <button
                  class="relative flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg transition-colors h-16 w-16"
                  :class="activeConnectionId === conn.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
                  @click="handleConnectionClick(conn.id)">
                  <img v-if="getDbLogo(conn.type)" :src="getDbLogo(conn.type)!" :alt="conn.type" class="h-5 w-5" />
                  <span class="text-[10px] line-clamp-2 leading-tight w-full text-center px-1">
                    {{ getConnectionLabel(conn) }}
                  </span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem @click="handleNewQuery(conn.id)">
                  <IconSql class="h-4 w-4 mr-2" />
                  New Query
                </ContextMenuItem>
                <ContextMenuItem @click="handleRefreshTables(conn.id)">
                  <IconRefresh class="h-4 w-4 mr-2" />
                  Refresh Tables
                </ContextMenuItem>
                <ContextMenuItem @click="handleERDiagram(conn.id)">
                  <IconSchema class="h-4 w-4 mr-2" />
                  ER Diagram
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem @click="handleDisconnect(conn.id)">
                  <IconPlugConnectedX class="h-4 w-4 mr-2" />
                  Close Connection
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </template>
        </div>
      </ScrollArea>

    </div>
  </TooltipProvider>
</template>