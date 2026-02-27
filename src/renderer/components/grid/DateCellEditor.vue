<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { Calendar, CalendarGrid, CalendarHeader } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { getDateColumnKind, type DateColumnKind } from '@/lib/date'
import dayjs from '@/lib/dayjs'

interface Props {
  modelValue: string
  columnType: string
  nullable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nullable: false,
})

const emit = defineEmits<{
  (e: 'save', value: string | null): void
  (e: 'cancel'): void
}>()

const kind = computed<DateColumnKind>(() => getDateColumnKind(props.columnType))

// Parse initial value
const parseInitial = () => {
  const val = props.modelValue
  if (!val || val === '-' || val === 'NULL' || val === 'null') {
    return { date: null, hours: '00', minutes: '00', seconds: '00' }
  }

  if (kind.value === 'time') {
    const match = val.match(/(\d{2}):(\d{2}):(\d{2})/)
    if (match) {
      return { date: null, hours: match[1], minutes: match[2], seconds: match[3] }
    }
    return { date: null, hours: '00', minutes: '00', seconds: '00' }
  }

  const d = dayjs(val)
  if (!d.isValid()) {
    return { date: null, hours: '00', minutes: '00', seconds: '00' }
  }

  return {
    date: new CalendarDate(d.year(), d.month() + 1, d.date()),
    hours: d.format('HH'),
    minutes: d.format('mm'),
    seconds: d.format('ss'),
  }
}

const initial = parseInitial()
const calendarValue = ref<DateValue | undefined>(initial.date ?? undefined)
const hours = ref(initial.hours)
const minutes = ref(initial.minutes)
const seconds = ref(initial.seconds)

const editorRef = ref<HTMLDivElement | null>(null)

const showCalendar = computed(() => kind.value !== 'time')
const showTime = computed(() => kind.value !== 'date')

const formattedValue = computed(() => {
  if (kind.value === 'time') {
    return `${hours.value}:${minutes.value}:${seconds.value}`
  }

  if (!calendarValue.value) return null

  const datePart = `${calendarValue.value.year}-${String(calendarValue.value.month).padStart(2, '0')}-${String(calendarValue.value.day).padStart(2, '0')}`

  if (kind.value === 'date') {
    return datePart
  }

  return `${datePart} ${hours.value}:${minutes.value}:${seconds.value}`
})

const clampTimeValue = (val: string, max: number): string => {
  const n = parseInt(val, 10)
  if (isNaN(n) || n < 0) return '00'
  if (n > max) return String(max).padStart(2, '0')
  return String(n).padStart(2, '0')
}

watch(hours, (v) => { hours.value = clampTimeValue(v, 23) })
watch(minutes, (v) => { minutes.value = clampTimeValue(v, 59) })
watch(seconds, (v) => { seconds.value = clampTimeValue(v, 59) })

const setNow = () => {
  const now = dayjs()
  if (kind.value !== 'time') {
    calendarValue.value = new CalendarDate(now.year(), now.month() + 1, now.date())
  }
  if (kind.value !== 'date') {
    hours.value = now.format('HH')
    minutes.value = now.format('mm')
    seconds.value = now.format('ss')
  }
}

const timeFields = [
  { model: hours, label: 'hours' },
  { model: minutes, label: 'minutes' },
  { model: seconds, label: 'seconds' },
]

const clearValue = () => {
  emit('save', null)
}

const apply = () => {
  emit('save', formattedValue.value)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('cancel')
  }
}

const handleClickOutside = (e: MouseEvent) => {
  if (editorRef.value && !editorRef.value.contains(e.target as Node)) {
    apply()
  }
}

onMounted(() => {
  nextTick(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
  })
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    ref="editorRef"
    data-testid="date-cell-editor"
    class="absolute left-0 top-full z-50 mt-0.5 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
    @mousedown.stop
  >
    <Calendar
      v-if="showCalendar"
      v-slot="{ grid, weekDays }"
      :model-value="(calendarValue as DateValue)"
      @update:model-value="calendarValue = $event as DateValue"
      class="p-0"
      weekday-format="short"
    >
      <CalendarHeader />
      <CalendarGrid
        v-for="month in grid"
        :key="month.value.toString()"
        :grid="month"
        :week-days="weekDays"
      />
    </Calendar>

    <div v-if="showTime" :class="['flex items-center gap-1', showCalendar ? 'mt-2 pt-2 border-t border-border' : '']">
      <span class="text-xs text-muted-foreground mr-1">Time:</span>
      <template v-for="(field, idx) in timeFields" :key="field.label">
        <span v-if="idx > 0" class="text-xs text-muted-foreground">:</span>
        <input
          v-model="field.model.value"
          type="text"
          maxlength="2"
          :data-testid="`date-editor-${field.label}`"
          class="w-8 rounded border border-input bg-transparent px-1 py-0.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          @focus="($event.target as HTMLInputElement).select()"
        />
      </template>
    </div>

    <div class="flex items-center gap-1 mt-2 pt-2 border-t border-border">
      <Button variant="outline" size="sm" class="h-6 text-xs px-2" data-testid="date-editor-now" @click="setNow">
        Now
      </Button>
      <Button
        v-if="props.nullable"
        variant="outline"
        size="sm"
        class="h-6 text-xs px-2"
        @click="clearValue"
      >
        Clear
      </Button>
      <div class="flex-1" />
      <Button variant="outline" size="sm" class="h-6 text-xs px-2" data-testid="date-editor-cancel" @click="emit('cancel')">
        Cancel
      </Button>
      <Button size="sm" class="h-6 text-xs px-2" data-testid="date-editor-apply" @click="apply">
        Apply
      </Button>
    </div>
  </div>
</template>
