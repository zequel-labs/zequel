<script setup lang="ts">
import { Toaster as Sonner, type ToasterProps } from 'vue-sonner'
import { useSettingsStore } from '@/stores/settings'
import { computed } from 'vue'

const props = defineProps<ToasterProps>()

const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.theme === 'dark' ? 'dark' : 'light')
</script>

<template>
  <Sonner
    :theme="theme"
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
