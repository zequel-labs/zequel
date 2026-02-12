<script setup lang="ts">
import { computed } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useStatusBarStore } from '@/stores/statusBar'
import { TabType } from '@/types/table'
import type { QueryResult } from '@/types/query'
import { IconClockBolt, IconMenu3, IconClipboardList } from '@tabler/icons-vue'
import { formatDuration, formatNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const tabsStore = useTabsStore()
const statusBarStore = useStatusBarStore()

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
  if (result.rows.length > 0) {
    return `Result ${index + 1}: ${formatNumber(result.rows.length)} ${result.rows.length === 1 ? 'row' : 'rows'}`
  }
  if (result.affectedRows > 0) {
    return `Result ${index + 1}: ${formatNumber(result.affectedRows)} ${result.affectedRows === 1 ? 'row' : 'rows'} affected`
  }
  return `Result ${index + 1}: No rows`
}

const onResultChange = (value: string | number | boolean | Record<string, unknown> | null) => {
  const index = parseInt(String(value), 10)
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
    const result = activeTab.value.data.result
    if (result.rows.length > 0) {
      return result.rowCount
    }
  }
  return null
})

const affectedRows = computed(() => {
  if (activeTab.value?.data.type === TabType.Query && activeTab.value.data.result) {
    return activeTab.value.data.result.affectedRows
  }
  return 0
})
</script>

<template>
  <div class="grid grid-cols-3 items-center h-10 px-1.5 border-t bg-muted/30 text-xs text-muted-foreground">
    <!-- Left: multi-result selector -->
    <div class="flex items-center gap-4">
      <Select v-if="isMultiResult" :model-value="String(currentResultIndex)"
        @update:model-value="onResultChange">
        <SelectTrigger data-testid="statusbar-result-selector" class="h-7 text-xs w-auto gap-1.5">
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
    <div class="flex items-center justify-center gap-2">
      <template v-if="executionTime">
        <TooltipProvider v-if="rowCount !== null" :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1 cursor-default">
                <IconClipboardList class="size-4" />
                <span>{{ formatNumber(rowCount) }}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{{ formatNumber(rowCount) }} {{ rowCount === 1 ? 'record' : 'records' }}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div v-if="affectedRows > 0" class="flex items-center gap-1">
          <IconMenu3 class="size-4" />
          <span>{{ formatNumber(affectedRows) }} affected</span>
        </div>
        <div class="flex items-center gap-1">
          <IconClockBolt class="size-4" />
          <span>{{ executionTime }}</span>
        </div>
      </template>
    </div>

    <!-- Right: export -->
    <div class="flex items-center justify-end">
      <Button v-if="executionTime" data-testid="statusbar-export-btn" variant="outline" @click="statusBarStore.exportData()">
        Export
      </Button>
    </div>
  </div>
</template>
