<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useTabsStore, type ExtensionsTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { IconLoader2, IconAlertTriangle, IconPlus, IconTrash, IconSearch } from '@tabler/icons-vue'
import type { Extension } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const installedExtensions = ref<Extension[]>([])
const availableExtensions = ref<{ name: string; version: string; description: string }[]>([])
const searchQuery = ref('')
const installing = ref<string | null>(null)
const dropping = ref<string | null>(null)

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as ExtensionsTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const filteredAvailable = computed(() => {
  if (!searchQuery.value) return availableExtensions.value
  const query = searchQuery.value.toLowerCase()
  return availableExtensions.value.filter(
    ext => ext.name.toLowerCase().includes(query) ||
           ext.description?.toLowerCase().includes(query)
  )
})

const loadExtensions = async () => {
  if (!connectionId.value) return

  loading.value = true
  error.value = null

  try {
    const [installed, available] = await Promise.all([
      window.api.schema.getExtensions(connectionId.value),
      window.api.schema.getAvailableExtensions(connectionId.value)
    ])
    installedExtensions.value = installed
    availableExtensions.value = available
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load extensions'
  } finally {
    loading.value = false
  }
}

const installExtension = async (name: string) => {
  if (connectionsStore.isSafeModeForSession(connectionId.value)) { toast.info('Safe Mode is enabled'); return }
  installing.value = name

  try {
    const result = await window.api.schema.createExtension(connectionId.value, {
      name,
      cascade: true
    })

    if (result.success) {
      toast.success(`Extension "${name}" installed successfully`)
      await loadExtensions()
    } else {
      toast.error(`Failed to install extension: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to install extension')
  } finally {
    installing.value = null
  }
}

const dropExtension = async (name: string) => {
  if (connectionsStore.isSafeModeForSession(connectionId.value)) { toast.info('Safe Mode is enabled'); return }
  dropping.value = name

  try {
    const result = await window.api.schema.dropExtension(connectionId.value, {
      name,
      cascade: false
    })

    if (result.success) {
      toast.success(`Extension "${name}" dropped successfully`)
      await loadExtensions()
    } else {
      toast.error(`Failed to drop extension: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to drop extension')
  } finally {
    dropping.value = null
  }
}

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.registerExtensionsCallbacks({
    onRefresh: () => loadExtensions(),
  })
  statusBarStore.showExtensionsControls = true
}

onMounted(() => {
  setupStatusBar()
  loadExtensions()
})

onUnmounted(() => {
  statusBarStore.clear(props.tabId)
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch(connectionId, () => {
  loadExtensions()
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
      <Button variant="outline" @click="loadExtensions">
        Retry
      </Button>
    </div>

    <!-- Installed Tab -->
    <ScrollArea v-else-if="statusBarStore.extensionsActiveTab === 'installed'" class="flex-1">
      <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
        <colgroup>
          <col />
          <col style="width: 80px;" />
          <col style="width: 100px;" />
          <col style="width: 50px;" />
        </colgroup>
        <thead>
          <tr>
            <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-left">Name</th>
            <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-left">Version</th>
            <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-left">Schema</th>
            <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="installedExtensions.length === 0">
            <td colspan="4" class="px-2 py-8 text-center text-muted-foreground border-b border-border">
              No extensions installed
            </td>
          </tr>
          <tr
            v-for="ext in installedExtensions"
            :key="ext.name"
            class="h-8 hover:bg-muted/30"
          >
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center">
                <div class="truncate">
                  <span class="font-mono">{{ ext.name }}</span>
                  <span v-if="ext.description" class="text-muted-foreground ml-2">{{ ext.description }}</span>
                </div>
              </div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono text-muted-foreground">{{ ext.version }}</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center font-mono text-muted-foreground">{{ ext.schema || '' }}</div>
            </td>
            <td class="p-0 border-b border-border">
              <div class="h-8 px-2 flex items-center justify-end">
                <TooltipProvider :delay-duration="300">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        :disabled="dropping === ext.name"
                        @click="dropExtension(ext.name)"
                      >
                        <IconLoader2 v-if="dropping === ext.name" class="h-3.5 w-3.5 animate-spin" />
                        <IconTrash v-else class="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Drop Extension</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollArea>

    <!-- Available Tab -->
    <template v-else-if="statusBarStore.extensionsActiveTab === 'available'">
      <!-- Search -->
      <div class="px-2 py-1.5 border-b border-border">
        <div class="relative">
          <IconSearch class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search extensions..."
            class="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea class="flex-1">
        <table class="w-full border-collapse text-xs" style="table-layout: fixed;">
          <colgroup>
            <col />
            <col style="width: 80px;" />
            <col style="width: 70px;" />
          </colgroup>
          <thead>
            <tr>
              <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-left">Name</th>
              <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-left">Version</th>
              <th class="px-2 py-1.5 bg-muted/50 font-semibold text-muted-foreground border-b border-border uppercase text-[10px] tracking-wider text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredAvailable.length === 0">
              <td colspan="3" class="px-2 py-8 text-center text-muted-foreground border-b border-border">
                {{ searchQuery ? 'No extensions match your search' : 'No extensions available' }}
              </td>
            </tr>
            <tr
              v-for="ext in filteredAvailable"
              :key="ext.name"
              class="h-8 hover:bg-muted/30"
            >
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center">
                  <div class="truncate">
                    <span class="font-mono">{{ ext.name }}</span>
                    <span v-if="ext.description" class="text-muted-foreground ml-2">{{ ext.description }}</span>
                  </div>
                </div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center font-mono text-muted-foreground">{{ ext.version }}</div>
              </td>
              <td class="p-0 border-b border-border">
                <div class="h-8 px-2 flex items-center justify-end">
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-6 w-6"
                          :disabled="installing === ext.name"
                          @click="installExtension(ext.name)"
                        >
                          <IconLoader2 v-if="installing === ext.name" class="h-3.5 w-3.5 animate-spin" />
                          <IconPlus v-else class="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Install Extension</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollArea>
    </template>
  </div>
</template>
