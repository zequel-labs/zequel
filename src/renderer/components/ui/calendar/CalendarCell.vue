<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { CalendarCell, CalendarCellTrigger, type CalendarCellProps } from 'reka-ui'
import type { DateValue } from '@internationalized/date'
import { cn } from '@/lib/utils'

const props = defineProps<CalendarCellProps & { class?: HTMLAttributes['class']; month: DateValue }>()
</script>

<template>
  <CalendarCell
    :date="props.date"
    :class="cn('relative p-0 text-center text-xs', props.class)"
  >
    <CalendarCellTrigger
      :day="props.date"
      :month="props.month"
      :class="cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-normal',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:font-medium',
        'data-[today]:bg-accent/50 data-[today]:text-accent-foreground',
        'data-[disabled]:text-muted-foreground/50 data-[disabled]:pointer-events-none',
        'data-[outside-view]:text-muted-foreground/30 data-[outside-view]:pointer-events-none',
      )"
    />
  </CalendarCell>
</template>
