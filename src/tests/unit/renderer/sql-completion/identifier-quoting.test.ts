import { describe, it, expect } from 'vitest'
import { quoteIdentifier, needsQuoting } from '@/lib/sql-completion/identifier-quoting'
import { DatabaseType } from '@/types/connection'

describe('identifier-quoting', () => {
  describe('needsQuoting', () => {
    it('should return false for simple identifiers', () => {
      expect(needsQuoting('users')).toBe(false)
      expect(needsQuoting('my_table')).toBe(false)
      expect(needsQuoting('Column1')).toBe(false)
      expect(needsQuoting('_private')).toBe(false)
    })

    it('should return true for reserved words', () => {
      expect(needsQuoting('select')).toBe(true)
      expect(needsQuoting('from')).toBe(true)
      expect(needsQuoting('where')).toBe(true)
      expect(needsQuoting('order')).toBe(true)
      expect(needsQuoting('user')).toBe(true)
      expect(needsQuoting('table')).toBe(true)
      expect(needsQuoting('column')).toBe(true)
    })

    it('should be case-insensitive for reserved words', () => {
      expect(needsQuoting('SELECT')).toBe(true)
      expect(needsQuoting('From')).toBe(true)
    })

    it('should return true for names with spaces', () => {
      expect(needsQuoting('my table')).toBe(true)
    })

    it('should return true for names with special characters', () => {
      expect(needsQuoting('my-table')).toBe(true)
      expect(needsQuoting('table.name')).toBe(true)
      expect(needsQuoting('some@thing')).toBe(true)
    })

    it('should return true for names starting with a digit', () => {
      expect(needsQuoting('1users')).toBe(true)
      expect(needsQuoting('123')).toBe(true)
    })

    it('should return false for empty string', () => {
      expect(needsQuoting('')).toBe(false)
    })
  })

  describe('quoteIdentifier', () => {
    describe('PostgreSQL', () => {
      const dialect = DatabaseType.PostgreSQL

      it('should not quote simple identifiers', () => {
        expect(quoteIdentifier('users', dialect)).toBe('users')
        expect(quoteIdentifier('my_table', dialect)).toBe('my_table')
      })

      it('should double-quote reserved words', () => {
        expect(quoteIdentifier('user', dialect)).toBe('"user"')
        expect(quoteIdentifier('order', dialect)).toBe('"order"')
      })

      it('should double-quote names with spaces', () => {
        expect(quoteIdentifier('my table', dialect)).toBe('"my table"')
      })

      it('should escape embedded double quotes', () => {
        expect(quoteIdentifier('my"col', dialect)).toBe('"my""col"')
      })
    })

    describe('SQLite', () => {
      const dialect = DatabaseType.SQLite

      it('should use double quotes like PostgreSQL', () => {
        expect(quoteIdentifier('user', dialect)).toBe('"user"')
        expect(quoteIdentifier('users', dialect)).toBe('users')
      })
    })

    describe('MySQL', () => {
      const dialect = DatabaseType.MySQL

      it('should not quote simple identifiers', () => {
        expect(quoteIdentifier('users', dialect)).toBe('users')
      })

      it('should use backticks for reserved words', () => {
        expect(quoteIdentifier('user', dialect)).toBe('`user`')
        expect(quoteIdentifier('order', dialect)).toBe('`order`')
      })

      it('should use backticks for names with spaces', () => {
        expect(quoteIdentifier('my table', dialect)).toBe('`my table`')
      })

      it('should escape embedded backticks', () => {
        expect(quoteIdentifier('my`col', dialect)).toBe('`my``col`')
      })
    })

    describe('MariaDB', () => {
      const dialect = DatabaseType.MariaDB

      it('should use backticks like MySQL', () => {
        expect(quoteIdentifier('user', dialect)).toBe('`user`')
        expect(quoteIdentifier('users', dialect)).toBe('users')
      })
    })

    describe('ClickHouse', () => {
      const dialect = DatabaseType.ClickHouse

      it('should not quote simple identifiers', () => {
        expect(quoteIdentifier('users', dialect)).toBe('users')
      })

      it('should use double quotes for reserved words', () => {
        expect(quoteIdentifier('user', dialect)).toBe('"user"')
      })
    })

    describe('DuckDB', () => {
      const dialect = DatabaseType.DuckDB

      it('should use double quotes like PostgreSQL', () => {
        expect(quoteIdentifier('user', dialect)).toBe('"user"')
        expect(quoteIdentifier('users', dialect)).toBe('users')
      })

      it('should not quote simple identifiers', () => {
        expect(quoteIdentifier('my_table', dialect)).toBe('my_table')
      })

      it('should escape embedded double quotes', () => {
        expect(quoteIdentifier('my"col', dialect)).toBe('"my""col"')
      })
    })
  })
})
