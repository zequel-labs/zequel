import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type RecentItemType = 'table' | 'view' | 'query'

export interface RecentItem {
  id: number
  type: RecentItemType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sql?: string
  accessedAt: string
}

export const useRecentsStore = defineStore('recents', () => {
  // State
  const items = ref<RecentItem[]>([])
  const isLoading = ref(false)

  // Getters
  const recentTables = computed(() =>
    items.value.filter(i => i.type === 'table')
  )

  const recentQueries = computed(() =>
    items.value.filter(i => i.type === 'query')
  )

  const recentViews = computed(() =>
    items.value.filter(i => i.type === 'view')
  )

  // Load recents from backend
  const loadRecents = async (limit = 20) => {
    isLoading.value = true
    try {
      items.value = await window.api.recents.list(limit)
    } catch (error) {
      console.error('Failed to load recents:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Add a recent item
  const addRecent = async (
    type: RecentItemType,
    name: string,
    connectionId: string,
    database?: string,
    schema?: string,
    sql?: string
  ) => {
    try {
      await window.api.recents.add(type, name, connectionId, database, schema, sql)
      // Reload to get updated list
      await loadRecents()
    } catch (error) {
      console.error('Failed to add recent:', error)
    }
  }

  // Add recent table
  const addRecentTable = async (
    name: string,
    connectionId: string,
    database?: string,
    schema?: string
  ) => {
    await addRecent('table', name, connectionId, database, schema)
  }

  // Add recent view
  const addRecentView = async (
    name: string,
    connectionId: string,
    database?: string,
    schema?: string
  ) => {
    await addRecent('view', name, connectionId, database, schema)
  }

  // Add recent query
  const addRecentQuery = async (
    name: string,
    sql: string,
    connectionId: string,
    database?: string
  ) => {
    await addRecent('query', name, connectionId, database, undefined, sql)
  }

  // Remove a recent item
  const removeRecent = async (id: number) => {
    try {
      await window.api.recents.remove(id)
      items.value = items.value.filter(i => i.id !== id)
    } catch (error) {
      console.error('Failed to remove recent:', error)
    }
  }

  // Clear all recents
  const clearRecents = async () => {
    try {
      await window.api.recents.clear()
      items.value = []
    } catch (error) {
      console.error('Failed to clear recents:', error)
    }
  }

  // Clear recents for a connection
  const clearRecentsForConnection = async (connectionId: string) => {
    try {
      await window.api.recents.clearForConnection(connectionId)
      items.value = items.value.filter(i => i.connectionId !== connectionId)
    } catch (error) {
      console.error('Failed to clear recents for connection:', error)
    }
  }

  return {
    // State
    items,
    isLoading,
    // Getters
    recentTables,
    recentQueries,
    recentViews,
    // Actions
    loadRecents,
    addRecentTable,
    addRecentView,
    addRecentQuery,
    removeRecent,
    clearRecents,
    clearRecentsForConnection
  }
})
