import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cn,
  formatBytes,
  formatNumber,
  formatDuration,
  generateId,
  truncate,
  sanitizeName,
  getEntityIcon,
  debounce,
  copyToClipboard,
  toPlainObject
} from '@/lib/utils'

describe('Utility Functions', () => {
  describe('cn (classnames)', () => {
    it('should join class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should filter out falsy values', () => {
      expect(cn('foo', false && 'hidden', 'bar', null, undefined)).toBe('foo bar')
    })

    it('should return empty string for no inputs', () => {
      expect(cn()).toBe('')
    })

    it('should merge tailwind classes', () => {
      // twMerge should resolve conflicting tailwind classes
      const result = cn('px-2', 'px-4')
      expect(result).toBe('px-4')
    })
  })

  describe('generateId', () => {
    it('should generate a string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100)
    })

    it('should generate IDs of reasonable length', () => {
      const id = generateId()
      expect(id.length).toBeGreaterThan(5)
    })
  })

  describe('formatDuration', () => {
    it('should format milliseconds', () => {
      expect(formatDuration(500)).toBe('500ms')
    })

    it('should format seconds', () => {
      expect(formatDuration(2500)).toBe('2.50s')
    })

    it('should format minutes', () => {
      expect(formatDuration(90000)).toBe('1.50m')
    })
  })

  describe('formatNumber', () => {
    it('should format small numbers', () => {
      expect(formatNumber(100)).toMatch(/100/)
    })

    it('should format large numbers with separators', () => {
      const formatted = formatNumber(1000000)
      expect(formatted.length).toBeGreaterThan(6)
    })
  })

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello')
    })

    it('should truncate long strings', () => {
      const result = truncate('hello world this is a long string', 15)
      expect(result.length).toBe(18) // 15 + '...'
      expect(result).toMatch(/\.\.\.$/)
    })

    it('should handle exact length', () => {
      expect(truncate('hello', 5)).toBe('hello')
    })
  })

  describe('formatBytes', () => {
    it('should format zero bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B')
    })

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB')
    })

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB')
    })

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB')
    })

    it('should format with decimal precision', () => {
      expect(formatBytes(1536)).toBe('1.5 KB')
    })
  })

  describe('sanitizeName', () => {
    it('should replace spaces with underscores', () => {
      expect(sanitizeName('my table name')).toBe('my_table_name')
    })

    it('should handle strings with multiple spaces', () => {
      expect(sanitizeName('a  b  c')).toBe('a__b__c')
    })

    it('should handle strings with tabs and newlines', () => {
      expect(sanitizeName('col\tname\nnew')).toBe('col_name_new')
    })

    it('should handle number input', () => {
      expect(sanitizeName(123)).toBe('123')
    })

    it('should return same string when no spaces', () => {
      expect(sanitizeName('no_spaces')).toBe('no_spaces')
    })
  })

  describe('getEntityIcon', () => {
    it('should return correct icon info for "table"', () => {
      const info = getEntityIcon('table')
      expect(info.color).toBe('text-blue-500')
    })

    it('should return correct icon info for "view"', () => {
      const info = getEntityIcon('view')
      expect(info.color).toBe('text-purple-500')
    })

    it('should return fallback (table) icon info for unknown entity type', () => {
      const info = getEntityIcon('nonexistent_type')
      // Falls back to entityIconMap.table
      expect(info.color).toBe('text-blue-500')
    })

    it('should return fallback for empty string entity type', () => {
      const info = getEntityIcon('')
      expect(info.color).toBe('text-blue-500')
    })
  })

  describe('copyToClipboard', () => {
    const writeTextMock = vi.fn()

    beforeEach(() => {
      vi.clearAllMocks()
      // navigator may be a getter-only global in this runtime — define it instead of assigning.
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: writeTextMock } },
        configurable: true,
        writable: true,
      })
    })

    it('should copy text and return true on success', async () => {
      writeTextMock.mockResolvedValue(undefined)
      const result = await copyToClipboard('hello', 'Copied!')
      expect(writeTextMock).toHaveBeenCalledWith('hello')
      expect(result).toBe(true)
    })

    it('should return false when clipboard write fails', async () => {
      writeTextMock.mockRejectedValue(new Error('Permission denied'))
      const result = await copyToClipboard('hello')
      expect(result).toBe(false)
    })

    it('should copy empty string', async () => {
      writeTextMock.mockResolvedValue(undefined)
      const result = await copyToClipboard('')
      expect(writeTextMock).toHaveBeenCalledWith('')
      expect(result).toBe(true)
    })

    it('should handle special characters', async () => {
      writeTextMock.mockResolvedValue(undefined)
      const text = 'SELECT * FROM "users" WHERE name = \'John\' AND age > 30;'
      const result = await copyToClipboard(text)
      expect(writeTextMock).toHaveBeenCalledWith(text)
      expect(result).toBe(true)
    })
  })

  describe('toPlainObject', () => {
    it('should deep clone a plain object', () => {
      const obj = { a: 1, b: { c: 2 } }
      const result = toPlainObject(obj)
      expect(result).toEqual(obj)
      expect(result).not.toBe(obj)
      expect(result.b).not.toBe(obj.b)
    })

    it('should convert BigInt to string', () => {
      const obj = { value: BigInt(42) }
      const result = toPlainObject(obj)
      expect(result).toEqual({ value: '42' })
    })

    it('should handle arrays', () => {
      const arr = [{ id: 1 }, { id: 2 }]
      const result = toPlainObject(arr)
      expect(result).toEqual(arr)
      expect(result).not.toBe(arr)
    })

    it('should handle nested BigInt values', () => {
      const obj = { rows: [{ count: BigInt(1000) }] }
      const result = toPlainObject(obj)
      expect(result).toEqual({ rows: [{ count: '1000' }] })
    })

    it('should strip undefined values (JSON serialization)', () => {
      const obj = { a: 1, b: undefined }
      const result = toPlainObject(obj)
      expect(result).toEqual({ a: 1 })
      expect('b' in result).toBe(false)
    })

    it('should handle null values', () => {
      const obj = { a: null, b: 'test' }
      const result = toPlainObject(obj)
      expect(result).toEqual({ a: null, b: 'test' })
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      debounced()
      debounced()

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('should pass arguments to debounced function', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, 50)

      debounced('hello', 42)
      vi.advanceTimersByTime(50)

      expect(fn).toHaveBeenCalledWith('hello', 42)
      vi.useRealTimers()
    })

    it('should reset timer on subsequent calls', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      vi.advanceTimersByTime(80)
      debounced() // Reset timer
      vi.advanceTimersByTime(80)
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(20)
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })
})
