<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { IconAlertTriangle, IconCode } from '@tabler/icons-vue'

interface Props {
  open: boolean
  title: string
  message: string
  sql?: string
  requireConfirmation?: boolean
  confirmText?: string
  dangerLevel?: 'warning' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  requireConfirmation: true,
  confirmText: 'Delete',
  dangerLevel: 'danger'
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const confirmed = ref(false)
const showSqlPreview = ref(false)

const canConfirm = computed(() => {
  if (!props.requireConfirmation) return true
  return confirmed.value
})

const handleConfirm = () => {
  if (canConfirm.value) {
    emit('confirm')
    emit('update:open', false)
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    confirmed.value = false
    showSqlPreview.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <!-- Warning icon and message -->
        <div class="flex gap-4">
          <div
            :class="[
              'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              dangerLevel === 'danger' ? 'bg-red-500/10' : 'bg-yellow-500/10'
            ]"
          >
            <IconAlertTriangle
              :class="[
                'h-5 w-5',
                dangerLevel === 'danger' ? 'text-red-500' : 'text-yellow-500'
              ]"
            />
          </div>
          <div class="flex-1">
            <p class="text-sm">{{ message }}</p>
          </div>
        </div>

        <!-- SQL Preview -->
        <div v-if="sql" class="space-y-2">
          <button
            type="button"
            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            @click="showSqlPreview = !showSqlPreview"
          >
            <IconCode class="h-4 w-4" />
            {{ showSqlPreview ? 'Hide' : 'Show' }} SQL
          </button>
          <pre
            v-if="showSqlPreview"
            class="p-3 rounded-md bg-muted text-sm font-mono overflow-x-auto"
          >{{ sql }}</pre>
        </div>

        <!-- Confirmation checkbox -->
        <div v-if="requireConfirmation" class="pt-2">
          <label class="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              v-model="confirmed"
              class="mt-0.5 rounded border-input"
            />
            <span class="text-muted-foreground">
              I understand this action cannot be undone and may result in permanent data loss.
            </span>
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="handleCancel">Cancel</Button>
        <Button
          :variant="dangerLevel === 'danger' ? 'destructive' : 'default'"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
