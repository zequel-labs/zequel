<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type EventTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Copy, Check, Calendar, Clock, Play, Pause, Code } from 'lucide-vue-next'
import type { MySQLEvent } from '@/types/table'
import { formatDateTime } from '@/lib/date'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const event = ref<MySQLEvent | null>(null)
const definition = ref<string>('')
const copied = ref(false)

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
    // Get event definition
    const def = await window.api.schema.getEventDefinition(
      connectionId.value,
      eventName.value
    )
    definition.value = def

    // Get event metadata
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
  try {
    await navigator.clipboard.writeText(definition.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const toggleEventStatus = async () => {
  if (!event.value || !connectionId.value) return

  try {
    const newStatus = event.value.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
    const result = await window.api.schema.alterEvent(connectionId.value, event.value.name, {
      status: newStatus
    })

    if (result.success) {
      await loadEvent()
    } else {
      error.value = result.error || 'Failed to change event status'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to change event status'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ENABLED':
      return 'bg-green-500/10 text-green-500 border-green-500/30'
    case 'DISABLED':
      return 'bg-red-500/10 text-red-500 border-red-500/30'
    case 'SLAVESIDE_DISABLED':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/30'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

onMounted(() => {
  loadEvent()
})

watch(eventName, () => {
  loadEvent()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Calendar class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">{{ eventName }}</h1>
        </div>
        <Badge v-if="event" :class="getStatusColor(event.status)" variant="outline">
          {{ event.status }}
        </Badge>
        <Badge v-if="event" variant="outline">
          {{ event.eventType }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="event && event.status !== 'SLAVESIDE_DISABLED'"
          variant="outline"
          size="sm"
          @click="toggleEventStatus"
        >
          <component :is="event.status === 'ENABLED' ? Pause : Play" class="h-4 w-4 mr-2" />
          {{ event.status === 'ENABLED' ? 'Disable' : 'Enable' }}
        </Button>
        <Button variant="outline" size="sm" @click="copyDefinition">
          <component :is="copied ? Check : Copy" class="h-4 w-4 mr-2" />
          {{ copied ? 'Copied' : 'Copy Definition' }}
        </Button>
        <Button variant="outline" size="sm" @click="loadEvent">
          Refresh
        </Button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" @click="loadEvent">
          Retry
        </Button>
      </div>

      <!-- Event Content -->
      <div v-else class="space-y-6 max-w-5xl mx-auto">
        <!-- Schedule Card -->
        <Card v-if="event">
          <CardHeader>
            <CardTitle class="text-base flex items-center gap-2">
              <Clock class="h-4 w-4" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-muted-foreground">Event Type</dt>
                <dd class="font-medium">{{ event.eventType }}</dd>
              </div>
              <div v-if="event.eventType === 'ONE TIME'">
                <dt class="text-muted-foreground">Execute At</dt>
                <dd class="font-medium">{{ formatDateTime(event.executeAt) }}</dd>
              </div>
              <template v-if="event.eventType === 'RECURRING'">
                <div>
                  <dt class="text-muted-foreground">Interval</dt>
                  <dd class="font-medium">{{ event.intervalValue }} {{ event.intervalField }}</dd>
                </div>
                <div v-if="event.starts">
                  <dt class="text-muted-foreground">Starts</dt>
                  <dd class="font-medium">{{ formatDateTime(event.starts) }}</dd>
                </div>
                <div v-if="event.ends">
                  <dt class="text-muted-foreground">Ends</dt>
                  <dd class="font-medium">{{ formatDateTime(event.ends) }}</dd>
                </div>
              </template>
              <div>
                <dt class="text-muted-foreground">On Completion</dt>
                <dd class="font-medium">{{ event.onCompletion }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Time Zone</dt>
                <dd class="font-medium">{{ event.timeZone }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Metadata Card -->
        <Card v-if="event">
          <CardHeader>
            <CardTitle class="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt class="text-muted-foreground">Database</dt>
                <dd class="font-medium">{{ event.database }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Definer</dt>
                <dd class="font-medium font-mono text-xs">{{ event.definer }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Created</dt>
                <dd class="font-medium">{{ formatDateTime(event.created) }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Last Altered</dt>
                <dd class="font-medium">{{ formatDateTime(event.lastAltered) }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Last Executed</dt>
                <dd class="font-medium">{{ formatDateTime(event.lastExecuted) }}</dd>
              </div>
              <div v-if="event.eventComment">
                <dt class="text-muted-foreground">Comment</dt>
                <dd class="font-medium">{{ event.eventComment }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Definition Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base flex items-center gap-2">
              <Code class="h-4 w-4" />
              Definition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre class="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">{{ definition || 'Definition not available' }}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
