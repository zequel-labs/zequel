<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { CalendarHeader, CalendarHeading, CalendarNext, CalendarPrev } from 'reka-ui'
import { cn } from '@/lib/utils'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-vue'

interface Props {
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <CalendarHeader :class="cn('flex items-center justify-between pb-1', props.class)">
    <CalendarPrev
      class="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <IconChevronLeft class="h-3.5 w-3.5" />
    </CalendarPrev>
    <CalendarHeading class="text-xs font-medium" />
    <CalendarNext
      class="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <IconChevronRight class="h-3.5 w-3.5" />
    </CalendarNext>
  </CalendarHeader>
</template>
