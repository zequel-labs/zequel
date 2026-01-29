<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useTabsStore } from '@/stores/tabs'
import { IconDatabase, IconWifi, IconWifiOff, IconClock } from '@tabler/icons-vue'
import { formatDuration } from '@/lib/utils'

const connectionsStore = useConnectionsStore()
const tabsStore = useTabsStore()

const activeConnection = computed(() => connectionsStore.activeConnection)
const isConnected = computed(() => connectionsStore.isConnected)

const activeTab = computed(() => tabsStore.activeTab)

const executionTime = computed(() => {
  if (activeTab.value?.data.type === 'query' && activeTab.value.data.result) {
    return formatDuration(activeTab.value.data.result.executionTime)
  }
  return null
})

const rowCount = computed(() => {
  if (activeTab.value?.data.type === 'query' && activeTab.value.data.result) {
    return activeTab.value.data.result.rowCount
  }
  return null
})
</script>

<template>
  <div class="flex items-center justify-between px-4 py-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <div class="flex items-center gap-4">
      <!-- Connection status -->
      <div class="flex items-center gap-2">
        <IconWifi v-if="isConnected" class="h-3.5 w-3.5 text-green-500" />
        <IconWifiOff v-else class="h-3.5 w-3.5" />
        <span v-if="activeConnection">
          {{ activeConnection.name }}
          <span class="text-muted-foreground/60">
            ({{ activeConnection.type }})
          </span>
        </span>
        <span v-else>Not connected</span>
      </div>

      <!-- Database -->
      <div v-if="activeConnection" class="flex items-center gap-1.5">
        <IconDatabase class="h-3.5 w-3.5" />
        <span>{{ activeConnection.database }}</span>
      </div>
    </div>

    <div class="flex items-center gap-4">
      <!-- Query results info -->
      <template v-if="executionTime">
        <div class="flex items-center gap-1.5">
          <IconClock class="h-3.5 w-3.5" />
          <span>{{ executionTime }}</span>
        </div>
        <div v-if="rowCount !== null">
          {{ rowCount }} {{ rowCount === 1 ? 'row' : 'rows' }}
        </div>
      </template>

      <!-- App version -->
      <span class="text-muted-foreground/60">DB Studio</span>
    </div>
  </div>
</template>
