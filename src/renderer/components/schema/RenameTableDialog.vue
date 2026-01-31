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
import { IconCode } from '@tabler/icons-vue'

interface Props {
  open: boolean
  currentName: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'rename', newName: string): void
  (e: 'close'): void
}>()

const newName = ref('')
const showSqlPreview = ref(false)

const sqlPreview = `ALTER TABLE "${props.currentName}" RENAME TO "${newName.value}"`

const resetForm = () => {
  newName.value = props.currentName
  showSqlPreview.value = false
}

const handleRename = () => {
  if (newName.value.trim() && newName.value !== props.currentName) {
    emit('rename', newName.value.trim())
  }
}

const handleClose = () => {
  emit('update:open', false)
  emit('close')
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
        <DialogTitle>Rename Table</DialogTitle>
        <DialogDescription>
          Rename table '{{ currentName }}'
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleRename" class="space-y-4">
        <div class="space-y-2">
          <label class="text-sm font-medium">New Table Name</label>
          <Input
            v-model="newName"
            placeholder="new_table_name"
            required
            autofocus
          />
        </div>

        <!-- SQL Preview -->
        <div class="space-y-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            @click="showSqlPreview = !showSqlPreview"
          >
            <IconCode class="h-4 w-4" />
            {{ showSqlPreview ? 'Hide' : 'Show' }} SQL Preview
          </button>
          <pre
            v-if="showSqlPreview"
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto"
          >ALTER TABLE "{{ currentName }}" RENAME TO "{{ newName }}"</pre>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" @click="handleClose">Cancel</Button>
        <Button
          @click="handleRename"
          :disabled="!newName.trim() || newName === currentName"
        >
          Rename
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
