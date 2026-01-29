<script setup lang="ts">
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner'
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<ToasterProps>()

const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.theme === 'system' ? 'system' : settingsStore.theme)
</script>

<template>
  <Sonner
    :theme="theme as ToasterProps['theme']"
    class="toaster group"
    :toast-options="{
      classes: {
        toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
      },
    }"
    v-bind="props"
  />
</template>
