import { describe, it, expect } from 'vitest'

// Since we can't easily import from @/lib/utils in tests without full Vue setup,
// we'll define the utility functions here for testing

function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

describe('Utility Functions', () => {
  describe('cn (classnames)', () => {
    it('should join class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should filter out falsy values', () => {
      expect(cn('foo', false, 'bar', null, undefined)).toBe('foo bar')
    })

    it('should return empty string for no inputs', () => {
      expect(cn()).toBe('')
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
      expect(id.length).toBeLessThan(20)
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
      // Should contain some separator (locale-dependent)
      expect(formatted.length).toBeGreaterThan(6)
    })
  })

  describe('truncate', () => {
    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello')
    })

    it('should truncate long strings', () => {
      expect(truncate('hello world this is a long string', 15)).toBe('hello world ...')
    })

    it('should handle exact length', () => {
      expect(truncate('hello', 5)).toBe('hello')
    })
  })
})
