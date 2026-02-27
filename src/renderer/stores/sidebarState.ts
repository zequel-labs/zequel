import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SidebarTreeState {
  expandedTables: string[]
  expandedSchemas: string[]
  collapsedCategories: string[]
  activeSidebarTab: 'items' | 'queries' | 'history'
}

export const useSidebarStateStore = defineStore('sidebarState', () => {
  const expandedTablesMap = ref<Map<string, Set<string>>>(new Map())
  const expandedSchemasMap = ref<Map<string, Set<string>>>(new Map())
  const collapsedCategoriesMap = ref<Map<string, Set<string>>>(new Map())
  const activeSidebarTabMap = ref<Map<string, 'items' | 'queries' | 'history'>>(new Map())

  const setExpandedTables = (sessionId: string, tables: Set<string>): void => {
    expandedTablesMap.value.set(sessionId, new Set(tables))
  }

  const setExpandedSchemas = (sessionId: string, schemas: Set<string>): void => {
    expandedSchemasMap.value.set(sessionId, new Set(schemas))
  }

  const setCollapsedCategories = (sessionId: string, categories: Set<string>): void => {
    collapsedCategoriesMap.value.set(sessionId, new Set(categories))
  }

  const setActiveSidebarTab = (sessionId: string, tab: 'items' | 'queries' | 'history'): void => {
    activeSidebarTabMap.value.set(sessionId, tab)
  }

  const getExpandedTables = (sessionId: string | null): Set<string> => {
    if (!sessionId) return new Set()
    return expandedTablesMap.value.get(sessionId) ?? new Set()
  }

  const getExpandedSchemas = (sessionId: string | null): Set<string> => {
    if (!sessionId) return new Set()
    return expandedSchemasMap.value.get(sessionId) ?? new Set()
  }

  const getCollapsedCategories = (sessionId: string | null): Set<string> => {
    if (!sessionId) return new Set()
    return collapsedCategoriesMap.value.get(sessionId) ?? new Set()
  }

  const getActiveSidebarTab = (sessionId: string | null): 'items' | 'queries' | 'history' | null => {
    if (!sessionId) return null
    return activeSidebarTabMap.value.get(sessionId) ?? null
  }

  const getStateForSession = (sessionId: string): SidebarTreeState => {
    return {
      expandedTables: [...(expandedTablesMap.value.get(sessionId) ?? [])],
      expandedSchemas: [...(expandedSchemasMap.value.get(sessionId) ?? [])],
      collapsedCategories: [...(collapsedCategoriesMap.value.get(sessionId) ?? [])],
      activeSidebarTab: activeSidebarTabMap.value.get(sessionId) ?? 'items',
    }
  }

  const restoreState = (sessionId: string, state: SidebarTreeState): void => {
    if (state.expandedTables.length > 0) {
      expandedTablesMap.value.set(sessionId, new Set(state.expandedTables))
    }
    if (state.expandedSchemas.length > 0) {
      expandedSchemasMap.value.set(sessionId, new Set(state.expandedSchemas))
    }
    if (state.collapsedCategories.length > 0) {
      collapsedCategoriesMap.value.set(sessionId, new Set(state.collapsedCategories))
    }
    if (state.activeSidebarTab) {
      activeSidebarTabMap.value.set(sessionId, state.activeSidebarTab)
    }
  }

  const clearSession = (sessionId: string): void => {
    expandedTablesMap.value.delete(sessionId)
    expandedSchemasMap.value.delete(sessionId)
    collapsedCategoriesMap.value.delete(sessionId)
    activeSidebarTabMap.value.delete(sessionId)
  }

  return {
    setExpandedTables,
    setExpandedSchemas,
    setCollapsedCategories,
    setActiveSidebarTab,
    getExpandedTables,
    getExpandedSchemas,
    getCollapsedCategories,
    getActiveSidebarTab,
    getStateForSession,
    restoreState,
    clearSession,
  }
})
