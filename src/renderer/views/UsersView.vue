<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTabsStore, type UsersTabData } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'
import { DatabaseType } from '@/types/connection'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDateTime } from '@/lib/date'
import {
  Loader2,
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Database,
  Key,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  AlertCircle
} from 'lucide-vue-next'
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
      <div class="flex items-center gap-3">
        <Users class="h-5 w-5 text-muted-foreground" />
        <h1 class="text-lg font-semibold">Database Users</h1>
        <Badge variant="outline">{{ users.length }} users</Badge>
      </div>
      <Button variant="outline" size="sm" @click="loadUsers" :disabled="loading">
        <RefreshCw class="h-4 w-4 mr-2" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <!-- SQLite Notice -->
      <div v-if="isSqlite" class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertCircle class="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 class="text-lg font-semibold">Not Available</h2>
          <p class="text-muted-foreground mt-1">
            SQLite does not support user management. All access control is handled at the file system level.
          </p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="loading" class="flex items-center justify-center h-full">
        <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle class="h-12 w-12 text-destructive" />
        <div class="text-center">
          <h2 class="text-lg font-semibold text-destructive">Error Loading Users</h2>
          <p class="text-muted-foreground mt-1">{{ error }}</p>
        </div>
        <Button variant="outline" @click="loadUsers">
          Retry
        </Button>
      </div>

      <!-- Empty State -->
      <div v-else-if="users.length === 0" class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Users class="h-12 w-12 text-muted-foreground" />
        <div>
          <h2 class="text-lg font-semibold">No Users Found</h2>
          <p class="text-muted-foreground mt-1">
            No database users were found or you don't have permission to view them.
          </p>
        </div>
      </div>

      <!-- Users List -->
      <ScrollArea v-else class="h-full">
        <div class="p-4 space-y-3 max-w-4xl mx-auto">
          <Card
            v-for="user in users"
            :key="getUserKey(user)"
            class="cursor-pointer hover:bg-accent/50 transition-colors"
            @click="toggleUser(user)"
          >
            <CardHeader class="pb-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <component
                    :is="expandedUser === getUserKey(user) ? ChevronDown : ChevronRight"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <component
                    :is="user.superuser ? ShieldAlert : user.createRole || user.createDb ? ShieldCheck : Shield"
                    :class="[
                      'h-5 w-5',
                      user.superuser ? 'text-destructive' : user.createRole || user.createDb ? 'text-amber-500' : 'text-muted-foreground'
                    ]"
                  />
                  <div>
                    <CardTitle class="text-base font-mono">
                      {{ user.name }}
                      <span v-if="user.host" class="text-muted-foreground text-sm">@{{ user.host }}</span>
                    </CardTitle>
                    <CardDescription v-if="user.roles && user.roles.length > 0">
                      Roles: {{ user.roles.join(', ') }}
                    </CardDescription>
                  </div>
                </div>
                <div class="flex items-center gap-2">
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
            </CardHeader>

            <!-- Expanded Privileges -->
            <CardContent
              v-if="expandedUser === getUserKey(user)"
              class="pt-0"
              @click.stop
            >
              <div class="border-t pt-4 mt-2">
                <!-- Loading Privileges -->
                <div v-if="loadingPrivileges.has(getUserKey(user))" class="flex items-center gap-2 text-muted-foreground">
                  <Loader2 class="h-4 w-4 animate-spin" />
                  <span>Loading privileges...</span>
                </div>

                <!-- Privileges List -->
                <template v-else>
                  <div class="flex items-center gap-2 mb-3">
                    <Key class="h-4 w-4 text-muted-foreground" />
                    <span class="font-medium text-sm">Privileges</span>
                  </div>

                  <!-- No Privileges -->
                  <p
                    v-if="!userPrivileges.get(getUserKey(user))?.length"
                    class="text-sm text-muted-foreground"
                  >
                    No specific privileges found or unable to retrieve privileges.
                  </p>

                  <!-- Privileges Table -->
                  <div v-else class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm">
                      <thead class="bg-muted/50">
                        <tr>
                          <th class="px-3 py-2 text-left font-medium">Privilege</th>
                          <th class="px-3 py-2 text-left font-medium">Object</th>
                          <th class="px-3 py-2 text-left font-medium">Grantable</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="(priv, idx) in userPrivileges.get(getUserKey(user))?.slice(0, 20)"
                          :key="idx"
                          class="border-t"
                        >
                          <td class="px-3 py-2 font-mono text-xs">{{ priv.privilege }}</td>
                          <td class="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {{ priv.objectName || '*' }}
                          </td>
                          <td class="px-3 py-2">
                            <Badge v-if="priv.isGrantable" variant="secondary" class="text-xs">
                              Yes
                            </Badge>
                            <span v-else class="text-muted-foreground text-xs">No</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div
                      v-if="(userPrivileges.get(getUserKey(user))?.length || 0) > 20"
                      class="px-3 py-2 text-sm text-muted-foreground bg-muted/50 border-t"
                    >
                      ... and {{ (userPrivileges.get(getUserKey(user))?.length || 0) - 20 }} more privileges
                    </div>
                  </div>
                </template>

                <!-- User Details -->
                <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div v-if="user.connectionLimit !== undefined">
                    <span class="text-muted-foreground">Connection Limit:</span>
                    <span class="ml-2 font-medium">{{ user.connectionLimit || 'Unlimited' }}</span>
                  </div>
                  <div v-if="user.validUntil">
                    <span class="text-muted-foreground">Valid Until:</span>
                    <span class="ml-2 font-medium">{{ formatDateTime(user.validUntil) }}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>
