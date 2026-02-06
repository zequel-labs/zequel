<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { useTheme } from '@/composables/useTheme'
import { useQueryLogStore } from '@/stores/queryLog'
import { useConnectionsStore } from '@/stores/connections'
import { IconTrash, IconX } from '@tabler/icons-vue'
import { Button } from '@/components/ui/button'

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

// Syntax highlighting via Monaco colorize
const highlightCache = new Map<string, string>()
const highlightedMap = ref<Map<string, string>>(new Map())
let lastColorizedCount = 0

const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const dedent = (text: string): string => {
  const lines = text.split('\n')
  const nonEmptyLines = lines.filter(l => l.trim().length > 0)
  if (nonEmptyLines.length === 0) return text.trim()
  const minIndent = Math.min(...nonEmptyLines.map(l => l.match(/^\s*/)![0].length))
  if (minIndent === 0) return text.trim()
  return lines.map(l => l.slice(minIndent)).join('\n').trim()
}

const colorizeEntry = async (sql: string): Promise<string> => {
  let html = highlightCache.get(sql)
  if (html) return html
  const clean = dedent(sql) + ';'
  try {
    html = await monaco.editor.colorize(clean, 'sql', { tabSize: 2 })
  } catch {
    html = escapeHtml(clean)
  }
  highlightCache.set(sql, html)
  return html
}

const getHighlightedSql = (sql: string): string => {
  return highlightedMap.value.get(sql) || escapeHtml(dedent(sql) + ';')
}

const colorizeNew = async () => {
  const entries = filteredEntries.value
  if (entries.length === lastColorizedCount) return

  // Only colorize entries that aren't in the cache yet
  const toColorize = entries.filter(e => !highlightCache.has(e.sql))
  if (toColorize.length === 0) {
    lastColorizedCount = entries.length
    return
  }

  for (const entry of toColorize) {
    const html = await colorizeEntry(entry.sql)
    highlightedMap.value.set(entry.sql, html)
  }
  highlightedMap.value = new Map(highlightedMap.value)
  lastColorizedCount = entries.length
}

// Ensure Monaco theme matches the app theme
const monacoTheme = computed(() => isDark.value ? 'vs-dark' : 'vs')
watch(monacoTheme, (theme) => {
  monaco.editor.setTheme(theme)
  highlightCache.clear()
  highlightedMap.value = new Map()
  lastColorizedCount = 0
  colorizeNew()
}, { immediate: true })

watch(filteredEntries, colorizeNew, { immediate: true })

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
  highlightedMap.value = new Map()
  lastColorizedCount = 0
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
      <div class="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" title="Clear" @click="handleClear">
          <IconTrash class="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" @click="emit('close')">
          <IconX class="h-3.5 w-3.5" />
        </Button>
      </div>
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
.query-log-sql :deep(> span) {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}
</style>
