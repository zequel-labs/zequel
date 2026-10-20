<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useConnectionsStore } from '@/stores/connections'
import { ConnectionStatus, DatabaseType } from '@/types/connection'
import type { SavedConnection, ConnectionConfig } from '@/types/connection'
import type { ParsedConnectionUrl } from '@/lib/connection-url'
import { generateId } from '@/lib/utils'
import dayjs from '@/lib/dayjs'
import Draggable from 'vuedraggable'
import {
  IconLoader2,
  IconDotsVertical,
  IconPencil,
  IconTrash,
  IconFolder,
  IconFolderPlus,
  IconChevronRight,
  IconSearch,
  IconFolderOff,
  IconDatabaseOff,
  IconGripVertical,
  IconCopy,
  IconChevronDown,
  IconPlus,
  IconDatabaseExport,
  IconDatabaseImport
} from '@tabler/icons-vue'
import ConnectionListRow from '@/components/connection/ConnectionListRow.vue'
import logoUrl from '@/assets/images/zequel-logo.png'
import { toast } from 'vue-sonner'
import { buildDuplicateConnectionConfig } from '@/lib/connection'
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
import ConnectionForm from '@/components/connection/ConnectionForm.vue'
import ImportConnectionDialog from '@/components/connection/ImportConnectionDialog.vue'


const openTransfer = (mode: 'backup' | 'restore'): void => { void window.api.transfers.open(mode) }
const connectionsStore = useConnectionsStore()

const connectingId = ref<string | null>(null)

const searchQuery = ref('')
const collapsedFolders = ref<Set<string>>(new Set())
const ungroupedCollapsed = ref(false)
const selectedConnectionId = ref<string | null>(null)

// Connection form state (opens in a dialog, like TablePlus's connection window)
const editingConnection = ref<SavedConnection | null>(null)
const connectionDialogOpen = ref(false)
const appVersion = ref('')
const formResetKey = ref(0)
const showImportDialog = ref(false)
const importedPassword = ref<string | null>(null)

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
  void window.api.app.getVersion().then(version => { appVersion.value = version }).catch(() => {})
})

const isConnecting = (id: string) => {
  // Check if any session for this saved connection is currently connecting
  // (connectionStates temp keys start with 'connecting-{savedId}-')
  for (const [key, state] of connectionsStore.connectionStates) {
    if (key.startsWith(`connecting-${id}-`) && state.status === ConnectionStatus.Connecting) return true
  }
  return false
}

const isConnectionConnected = (id: string) => {
  return connectionsStore.getSessionsForSavedConnection(id).length > 0
}

const handleSelect = (id: string) => {
  selectedConnectionId.value = id
}

// Enter opens the selected connection, as in TablePlus.
const handleListKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && selectedConnectionId.value) handleConnect(selectedConnectionId.value)
}

const handleConnect = async (id: string) => {
  if (isConnecting(id)) return

  const sessions = connectionsStore.getSessionsForSavedConnection(id)
  if (sessions.length > 0) {
    connectionsStore.setActiveConnection(sessions[0])
    return
  }

  connectingId.value = id
  try {
    await connectionsStore.connect(id)
  } catch {
    toast.error('Connection failed')
  } finally {
    connectingId.value = null
  }
}

const handleDoubleClick = (id: string) => {
  handleConnect(id)
}

const handleNewConnection = () => {
  editingConnection.value = null
  importedPassword.value = null
  formResetKey.value++
  connectionDialogOpen.value = true
}

const handleEditConnection = (id: string) => {
  const conn = connectionsStore.connections.find(c => c.id === id)
  if (!conn) return
  editingConnection.value = conn
  formResetKey.value++
  connectionDialogOpen.value = true
}

const handleSaveConnection = async (config: ConnectionConfig) => {
  await connectionsStore.saveConnection(config)
  importedPassword.value = null
  const saved = connectionsStore.connections.find(c => c.name === config.name)
  if (saved) selectedConnectionId.value = saved.id
  connectionDialogOpen.value = false
  toast.success('Connection saved')
}

const handleConnectWithConfig = async (config: ConnectionConfig) => {
  connectionDialogOpen.value = false
  try {
    await connectionsStore.connectWithConfig(config)
  } catch {
    toast.error('Connection failed')
  }
}

const handleOpenImportDialog = () => {
  showImportDialog.value = true
}

const handleImportFromUrl = (data: ParsedConnectionUrl) => {
  showImportDialog.value = false
  importedPassword.value = data.password || null

  const db = data.database ? `/${data.database}` : ''
  const name = data.type === DatabaseType.MongoDB
    ? `mongodb@${data.host}`
    : `${data.type}@${data.host}${db}`

  const conn: SavedConnection = {
    id: generateId(),
    name,
    type: data.type,
    host: data.host,
    port: data.port,
    database: data.database,
    username: data.username || null,
    filepath: null,
    ssl: data.ssl,
    sslConfig: data.sslConfig ? {
      enabled: data.sslConfig.enabled,
      mode: data.sslConfig.mode,
      ca: '',
      cert: '',
      key: '',
      rejectUnauthorized: data.sslConfig.rejectUnauthorized,
      minVersion: 'TLSv1.2',
      serverName: '',
    } : null,
    ssh: null,
    color: null,
    environment: null,
    folder: null,
    trustServerCertificate: data.trustServerCertificate || undefined,
    sortOrder: 0,
    createdAt: dayjs.utc().toISOString(),
    updatedAt: dayjs.utc().toISOString(),
    lastConnectedAt: null
  }

  editingConnection.value = conn
  formResetKey.value++
  connectionDialogOpen.value = true
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
  if (selectedConnectionId.value === id) selectedConnectionId.value = null
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

const handleDuplicateConnection = async (id: string) => {
  const conn = connectionsStore.connections.find(c => c.id === id)
  if (!conn) return

  const config = buildDuplicateConnectionConfig(conn)

  await connectionsStore.saveConnection(config)

  const saved = connectionsStore.connections.find(c => c.id === config.id)
  if (saved) selectedConnectionId.value = saved.id

  toast.success('Connection duplicated')
}
</script>

<template>
  <div data-testid="home-view" class="flex h-full bg-background">
    <!-- Side panel: app identity and database tools, like TablePlus's welcome window -->
    <aside class="flex w-[200px] shrink-0 flex-col items-center border-r bg-muted/40 px-3 pb-3">
      <div class="platform-titlebar-spacer w-full" />
      <img :src="logoUrl" alt="" class="mt-6 size-20 select-none" draggable="false" />
      <h1 class="mt-3 text-xl font-bold tracking-tight">Zequel</h1>
      <p v-if="appVersion" class="text-[11px] text-muted-foreground">Version {{ appVersion }}</p>
      <div class="mt-auto w-full space-y-1.5">
        <Button variant="secondary" size="sm" class="h-8 w-full justify-start gap-2 text-[13px] font-normal" @click="openTransfer('backup')">
          <IconDatabaseExport class="size-4 text-muted-foreground" />Backup Database
        </Button>
        <Button variant="secondary" size="sm" class="h-8 w-full justify-start gap-2 text-[13px] font-normal" @click="openTransfer('restore')">
          <IconDatabaseImport class="size-4 text-muted-foreground" />Restore Database
        </Button>
      </div>
    </aside>

    <!-- Connections -->
    <main class="flex min-w-0 flex-1 flex-col">
      <div class="platform-titlebar-spacer" />
      <div class="flex shrink-0 items-center gap-1.5 px-3 pb-2">
        <Button data-testid="home-new-connection-btn" variant="ghost" size="icon" class="size-8" aria-label="New Connection" title="New Connection" @click="handleNewConnection()">
          <IconPlus class="size-4" />
        </Button>
        <Button variant="ghost" size="icon" class="size-8" aria-label="New Group" title="New Group" @click="openCreateFolderDialog()">
          <IconFolderPlus class="size-4" />
        </Button>
        <div class="relative flex-1">
          <IconSearch class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchQuery" data-testid="home-search-input" placeholder="Search for connection…"
            class="h-8 rounded-full border-transparent bg-muted pl-8 text-[13px] shadow-none" />
        </div>
      </div>

      <ScrollArea class="flex-1">
        <div class="px-3 pb-3 outline-none" role="listbox" aria-label="Connections" tabindex="0" @keydown="handleListKeydown">
          <!-- Empty state: no connections at all -->
          <div v-if="!hasAnyConnections" class="flex flex-col items-center justify-center py-24 text-center">
            <IconDatabaseOff class="mb-3 size-8 text-muted-foreground" />
            <h3 class="mb-1 text-sm font-medium">No connections</h3>
            <p class="mb-4 text-xs text-muted-foreground">Create your first connection to get started.</p>
            <Button size="sm" @click="handleNewConnection()"><IconPlus class="mr-1 size-4" />New Connection</Button>
          </div>

          <!-- Empty state: search returned nothing -->
          <div v-else-if="isSearchActive && !hasSearchResults" class="flex flex-col items-center justify-center py-24 text-center">
            <IconSearch class="mb-3 size-8 text-muted-foreground" />
            <h3 class="mb-1 text-sm font-medium">No results</h3>
            <p class="text-xs text-muted-foreground">No connections match "{{ searchQuery }}"</p>
          </div>

          <template v-else>
            <!-- Groups -->
            <div v-for="folder in sortedFolderNames" :key="folder" v-show="!isSearchActive || folderHasMatches(folder)" class="mb-1">
              <ContextMenu>
                <ContextMenuTrigger as-child>
                  <div class="group flex items-center gap-1">
                    <button class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left" :aria-expanded="!isFolderCollapsed(folder)" @click="toggleFolder(folder)">
                      <IconChevronDown v-if="!isFolderCollapsed(folder)" class="size-3.5 shrink-0 text-muted-foreground" />
                      <IconChevronRight v-else class="size-3.5 shrink-0 text-muted-foreground" />
                      <IconFolder class="size-5 shrink-0 text-amber-500" />
                      <span class="truncate text-[13px] font-semibold">{{ folder }}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button class="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100" aria-label="Folder actions">
                          <IconDotsVertical class="size-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="openRenameFolderDialog(folder)">
                          <IconPencil class="h-4 w-4 mr-2" />
                          Rename Folder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem class="text-destructive focus:text-destructive" @click="openDeleteFolderDialog(folder)">
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
                  <ContextMenuItem class="text-destructive focus:text-destructive" @click="openDeleteFolderDialog(folder)">
                    <IconTrash class="h-4 w-4 mr-2" />
                    Delete Folder
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>

              <div v-if="!isFolderCollapsed(folder)">
                <p v-if="(localGrouped[folder] || []).length === 0" class="py-1 pl-7 text-xs text-muted-foreground">No connections in this group</p>
              <Draggable v-model="localGrouped[folder]" item-key="id" group="connections" ghost-class="opacity-30"
                handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                <template #item="{ element: connection }">
                  <ContextMenu>
                    <ContextMenuTrigger as-child>
                      <div v-show="matchesSearch(connection)" role="option" :aria-selected="selectedConnectionId === connection.id"
                        :data-testid="`home-connection-${connection.id}`"
                        class="drag-handle group/row flex cursor-default items-center gap-2 rounded-md py-1 pl-6 pr-2"
                        :class="{ 'bg-accent': selectedConnectionId === connection.id, 'opacity-75': isConnecting(connection.id) }"
                        @click="handleSelect(connection.id)" @dblclick="handleDoubleClick(connection.id)">
                        <ConnectionListRow :connection="connection" :connecting="isConnecting(connection.id)" :connected="isConnectionConnected(connection.id)" />
                        <IconGripVertical v-if="!isSearchActive" class="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100" />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem @click="handleConnect(connection.id)">Connect</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem @click="handleEditConnection(connection.id)">
                        <IconPencil class="h-4 w-4 mr-2" />
                        Edit
                      </ContextMenuItem>
                      <ContextMenuItem @click="handleDuplicateConnection(connection.id)">
                        <IconCopy class="h-4 w-4 mr-2" />
                        Duplicate
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
                      <ContextMenuItem class="text-destructive focus:text-destructive" @click="openDeleteConnectionDialog(connection.id)">
                        <IconTrash class="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </template>
              </Draggable>
              </div>
            </div>

            <!-- Connections without a group -->
            <div v-if="localUngrouped.length > 0">
              <button v-if="sortedFolderNames.length > 0" class="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left"
                :aria-expanded="!ungroupedCollapsed" @click="ungroupedCollapsed = !ungroupedCollapsed">
                <IconChevronDown v-if="!ungroupedCollapsed" class="size-3.5 shrink-0 text-muted-foreground" />
                <IconChevronRight v-else class="size-3.5 shrink-0 text-muted-foreground" />
                <IconFolder class="size-5 shrink-0 text-muted-foreground" />
                <span class="truncate text-[13px] font-semibold">No Group</span>
              </button>
              <div v-if="!ungroupedCollapsed">
              <Draggable v-model="localUngrouped" item-key="id" group="connections" ghost-class="opacity-30"
                handle=".drag-handle" :disabled="isSearchActive" @start="onDragStart" @end="onDragEnd">
                <template #item="{ element: connection }">
                  <ContextMenu>
                    <ContextMenuTrigger as-child>
                      <div v-show="matchesSearch(connection)" role="option" :aria-selected="selectedConnectionId === connection.id"
                        :data-testid="`home-connection-${connection.id}`"
                        class="drag-handle group/row flex cursor-default items-center gap-2 rounded-md py-1 pl-6 pr-2"
                        :class="{ 'bg-accent': selectedConnectionId === connection.id, 'opacity-75': isConnecting(connection.id) }"
                        @click="handleSelect(connection.id)" @dblclick="handleDoubleClick(connection.id)">
                        <ConnectionListRow :connection="connection" :connecting="isConnecting(connection.id)" :connected="isConnectionConnected(connection.id)" />
                        <IconGripVertical v-if="!isSearchActive" class="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100" />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem @click="handleConnect(connection.id)">Connect</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem @click="handleEditConnection(connection.id)">
                        <IconPencil class="h-4 w-4 mr-2" />
                        Edit
                      </ContextMenuItem>
                      <ContextMenuItem @click="handleDuplicateConnection(connection.id)">
                        <IconCopy class="h-4 w-4 mr-2" />
                        Duplicate
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
                      <ContextMenuItem class="text-destructive focus:text-destructive" @click="openDeleteConnectionDialog(connection.id)">
                        <IconTrash class="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </template>
              </Draggable>
              </div>
            </div>
          </template>
        </div>
      </ScrollArea>
    </main>

    <!-- New/Edit Connection -->
    <Dialog v-model:open="connectionDialogOpen">
      <DialogContent data-testid="home-connection-dialog" class="max-h-[90vh] max-w-xl overflow-y-auto border-0 bg-transparent p-0 shadow-none">
        <DialogTitle class="sr-only">{{ editingConnection?.id && connectionsStore.connections.some(c => c.id === editingConnection?.id) ? 'Edit Connection' : 'New Connection' }}</DialogTitle>
        <DialogDescription class="sr-only">Connection settings</DialogDescription>
        <ConnectionForm
          :key="formResetKey"
          :connection="editingConnection"
          :prefill-password="importedPassword"
          @save="handleSaveConnection"
          @connect="handleConnectWithConfig"
          @import-url="handleOpenImportDialog"
        />
      </DialogContent>
    </Dialog>

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
    <ImportConnectionDialog :open="showImportDialog" @update:open="showImportDialog = $event" @import="handleImportFromUrl" />
  </div>
</template>