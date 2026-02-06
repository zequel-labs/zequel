<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogScrollContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  IconDatabase,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconInfoCircle,
  IconSearch,
  IconCheck
} from '@tabler/icons-vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
const searchQuery = ref('')
const showCreateForm = ref(false)
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

const filteredDatabases = computed(() => {
  if (!searchQuery.value) return databases.value
  const query = searchQuery.value.toLowerCase()
  return databases.value.filter(db => db.name.toLowerCase().includes(query))
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
    searchQuery.value = ''
    showCreateForm.value = false
    newDbName.value = ''
    confirmDrop.value = null
    dropConfirmed.value = false
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogScrollContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Databases</DialogTitle>
        <DialogDescription
          v-if="connectionType === DatabaseType.PostgreSQL || connectionType === DatabaseType.ClickHouse">
          Switching will reconnect the session.
        </DialogDescription>
        <DialogDescription v-else class="sr-only">
          Select a database.
        </DialogDescription>
      </DialogHeader>

      <!-- Search + Create toggle -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <IconSearch class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search databases..." class="pl-9" />
        </div>
        <TooltipProvider v-if="supportsCreateDrop" :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="default" class="flex-shrink-0" @click="showCreateForm = !showCreateForm">
                <IconPlus class="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create database</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <!-- Create database form -->
      <div v-if="showCreateForm && supportsCreateDrop" class="rounded-lg border bg-muted/30 p-4 space-y-3">
        <div class="space-y-2">
          <label class="text-sm font-medium">New Database</label>
          <Input v-model="newDbName" placeholder="Enter database name" @keydown.enter="handleCreate"
            @keydown.escape="showCreateForm = false; newDbName = ''" />
          <p v-if="newDbName && !isValidName" class="text-xs text-destructive">
            Must start with a letter or underscore, alphanumeric only.
          </p>
          <p v-if="newDbName && isValidName && nameAlreadyExists" class="text-xs text-destructive">
            A database with this name already exists.
          </p>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" @click="showCreateForm = false; newDbName = ''">
            Cancel
          </Button>
          <Button class="flex-1" :disabled="!newDbName || !isValidName || nameAlreadyExists || creating"
            @click="handleCreate">
            <IconLoader2 v-if="creating" class="h-4 w-4 mr-2 animate-spin" />
            Create Database
          </Button>
        </div>
      </div>

      <!-- Database list -->
      <div v-if="loading" class="flex items-center justify-center h-48">
        <IconLoader2 class="h-8 w-8 animate-spin text-muted-foreground" />
      </div>

      <div v-else>
        <div v-if="filteredDatabases.length === 0" class="text-center text-muted-foreground py-8">
          {{ searchQuery ? 'No databases match your search' : 'No databases found' }}
        </div>
        <div v-else class="space-y-0.5">
          <div v-for="db in filteredDatabases" :key="db.name"
            class="group flex items-center justify-between py-1.5 px-2 rounded-md transition-colors cursor-pointer"
            :class="db.name === currentDatabase
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-accent/50'" @click="handleSwitch(db.name)">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <IconCheck v-if="db.name === currentDatabase" class="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
              <IconDatabase v-else class="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span class="text-sm truncate">{{ db.name }}</span>
            </div>

            <!-- Drop action -->
            <div class="flex items-center gap-1 flex-shrink-0" v-if="supportsCreateDrop && db.name !== currentDatabase">
              <div v-if="confirmDrop === db.name" class="flex items-center gap-2" @click.stop>
                <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" v-model="dropConfirmed" class="rounded border-input" />
                  Confirm
                </label>
                <Button variant="destructive" class="h-7 px-2.5 text-xs"
                  :disabled="!dropConfirmed || dropping === db.name" @click.stop="handleDrop(db.name)">
                  <IconLoader2 v-if="dropping === db.name" class="h-3 w-3 animate-spin" />
                  <template v-else>Drop</template>
                </Button>
                <Button variant="ghost" class="h-7 px-2.5 text-xs" @click.stop="cancelDrop">
                  Cancel
                </Button>
              </div>
              <Button v-else variant="ghost" size="icon"
                class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="startDrop(db.name)">
                <IconTrash class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

    </DialogScrollContent>
  </Dialog>
</template>