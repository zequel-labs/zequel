<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useTabsStore, type SequenceTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
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
import type { Sequence } from '@/types/table'
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
const sequence = ref<Sequence | null>(null)

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
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load sequence'
    console.error('Error loading sequence:', err)
  } finally {
    loading.value = false
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

const copyDDL = async () => {
  await copyToClipboard(generateDDL(), 'DDL copied')
}

const getNextValue = async () => {
  if (connectionsStore.isSafeModeForSession(connectionId.value)) { toast.info('Safe Mode is enabled'); return }
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

const highlightedDDL = computed(() => {
  const ddl = generateDDL()
  if (!ddl) return ''
  return highlightSql(ddl)
})

const cycleLabel = computed(() => {
  if (!sequence.value) return ''
  return sequence.value.cycled ? 'Yes' : 'No'
})

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.registerSequenceCallbacks({
    onRefresh: () => loadSequence(),
    onGetNextValue: () => getNextValue(),
  })
  statusBarStore.showSequenceControls = true
}

onMounted(() => {
  setupStatusBar()
  loadSequence()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch([sequenceName, schemaName], () => {
  loadSequence()
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
      <Button variant="outline" @click="loadSequence">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <ScrollArea v-else-if="sequence" class="flex-1">
      <!-- Properties Section -->
      <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col style="width: 140px;" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
              Properties
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Name</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequenceName }}</div>
            </td>
          </tr>
          <tr v-if="sequence.schema" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Schema</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.schema }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Data Type</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.dataType }}</div>
            </td>
          </tr>
          <tr v-if="sequence.owner" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Owner</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ sequence.owner }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Values Section -->
      <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col style="width: 140px;" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <td colspan="2" class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
              Values
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Current Value</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.lastValue || 'Not yet used' }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Start Value</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.startValue }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Increment</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.increment }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Min Value</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.minValue }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Max Value</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.maxValue }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Cache Size</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ sequence.cacheSize }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Cycle</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">
                <span :class="[
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  sequence.cycled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                ]">{{ cycleLabel }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- DDL Section -->
      <div class="px-2 py-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
        <span class="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">DDL</span>
        <TooltipProvider v-if="highlightedDDL" :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon" class="h-5 w-5" @click="copyDDL">
                <IconCopy class="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy DDL</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div v-if="highlightedDDL"
        v-html="highlightedDDL"
        :class="['px-3 py-2 text-xs font-mono whitespace-pre-wrap select-all', connectionsStore.privacyMode ? 'blur-sm select-none' : '']" />
      <div v-else class="px-3 py-2 text-xs text-muted-foreground">DDL not available</div>
    </ScrollArea>
  </div>
</template>
