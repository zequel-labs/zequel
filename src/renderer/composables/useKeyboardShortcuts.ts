import { onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'

export interface KeyboardShortcut {
  key: string
  modifiers: ('ctrl' | 'meta' | 'alt' | 'shift')[]
  action: () => void
  description: string
  category: 'tabs' | 'query' | 'navigation' | 'general' | 'editor'
  /** If true, the shortcut works even when focus is inside an input or Monaco editor */
  global?: boolean
}

export function useKeyboardShortcuts() {
  const tabsStore = useTabsStore()
  const connectionsStore = useConnectionsStore()

  const shortcuts: KeyboardShortcut[] = [
    // --- Tabs ---
    {
      key: 'n',
      modifiers: ['meta'],
      action: () => {
        const connectionId = connectionsStore.activeConnectionId
        if (connectionId) {
          tabsStore.createQueryTab(connectionId, '')
        }
      },
      description: 'New query tab',
      category: 'tabs',
      global: true
    },
    {
      key: 'w',
      modifiers: ['meta'],
      action: () => {
        const activeTabId = tabsStore.activeTabId
        if (activeTabId) {
          tabsStore.closeTab(activeTabId)
        }
      },
      description: 'Close current tab',
      category: 'tabs',
      global: true
    },
    {
      key: 'Tab',
      modifiers: ['ctrl'],
      action: () => {
        navigateToNextTab()
      },
      description: 'Next tab',
      category: 'tabs',
      global: true
    },
    {
      key: 'Tab',
      modifiers: ['ctrl', 'shift'],
      action: () => {
        navigateToPreviousTab()
      },
      description: 'Previous tab',
      category: 'tabs',
      global: true
    },
    {
      key: ']',
      modifiers: ['meta'],
      action: () => {
        navigateToNextTab()
      },
      description: 'Next tab',
      category: 'tabs',
      global: true
    },
    {
      key: '[',
      modifiers: ['meta'],
      action: () => {
        navigateToPreviousTab()
      },
      description: 'Previous tab',
      category: 'tabs',
      global: true
    },
    // Tab number shortcuts (1-9)
    ...Array.from({ length: 9 }, (_, i) => ({
      key: String(i + 1),
      modifiers: ['meta'] as ('meta' | 'ctrl' | 'alt' | 'shift')[],
      action: () => {
        const tabs = tabsStore.tabs
        if (tabs[i]) {
          tabsStore.setActiveTab(tabs[i].id)
        }
      },
      description: `Switch to tab ${i + 1}`,
      category: 'tabs' as const,
      global: true
    })),

    // --- Query ---
    {
      key: 's',
      modifiers: ['meta'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:save-query'))
      },
      description: 'Save current query',
      category: 'query',
      global: true
    },
    {
      key: 'f',
      modifiers: ['meta', 'shift'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:format-sql'))
      },
      description: 'Format SQL',
      category: 'query',
      global: true
    },

    // --- Navigation ---
    {
      key: 'l',
      modifiers: ['meta'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:focus-sidebar-search'))
      },
      description: 'Focus sidebar search',
      category: 'navigation',
      global: true
    },
    {
      key: 'p',
      modifiers: ['meta'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:toggle-command-palette'))
      },
      description: 'Open command palette',
      category: 'navigation',
      global: true
    },
    {
      key: 'p',
      modifiers: ['meta', 'shift'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:toggle-command-palette'))
      },
      description: 'Open command palette',
      category: 'navigation',
      global: true
    },

    // --- General ---
    {
      key: ',',
      modifiers: ['meta'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:open-settings'))
      },
      description: 'Open settings',
      category: 'general',
      global: true
    },
    {
      key: '?',
      modifiers: ['meta', 'shift'],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:toggle-shortcuts-dialog'))
      },
      description: 'Show keyboard shortcuts',
      category: 'general',
      global: true
    },
    {
      key: 'F1',
      modifiers: [],
      action: () => {
        window.dispatchEvent(new CustomEvent('zequel:toggle-shortcuts-dialog'))
      },
      description: 'Show keyboard shortcuts',
      category: 'general',
      global: true
    }
  ]

  function navigateToNextTab() {
    const tabs = tabsStore.tabs
    const currentIndex = tabs.findIndex(t => t.id === tabsStore.activeTabId)
    if (currentIndex < tabs.length - 1) {
      tabsStore.setActiveTab(tabs[currentIndex + 1].id)
    } else if (tabs.length > 0) {
      tabsStore.setActiveTab(tabs[0].id)
    }
  }

  function navigateToPreviousTab() {
    const tabs = tabsStore.tabs
    const currentIndex = tabs.findIndex(t => t.id === tabsStore.activeTabId)
    if (currentIndex > 0) {
      tabsStore.setActiveTab(tabs[currentIndex - 1].id)
    } else if (tabs.length > 0) {
      tabsStore.setActiveTab(tabs[tabs.length - 1].id)
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    // Skip if user is typing in an input/textarea (except for global shortcuts)
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    const isMonacoEditor = target.closest('.monaco-editor')

    // Find matching shortcut
    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
        || (shortcut.key === '?' && event.key === '/')

      const metaMatches = shortcut.modifiers.includes('meta') === (event.metaKey || event.ctrlKey)
      const shiftMatches = shortcut.modifiers.includes('shift') === event.shiftKey
      const altMatches = shortcut.modifiers.includes('alt') === event.altKey

      // For shortcuts with no modifiers (like F1), only match when ctrl is not held
      const ctrlCheck = shortcut.modifiers.length === 0
        ? (!event.metaKey && !event.ctrlKey)
        : true

      if (keyMatches && metaMatches && shiftMatches && altMatches && ctrlCheck) {
        // Skip input fields for non-global shortcuts
        if ((isInput || isMonacoEditor) && !shortcut.global) {
          continue
        }

        event.preventDefault()
        event.stopPropagation()
        shortcut.action()
        return
      }
    }
  }

  function register() {
    window.addEventListener('keydown', handleKeyDown, true)
  }

  function unregister() {
    window.removeEventListener('keydown', handleKeyDown, true)
  }

  return {
    shortcuts,
    register,
    unregister
  }
}

// Auto-register version for use in App.vue
export function useGlobalKeyboardShortcuts() {
  const { register, unregister, shortcuts } = useKeyboardShortcuts()

  onMounted(() => {
    register()
  })

  onUnmounted(() => {
    unregister()
  })

  return { shortcuts }
}

// Helper to format shortcut for display
export function formatShortcut(modifiers: string[], key: string): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  const modifierSymbols = modifiers.map(mod => {
    switch (mod) {
      case 'meta':
        return isMac ? '\u2318' : 'Ctrl'
      case 'ctrl':
        return isMac ? '\u2303' : 'Ctrl'
      case 'alt':
        return isMac ? '\u2325' : 'Alt'
      case 'shift':
        return isMac ? '\u21E7' : 'Shift'
      default:
        return mod
    }
  })

  let keySymbol: string
  switch (key) {
    case 'Tab':
      keySymbol = '\u21E5'
      break
    case 'Enter':
      keySymbol = '\u21A9'
      break
    case 'Escape':
      keySymbol = 'Esc'
      break
    case '?':
      keySymbol = '?'
      break
    case ',':
      keySymbol = ','
      break
    case ' ':
      keySymbol = 'Space'
      break
    default:
      // F-keys and special keys keep their original casing
      if (/^F\d+$/.test(key)) {
        keySymbol = key
      } else {
        keySymbol = key.toUpperCase()
      }
  }

  return [...modifierSymbols, keySymbol].join(isMac ? '' : '+')
}

/** All shortcuts for display, including editor-only shortcuts registered in Monaco */
export function getAllShortcutsForDisplay(): KeyboardShortcut[] {
  // Manually list the shortcuts managed outside useKeyboardShortcuts
  const editorShortcuts: KeyboardShortcut[] = [
    {
      key: 'Enter',
      modifiers: ['meta'],
      action: () => {},
      description: 'Execute query',
      category: 'editor'
    },
    {
      key: 'Enter',
      modifiers: ['meta', 'shift'],
      action: () => {},
      description: 'Execute selection',
      category: 'editor'
    },
    {
      key: 'f',
      modifiers: ['shift', 'alt'],
      action: () => {},
      description: 'Format SQL (in editor)',
      category: 'editor'
    }
  ]

  // Build a deduplicated list combining all shortcut sources.
  // We intentionally show tab 1-9 as a single entry and deduplicate
  // shortcuts that share the same description within a category.
  const seen = new Set<string>()
  const result: KeyboardShortcut[] = []

  // We hard-code the descriptive list because calling useKeyboardShortcuts()
  // at display time would require a pinia store context.
  const registeredShortcuts: KeyboardShortcut[] = [
    // Tabs
    { key: 'n', modifiers: ['meta'], action: () => {}, description: 'New query tab', category: 'tabs' },
    { key: 'w', modifiers: ['meta'], action: () => {}, description: 'Close current tab', category: 'tabs' },
    { key: 'Tab', modifiers: ['ctrl'], action: () => {}, description: 'Next tab', category: 'tabs' },
    { key: 'Tab', modifiers: ['ctrl', 'shift'], action: () => {}, description: 'Previous tab', category: 'tabs' },
    { key: ']', modifiers: ['meta'], action: () => {}, description: 'Next tab', category: 'tabs' },
    { key: '[', modifiers: ['meta'], action: () => {}, description: 'Previous tab', category: 'tabs' },
    { key: '1', modifiers: ['meta'], action: () => {}, description: 'Switch to tab 1-9', category: 'tabs' },
    // Query
    { key: 's', modifiers: ['meta'], action: () => {}, description: 'Save current query', category: 'query' },
    { key: 'f', modifiers: ['meta', 'shift'], action: () => {}, description: 'Format SQL', category: 'query' },
    // Navigation
    { key: 'l', modifiers: ['meta'], action: () => {}, description: 'Focus sidebar search', category: 'navigation' },
    { key: 'p', modifiers: ['meta'], action: () => {}, description: 'Open command palette', category: 'navigation' },
    { key: 'k', modifiers: ['meta'], action: () => {}, description: 'Open command palette', category: 'navigation' },
    // General
    { key: ',', modifiers: ['meta'], action: () => {}, description: 'Open settings', category: 'general' },
    { key: '?', modifiers: ['meta', 'shift'], action: () => {}, description: 'Show keyboard shortcuts', category: 'general' },
    { key: 'F1', modifiers: [], action: () => {}, description: 'Show keyboard shortcuts', category: 'general' },
    // Editor
    ...editorShortcuts
  ]

  for (const s of registeredShortcuts) {
    const id = `${s.category}:${s.description}`
    if (!seen.has(id)) {
      seen.add(id)
      result.push(s)
    }
  }

  return result
}
