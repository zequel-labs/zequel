<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  dangerLevel?: 'warning' | 'danger'
  showForeignKeyOptions?: boolean
  supportsCascade?: boolean
  supportsIgnoreForeignKeys?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Delete',
  dangerLevel: 'danger',
  showForeignKeyOptions: false,
  supportsCascade: false,
  supportsIgnoreForeignKeys: false
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', options?: { ignoreForeignKeys: boolean; cascade: boolean }): void
  (e: 'cancel'): void
}>()

const cascade = ref(false)
const ignoreForeignKeys = ref(false)

const handleCascadeChange = (checked: boolean | 'indeterminate') => {
  const val = checked === true
  cascade.value = val
  if (val) ignoreForeignKeys.value = false
}

const handleIgnoreFKChange = (checked: boolean | 'indeterminate') => {
  const val = checked === true
  ignoreForeignKeys.value = val
  if (val) cascade.value = false
}

// Reset state when dialog closes
watch(() => props.open, (open) => {
  if (!open) {
    cascade.value = false
    ignoreForeignKeys.value = false
  }
})

const handleConfirm = () => {
  if (props.showForeignKeyOptions) {
    emit('confirm', { ignoreForeignKeys: ignoreForeignKeys.value, cascade: cascade.value })
  } else {
    emit('confirm')
  }
  emit('update:open', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

</script>

<template>
  <AlertDialog :open="open" @update:open="$emit('update:open', $event)">
    <AlertDialogContent class="max-w-md">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ message }}</AlertDialogDescription>
      </AlertDialogHeader>

      <div v-if="showForeignKeyOptions" class="space-y-3 py-2">
        <div v-if="supportsCascade" class="flex items-center gap-2">
          <Checkbox
            id="cascade"
            :model-value="cascade"
            @update:model-value="handleCascadeChange"
          />
          <Label for="cascade" class="text-sm font-normal cursor-pointer">Cascade</Label>
        </div>
        <div v-if="supportsIgnoreForeignKeys" class="flex items-center gap-2">
          <Checkbox
            id="ignore-fk"
            :model-value="ignoreForeignKeys"
            @update:model-value="handleIgnoreFKChange"
          />
          <Label for="ignore-fk" class="text-sm font-normal cursor-pointer">Ignore foreign key checks</Label>
        </div>
      </div>

      <AlertDialogFooter>
        <AlertDialogCancel data-testid="confirm-dialog-cancel" @click="handleCancel">Cancel</AlertDialogCancel>
        <AlertDialogAction
          data-testid="confirm-dialog-confirm"
          :class="dangerLevel === 'danger' ? buttonVariants({ variant: 'destructive' }) : buttonVariants()"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
