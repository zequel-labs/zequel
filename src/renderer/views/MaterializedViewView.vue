<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useTabsStore, type MaterializedViewTabData } from '@/stores/tabs'
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
import type { MaterializedView } from '@/types/table'
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
const matView = ref<MaterializedView | null>(null)
const ddl = ref<string>('')

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as MaterializedViewTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')
const viewName = computed(() => tabData.value?.viewName || '')
const schemaName = computed(() => tabData.value?.schema)

const loadMatView = async () => {
  if (!connectionId.value || !viewName.value) return

  loading.value = true
  error.value = null

  try {
    const [views, ddlResult] = await Promise.all([
      window.api.schema.getMaterializedViews(connectionId.value, schemaName.value),
      window.api.schema.getMaterializedViewDDL(connectionId.value, viewName.value, schemaName.value)
    ])
    matView.value = views.find(v => v.name === viewName.value) || null
    ddl.value = ddlResult
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load materialized view'
    console.error('Error loading materialized view:', err)
  } finally {
    loading.value = false
  }
}

const copyDefinition = async () => {
  if (!matView.value?.definition) return
  await copyToClipboard(matView.value.definition, 'Definition copied')
}

const copyDDL = async () => {
  await copyToClipboard(ddl.value, 'DDL copied')
}

const refreshData = async () => {
  if (connectionsStore.isSafeModeForSession(connectionId.value)) { toast.info('Safe Mode is enabled'); return }
  if (!connectionId.value || !viewName.value) return

  try {
    const result = await window.api.schema.refreshMaterializedView(connectionId.value, {
      viewName: viewName.value,
      schema: schemaName.value,
      concurrently: false
    })

    if (result.success) {
      toast.success('Materialized view refreshed successfully')
      await loadMatView()
    } else {
      toast.error(`Failed to refresh: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to refresh materialized view')
  }
}

const populatedLabel = computed(() => {
  if (!matView.value || matView.value.isPopulated === undefined) return ''
  return matView.value.isPopulated ? 'Yes' : 'No'
})

const indexesLabel = computed(() => {
  if (!matView.value || matView.value.hasIndexes === undefined) return ''
  return matView.value.hasIndexes ? 'Yes' : 'No'
})

const highlightedDefinition = computed(() => {
  if (!matView.value?.definition) return ''
  return highlightSql(matView.value.definition)
})

const highlightedDDL = computed(() => {
  if (!ddl.value) return ''
  return highlightSql(ddl.value)
})

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showMaterializedViewControls = true
  statusBarStore.registerMaterializedViewCallbacks({
    onRefresh: () => loadMatView(),
    onRefreshData: () => refreshData(),
  })
}

onMounted(() => {
  setupStatusBar()
  loadMatView()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch([viewName, schemaName], () => {
  loadMatView()
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
      <Button variant="outline" @click="loadMatView">
        Retry
      </Button>
    </div>

    <!-- Content -->
    <ScrollArea v-else-if="matView" class="flex-1">
      <!-- Information Section -->
      <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
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
              <div class="h-8 px-2 flex items-center font-mono">{{ viewName }}</div>
            </td>
          </tr>
          <tr v-if="matView.schema" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Schema</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ matView.schema }}</div>
            </td>
          </tr>
          <tr v-if="matView.owner" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Owner</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">{{ matView.owner }}</div>
            </td>
          </tr>
          <tr v-if="matView.tablespace" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Tablespace</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono">{{ matView.tablespace }}</div>
            </td>
          </tr>
          <tr v-if="matView.isPopulated !== undefined" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Populated</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">
                <span :class="[
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  matView.isPopulated ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                ]">{{ populatedLabel }}</span>
              </div>
            </td>
          </tr>
          <tr v-if="matView.hasIndexes !== undefined" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border">
              <div class="h-8 px-2 flex items-center text-muted-foreground">Has Indexes</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">
                <span :class="[
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  matView.hasIndexes ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                ]">{{ indexesLabel }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Definition Section -->
      <div class="px-2 py-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
        <span class="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Definition</span>
        <TooltipProvider v-if="matView?.definition" :delay-duration="300">
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

      <!-- DDL Section -->
      <div class="px-2 py-1.5 bg-muted/50 border-b border-border flex items-center gap-1.5">
        <span class="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">DDL</span>
        <TooltipProvider v-if="ddl" :delay-duration="300">
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
