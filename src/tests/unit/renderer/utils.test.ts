import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  formatBytes,
  formatNumber,
  formatDuration,
  generateId,
  truncate,
  debounce
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
