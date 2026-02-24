import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

vi.mock('@main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
  },
}))

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}))

vi.mock('@main/ipc/helpers', () => ({
  withDriver: vi.fn(),
  assertSessionOwner: vi.fn(),
}))

import { ipcMain } from 'electron'
import { withDriver } from '@main/ipc/helpers'
import { registerTransactionHandlers } from '@main/ipc/transaction'
import type { DatabaseDriver } from '@main/db/base'

const getHandler = (channel: string): ((...args: unknown[]) => unknown) => {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const match = calls.find((c) => c[0] === channel)
  if (!match) {
    throw new Error(`No handler registered for channel: ${channel}`)
  }
  return match[1] as (...args: unknown[]) => unknown
}

describe('registerTransactionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    registerTransactionHandlers()
  })

  it('should register all expected IPC handlers', () => {
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0])
    expect(registeredChannels).toContain('transaction:begin')
    expect(registeredChannels).toContain('transaction:commit')
    expect(registeredChannels).toContain('transaction:rollback')
    expect(registeredChannels).toContain('transaction:status')
  })

  describe('transaction:begin', () => {
    it('should call withDriver and beginTransaction', async () => {
      const beginMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = { beginTransaction: beginMock }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:begin')
      await handler({}, 'conn-1')

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function))
      expect(beginMock).toHaveBeenCalled()
    })

    it('should propagate errors from beginTransaction', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          beginTransaction: vi.fn().mockRejectedValue(new Error('Transaction already active'))
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:begin')
      await expect(handler({}, 'conn-1')).rejects.toThrow('Transaction already active')
    })

    it('should throw when connection does not exist', async () => {
      vi.mocked(withDriver).mockRejectedValue(new Error('Not connected to database'))

      const handler = getHandler('transaction:begin')
      await expect(handler({}, 'non-existent')).rejects.toThrow('Not connected to database')
    })
  })

  describe('transaction:commit', () => {
    it('should call withDriver and commitTransaction', async () => {
      const commitMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = { commitTransaction: commitMock }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:commit')
      await handler({}, 'conn-1')

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function))
      expect(commitMock).toHaveBeenCalled()
    })

    it('should propagate errors from commitTransaction', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          commitTransaction: vi.fn().mockRejectedValue(new Error('No active transaction'))
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:commit')
      await expect(handler({}, 'conn-1')).rejects.toThrow('No active transaction')
    })
  })

  describe('transaction:rollback', () => {
    it('should call withDriver and rollbackTransaction', async () => {
      const rollbackMock = vi.fn().mockResolvedValue(undefined)
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = { rollbackTransaction: rollbackMock }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:rollback')
      await handler({}, 'conn-1')

      expect(withDriver).toHaveBeenCalledWith('conn-1', expect.any(Function))
      expect(rollbackMock).toHaveBeenCalled()
    })

    it('should propagate errors from rollbackTransaction', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          rollbackTransaction: vi.fn().mockRejectedValue(new Error('No active transaction'))
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:rollback')
      await expect(handler({}, 'conn-1')).rejects.toThrow('No active transaction')
    })
  })

  describe('transaction:status', () => {
    it('should return transaction status when transaction is active', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          inTransaction: true,
          supportsTransactions: true
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:status')
      const result = await handler({}, 'conn-1')

      expect(result).toEqual({
        inTransaction: true,
        supportsTransactions: true
      })
    })

    it('should return false for both when no transaction is active', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          inTransaction: false,
          supportsTransactions: true
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:status')
      const result = await handler({}, 'conn-1')

      expect(result).toEqual({
        inTransaction: false,
        supportsTransactions: true
      })
    })

    it('should return supportsTransactions false for unsupported drivers', async () => {
      vi.mocked(withDriver).mockImplementation(async (_id, fn) => {
        const mockDriver = {
          inTransaction: false,
          supportsTransactions: false
        }
        return fn(mockDriver as unknown as DatabaseDriver)
      })

      const handler = getHandler('transaction:status')
      const result = await handler({}, 'conn-1')

      expect(result).toEqual({
        inTransaction: false,
        supportsTransactions: false
      })
    })

    it('should throw when connection does not exist', async () => {
      vi.mocked(withDriver).mockRejectedValue(new Error('Not connected to database'))

      const handler = getHandler('transaction:status')
      await expect(handler({}, 'non-existent')).rejects.toThrow('Not connected to database')
    })
  })
})
