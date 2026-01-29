import { describe, it, expect } from 'vitest'

// Test export functionality
describe('Export Functions', () => {
  interface ExportColumn {
    name: string
    type: string
  }

  interface ExportRow {
    [key: string]: unknown
  }

  function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  function escapeCSVField(value: string, delimiter: string): string {
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  function exportToCSV(
    columns: ExportColumn[],
    rows: ExportRow[],
    delimiter = ',',
    includeHeaders = true
  ): string {
    const lines: string[] = []

    if (includeHeaders) {
      const headers = columns.map((col) => escapeCSVField(col.name, delimiter))
      lines.push(headers.join(delimiter))
    }

    for (const row of rows) {
      const values = columns.map((col) => {
        const value = formatValue(row[col.name])
        return escapeCSVField(value, delimiter)
      })
      lines.push(values.join(delimiter))
    }

    return lines.join('\n')
  }

  function exportToJSON(columns: ExportColumn[], rows: ExportRow[]): string {
    const cleanRows = rows.map((row) => {
      const cleanRow: Record<string, unknown> = {}
      for (const col of columns) {
        cleanRow[col.name] = row[col.name]
      }
      return cleanRow
    })
    return JSON.stringify(cleanRows, null, 2)
  }

  function exportToSQL(columns: ExportColumn[], rows: ExportRow[], tableName: string): string {
    const lines: string[] = []

    for (const row of rows) {
      const columnNames = columns.map((col) => `"${col.name}"`).join(', ')
      const values = columns
        .map((col) => {
          const value = row[col.name]
          if (value === null || value === undefined) {
            return 'NULL'
          }
          if (typeof value === 'number') {
            return String(value)
          }
          if (typeof value === 'boolean') {
            return value ? '1' : '0'
          }
          const strValue = String(value).replace(/'/g, "''")
          return `'${strValue}'`
        })
        .join(', ')

      lines.push(`INSERT INTO "${tableName}" (${columnNames}) VALUES (${values});`)
    }

    return lines.join('\n')
  }

  const testColumns: ExportColumn[] = [
    { name: 'id', type: 'integer' },
    { name: 'name', type: 'text' },
    { name: 'active', type: 'boolean' }
  ]

  const testRows: ExportRow[] = [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob', active: false },
    { id: 3, name: "O'Brien", active: true }
  ]

  describe('CSV Export', () => {
    it('should include headers by default', () => {
      const csv = exportToCSV(testColumns, testRows)
      const lines = csv.split('\n')
      expect(lines[0]).toBe('id,name,active')
    })

    it('should export data rows', () => {
      const csv = exportToCSV(testColumns, testRows)
      const lines = csv.split('\n')
      expect(lines.length).toBe(4) // header + 3 rows
      expect(lines[1]).toBe('1,Alice,true')
    })

    it('should handle custom delimiter', () => {
      const csv = exportToCSV(testColumns, testRows, ';')
      const lines = csv.split('\n')
      expect(lines[0]).toBe('id;name;active')
    })

    it('should exclude headers when requested', () => {
      const csv = exportToCSV(testColumns, testRows, ',', false)
      const lines = csv.split('\n')
      expect(lines.length).toBe(3) // no header, just 3 rows
    })

    it('should escape quotes in values', () => {
      const rowsWithQuotes: ExportRow[] = [{ id: 1, name: 'Test "quoted"', active: true }]
      const csv = exportToCSV(testColumns, rowsWithQuotes)
      expect(csv).toContain('"Test ""quoted"""')
    })

    it('should handle null values', () => {
      const rowsWithNull: ExportRow[] = [{ id: 1, name: null, active: true }]
      const csv = exportToCSV(testColumns, rowsWithNull)
      expect(csv).toContain('1,,true')
    })
  })

  describe('JSON Export', () => {
    it('should export valid JSON', () => {
      const json = exportToJSON(testColumns, testRows)
      expect(() => JSON.parse(json)).not.toThrow()
    })

    it('should export array of objects', () => {
      const json = exportToJSON(testColumns, testRows)
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed.length).toBe(3)
    })

    it('should include all columns', () => {
      const json = exportToJSON(testColumns, testRows)
      const parsed = JSON.parse(json)
      expect(parsed[0]).toHaveProperty('id')
      expect(parsed[0]).toHaveProperty('name')
      expect(parsed[0]).toHaveProperty('active')
    })
  })

  describe('SQL Export', () => {
    it('should generate INSERT statements', () => {
      const sql = exportToSQL(testColumns, testRows, 'users')
      const lines = sql.split('\n')
      expect(lines.length).toBe(3)
      expect(lines[0]).toContain('INSERT INTO "users"')
    })

    it('should escape single quotes', () => {
      const sql = exportToSQL(testColumns, testRows, 'users')
      expect(sql).toContain("'O''Brien'")
    })

    it('should handle numbers correctly', () => {
      const sql = exportToSQL(testColumns, testRows, 'users')
      expect(sql).toMatch(/VALUES \(1,/)
    })

    it('should handle booleans as numbers', () => {
      const sql = exportToSQL(testColumns, testRows, 'users')
      expect(sql).toContain(', 1);') // true as 1
      expect(sql).toContain(', 0);') // false as 0
    })

    it('should handle NULL values', () => {
      const rowsWithNull: ExportRow[] = [{ id: 1, name: null, active: true }]
      const sql = exportToSQL(testColumns, rowsWithNull, 'users')
      expect(sql).toContain('NULL')
    })
  })
})
