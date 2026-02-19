<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QueryHistoryItem } from '@/types/query'
import { formatDuration, truncate } from '@/lib/utils'
import { formatUtcToLocal } from '@/lib/date'
import dayjs from '@/lib/dayjs'
import {
  IconClock,
  IconCircleCheck,
  IconCircleX,
  IconCopy,
  IconPlayerPlay,
  IconTrash,
  IconLoader2,
  IconBookmark,
  IconChevronRight
} from '@tabler/icons-vue'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'

interface Props {
  history: QueryHistoryItem[]
  loading: boolean
}

interface HistoryGroup {
  date: string
  label: string
  items: QueryHistoryItem[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'run', item: QueryHistoryItem): void
  (e: 'delete', item: QueryHistoryItem): void
  (e: 'clear'): void
  (e: 'copy', item: QueryHistoryItem): void
  (e: 'save', item: QueryHistoryItem): void
}>()

const expandedDays = ref<Set<string>>(new Set())

const groupedHistory = computed<HistoryGroup[]>(() => {
  const groups = new Map<string, QueryHistoryItem[]>()

  for (const item of props.history) {
    const date = dayjs.utc(item.executedAt).local().format('YYYY-MM-DD')
    if (!groups.has(date)) {
      groups.set(date, [])
    }
    groups.get(date)!.push(item)
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label: dayjs(date).format('MMMM D, YYYY'),
    items
  }))
})

// Auto-expand the most recent day when history loads
watch(groupedHistory, (groups) => {
  if (groups.length > 0 && expandedDays.value.size === 0) {
    expandedDays.value.add(groups[0].date)
  }
}, { immediate: true })

const toggleDay = (date: string) => {
  if (expandedDays.value.has(date)) {
    expandedDays.value.delete(date)
  } else {
    expandedDays.value.add(date)
  }
}
</script>

<template>
  <div class="space-y-0.5 py-2">
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <IconLoader2 class="h-4 w-4 animate-spin text-muted-foreground" />
    </div>

    <!-- History items grouped by day -->
    <template v-else>
      <template v-for="group in groupedHistory" :key="group.date">
        <Collapsible :open="expandedDays.has(group.date)" @update:open="toggleDay(group.date)">
          <div class="flex items-center px-2 py-1 hover:bg-accent/30 rounded-md cursor-pointer">
            <CollapsibleTrigger class="flex items-center gap-1 cursor-pointer flex-1">
              <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform"
                :class="{ 'rotate-90': expandedDays.has(group.date) }" />
              <span class="text-sm font-medium">{{ group.label }}</span>
              <span class="text-xs text-muted-foreground">({{ group.items.length }})</span>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent class="ml-2">
            <template v-for="item in group.items" :key="item.id">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div :data-testid="`history-item-${item.id}`"
                    class="px-2 py-1.5 cursor-pointer hover:bg-accent/50 rounded-md group"
                    @click="emit('run', item)">
                    <!-- First line: status + time + duration -->
                    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <IconCircleX v-if="item.error" class="h-3 w-3 text-red-500 flex-shrink-0" />
                      <IconCircleCheck v-else class="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span>{{ formatUtcToLocal(item.executedAt, 'HH:mm:ss') }}</span>
                      <span v-if="item.executionTime" class="text-muted-foreground/60">{{
                        formatDuration(item.executionTime) }}</span>
                    </div>
                    <!-- SQL preview (2-line clamp) -->
                    <p class="text-xs font-mono text-foreground/70 mt-0.5 line-clamp-2 break-all">{{
                      truncate(item.sql, 150) }}</p>
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
                  <ContextMenuItem @click="emit('clear')">
                    <IconTrash class="h-4 w-4 mr-2" />
                    Clear all history
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </template>
          </CollapsibleContent>
        </Collapsible>
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
