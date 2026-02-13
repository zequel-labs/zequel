<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTabsStore, type TriggerTabData } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { useStatusBarStore } from '@/stores/statusBar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { IconLoader2, IconAlertTriangle, IconCopy } from '@tabler/icons-vue'
import type { Trigger } from '@/types/table'
import { formatDateTime } from '@/lib/date'
import { copyToClipboard } from '@/lib/utils'
import { highlightSql } from '@/lib/sql-highlighter'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const settingsStore = useSettingsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const trigger = ref<Trigger | null>(null)
const definition = ref<string>('')

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as TriggerTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const triggerName = computed(() => tabData.value?.triggerName || '')
const tableName = computed(() => tabData.value?.tableName || '')

const loadTrigger = async () => {
  if (!connectionId.value || !triggerName.value) return

  loading.value = true
  error.value = null

  try {
    const def = await window.api.schema.getTriggerDefinition(
      connectionId.value,
      triggerName.value,
      tableName.value
    )
    definition.value = def

    const triggers = await window.api.schema.getTriggers(connectionId.value, tableName.value)
    trigger.value = triggers.find((t) => t.name === triggerName.value) || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load trigger'
    console.error('Error loading trigger:', err)
  } finally {
    loading.value = false
  }
}

const copyDefinition = async () => {
  await copyToClipboard(definition.value, 'Definition copied')
}

const highlightedDefinition = computed(() => {
  if (!definition.value) return ''
  return highlightSql(definition.value)
})

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showTriggerControls = true
  const t = trigger.value
  statusBarStore.triggerInfo = t ? `${t.timing ?? ''} ${t.event ?? ''} on ${t.table ?? ''}`.trim() : ''
  statusBarStore.registerTriggerCallbacks({
    onRefresh: () => loadTrigger(),
  })
}

onMounted(() => {
  setupStatusBar()
  loadTrigger()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch([triggerName, tableName], () => {
  loadTrigger()
})

watch(trigger, () => {
  if (tabsStore.activeTabId === props.tabId) {
    const t = trigger.value
    statusBarStore.triggerInfo = t ? `${t.timing ?? ''} ${t.event ?? ''} on ${t.table ?? ''}`.trim() : ''
  }
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
      <IconAlertTriangle class="h-8 w-8 text-destructive" />
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="loadTrigger">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <ScrollArea v-else class="flex-1">
      <!-- Information Section -->
      <table v-if="trigger" class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col style="width: 140px;" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
              Information
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Name</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ triggerName }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Table</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ trigger.table }}</div>
            </td>
          </tr>
          <tr v-if="trigger.schema" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Schema</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ trigger.schema }}</div>
            </td>
          </tr>
          <tr v-if="trigger.timing" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Timing</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ trigger.timing }}</div>
            </td>
          </tr>
          <tr v-if="trigger.event" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Event</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ trigger.event }}</div>
            </td>
          </tr>
          <tr v-if="trigger.enabled !== undefined" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Status</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ trigger.enabled ? 'Enabled' : 'Disabled' }}</div>
            </td>
          </tr>
          <tr v-if="trigger.createdAt" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Created</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ formatDateTime(trigger.createdAt) }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Definition Section -->
      <div class="px-2 py-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
        <span class="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Definition</span>
        <TooltipProvider v-if="definition" :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-5 w-5" @click="copyDefinition">
                <IconCopy class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy Definition</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div v-if="highlightedDefinition"
        v-html="highlightedDefinition"
        :class="['px-3 py-2 text-xs font-mono whitespace-pre-wrap select-all', settingsStore.privacyMode ? 'blur-sm select-none' : '']" />
      <div v-else class="px-3 py-2 text-xs text-muted-foreground">Definition not available</div>
    </ScrollArea>
  </div>
</template>
