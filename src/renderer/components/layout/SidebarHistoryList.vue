<script setup lang="ts">
import type { QueryHistoryItem } from '@/types/query'
import { formatDuration, truncate } from '@/lib/utils'
import { formatTime } from '@/lib/date'
import {
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconCopy,
  IconPlayerPlay,
  IconTrash,
  IconLoader2,
  IconBookmark
} from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'

interface Props {
  history: QueryHistoryItem[]
  loading: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'run', item: QueryHistoryItem): void
  (e: 'delete', item: QueryHistoryItem): void
  (e: 'clear'): void
  (e: 'copy', item: QueryHistoryItem): void
  (e: 'save', item: QueryHistoryItem): void
}>()
</script>

<template>
  <div class="space-y-0.5 py-2">
    <!-- Clear All button -->
    <div v-if="history.length > 0" class="flex items-center justify-end px-2 pb-1">
      <Button variant="outline" size="sm" @click="emit('clear')">
        Clear All
      </Button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
    </div>

    <!-- History items -->
    <template v-else>
      <template v-for="item in history" :key="item.id">
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div class="px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-md group" @click="emit('run', item)">
              <!-- First line: status + time + duration -->
              <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                <IconCircleX v-if="item.error" class="h-3 w-3 text-red-500 flex-shrink-0" />
                <IconCircleCheck v-else class="h-3 w-3 text-green-500 flex-shrink-0" />
                <span>{{ formatTime(item.executedAt) }}</span>
                <span v-if="item.executionTime" class="text-muted-foreground/60">{{ formatDuration(item.executionTime)
                }}</span>
              </div>
              <!-- SQL preview (2-line clamp) -->
              <p class="text-xs font-mono text-foreground/70 mt-0.5 line-clamp-2 break-all">{{ truncate(item.sql, 150)
              }}</p>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem @click="emit('run', item)">
              <IconPlayerPlay class="h-4 w-4 mr-2" />
              Run Query
            </ContextMenuItem>
            <ContextMenuItem @click="emit('copy', item)">
              <IconCopy class="h-4 w-4 mr-2" />
              Copy SQL
            </ContextMenuItem>
            <ContextMenuItem @click="emit('save', item)">
              <IconBookmark class="h-4 w-4 mr-2" />
              Save to Queries
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem @click="emit('delete', item)">
              <IconTrash class="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </template>

      <!-- Empty state -->
      <div v-if="!loading && history.length === 0"
        class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <IconClock class="h-6 w-6 mb-2 opacity-50" />
        <span class="text-xs">No query history yet</span>
      </div>
    </template>
  </div>
</template>