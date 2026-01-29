<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}

const props = withDefaults(defineProps<Props>(), {
  side: 'top',
  delay: 300
})

const isVisible = ref(false)
let timeout: ReturnType<typeof setTimeout> | null = null

function showTooltip() {
  timeout = setTimeout(() => {
    isVisible.value = true
  }, props.delay)
}

function hideTooltip() {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  isVisible.value = false
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2'
}
</script>

<template>
  <div
    class="relative inline-block"
    @mouseenter="showTooltip"
    @mouseleave="hideTooltip"
    @focus="showTooltip"
    @blur="hideTooltip"
  >
    <slot />

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isVisible"
        :class="[
          'absolute z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md',
          positionClasses[side]
        ]"
      >
        {{ content }}
      </div>
    </Transition>
  </div>
</template>
