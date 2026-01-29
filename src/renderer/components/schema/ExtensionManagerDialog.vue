<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Package, Plus, Trash2, Search } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import type { Extension } from '@/types/table'

const props = defineProps<{
  open: boolean
  connectionId: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'changed'): void
}>()

const loading = ref(false)
const installedExtensions = ref<Extension[]>([])
const availableExtensions = ref<{ name: string; version: string; description: string }[]>([])
const searchQuery = ref('')
const installing = ref<string | null>(null)
const dropping = ref<string | null>(null)

// Install form
const installForm = ref({
  name: '',
  schema: '',
  cascade: false
})

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const filteredAvailable = computed(() => {
  if (!searchQuery.value) return availableExtensions.value
  const query = searchQuery.value.toLowerCase()
  return availableExtensions.value.filter(
    ext => ext.name.toLowerCase().includes(query) ||
           ext.description?.toLowerCase().includes(query)
  )
})

async function loadExtensions() {
  if (!props.connectionId) return

  loading.value = true
  try {
    const [installed, available] = await Promise.all([
      window.api.schema.getExtensions(props.connectionId),
      window.api.schema.getAvailableExtensions(props.connectionId)
    ])
    installedExtensions.value = installed
    availableExtensions.value = available
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load extensions')
  } finally {
    loading.value = false
  }
}

async function installExtension(name: string) {
  installing.value = name

  try {
    const result = await window.api.schema.createExtension(props.connectionId, {
      name,
      cascade: true
    })

    if (result.success) {
      toast.success(`Extension "${name}" installed successfully`)
      await loadExtensions()
      emit('changed')
    } else {
      toast.error(`Failed to install extension: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to install extension')
  } finally {
    installing.value = null
  }
}

async function dropExtension(name: string) {
  dropping.value = name

  try {
    const result = await window.api.schema.dropExtension(props.connectionId, {
      name,
      cascade: false
    })

    if (result.success) {
      toast.success(`Extension "${name}" dropped successfully`)
      await loadExtensions()
      emit('changed')
    } else {
      toast.error(`Failed to drop extension: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to drop extension')
  } finally {
    dropping.value = null
  }
}

watch(() => props.open, (newVal) => {
  if (newVal && props.connectionId) {
    loadExtensions()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-3xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Package class="h-5 w-5" />
          Extension Manager
        </DialogTitle>
        <DialogDescription>
          Manage PostgreSQL extensions for your database.
        </DialogDescription>
      </DialogHeader>

      <Tabs default-value="installed" class="flex-1 flex flex-col min-h-0">
        <TabsList>
          <TabsTrigger value="installed">
            Installed ({{ installedExtensions.length }})
          </TabsTrigger>
          <TabsTrigger value="available">
            Available ({{ availableExtensions.length }})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" class="flex-1 min-h-0 mt-4">
          <div v-if="loading" class="flex items-center justify-center h-48">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <ScrollArea v-else class="h-[400px]">
            <div v-if="installedExtensions.length === 0" class="text-center text-muted-foreground py-8">
              No extensions installed
            </div>
            <div v-else class="space-y-2 pr-4">
              <div
                v-for="ext in installedExtensions"
                :key="ext.name"
                class="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ ext.name }}</span>
                    <Badge variant="outline" class="text-xs">v{{ ext.version }}</Badge>
                    <Badge v-if="ext.schema" variant="secondary" class="text-xs">
                      {{ ext.schema }}
                    </Badge>
                  </div>
                  <p v-if="ext.description" class="text-sm text-muted-foreground truncate mt-1">
                    {{ ext.description }}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
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

        <TabsContent value="available" class="flex-1 min-h-0 mt-4">
          <div class="mb-4 relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search extensions..."
              class="pl-9"
            />
          </div>

          <div v-if="loading" class="flex items-center justify-center h-48">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <ScrollArea v-else class="h-[350px]">
            <div v-if="filteredAvailable.length === 0" class="text-center text-muted-foreground py-8">
              {{ searchQuery ? 'No extensions match your search' : 'No extensions available' }}
            </div>
            <div v-else class="space-y-2 pr-4">
              <div
                v-for="ext in filteredAvailable"
                :key="ext.name"
                class="flex items-center justify-between p-3 rounded-lg border bg-card"
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
                  size="sm"
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

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
