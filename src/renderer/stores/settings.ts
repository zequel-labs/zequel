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
  function loadSettings() {
    try {
      const stored = localStorage.getItem('db-studio-settings')
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
  function saveSettings() {
    try {
      localStorage.setItem(
        'db-studio-settings',
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
  function applyTheme() {
    const root = document.documentElement
    if (theme.value === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme.value === 'dark')
    }
  }

  // Actions
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    applyTheme()
    saveSettings()
  }

  function setSidebarWidth(width: number) {
    sidebarWidth.value = Math.max(200, Math.min(500, width))
    saveSettings()
  }

  function updateEditorSettings(updates: Partial<EditorSettings>) {
    Object.assign(editorSettings.value, updates)
    saveSettings()
  }

  function updateGridSettings(updates: Partial<GridSettings>) {
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
  }

  // Initialize
  loadSettings()

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
