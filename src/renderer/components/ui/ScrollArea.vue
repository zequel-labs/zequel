<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
  orientation?: 'vertical' | 'horizontal' | 'both'
}

const props = withDefaults(defineProps<Props>(), {
  orientation: 'vertical'
})
</script>

<template>
  <div
    :class="cn(
      'relative overflow-hidden',
      props.class
    )"
  >
    <div
      :class="[
        'h-full w-full rounded-[inherit]',
        orientation === 'vertical' && 'overflow-y-auto overflow-x-hidden',
        orientation === 'horizontal' && 'overflow-x-auto overflow-y-hidden',
        orientation === 'both' && 'overflow-auto'
      ]"
    >
      <slot />
    </div>
  </div>
</template>
