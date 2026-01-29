<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { ScrollAreaRoot, type ScrollAreaRootProps, ScrollAreaViewport } from 'radix-vue'
import { cn } from '@/lib/utils'
import ScrollBar from './ScrollBar.vue'

const props = defineProps<ScrollAreaRootProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <ScrollAreaRoot v-bind="props" :class="cn('relative overflow-hidden', props.class)">
    <ScrollAreaViewport class="h-full w-full rounded-[inherit]">
      <slot />
    </ScrollAreaViewport>
    <ScrollBar />
    <ScrollBar orientation="horizontal" />
  </ScrollAreaRoot>
</template>
