<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import type { SavedConnection } from '@/types/connection'
import Draggable from 'vuedraggable'
import {
  IconDatabase,
  IconPlus,
  IconLoader2,
  IconAlertCircle,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconFolder,
  IconFolderPlus,
  IconChevronRight,
  IconChevronDown,
  IconSearch,
  IconFolderOff,
  IconDatabaseOff,
  IconGripVertical,
  IconLink
} from '@tabler/icons-vue'
import { getDbLogo } from '@/lib/db-logos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'

const emit = defineEmits<{
  (e: 'new-connection'): void
  (e: 'edit-connection', id: string): void
  (e: 'import-from-url'): void
}>()

const connectionsStore = useConnectionsStore()

const connectingId = ref<string | null>(null)
const connectionError = ref<Map<string, string>>(new Map())
const searchQuery = ref('')
const collapsedFolders = ref<Set<string>>(new Set())

// Drag state
const isDragging = ref(false)

// Local mutable arrays for drag-and-drop
const localGrouped = ref<Record<string, SavedConnection[]>>({})
const localUngrouped = ref<SavedConnection[]>([])

// Sync store → local refs (skip while dragging)
watch(
  () => connectionsStore.connectionsByFolder,
  (val) => {
    if (isDragging.value) return
    localGrouped.value = Object.fromEntries(
      Object.entries(val.grouped).map(([k, v]) => [k, [...v]])
    )
    localUngrouped.value = [...val.ungrouped]
  },
  { immediate: true, deep: true }
)

// Folder dialog state
const folderDialogOpen = ref(false)
const folderDialogMode = ref<'create' | 'rename'>('create')
const folderDialogName = ref('')
const folderDialogOldName = ref('')
const folderNameInput = ref<InstanceType<typeof Input> | null>(null)

// Delete folder confirmation
const deleteFolderDialogOpen = ref(false)
const deleteFolderName = ref('')

// Move to new folder (from connection dropdown)
const moveToNewFolderConnectionId = ref<string | null>(null)

const hasAnyConnections = computed(() => connectionsStore.connections.length > 0 || connectionsStore.allFolders.length > 0)

const isSearchActive = computed(() => searchQuery.value.trim().length > 0)

const hasSearchResults = computed(() => {
  if (!isSearchActive.value) return true
  const query = searchQuery.value.toLowerCase().trim()
  const hasGrouped = Object.values(localGrouped.value).some(conns =>
    conns.some(c => c.name.toLowerCase().includes(query))
  )
  const hasUngrouped = localUngrouped.value.some(c =>
    c.name.toLowerCase().includes(query))
  return hasGrouped || hasUngrouped
})

const sortedFolderNames = computed(() => {
  return Object.keys(localGrouped.value).sort((a, b) => a.localeCompare(b))
})

// Check if a connection matches the search
function matchesSearch(connection: SavedConnection): boolean {
  if (!isSearchActive.value) return true
  return connection.name.toLowerCase().includes(searchQuery.value.toLowerCase().trim())
}

// Check if a folder has any matching connections
function folderHasMatches(folder: string): boolean {
  if (!isSearchActive.value) return true
  return (localGrouped.value[folder] || []).some(c => matchesSearch(c))
}

onMounted(() => {
  connectionsStore.loadConnections()
})

function isConnecting(id: string) {
  return connectionsStore.getConnectionState(id).status === 'connecting'
}

async function handleConnect(id: string) {
  if (isConnecting(id)) return

  const state = connectionsStore.getConnectionState(id)
  if (state.status === 'connected') {
    connectionsStore.setActiveConnection(id)
    return
  }

  connectingId.value = id
  connectionError.value.delete(id)
  try {
    await connectionsStore.connect(id)
  } catch (e) {
    connectionError.value.set(id, e instanceof Error ? e.message : 'Connection failed')
  } finally {
    connectingId.value = null
  }
}

async function handleDeleteConnection(id: string) {
  if (confirm('Are you sure you want to delete this connection?')) {
    await connectionsStore.deleteConnection(id)
  }
}

function getDisplayHost(connection: { host: string | null; port: number | null; filepath: string | null; type: string; database: string }) {
  if (connection.type === 'sqlite' && connection.filepath) {
    return connection.filepath.split('/').pop() || connection.filepath
  }
  if (connection.type === 'mongodb' && connection.database?.startsWith('mongodb')) {
    return connection.database
  }
  if (connection.host) {
    return connection.port ? `${connection.host}:${connection.port}` : connection.host
  }
  return 'localhost'
}


function getEnvironmentBadgeVariant(env: string) {
  switch (env) {
    case 'production': return 'destructive' as const
    case 'staging': return 'default' as const
    default: return 'secondary' as const
  }
}

function toggleFolder(folder: string) {
  if (collapsedFolders.value.has(folder)) {
    collapsedFolders.value.delete(folder)
  } else {
    collapsedFolders.value.add(folder)
  }
}

function isFolderCollapsed(folder: string) {
  return collapsedFolders.value.has(folder)
}

// Drag handlers
function onDragStart() {
  isDragging.value = true
}

function onDragEnd() {
  isDragging.value = false
  persistPositions()
}

function persistPositions() {
  const positions: { id: string; sortOrder: number; folder: string | null }[] = []

  // Grouped connections
  for (const [folder, conns] of Object.entries(localGrouped.value)) {
    for (let i = 0; i < conns.length; i++) {
      positions.push({ id: conns[i].id, sortOrder: i, folder })
    }
  }

  // Ungrouped connections
  for (let i = 0; i < localUngrouped.value.length; i++) {
    positions.push({ id: localUngrouped.value[i].id, sortOrder: i, folder: null })
  }

  connectionsStore.updatePositions(positions)
}

// Folder dialog
function openCreateFolderDialog() {
  folderDialogMode.value = 'create'
  folderDialogName.value = ''
  folderDialogOldName.value = ''
  moveToNewFolderConnectionId.value = null
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

function openCreateFolderFromConnection(connectionId: string) {
  folderDialogMode.value = 'create'
  folderDialogName.value = ''
  folderDialogOldName.value = ''
  moveToNewFolderConnectionId.value = connectionId
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

function openRenameFolderDialog(folder: string) {
  folderDialogMode.value = 'rename'
  folderDialogName.value = folder
  folderDialogOldName.value = folder
  moveToNewFolderConnectionId.value = null
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

async function handleFolderDialogSubmit() {
  const name = folderDialogName.value.trim()
  if (!name) return

  if (folderDialogMode.value === 'rename') {
    await connectionsStore.renameFolder(folderDialogOldName.value, name)
  } else if (moveToNewFolderConnectionId.value) {
    await connectionsStore.updateConnectionFolder(moveToNewFolderConnectionId.value, name)
  } else {
    connectionsStore.createFolder(name)
  }

  folderDialogOpen.value = false
}

function openDeleteFolderDialog(folder: string) {
  deleteFolderName.value = folder
  deleteFolderDialogOpen.value = true
}

async function handleDeleteFolder() {
  await connectionsStore.deleteFolder(deleteFolderName.value)
  deleteFolderDialogOpen.value = false
}

async function handleMoveToFolder(connectionId: string, folder: string) {
  await connectionsStore.updateConnectionFolder(connectionId, folder)
}

async function handleRemoveFromFolder(connectionId: string) {
  await connectionsStore.updateConnectionFolder(connectionId, null)
}
</script>

<template>
  <div class="flex h-full flex-col bg-background">
    <!-- macOS Traffic Light Area -->
    <div class="h-[38px] flex-shrink-0 titlebar-drag" />

    <ScrollArea class="flex-1">
      <div class="max-w-3xl mx-auto px-8 py-8">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-2xl font-bold tracking-tight">Zequel</h1>
          <p class="text-sm text-muted-foreground mt-1">Select a connection to get started</p>
        </div>

        <!-- Search + Actions Bar -->
        <div class="flex items-center gap-2 mb-6">
          <div class="relative flex-1">
            <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search connections..." class="pl-8" />
          </div>
          <Button variant="outline" size="sm" @click="openCreateFolderDialog">
            <IconFolderPlus class="h-4 w-4" />

          </Button>
          <div class="flex items-center">
            <Button size="sm" class="rounded-r-none" @click="emit('new-connection')">
              New Connection
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button size="sm" class="rounded-l-none border-l border-primary-foreground/20 px-1.5">
                  <IconChevronDown class="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="emit('import-from-url')">
                  Import from URL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <!-- Empty state: no connections at all -->
        <div v-if="!hasAnyConnections" class="flex flex-col items-center justify-center py-16 text-center">
          <div class="rounded-full bg-muted p-4 mb-4">
            <IconDatabaseOff class="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 class="text-sm font-medium mb-1">No connections yet</h3>
          <p class="text-sm text-muted-foreground mb-4">Create your first connection to get started.</p>
          <Button size="sm" @click="emit('new-connection')">
            <IconPlus class="h-4 w-4" />
            New Connection
          </Button>
          <button class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            @click="emit('import-from-url')">
            or import from URL
          </button>
        </div>

        <!-- Empty state: search returned nothing -->
        <div v-else-if="isSearchActive && !hasSearchResults"
          class="flex flex-col items-center justify-center py-16 text-center">
          <div class="rounded-full bg-muted p-4 mb-4">
            <IconSearch class="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 class="text-sm font-medium mb-1">No results found</h3>
          <p class="text-sm text-muted-foreground">No connections match "{{ searchQuery }}"</p>
        </div>

        <template v-else>
          <!-- Folders -->
          <div v-for="folder in sortedFolderNames" :key="folder" class="mb-4"
            v-show="!isSearchActive || folderHasMatches(folder)">
            <!-- Folder Header -->
            <div class="flex items-center gap-1 group mb-1">
              <button
                class="flex items-center gap-1.5 flex-1 min-w-0 py-1.5 px-1 -ml-1 rounded hover:bg-accent/50 transition-colors text-left"
                @click="toggleFolder(folder)">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform"
                  :class="{ 'rotate-90': !isFolderCollapsed(folder) }" />
                <IconFolder class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="text-sm font-medium truncate">{{ folder }}</span>
                <Badge variant="secondary" class="text-[10px] ml-1 shrink-0">
                  {{ (localGrouped[folder] || []).length }}
                </Badge>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button
                    class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity shrink-0">
                    <IconDotsVertical class="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openRenameFolderDialog(folder)">
                    <IconPencil class="h-4 w-4 mr-2" />
                    Rename Folder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive focus:text-destructive"
                    @click="openDeleteFolderDialog(folder)">
                    <IconTrash class="h-4 w-4 mr-2" />
                    Delete Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <!-- Folder connections (draggable) -->
            <div v-if="!isFolderCollapsed(folder)" class="ml-5 border-l pl-2">
              <Draggable v-model="localGrouped[folder]" item-key="id" group="connections" ghost-class="opacity-30"
                handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                <template #item="{ element: connection }">
                  <div v-show="matchesSearch(connection)"
                    class="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group/row"
                    :class="{ 'opacity-75': isConnecting(connection.id) }" @click="handleConnect(connection.id)">
                    <!-- Drag handle -->
                    <div v-if="!isSearchActive"
                      class="drag-handle cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <IconGripVertical class="h-4 w-4 text-muted-foreground" />
                    </div>
                    <!-- Color stripe -->
                    <div class="w-0.5 self-stretch rounded-full shrink-0"
                      :style="{ backgroundColor: connection.color || 'transparent' }" />
                    <!-- Icon -->
                    <div class="shrink-0">
                      <IconLoader2 v-if="isConnecting(connection.id)"
                        class="h-4 w-4 animate-spin text-muted-foreground" />
                      <img v-else-if="getDbLogo(connection.type)" :src="getDbLogo(connection.type)"
                        :alt="connection.type" class="h-6 w-6" />
                      <IconDatabase v-else class="h-6 w-6 text-muted-foreground" />
                    </div>
                    <!-- Name + Host -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate">{{ connection.name }}</span>
                      </div>
                      <div class="text-xs text-muted-foreground truncate">{{ getDisplayHost(connection) }}</div>
                      <!-- Error message -->
                      <div v-if="connectionError.get(connection.id)"
                        class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                        <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                        <span class="truncate">{{ connectionError.get(connection.id) }}</span>
                      </div>
                    </div>
                    <!-- Badges -->
                    <div class="flex items-center gap-1 shrink-0">
                      <Badge v-if="connection.environment" :variant="getEnvironmentBadgeVariant(connection.environment)"
                        class="text-[10px]">
                        {{ connection.environment }}
                      </Badge>
                    </div>
                    <!-- Actions -->
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button
                          class="p-1 rounded opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-opacity shrink-0"
                          @click.stop>
                          <IconDotsVertical class="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click.stop="emit('edit-connection', connection.id)">
                          <IconPencil class="h-4 w-4 mr-2" />
                          Edit Connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <IconFolder class="h-4 w-4 mr-2" />
                            Move to Folder
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem v-for="f in connectionsStore.allFolders" :key="f" :disabled="f === folder"
                              @click.stop="handleMoveToFolder(connection.id, f)">
                              <IconFolder class="h-4 w-4 mr-2" />
                              {{ f }}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator v-if="connectionsStore.allFolders.length > 0" />
                            <DropdownMenuItem @click.stop="openCreateFolderFromConnection(connection.id)">
                              <IconFolderPlus class="h-4 w-4 mr-2" />
                              New Folder
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuItem @click.stop="handleRemoveFromFolder(connection.id)">
                          <IconFolderOff class="h-4 w-4 mr-2" />
                          Remove from Folder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem class="text-destructive focus:text-destructive"
                          @click.stop="handleDeleteConnection(connection.id)">
                          <IconTrash class="h-4 w-4 mr-2" />
                          Delete Connection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </template>
              </Draggable>
            </div>
          </div>

          <!-- Ungrouped connections -->
          <div v-if="localUngrouped.length > 0 || sortedFolderNames.length > 0">
            <div v-if="sortedFolderNames.length > 0" class="flex items-center gap-1.5 py-1.5 px-1 -ml-1 mb-1">
              <IconDatabase class="h-4 w-4 text-muted-foreground shrink-0" />
              <span class="text-sm font-medium text-muted-foreground">No Folder</span>
              <Badge variant="secondary" class="text-[10px] ml-1 shrink-0">
                {{ localUngrouped.length }}
              </Badge>
            </div>

            <div :class="{ 'ml-5 border-l pl-2': sortedFolderNames.length > 0 }">
              <Draggable v-model="localUngrouped" item-key="id" group="connections" ghost-class="opacity-30"
                handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                <template #item="{ element: connection }">
                  <div v-show="matchesSearch(connection)"
                    class="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group/row"
                    :class="{ 'opacity-75': isConnecting(connection.id) }" @click="handleConnect(connection.id)">
                    <!-- Drag handle -->
                    <div v-if="!isSearchActive"
                      class="drag-handle cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <IconGripVertical class="h-4 w-4 text-muted-foreground" />
                    </div>
                    <!-- Color stripe -->
                    <div class="w-0.5 self-stretch rounded-full shrink-0"
                      :style="{ backgroundColor: connection.color || 'transparent' }" />
                    <!-- Icon -->
                    <div class="shrink-0">
                      <IconLoader2 v-if="isConnecting(connection.id)"
                        class="h-4 w-4 animate-spin text-muted-foreground" />
                      <img v-else-if="getDbLogo(connection.type)" :src="getDbLogo(connection.type)"
                        :alt="connection.type" class="h-6 w-6" />
                      <IconDatabase v-else class="h-6 w-6 text-muted-foreground" />
                    </div>
                    <!-- Name + Host -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium truncate">{{ connection.name }}</span>
                      </div>
                      <div class="text-xs text-muted-foreground truncate">{{ getDisplayHost(connection) }}</div>
                      <!-- Error message -->
                      <div v-if="connectionError.get(connection.id)"
                        class="flex items-start gap-1 text-xs text-destructive mt-0.5">
                        <IconAlertCircle class="h-3 w-3 shrink-0 mt-0.5" />
                        <span class="truncate">{{ connectionError.get(connection.id) }}</span>
                      </div>
                    </div>
                    <!-- Badges -->
                    <div class="flex items-center gap-1 shrink-0">
                      <Badge v-if="connection.environment" :variant="getEnvironmentBadgeVariant(connection.environment)"
                        class="text-[10px]">
                        {{ connection.environment }}
                      </Badge>
                    </div>
                    <!-- Actions -->
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button
                          class="p-1 rounded opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-opacity shrink-0"
                          @click.stop>
                          <IconDotsVertical class="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click.stop="emit('edit-connection', connection.id)">
                          <IconPencil class="h-4 w-4 mr-2" />
                          Edit Connection
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <IconFolder class="h-4 w-4 mr-2" />
                            Move to Folder
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem v-for="f in connectionsStore.allFolders" :key="f"
                              @click.stop="handleMoveToFolder(connection.id, f)">
                              <IconFolder class="h-4 w-4 mr-2" />
                              {{ f }}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator v-if="connectionsStore.allFolders.length > 0" />
                            <DropdownMenuItem @click.stop="openCreateFolderFromConnection(connection.id)">
                              <IconFolderPlus class="h-4 w-4 mr-2" />
                              New Folder
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem class="text-destructive focus:text-destructive"
                          @click.stop="handleDeleteConnection(connection.id)">
                          <IconTrash class="h-4 w-4 mr-2" />
                          Delete Connection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </template>
              </Draggable>
            </div>
          </div>
        </template>
      </div>
    </ScrollArea>

    <!-- Folder Create/Rename Dialog -->
    <Dialog v-model:open="folderDialogOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ folderDialogMode === 'create' ? 'New Folder' : 'Rename Folder' }}</DialogTitle>
          <DialogDescription>
            {{ folderDialogMode === 'create' ? 'Enter a name for the new folder.' : 'Enter a new name for this folder.'
            }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleFolderDialogSubmit">
          <Input ref="folderNameInput" v-model="folderDialogName" placeholder="Folder name" />
          <DialogFooter class="mt-4">
            <Button type="button" variant="outline" size="sm" @click="folderDialogOpen = false">Cancel</Button>
            <Button type="submit" size="sm" :disabled="!folderDialogName.trim()">
              {{ folderDialogMode === 'create' ? 'Create' : 'Rename' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Delete Folder Confirmation Dialog -->
    <Dialog v-model:open="deleteFolderDialogOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ deleteFolderName }}"? Connections in this folder will be moved to
            ungrouped.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" @click="deleteFolderDialogOpen = false">Cancel</Button>
          <Button variant="destructive" size="sm" @click="handleDeleteFolder">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>