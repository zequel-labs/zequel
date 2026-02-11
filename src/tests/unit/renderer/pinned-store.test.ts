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

      await store.unpinEntity(TableObjectType.Table, 'users', 'conn-1', 'public')

      expect(mockUnpinByName).toHaveBeenCalledWith(TableObjectType.Table, 'users', 'conn-1', 'public')
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
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', schema: 'public' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users', 'public')).toBe(true)
    })

    it('should return false when entity is not in pinnedEntities', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'orders')).toBe(false)
    })

    it('should match by type, name, and schema', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', schema: 'public' }),
        createPinnedEntity({ id: 2, type: TableObjectType.View, name: 'users', schema: 'public' }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users', 'public')).toBe(true)
      expect(store.isPinned(TableObjectType.View, 'users', 'public')).toBe(true)
      expect(store.isPinned(TableObjectType.Table, 'users', 'other')).toBe(false)
    })

    it('should handle undefined schema', () => {
      const store = usePinnedStore()
      store.pinnedEntities = [
        createPinnedEntity({ type: TableObjectType.Table, name: 'users', schema: undefined }),
      ]

      expect(store.isPinned(TableObjectType.Table, 'users')).toBe(true)
      expect(store.isPinned(TableObjectType.Table, 'users', undefined)).toBe(true)
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
  })
})
