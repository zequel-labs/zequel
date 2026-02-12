<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { TabType } from '@/types/table'
import type { QueryResult } from '@/types/query'
import { IconClock } from '@tabler/icons-vue'
import { formatDuration, formatNumber } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const tabsStore = useTabsStore()

const activeTab = computed(() => tabsStore.activeTab)

// Multi-result selector
const multiResults = computed(() => {
  if (activeTab.value?.data.type === TabType.Query) {
    return activeTab.value.data.multiResults
  }
  return undefined
})

const currentResultIndex = computed(() => {
  if (activeTab.value?.data.type === TabType.Query) {
    return activeTab.value.data.currentResultIndex ?? 0
  }
  return 0
})

const isMultiResult = computed(() => (multiResults.value?.length ?? 0) > 1)

const resultLabel = (result: QueryResult, index: number): string => {
  if (result.affectedRows !== undefined) {
    return `Result ${index + 1}: ${formatNumber(result.affectedRows)} ${result.affectedRows === 1 ? 'row' : 'rows'} affected`
  }
  if (result.rows.length > 0) {
    return `Result ${index + 1}: ${formatNumber(result.rows.length)} ${result.rows.length === 1 ? 'row' : 'rows'}`
  }
  return `Result ${index + 1}: No rows`
}

const onResultChange = (value: string) => {
  const index = parseInt(value, 10)
  if (activeTab.value) {
    tabsStore.setTabCurrentResultIndex(activeTab.value.id, index)
  }
}

const executionTime = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return formatDuration(activeTab.value.data.result.executionTime)
  }
  return null
})

const rowCount = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return activeTab.value.data.result.rowCount
  }
  return null
})
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: multi-result selector -->
    <div class="flex items-center gap-4">
      <Select v-if="isMultiResult" :model-value="String(currentResultIndex)"
        data-testid="statusbar-result-selector" @update:model-value="onResultChange">
        <SelectTrigger class="h-7 text-xs w-auto gap-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="(r, index) in multiResults" :key="index" :value="String(index)" class="text-xs">
            {{ resultLabel(r, index) }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Center: execution time + row count -->
    <div class="flex items-center justify-center gap-4">
      <template v-if="executionTime">
        <div class="flex items-center gap-1.5">
          <IconClock class="h-3.5 w-3.5" />
          <span>{{ executionTime }}</span>
        </div>
        <div v-if="rowCount !== null">
          {{ formatNumber(rowCount) }} {{ rowCount === 1 ? 'row' : 'rows' }}
        </div>
      </template>
    </div>

    <!-- Right: empty for now -->
    <div />
  </div>
</template>
