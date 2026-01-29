<script setup lang="ts">
import { computed, watch } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  title?: string
  description?: string
  class?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'close'): void
}>()

function close() {
  emit('update:open', false)
  emit('close')
}

function handleBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    close()
  }
}

// Handle escape key
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }
})

const contentClasses = computed(() => cn(
  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
  props.class
))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/80"
        @click="handleBackdropClick"
      />

      <!-- Content -->
      <div :class="contentClasses">
        <!-- Header -->
        <div class="flex flex-col space-y-1.5 text-center sm:text-left">
          <h2 v-if="title" class="text-lg font-semibold leading-none tracking-tight">
            {{ title }}
          </h2>
          <p v-if="description" class="text-sm text-muted-foreground">
            {{ description }}
          </p>
        </div>

        <!-- Body -->
        <slot />

        <!-- Footer -->
        <div v-if="$slots.footer" class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <slot name="footer" />
        </div>

        <!-- Close button -->
        <button
          class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          @click="close"
        >
          <IconX class="h-4 w-4" />
          <span class="sr-only">Close</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>
