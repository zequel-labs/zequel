<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'

interface Props {
  modelValue: string
  items: string[]
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const filter = ref('')
const justSelected = ref(false)

const filtered = computed(() => {
  if (!isOpen.value) return []
  if (filter.value === props.modelValue) return props.items
  const q = filter.value.toLowerCase().trim()
  if (!q) return props.items
  return props.items.filter(item => item.toLowerCase().includes(q))
})

const onFocus = (event: FocusEvent): void => {
  isOpen.value = true
  filter.value = props.modelValue
  nextTick(() => (event.target as HTMLInputElement).select())
}

const onBlur = (): void => {
  if (justSelected.value) {
    justSelected.value = false
    isOpen.value = false
    return
  }
  const typed = filter.value.trim()
  const match = props.items.find(item => item.toLowerCase() === typed.toLowerCase())
  emit('update:modelValue', match || '')
  isOpen.value = false
}

const select = (item: string): void => {
  justSelected.value = true
  emit('update:modelValue', item)
  isOpen.value = false
}

const commit = (event: KeyboardEvent): void => {
  ;(event.target as HTMLInputElement).blur()
}

const cancel = (event: KeyboardEvent): void => {
  isOpen.value = false
  ;(event.target as HTMLInputElement).blur()
}
</script>

<template>
  <div class="relative">
    <input
      :value="isOpen ? filter : modelValue"
      :placeholder="placeholder"
      class="w-full h-8 px-1.5 text-xs font-mono bg-transparent border-0 outline-none focus:ring-1 focus:ring-inset focus:ring-ring rounded-none"
      @focus="onFocus"
      @input="filter = ($event.target as HTMLInputElement).value"
      @blur="onBlur"
      @keydown.enter.prevent="commit"
      @keydown.escape.prevent="cancel"
    />
    <div
      v-if="isOpen && filtered.length > 0"
      class="absolute z-50 top-full left-0 w-full max-h-48 overflow-y-auto bg-popover border border-border rounded-b-md shadow-md"
    >
      <div
        v-for="item in filtered"
        :key="item"
        class="px-1.5 py-1 text-xs font-mono cursor-pointer hover:bg-accent truncate"
        @mousedown.prevent="select(item)"
      >
        {{ item }}
      </div>
    </div>
  </div>
</template>
