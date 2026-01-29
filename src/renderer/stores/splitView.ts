import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useTabsStore } from './tabs'

export interface Panel {
  id: string
  activeTabId: string | null
  tabIds: string[]
}

export const useSplitViewStore = defineStore('splitView', () => {
  const tabsStore = useTabsStore()

  // State
  const panels = ref<Panel[]>([
    { id: 'main', activeTabId: null, tabIds: [] }
  ])
  const activePanelId = ref<string>('main')
  const splitDirection = ref<'horizontal' | 'vertical'>('vertical')

  // Getters
  const activePanel = computed(() => {
    return panels.value.find(p => p.id === activePanelId.value) || panels.value[0]
  })

  const isSplit = computed(() => panels.value.length > 1)

  const mainPanel = computed(() => panels.value[0])
  const secondPanel = computed(() => panels.value[1])

  // Actions
  function split(direction: 'horizontal' | 'vertical' = 'vertical') {
    if (isSplit.value) return

    splitDirection.value = direction

    // Create second panel
    const newPanel: Panel = {
      id: 'secondary',
      activeTabId: null,
      tabIds: []
    }

    panels.value.push(newPanel)
  }

  function unsplit() {
    if (!isSplit.value) return

    // Move all tabs from secondary panel to main panel
    const secondary = panels.value[1]
    if (secondary) {
      panels.value[0].tabIds.push(...secondary.tabIds)
    }

    // Remove secondary panel
    panels.value = [panels.value[0]]
    activePanelId.value = 'main'
  }

  function setActivePanel(panelId: string) {
    const panel = panels.value.find(p => p.id === panelId)
    if (panel) {
      activePanelId.value = panelId
    }
  }

  function moveTabToPanel(tabId: string, targetPanelId: string) {
    // Remove from current panel
    for (const panel of panels.value) {
      const index = panel.tabIds.indexOf(tabId)
      if (index !== -1) {
        panel.tabIds.splice(index, 1)
        if (panel.activeTabId === tabId) {
          panel.activeTabId = panel.tabIds[0] || null
        }
        break
      }
    }

    // Add to target panel
    const targetPanel = panels.value.find(p => p.id === targetPanelId)
    if (targetPanel) {
      targetPanel.tabIds.push(tabId)
      targetPanel.activeTabId = tabId
    }
  }

  function addTabToPanel(tabId: string, panelId?: string) {
    const targetPanelId = panelId || activePanelId.value
    const panel = panels.value.find(p => p.id === targetPanelId)
    if (panel && !panel.tabIds.includes(tabId)) {
      panel.tabIds.push(tabId)
      panel.activeTabId = tabId
    }
  }

  function removeTabFromPanels(tabId: string) {
    for (const panel of panels.value) {
      const index = panel.tabIds.indexOf(tabId)
      if (index !== -1) {
        panel.tabIds.splice(index, 1)
        if (panel.activeTabId === tabId) {
          panel.activeTabId = panel.tabIds[0] || null
        }
        break
      }
    }
  }

  function setActivePanelTab(panelId: string, tabId: string) {
    const panel = panels.value.find(p => p.id === panelId)
    if (panel && panel.tabIds.includes(tabId)) {
      panel.activeTabId = tabId
      activePanelId.value = panelId
      // Also sync with main tabs store
      tabsStore.setActiveTab(tabId)
    }
  }

  function getPanelForTab(tabId: string): Panel | undefined {
    return panels.value.find(p => p.tabIds.includes(tabId))
  }

  function toggleSplitDirection() {
    splitDirection.value = splitDirection.value === 'vertical' ? 'horizontal' : 'vertical'
  }

  // Initialize: sync with tabs store
  function syncWithTabs() {
    const mainPanel = panels.value[0]
    const allTabIds = tabsStore.tabs.map(t => t.id)

    // Add any new tabs to main panel if not in any panel
    for (const tabId of allTabIds) {
      const inPanel = panels.value.some(p => p.tabIds.includes(tabId))
      if (!inPanel) {
        mainPanel.tabIds.push(tabId)
      }
    }

    // Remove tabs that no longer exist
    for (const panel of panels.value) {
      panel.tabIds = panel.tabIds.filter(id => allTabIds.includes(id))
      if (panel.activeTabId && !allTabIds.includes(panel.activeTabId)) {
        panel.activeTabId = panel.tabIds[0] || null
      }
    }

    // Sync active tab
    if (tabsStore.activeTabId) {
      const panel = getPanelForTab(tabsStore.activeTabId)
      if (panel) {
        panel.activeTabId = tabsStore.activeTabId
      }
    }
  }

  return {
    // State
    panels,
    activePanelId,
    splitDirection,
    // Getters
    activePanel,
    isSplit,
    mainPanel,
    secondPanel,
    // Actions
    split,
    unsplit,
    setActivePanel,
    moveTabToPanel,
    addTabToPanel,
    removeTabFromPanels,
    setActivePanelTab,
    getPanelForTab,
    toggleSplitDirection,
    syncWithTabs
  }
})
