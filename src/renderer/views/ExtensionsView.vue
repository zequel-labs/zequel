<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type ExtensionsTabData } from '@/stores/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import { Loader2, Package, Plus, Trash2, Search, RefreshCw } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Extension } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()

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

onMounted(() => {
  loadExtensions()
})

watch(connectionId, () => {
  loadExtensions()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <Package class="h-5 w-5 text-muted-foreground" />
          <h1 class="text-lg font-semibold">PostgreSQL Extensions</h1>
        </div>
        <Badge variant="outline">{{ installedExtensions.length }} installed</Badge>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="loadExtensions">
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
        <Button variant="outline" size="lg" @click="loadExtensions">
          Retry
        </Button>
      </div>

      <!-- Extensions Content -->
      <div v-else class="max-w-4xl mx-auto">
        <Tabs default-value="installed" class="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="installed">
              Installed ({{ installedExtensions.length }})
            </TabsTrigger>
            <TabsTrigger value="available">
              Available ({{ availableExtensions.length }})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installed" class="flex-1 mt-4">
            <div v-if="installedExtensions.length === 0" class="text-center text-muted-foreground py-8">
              No extensions installed
            </div>
            <ScrollArea v-else class="h-[calc(100vh-250px)]">
              <div class="space-y-2 pr-4">
                <div
                  v-for="ext in installedExtensions"
                  :key="ext.name"
                  class="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <Package class="h-4 w-4 text-muted-foreground" />
                      <span class="font-medium">{{ ext.name }}</span>
                      <Badge variant="outline" class="text-xs">v{{ ext.version }}</Badge>
                      <Badge v-if="ext.schema" variant="secondary" class="text-xs">
                        {{ ext.schema }}
                      </Badge>
                    </div>
                    <p v-if="ext.description" class="text-sm text-muted-foreground mt-1">
                      {{ ext.description }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    class="text-destructive hover:text-destructive hover:bg-destructive/10"
                    :disabled="dropping === ext.name"
                    @click="dropExtension(ext.name)"
                  >
                    <Loader2 v-if="dropping === ext.name" class="h-4 w-4 animate-spin" />
                    <Trash2 v-else class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="available" class="flex-1 mt-4">
            <div class="mb-4 relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="searchQuery"
                placeholder="Search extensions..."
                class="pl-9"
              />
            </div>

            <div v-if="filteredAvailable.length === 0" class="text-center text-muted-foreground py-8">
              {{ searchQuery ? 'No extensions match your search' : 'No extensions available' }}
            </div>
            <ScrollArea v-else class="h-[calc(100vh-300px)]">
              <div class="space-y-2 pr-4">
                <div
                  v-for="ext in filteredAvailable"
                  :key="ext.name"
                  class="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium">{{ ext.name }}</span>
                      <Badge v-if="ext.version" variant="outline" class="text-xs">
                        v{{ ext.version }}
                      </Badge>
                    </div>
                    <p v-if="ext.description" class="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {{ ext.description }}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    :disabled="installing === ext.name"
                    @click="installExtension(ext.name)"
                  >
                    <Loader2 v-if="installing === ext.name" class="h-4 w-4 mr-2 animate-spin" />
                    <Plus v-else class="h-4 w-4 mr-2" />
                    Install
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>
