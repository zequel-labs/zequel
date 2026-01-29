<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { cn } from '@/lib/utils'

interface MenuItem {
  label: string
  value?: string
  icon?: any
  disabled?: boolean
  separator?: boolean
  shortcut?: string
  onClick?: () => void
}

interface Props {
  items: MenuItem[]
  class?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', value: string): void
}>()

const isOpen = ref(false)
const position = ref({ x: 0, y: 0 })
const triggerRef = ref<HTMLElement | null>(null)

function open(event: MouseEvent) {
  event.preventDefault()
  position.value = { x: event.clientX, y: event.clientY }
  isOpen.value = true
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

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.context-menu-content')) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const menuStyle = computed(() => ({
  position: 'fixed' as const,
  left: `${position.value.x}px`,
  top: `${position.value.y}px`
}))
</script>

<template>
  <div ref="triggerRef" @contextmenu="open">
    <slot />

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          :style="menuStyle"
          :class="cn(
            'context-menu-content z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
            props.class
          )"
        >
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
              <span class="flex-1">{{ item.label }}</span>
              <span v-if="item.shortcut" class="ml-auto text-xs tracking-widest opacity-60">
                {{ item.shortcut }}
              </span>
            </div>
          </template>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
