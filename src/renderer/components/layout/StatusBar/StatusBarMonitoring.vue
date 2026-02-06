<script setup lang="ts">
import { useStatusBarStore } from '@/stores/statusBar'
import {
  IconRefresh,
  IconPlayerPlay,
  IconPlayerPause,
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

const statusBarStore = useStatusBarStore()
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: label -->
    <div class="flex items-center">
      <span class="font-medium text-foreground">Process Monitor</span>
    </div>

    <!-- Center: process count -->
    <div class="flex items-center justify-center">
      <span>{{ statusBarStore.monitoringProcessCount }} {{ statusBarStore.monitoringProcessCount === 1 ? 'process' : 'processes' }}</span>
    </div>

    <!-- Right: auto-refresh toggle + refresh -->
    <div class="flex items-center justify-end gap-0.5">
      <Button
        :variant="statusBarStore.monitoringAutoRefresh ? 'default' : 'ghost'"
        size="icon"
        @click="statusBarStore.monitoringToggleAutoRefresh()"
      >
        <IconPlayerPause v-if="statusBarStore.monitoringAutoRefresh" class="h-3.5 w-3.5" />
        <IconPlayerPlay v-else class="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" @click="statusBarStore.monitoringRefresh()">
        <IconRefresh class="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
</template>
