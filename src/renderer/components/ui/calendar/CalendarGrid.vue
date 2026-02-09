<script setup lang="ts">
import { type HTMLAttributes } from 'vue'
import type { DateValue } from '@internationalized/date'
import {
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHead,
  CalendarGridRow,
  CalendarHeadCell,
} from 'reka-ui'
import { cn } from '@/lib/utils'
import CalendarCell from './CalendarCell.vue'

interface Props {
  grid: { rows: DateValue[][]; value: DateValue }
  weekDays: string[]
  class?: HTMLAttributes['class']
}

const props = defineProps<Props>()
</script>

<template>
  <CalendarGrid :class="cn('w-full border-collapse space-y-1', props.class)">
    <CalendarGridHead>
      <CalendarGridRow class="flex">
        <CalendarHeadCell
          v-for="day in props.weekDays"
          :key="day"
          class="w-7 text-[0.65rem] font-normal text-muted-foreground"
        >
          {{ day }}
        </CalendarHeadCell>
      </CalendarGridRow>
    </CalendarGridHead>
    <CalendarGridBody>
      <CalendarGridRow
        v-for="(weekDates, index) in props.grid.rows"
        :key="`week-${index}`"
        class="flex mt-1"
      >
        <CalendarCell
          v-for="weekDate in weekDates"
          :key="weekDate.toString()"
          :date="weekDate"
          :month="props.grid.value"
        />
      </CalendarGridRow>
    </CalendarGridBody>
  </CalendarGrid>
</template>
