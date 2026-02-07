<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Loader2, UserPlus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { sanitizeName } from '@/lib/utils'
import { DatabaseType } from '@/types/connection'

const props = defineProps<{
  open: boolean
  connectionId: string
  connectionType?: DatabaseType
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created'): void
}>()

const loading = ref(false)

const form = ref({
  name: '',
  password: '',
  superuser: false,
  createDb: false,
  replication: false,
  bypassRls: false
})

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const isPostgres = computed(() => props.connectionType === DatabaseType.PostgreSQL)

const canSubmit = computed(() => {
  return form.value.name.trim().length > 0
})

const resetForm = () => {
  form.value = {
    name: '',
    password: '',
    superuser: false,
    createDb: false,
    replication: false,
    bypassRls: false
  }
}

const onNameUpdate = (value: string | number) => {
  form.value.name = sanitizeName(String(value))
}

const createUser = async () => {
  if (!canSubmit.value) return

  loading.value = true

  try {
    const result = await window.api.schema.createUser(props.connectionId, {
      user: {
        name: form.value.name.trim(),
        password: form.value.password || undefined,
        superuser: form.value.superuser,
        createDb: form.value.createDb,
        replication: form.value.replication,
        bypassRls: form.value.bypassRls
      }
    })

    if (result.success) {
      toast.success(`User "${form.value.name}" created successfully`)
      emit('created')
      isOpen.value = false
      resetForm()
    } else {
      toast.error(`Failed to create user: ${result.error}`)
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to create user')
  } finally {
    loading.value = false
  }
}

watch(() => props.open, (newVal) => {
  if (newVal) {
    resetForm()
  }
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <UserPlus class="h-5 w-5" />
          Create User
        </DialogTitle>
        <DialogDescription>
          Create a new database user with login access.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="username">Username *</Label>
            <Input
              id="username"
              :model-value="form.name"
              @update:model-value="onNameUpdate"
              placeholder="username"
            />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              placeholder="Password"
            />
          </div>
        </div>

        <div v-if="isPostgres" class="space-y-3">
          <Label>Permissions</Label>
          <div class="flex items-center space-x-2">
            <Checkbox
              id="createDb"
              v-model="form.createDb"
            />
            <Label for="createDb" class="font-normal">Can create databases</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox
              id="superuser"
              v-model="form.superuser"
            />
            <Label for="superuser" class="font-normal">User is a superuser</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox
              id="replication"
              v-model="form.replication"
            />
            <Label for="replication" class="font-normal">Can initiate streaming replication</Label>
          </div>
          <div class="flex items-center space-x-2">
            <Checkbox
              id="bypassRls"
              v-model="form.bypassRls"
            />
            <Label for="bypassRls" class="font-normal">User bypasses every row level security policy</Label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="lg" @click="isOpen = false">
          Cancel
        </Button>
        <Button size="lg" @click="createUser" :disabled="loading || !canSubmit">
          <Loader2 v-if="loading" class="h-4 w-4 mr-2 animate-spin" />
          Create User
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
