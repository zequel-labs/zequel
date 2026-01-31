import { describe, it, expect } from 'vitest'
import {
  BUILTIN_SNIPPETS,
  getSnippetsForDialect,
  toMonacoSnippet,
  getSnippetCategories,
  type SqlSnippet
} from '@/lib/sql-snippets'
import { DatabaseType } from '@/types/connection'

describe('SQL Snippets', () => {
  describe('BUILTIN_SNIPPETS', () => {
    it('should have snippets defined', () => {
      expect(BUILTIN_SNIPPETS.length).toBeGreaterThan(0)
    })

    it('should have unique IDs', () => {
      const ids = BUILTIN_SNIPPETS.map(s => s.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should have required fields on all snippets', () => {
      for (const snippet of BUILTIN_SNIPPETS) {
        expect(snippet.id).toBeTruthy()
        expect(snippet.name).toBeTruthy()
        expect(snippet.prefix).toBeTruthy()
        expect(snippet.body).toBeTruthy()
        expect(snippet.category).toBeTruthy()
      }
    })

    it('should have snippets for all major categories', () => {
      const categories = new Set(BUILTIN_SNIPPETS.map(s => s.category))
      expect(categories.has('select')).toBe(true)
      expect(categories.has('insert')).toBe(true)
      expect(categories.has('update')).toBe(true)
      expect(categories.has('delete')).toBe(true)
      expect(categories.has('create')).toBe(true)
      expect(categories.has('join')).toBe(true)
    })

    it('should mark all built-in snippets as builtin', () => {
      for (const snippet of BUILTIN_SNIPPETS) {
        expect(snippet.isBuiltin).toBe(true)
      }
    })

    it('should have valid snippet body with placeholders', () => {
      for (const snippet of BUILTIN_SNIPPETS) {
        // Body should contain Monaco-style placeholders like ${1:text}
        if (snippet.body.includes('$')) {
          expect(snippet.body).toMatch(/\$\{?\d/)
        }
      }
    })
  })

  describe('getSnippetsForDialect', () => {
    it('should return snippets for postgresql', () => {
      const snippets = getSnippetsForDialect(DatabaseType.PostgreSQL)
      expect(snippets.length).toBeGreaterThan(0)
      // Should include "all" dialect snippets
      const allDialect = snippets.filter(s => s.dialect === 'all')
      expect(allDialect.length).toBeGreaterThan(0)
    })

    it('should return snippets for mysql', () => {
      const snippets = getSnippetsForDialect(DatabaseType.MySQL)
      expect(snippets.length).toBeGreaterThan(0)
    })

    it('should include dialect-specific snippets', () => {
      const pgSnippets = getSnippetsForDialect(DatabaseType.PostgreSQL)
      const pgOnly = pgSnippets.filter(s => s.dialect === DatabaseType.PostgreSQL)
      expect(pgOnly.length).toBeGreaterThan(0)
    })

    it('should not include other dialect snippets', () => {
      const pgSnippets = getSnippetsForDialect(DatabaseType.PostgreSQL)
      const mysqlOnly = pgSnippets.filter(s => s.dialect === DatabaseType.MySQL)
      expect(mysqlOnly.length).toBe(0)
    })

    it('should include custom snippets when provided', () => {
      const custom: SqlSnippet[] = [{
        id: 'custom-1',
        name: 'Custom',
        prefix: 'cust',
        body: 'SELECT custom',
        category: 'custom',
        dialect: 'all'
      }]
      const snippets = getSnippetsForDialect(DatabaseType.PostgreSQL, custom)
      const found = snippets.find(s => s.id === 'custom-1')
      expect(found).toBeTruthy()
    })

    it('should filter custom snippets by dialect', () => {
      const custom: SqlSnippet[] = [{
        id: 'custom-mysql',
        name: 'MySQL Only',
        prefix: 'monly',
        body: 'SELECT mysql_only',
        category: 'custom',
        dialect: DatabaseType.MySQL
      }]
      const pgSnippets = getSnippetsForDialect(DatabaseType.PostgreSQL, custom)
      const found = pgSnippets.find(s => s.id === 'custom-mysql')
      expect(found).toBeUndefined()
    })
  })

  describe('toMonacoSnippet', () => {
    it('should return the snippet body as-is', () => {
      const snippet: SqlSnippet = {
        id: 'test',
        name: 'Test',
        prefix: 'tst',
        body: 'SELECT ${1:column} FROM ${2:table}',
        category: 'select'
      }
      expect(toMonacoSnippet(snippet)).toBe(snippet.body)
    })
  })

  describe('getSnippetCategories', () => {
    it('should return all categories', () => {
      const categories = getSnippetCategories()
      expect(categories.length).toBeGreaterThan(0)
    })

    it('should have value and label for each category', () => {
      const categories = getSnippetCategories()
      for (const cat of categories) {
        expect(cat.value).toBeTruthy()
        expect(cat.label).toBeTruthy()
      }
    })

    it('should include standard SQL categories', () => {
      const categories = getSnippetCategories()
      const values = categories.map(c => c.value)
      expect(values).toContain('select')
      expect(values).toContain('insert')
      expect(values).toContain('update')
      expect(values).toContain('delete')
      expect(values).toContain('create')
      expect(values).toContain('alter')
      expect(values).toContain('join')
      expect(values).toContain('function')
      expect(values).toContain('custom')
    })
  })
})
