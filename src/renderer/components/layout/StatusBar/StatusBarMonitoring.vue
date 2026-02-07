<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import {
  IconRefresh,
  IconPlayerPlay,
  IconPlayerPause,
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label + connections -->
    <div class="flex items-center gap-2">
      <span class="font-medium text-foreground">Process Monitor</span>
      <template v-if="statusBarStore.monitoringActiveConnections">
        <span>{{ statusBarStore.monitoringActiveConnections }} / {{ statusBarStore.monitoringMaxConnections }} connections</span>
      </template>
    </div>

    <!-- Center: process count -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.monitoringProcessCount }} {{ statusBarStore.monitoringProcessCount === 1 ? 'process' : 'processes' }}</span>
    </div>

    <!-- Right: auto-refresh toggle + refresh -->
    <TooltipProvider :delay-duration="300">
      <div class="flex items-center justify-end gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              :variant="statusBarStore.monitoringAutoRefresh ? 'default' : 'ghost'"
              size="icon"
              @click="statusBarStore.monitoringToggleAutoRefresh()"
            >
              <IconPlayerPause v-if="statusBarStore.monitoringAutoRefresh" class="h-3.5 w-3.5" />
              <IconPlayerPlay v-else class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ statusBarStore.monitoringAutoRefresh ? 'Stop auto-refresh' : 'Auto-refresh (3s)' }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" @click="statusBarStore.monitoringRefresh()">
              <IconRefresh class="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  </div>
</template>
