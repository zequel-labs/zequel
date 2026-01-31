import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  minimap: boolean
  lineNumbers: boolean
}

export interface GridSettings {
  pageSize: number
  alternateRowColors: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<Theme>('dark')
  const sidebarWidth = ref(280)
  const editorSettings = ref<EditorSettings>({
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: false,
    lineNumbers: true
  })
  const gridSettings = ref<GridSettings>({
    pageSize: 100,
    alternateRowColors: true
  })

  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const stored = localStorage.getItem('zequel-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.theme) theme.value = parsed.theme
        if (parsed.sidebarWidth) sidebarWidth.value = parsed.sidebarWidth
        if (parsed.editorSettings) Object.assign(editorSettings.value, parsed.editorSettings)
        if (parsed.gridSettings) Object.assign(gridSettings.value, parsed.gridSettings)
      }
    } catch {
      // Ignore errors
    }
    applyTheme()
  }

  // Save settings to localStorage
  const saveSettings = () => {
    try {
      localStorage.setItem(
        'zequel-settings',
        JSON.stringify({
          theme: theme.value,
          sidebarWidth: sidebarWidth.value,
          editorSettings: editorSettings.value,
          gridSettings: gridSettings.value
        })
      )
    } catch {
      // Ignore errors
    }
  }

  // Apply theme to document
  const applyTheme = () => {
    const root = document.documentElement
    if (theme.value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme.value === 'dark')
    }
  }

  // Actions
  const setTheme = (newTheme: Theme, fromMainProcess = false) => {
    theme.value = newTheme
    applyTheme()
    saveSettings()
    if (!fromMainProcess && typeof window !== 'undefined' && window.api?.theme) {
      window.api.theme.set(newTheme)
    }
  }

  const setSidebarWidth = (width: number) => {
    sidebarWidth.value = Math.max(200, Math.min(500, width))
    saveSettings()
  }

  const updateEditorSettings = (updates: Partial<EditorSettings>) => {
    Object.assign(editorSettings.value, updates)
    saveSettings()
  }

  const updateGridSettings = (updates: Partial<GridSettings>) => {
    Object.assign(gridSettings.value, updates)
    saveSettings()
  }

  // Watch for system theme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (theme.value === 'system') {
        applyTheme()
      }
    })

    // Listen for theme changes from the native menu
    if (window.api?.theme) {
      window.api.theme.onChange((newTheme: Theme) => {
        setTheme(newTheme, true)
      })
    }
  }

  // Initialize
  loadSettings()

  // Sync initial theme to main process
  if (typeof window !== 'undefined' && window.api?.theme) {
    window.api.theme.set(theme.value)
  }

  return {
    // State
    theme,
    sidebarWidth,
    editorSettings,
    gridSettings,
    // Actions
    setTheme,
    setSidebarWidth,
    updateEditorSettings,
    updateGridSettings,
    loadSettings
  }
})
