<script setup lang="ts">
import { computed } from 'vue'
import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-vue'
import { cn } from '@/lib/utils'

interface Props {
  type?: 'default' | 'success' | 'error' | 'warning' | 'info'
  title?: string
  description?: string
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  visible: true
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return IconCircleCheck
    case 'error':
      return IconAlertCircle
    case 'warning':
      return IconAlertTriangle
    case 'info':
      return IconInfoCircle
    default:
      return null
  }
})

const iconClass = computed(() => {
  switch (props.type) {
    case 'success':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    case 'warning':
      return 'text-yellow-500'
    case 'info':
      return 'text-blue-500'
    default:
      return ''
  }
})

const toastClasses = computed(() => cn(
  'pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all',
  'bg-background text-foreground',
  props.type === 'error' && 'border-destructive/50 bg-destructive/10',
  props.type === 'success' && 'border-green-500/50 bg-green-500/10',
  props.type === 'warning' && 'border-yellow-500/50 bg-yellow-500/10',
  props.type === 'info' && 'border-blue-500/50 bg-blue-500/10'
))
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="transform translate-x-full opacity-0"
    enter-to-class="transform translate-x-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="transform translate-x-0 opacity-100"
    leave-to-class="transform translate-x-full opacity-0"
  >
    <div v-if="visible" :class="toastClasses">
      <div class="flex items-start gap-3">
        <component
          v-if="icon"
          :is="icon"
          :class="['h-5 w-5', iconClass]"
        />
        <div class="grid gap-1">
          <div v-if="title" class="text-sm font-semibold">
            {{ title }}
          </div>
          <div v-if="description" class="text-sm opacity-90">
            {{ description }}
          </div>
          <slot />
        </div>
      </div>

      <button
        class="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        @click="emit('close')"
      >
        <IconX class="h-4 w-4" />
      </button>
    </div>
  </Transition>
</template>
