import { describe, it, expect } from 'vitest'
import { SQL_KEYWORDS } from '../../../../renderer/lib/sql-completion/sql-keywords'

describe('sql-keywords', () => {
  it('should export a non-empty array of keywords', () => {
    expect(SQL_KEYWORDS.length).toBeGreaterThan(0)
  })

  it('should contain essential DML keywords', () => {
    expect(SQL_KEYWORDS).toContain('SELECT')
    expect(SQL_KEYWORDS).toContain('FROM')
    expect(SQL_KEYWORDS).toContain('WHERE')
    expect(SQL_KEYWORDS).toContain('INSERT INTO')
    expect(SQL_KEYWORDS).toContain('UPDATE')
    expect(SQL_KEYWORDS).toContain('DELETE FROM')
  })

  it('should contain join keywords', () => {
    expect(SQL_KEYWORDS).toContain('JOIN')
    expect(SQL_KEYWORDS).toContain('LEFT JOIN')
    expect(SQL_KEYWORDS).toContain('RIGHT JOIN')
    expect(SQL_KEYWORDS).toContain('INNER JOIN')
    expect(SQL_KEYWORDS).toContain('CROSS JOIN')
    expect(SQL_KEYWORDS).toContain('ON')
  })

  it('should contain clause keywords', () => {
    expect(SQL_KEYWORDS).toContain('ORDER BY')
    expect(SQL_KEYWORDS).toContain('GROUP BY')
    expect(SQL_KEYWORDS).toContain('HAVING')
    expect(SQL_KEYWORDS).toContain('LIMIT')
    expect(SQL_KEYWORDS).toContain('OFFSET')
  })

  it('should contain keywords added in this refactor', () => {
    expect(SQL_KEYWORDS).toContain('RETURNING')
    expect(SQL_KEYWORDS).toContain('WITH')
    expect(SQL_KEYWORDS).toContain('RECURSIVE')
    expect(SQL_KEYWORDS).toContain('OVER')
    expect(SQL_KEYWORDS).toContain('PARTITION BY')
    expect(SQL_KEYWORDS).toContain('WINDOW')
    expect(SQL_KEYWORDS).toContain('FETCH')
    expect(SQL_KEYWORDS).toContain('FOR UPDATE')
  })

  it('should contain DDL keywords', () => {
    expect(SQL_KEYWORDS).toContain('CREATE TABLE')
    expect(SQL_KEYWORDS).toContain('ALTER TABLE')
    expect(SQL_KEYWORDS).toContain('DROP TABLE')
  })

  it('should have no duplicates', () => {
    const unique = new Set(SQL_KEYWORDS)
    expect(unique.size).toBe(SQL_KEYWORDS.length)
  })

  it('should contain all keywords in uppercase', () => {
    for (const keyword of SQL_KEYWORDS) {
      expect(keyword).toBe(keyword.toUpperCase())
    }
  })
})
