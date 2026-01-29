<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabs } from '@/composables/useTabs'
import {
  IconDatabase,
  IconPlus,
  IconHome,
  IconSql,
  IconRefresh,
  IconSchema,
  IconPlugConnectedX
} from '@tabler/icons-vue'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

const emit = defineEmits<{
  (e: 'new-connection'): void
}>()

const connectionsStore = useConnectionsStore()
const { openQueryTab, openERDiagramTab } = useTabs()

const connectedConnections = computed(() => connectionsStore.connectedConnections)
const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

function handleHomeClick() {
  connectionsStore.setActiveConnection(null)
}

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
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div class="flex h-full w-20 flex-col items-center border-r bg-muted/30">
      <!-- macOS Traffic Light Area -->
      <div class="h-[38px] w-full flex-shrink-0 titlebar-drag" />

      <!-- Home Button -->
      <button class="relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors h-14 w-14"
        :class="activeConnectionId === null ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
        @click="handleHomeClick">
        <IconHome class="h-5 w-5" />
        <span class="text-[9px] leading-tight">Home</span>
      </button>

      <Separator class="my-2 w-8" />

      <!-- Connected Databases -->
      <ScrollArea class="flex-1 w-full">
        <div class="flex flex-col items-center gap-1 px-2">
          <template v-for="conn in connectedConnections" :key="conn.id">
            <ContextMenu>
              <ContextMenuTrigger as-child>
                <button
                  class="relative flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg transition-colors h-14 w-14"
                  :class="activeConnectionId === conn.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'"
                  @click="handleConnectionClick(conn.id)">
                  <!-- Active indicator (background only, no left border) -->
                  <IconDatabase class="h-5 w-5" :style="conn.color ? { color: conn.color } : {}" />
                  <span class="text-[9px] leading-tight truncate w-full text-center px-0.5">{{ conn.database ||
                    conn.name }}</span>
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

      <!-- Bottom: Add Connection -->
      <div class="pb-3">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              @click="emit('new-connection')">
              <IconPlus class="h-5 w-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            New Connection
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </TooltipProvider>
</template>