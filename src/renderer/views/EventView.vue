<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useTabsStore, type EventTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IconLoader2, IconAlertTriangle } from '@tabler/icons-vue'
import type { MySQLEvent } from '@/types/table'
import { formatDateTime } from '@/lib/date'
import { copyToClipboard } from '@/lib/utils'
import { highlightSql } from '@/lib/sql-highlighter'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const event = ref<MySQLEvent | null>(null)
const definition = ref<string>('')

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as EventTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const eventName = computed(() => tabData.value?.eventName || '')

const loadEvent = async () => {
  if (!connectionId.value || !eventName.value) return

  loading.value = true
  error.value = null

  try {
    const def = await window.api.schema.getEventDefinition(
      connectionId.value,
      eventName.value
    )
    definition.value = def

    const events = await window.api.schema.getEvents(connectionId.value)
    event.value = events.find((e) => e.name === eventName.value) || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load event'
    console.error('Error loading event:', err)
  } finally {
    loading.value = false
  }
}

const copyDefinition = async () => {
  await copyToClipboard(definition.value, 'Definition copied')
}

const toggleEventStatus = async () => {
  if (connectionsStore.safeMode) { toast.info('Safe Mode is enabled'); return }
  if (!event.value || !connectionId.value) return

  try {
    const newStatus = event.value.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
    const result = await window.api.schema.alterEvent(connectionId.value, event.value.name, {
      status: newStatus
    })

    if (result.success) {
      await loadEvent()
      window.dispatchEvent(new CustomEvent('zequel:refresh-schema'))
    } else {
      error.value = result.error || 'Failed to change event status'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to change event status'
  }
}

const statusLabel = computed(() => {
  if (!event.value) return ''
  switch (event.value.status) {
    case 'ENABLED': return 'On'
    case 'DISABLED': return 'Off'
    default: return event.value.status
  }
})

const highlightedDefinition = computed(() => {
  if (!definition.value) return ''
  return highlightSql(definition.value)
})

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showEventControls = true
  statusBarStore.eventStatus = event.value?.status ?? ''
  statusBarStore.registerEventCallbacks({
    onRefresh: () => loadEvent(),
    onCopyDefinition: () => copyDefinition(),
    onToggleStatus: () => toggleEventStatus(),
  })
}

onMounted(() => {
  setupStatusBar()
  loadEvent()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch(eventName, () => {
  loadEvent()
})

watch(event, () => {
  if (tabsStore.activeTabId === props.tabId) {
    statusBarStore.eventStatus = event.value?.status ?? ''
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
      <Button variant="outline" @click="loadEvent">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <ScrollArea v-else class="flex-1">
      <!-- Information Section -->
      <table v-if="event" class="w-full border-collapse text-xs" style="table-layout: fixed;">
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
              <div class="h-8 px-2 flex items-center font-mono">{{ eventName }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Database</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ event.database }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Status</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">
                <span :class="[
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  event.status === 'ENABLED' ? 'bg-green-500/10 text-green-500' :
                  event.status === 'DISABLED' ? 'bg-red-500/10 text-red-500' :
                  'bg-amber-500/10 text-amber-500'
                ]">{{ statusLabel }}</span>
              </div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Event Type</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ event.eventType }}</div>
            </td>
          </tr>
          <tr v-if="event.definer" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Definer</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ event.definer }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">On Completion</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ event.onCompletion }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Created</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.created) }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Last Altered</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.lastAltered) }}</div>
            </td>
          </tr>
          <tr v-if="event.lastExecuted" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Last Executed</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.lastExecuted) }}</div>
            </td>
          </tr>
          <tr v-if="event.eventComment" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Comment</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ event.eventComment }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Schedule Section -->
      <table v-if="event" class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col style="width: 140px;" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
              Schedule
            </td>
          </tr>
          <tr v-if="event.eventType === 'ONE TIME' && event.executeAt" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Execute At</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.executeAt) }}</div>
            </td>
          </tr>
          <template v-if="event.eventType === 'RECURRING'">
            <tr class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">Interval</div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center">{{ event.intervalValue }} {{ event.intervalField }}</div>
              </td>
            </tr>
            <tr v-if="event.starts" class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">Starts</div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.starts) }}</div>
              </td>
            </tr>
            <tr v-if="event.ends" class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">Ends</div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center">{{ formatDateTime(event.ends) }}</div>
              </td>
            </tr>
          </template>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Time Zone</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ event.timeZone }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Definition Section -->
      <div class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
        Definition
      </div>
      <div v-if="highlightedDefinition"
        v-html="highlightedDefinition"
        :class="['px-3 py-2 text-xs font-mono whitespace-pre-wrap select-all', connectionsStore.privacyMode ? 'blur-sm select-none' : '']" />
      <div v-else class="px-3 py-2 text-xs text-muted-foreground">Definition not available</div>
    </ScrollArea>
  </div>
</template>
