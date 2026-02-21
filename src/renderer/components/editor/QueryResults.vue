<script setup lang="ts">
import { computed } from 'vue'
import type { QueryResult } from '@/types/query'
import { IconCircleCheck, IconCircleX, IconLayoutRows } from '@tabler/icons-vue'
import DataGrid from '@/components/grid/DataGrid.vue'

interface Props {
  result?: QueryResult
  isExecuting?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'row-activate', row: Record<string, unknown>, rowIndex: number): void
}>()

const hasError = computed(() => !!props.result?.error)
const hasData = computed(() => (props.result?.rows?.length ?? 0) > 0)
const isEmptyResult = computed(() => props.result && !props.result.error && props.result.rows.length === 0)
</script>

<template>
  <div class="flex flex-col h-full">
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
        <pre data-testid="query-error" class="text-sm text-red-500 whitespace-pre-wrap font-mono">{{ result?.error }}</pre>
      </div>
    </div>

    <!-- Data Grid -->
    <div v-else-if="hasData" class="flex-1 overflow-hidden">
      <DataGrid
        :columns="result!.columns"
        :rows="result!.rows"
        @row-activate="(row, idx) => emit('row-activate', row, idx)"
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
        <span v-if="result && result.affectedRows > 0" class="text-sm opacity-75">
          {{ result.affectedRows }} row{{ result.affectedRows === 1 ? '' : 's' }} affected
        </span>
        <span v-else class="text-sm opacity-75">No rows returned</span>
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
