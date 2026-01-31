import { readFile } from 'fs/promises'
import { parse as parseCSV } from 'csv-parse/sync'
import { logger } from '../utils/logger'

export interface ImportColumn {
  name: string
  sampleValues: unknown[]
  detectedType: string
}

export interface ImportPreview {
  columns: ImportColumn[]
  rows: Record<string, unknown>[]
  totalRows: number
  hasHeaders: boolean
}

export interface ColumnMapping {
  sourceColumn: string
  targetColumn: string
  targetType: string
}

export interface ImportOptions {
  filePath: string
  format: 'csv' | 'json'
  hasHeaders?: boolean
  delimiter?: string
  encoding?: BufferEncoding
  previewLimit?: number
}

export interface ImportDataOptions {
  connectionId: string
  tableName: string
  data: Record<string, unknown>[]
  columnMappings: ColumnMapping[]
  createTableIfNotExists?: boolean
  truncateTable?: boolean
}

/**
 * Detect the data type from sample values
 */
export const detectType = (values: unknown[]): string => {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '')

  if (nonNullValues.length === 0) {
    return 'TEXT'
  }

  // Check if all values are numbers
  const allNumbers = nonNullValues.every((v) => {
    const num = Number(v)
    return !isNaN(num) && isFinite(num)
  })

  if (allNumbers) {
    // Check if integers or floats
    const allIntegers = nonNullValues.every((v) => {
      const num = Number(v)
      return Number.isInteger(num)
    })

    if (allIntegers) {
      const maxVal = Math.max(...nonNullValues.map((v) => Math.abs(Number(v))))
      if (maxVal > 2147483647) {
        return 'BIGINT'
      }
      return 'INTEGER'
    }

    return 'DECIMAL'
  }

  // Check if all values are booleans
  const booleanValues = ['true', 'false', '1', '0', 'yes', 'no']
  const allBooleans = nonNullValues.every((v) =>
    booleanValues.includes(String(v).toLowerCase())
  )

  if (allBooleans) {
    return 'BOOLEAN'
  }

  // Check if all values are dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const allDates = nonNullValues.every((v) => dateRegex.test(String(v)))

  if (allDates) {
    return 'DATE'
  }

  // Check if all values are datetimes
  const datetimeRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/
  const allDatetimes = nonNullValues.every((v) => datetimeRegex.test(String(v)))

  if (allDatetimes) {
    return 'TIMESTAMP'
  }

  // Check if all values are UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const allUuids = nonNullValues.every((v) => uuidRegex.test(String(v)))

  if (allUuids) {
    return 'UUID'
  }

  // Check if JSON
  const allJson = nonNullValues.every((v) => {
    try {
      const parsed = JSON.parse(String(v))
      return typeof parsed === 'object'
    } catch {
      return false
    }
  })

  if (allJson) {
    return 'JSON'
  }

  // Default to text with length estimation
  const maxLength = Math.max(...nonNullValues.map((v) => String(v).length))

  if (maxLength <= 255) {
    return 'VARCHAR(255)'
  }

  return 'TEXT'
}

/**
 * Parse CSV file and return preview data
 */
export const parseCSVFile = async (options: ImportOptions): Promise<ImportPreview> => {
  logger.debug('Parsing CSV file', { filePath: options.filePath })

  const content = await readFile(options.filePath, options.encoding || 'utf-8')
  const delimiter = options.delimiter || ','

  const records = parseCSV(content, {
    delimiter,
    columns: options.hasHeaders !== false, // Default to true
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true
  }) as Record<string, unknown>[]

  const previewLimit = options.previewLimit || 100
  const previewRows = records.slice(0, previewLimit)
  const totalRows = records.length

  // Get column names
  let columnNames: string[]
  if (options.hasHeaders !== false && previewRows.length > 0) {
    columnNames = Object.keys(previewRows[0])
  } else {
    // Generate column names for headerless files
    const firstRow = previewRows[0] || {}
    columnNames = Object.keys(firstRow).length > 0
      ? Object.keys(firstRow)
      : Array.from({ length: 10 }, (_, i) => `column_${i + 1}`)
  }

  // Build column info with sample values and detected types
  const columns: ImportColumn[] = columnNames.map((name) => {
    const sampleValues = previewRows.slice(0, 10).map((row) => row[name])
    const detectedType = detectType(sampleValues)

    return {
      name,
      sampleValues,
      detectedType
    }
  })

  return {
    columns,
    rows: previewRows,
    totalRows,
    hasHeaders: options.hasHeaders !== false
  }
}

/**
 * Parse JSON file and return preview data
 */
export const parseJSONFile = async (options: ImportOptions): Promise<ImportPreview> => {
  logger.debug('Parsing JSON file', { filePath: options.filePath })

  const content = await readFile(options.filePath, options.encoding || 'utf-8')
  const parsed = JSON.parse(content)

  let records: Record<string, unknown>[]

  if (Array.isArray(parsed)) {
    records = parsed
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Try to find an array property
    const arrayProp = Object.keys(parsed).find((key) => Array.isArray(parsed[key]))
    if (arrayProp) {
      records = parsed[arrayProp]
    } else {
      // Single object, wrap in array
      records = [parsed]
    }
  } else {
    throw new Error('JSON file must contain an array or object')
  }

  // Flatten nested objects
  records = records.map((record) => flattenObject(record))

  const previewLimit = options.previewLimit || 100
  const previewRows = records.slice(0, previewLimit)
  const totalRows = records.length

  // Get all unique column names
  const allColumns = new Set<string>()
  records.forEach((record) => {
    Object.keys(record).forEach((key) => allColumns.add(key))
  })
  const columnNames = Array.from(allColumns)

  // Build column info with sample values and detected types
  const columns: ImportColumn[] = columnNames.map((name) => {
    const sampleValues = previewRows.slice(0, 10).map((row) => row[name])
    const detectedType = detectType(sampleValues)

    return {
      name,
      sampleValues,
      detectedType
    }
  })

  return {
    columns,
    rows: previewRows,
    totalRows,
    hasHeaders: true
  }
}

/**
 * Flatten nested object into single level with dot notation keys
 */
export const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey))
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value)
    } else {
      result[newKey] = value
    }
  }

  return result
}

/**
 * Read full file data for import
 */
export const readImportData = async (
  options: ImportOptions
): Promise<Record<string, unknown>[]> => {
  if (options.format === 'csv') {
    const content = await readFile(options.filePath, options.encoding || 'utf-8')
    const delimiter = options.delimiter || ','

    return parseCSV(content, {
      delimiter,
      columns: options.hasHeaders !== false,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    }) as Record<string, unknown>[]
  } else if (options.format === 'json') {
    const content = await readFile(options.filePath, options.encoding || 'utf-8')
    const parsed = JSON.parse(content)

    let records: Record<string, unknown>[]
    if (Array.isArray(parsed)) {
      records = parsed
    } else if (typeof parsed === 'object' && parsed !== null) {
      const arrayProp = Object.keys(parsed).find((key) => Array.isArray(parsed[key]))
      if (arrayProp) {
        records = parsed[arrayProp]
      } else {
        records = [parsed]
      }
    } else {
      throw new Error('JSON file must contain an array or object')
    }

    return records.map((record) => flattenObject(record))
  }

  throw new Error(`Unsupported import format: ${options.format}`)
}
