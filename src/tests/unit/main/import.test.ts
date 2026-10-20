import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron before importing anything that uses it
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp/test'
  }
}))

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  detectType,
  flattenObject,
  parseCSVFile,
  parseJSONFile,
  streamImportData,
  readImportData
} from '@main/services/import'
import type { ImportOptions } from '@main/services/import'

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
      expect(result).toEqual({ a: '{"b":{"c":1}}', 'a.b.c': 1 })
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
      expect(result).toEqual({ level1: '{"level2":{"level3":{"value":"deep"}}}', 'level1.level2.level3.value': 'deep' })
    })

    it('should handle mixed nesting', () => {
      const obj = { a: 1, b: { c: 2, d: { e: 3 } } }
      const result = flattenObject(obj)
      expect(result).toEqual({ a: 1, b: '{"c":2,"d":{"e":3}}', 'b.c': 2, 'b.d.e': 3 })
    })

    it('keeps each top-level object whole for JSON columns, including empty objects', () => {
      expect(flattenObject({ doc: { a: [1, 'x'] }, empty: {} })).toEqual({ doc: '{"a":[1,"x"]}', 'doc.a': '[1,"x"]', empty: '{}' })
    })
  })

})

describe('streaming import files', () => {
  let directory: string
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'zequel-import-')) })
  afterEach(async () => { await rm(directory, { recursive: true, force: true }) })
  const fixture = async (content: string, format: 'csv' | 'json' = 'csv'): Promise<ImportOptions> => {
    const filePath = join(directory, `input.${format}`)
    await writeFile(filePath, content)
    return { filePath, format }
  }

  it('preserves multiline CSV, quotes, empty strings and numeric precision', async () => {
    const options = await fixture('id,note,empty\n9007199254740993,"hello\n""world""",\n')
    expect(await readImportData(options)).toEqual([{ id: '9007199254740993', note: 'hello\n"world"', empty: '' }])
  })
  it('reports unknown total for a sampled preview and releases the stream', async () => {
    const options = await fixture('id\n' + Array.from({ length: 10000 }, (_, i) => i).join('\n'))
    const preview = await parseCSVFile({ ...options, previewLimit: 10 })
    expect(preview.rows).toHaveLength(10)
    expect(preview.totalRows).toBeNull()
  })
  it('distinguishes NULL markers, literal markers and empty strings', async () => {
    const input = await fixture('missing,literal,empty,text\n\\N,"\\N",,NULL\n')
    expect(await readImportData(input)).toEqual([{ missing: null, literal: '\\N', empty: '', text: 'NULL' }])
    expect((await readImportData({ ...input, nullToken: '' }))[0].missing).toBe('\\N')
  })
  it('reports exact totals when the entire file fits in the sample', async () => {
    expect((await parseCSVFile(await fixture('name;age\nAlice;30'),)).totalRows).toBe(1)
    expect(await readImportData({ ...await fixture('Alice;30'), hasHeaders: false, delimiter: ';' })).toEqual([{ 0: 'Alice', 1: '30' }])
  })
  it('rejects duplicate headers and malformed quoting', async () => {
    await expect(readImportData(await fixture('id,id\n1,2'))).rejects.toThrow('Duplicate')
    await expect(readImportData(await fixture('id,note\n1,"unterminated'))).rejects.toThrow()
  })
  it('keeps exact JSON numbers including nested numeric arrays', async () => {
    const options = await fixture('[{"id":9007199254740993,"price":0.1234567890123456789,"values":[9007199254740993]}]', 'json')
    expect(await readImportData(options)).toEqual([{ id: '9007199254740993', price: '0.1234567890123456789', values: '[9007199254740993]' }])
  })
  it('imports nested JSON documents without losing exact numbers', async () => {
    expect(await readImportData(await fixture('[{"doc":{"n":9007199254740993,"tags":["a"]}}]', 'json'))).toEqual([{ doc: '{"n":9007199254740993,"tags":["a"]}', 'doc.n': '9007199254740993', 'doc.tags': '["a"]' }])
  })
  it('supports wrapper arrays and standalone objects', async () => {
    expect(await readImportData(await fixture('{"count":2,"rows":[{"id":1},{"id":2}],"next":null}', 'json'))).toEqual([{ id: '1' }, { id: '2' }])
    expect((await parseJSONFile(await fixture('{"name":"Alice","address":{"city":"São Paulo"}}', 'json'))).rows).toEqual([{ name: 'Alice', address: '{"city":"São Paulo"}', 'address.city': 'São Paulo' }])
  })
  it('rejects incomplete JSON and scalar records', async () => {
    await expect(readImportData(await fixture('[{"id":1}', 'json'))).rejects.toThrow()
    await expect(readImportData(await fixture('[1,2]', 'json'))).rejects.toThrow('object')
  })
  it('supports cancellation before reading', async () => {
    const controller = new AbortController()
    controller.abort()
    const options = await fixture('id\n1')
    await expect((async () => { for await (const _row of streamImportData(options, controller.signal)) { /* drain */ } })()).rejects.toThrow()
  })
  it('keeps __proto__ as data without changing prototypes', async () => {
    const rows = await readImportData(await fixture('[{"__proto__":"safe","id":1}]', 'json'))
    expect(Object.getPrototypeOf(rows[0])).toBe(Object.prototype)
    expect(Object.hasOwn(rows[0], '__proto__')).toBe(true)
  })
})
