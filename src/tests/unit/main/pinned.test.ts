import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TableObjectType } from '@main/types'
import type { PinnedEntity } from '@main/services/pinned'

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create mock statement helpers
const mockRun = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }))
const mockGet = vi.fn()
const mockAll = vi.fn(() => [])
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}))
const mockTransaction = vi.fn((fn: () => void) => fn)

// Mock appDatabase
vi.mock('@main/services/database', () => ({
  appDatabase: {
    getDatabase: vi.fn(() => ({
      prepare: mockPrepare,
      transaction: mockTransaction,
    })),
  },
}))

import { PinnedService, pinnedService } from '@main/services/pinned'
import { logger } from '@main/utils/logger'

const createPinnedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'table',
  name: 'users',
  connection_id: 'conn-1',
  database: 'mydb',
  schema: 'public',
  sort_order: 0,
  created_at: '2024-01-15T10:30:00.000Z',
  ...overrides,
})

describe('PinnedService', () => {
  let service: PinnedService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PinnedService()
    mockGet.mockReturnValue(undefined)
  })

  describe('pin', () => {
    it('should insert a new pinned entity when not already pinned', () => {
      // Check existing -> not found
      mockGet.mockReturnValueOnce(undefined)
      // Get max sort_order
      mockGet.mockReturnValueOnce({ max_order: 2 })
      // INSERT run
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 5 })
      // getById after insert
      mockGet.mockReturnValueOnce(createPinnedRow({ id: 5, sort_order: 3 }))

      const result = service.pin(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(result.id).toBe(5)
      expect(result.name).toBe('users')
      expect(result.type).toBe(TableObjectType.Table)
      expect(logger.debug).toHaveBeenCalledWith('Entity pinned', {
        type: TableObjectType.Table,
        name: 'users',
        connectionId: 'conn-1',
      })
    })

    it('should return existing entity if already pinned', () => {
      // Check existing -> found
      mockGet.mockReturnValueOnce({ id: 3 })
      // getById
      mockGet.mockReturnValueOnce(createPinnedRow({ id: 3 }))

      const result = service.pin(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(result.id).toBe(3)
    })

    it('should set sort_order to max+1 for new pins', () => {
      mockGet.mockReturnValueOnce(undefined)
      mockGet.mockReturnValueOnce({ max_order: 5 })
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 1 })
      mockGet.mockReturnValueOnce(createPinnedRow({ sort_order: 6 }))

      service.pin(TableObjectType.Table, 'orders', 'conn-1')

      // The INSERT run call should include sort_order = 6
      expect(mockRun).toHaveBeenCalledWith(TableObjectType.Table, 'orders', 'conn-1', null, null, 6)
    })
  })

  describe('unpin', () => {
    it('should return true when entity was removed', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 })

      const result = service.unpin(1)

      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(1)
    })

    it('should return false when entity was not found', () => {
      mockRun.mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 })

      const result = service.unpin(999)

      expect(result).toBe(false)
    })
  })

  describe('unpinByName', () => {
    it('should delete by type, name, connectionId, database and schema', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 })

      const result = service.unpinByName(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(result).toBe(true)
      expect(mockRun).toHaveBeenCalledWith(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')
    })

    it('should use empty string for undefined database and schema', () => {
      mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 0 })

      service.unpinByName(TableObjectType.View, 'my_view', 'conn-1')

      expect(mockRun).toHaveBeenCalledWith(TableObjectType.View, 'my_view', 'conn-1', '', '')
    })
  })

  describe('listByConnection', () => {
    it('should return pinned entities ordered by sort_order', () => {
      mockAll.mockReturnValueOnce([
        createPinnedRow({ id: 1, name: 'users', sort_order: 0 }),
        createPinnedRow({ id: 2, name: 'orders', sort_order: 1 }),
      ])

      const result = service.listByConnection('conn-1')

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('users')
      expect(result[1].name).toBe('orders')
      expect(mockAll).toHaveBeenCalledWith('conn-1')
    })

    it('should return empty array when no pins exist', () => {
      mockAll.mockReturnValueOnce([])

      const result = service.listByConnection('conn-1')

      expect(result).toEqual([])
    })
  })

  describe('isPinned', () => {
    it('should return true when entity is pinned', () => {
      mockGet.mockReturnValueOnce({ 1: 1 })

      const result = service.isPinned(TableObjectType.Table, 'users', 'conn-1', 'mydb', 'public')

      expect(result).toBe(true)
    })

    it('should return false when entity is not pinned', () => {
      mockGet.mockReturnValueOnce(undefined)

      const result = service.isPinned(TableObjectType.Table, 'users', 'conn-1')

      expect(result).toBe(false)
    })
  })

  describe('reorder', () => {
    it('should update sort_order for each id by array position', () => {
      service.reorder([3, 1, 2])

      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRun).toHaveBeenCalledWith(0, 3)
      expect(mockRun).toHaveBeenCalledWith(1, 1)
      expect(mockRun).toHaveBeenCalledWith(2, 2)
    })
  })

  describe('clearForConnection', () => {
    it('should delete all pins for a connection', () => {
      mockRun.mockReturnValueOnce({ changes: 5, lastInsertRowid: 0 })

      const result = service.clearForConnection('conn-1')

      expect(result).toBe(5)
      expect(mockRun).toHaveBeenCalledWith('conn-1')
      expect(logger.debug).toHaveBeenCalledWith('Pinned entities cleared for connection', {
        connectionId: 'conn-1',
        deleted: 5,
      })
    })
  })

  describe('row mapping', () => {
    it('should map all fields from database row to PinnedEntity', () => {
      mockAll.mockReturnValueOnce([
        createPinnedRow({
          id: 100,
          type: 'view',
          name: 'user_stats',
          connection_id: 'conn-x',
          database: 'analytics',
          schema: 'reporting',
          sort_order: 3,
          created_at: '2024-06-15T08:00:00Z',
        }),
      ])

      const result = service.listByConnection('conn-x')

      expect(result[0]).toEqual({
        id: 100,
        type: 'view',
        name: 'user_stats',
        connectionId: 'conn-x',
        database: 'analytics',
        schema: 'reporting',
        sortOrder: 3,
        createdAt: '2024-06-15T08:00:00Z',
      })
    })

    it('should convert null database and schema to undefined', () => {
      mockAll.mockReturnValueOnce([
        createPinnedRow({ database: null, schema: null }),
      ])

      const result = service.listByConnection('conn-1')

      expect(result[0].database).toBeUndefined()
      expect(result[0].schema).toBeUndefined()
    })
  })

  describe('pinnedService singleton', () => {
    it('should be an instance of PinnedService', () => {
      expect(pinnedService).toBeInstanceOf(PinnedService)
    })
  })
})
