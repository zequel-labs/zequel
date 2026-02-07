<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type UsersTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { useStatusBarStore } from '@/stores/statusBar'
import { useColumnResize } from '@/composables/useColumnResize'
import { DatabaseType } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDateTime } from '@/lib/date'
import CreateUserDialog from '@/components/schema/CreateUserDialog.vue'
import ConfirmDeleteDialog from '@/components/schema/ConfirmDeleteDialog.vue'
import { toast } from 'vue-sonner'
import {
  Loader2,
  AlertCircle,
  Trash2
} from 'lucide-vue-next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { DatabaseUser } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()
const statusBarStore = useStatusBarStore()

const loading = ref(true)
const error = ref<string | null>(null)
const users = ref<DatabaseUser[]>([])
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const userToDelete = ref<string | null>(null)

const { columnWidths, resizingColumn, onResizeStart } = useColumnResize({
  name: 200,
  host: 120,
  attributes: 200,
  password: 80,
  roles: 200,
  connectionLimit: 100,
  validUntil: 150,
  actions: 60
})

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as UsersTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const connection = computed(() => {
  return connectionsStore.connections.find((c) => c.id === connectionId.value)
})

const isSqlite = computed(() => connection.value?.type === DatabaseType.SQLite)
const currentUsername = computed(() => connection.value?.username ?? null)

const loadUsers = async () => {
  if (!connectionId.value) return

  loading.value = true
  error.value = null

  try {
    users.value = await window.api.schema.getUsers(connectionId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load users'
    console.error('Error loading users:', err)
  } finally {
    loading.value = false
  }
}

const getUserKey = (user: DatabaseUser): string => {
  return user.host ? `${user.name}@${user.host}` : user.name
}

const getUserAttributes = (user: DatabaseUser): string => {
  const attrs: string[] = []
  if (user.superuser) attrs.push('Superuser')
  if (user.createRole) attrs.push('Create Role')
  if (user.createDb) attrs.push('Create DB')
  if (user.replication) attrs.push('Replication')
  if (user.bypassRls) attrs.push('Bypass RLS')
  if (user.login === false) attrs.push('No Login')
  return attrs.join(', ') || '-'
}

const confirmDeleteUser = (userName: string) => {
  userToDelete.value = userName
  showDeleteDialog.value = true
}

const deleteUser = async () => {
  if (!userToDelete.value || !connectionId.value) return

  try {
    const result = await window.api.schema.dropUser(connectionId.value, {
      name: userToDelete.value
    })

    if (result.success) {
      toast.success(`User "${userToDelete.value}" deleted successfully`)
      await loadUsers()
    } else {
      toast.error(`Failed to delete user: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to delete user')
  }
}

const setupStatusBar = () => {
  if (tabsStore.activeTabId !== props.tabId) return
  statusBarStore.ownerTabId = props.tabId
  statusBarStore.showUsersControls = true
  statusBarStore.usersCount = users.value.length
  statusBarStore.registerUsersCallbacks({
    onRefresh: () => loadUsers(),
    onCreate: () => { showCreateDialog.value = true },
  })
}

onMounted(() => {
  setupStatusBar()
  loadUsers()
})

watch(() => tabsStore.activeTabId, (activeId) => {
  if (activeId === props.tabId) {
    setupStatusBar()
  }
})

watch(() => users.value.length, (count) => {
  if (tabsStore.activeTabId === props.tabId) {
    statusBarStore.usersCount = count
  }
})

watch(connectionId, () => {
  loadUsers()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- SQLite Notice -->
    <div v-if="isSqlite" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <p class="text-sm">User management is not available for SQLite databases</p>
      <p class="text-xs">All access control is handled at the file system level</p>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="flex items-center justify-center h-full">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle class="h-8 w-8 text-destructive" />
      <p class="text-sm text-destructive">{{ error }}</p>
      <Button variant="outline" @click="loadUsers">
        Retry
      </Button>
    </div>

    <!-- Empty State -->
    <div v-else-if="users.length === 0" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
      <p class="text-sm">No users found</p>
      <p class="text-xs">No database users were found or you don't have permission to view them.</p>
    </div>

    <!-- Users Table -->
    <ScrollArea v-else class="flex-1">
      <table class="w-full border-collapse text-xs" :class="{ 'select-none': resizingColumn }" style="table-layout: fixed;">
        <colgroup>
          <col :style="{ width: `${columnWidths.name}px` }" />
          <col :style="{ width: `${columnWidths.host}px` }" />
          <col :style="{ width: `${columnWidths.attributes}px` }" />
          <col :style="{ width: `${columnWidths.password}px` }" />
          <col :style="{ width: `${columnWidths.roles}px` }" />
          <col :style="{ width: `${columnWidths.connectionLimit}px` }" />
          <col :style="{ width: `${columnWidths.validUntil}px` }" />
          <col :style="{ width: `${columnWidths.actions}px` }" />
        </colgroup>
        <thead class="sticky top-0 z-10 bg-background">
          <tr>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Name
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'name' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('name', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Host
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'host' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('host', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Attributes
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'attributes' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('attributes', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Password
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'password' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('password', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Roles
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'roles' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('roles', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Conn. Limit
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'connectionLimit' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('connectionLimit', $event)" />
            </th>
            <th class="relative px-2 py-1.5 text-left font-medium border-b border-r border-border whitespace-nowrap overflow-hidden text-ellipsis">
              Valid Until
              <div class="absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-primary/50"
                :class="resizingColumn === 'validUntil' ? 'bg-primary' : 'bg-transparent'"
                @mousedown.stop.prevent="onResizeStart('validUntil', $event)" />
            </th>
            <th class="px-2 py-1.5 text-left font-medium border-b border-border whitespace-nowrap overflow-hidden text-ellipsis">
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="getUserKey(user)" class="h-8 hover:bg-muted/30">
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center font-mono truncate">{{ user.name }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate text-muted-foreground">{{ user.host || '-' }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate">{{ getUserAttributes(user) }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate text-muted-foreground">{{ user.hasPassword === undefined ? '-' : user.hasPassword ? 'Yes' : 'No' }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate text-muted-foreground">{{ user.roles && user.roles.length > 0 ? (Array.isArray(user.roles) ? user.roles.join(', ') : user.roles) : '-' }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate">{{ user.connectionLimit !== undefined ? (user.connectionLimit || 'Unlimited') : '-' }}</div></td>
            <td class="p-0 border-b border-r border-border"><div class="h-8 px-1.5 flex items-center truncate text-muted-foreground">{{ user.validUntil ? formatDateTime(user.validUntil) : '-' }}</div></td>
            <td class="p-0 border-b border-border">
              <div class="h-8 flex items-center justify-center">
                <TooltipProvider v-if="currentUsername && user.name === currentUsername">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="h-6 w-6 text-muted-foreground opacity-30"
                        disabled
                      >
                        <Trash2 class="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cannot delete the current user</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  v-else
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 text-muted-foreground hover:text-destructive"
                  @click="confirmDeleteUser(user.name)"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </ScrollArea>

    <!-- Create User Dialog -->
    <CreateUserDialog
      v-model:open="showCreateDialog"
      :connection-id="connectionId"
      @created="loadUsers"
    />

    <!-- Confirm Delete Dialog -->
    <ConfirmDeleteDialog
      v-model:open="showDeleteDialog"
      title="Delete User"
      :message="`Are you sure you want to delete user &quot;${userToDelete}&quot;? This action cannot be undone.`"
      confirm-text="Delete"
      @confirm="deleteUser"
    />
  </div>
</template>
