<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  connectionId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'created', schemaName: string): void
}>()

const schemaName = ref('')
const isCreating = ref(false)
const errorMessage = ref<string | null>(null)

const resetForm = () => {
  schemaName.value = ''
  isCreating.value = false
  errorMessage.value = null
}

const handleCreate = async () => {
  const name = schemaName.value.trim()
  if (!name) return

  isCreating.value = true
  errorMessage.value = null

  try {
    await window.api.schema.createSchema(props.connectionId, name)
    emit('update:open', false)
    emit('created', name)
    resetForm()
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'Failed to create schema'
  } finally {
    isCreating.value = false
  }
}

const handleClose = () => {
  emit('update:open', false)
  resetForm()
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm()
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>New Schema</DialogTitle>
        <DialogDescription>
          Create a new PostgreSQL schema
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleCreate" class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">Schema Name</label>
          <Input
            v-model="schemaName"
            placeholder="schema_name"
            required
            autofocus
          />
        </div>

        <div v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" size="lg" @click="handleClose">Cancel</Button>
        <Button
          size="lg"
          @click="handleCreate"
          :disabled="!schemaName.trim() || isCreating"
        >
          {{ isCreating ? 'Creating...' : 'Create' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
