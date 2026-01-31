<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type RoutineTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Copy, Check, Play, Code, ArrowRight, ArrowLeft, ArrowLeftRight } from 'lucide-vue-next'
import type { Routine, RoutineParameter } from '@/types/table'
import { formatDateTime } from '@/lib/date'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const routine = ref<Routine | null>(null)
const definition = ref<string>('')
const copied = ref(false)

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as RoutineTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const routineName = computed(() => tabData.value?.routineName || '')
const routineType = computed(() => tabData.value?.routineType || 'PROCEDURE')

const loadRoutine = async () => {
  if (!connectionId.value || !routineName.value) return

  loading.value = true
  error.value = null

  try {
    // Get routine definition
    const def = await window.api.schema.getRoutineDefinition(
      connectionId.value,
      routineName.value,
      routineType.value
    )
    definition.value = def

    // Get routine metadata
    const routines = await window.api.schema.getRoutines(connectionId.value, routineType.value)
    routine.value = routines.find((r) => r.name === routineName.value) || null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load routine'
    console.error('Error loading routine:', err)
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

const getParameterModeIcon = (mode: string) => {
  switch (mode) {
    case 'IN':
      return ArrowRight
    case 'OUT':
      return ArrowLeft
    case 'INOUT':
      return ArrowLeftRight
    default:
      return ArrowRight
  }
}

const getParameterModeColor = (mode: string) => {
  switch (mode) {
    case 'IN':
      return 'bg-blue-500/10 text-blue-500'
    case 'OUT':
      return 'bg-green-500/10 text-green-500'
    case 'INOUT':
      return 'bg-amber-500/10 text-amber-500'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

onMounted(() => {
  loadRoutine()
})

watch([routineName, routineType], () => {
  loadRoutine()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Code class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">{{ routineName }}</h1>
        </div>
        <Badge :variant="routineType === 'PROCEDURE' ? 'default' : 'secondary'">
          {{ routineType === 'PROCEDURE' ? 'Stored Procedure' : 'Function' }}
        </Badge>
        <Badge v-if="routine?.returnType" variant="outline">
          Returns: {{ routine.returnType }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="copyDefinition">
          <component :is="copied ? Check : Copy" class="h-4 w-4 mr-2" />
          {{ copied ? 'Copied' : 'Copy Definition' }}
        </Button>
        <Button variant="outline" size="sm" @click="loadRoutine">
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
        <Button variant="outline" @click="loadRoutine">
          Retry
        </Button>
      </div>

      <!-- Routine Content -->
      <div v-else class="space-y-6 max-w-5xl mx-auto">
        <!-- Parameters Card -->
        <Card v-if="routine?.parameters && routine.parameters.length > 0">
          <CardHeader>
            <CardTitle class="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/50">
                  <tr>
                    <th class="px-4 py-2 text-left font-medium w-24">Mode</th>
                    <th class="px-4 py-2 text-left font-medium">Name</th>
                    <th class="px-4 py-2 text-left font-medium">Type</th>
                    <th class="px-4 py-2 text-left font-medium">Default</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="param in routine.parameters" :key="param.name" class="border-b last:border-0">
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <component
                          :is="getParameterModeIcon(param.mode)"
                          class="h-4 w-4"
                        />
                        <Badge :class="getParameterModeColor(param.mode)" variant="outline">
                          {{ param.mode }}
                        </Badge>
                      </div>
                    </td>
                    <td class="px-4 py-2 font-mono text-sm">{{ param.name }}</td>
                    <td class="px-4 py-2 font-mono text-sm text-muted-foreground">{{ param.type }}</td>
                    <td class="px-4 py-2 text-muted-foreground">
                      {{ param.defaultValue || '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- No Parameters Message -->
        <Card v-else-if="routine">
          <CardHeader>
            <CardTitle class="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-muted-foreground text-sm">This {{ routineType.toLowerCase() }} has no parameters.</p>
          </CardContent>
        </Card>

        <!-- Metadata Card -->
        <Card v-if="routine">
          <CardHeader>
            <CardTitle class="text-base">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 gap-4 text-sm">
              <div v-if="routine.schema">
                <dt class="text-muted-foreground">Schema</dt>
                <dd class="font-medium">{{ routine.schema }}</dd>
              </div>
              <div v-if="routine.language">
                <dt class="text-muted-foreground">Language</dt>
                <dd class="font-medium">{{ routine.language }}</dd>
              </div>
              <div v-if="routine.returnType && routineType === 'FUNCTION'">
                <dt class="text-muted-foreground">Return Type</dt>
                <dd class="font-medium font-mono">{{ routine.returnType }}</dd>
              </div>
              <div v-if="routine.createdAt">
                <dt class="text-muted-foreground">Created</dt>
                <dd class="font-medium">{{ formatDateTime(routine.createdAt) }}</dd>
              </div>
              <div v-if="routine.modifiedAt">
                <dt class="text-muted-foreground">Modified</dt>
                <dd class="font-medium">{{ formatDateTime(routine.modifiedAt) }}</dd>
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
      </div>
    </div>
  </div>
</template>
