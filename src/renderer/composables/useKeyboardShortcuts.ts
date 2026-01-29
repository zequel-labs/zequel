import { onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useConnectionsStore } from '@/stores/connections'

export interface KeyboardShortcut {
  key: string
  modifiers: ('ctrl' | 'meta' | 'alt' | 'shift')[]
  action: () => void
  description: string
  category: 'tabs' | 'query' | 'navigation' | 'general'
}

export function useKeyboardShortcuts() {
  const tabsStore = useTabsStore()
  const connectionsStore = useConnectionsStore()

  const shortcuts: KeyboardShortcut[] = [
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
      category: 'tabs'
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
      category: 'tabs'
    },
    {
      key: 'Tab',
      modifiers: ['ctrl'],
      action: () => {
        navigateToNextTab()
      },
      description: 'Next tab',
      category: 'tabs'
    },
    {
      key: 'Tab',
      modifiers: ['ctrl', 'shift'],
      action: () => {
        navigateToPreviousTab()
      },
      description: 'Previous tab',
      category: 'tabs'
    },
    {
      key: ']',
      modifiers: ['meta'],
      action: () => {
        navigateToNextTab()
      },
      description: 'Next tab',
      category: 'tabs'
    },
    {
      key: '[',
      modifiers: ['meta'],
      action: () => {
        navigateToPreviousTab()
      },
      description: 'Previous tab',
      category: 'tabs'
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
      category: 'tabs' as const
    }))
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
    // Skip if user is typing in an input/textarea (except for Tab shortcuts)
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    const isMonacoEditor = target.closest('.monaco-editor')

    // Find matching shortcut
    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const metaMatches = shortcut.modifiers.includes('meta') === (event.metaKey || event.ctrlKey)
      const shiftMatches = shortcut.modifiers.includes('shift') === event.shiftKey
      const altMatches = shortcut.modifiers.includes('alt') === event.altKey

      if (keyMatches && metaMatches && shiftMatches && altMatches) {
        // Skip input fields for most shortcuts, but allow some global ones
        if (isInput || isMonacoEditor) {
          // Only allow tab switching shortcuts in inputs
          if (!['Tab', ']', '[', ...Array.from({ length: 9 }, (_, i) => String(i + 1))].includes(shortcut.key)) {
            continue
          }
          // Skip if just typing numbers without modifier
          if (!event.metaKey && !event.ctrlKey) {
            continue
          }
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
        return isMac ? '⌘' : 'Ctrl'
      case 'ctrl':
        return isMac ? '⌃' : 'Ctrl'
      case 'alt':
        return isMac ? '⌥' : 'Alt'
      case 'shift':
        return isMac ? '⇧' : 'Shift'
      default:
        return mod
    }
  })

  const keySymbol = key === 'Tab' ? '⇥' : key.toUpperCase()

  return [...modifierSymbols, keySymbol].join(isMac ? '' : '+')
}
