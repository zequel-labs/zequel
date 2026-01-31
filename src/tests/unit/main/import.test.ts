import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron before importing anything that uses it
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp/test'
  }
}))

const mockReadFile = vi.fn()
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args)
}))

const mockParseCSV = vi.fn()
vi.mock('csv-parse/sync', () => ({
  parse: (...args: unknown[]) => mockParseCSV(...args)
}))

import {
  detectType,
  flattenObject,
  parseCSVFile,
  parseJSONFile,
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

  describe('parseCSVFile', () => {
    beforeEach(() => {
      mockReadFile.mockReset()
      mockParseCSV.mockReset()
    })

    it('should parse a CSV file with headers', async () => {
      const csvContent = 'name,age,city\nAlice,30,NYC\nBob,25,LA'
      mockReadFile.mockResolvedValue(csvContent)
      mockParseCSV.mockReturnValue([
        { name: 'Alice', age: '30', city: 'NYC' },
        { name: 'Bob', age: '25', city: 'LA' }
      ])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        hasHeaders: true
      }

      const result = await parseCSVFile(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.csv', 'utf-8')
      expect(mockParseCSV).toHaveBeenCalledWith(csvContent, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true
      })
      expect(result.columns).toHaveLength(3)
      expect(result.columns[0].name).toBe('name')
      expect(result.columns[1].name).toBe('age')
      expect(result.columns[2].name).toBe('city')
      expect(result.rows).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.hasHeaders).toBe(true)
    })

    it('should use custom delimiter and encoding', async () => {
      const csvContent = 'name;age\nAlice;30'
      mockReadFile.mockResolvedValue(csvContent)
      mockParseCSV.mockReturnValue([
        { name: 'Alice', age: '30' }
      ])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        delimiter: ';',
        encoding: 'latin1'
      }

      const result = await parseCSVFile(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.csv', 'latin1')
      expect(mockParseCSV).toHaveBeenCalledWith(csvContent, expect.objectContaining({
        delimiter: ';'
      }))
      expect(result.columns).toHaveLength(2)
    })

    it('should handle CSV with hasHeaders set to false', async () => {
      mockReadFile.mockResolvedValue('Alice,30\nBob,25')
      mockParseCSV.mockReturnValue([
        { '0': 'Alice', '1': '30' },
        { '0': 'Bob', '1': '25' }
      ])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        hasHeaders: false
      }

      const result = await parseCSVFile(options)

      expect(mockParseCSV).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        columns: false
      }))
      expect(result.hasHeaders).toBe(false)
      expect(result.columns).toHaveLength(2)
      expect(result.columns[0].name).toBe('0')
      expect(result.columns[1].name).toBe('1')
    })

    it('should generate column names for empty headerless rows', async () => {
      mockReadFile.mockResolvedValue('')
      mockParseCSV.mockReturnValue([{}])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        hasHeaders: false
      }

      const result = await parseCSVFile(options)

      expect(result.columns).toHaveLength(10)
      expect(result.columns[0].name).toBe('column_1')
      expect(result.columns[9].name).toBe('column_10')
    })

    it('should respect previewLimit option', async () => {
      const rows = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `row${i}` }))
      mockReadFile.mockResolvedValue('dummy')
      mockParseCSV.mockReturnValue(rows)

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        previewLimit: 50
      }

      const result = await parseCSVFile(options)

      expect(result.rows).toHaveLength(50)
      expect(result.totalRows).toBe(200)
    })

    it('should default previewLimit to 100', async () => {
      const rows = Array.from({ length: 150 }, (_, i) => ({ id: String(i) }))
      mockReadFile.mockResolvedValue('dummy')
      mockParseCSV.mockReturnValue(rows)

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv'
      }

      const result = await parseCSVFile(options)

      expect(result.rows).toHaveLength(100)
      expect(result.totalRows).toBe(150)
    })

    it('should detect column types from sample values', async () => {
      mockReadFile.mockResolvedValue('dummy')
      mockParseCSV.mockReturnValue([
        { id: '1', price: '9.99', active: 'true' },
        { id: '2', price: '19.99', active: 'false' },
        { id: '3', price: '29.99', active: 'true' }
      ])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv'
      }

      const result = await parseCSVFile(options)

      expect(result.columns.find((c) => c.name === 'id')?.detectedType).toBe('INTEGER')
      expect(result.columns.find((c) => c.name === 'price')?.detectedType).toBe('DECIMAL')
      expect(result.columns.find((c) => c.name === 'active')?.detectedType).toBe('BOOLEAN')
    })
  })

  describe('parseJSONFile', () => {
    beforeEach(() => {
      mockReadFile.mockReset()
    })

    it('should parse a JSON array file', async () => {
      const jsonData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.json', 'utf-8')
      expect(result.columns).toHaveLength(2)
      expect(result.columns.map((c) => c.name)).toContain('name')
      expect(result.columns.map((c) => c.name)).toContain('age')
      expect(result.rows).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.hasHeaders).toBe(true)
    })

    it('should find array property in JSON object', async () => {
      const jsonData = {
        metadata: { count: 2 },
        results: [
          { id: 1, value: 'a' },
          { id: 2, value: 'b' }
        ]
      }
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(result.rows).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.columns.map((c) => c.name)).toContain('id')
      expect(result.columns.map((c) => c.name)).toContain('value')
    })

    it('should wrap single object in array', async () => {
      const jsonData = { name: 'Alice', age: 30 }
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(result.rows).toHaveLength(1)
      expect(result.totalRows).toBe(1)
      expect(result.columns.map((c) => c.name)).toContain('name')
      expect(result.columns.map((c) => c.name)).toContain('age')
    })

    it('should throw for non-object/non-array JSON', async () => {
      mockReadFile.mockResolvedValue('"just a string"')

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      await expect(parseJSONFile(options)).rejects.toThrow('JSON file must contain an array or object')
    })

    it('should throw for null JSON value', async () => {
      mockReadFile.mockResolvedValue('null')

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      await expect(parseJSONFile(options)).rejects.toThrow('JSON file must contain an array or object')
    })

    it('should flatten nested objects in JSON records', async () => {
      const jsonData = [
        { name: 'Alice', address: { city: 'NYC', zip: '10001' } },
        { name: 'Bob', address: { city: 'LA', zip: '90001' } }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(result.columns.map((c) => c.name)).toContain('address.city')
      expect(result.columns.map((c) => c.name)).toContain('address.zip')
      expect(result.rows[0]['address.city']).toBe('NYC')
    })

    it('should use custom encoding', async () => {
      const jsonData = [{ id: 1 }]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json',
        encoding: 'ascii'
      }

      await parseJSONFile(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.json', 'ascii')
    })

    it('should respect previewLimit for JSON', async () => {
      const jsonData = Array.from({ length: 200 }, (_, i) => ({ id: i }))
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json',
        previewLimit: 30
      }

      const result = await parseJSONFile(options)

      expect(result.rows).toHaveLength(30)
      expect(result.totalRows).toBe(200)
    })

    it('should collect all unique column names across records', async () => {
      const jsonData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', email: 'bob@test.com' }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(result.columns.map((c) => c.name)).toContain('name')
      expect(result.columns.map((c) => c.name)).toContain('age')
      expect(result.columns.map((c) => c.name)).toContain('email')
      expect(result.columns).toHaveLength(3)
    })

    it('should detect column types from JSON sample values', async () => {
      const jsonData = [
        { id: 1, date: '2024-01-01', active: true },
        { id: 2, date: '2024-06-15', active: false }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await parseJSONFile(options)

      expect(result.columns.find((c) => c.name === 'id')?.detectedType).toBe('INTEGER')
      expect(result.columns.find((c) => c.name === 'date')?.detectedType).toBe('DATE')
    })

    it('should throw for number JSON value', async () => {
      mockReadFile.mockResolvedValue('42')

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      await expect(parseJSONFile(options)).rejects.toThrow('JSON file must contain an array or object')
    })
  })

  describe('readImportData', () => {
    beforeEach(() => {
      mockReadFile.mockReset()
      mockParseCSV.mockReset()
    })

    it('should read CSV data with default options', async () => {
      const csvContent = 'name,age\nAlice,30\nBob,25'
      const parsedRows = [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' }
      ]
      mockReadFile.mockResolvedValue(csvContent)
      mockParseCSV.mockReturnValue(parsedRows)

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv'
      }

      const result = await readImportData(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.csv', 'utf-8')
      expect(mockParseCSV).toHaveBeenCalledWith(csvContent, {
        delimiter: ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true
      })
      expect(result).toEqual(parsedRows)
    })

    it('should read CSV data with custom delimiter and encoding', async () => {
      const csvContent = 'name\tage\nAlice\t30'
      mockReadFile.mockResolvedValue(csvContent)
      mockParseCSV.mockReturnValue([{ name: 'Alice', age: '30' }])

      const options: ImportOptions = {
        filePath: '/tmp/test.tsv',
        format: 'csv',
        delimiter: '\t',
        encoding: 'utf-16le'
      }

      const result = await readImportData(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.tsv', 'utf-16le')
      expect(mockParseCSV).toHaveBeenCalledWith(csvContent, expect.objectContaining({
        delimiter: '\t'
      }))
      expect(result).toHaveLength(1)
    })

    it('should read CSV data without headers', async () => {
      mockReadFile.mockResolvedValue('Alice,30')
      mockParseCSV.mockReturnValue([{ '0': 'Alice', '1': '30' }])

      const options: ImportOptions = {
        filePath: '/tmp/test.csv',
        format: 'csv',
        hasHeaders: false
      }

      const result = await readImportData(options)

      expect(mockParseCSV).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        columns: false
      }))
      expect(result).toHaveLength(1)
    })

    it('should read JSON array data', async () => {
      const jsonData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await readImportData(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.json', 'utf-8')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ name: 'Alice', age: 30 })
    })

    it('should read JSON object with array property', async () => {
      const jsonData = {
        total: 2,
        items: [
          { id: 1, name: 'A' },
          { id: 2, name: 'B' }
        ]
      }
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await readImportData(options)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ id: 1, name: 'A' })
    })

    it('should wrap single JSON object in array', async () => {
      const jsonData = { name: 'Alice', age: 30 }
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await readImportData(options)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ name: 'Alice', age: 30 })
    })

    it('should throw for non-object/non-array JSON in readImportData', async () => {
      mockReadFile.mockResolvedValue('"just a string"')

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      await expect(readImportData(options)).rejects.toThrow('JSON file must contain an array or object')
    })

    it('should flatten nested objects in JSON readImportData', async () => {
      const jsonData = [
        { name: 'Alice', meta: { role: 'admin' } }
      ]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json'
      }

      const result = await readImportData(options)

      expect(result[0]).toEqual({ name: 'Alice', 'meta.role': 'admin' })
    })

    it('should throw for unsupported format', async () => {
      const options = {
        filePath: '/tmp/test.xml',
        format: 'xml' as 'csv' | 'json'
      }

      await expect(readImportData(options)).rejects.toThrow('Unsupported import format: xml')
    })

    it('should use custom encoding for JSON readImportData', async () => {
      const jsonData = [{ id: 1 }]
      mockReadFile.mockResolvedValue(JSON.stringify(jsonData))

      const options: ImportOptions = {
        filePath: '/tmp/test.json',
        format: 'json',
        encoding: 'latin1'
      }

      await readImportData(options)

      expect(mockReadFile).toHaveBeenCalledWith('/tmp/test.json', 'latin1')
    })
  })
})
