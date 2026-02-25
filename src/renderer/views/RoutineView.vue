<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTabsStore, type RoutineTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { IconLoader2, IconAlertTriangle, IconCopy } from '@tabler/icons-vue'
import { ArrowRight, ArrowLeft, ArrowLeftRight } from 'lucide-vue-next'
import { RoutineType } from '@/types/table'
import type { Routine } from '@/types/table'
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
const routine = ref<Routine | null>(null)
const definition = ref<string>('')

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as RoutineTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const routineName = computed(() => tabData.value?.routineName || '')
const routineType = computed(() => tabData.value?.routineType || RoutineType.Procedure)

const loadRoutine = async () => {
  if (!connectionId.value || !routineName.value) return

  loading.value = true
  error.value = null

  try {
    const def = await window.api.schema.getRoutineDefinition(
      connectionId.value,
      routineName.value,
      routineType.value
    )
    definition.value = def

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
  await copyToClipboard(definition.value, 'Definition copied')
}

const highlightedDefinition = computed(() => {
  if (!definition.value) return ''
  return highlightSql(definition.value)
})

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

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.registerRoutineCallbacks({
    onRefresh: () => loadRoutine(),
  })
  statusBarStore.showRoutineControls = true
  statusBarStore.routineType = routineType.value
  statusBarStore.routineHasParams = (routine.value?.parameters?.length ?? 0) > 0
}

onMounted(() => {
  setupStatusBar()
  loadRoutine()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch([routineName, routineType], () => {
  loadRoutine()
})

watch(routine, () => {
  if (tabsStore.activeTabId === props.tabId) {
    statusBarStore.routineHasParams = (routine.value?.parameters?.length ?? 0) > 0
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
      <Button variant="outline" @click="loadRoutine">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <ScrollArea v-else class="flex-1">
      <!-- Information Section -->
      <table v-if="routine" class="w-full border-collapse text-xs" style="table-layout: fixed;">
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
              <div class="h-8 px-2 flex items-center font-mono">{{ routineName }}</div>
            </td>
          </tr>
          <tr class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Type</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ routineType === RoutineType.Procedure ? 'Stored Procedure' : 'Function' }}</div>
            </td>
          </tr>
          <tr v-if="routine.schema" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Schema</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ routine.schema }}</div>
            </td>
          </tr>
          <tr v-if="routine.returnType && routineType === RoutineType.Function" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Returns</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ routine.returnType }}</div>
            </td>
          </tr>
          <tr v-if="routine.language" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Language</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ routine.language }}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Parameters Section -->
      <template v-if="routine?.parameters && routine.parameters.length > 0">
        <div class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider">
          Parameters
        </div>
        <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
          <colgroup>
            <col style="width: 80px;" />
            <col />
            <col />
            <col />
          </colgroup>
          <tbody>
            <tr v-for="param in routine.parameters" :key="param.name" class="h-8 hover:bg-muted/30">
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center gap-1.5">
                  <component :is="getParameterModeIcon(param.mode)" class="h-3 w-3 shrink-0" />
                  <Badge :class="getParameterModeColor(param.mode)" variant="outline" class="text-[10px] px-1 py-0">
                    {{ param.mode }}
                  </Badge>
                </div>
              </td>
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center font-mono">{{ param.name }}</div>
              </td>
              <td class="p-0 border-b border-r border-border">
                <div class="h-8 px-2 flex items-center font-mono text-muted-foreground">{{ param.type }}</div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center text-muted-foreground">{{ param.defaultValue || '-' }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </template>

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
        :class="['px-3 py-2 text-xs font-mono whitespace-pre-wrap select-all', connectionsStore.privacyMode ? 'blur-sm select-none' : '']" />
      <div v-else class="px-3 py-2 text-xs text-muted-foreground">Definition not available</div>
    </ScrollArea>
  </div>
</template>
