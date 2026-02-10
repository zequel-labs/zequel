<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Button } from '@/components/ui/button'
import { parseBooleanValue } from '@/lib/boolean'

interface Props {
  modelValue: string
  nullable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nullable: false,
})

const emit = defineEmits<{
  (e: 'save', value: string | null): void
  (e: 'cancel'): void
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const currentValue = ref<boolean | null>(parseBooleanValue(props.modelValue))

const toggle = () => {
  if (currentValue.value === null) {
    currentValue.value = true
  } else {
    currentValue.value = !currentValue.value
  }
}

const setNull = () => {
  emit('save', null)
}

const apply = () => {
  if (currentValue.value === null) {
    emit('save', null)
  } else {
    emit('save', String(currentValue.value))
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    emit('cancel')
  } else if (e.key === 'Enter') {
    e.preventDefault()
    e.stopPropagation()
    apply()
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
    data-testid="boolean-cell-editor"
    class="absolute left-0 top-full z-50 mt-0.5 rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
    @mousedown.stop
  >
    <div class="flex items-center gap-2">
      <button
        data-testid="boolean-editor-toggle"
        role="checkbox"
        :aria-checked="currentValue === null ? 'mixed' : currentValue"
        aria-label="Toggle boolean value"
        :class="[
          'flex h-5 w-5 items-center justify-center rounded border transition-colors',
          currentValue === true
            ? 'bg-primary border-primary text-primary-foreground'
            : currentValue === false
              ? 'bg-background border-input'
              : 'bg-muted border-dashed border-input'
        ]"
        @click="toggle"
      >
        <svg
          v-if="currentValue === true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-3 w-3"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span v-else-if="currentValue === null" class="text-[10px] text-muted-foreground">?</span>
      </button>
      <span class="text-xs">
        {{ currentValue === null ? 'NULL' : currentValue ? 'true' : 'false' }}
      </span>
    </div>

    <div class="flex items-center gap-1 mt-2 pt-2 border-t border-border">
      <Button
        v-if="props.nullable"
        variant="outline"
        size="sm"
        class="h-6 text-xs px-2"
        data-testid="boolean-editor-null"
        @click="setNull"
      >
        Set NULL
      </Button>
      <div class="flex-1" />
      <Button
        variant="outline"
        size="sm"
        class="h-6 text-xs px-2"
        data-testid="boolean-editor-cancel"
        @click="emit('cancel')"
      >
        Cancel
      </Button>
      <Button
        size="sm"
        class="h-6 text-xs px-2"
        data-testid="boolean-editor-apply"
        @click="apply"
      >
        Apply
      </Button>
    </div>
  </div>
</template>
