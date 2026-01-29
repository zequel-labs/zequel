<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { IconClock } from '@tabler/icons-vue'
import { formatDuration } from '@/lib/utils'

const tabsStore = useTabsStore()

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
    </div>

    <span class="text-muted-foreground/60">Zequel</span>
  </div>
</template>
