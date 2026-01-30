<script lang="ts" setup>
import { Toaster as Sonner } from 'vue-sonner'
import { computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
const theme = computed(() => settingsStore.theme === 'system' ? 'system' : settingsStore.theme)
</script>

<template>
  <Sonner
    :theme="theme"
    position="bottom-center"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--success-bg': 'var(--success)',
      '--success-text': 'var(--success-foreground)',
      '--success-border': 'var(--success)',
      '--error-bg': 'var(--destructive)',
      '--error-text': 'var(--destructive-foreground)',
      '--error-border': 'var(--destructive)',
      '--warning-bg': 'var(--warning)',
      '--warning-text': 'var(--warning-foreground)',
      '--warning-border': 'var(--warning)',
      '--info-bg': 'var(--info)',
      '--info-text': 'var(--info-foreground)',
      '--info-border': 'var(--info)',
    }"
  />
</template>

<style>
/* Success toast icon color */
[data-sonner-toast][data-type="success"] [data-icon] {
  color: var(--success) !important;
}

/* Error toast icon color */
[data-sonner-toast][data-type="error"] [data-icon] {
  color: var(--destructive) !important;
}

/* Warning toast icon color */
[data-sonner-toast][data-type="warning"] [data-icon] {
  color: var(--warning) !important;
}

/* Info toast icon color */
[data-sonner-toast][data-type="info"] [data-icon] {
  color: var(--info) !important;
}
</style>
