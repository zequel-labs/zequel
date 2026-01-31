import { describe, it, expect } from 'vitest'
import { formatCellValue } from '../../../renderer/lib/format'

describe('formatCellValue', () => {
  it('should return "NULL" for null values', () => {
    expect(formatCellValue(null)).toBe('NULL')
  })

  it('should return empty string for undefined values', () => {
    expect(formatCellValue(undefined)).toBe('')
  })

  it('should stringify objects as JSON', () => {
    expect(formatCellValue({ key: 'value' })).toBe('{"key":"value"}')
  })

  it('should stringify arrays as JSON', () => {
    expect(formatCellValue([1, 2, 3])).toBe('[1,2,3]')
  })

  it('should convert numbers to string', () => {
    expect(formatCellValue(42)).toBe('42')
    expect(formatCellValue(3.14)).toBe('3.14')
    expect(formatCellValue(0)).toBe('0')
  })

  it('should convert booleans to string', () => {
    expect(formatCellValue(true)).toBe('true')
    expect(formatCellValue(false)).toBe('false')
  })

  it('should pass through strings', () => {
    expect(formatCellValue('hello')).toBe('hello')
    expect(formatCellValue('')).toBe('')
  })

  it('should format Date objects', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const result = formatCellValue(date)
    // Should be formatted as YYYY-MM-DD HH:mm:ss (exact value depends on timezone)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('should format ISO date strings', () => {
    const result = formatCellValue('2024-01-15T10:30:00Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('should not format non-date strings as dates', () => {
    expect(formatCellValue('hello world')).toBe('hello world')
    expect(formatCellValue('12345')).toBe('12345')
  })

  it('should handle nested objects', () => {
    const nested = { a: { b: { c: 1 } } }
    expect(formatCellValue(nested)).toBe('{"a":{"b":{"c":1}}}')
  })

  it('should handle empty objects', () => {
    expect(formatCellValue({})).toBe('{}')
  })

  it('should handle empty arrays', () => {
    expect(formatCellValue([])).toBe('[]')
  })
})
