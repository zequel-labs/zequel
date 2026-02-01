<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SavedQuery } from '@/types/electron'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  open: boolean
  existing?: SavedQuery | null
}

const props = withDefaults(defineProps<Props>(), {
  existing: null
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save', data: { name: string; sql: string; description: string; id?: number }): void
}>()

const isEditing = computed(() => props.existing && props.existing.id > 0)

const name = ref('')
const sql = ref('')
const description = ref('')

const resetForm = () => {
  if (props.existing) {
    name.value = isEditing.value ? props.existing.name : ''
    sql.value = props.existing.sql
    description.value = props.existing.description || ''
  } else {
    name.value = ''
    sql.value = ''
    description.value = ''
  }
}

const handleSave = () => {
  if (!name.value.trim() || !sql.value.trim()) return
  emit('save', {
    name: name.value.trim(),
    sql: sql.value.trim(),
    description: description.value.trim(),
    id: isEditing.value ? props.existing!.id : undefined
  })
}

const handleClose = () => {
  emit('update:open', false)
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
        <DialogTitle>{{ isEditing ? 'Edit Query' : 'Save Query' }}</DialogTitle>
        <DialogDescription>
          {{ isEditing ? 'Update your saved query.' : 'Save this query for quick access later.' }}
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSave" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Name</label>
          <Input
            v-model="name"
            placeholder="My query"
            required
            autofocus
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">SQL</label>
          <textarea
            v-model="sql"
            placeholder="SELECT * FROM ..."
            required
            rows="5"
            class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y"
          />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Description <span class="text-muted-foreground font-normal">(optional)</span></label>
          <Input
            v-model="description"
            placeholder="What does this query do?"
          />
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" type="button" @click="handleClose">Cancel</Button>
          <Button
            type="submit"
            :disabled="!name.trim() || !sql.trim()"
          >
            {{ isEditing ? 'Update' : 'Save' }}
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
