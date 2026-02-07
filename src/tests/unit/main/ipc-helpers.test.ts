import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DatabaseType } from '../../../main/types'

vi.mock('../../../main/db/manager', () => ({
  connectionManager: {
    getConnection: vi.fn(),
  },
}))

import { withDriver, withMySQLDriver, withPostgresDriver } from '../../../main/ipc/helpers'
import { connectionManager } from '../../../main/db/manager'

const mockGetConnection = vi.mocked(connectionManager.getConnection)

describe('IPC Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('withDriver', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined)

      await expect(
        withDriver('non-existent', async (driver) => driver.getDatabases())
      ).rejects.toThrow('Not connected to database')
    })

    it('should call fn with the driver when connection exists', async () => {
      const mockDriver = { getDatabases: vi.fn().mockResolvedValue(['db1', 'db2']) }
      mockGetConnection.mockReturnValue(mockDriver as any)

      const result = await withDriver('conn-1', async (driver) => driver.getDatabases())

      expect(mockGetConnection).toHaveBeenCalledWith('conn-1')
      expect(result).toEqual(['db1', 'db2'])
    })

    it('should support synchronous callback functions', async () => {
      const mockDriver = { getDataTypes: vi.fn().mockReturnValue([{ name: 'INT' }]) }
      mockGetConnection.mockReturnValue(mockDriver as any)

      const result = await withDriver('conn-1', (driver) => (driver as any).getDataTypes())

      expect(result).toEqual([{ name: 'INT' }])
    })

    it('should propagate errors from the callback', async () => {
      const mockDriver = { getDatabases: vi.fn().mockRejectedValue(new Error('Connection lost')) }
      mockGetConnection.mockReturnValue(mockDriver as any)

      await expect(
        withDriver('conn-1', async (driver) => driver.getDatabases())
      ).rejects.toThrow('Connection lost')
    })
  })

  describe('withMySQLDriver', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined)

      await expect(
        withMySQLDriver('non-existent', 'Charsets', async (driver) => driver.getCharsets())
      ).rejects.toThrow('Not connected to database')
    })

    it('should throw for non-MySQL/MariaDB connections', async () => {
      const mockDriver = { type: DatabaseType.PostgreSQL }
      mockGetConnection.mockReturnValue(mockDriver as any)

      await expect(
        withMySQLDriver('conn-1', 'Charsets', async (driver) => driver.getCharsets())
      ).rejects.toThrow('Charsets is only supported for MySQL/MariaDB connections')
    })

    it('should call fn for MySQL connections', async () => {
      const mockDriver = {
        type: DatabaseType.MySQL,
        getCharsets: vi.fn().mockResolvedValue([{ name: 'utf8mb4' }]),
      }
      mockGetConnection.mockReturnValue(mockDriver as any)

      const result = await withMySQLDriver('conn-1', 'Charsets', async (driver) => driver.getCharsets())

      expect(result).toEqual([{ name: 'utf8mb4' }])
    })

    it('should call fn for MariaDB connections', async () => {
      const mockDriver = {
        type: DatabaseType.MariaDB,
        getCharsets: vi.fn().mockResolvedValue([{ name: 'utf8mb4' }]),
      }
      mockGetConnection.mockReturnValue(mockDriver as any)

      const result = await withMySQLDriver('conn-1', 'Charsets', async (driver) => driver.getCharsets())

      expect(result).toEqual([{ name: 'utf8mb4' }])
    })

    it('should include feature name in error message', async () => {
      const mockDriver = { type: DatabaseType.SQLite }
      mockGetConnection.mockReturnValue(mockDriver as any)

      await expect(
        withMySQLDriver('conn-1', 'Partitions', async (driver) => driver.getCharsets())
      ).rejects.toThrow('Partitions is only supported for MySQL/MariaDB connections')
    })
  })

  describe('withPostgresDriver', () => {
    it('should throw when connection is not found', async () => {
      mockGetConnection.mockReturnValue(undefined)

      await expect(
        withPostgresDriver('non-existent', 'Encodings', async (driver) => driver.getEncodings())
      ).rejects.toThrow('Not connected to database')
    })

    it('should throw for non-PostgreSQL connections', async () => {
      const mockDriver = { type: DatabaseType.MySQL }
      mockGetConnection.mockReturnValue(mockDriver as any)

      await expect(
        withPostgresDriver('conn-1', 'Encodings', async (driver) => driver.getEncodings())
      ).rejects.toThrow('Encodings is only supported for PostgreSQL connections')
    })

    it('should call fn for PostgreSQL connections', async () => {
      const mockDriver = {
        type: DatabaseType.PostgreSQL,
        getEncodings: vi.fn().mockResolvedValue([{ name: 'UTF8' }]),
      }
      mockGetConnection.mockReturnValue(mockDriver as any)

      const result = await withPostgresDriver('conn-1', 'Encodings', async (driver) => driver.getEncodings())

      expect(result).toEqual([{ name: 'UTF8' }])
    })

    it('should include feature name in error message', async () => {
      const mockDriver = { type: DatabaseType.SQLite }
      mockGetConnection.mockReturnValue(mockDriver as any)

      await expect(
        withPostgresDriver('conn-1', 'Collations', async (driver) => driver.getCollations())
      ).rejects.toThrow('Collations is only supported for PostgreSQL connections')
    })
  })
})
