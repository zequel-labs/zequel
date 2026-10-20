import { describe, expect, it } from 'vitest'
import { parseClipboardRows } from '@/lib/clipboardRows'

describe('clipboard rows', () => {
  it('preserves quoted newlines, quotes, accents, empty strings and exact numbers', () => {
    expect(parseClipboardRows('id,name,notes\n9007199254740993,"João, ""A""","line 1\nline 2"\n2,,NULL', ['id', 'name', 'notes'])).toEqual([
      { id: '9007199254740993', name: 'João, "A"', notes: 'line 1\nline 2' },
      { id: '2', name: '', notes: 'NULL' },
    ])
  })
  it('accepts TSV and excludes columns the grid cannot write', () => {
    expect(parseClipboardRows('_id\tname\n123\t Alice ', ['name'])).toEqual([{ name: ' Alice ' }])
  })
  it('rejects malformed rows and duplicate headers before staging any changes', () => {
    expect(() => parseClipboardRows('name,name\nA,B', ['name'])).toThrow('duplicate')
    expect(() => parseClipboardRows('id,name\n1,A,extra', ['id', 'name'])).toThrow()
    expect(() => parseClipboardRows('name\n"unterminated', ['name'])).toThrow()
  })
})
