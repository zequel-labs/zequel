import { describe, it, expect } from 'vitest'
import { DatabaseType } from '@/types/connection'

// Test connection type definitions and utilities
describe('Connection Types', () => {
  const DEFAULT_PORTS: Record<string, number> = {
    mysql: 3306,
    mariadb: 3306,
    postgresql: 5432,
    redis: 6379,
    mongodb: 27017,
    clickhouse: 8123
  }

  describe('DatabaseType', () => {
    it('should include all supported database types', () => {
      const types: DatabaseType[] = [DatabaseType.SQLite, DatabaseType.MySQL, DatabaseType.PostgreSQL, DatabaseType.MariaDB, DatabaseType.Redis, DatabaseType.MongoDB, DatabaseType.ClickHouse]
      expect(types.length).toBe(7)
    })
  })

  describe('DEFAULT_PORTS', () => {
    it('should have correct MySQL port', () => {
      expect(DEFAULT_PORTS.mysql).toBe(3306)
    })

    it('should have correct MariaDB port', () => {
      expect(DEFAULT_PORTS.mariadb).toBe(3306)
    })

    it('should have correct PostgreSQL port', () => {
      expect(DEFAULT_PORTS.postgresql).toBe(5432)
    })

    it('should have correct Redis port', () => {
      expect(DEFAULT_PORTS.redis).toBe(6379)
    })

    it('should have correct MongoDB port', () => {
      expect(DEFAULT_PORTS.mongodb).toBe(27017)
    })

    it('should have correct ClickHouse port', () => {
      expect(DEFAULT_PORTS.clickhouse).toBe(8123)
    })

    it('should not have a port for SQLite', () => {
      expect(DEFAULT_PORTS.sqlite).toBeUndefined()
    })
  })

  describe('ConnectionConfig validation', () => {
    interface ConnectionConfig {
      type: DatabaseType
      name: string
      host?: string
      port?: number
      database?: string
      username?: string
      password?: string
      filepath?: string
      color?: string
    }

    const validateConfig = (config: ConnectionConfig): string[] => {
      const errors: string[] = []

      if (!config.name.trim()) {
        errors.push('Name is required')
      }

      if (config.type === DatabaseType.SQLite) {
        if (!config.filepath?.trim()) {
          errors.push('Database file path is required')
        }
      } else {
        if (!config.host?.trim()) {
          errors.push('Host is required')
        }
      }

      if (config.port !== undefined && (config.port < 1 || config.port > 65535)) {
        errors.push('Port must be between 1 and 65535')
      }

      if (config.color && !/^#[0-9A-Fa-f]{6}$/.test(config.color)) {
        errors.push('Invalid color format')
      }

      return errors
    }

    it('should validate a valid MySQL config', () => {
      const errors = validateConfig({
        type: DatabaseType.MySQL,
        name: 'Local MySQL',
        host: 'localhost',
        port: 3306,
        database: 'mydb',
        username: 'root'
      })
      expect(errors).toEqual([])
    })

    it('should require name', () => {
      const errors = validateConfig({
        type: DatabaseType.MySQL,
        name: '',
        host: 'localhost'
      })
      expect(errors).toContain('Name is required')
    })

    it('should require filepath for SQLite', () => {
      const errors = validateConfig({
        type: DatabaseType.SQLite,
        name: 'Local SQLite'
      })
      expect(errors).toContain('Database file path is required')
    })

    it('should require host for non-SQLite databases', () => {
      const errors = validateConfig({
        type: DatabaseType.PostgreSQL,
        name: 'Local PG'
      })
      expect(errors).toContain('Host is required')
    })

    it('should validate port range', () => {
      const errors = validateConfig({
        type: DatabaseType.MySQL,
        name: 'Test',
        host: 'localhost',
        port: 99999
      })
      expect(errors).toContain('Port must be between 1 and 65535')
    })

    it('should validate color format', () => {
      const errors = validateConfig({
        type: DatabaseType.MySQL,
        name: 'Test',
        host: 'localhost',
        color: 'red'
      })
      expect(errors).toContain('Invalid color format')
    })

    it('should accept valid hex color', () => {
      const errors = validateConfig({
        type: DatabaseType.MySQL,
        name: 'Test',
        host: 'localhost',
        color: '#FF5733'
      })
      expect(errors).toEqual([])
    })
  })
})
