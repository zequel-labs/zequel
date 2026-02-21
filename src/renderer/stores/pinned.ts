import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TableObjectType } from '@/types/table'
import type { PinnedEntity } from '@/types/electron'
import { useConnectionsStore } from '@/stores/connections'

export const usePinnedStore = defineStore('pinned', () => {
  const pinnedEntities = ref<PinnedEntity[]>([])
  const isLoading = ref(false)
  let loadGeneration = 0

  // Resolve session ID to saved connection ID for persistence
  const resolveSavedId = (sessionId: string): string | null => {
    const connectionsStore = useConnectionsStore()
    return connectionsStore.getSavedConnectionId(sessionId)
  }

  const loadPinned = async (sessionId: string): Promise<void> => {
    const savedId = resolveSavedId(sessionId)
    if (!savedId) return
    const currentGeneration = ++loadGeneration
    isLoading.value = true
    try {
      const result = await window.api.pinned.list(savedId)
      // Only apply if this is still the latest load request
      if (currentGeneration === loadGeneration) {
        pinnedEntities.value = result
      }
    } catch (error) {
      console.error('Failed to load pinned entities:', error)
    } finally {
      if (currentGeneration === loadGeneration) {
        isLoading.value = false
      }
    }
  }

  const pinEntity = async (
    type: TableObjectType,
    name: string,
    sessionId: string,
    database?: string,
    schema?: string
  ): Promise<void> => {
    const savedId = resolveSavedId(sessionId)
    if (!savedId) return
    try {
      await window.api.pinned.pin(type, name, savedId, database, schema)
      await loadPinned(sessionId)
    } catch (error) {
      console.error('Failed to pin entity:', error)
    }
  }

  const unpinEntity = async (
    type: TableObjectType,
    name: string,
    sessionId: string,
    database?: string,
    schema?: string
  ): Promise<void> => {
    const savedId = resolveSavedId(sessionId)
    if (!savedId) return
    try {
      await window.api.pinned.unpinByName(type, name, savedId, database, schema)
      await loadPinned(sessionId)
    } catch (error) {
      console.error('Failed to unpin entity:', error)
    }
  }

  const isPinned = (
    type: TableObjectType,
    name: string,
    database?: string,
    schema?: string
  ): boolean => {
    return pinnedEntities.value.some(
      (e) => e.type === type && e.name === name && (e.database || '') === (database || '') && (e.schema || '') === (schema || '')
    )
  }

  const reorder = async (ids: number[]): Promise<void> => {
    try {
      await window.api.pinned.reorder(ids)
      // Update local state to reflect new order
      const reordered: PinnedEntity[] = []
      for (const id of ids) {
        const entity = pinnedEntities.value.find((e) => e.id === id)
        if (entity) reordered.push(entity)
      }
      pinnedEntities.value = reordered
    } catch (error) {
      console.error('Failed to reorder pinned entities:', error)
    }
  }

  return {
    pinnedEntities,
    isLoading,
    loadPinned,
    pinEntity,
    unpinEntity,
    isPinned,
    reorder,
  }
})
