<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type UsersTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/date'
import {
  Loader2,
  ShieldAlert,
  ChevronRight,
  ChevronDown,
  AlertCircle
} from 'lucide-vue-next'
import {
  IconRefresh,
  IconKey
} from '@tabler/icons-vue'
import type { DatabaseUser, UserPrivilege } from '@/types/table'

const props = defineProps<{
  tabId: string
}>()

const tabsStore = useTabsStore()
const connectionsStore = useConnectionsStore()

const loading = ref(true)
const error = ref<string | null>(null)
const users = ref<DatabaseUser[]>([])
const expandedUser = ref<string | null>(null)
const loadingPrivileges = ref<Set<string>>(new Set())
const userPrivileges = ref<Map<string, UserPrivilege[]>>(new Map())

const tabData = computed(() => {
  const tab = tabsStore.tabs.find((t) => t.id === props.tabId)
  return tab?.data as UsersTabData | undefined
})

const connectionId = computed(() => tabData.value?.connectionId || '')

const connection = computed(() => {
  return connectionsStore.connections.find((c) => c.id === connectionId.value)
})

const isSqlite = computed(() => connection.value?.type === DatabaseType.SQLite)

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

const loadPrivileges = async (user: DatabaseUser) => {
  const key = getUserKey(user)

  if (userPrivileges.value.has(key)) {
    return // Already loaded
  }

  loadingPrivileges.value.add(key)
  try {
    const privileges = await window.api.schema.getUserPrivileges(
      connectionId.value,
      user.name,
      user.host
    )
    userPrivileges.value.set(key, privileges)
  } catch (err) {
    console.error('Error loading privileges:', err)
    userPrivileges.value.set(key, [])
  } finally {
    loadingPrivileges.value.delete(key)
  }
}

const getUserKey = (user: DatabaseUser): string => {
  return user.host ? `${user.name}@${user.host}` : user.name
}

const toggleUser = (user: DatabaseUser) => {
  const key = getUserKey(user)
  if (expandedUser.value === key) {
    expandedUser.value = null
  } else {
    expandedUser.value = key
    loadPrivileges(user)
  }
}

const getUserBadges = (user: DatabaseUser): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] => {
  const badges: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }[] = []

  if (user.superuser) {
    badges.push({ label: 'Superuser', variant: 'destructive' })
  }
  if (user.createRole) {
    badges.push({ label: 'Create Role', variant: 'secondary' })
  }
  if (user.createDb) {
    badges.push({ label: 'Create DB', variant: 'secondary' })
  }
  if (user.replication) {
    badges.push({ label: 'Replication', variant: 'outline' })
  }
  if (user.login === false) {
    badges.push({ label: 'No Login', variant: 'outline' })
  }

  return badges
}

onMounted(() => {
  loadUsers()
})

watch(connectionId, () => {
  loadUsers()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="flex items-center gap-2">
        <h1 class="text-lg font-semibold">Database Users</h1>
        <Badge variant="outline">{{ users.length }} {{ users.length === 1 ? 'user' : 'users' }}</Badge>
      </div>
      <Button variant="outline" @click="loadUsers" :disabled="loading">
        <IconRefresh class="h-4 w-4 mr-2" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto p-4">
      <!-- SQLite Notice -->
      <div v-if="isSqlite" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p class="text-lg">User management is not available for SQLite databases</p>
        <p class="text-sm">All access control is handled at the file system level</p>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle class="h-12 w-12 text-destructive" />
        <p class="text-destructive">{{ error }}</p>
        <Button variant="outline" size="lg" @click="loadUsers">
          Retry
        </Button>
      </div>

      <!-- Empty State -->
      <div v-else-if="users.length === 0" class="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <p class="text-lg">No Users Found</p>
        <p class="text-sm">No database users were found or you don't have permission to view them.</p>
      </div>

      <!-- Users List -->
      <div v-else class="flex flex-col gap-1 max-w-4xl mx-auto">
        <div
          v-for="user in users"
          :key="getUserKey(user)"
          class="border rounded-lg"
        >
          <!-- User Row -->
          <div
            class="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
            @click="toggleUser(user)"
          >
            <div class="flex items-center gap-2">
              <component
                :is="expandedUser === getUserKey(user) ? ChevronDown : ChevronRight"
                class="h-4 w-4 text-muted-foreground shrink-0"
              />
              <ShieldAlert
                v-if="user.superuser"
                class="h-4 w-4 text-destructive shrink-0"
              />
              <span class="text-xs font-mono font-medium">
                {{ user.name }}
                <span v-if="user.host" class="text-muted-foreground">@{{ user.host }}</span>
              </span>
              <span v-if="user.roles && user.roles.length > 0" class="text-xs text-muted-foreground">
                — {{ Array.isArray(user.roles) ? user.roles.join(', ') : user.roles }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <Badge
                v-for="badge in getUserBadges(user)"
                :key="badge.label"
                :variant="badge.variant"
                class="text-xs"
              >
                {{ badge.label }}
              </Badge>
            </div>
          </div>

          <!-- Expanded Privileges -->
          <div
            v-if="expandedUser === getUserKey(user)"
            class="border-t px-3 py-3"
            @click.stop
          >
            <!-- Loading Privileges -->
            <div v-if="loadingPrivileges.has(getUserKey(user))" class="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              <span>Loading privileges...</span>
            </div>

            <!-- Privileges List -->
            <template v-else>
              <div class="flex items-center gap-1.5 mb-2">
                <IconKey class="h-3.5 w-3.5 text-muted-foreground" />
                <span class="font-medium text-xs">Privileges</span>
              </div>

              <!-- No Privileges -->
              <p
                v-if="!userPrivileges.get(getUserKey(user))?.length"
                class="text-xs text-muted-foreground"
              >
                No specific privileges found or unable to retrieve privileges.
              </p>

              <!-- Privileges Table -->
              <div v-else class="rounded-md border overflow-hidden">
                <table class="w-full text-xs">
                  <thead class="bg-muted/50 border-b">
                    <tr>
                      <th class="px-3 py-1.5 text-left font-medium">Privilege</th>
                      <th class="px-3 py-1.5 text-left font-medium">Object</th>
                      <th class="px-3 py-1.5 text-left font-medium">Grantable</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(priv, idx) in userPrivileges.get(getUserKey(user))?.slice(0, 20)"
                      :key="idx"
                      class="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td class="px-3 py-1.5 font-mono">{{ priv.privilege }}</td>
                      <td class="px-3 py-1.5 font-mono text-muted-foreground">
                        {{ priv.objectName || '*' }}
                      </td>
                      <td class="px-3 py-1.5">
                        <Badge v-if="priv.isGrantable" variant="secondary" class="text-xs">
                          Yes
                        </Badge>
                        <span v-else class="text-muted-foreground">No</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div
                  v-if="(userPrivileges.get(getUserKey(user))?.length || 0) > 20"
                  class="px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 border-t"
                >
                  ... and {{ (userPrivileges.get(getUserKey(user))?.length || 0) - 20 }} more privileges
                </div>
              </div>
            </template>

            <!-- User Details -->
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div v-if="user.connectionLimit !== undefined">
                <span class="text-muted-foreground">Connection Limit:</span>
                <span class="ml-1 font-medium">{{ user.connectionLimit || 'Unlimited' }}</span>
              </div>
              <div v-if="user.validUntil">
                <span class="text-muted-foreground">Valid Until:</span>
                <span class="ml-1 font-medium">{{ formatDateTime(user.validUntil) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
