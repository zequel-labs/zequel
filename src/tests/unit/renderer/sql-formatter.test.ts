import { describe, it, expect } from 'vitest'
import { formatSql, minifySql } from '@/lib/sql-formatter'
import { DatabaseType } from '@/types/connection'

describe('SQL Formatter', () => {
  describe('formatSql', () => {
    it('should format a simple SELECT query', () => {
      const sql = 'SELECT id, name FROM users WHERE active = true'
      const result = formatSql(sql)
      expect(result).toContain('SELECT')
      expect(result).toContain('FROM')
      expect(result).toContain('WHERE')
      // Should have newlines (formatted)
      expect(result.split('\n').length).toBeGreaterThan(1)
    })

    it('should uppercase keywords by default', () => {
      const sql = 'select * from users'
      const result = formatSql(sql)
      expect(result).toContain('SELECT')
      expect(result).toContain('FROM')
    })

    it('should respect lowercase keyword option', () => {
      const sql = 'SELECT * FROM users'
      const result = formatSql(sql, { keywordCase: 'lower' })
      expect(result).toContain('select')
      expect(result).toContain('from')
    })

    it('should handle different dialects', () => {
      const sql = 'SELECT * FROM users LIMIT 10'
      const pgResult = formatSql(sql, { dialect: DatabaseType.PostgreSQL })
      const mysqlResult = formatSql(sql, { dialect: DatabaseType.MySQL })
      // Both should produce valid formatted output
      expect(pgResult).toContain('SELECT')
      expect(mysqlResult).toContain('SELECT')
    })

    it('should return original SQL on format failure', () => {
      // Pass something that might cause issues but should still return something
      const sql = 'NOT VALID SQL ;;;'
      const result = formatSql(sql)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle complex queries', () => {
      const sql = 'SELECT u.id, u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.active = true GROUP BY u.id, u.name HAVING COUNT(o.id) > 5 ORDER BY order_count DESC LIMIT 10'
      const result = formatSql(sql)
      expect(result).toContain('SELECT')
      expect(result).toContain('LEFT JOIN')
      expect(result).toContain('GROUP BY')
      expect(result).toContain('HAVING')
      expect(result).toContain('ORDER BY')
    })

    it('should handle empty string', () => {
      const result = formatSql('')
      expect(result).toBe('')
    })
  })

  describe('minifySql', () => {
    it('should collapse whitespace', () => {
      const sql = 'SELECT  *  \n  FROM   users  \n  WHERE  id = 1'
      const result = minifySql(sql)
      expect(result).toBe('SELECT * FROM users WHERE id = 1')
    })

    it('should remove single-line comments', () => {
      const sql = 'SELECT * FROM users -- this is a comment\nWHERE id = 1'
      const result = minifySql(sql)
      expect(result).not.toContain('comment')
      expect(result).toContain('SELECT')
      expect(result).toContain('WHERE')
    })

    it('should remove multi-line comments', () => {
      const sql = 'SELECT * /* multi\nline\ncomment */ FROM users'
      const result = minifySql(sql)
      expect(result).not.toContain('multi')
      expect(result).toContain('SELECT')
      expect(result).toContain('FROM')
    })

    it('should trim the result', () => {
      const sql = '  SELECT * FROM users  '
      const result = minifySql(sql)
      expect(result).toBe('SELECT * FROM users')
    })

    it('should handle empty string', () => {
      expect(minifySql('')).toBe('')
    })

    it('should handle SQL with only comments', () => {
      const sql = '-- just a comment\n/* another comment */'
      const result = minifySql(sql)
      expect(result).toBe('')
    })
  })
})
