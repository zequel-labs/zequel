<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QueryResult } from '@/types/query'
import { formatNumber } from '@/lib/utils'
import { IconCircleCheck, IconCircleX, IconLayoutRows } from '@tabler/icons-vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DataGrid from '../grid/DataGrid.vue'

interface Props {
  result?: QueryResult
  results?: QueryResult[]
  activeResultIndex?: number
  isExecuting?: boolean
  totalExecutionTime?: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:activeResultIndex', index: number): void
}>()

const localActiveIndex = ref(0)

const activeIndex = computed({
  get: () => props.activeResultIndex ?? localActiveIndex.value,
  set: (val: number) => {
    localActiveIndex.value = val
    emit('update:activeResultIndex', val)
  }
})

const hasMultipleResults = computed(() => (props.results?.length ?? 0) > 1)

const activeResult = computed(() => {
  if (hasMultipleResults.value && props.results) {
    return props.results[activeIndex.value] ?? props.results[0]
  }
  return props.result
})

const hasError = computed(() => !!activeResult.value?.error)
const hasData = computed(() => (activeResult.value?.rows?.length ?? 0) > 0)
const isEmptyResult = computed(() => activeResult.value && !activeResult.value.error && activeResult.value.rows.length === 0)

const getResultLabel = (result: QueryResult, index: number): string => {
  if (result.error) {
    return `Result ${index + 1} (error)`
  }
  return `Result ${index + 1} (${formatNumber(result.rowCount)} ${result.rowCount === 1 ? 'row' : 'rows'})`
}

const handleTabChange = (value: string) => {
  activeIndex.value = parseInt(value, 10)
}

// Reset the active index when results change
watch(() => props.results, () => {
  localActiveIndex.value = 0
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Multiple Results Tabs -->
    <div v-if="hasMultipleResults && props.results" class="border-b bg-muted/20">
      <Tabs
        :model-value="String(activeIndex)"
        @update:model-value="handleTabChange"
      >
        <TabsList class="h-9 w-full justify-start rounded-none bg-transparent px-2 gap-1">
          <TabsTrigger
            v-for="(r, idx) in props.results"
            :key="idx"
            :value="String(idx)"
            class="h-7 text-xs px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-sm"
            :class="r.error ? 'data-[state=active]:text-red-500' : ''"
          >
            <IconCircleX v-if="r.error" class="h-3 w-3 mr-1 text-red-500" />
            <IconCircleCheck v-else class="h-3 w-3 mr-1 text-green-500" />
            {{ getResultLabel(r, idx) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <!-- Loading state -->
    <div
      v-if="isExecuting"
      class="flex-1 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-4 text-muted-foreground">
        <div class="h-8 w-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>Executing query...</span>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-else-if="hasError"
      class="flex-1 p-4 overflow-auto"
    >
      <div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
        <pre class="text-sm text-red-500 whitespace-pre-wrap font-mono">{{ activeResult?.error }}</pre>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else-if="hasData" class="flex-1 overflow-hidden">
      <DataGrid
        :columns="activeResult!.columns"
        :rows="activeResult!.rows"
      />
    </div>

    <!-- Empty result -->
    <div
      v-else-if="isEmptyResult"
      class="flex-1 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-2 text-muted-foreground">
        <IconCircleCheck class="h-12 w-12 opacity-50" />
        <span>Query executed successfully</span>
        <span class="text-sm opacity-75">No rows returned</span>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else
      class="flex-1 flex items-center justify-center"
    >
      <div class="flex flex-col items-center gap-2 text-muted-foreground">
        <IconLayoutRows class="h-12 w-12 opacity-50" />
        <span>Run a query to see results</span>
        <span class="text-sm opacity-75">Press Ctrl+Enter to execute</span>
      </div>
    </div>
  </div>
</template>
