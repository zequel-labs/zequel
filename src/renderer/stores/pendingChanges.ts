import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CellChange } from '@/types/query'

export interface SavedPendingChanges {
  connectionId: string
  tableName: string
  database?: string
  schema?: string
  changes: [string, CellChange][]
  newRows: Record<string, unknown>[]
  deleteRows: number[]
}

const buildKey = (connectionId: string, tableName: string, database?: string, schema?: string): string =>
  `${connectionId}:${database || ''}:${schema || ''}:${tableName}`

export const usePendingChangesStore = defineStore('pendingChanges', () => {
  const savedChanges = ref<Map<string, SavedPendingChanges>>(new Map())
  const liveChangeCounts = ref<Map<string, number>>(new Map())

  const saveChanges = (data: SavedPendingChanges): void => {
    const key = buildKey(data.connectionId, data.tableName, data.database, data.schema)
    savedChanges.value.set(key, data)
  }

  const getSavedChanges = (connectionId: string, tableName: string, database?: string, schema?: string): SavedPendingChanges | undefined => {
    const key = buildKey(connectionId, tableName, database, schema)
    return savedChanges.value.get(key)
  }

  const clearSavedChanges = (connectionId: string, tableName: string, database?: string, schema?: string): void => {
    const key = buildKey(connectionId, tableName, database, schema)
    savedChanges.value.delete(key)
  }

  const clearAllForConnection = (connectionId: string): void => {
    for (const [key] of savedChanges.value) {
      if (key.startsWith(`${connectionId}:`)) {
        savedChanges.value.delete(key)
      }
    }
    for (const [key] of liveChangeCounts.value) {
      if (key.startsWith(`${connectionId}:`)) {
        liveChangeCounts.value.delete(key)
      }
    }
  }

  const updateLiveCount = (connectionId: string, tableName: string, count: number, database?: string, schema?: string): void => {
    const key = buildKey(connectionId, tableName, database, schema)
    if (count > 0) {
      liveChangeCounts.value.set(key, count)
    } else {
      liveChangeCounts.value.delete(key)
    }
  }

  const removeLiveCount = (connectionId: string, tableName: string, database?: string, schema?: string): void => {
    const key = buildKey(connectionId, tableName, database, schema)
    liveChangeCounts.value.delete(key)
  }

  const hasPendingChanges = (connectionId: string, tableName: string, database?: string, schema?: string): boolean => {
    const key = buildKey(connectionId, tableName, database, schema)
    return savedChanges.value.has(key) || (liveChangeCounts.value.get(key) ?? 0) > 0
  }

  const connectionHasPendingChanges = (connectionId: string): boolean => {
    const prefix = `${connectionId}:`
    for (const [key] of savedChanges.value) {
      if (key.startsWith(prefix)) return true
    }
    for (const [key, count] of liveChangeCounts.value) {
      if (key.startsWith(prefix) && count > 0) return true
    }
    return false
  }

  return {
    saveChanges,
    getSavedChanges,
    clearSavedChanges,
    clearAllForConnection,
    updateLiveCount,
    removeLiveCount,
    hasPendingChanges,
    connectionHasPendingChanges
  }
})
