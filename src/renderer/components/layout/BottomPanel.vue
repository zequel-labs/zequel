<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { highlightSql } from '@/lib/sql-highlighter'
import { useTheme } from '@/composables/useTheme'
import { useQueryLogStore } from '@/stores/queryLog'
import { useConnectionsStore } from '@/stores/connections'
import { IconTrash, IconX, IconCopy } from '@tabler/icons-vue'
import { copyToClipboard } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { isDark } = useTheme()
const queryLogStore = useQueryLogStore()
const connectionsStore = useConnectionsStore()
const scrollRef = ref<HTMLDivElement | null>(null)

const activeConnectionId = computed(() => connectionsStore.activeConnectionId)

const filteredEntries = computed(() => {
  const entries = !activeConnectionId.value
    ? queryLogStore.entries
    : queryLogStore.entries.filter(e => e.connectionId === activeConnectionId.value)
  return [...entries].reverse()
})

// Lightweight SQL syntax highlighting (no Monaco dependency)
const highlightCache = new Map<string, string>()

const dedent = (text: string): string => {
  const lines = text.split('\n')
  const nonEmptyLines = lines.filter(l => l.trim().length > 0)
  if (nonEmptyLines.length === 0) return text.trim()
  const minIndent = Math.min(...nonEmptyLines.map(l => l.match(/^\s*/)![0].length))
  if (minIndent === 0) return text.trim()
  return lines.map(l => l.slice(minIndent)).join('\n').trim()
}

const getHighlightedSql = (sql: string): string => {
  let html = highlightCache.get(sql)
  if (html) return html
  const clean = dedent(sql) + ';'
  html = highlightSql(clean)
  highlightCache.set(sql, html)
  return html
}

// Clear cache when theme changes (CSS handles colors via variables)
watch(isDark, () => {
  highlightCache.clear()
})

const formatTimestamp = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(4, '0')
  const hours = d.getHours()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${h12}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms} ${ampm}`
}

const handleClear = () => {
  if (activeConnectionId.value) {
    queryLogStore.clearForConnection(activeConnectionId.value)
  } else {
    queryLogStore.clear()
  }
  highlightCache.clear()
}

const handleCopy = async () => {
  const text = filteredEntries.value.map(entry => {
    const time = formatTimestamp(entry.timestamp)
    const ms = entry.executionTime !== undefined ? ` (${entry.executionTime}ms)` : ''
    return `-- ${time}${ms}\n${dedent(entry.sql)};`
  }).join('\n')
  await copyToClipboard(text, 'Log copied to clipboard')
}

// Scroll to top on new entries (newest first)
watch(() => filteredEntries.value.length, async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = 0
  }
})
</script>

<template>
  <div class="flex flex-col h-full bg-background border-t border-border">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-1 border-b border-border bg-muted/30">
      <span class="text-xs font-medium text-muted-foreground">Query Log</span>
      <TooltipProvider :delay-duration="300">
        <div class="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" :disabled="filteredEntries.length === 0" @click="handleCopy">
                <IconCopy class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy log</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" @click="handleClear">
                <IconTrash class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear log</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" @click="emit('close')">
                <IconX class="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close panel</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>

    <!-- Log content -->
    <div ref="scrollRef" class="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
      <template v-if="filteredEntries.length > 0">
        <div v-for="(entry, i) in filteredEntries" :key="i" class="mb-4">
          <div class="text-muted-foreground/60 select-all">-- {{ formatTimestamp(entry.timestamp) }}<template v-if="entry.executionTime !== undefined"> ({{ entry.executionTime }}ms)</template></div>
          <div v-html="getHighlightedSql(entry.sql)" class="query-log-sql whitespace-pre-wrap break-all select-all mt-0.5" />
        </div>
      </template>
      <div v-else class="flex items-center justify-center h-full text-muted-foreground text-xs">
        No queries logged yet
      </div>
    </div>
  </div>
</template>

<style scoped>
.query-log-sql :deep(.sql-hl-keyword) {
  color: var(--sql-hl-keyword, #569cd6);
}
.query-log-sql :deep(.sql-hl-string) {
  color: var(--sql-hl-string, #ce9178);
}
.query-log-sql :deep(.sql-hl-number) {
  color: var(--sql-hl-number, #b5cea8);
}
.query-log-sql :deep(.sql-hl-comment) {
  color: var(--sql-hl-comment, #6a9955);
}
.query-log-sql :deep(.sql-hl-identifier) {
  color: var(--sql-hl-identifier, #9cdcfe);
}
</style>
