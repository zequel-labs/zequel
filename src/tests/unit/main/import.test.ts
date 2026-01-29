import { describe, it, expect, vi } from 'vitest'

// Mock electron before importing anything that uses it
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp/test'
  }
}))

import { detectType, flattenObject } from '@main/services/import'

describe('Import Service', () => {
  describe('detectType', () => {
    it('should detect INTEGER type', () => {
      expect(detectType([1, 2, 3, 42])).toBe('INTEGER')
      expect(detectType(['1', '2', '3'])).toBe('INTEGER')
    })

    it('should detect BIGINT for large integers', () => {
      expect(detectType([9999999999, 1234567890123])).toBe('BIGINT')
    })

    it('should detect DECIMAL type', () => {
      expect(detectType([1.5, 2.3, 3.14])).toBe('DECIMAL')
      expect(detectType(['1.5', '2.3'])).toBe('DECIMAL')
    })

    it('should detect BOOLEAN type', () => {
      expect(detectType(['true', 'false', 'true'])).toBe('BOOLEAN')
      expect(detectType(['yes', 'no'])).toBe('BOOLEAN')
      // '0' and '1' are detected as INTEGER since numbers are checked first
      expect(detectType(['0', '1', '1'])).toBe('INTEGER')
    })

    it('should detect VARCHAR for short strings', () => {
      expect(detectType(['hello', 'world'])).toBe('VARCHAR(255)')
    })

    it('should detect TEXT for long strings', () => {
      const longString = 'a'.repeat(300)
      expect(detectType([longString])).toBe('TEXT')
    })

    it('should return TEXT for empty values', () => {
      expect(detectType([])).toBe('TEXT')
      expect(detectType([null, undefined, ''])).toBe('TEXT')
    })

    it('should handle mixed types', () => {
      const result = detectType(['hello', '123', 'world'])
      expect(result).toBe('VARCHAR(255)')
    })

    it('should detect DATE type', () => {
      expect(detectType(['2024-01-01', '2024-12-31'])).toBe('DATE')
    })

    it('should detect TIMESTAMP type', () => {
      expect(detectType(['2024-01-01T00:00:00', '2024-12-31T23:59:59'])).toBe('TIMESTAMP')
    })

    it('should detect UUID type', () => {
      expect(detectType(['550e8400-e29b-41d4-a716-446655440000'])).toBe('UUID')
    })

    it('should detect JSON type', () => {
      expect(detectType(['{"key": "value"}', '{"a": 1}'])).toBe('JSON')
    })
  })

  describe('flattenObject', () => {
    it('should flatten nested objects', () => {
      const obj = { a: { b: { c: 1 } } }
      const result = flattenObject(obj)
      expect(result).toEqual({ 'a.b.c': 1 })
    })

    it('should handle flat objects', () => {
      const obj = { a: 1, b: 'hello' }
      const result = flattenObject(obj)
      expect(result).toEqual({ a: 1, b: 'hello' })
    })

    it('should stringify arrays as values', () => {
      const obj = { a: [1, 2, 3] }
      const result = flattenObject(obj)
      expect(result.a).toBe('[1,2,3]')
    })

    it('should handle null values', () => {
      const obj = { a: null, b: 1 }
      const result = flattenObject(obj)
      expect(result).toEqual({ a: null, b: 1 })
    })

    it('should handle deeply nested objects', () => {
      const obj = { level1: { level2: { level3: { value: 'deep' } } } }
      const result = flattenObject(obj)
      expect(result).toEqual({ 'level1.level2.level3.value': 'deep' })
    })

    it('should handle mixed nesting', () => {
      const obj = { a: 1, b: { c: 2, d: { e: 3 } } }
      const result = flattenObject(obj)
      expect(result).toEqual({ a: 1, 'b.c': 2, 'b.d.e': 3 })
    })
  })
})
