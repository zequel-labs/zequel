import { computed } from 'vue'
import { useSettingsStore, type Theme } from '../stores/settings'

export const useTheme = () => {
  const settingsStore = useSettingsStore()

  const theme = computed(() => settingsStore.theme)
  const isDark = computed(() => {
    if (settingsStore.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return settingsStore.theme === 'dark'
  })

  const setTheme = (newTheme: Theme) => {
    settingsStore.setTheme(newTheme)
  }

  const toggleTheme = () => {
    if (settingsStore.theme === 'dark') {
      settingsStore.setTheme('light')
    } else {
      settingsStore.setTheme('dark')
    }
  }

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme
  }
}
