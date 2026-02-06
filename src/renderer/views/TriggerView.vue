<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type TriggerTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Copy, Check, Zap, Table, Clock, AlertCircle } from 'lucide-vue-next'
import type { Trigger } from '@/types/table'
import { formatDateTime } from '@/lib/date'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const trigger = ref<Trigger | null>(null)
const definition = ref<string>('')
const copied = ref(false)

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
    // Get trigger definition
    const def = await window.api.schema.getTriggerDefinition(
      connectionId.value,
      triggerName.value,
      tableName.value
    )
    definition.value = def

    // Get trigger metadata
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

const getTimingBadgeColor = (timing: string) => {
  switch (timing.toUpperCase()) {
    case 'BEFORE':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'AFTER':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'INSTEAD OF':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

const getEventBadgeColor = (event: string) => {
  if (event.includes('INSERT')) {
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
  } else if (event.includes('UPDATE')) {
    return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
  } else if (event.includes('DELETE')) {
    return 'bg-red-500/10 text-red-500 border-red-500/20'
  }
  return 'bg-muted text-muted-foreground'
}

onMounted(() => {
  loadTrigger()
})

watch([triggerName, tableName], () => {
  loadTrigger()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Zap class="h-5 w-5 text-yellow-500" />
          <h1 class="text-lg font-semibold">{{ triggerName }}</h1>
        </div>
        <Badge variant="outline">
          Trigger
        </Badge>
        <Badge v-if="trigger?.timing" :class="getTimingBadgeColor(trigger.timing)" variant="outline">
          {{ trigger.timing }}
        </Badge>
        <Badge v-if="trigger?.event" :class="getEventBadgeColor(trigger.event)" variant="outline">
          {{ trigger.event }}
        </Badge>
        <Badge v-if="trigger?.enabled === false" variant="destructive">
          Disabled
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="copyDefinition">
          <component :is="copied ? Check : Copy" class="h-4 w-4 mr-2" />
          {{ copied ? 'Copied' : 'Copy Definition' }}
        </Button>
        <Button variant="outline" @click="loadTrigger">
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
        <AlertCircle class="h-12 w-12 text-destructive" />
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" size="lg" @click="loadTrigger">
          Retry
        </Button>
      </div>

      <!-- Trigger Content -->
      <div v-else class="space-y-6 max-w-5xl mx-auto">
        <!-- Metadata Card -->
        <Card v-if="trigger">
          <CardHeader>
            <CardTitle class="text-base">Trigger Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt class="text-muted-foreground">Table</dt>
                <dd class="font-medium flex items-center gap-2">
                  <Table class="h-4 w-4 text-muted-foreground" />
                  {{ trigger.table }}
                </dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Timing</dt>
                <dd class="font-medium">{{ trigger.timing }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Event</dt>
                <dd class="font-medium">{{ trigger.event }}</dd>
              </div>
              <div v-if="trigger.schema">
                <dt class="text-muted-foreground">Schema</dt>
                <dd class="font-medium">{{ trigger.schema }}</dd>
              </div>
              <div v-if="trigger.enabled !== undefined">
                <dt class="text-muted-foreground">Status</dt>
                <dd class="font-medium">
                  <Badge :variant="trigger.enabled ? 'default' : 'destructive'">
                    {{ trigger.enabled ? 'Enabled' : 'Disabled' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="trigger.createdAt">
                <dt class="text-muted-foreground">Created</dt>
                <dd class="font-medium flex items-center gap-2">
                  <Clock class="h-4 w-4 text-muted-foreground" />
                  {{ formatDateTime(trigger.createdAt) }}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Definition Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Definition</CardTitle>
          </CardHeader>
          <CardContent>
            <pre class="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">{{ definition || 'Definition not available' }}</pre>
          </CardContent>
        </Card>

        <!-- Usage Notes -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>{{ trigger?.timing }}</strong> triggers execute
                {{ trigger?.timing === 'BEFORE' ? 'before the triggering event occurs, allowing you to modify data or cancel the operation.' :
                   trigger?.timing === 'AFTER' ? 'after the triggering event completes, useful for logging or cascading changes.' :
                   trigger?.timing === 'INSTEAD OF' ? 'in place of the triggering event, commonly used for views.' : '' }}
              </p>
              <p>
                This trigger fires on <strong>{{ trigger?.event }}</strong> operations on the <strong>{{ trigger?.table }}</strong> table.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
