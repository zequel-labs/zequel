<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type SequenceTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Copy, Check, Hash, RefreshCw, Settings, Play } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Sequence } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const sequence = ref<Sequence | null>(null)
const copied = ref(false)
const isAltering = ref(false)

// Alter form state
const alterForm = ref({
  restartWith: '',
  increment: '',
  minValue: '',
  maxValue: '',
  cache: '',
  cycle: false
})

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as SequenceTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const sequenceName = computed(() => tabData.value?.sequenceName || '')
const schemaName = computed(() => tabData.value?.schema)

const loadSequence = async () => {
  if (!connectionId.value || !sequenceName.value) return

  loading.value = true
  error.value = null

  try {
    const details = await window.api.schema.getSequenceDetails(
      connectionId.value,
      sequenceName.value,
      schemaName.value
    )
    sequence.value = details

    // Initialize alter form with current values
    if (details) {
      alterForm.value = {
        restartWith: '',
        increment: details.increment,
        minValue: details.minValue,
        maxValue: details.maxValue,
        cache: details.cacheSize,
        cycle: details.cycled
      }
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load sequence'
    console.error('Error loading sequence:', err)
  } finally {
    loading.value = false
  }
}

const copyDDL = async () => {
  if (!sequence.value) return

  const ddl = generateDDL()
  try {
    await navigator.clipboard.writeText(ddl)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

const generateDDL = (): string => {
  if (!sequence.value) return ''

  const s = sequence.value
  let ddl = `CREATE SEQUENCE "${s.schema}"."${s.name}"`
  ddl += `\n    AS ${s.dataType}`
  ddl += `\n    START WITH ${s.startValue}`
  ddl += `\n    INCREMENT BY ${s.increment}`
  ddl += `\n    MINVALUE ${s.minValue}`
  ddl += `\n    MAXVALUE ${s.maxValue}`
  ddl += `\n    CACHE ${s.cacheSize}`
  ddl += s.cycled ? '\n    CYCLE' : '\n    NO CYCLE'
  ddl += ';'

  return ddl
}

const alterSequence = async () => {
  if (!connectionId.value || !sequenceName.value) return

  isAltering.value = true

  try {
    const request: Parameters<typeof window.api.schema.alterSequence>[1] = {
      sequenceName: sequenceName.value,
      schema: schemaName.value
    }

    if (alterForm.value.restartWith) {
      request.restartWith = parseInt(alterForm.value.restartWith, 10)
    }
    if (alterForm.value.increment && alterForm.value.increment !== sequence.value?.increment) {
      request.increment = parseInt(alterForm.value.increment, 10)
    }
    if (alterForm.value.minValue && alterForm.value.minValue !== sequence.value?.minValue) {
      request.minValue = parseInt(alterForm.value.minValue, 10)
    }
    if (alterForm.value.maxValue && alterForm.value.maxValue !== sequence.value?.maxValue) {
      request.maxValue = parseInt(alterForm.value.maxValue, 10)
    }
    if (alterForm.value.cache && alterForm.value.cache !== sequence.value?.cacheSize) {
      request.cache = parseInt(alterForm.value.cache, 10)
    }
    if (alterForm.value.cycle !== sequence.value?.cycled) {
      request.cycle = alterForm.value.cycle
    }

    const result = await window.api.schema.alterSequence(connectionId.value, request)

    if (result.success) {
      toast.success('Sequence altered successfully')
      await loadSequence()
    } else {
      toast.error(`Failed to alter sequence: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to alter sequence')
  } finally {
    isAltering.value = false
  }
}

const getNextValue = async () => {
  if (!connectionId.value || !sequenceName.value) return

  try {
    const fullName = schemaName.value
      ? `"${schemaName.value}"."${sequenceName.value}"`
      : `"${sequenceName.value}"`
    const result = await window.api.query.execute(
      connectionId.value,
      `SELECT nextval('${fullName}')`
    )

    if (result.rows && result.rows.length > 0) {
      const nextVal = Object.values(result.rows[0])[0]
      toast.success(`Next value: ${nextVal}`)
      await loadSequence()
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to get next value')
  }
}

onMounted(() => {
  loadSequence()
})

watch([sequenceName, schemaName], () => {
  loadSequence()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Hash class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">{{ sequenceName }}</h1>
        </div>
        <Badge variant="outline">Sequence</Badge>
        <Badge v-if="sequence?.schema" variant="secondary">
          {{ sequence.schema }}
        </Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="getNextValue">
          <Play class="h-4 w-4 mr-2" />
          Get Next Value
        </Button>
        <Button variant="outline" size="sm" @click="copyDDL">
          <component :is="copied ? Check : Copy" class="h-4 w-4 mr-2" />
          {{ copied ? 'Copied' : 'Copy DDL' }}
        </Button>
        <Button variant="outline" size="sm" @click="loadSequence">
          <RefreshCw class="h-4 w-4 mr-2" />
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
        <Button variant="outline" @click="loadSequence">
          Retry
        </Button>
      </div>

      <!-- Sequence Content -->
      <div v-else-if="sequence" class="space-y-6 max-w-4xl mx-auto">
        <!-- Properties Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Properties</CardTitle>
          </CardHeader>
          <CardContent>
            <dl class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt class="text-muted-foreground">Data Type</dt>
                <dd class="font-medium font-mono">{{ sequence.dataType }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Start Value</dt>
                <dd class="font-medium font-mono">{{ sequence.startValue }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Current Value</dt>
                <dd class="font-medium font-mono">{{ sequence.lastValue || 'Not yet used' }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Increment</dt>
                <dd class="font-medium font-mono">{{ sequence.increment }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Min Value</dt>
                <dd class="font-medium font-mono">{{ sequence.minValue }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Max Value</dt>
                <dd class="font-medium font-mono">{{ sequence.maxValue }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Cache Size</dt>
                <dd class="font-medium font-mono">{{ sequence.cacheSize }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Cycle</dt>
                <dd class="font-medium">
                  <Badge :variant="sequence.cycled ? 'default' : 'secondary'">
                    {{ sequence.cycled ? 'Yes' : 'No' }}
                  </Badge>
                </dd>
              </div>
              <div v-if="sequence.owner">
                <dt class="text-muted-foreground">Owner</dt>
                <dd class="font-medium">{{ sequence.owner }}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <!-- Alter Sequence Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base flex items-center gap-2">
              <Settings class="h-4 w-4" />
              Alter Sequence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div class="space-y-2">
                <Label>Restart With</Label>
                <Input
                  v-model="alterForm.restartWith"
                  type="number"
                  placeholder="Enter value to restart"
                />
              </div>
              <div class="space-y-2">
                <Label>Increment</Label>
                <Input
                  v-model="alterForm.increment"
                  type="number"
                />
              </div>
              <div class="space-y-2">
                <Label>Min Value</Label>
                <Input
                  v-model="alterForm.minValue"
                  type="number"
                />
              </div>
              <div class="space-y-2">
                <Label>Max Value</Label>
                <Input
                  v-model="alterForm.maxValue"
                  type="number"
                />
              </div>
              <div class="space-y-2">
                <Label>Cache Size</Label>
                <Input
                  v-model="alterForm.cache"
                  type="number"
                />
              </div>
              <div class="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="cycle"
                  :checked="alterForm.cycle"
                  @update:checked="alterForm.cycle = $event"
                />
                <Label for="cycle">Cycle</Label>
              </div>
            </div>
            <div class="mt-4">
              <Button @click="alterSequence" :disabled="isAltering">
                <Loader2 v-if="isAltering" class="h-4 w-4 mr-2 animate-spin" />
                Apply Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- DDL Card -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">DDL</CardTitle>
          </CardHeader>
          <CardContent>
            <pre class="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap">{{ generateDDL() }}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
