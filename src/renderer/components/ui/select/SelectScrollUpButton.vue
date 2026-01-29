<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { SelectScrollUpButton, type SelectScrollUpButtonProps } from 'radix-vue'
import { ChevronUp } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<SelectScrollUpButtonProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <SelectScrollUpButton v-bind="props" :class="cn('flex cursor-default items-center justify-center py-1', props.class)">
    <slot>
      <ChevronUp class="h-4 w-4" />
    </slot>
  </SelectScrollUpButton>
</template>
