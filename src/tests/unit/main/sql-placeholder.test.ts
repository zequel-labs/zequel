import { describe, it, expect } from 'vitest'
import { replacePlaceholders } from '@main/db/sql-placeholder'

describe('replacePlaceholders', () => {
  it('should replace ? with @p0, @p1, etc.', () => {
    expect(replacePlaceholders('SELECT * FROM t WHERE a = ? AND b = ?'))
      .toBe('SELECT * FROM t WHERE a = @p0 AND b = @p1')
  })

  it('should return sql unchanged when no placeholders', () => {
    expect(replacePlaceholders('SELECT 1')).toBe('SELECT 1')
  })

  it('should skip ? inside single-quoted strings', () => {
    expect(replacePlaceholders("SELECT * FROM t WHERE a = '?' AND b = ?"))
      .toBe("SELECT * FROM t WHERE a = '?' AND b = @p0")
  })

  it('should handle escaped single quotes (T-SQL style)', () => {
    expect(replacePlaceholders("SELECT * FROM t WHERE name = 'O''Brien' AND id = ?"))
      .toBe("SELECT * FROM t WHERE name = 'O''Brien' AND id = @p0")
  })

  it('should handle multiple escaped quotes in a string', () => {
    expect(replacePlaceholders("SELECT 'it''s a ''test''' WHERE id = ?"))
      .toBe("SELECT 'it''s a ''test''' WHERE id = @p0")
  })

  it('should skip ? inside line comments', () => {
    expect(replacePlaceholders('SELECT 1 -- is this a ?\nWHERE id = ?'))
      .toBe('SELECT 1 -- is this a ?\nWHERE id = @p0')
  })

  it('should skip ? inside block comments', () => {
    expect(replacePlaceholders('SELECT /* ? */ 1 WHERE id = ?'))
      .toBe('SELECT /* ? */ 1 WHERE id = @p0')
  })

  it('should handle block comment spanning lines', () => {
    expect(replacePlaceholders('SELECT /*\n?\n*/ 1 WHERE id = ?'))
      .toBe('SELECT /*\n?\n*/ 1 WHERE id = @p0')
  })

  it('should handle empty string', () => {
    expect(replacePlaceholders('')).toBe('')
  })

  it('should handle adjacent quoted strings', () => {
    expect(replacePlaceholders("SELECT '?' + '?' WHERE id = ?"))
      .toBe("SELECT '?' + '?' WHERE id = @p0")
  })

  it('should handle string ending with escaped quote before placeholder', () => {
    expect(replacePlaceholders("WHERE name = 'test''' AND id = ?"))
      .toBe("WHERE name = 'test''' AND id = @p0")
  })
})
