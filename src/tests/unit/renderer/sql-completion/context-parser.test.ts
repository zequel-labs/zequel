import { describe, it, expect } from 'vitest'
import {
  getSqlContext,
  resolveTableFromPrefix,
  stripLiteralsAndComments,
  getRelevantContextText,
  extractCteNames,
} from '@/lib/sql-completion/context-parser'
import type { SchemaMetadata } from '@/lib/sql-completion/types'

describe('context-parser', () => {
  describe('stripLiteralsAndComments', () => {
    it('should replace single-quoted string literals with spaces', () => {
      const result = stripLiteralsAndComments("SELECT * FROM t WHERE name = 'hello world'")
      expect(result).not.toContain('hello world')
      expect(result).toContain('SELECT * FROM t WHERE name =')
    })

    it('should handle escaped single quotes inside strings', () => {
      const result = stripLiteralsAndComments("SELECT 'it''s a test'")
      expect(result).not.toContain("it''s a test")
    })

    it('should replace line comments with spaces', () => {
      const result = stripLiteralsAndComments('SELECT * -- this is a comment\nFROM t')
      expect(result).not.toContain('this is a comment')
      expect(result).toContain('SELECT *')
      expect(result).toContain('\nFROM t')
    })

    it('should replace block comments with spaces', () => {
      const result = stripLiteralsAndComments('SELECT /* hidden FROM keyword */ * FROM t')
      expect(result).not.toContain('hidden FROM keyword')
      expect(result).toContain('SELECT')
      expect(result).toContain('* FROM t')
    })

    it('should preserve double-quoted identifiers', () => {
      const result = stripLiteralsAndComments('SELECT "my column" FROM "my table"')
      expect(result).toContain('"my column"')
      expect(result).toContain('"my table"')
    })

    it('should handle empty input', () => {
      expect(stripLiteralsAndComments('')).toBe('')
    })

    it('should handle text with no literals or comments', () => {
      const input = 'SELECT * FROM users WHERE id = 1'
      expect(stripLiteralsAndComments(input)).toBe(input)
    })

    it('should not match FROM inside a string literal', () => {
      const result = stripLiteralsAndComments("SELECT 'FROM users' FROM actual_table")
      // The FROM inside the string should be replaced with spaces
      // Only the real FROM should remain
      const fromCount = (result.match(/\bFROM\b/g) || []).length
      expect(fromCount).toBe(1)
    })
  })

  describe('getRelevantContextText', () => {
    it('should return full text when no unclosed parens', () => {
      const text = 'SELECT * FROM users WHERE id = 1'
      expect(getRelevantContextText(text)).toBe(text)
    })

    it('should return text after last unclosed paren for subqueries', () => {
      const text = 'SELECT * FROM users WHERE id IN (SELECT user_id FROM orders WHERE status ='
      const result = getRelevantContextText(text)
      expect(result).toContain('SELECT user_id FROM orders WHERE status =')
      expect(result).not.toContain('SELECT * FROM users')
    })

    it('should handle nested subqueries', () => {
      const text = 'SELECT * FROM (SELECT * FROM (SELECT id FROM t WHERE'
      const result = getRelevantContextText(text)
      expect(result).toContain('SELECT id FROM t WHERE')
    })

    it('should handle closed parens correctly', () => {
      const text = 'SELECT * FROM (SELECT 1) AS sub WHERE'
      const result = getRelevantContextText(text)
      // All parens are closed, should return full text
      expect(result).toBe(text)
    })

    it('should NOT strip for function call parens', () => {
      const text = 'SELECT COALESCE(col1, '
      const result = getRelevantContextText(text)
      // Function call paren should not be treated as subquery
      expect(result).toBe(text)
    })

    it('should NOT strip for COUNT(DISTINCT', () => {
      const text = 'SELECT COUNT(DISTINCT name'
      const result = getRelevantContextText(text)
      expect(result).toBe(text)
    })

    it('should NOT strip for INSERT column list parens', () => {
      const text = 'INSERT INTO users ('
      const result = getRelevantContextText(text)
      expect(result).toBe(text)
    })

    it('should handle excess closing parens without going negative', () => {
      // More closing parens than opening — depth should clamp to 0
      const text = 'SELECT * FROM users) WHERE id = 1'
      const result = getRelevantContextText(text)
      // All parens are "closed" (depth never goes below 0), return full text
      expect(result).toBe(text)
    })
  })

  describe('extractCteNames', () => {
    it('should extract a single CTE name', () => {
      const sql = 'WITH active_users AS (SELECT * FROM users WHERE active = true) SELECT * FROM'
      expect(extractCteNames(sql)).toContain('active_users')
    })

    it('should extract CTE with RECURSIVE keyword', () => {
      const sql = 'WITH RECURSIVE tree AS (SELECT * FROM nodes) SELECT * FROM'
      expect(extractCteNames(sql)).toContain('tree')
    })

    it('should extract chained CTE names', () => {
      const sql = 'WITH first_cte AS (SELECT 1), second_cte AS (SELECT 2) SELECT * FROM'
      const names = extractCteNames(sql)
      expect(names).toContain('first_cte')
      expect(names).toContain('second_cte')
    })

    it('should return empty array when no CTEs', () => {
      expect(extractCteNames('SELECT * FROM users')).toEqual([])
    })
  })

  describe('getSqlContext', () => {
    it('should detect SELECT context', () => {
      const result = getSqlContext('SELECT ')
      expect(result.context).toBe('select')
    })

    it('should detect FROM context', () => {
      const result = getSqlContext('SELECT * FROM ')
      expect(result.context).toBe('from')
    })

    it('should detect WHERE context', () => {
      const result = getSqlContext('SELECT * FROM users WHERE ')
      expect(result.context).toBe('where')
    })

    it('should detect ORDER BY context', () => {
      const result = getSqlContext('SELECT * FROM users ORDER BY ')
      expect(result.context).toBe('order_by')
    })

    it('should detect GROUP BY context', () => {
      const result = getSqlContext('SELECT * FROM users GROUP BY ')
      expect(result.context).toBe('group_by')
    })

    it('should detect HAVING context', () => {
      const result = getSqlContext('SELECT * FROM users GROUP BY name HAVING ')
      expect(result.context).toBe('having')
    })

    it('should detect UPDATE SET context', () => {
      const result = getSqlContext('UPDATE users SET ')
      expect(result.context).toBe('update_set')
    })

    it('should detect INSERT columns context', () => {
      const result = getSqlContext('INSERT INTO users (')
      expect(result.context).toBe('insert_columns')
    })

    it('should detect join_on context', () => {
      const result = getSqlContext('SELECT * FROM users u JOIN orders o ON ')
      expect(result.context).toBe('join_on')
    })

    it('should not detect join_on when ON is followed by a subsequent clause keyword', () => {
      // ON is present but followed by WHERE, so context should be 'where' instead
      const result = getSqlContext('SELECT * FROM users u JOIN orders o ON u.id = o.user_id WHERE ')
      expect(result.context).toBe('where')
    })

    it('should default to general context', () => {
      const result = getSqlContext('')
      expect(result.context).toBe('general')
    })

    it('should extract table aliases', () => {
      const result = getSqlContext('SELECT * FROM users u JOIN orders o ON ')
      expect(result.tableAliases.get('u')).toBe('users')
      expect(result.tableAliases.get('o')).toBe('orders')
    })

    it('should extract table aliases with AS keyword', () => {
      const result = getSqlContext('SELECT * FROM users AS u')
      expect(result.tableAliases.get('u')).toBe('users')
    })

    it('should extract referenced tables', () => {
      const result = getSqlContext('SELECT * FROM users JOIN orders ON ')
      expect(result.referencedTables).toContain('users')
      expect(result.referencedTables).toContain('orders')
    })

    it('should handle schema-qualified table names', () => {
      const result = getSqlContext('SELECT * FROM public.users u')
      expect(result.referencedTables).toContain('public.users')
      expect(result.tableAliases.get('u')).toBe('public.users')
    })

    it('should not capture reserved words as aliases', () => {
      const result = getSqlContext('SELECT * FROM users WHERE id = 1')
      // "WHERE" should not be treated as an alias
      expect(result.tableAliases.has('where')).toBe(false)
    })

    it('should include CTE names', () => {
      const result = getSqlContext('WITH active AS (SELECT * FROM users) SELECT * FROM ')
      expect(result.cteNames).toContain('active')
    })

    it('should handle subquery context correctly', () => {
      // Inside a subquery, the context should be from the inner query
      const result = getSqlContext('SELECT * FROM users WHERE id IN (SELECT user_id FROM ')
      expect(result.context).toBe('from')
    })
  })

  describe('resolveTableFromPrefix', () => {
    const schema: SchemaMetadata = {
      tables: [
        { name: 'users', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }] },
        { name: 'orders', columns: [{ name: 'id', type: 'int' }, { name: 'user_id', type: 'int' }] },
        { name: 'products', schema: 'store', columns: [{ name: 'id', type: 'int' }] },
      ],
      views: [
        { name: 'active_users', columns: [{ name: 'id', type: 'int' }, { name: 'name', type: 'varchar' }] },
      ],
    }

    it('should resolve a direct table name', () => {
      const result = resolveTableFromPrefix('users', new Map(), schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('users')
      expect(result!.columns).toHaveLength(2)
    })

    it('should resolve an alias', () => {
      const aliases = new Map([['u', 'users']])
      const result = resolveTableFromPrefix('u', aliases, schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('users')
    })

    it('should resolve schema-qualified alias', () => {
      const aliases = new Map([['p', 'store.products']])
      const result = resolveTableFromPrefix('p', aliases, schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('products')
      expect(result!.schema).toBe('store')
    })

    it('should resolve a view name and return its columns', () => {
      const result = resolveTableFromPrefix('active_users', new Map(), schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('active_users')
      expect(result!.columns).toHaveLength(2)
    })

    it('should resolve an alias pointing to a view', () => {
      const aliases = new Map([['au', 'active_users']])
      const result = resolveTableFromPrefix('au', aliases, schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('active_users')
    })

    it('should return undefined for unknown prefix', () => {
      const result = resolveTableFromPrefix('unknown', new Map(), schema)
      expect(result).toBeUndefined()
    })

    it('should return undefined when schema is undefined', () => {
      const result = resolveTableFromPrefix('users', new Map(), undefined)
      expect(result).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      const result = resolveTableFromPrefix('USERS', new Map(), schema)
      expect(result).toBeDefined()
      expect(result!.name).toBe('users')
    })
  })
})
