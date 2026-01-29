<script setup lang="ts">
import { computed } from 'vue'
import { IconCopy } from '@tabler/icons-vue'

interface Props {
  value: unknown
  type?: string
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  editable: false
})

const emit = defineEmits<{
  (e: 'edit', value: unknown): void
}>()

const displayValue = computed(() => {
  if (props.value === null) return 'NULL'
  if (props.value === undefined) return ''
  if (typeof props.value === 'object') {
    return JSON.stringify(props.value)
  }
  return String(props.value)
})

const cellClass = computed(() => {
  if (props.value === null) return 'text-muted-foreground/60 italic'
  if (typeof props.value === 'number') return 'text-blue-500 font-mono'
  if (typeof props.value === 'boolean') return 'text-purple-500'
  if (props.type?.toLowerCase().includes('date') || props.type?.toLowerCase().includes('time')) {
    return 'text-green-500'
  }
  return ''
})

function copyValue() {
  navigator.clipboard.writeText(displayValue.value)
}
</script>

<template>
  <div class="group flex items-center gap-2 min-h-[1.5rem]">
    <span
      :class="['truncate max-w-[300px]', cellClass]"
      :title="displayValue"
    >
      {{ displayValue }}
    </span>

    <button
      class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded transition-opacity"
      title="Copy to clipboard"
      @click.stop="copyValue"
    >
      <IconCopy class="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  </div>
</template>
