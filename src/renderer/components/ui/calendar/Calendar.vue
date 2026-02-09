<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import { CalendarRoot, type CalendarRootEmits, type CalendarRootProps, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<CalendarRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<CalendarRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <CalendarRoot
    v-slot="{ grid, weekDays }"
    v-bind="forwarded"
    :class="cn('p-3', props.class)"
  >
    <slot :grid="grid" :week-days="weekDays" />
  </CalendarRoot>
</template>
