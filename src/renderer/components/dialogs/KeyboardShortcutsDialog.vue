<script setup lang="ts">
import { computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  getAllShortcutsForDisplay,
  formatShortcut,
  type KeyboardShortcut
} from '@/composables/useKeyboardShortcuts'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

interface ShortcutCategory {
  id: string
  name: string
  shortcuts: KeyboardShortcut[]
}

const categoryLabels: Record<string, string> = {
  tabs: 'Tabs',
  query: 'Query',
  navigation: 'Navigation',
  general: 'General',
  editor: 'Editor'
}

const categoryOrder = ['tabs', 'query', 'editor', 'navigation', 'general']

const categories = computed<ShortcutCategory[]>(() => {
  const all = getAllShortcutsForDisplay()
  const grouped = new Map<string, KeyboardShortcut[]>()

  for (const shortcut of all) {
    const cat = shortcut.category
    if (!grouped.has(cat)) {
      grouped.set(cat, [])
    }
    grouped.get(cat)!.push(shortcut)
  }

  return categoryOrder
    .filter(id => grouped.has(id))
    .map(id => ({
      id,
      name: categoryLabels[id] || id,
      shortcuts: grouped.get(id)!
    }))
})

const formatKeys = (modifiers: string[], key: string): string => {
  return formatShortcut(modifiers, key)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Keyboard Shortcuts</DialogTitle>
        <DialogDescription class="sr-only">
          A list of all available keyboard shortcuts grouped by category.
        </DialogDescription>
      </DialogHeader>
      <ScrollArea class="max-h-[60vh]">
        <div class="pr-4">
          <div v-for="category in categories" :key="category.id" class="mb-5 last:mb-0">
            <h3 class="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {{ category.name }}
            </h3>
            <div class="space-y-0.5">
              <div
                v-for="(shortcut, index) in category.shortcuts"
                :key="`${category.id}-${index}`"
                class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
              >
                <span class="text-sm">{{ shortcut.description }}</span>
                <kbd
                  class="inline-flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded font-mono border border-border/50"
                >
                  {{ formatKeys(shortcut.modifiers, shortcut.key) }}
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
