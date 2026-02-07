<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { sanitizeName } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { IconLoader2 } from '@tabler/icons-vue'
import { toast } from 'vue-sonner'
import { DatabaseType } from '@/types/connection'

const props = defineProps<{
  open: boolean
  connectionId: string
  connectionType: DatabaseType
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', databaseName: string): void
}>()

const newDbName = ref('')
const creating = ref(false)
const existingDatabases = ref<string[]>([])

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const isValidName = computed(() => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newDbName.value)
})

const nameAlreadyExists = computed(() => {
  return existingDatabases.value.some(name => name.toLowerCase() === newDbName.value.toLowerCase())
})

const buildCreateSQL = (name: string): string => {
  if (props.connectionType === DatabaseType.MySQL || props.connectionType === DatabaseType.MariaDB) {
    return `CREATE DATABASE \`${name}\``
  }
  return `CREATE DATABASE "${name}"`
}

const loadExistingDatabases = async () => {
  try {
    const dbs = await window.api.schema.databases(props.connectionId)
    existingDatabases.value = dbs.map(db => db.name)
  } catch {
    existingDatabases.value = []
  }
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
      toast.success(`Database "${newDbName.value}" created`)
      const createdName = newDbName.value
      newDbName.value = ''
      isOpen.value = false
      emit('created', createdName)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create database')
  } finally {
    creating.value = false
  }
}

watch(() => props.open, (newVal) => {
  if (newVal && props.connectionId) {
    newDbName.value = ''
    loadExistingDatabases()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>Create Database</DialogTitle>
        <DialogDescription class="sr-only">
          Create a new database.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-2">
        <Input :model-value="newDbName" @update:model-value="newDbName = sanitizeName($event)"
          placeholder="Enter database name" @keydown.enter="handleCreate" @keydown.escape="isOpen = false" />
        <p v-if="newDbName && !isValidName" class="text-xs text-destructive">
          Must start with a letter or underscore, alphanumeric only.
        </p>
        <p v-if="newDbName && isValidName && nameAlreadyExists" class="text-xs text-destructive">
          A database with this name already exists.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">
          Cancel
        </Button>
        <Button :disabled="!newDbName || !isValidName || nameAlreadyExists || creating" @click="handleCreate">
          <IconLoader2 v-if="creating" class="h-4 w-4 mr-2 animate-spin" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
