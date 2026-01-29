<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Tab {
  value: string
  label: string
  disabled?: boolean
}

interface Props {
  modelValue: string
  tabs: Tab[]
  class?: string
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function selectTab(tab: Tab) {
  if (!tab.disabled) {
    emit('update:modelValue', tab.value)
  }
}
</script>

<template>
  <div>
    <div
      :class="cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        $props.class
      )"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        :class="[
          'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          tab.disabled ? 'pointer-events-none opacity-50' : '',
          tab.value === modelValue
            ? 'bg-background text-foreground shadow-sm'
            : 'hover:bg-background/50'
        ]"
        @click="selectTab(tab)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mt-2">
      <slot :name="modelValue" />
    </div>
  </div>
</template>
