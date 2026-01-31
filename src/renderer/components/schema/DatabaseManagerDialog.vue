<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  IconDatabase,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconAlertTriangle,
  IconInfoCircle
} from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { DatabaseType } from '@/types/connection'
import type { Database } from '@/types/table'

const props = defineProps<{
  open: boolean
  connectionId: string
  connectionType: DatabaseType
  currentDatabase: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'switch', database: string): void
}>()

const loading = ref(false)
const databases = ref<Database[]>([])
const newDbName = ref('')
const creating = ref(false)
const dropping = ref<string | null>(null)
const confirmDrop = ref<string | null>(null)
const dropConfirmed = ref(false)

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const supportsCreateDrop = computed(() => {
  return [DatabaseType.MySQL, DatabaseType.MariaDB, DatabaseType.PostgreSQL, DatabaseType.ClickHouse].includes(props.connectionType)
})

const isValidName = computed(() => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName.value)
})

const nameAlreadyExists = computed(() => {
  return databases.value.some(db => db.name.toLowerCase() === newDbName.value.toLowerCase())
})

const loadDatabases = async () => {
  loading.value = true
  try {
    const dbs = await window.api.schema.databases(props.connectionId)
    databases.value = dbs
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to load databases')
  } finally {
    loading.value = false
  }
}

const buildCreateSQL = (name: string): string => {
  if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) {
    return `CREATE DATABASE \`${name}\``
  }
  return `CREATE DATABASE "${name}"`
}

const buildDropSQL = (name: string): string => {
  if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) {
    return `DROP DATABASE \`${name}\``
  }
  return `DROP DATABASE "${name}"`
}

const handleCreate = async () => {
  if (!isValidName.value || nameAlreadyExists.value || creating.value) return

  creating.value = true
  try {
    const sql = buildCreateSQL(newDbName.value)
    const result = await window.api.query.execute(props.connectionId, sql)
    if (result.error) {
      toast.error(`Failed to create database: ${result.error}`)
    } else {
      toast.success(`Database "${newDbName.value}" created successfully`)
      newDbName.value = ''
      await loadDatabases()
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create database')
  } finally {
    creating.value = false
  }
}

const handleDrop = async (name: string) => {
  if (dropping.value) return

  dropping.value = name
  try {
    const sql = buildDropSQL(name)
    const result = await window.api.query.execute(props.connectionId, sql)
    if (result.error) {
      toast.error(`Failed to drop database: ${result.error}`)
    } else {
      toast.success(`Database "${name}" dropped successfully`)
      confirmDrop.value = null
      dropConfirmed.value = false
      await loadDatabases()
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to drop database')
  } finally {
    dropping.value = null
  }
}

const handleSwitch = (name: string) => {
  if (name === props.currentDatabase) return
  emit('switch', name)
  isOpen.value = false
}

const startDrop = (name: string) => {
  confirmDrop.value = name
  dropConfirmed.value = false
}

const cancelDrop = () => {
  confirmDrop.value = null
  dropConfirmed.value = false
}

watch(() => props.open, (newVal) => {
  if (newVal && props.connectionId) {
    loadDatabases()
    newDbName.value = ''
    confirmDrop.value = null
    dropConfirmed.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-lg max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <IconDatabase class="h-5 w-5" />
          Database Manager
        </DialogTitle>
        <DialogDescription>
          Manage databases on this connection.
        </DialogDescription>
      </DialogHeader>

      <!-- Reconnect notice for databases that require it -->
      <div
        v-if="connectionType === DatabaseType.PostgreSQL || connectionType === DatabaseType.ClickHouse"
        class="flex items-start gap-2 p-3 rounded-md bg-blue-500/10 text-sm"
      >
        <IconInfoCircle class="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <span class="text-blue-600 dark:text-blue-400">
          Switching databases will reconnect the session.
        </span>
      </div>

      <!-- Database list -->
      <div v-if="loading" class="flex items-center justify-center h-48">
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <ScrollArea v-else class="flex-1 min-h-0" style="max-height: 350px;">
        <div v-if="databases.length === 0" class="text-center text-muted-foreground py-8">
          No databases found
        </div>
        <div v-else class="space-y-1 pr-4">
          <div
            v-for="db in databases"
            :key="db.name"
            class="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
            :class="{ 'border-primary/50 bg-primary/5': db.name === currentDatabase }"
            @click="handleSwitch(db.name)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <IconDatabase class="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span class="font-medium text-sm truncate">{{ db.name }}</span>
              <Badge v-if="db.name === currentDatabase" variant="secondary" class="text-xs flex-shrink-0">
                current
              </Badge>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <!-- Drop button (not for current database) -->
              <template v-if="supportsCreateDrop && db.name !== currentDatabase">
                <div v-if="confirmDrop === db.name" class="flex items-center gap-2" @click.stop>
                  <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="dropConfirmed"
                      class="rounded border-input"
                    />
                    Confirm
                  </label>
                  <Button
                    variant="destructive"
                    size="sm"
                    class="h-6 px-2 text-xs"
                    :disabled="!dropConfirmed || dropping === db.name"
                    @click.stop="handleDrop(db.name)"
                  >
                    <IconLoader2 v-if="dropping === db.name" class="h-3 w-3 animate-spin" />
                    <template v-else>Drop</template>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-6 px-2 text-xs"
                    @click.stop="cancelDrop"
                  >
                    Cancel
                  </Button>
                </div>
                <Button
                  v-else
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 text-muted-foreground hover:text-destructive"
                  @click.stop="startDrop(db.name)"
                >
                  <IconTrash class="h-3.5 w-3.5" />
                </Button>
              </template>
            </div>
          </div>
        </div>
      </ScrollArea>

      <!-- Create database section -->
      <div v-if="supportsCreateDrop" class="border-t pt-4 space-y-2">
        <label class="text-sm font-medium">Create Database</label>
        <div class="flex gap-2">
          <div class="flex-1 space-y-1">
            <Input
              v-model="newDbName"
              placeholder="database_name"
              @keydown.enter="handleCreate"
            />
            <p
              v-if="newDbName && !isValidName"
              class="text-xs text-destructive"
            >
              Name must start with a letter or underscore and contain only alphanumeric characters and underscores.
            </p>
            <p
              v-if="newDbName && isValidName && nameAlreadyExists"
              class="text-xs text-destructive"
            >
              A database with this name already exists.
            </p>
          </div>
          <Button
            :disabled="!newDbName || !isValidName || nameAlreadyExists || creating"
            @click="handleCreate"
          >
            <IconLoader2 v-if="creating" class="h-4 w-4 mr-2 animate-spin" />
            <IconPlus v-else class="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
