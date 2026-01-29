<script setup lang="ts">
import { ref } from 'vue'
import type { QueryHistoryItem } from '@/types/query'
import { formatDuration, truncate } from '@/lib/utils'
import { IconClock, IconCircleCheck, IconCircleX, IconCopy, IconPlayerPlay } from '@tabler/icons-vue'
import ScrollArea from '../ui/ScrollArea.vue'
import Button from '../ui/Button.vue'

interface Props {
  history: QueryHistoryItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', item: QueryHistoryItem): void
  (e: 'run', item: QueryHistoryItem): void
}>()

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function copyToClipboard(sql: string) {
  navigator.clipboard.writeText(sql)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-2 border-b bg-muted/30">
      <h3 class="text-sm font-medium">Query History</h3>
    </div>

    <ScrollArea class="flex-1">
      <div class="p-2 space-y-1">
        <div
          v-for="item in history"
          :key="item.id"
          class="group p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
          @click="emit('select', item)"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <IconClock class="h-3.5 w-3.5" />
              <span>{{ formatTimestamp(item.executedAt) }}</span>
              <span class="text-muted-foreground/60">|</span>
              <span>{{ formatDuration(item.executionTime) }}</span>
            </div>

            <div class="flex items-center gap-1">
              <IconCircleX v-if="item.error" class="h-4 w-4 text-red-500" />
              <IconCircleCheck v-else class="h-4 w-4 text-green-500" />
            </div>
          </div>

          <pre class="text-sm font-mono text-foreground/80 whitespace-pre-wrap break-all">{{ truncate(item.sql, 200) }}</pre>

          <div
            v-if="item.rowCount !== undefined && !item.error"
            class="mt-2 text-xs text-muted-foreground"
          >
            {{ item.rowCount }} {{ item.rowCount === 1 ? 'row' : 'rows' }}
          </div>

          <div class="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2"
              @click.stop="copyToClipboard(item.sql)"
            >
              <IconCopy class="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2"
              @click.stop="emit('run', item)"
            >
              <IconPlayerPlay class="h-3.5 w-3.5 mr-1" />
              Run
            </Button>
          </div>
        </div>

        <div
          v-if="history.length === 0"
          class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground"
        >
          <IconClock class="h-8 w-8 mb-2 opacity-50" />
          <span class="text-sm">No query history yet</span>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>
