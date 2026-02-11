import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TableObjectType } from '@/types/table'
import type { PinnedEntity } from '@/types/electron'

export const usePinnedStore = defineStore('pinned', () => {
  const pinnedEntities = ref<PinnedEntity[]>([])
  const isLoading = ref(false)

  const loadPinned = async (connectionId: string): Promise<void> => {
    isLoading.value = true
    try {
      pinnedEntities.value = await window.api.pinned.list(connectionId)
    } catch (error) {
      console.error('Failed to load pinned entities:', error)
    } finally {
      isLoading.value = false
    }
  }

  const pinEntity = async (
    type: TableObjectType,
    name: string,
    connectionId: string,
    database?: string,
    schema?: string
  ): Promise<void> => {
    try {
      await window.api.pinned.pin(type, name, connectionId, database, schema)
      await loadPinned(connectionId)
    } catch (error) {
      console.error('Failed to pin entity:', error)
    }
  }

  const unpinEntity = async (
    type: TableObjectType,
    name: string,
    connectionId: string,
    schema?: string
  ): Promise<void> => {
    try {
      await window.api.pinned.unpinByName(type, name, connectionId, schema)
      await loadPinned(connectionId)
    } catch (error) {
      console.error('Failed to unpin entity:', error)
    }
  }

  const isPinned = (
    type: TableObjectType,
    name: string,
    schema?: string
  ): boolean => {
    return pinnedEntities.value.some(
      (e) => e.type === type && e.name === name && (e.schema || '') === (schema || '')
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
