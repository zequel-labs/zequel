<script setup lang="ts">
import { computed } from 'vue'
import type { QueryResult } from '@/types/query'
import { formatDuration, formatNumber } from '@/lib/utils'
import { IconCircleCheck, IconCircleX, IconClock, IconLayoutRows } from '@tabler/icons-vue'
import DataGrid from '../grid/DataGrid.vue'

interface Props {
  result?: QueryResult
  isExecuting?: boolean
}

const props = defineProps<Props>()

const hasError = computed(() => !!props.result?.error)
const hasData = computed(() => (props.result?.rows?.length ?? 0) > 0)
const isEmptyResult = computed(() => props.result && !props.result.error && props.result.rows.length === 0)
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Results Header -->
    <div
      v-if="result"
      class="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-sm"
    >
      <!-- Status -->
      <div class="flex items-center gap-2">
        <IconCircleX v-if="hasError" class="h-4 w-4 text-red-500" />
        <IconCircleCheck v-else class="h-4 w-4 text-green-500" />
        <span :class="hasError ? 'text-red-500' : 'text-green-500'">
          {{ hasError ? 'Error' : 'Success' }}
        </span>
      </div>

      <!-- Execution time -->
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <IconClock class="h-4 w-4" />
        <span>{{ formatDuration(result.executionTime) }}</span>
      </div>

      <!-- Row count -->
      <div v-if="!hasError" class="flex items-center gap-1.5 text-muted-foreground">
        <IconLayoutRows class="h-4 w-4" />
        <span>
          {{ formatNumber(result.rowCount) }} {{ result.rowCount === 1 ? 'row' : 'rows' }}
          <template v-if="result.affectedRows !== undefined">
            ({{ result.affectedRows }} affected)
          </template>
        </span>
      </div>
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
        <pre class="text-sm text-red-500 whitespace-pre-wrap font-mono">{{ result?.error }}</pre>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else-if="hasData" class="flex-1 overflow-hidden">
      <DataGrid
        :columns="result!.columns"
        :rows="result!.rows"
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
