import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock window.api.pinned
const mockList = vi.fn()
const mockPin = vi.fn()
const mockUnpinByName = vi.fn()
const mockReorder = vi.fn()
const mockClear = vi.fn()

vi.stubGlobal('window', {
  ...globalThis.window,
  api: {
    platform: 'darwin',
    pinned: {
      list: mockList,
      pin: mockPin,
      unpinByName: mockUnpinByName,
      reorder: mockReorder,
      clear: mockClear,
    },
  },
})

import { usePinnedStore } from '@/stores/pinned'
import { useConnectionsStore } from '@/stores/connections'
import { TableObjectType } from '@/types/table'
import type { PinnedEntity } from '@/types/electron'

const createPinnedEntity = (overrides: Partial<PinnedEntity> = {}): PinnedEntity => ({
  id: 1,
  type: TableObjectType.Table,
  name: 'users',
  connectionId: 'conn-1',
  database: 'mydb',
  sortOrder: 0,
  createdAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('Pinned Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Set up session mapping so resolveSavedId resolves correctly
    const connectionsStore = useConnectionsStore()
    connectionsStore.sessions.set('conn-1', { savedConnectionId: 'conn-1' })
  })

  describe('initial state', () => {
    it('should start with empty pinnedEntities', () => {
      const store = usePinnedStore()
      expect(store.pinnedEntities).toEqual([])
    })

    it('should start with isLoading false', () => {
      const store = usePinnedStore()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('loadPinned', () => {
    it('should load pinned entities from the backend', async () => {
      const items = [
        createPinnedEntity({ id: 1, name: 'users' }),
        createPinnedEntity({ id: 2, name: 'orders' }),
      ]
      mockList.mockResolvedValueOnce(items)

      const store = usePinnedStore()
      await store.loadPinned('conn-1')

      expect(mockList).toHaveBeenCalledWith('conn-1')
      expect(store.pinnedEntities).toEqual(items)
      expect(store.isLoading).toBe(false)
    })

    it('should set isLoading during load', async () => {
      let resolvePromise: (value: PinnedEntity[]) => void
      const promise = new Promise<PinnedEntity[]>((resolve) => {
        resolvePromise = resolve
      })
      mockList.mockReturnValueOnce(promise)

      const store = usePinnedStore()
      const loadPromise = store.loadPinned('conn-1')

      expect(store.isLoading).toBe(true)

      resolvePromise!([])
      await loadPromise

      expect(store.isLoading).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      mockList.mockRejectedValueOnce(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const store = usePinnedStore()
      await store.loadPinned('conn-1')

      expect(store.isLoading).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should discard stale results when a newer load supersedes an older one', async () => {
      let resolveFirst: (value: PinnedEntity[]) => void
      let resolveSecond: (value: PinnedEntity[]) => void
      const firstPromise = new Promise<PinnedEntity[]>((resolve) => { resolveFirst = resolve })
      const secondPromise = new Promise<PinnedEntity[]>((resolve) => { resolveSecond = resolve })

      mockList.mockReturnValueOnce(firstPromise)
      mockList.mockReturnValueOnce(secondPromise)

      const store = usePinnedStore()

      // Start first load
      const load1 = store.loadPinned('conn-1')

      // Start second load (supersedes first - bumps loadGeneration)
      const load2 = store.loadPinned('conn-1')

      // Resolve second first (the newer one)
      const secondItems = [createPinnedEntity({ id: 2, name: 'orders' })]
      resolveSecond!(secondItems)
      await load2

      expect(store.pinnedEntities).toEqual(secondItems)
      expect(store.isLoading).toBe(false)

      // Now resolve first (stale) - should be discarded
      const firstItems = [createPinnedEntity({ id: 1, name: 'users' })]
      resolveFirst!(firstItems)
      await load1

      // pinnedEntities should still be the second result, not the first
      expect(store.pinnedEntities).toEqual(secondItems)
    })

    it('should not set isLoading to false when a stale load completes with error', async () => {
      let rejectFirst: (reason: Error) => void
      let resolveSecond: (value: PinnedEntity[]) => void
      const firstPromise = new Promise<PinnedEntity[]>((_, reject) => { rejectFirst = reject })
      const secondPromise = new Promise<PinnedEntity[]>((resolve) => { resolveSecond = resolve })

      mockList.mockReturnValueOnce(firstPromise)
      mockList.mockReturnValueOnce(secondPromise)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const store = usePinnedStore()

      // Start first load
      const load1 = store.loadPinned('conn-1')

      // Start second load (supersedes first)
      const load2 = store.loadPinned('conn-1')

      // Reject first (stale) - should not set isLoading to false
      rejectFirst!(new Error('Network error'))
      await load1

      // isLoading should still be true because the second load is still pending
      expect(store.isLoading).toBe(true)

      // Resolve second
      resolveSecond!([])
      await load2

      expect(store.isLoading).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  describe('pinEntity', () => {
    it('should pin an entity and reload', async () => {
      mockPin.mockResolvedValueOnce(createPinnedEntity())
      mockList.mockResolvedValueOnce([createPinnedEntity()])

      const store = usePinnedStore()
      await store.pinEntity(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(mockPin).toHaveBeenCalledWith(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')
      expect(mockList).toHaveBeenCalledWith('conn-1')
    })

    it('should handle errors gracefully', async () => {
      mockPin.mockRejectedValueOnce(new Error('Failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const store = usePinnedStore()
      await store.pinEntity(TableObjectType.Table, 'users', 'conn-1')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('unpinEntity', () => {
    it('should unpin an entity and reload', async () => {
      mockUnpinByName.mockResolvedValueOnce(true)
      mockList.mockResolvedValueOnce([])

      const store = usePinnedStore()
      store.pinnedEntities = [createPinnedEntity()]

      await store.unpinEntity(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(mockUnpinByName).toHaveBeenCalledWith(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')
      expect(mockList).toHaveBeenCalledWith('conn-1')
    })

    it('should handle errors gracefully', async () => {
      mockUnpinByName.mockRejectedValueOnce(new Error('Failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const store = usePinnedStore()
      await store.unpinEntity(TableObjectType.Table, 'users', 'conn-1')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('isPinned', () => {
    it('should return true when entity is in pinnedEntities', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', database: 'mydb', schema: 'public' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users', 'mydb', 'public')).toBe(true)
    })

    it('should return false when entity is not in pinnedEntities', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'orders')).toBe(false)
    })

    it('should match by type, name, database and schema', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', database: 'mydb', schema: 'public' }),
        createPinnedEntity({ id: 2, type: TableObjectType.View, name: 'users', database: 'mydb', schema: 'public' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users', 'mydb', 'public')).toBe(true)
      expect(store.isPinned(TableObjectType.View, 'users', 'mydb', 'public')).toBe(true)
      expect(store.isPinned(TableObjectType.Table, 'users', 'mydb', 'other')).toBe(false)
      expect(store.isPinned(TableObjectType.Table, 'users', 'otherdb', 'public')).toBe(false)
    })

    it('should handle undefined database and schema', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', database: undefined, schema: undefined }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users')).toBe(true)
      expect(store.isPinned(TableObjectType.Table, 'users', undefined, undefined)).toBe(true)
    })
  })

  describe('multi-connection isolation', () => {
    it('should load pinned entities scoped to the connection', async () => {
      const conn1Items = [
        createPinnedEntity({ id: 1, name: 'users', connectionId: 'conn-1' }),
      ]
      const conn2Items = [
        createPinnedEntity({ id: 2, name: 'orders', connectionId: 'conn-2' }),
        createPinnedEntity({ id: 3, name: 'products', connectionId: 'conn-2' }),
      ]
      mockList.mockResolvedValueOnce(conn1Items)

      const connectionsStore = useConnectionsStore()
      connectionsStore.sessions.set('conn-2', { savedConnectionId: 'conn-2' })

      const store = usePinnedStore()

      // Load for conn-1
      await store.loadPinned('conn-1')
      expect(mockList).toHaveBeenCalledWith('conn-1')
      expect(store.pinnedEntities).toHaveLength(1)
      expect(store.pinnedEntities[0].name).toBe('users')

      // Load for conn-2 — replaces previous pinned entities
      mockList.mockResolvedValueOnce(conn2Items)
      await store.loadPinned('conn-2')
      expect(mockList).toHaveBeenCalledWith('conn-2')
      expect(store.pinnedEntities).toHaveLength(2)
      expect(store.pinnedEntities[0].name).toBe('orders')
    })

    it('should pin entity with resolved saved connection id', async () => {
      const connectionsStore = useConnectionsStore()
      connectionsStore.sessions.set('session-abc', { savedConnectionId: 'saved-xyz' })

      mockPin.mockResolvedValueOnce(createPinnedEntity())
      mockList.mockResolvedValueOnce([])

      const store = usePinnedStore()
      await store.pinEntity(TableObjectType.Table, 'users', 'session-abc', 'mydb')

      // Should resolve session ID to saved connection ID for both pin and reload
      expect(mockPin).toHaveBeenCalledWith(TableObjectType.Table, 'users', 'saved-xyz', 'mydb', undefined)
      expect(mockList).toHaveBeenCalledWith('saved-xyz')
    })
  })

  describe('reorder', () => {
    it('should call reorder API and update local state', async () => {
      mockReorder.mockResolvedValueOnce(undefined)

      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ id: 1, name: 'users' }),
        createPinnedEntity({ id: 2, name: 'orders' }),
        createPinnedEntity({ id: 3, name: 'products' }),
      ]

      await store.reorder([3, 1, 2])

      expect(mockReorder).toHaveBeenCalledWith([3, 1, 2])
      expect(store.pinnedEntities[0].name).toBe('products')
      expect(store.pinnedEntities[1].name).toBe('users')
      expect(store.pinnedEntities[2].name).toBe('orders')
    })

    it('should handle errors gracefully', async () => {
      mockReorder.mockRejectedValueOnce(new Error('Failed'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const store = usePinnedStore()
      await store.reorder([1, 2, 3])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should skip entities not found in pinnedEntities during reorder', async () => {
      mockReorder.mockResolvedValueOnce(undefined)

      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ id: 1, name: 'users' }),
        createPinnedEntity({ id: 2, name: 'orders' }),
      ]

      // Include ID 999 which doesn't exist
      await store.reorder([2, 999, 1])

      expect(mockReorder).toHaveBeenCalledWith([2, 999, 1])
      // Only existing entities should appear in result
      expect(store.pinnedEntities).toHaveLength(2)
      expect(store.pinnedEntities[0].name).toBe('orders')
      expect(store.pinnedEntities[1].name).toBe('users')
    })
  })

  describe('early return guards when resolveSavedId returns null', () => {
    it('should return early from loadPinned when resolveSavedId returns null', async () => {
      const store = usePinnedStore()

      // Use a session ID that is not registered in the connections store
      await store.loadPinned('unregistered-session')

      expect(mockList).not.toHaveBeenCalled()
      expect(store.isLoading).toBe(false)
    })

    it('should return early from pinEntity when resolveSavedId returns null', async () => {
      const store = usePinnedStore()

      await store.pinEntity(TableObjectType.Table, 'users', 'unregistered-session')

      expect(mockPin).not.toHaveBeenCalled()
      expect(mockList).not.toHaveBeenCalled()
    })

    it('should return early from unpinEntity when resolveSavedId returns null', async () => {
      const store = usePinnedStore()

      await store.unpinEntity(TableObjectType.Table, 'users', 'unregistered-session')

      expect(mockUnpinByName).not.toHaveBeenCalled()
      expect(mockList).not.toHaveBeenCalled()
    })
  })
})
