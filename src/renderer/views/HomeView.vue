<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { useSettingsStore } from '@/stores/settings'
import { ConnectionStatus } from '@/types/connection'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import Draggable from 'vuedraggable'
import {
  IconDatabase,
  IconPlus,
  IconLoader2,
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
  IconGripVertical
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { getEnvironmentTextClass, getConnectionSubtitle } from '@/lib/connection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ConnectionForm from '@/components/connection/ConnectionForm.vue'
import ImportConnectionDialog from '@/components/connection/ImportConnectionDialog.vue'


const connectionsStore = useConnectionsStore()
const settingsStore = useSettingsStore()

const connectingId = ref<string | null>(null)
const connectionError = ref<Map<string, string>>(new Map())
const searchQuery = ref('')
const collapsedFolders = ref<Set<string>>(new Set())
const ungroupedCollapsed = ref(false)
const selectedConnectionId = ref<string | null>(null)

// Connection form state
const editingConnection = ref<SavedConnection | null>(null)
const showImportDialog = ref(false)

// Sidebar resize
const sidebarWidth = ref(settingsStore.sidebarWidth || 280)
const isResizing = ref(false)

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

// Clear selection if the selected connection is deleted
watch(
  () => connectionsStore.connections,
  (conns) => {
    if (selectedConnectionId.value && !conns.find(c => c.id === selectedConnectionId.value)) {
      selectedConnectionId.value = null
    }
  }
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

// Delete connection confirmation
const deleteConnectionDialogOpen = ref(false)
const deleteConnectionId = ref<string | null>(null)
const deleteConnectionName = ref('')

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
const matchesSearch = (connection: SavedConnection): boolean => {
  if (!isSearchActive.value) return true
  return connection.name.toLowerCase().includes(searchQuery.value.toLowerCase().trim())
}

// Check if a folder has any matching connections
const folderHasMatches = (folder: string): boolean => {
  if (!isSearchActive.value) return true
  return (localGrouped.value[folder] || []).some(c => matchesSearch(c))
}

onMounted(() => {
  connectionsStore.loadConnections()
})

const isConnecting = (id: string) => {
  return connectionsStore.getConnectionState(id).status === ConnectionStatus.Connecting
}

const isConnectionConnected = (id: string) => {
  return connectionsStore.getConnectionState(id).status === ConnectionStatus.Connected
}

const handleSelect = (id: string) => {
  selectedConnectionId.value = id
  const conn = connectionsStore.connections.find(c => c.id === id)
  editingConnection.value = conn || null
}

const handleConnect = async (id: string) => {
  if (isConnecting(id)) return

  const state = connectionsStore.getConnectionState(id)
  if (state.status === ConnectionStatus.Connected) {
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

const handleDoubleClick = (id: string) => {
  handleConnect(id)
}

const handleNewConnection = () => {
  editingConnection.value = null
  selectedConnectionId.value = null
}

const handleEditConnection = (id: string) => {
  const conn = connectionsStore.connections.find(c => c.id === id)
  if (!conn) return
  editingConnection.value = conn
}

const handleSaveConnection = async (config: ConnectionConfig) => {
  await connectionsStore.saveConnection(config)
  const saved = connectionsStore.connections.find(c => c.name === config.name)
  if (saved) {
    selectedConnectionId.value = saved.id
    editingConnection.value = saved
  }
  toast.success('Connection saved')
}

const handleConnectWithConfig = async (config: ConnectionConfig) => {
  try {
    await connectionsStore.connectWithConfig(config)
  } catch (e) {
    connectionError.value.set(config.id, e instanceof Error ? e.message : 'Connection failed')
  }
}

const handleImportFromUrl = () => {
  showImportDialog.value = true
}

const handleImportSave = async (config: ConnectionConfig) => {
  await connectionsStore.saveConnection(config)
  showImportDialog.value = false
  const saved = connectionsStore.connections.find(c => c.name === config.name)
  if (saved) {
    selectedConnectionId.value = saved.id
  }
}

const openDeleteConnectionDialog = (id: string) => {
  const conn = connectionsStore.connections.find(c => c.id === id)
  if (!conn) return
  deleteConnectionId.value = id
  deleteConnectionName.value = conn.name
  deleteConnectionDialogOpen.value = true
}

const handleDeleteConnection = async () => {
  if (!deleteConnectionId.value) return
  const id = deleteConnectionId.value
  if (selectedConnectionId.value === id) {
    selectedConnectionId.value = null
  }
  await connectionsStore.deleteConnection(id)
  deleteConnectionDialogOpen.value = false
}

const toggleFolder = (folder: string) => {
  if (collapsedFolders.value.has(folder)) {
    collapsedFolders.value.delete(folder)
  } else {
    collapsedFolders.value.add(folder)
  }
}

const isFolderCollapsed = (folder: string) => {
  return collapsedFolders.value.has(folder)
}

// Drag handlers
const onDragStart = () => {
  isDragging.value = true
}

const onDragEnd = () => {
  isDragging.value = false
  persistPositions()
}

const persistPositions = () => {
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

// Sidebar resize
const startResize = (e: MouseEvent) => {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX
    const newWidth = Math.max(200, Math.min(500, startWidth + delta))
    sidebarWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizing.value = false
    settingsStore.setSidebarWidth(sidebarWidth.value)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// Folder dialog
const openCreateFolderDialog = () => {
  folderDialogMode.value = 'create'
  folderDialogName.value = ''
  folderDialogOldName.value = ''
  moveToNewFolderConnectionId.value = null
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

const openCreateFolderFromConnection = (connectionId: string) => {
  folderDialogMode.value = 'create'
  folderDialogName.value = ''
  folderDialogOldName.value = ''
  moveToNewFolderConnectionId.value = connectionId
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

const openRenameFolderDialog = (folder: string) => {
  folderDialogMode.value = 'rename'
  folderDialogName.value = folder
  folderDialogOldName.value = folder
  moveToNewFolderConnectionId.value = null
  folderDialogOpen.value = true
  nextTick(() => (folderNameInput.value?.$el as HTMLInputElement)?.focus())
}

const handleFolderDialogSubmit = async () => {
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

const openDeleteFolderDialog = (folder: string) => {
  deleteFolderName.value = folder
  deleteFolderDialogOpen.value = true
}

const handleDeleteFolder = async () => {
  await connectionsStore.deleteFolder(deleteFolderName.value)
  deleteFolderDialogOpen.value = false
}

const handleMoveToFolder = async (connectionId: string, folder: string) => {
  await connectionsStore.updateConnectionFolder(connectionId, folder)
}

const handleRemoveFromFolder = async (connectionId: string) => {
  await connectionsStore.updateConnectionFolder(connectionId, null)
}
</script>

<template>
  <div class="flex h-full bg-background">
    <!-- Sidebar -->
    <div class="flex-shrink-0 flex flex-col bg-muted/30 border-r relative" :style="{ width: sidebarWidth + 'px' }">
      <!-- Platform Titlebar Spacer -->
      <div class="platform-titlebar-spacer" />
      <!-- Sidebar Header: Actions + Search -->
      <div class="flex-shrink-0 px-2 pt-2 pb-2 space-y-2">
        <Button variant="default" size="lg" class="w-full justify-center gap-1.5" @click="handleNewConnection()">
          <IconPlus class="h-3.5 w-3.5" />
          New Connection
        </Button>
        <div class="relative">
          <IconSearch class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-8" />
        </div>
      </div>

      <!-- Sidebar Content -->
      <ScrollArea class="flex-1">
        <div class="px-1 pb-2">
          <!-- Empty state: no connections at all -->
          <div v-if="!hasAnyConnections" class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div class="rounded-full bg-muted p-3 mb-3">
              <IconDatabaseOff class="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 class="text-sm font-medium mb-1">No connections</h3>
            <p class="text-xs text-muted-foreground mb-3">Create your first connection to get started.</p>
            <Button size="sm" class="h-7 text-xs" @click="handleNewConnection()">
              <IconPlus class="h-3.5 w-3.5 mr-1" />
              New Connection
            </Button>
          </div>

          <!-- Empty state: search returned nothing -->
          <div v-else-if="isSearchActive && !hasSearchResults"
            class="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div class="rounded-full bg-muted p-3 mb-3">
              <IconSearch class="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 class="text-sm font-medium mb-1">No results</h3>
            <p class="text-xs text-muted-foreground">No connections match "{{ searchQuery }}"</p>
          </div>

          <template v-else>
            <!-- Folders -->
            <div v-for="folder in sortedFolderNames" :key="folder" class="mb-1"
              v-show="!isSearchActive || folderHasMatches(folder)">
              <!-- Folder Header -->
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div class="flex items-center gap-1 group pr-2">
                    <button
                      class="flex items-center gap-1.5 flex-1 min-w-0 py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                      @click="toggleFolder(folder)">
                      <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150"
                        :class="{ 'rotate-90': !isFolderCollapsed(folder) }" />
                      <IconFolder class="h-4 w-4 text-muted-foreground shrink-0" />
                      <span class="text-xs font-medium truncate">{{ folder }}</span>
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
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem @click="openRenameFolderDialog(folder)">
                    <IconPencil class="h-4 w-4 mr-2" />
                    Rename Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem class="text-destructive focus:text-destructive"
                    @click="openDeleteFolderDialog(folder)">
                    <IconTrash class="h-4 w-4 mr-2" />
                    Delete Folder
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <!-- Folder connections (draggable) -->
              <div v-if="!isFolderCollapsed(folder)" class="ml-1">
                <p v-if="(localGrouped[folder] || []).length === 0" class="text-xs text-muted-foreground px-2 py-2">
                  No connections in this folder
                </p>
                <Draggable v-model="localGrouped[folder]" item-key="id" group="connections" ghost-class="opacity-30"
                  handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                  <template #item="{ element: connection }">
                    <div v-show="matchesSearch(connection)"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group/row text-sm"
                      :class="{
                        'bg-accent': selectedConnectionId === connection.id,
                        'opacity-75': isConnecting(connection.id)
                      }" @click="handleSelect(connection.id)" @dblclick="handleDoubleClick(connection.id)">
                      <!-- Drag handle (outside ContextMenuTrigger) -->
                      <div v-if="!isSearchActive"
                        class="drag-handle cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <IconGripVertical class="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <ContextMenu>
                        <ContextMenuTrigger as-child>
                          <div class="flex items-center gap-2 flex-1 min-w-0">
                            <!-- Color bar -->
                            <div class="w-1 self-stretch rounded-full shrink-0" :style="{ backgroundColor: connection.color || '#6b7280' }" />
                            <!-- Name + Host -->
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-medium truncate max-w-[260px]">
                                <IconLoader2 v-if="isConnecting(connection.id)" class="inline h-3 w-3 animate-spin text-muted-foreground mr-1" />
                                <div v-if="isConnectionConnected(connection.id)" class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                                {{ connection.name }}
                                <span v-if="connection.environment" :class="getEnvironmentTextClass(connection.environment)" class="font-normal"> ({{ connection.environment }})</span>
                              </div>
                              <div class="text-[10px] text-muted-foreground truncate max-w-[260px]">{{ getConnectionSubtitle(connection) }}
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                        <ContextMenuItem @click="handleConnect(connection.id)">
                          Connect
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem @click="handleEditConnection(connection.id)">
                          <IconPencil class="h-4 w-4 mr-2" />
                          Edit
                        </ContextMenuItem>
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <IconFolder class="h-4 w-4 mr-2" />
                            Move to Folder
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent>
                            <ContextMenuItem v-for="f in connectionsStore.allFolders" :key="f" :disabled="f === folder"
                              @click="handleMoveToFolder(connection.id, f)">
                              <IconFolder class="h-4 w-4 mr-2" />
                              {{ f }}
                            </ContextMenuItem>
                            <ContextMenuSeparator v-if="connectionsStore.allFolders.length > 0" />
                            <ContextMenuItem @click="openCreateFolderFromConnection(connection.id)">
                              <IconFolderPlus class="h-4 w-4 mr-2" />
                              New Folder
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuItem @click="handleRemoveFromFolder(connection.id)">
                          <IconFolderOff class="h-4 w-4 mr-2" />
                          Remove from Folder
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem class="text-destructive focus:text-destructive"
                          @click="openDeleteConnectionDialog(connection.id)">
                          <IconTrash class="h-4 w-4 mr-2" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                    </div>
                  </template>
                </Draggable>
              </div>
            </div>

            <!-- Ungrouped connections -->
            <div v-if="localUngrouped.length > 0 || sortedFolderNames.length > 0">
              <button v-if="sortedFolderNames.length > 0"
                class="flex items-center gap-1.5 w-full py-1.5 px-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                @click="ungroupedCollapsed = !ungroupedCollapsed">
                <IconChevronRight class="h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-150"
                  :class="{ 'rotate-90': !ungroupedCollapsed }" />
                <IconDatabase class="h-4 w-4 text-muted-foreground shrink-0" />
                <span class="text-xs font-medium truncate">No Folder</span>
              </button>

              <div v-if="!ungroupedCollapsed" :class="{ 'ml-1': sortedFolderNames.length > 0 }">
                <Draggable v-model="localUngrouped" item-key="id" group="connections" ghost-class="opacity-30"
                  handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                  <template #item="{ element: connection }">
                    <div v-show="matchesSearch(connection)"
                      class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors group/row text-sm"
                      :class="{
                        'bg-accent': selectedConnectionId === connection.id,
                        'opacity-75': isConnecting(connection.id)
                      }" @click="handleSelect(connection.id)" @dblclick="handleDoubleClick(connection.id)">
                      <!-- Drag handle (outside ContextMenuTrigger) -->
                      <div v-if="!isSearchActive"
                        class="drag-handle cursor-grab active:cursor-grabbing shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <IconGripVertical class="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <ContextMenu>
                        <ContextMenuTrigger as-child>
                          <div class="flex items-center gap-2 flex-1 min-w-0">
                            <!-- Color bar -->
                            <div class="w-1 self-stretch rounded-full shrink-0" :style="{ backgroundColor: connection.color || '#6b7280' }" />
                            <!-- Name + Host -->
                            <div class="flex-1 min-w-0">
                              <div class="text-xs font-medium truncate max-w-[260px]">
                                <IconLoader2 v-if="isConnecting(connection.id)" class="inline h-3 w-3 animate-spin text-muted-foreground mr-1" />
                                <div v-if="isConnectionConnected(connection.id)" class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                                {{ connection.name }}
                                <span v-if="connection.environment" :class="getEnvironmentTextClass(connection.environment)" class="font-normal"> ({{ connection.environment }})</span>
                              </div>
                              <div class="text-[10px] text-muted-foreground truncate max-w-[260px]">{{ getConnectionSubtitle(connection) }}
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem @click="handleConnect(connection.id)">
                            Connect
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem @click="handleEditConnection(connection.id)">
                            <IconPencil class="h-4 w-4 mr-2" />
                            Edit
                          </ContextMenuItem>
                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <IconFolder class="h-4 w-4 mr-2" />
                              Move to Folder
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent>
                              <ContextMenuItem v-for="f in connectionsStore.allFolders" :key="f"
                                @click="handleMoveToFolder(connection.id, f)">
                                <IconFolder class="h-4 w-4 mr-2" />
                                {{ f }}
                              </ContextMenuItem>
                              <ContextMenuSeparator v-if="connectionsStore.allFolders.length > 0" />
                              <ContextMenuItem @click="openCreateFolderFromConnection(connection.id)">
                                <IconFolderPlus class="h-4 w-4 mr-2" />
                                New Folder
                              </ContextMenuItem>
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                          <ContextMenuSeparator />
                          <ContextMenuItem class="text-destructive focus:text-destructive"
                            @click="openDeleteConnectionDialog(connection.id)">
                            <IconTrash class="h-4 w-4 mr-2" />
                            Delete
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  </template>
                </Draggable>
              </div>
            </div>
          </template>
        </div>
      </ScrollArea>

      <!-- Sidebar Resize Handle -->
      <div class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10"
        :class="{ 'bg-primary/30': isResizing }" @mousedown.prevent="startResize" />
    </div>

    <!-- Content Area -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div class="platform-titlebar-spacer" />
      <div class="flex-1 min-h-0 overflow-y-auto">
        <!-- New/Edit Connection form -->
        <div class="flex justify-center h-full px-6 py-8 overflow-y-auto">
          <ConnectionForm class="my-auto"
            :connection="editingConnection"
            @save="handleSaveConnection"
            @connect="handleConnectWithConfig"
            @import-url="handleImportFromUrl"
          />
        </div>
      </div>
    </div>

    <!-- Folder Create/Rename Dialog -->
    <Dialog v-model:open="folderDialogOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{ folderDialogMode === 'create' ? 'New Folder' : 'Rename Folder' }}</DialogTitle>
          <DialogDescription>
            {{ folderDialogMode === 'create' ? 'Organize your connections into groups.' : 'Choose a new name for this folder.'
            }}
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="handleFolderDialogSubmit" class="space-y-4">
          <div class="space-y-2">
            <label class="text-sm font-medium">Name</label>
            <Input ref="folderNameInput" v-model="folderDialogName" placeholder="Folder name" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="folderDialogOpen = false">Cancel</Button>
            <Button type="submit" :disabled="!folderDialogName.trim()">
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
          <Button variant="outline" @click="deleteFolderDialogOpen = false">Cancel</Button>
          <Button variant="destructive" @click="handleDeleteFolder">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Connection Confirmation Dialog -->
    <Dialog v-model:open="deleteConnectionDialogOpen">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Connection</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ deleteConnectionName }}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteConnectionDialogOpen = false">Cancel</Button>
          <Button variant="destructive" @click="handleDeleteConnection">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Import from URL Dialog -->
    <ImportConnectionDialog :open="showImportDialog" @update:open="showImportDialog = $event" @save="handleImportSave" />
  </div>
</template>