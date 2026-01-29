<script setup lang="ts">
import { computed, ref } from 'vue'
import { cn } from '@/lib/utils'
import { IconChevronDown } from '@tabler/icons-vue'

interface Option {
  value: string
  label: string
  disabled?: boolean
}

interface Props {
  modelValue?: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)

const selectedOption = computed(() => {
  return props.options.find(o => o.value === props.modelValue)
})

const triggerClasses = computed(() => cn(
  'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm',
  'ring-offset-background placeholder:text-muted-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.class
))

function toggleOpen() {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
  }
}

function selectOption(option: Option) {
  if (!option.disabled) {
    emit('update:modelValue', option.value)
    isOpen.value = false
  }
}

function handleClickOutside() {
  isOpen.value = false
}
</script>

<template>
  <div class="relative" v-click-outside="handleClickOutside">
    <button
      type="button"
      :class="triggerClasses"
      :disabled="disabled"
      @click="toggleOpen"
    >
      <span :class="{ 'text-muted-foreground': !selectedOption }">
        {{ selectedOption?.label || placeholder }}
      </span>
      <IconChevronDown class="h-4 w-4 opacity-50" />
    </button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      <div
        v-for="option in options"
        :key="option.value"
        :class="[
          'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
          option.value === modelValue ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground',
          option.disabled ? 'pointer-events-none opacity-50' : ''
        ]"
        @click="selectOption(option)"
      >
        {{ option.label }}
      </div>
    </div>
  </div>
</template>
