<script setup lang="ts">
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

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  dangerLevel?: 'warning' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Delete',
  dangerLevel: 'danger'
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleConfirm = () => {
  emit('confirm')
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
