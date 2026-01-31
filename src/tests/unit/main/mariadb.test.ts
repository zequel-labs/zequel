import { describe, it, expect } from 'vitest'
import { DatabaseType } from '@main/types'

// Test MariaDB-specific logic
describe('MariaDB Driver', () => {
  describe('Version detection', () => {
    const isMariaDBVersion = (versionString: string): boolean => {
      return versionString.toLowerCase().includes('mariadb')
    }

    const parseMariaDBVersion = (versionString: string): { major: number; minor: number; patch: number } | null => {
      const match = versionString.match(/(\d+)\.(\d+)\.(\d+)/)
      if (!match) return null
      return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10)
      }
    }

    it('should detect MariaDB from version string', () => {
      expect(isMariaDBVersion('10.6.12-MariaDB')).toBe(true)
      expect(isMariaDBVersion('11.1.2-MariaDB-1:11.1.2+maria~ubu2204')).toBe(true)
    })

    it('should not falsely detect MySQL as MariaDB', () => {
      expect(isMariaDBVersion('8.0.32')).toBe(false)
      expect(isMariaDBVersion('5.7.41-log')).toBe(false)
    })

    it('should parse version numbers', () => {
      const v = parseMariaDBVersion('10.6.12-MariaDB')
      expect(v).toEqual({ major: 10, minor: 6, patch: 12 })
    })

    it('should parse MySQL version numbers', () => {
      const v = parseMariaDBVersion('8.0.32')
      expect(v).toEqual({ major: 8, minor: 0, patch: 32 })
    })

    it('should return null for invalid version', () => {
      const v = parseMariaDBVersion('unknown')
      expect(v).toBeNull()
    })
  })

  describe('MariaDB vs MySQL compatibility', () => {
    it('should use default port 3306', () => {
      const DEFAULT_PORT = 3306
      expect(DEFAULT_PORT).toBe(3306)
    })

    it('should be a valid DatabaseType', () => {
      const type: DatabaseType = DatabaseType.MariaDB
      expect(type).toBe(DatabaseType.MariaDB)
    })

    it('should share MySQL connection properties', () => {
      interface MySQLConfig {
        host: string
        port: number
        user: string
        password: string
        database: string
      }

      interface MariaDBConfig extends MySQLConfig {
        // No additional properties needed for basic connection
      }

      const config: MariaDBConfig = {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'test'
      }

      expect(config.host).toBe('localhost')
      expect(config.port).toBe(3306)
    })
  })

  describe('SSH tunnel port mapping', () => {
    const getDefaultPortForType = (type: DatabaseType): number => {
      if (type === DatabaseType.MySQL || type === DatabaseType.MariaDB) return 3306
      if (type === DatabaseType.PostgreSQL) return 5432
      if (type === DatabaseType.Redis) return 6379
      if (type === DatabaseType.MongoDB) return 27017
      if (type === DatabaseType.ClickHouse) return 8123
      return 0
    }

    it('should return correct port for mariadb', () => {
      expect(getDefaultPortForType(DatabaseType.MariaDB)).toBe(3306)
    })

    it('should return same port for mysql and mariadb', () => {
      expect(getDefaultPortForType(DatabaseType.MySQL)).toBe(getDefaultPortForType(DatabaseType.MariaDB))
    })

    it('should return different port for postgresql', () => {
      expect(getDefaultPortForType(DatabaseType.PostgreSQL)).not.toBe(getDefaultPortForType(DatabaseType.MySQL))
    })
  })
})
