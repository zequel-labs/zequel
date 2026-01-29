<script setup lang="ts">
import { ref, computed } from 'vue'
import { cn } from '@/lib/utils'

interface MenuItem {
  label: string
  value?: string
  icon?: any
  disabled?: boolean
  separator?: boolean
  onClick?: () => void
}

interface Props {
  items: MenuItem[]
  align?: 'start' | 'center' | 'end'
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'start'
})

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function handleItemClick(item: MenuItem) {
  if (item.disabled) return
  if (item.onClick) {
    item.onClick()
  }
  if (item.value) {
    emit('select', item.value)
  }
  close()
}

const menuClasses = computed(() => cn(
  'absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
  props.align === 'start' && 'left-0',
  props.align === 'center' && 'left-1/2 -translate-x-1/2',
  props.align === 'end' && 'right-0',
  props.class
))
</script>

<template>
  <div class="relative inline-block" v-click-outside="close">
    <div ref="triggerRef" @click="toggle">
      <slot name="trigger" />
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div v-if="isOpen" :class="menuClasses" class="mt-1">
        <template v-for="(item, index) in items" :key="index">
          <div
            v-if="item.separator"
            class="-mx-1 my-1 h-px bg-muted"
          />
          <div
            v-else
            :class="[
              'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
              'focus:bg-accent focus:text-accent-foreground',
              item.disabled ? 'pointer-events-none opacity-50' : 'hover:bg-accent hover:text-accent-foreground'
            ]"
            @click="handleItemClick(item)"
          >
            <component v-if="item.icon" :is="item.icon" class="mr-2 h-4 w-4" />
            {{ item.label }}
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
