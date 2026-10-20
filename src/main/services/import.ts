import { createReadStream } from 'node:fs'
import { parse as parseCSV } from 'csv-parse'
import parser from 'stream-json/parser.js'
import Assembler from 'stream-json/assembler.js'
import { LosslessNumber, isLosslessNumber, stringify } from 'lossless-json'

export interface ImportColumn {
  name: string
  sampleValues: unknown[]
  detectedType: string
}

export interface ImportPreview {
  columns: ImportColumn[]
  rows: Record<string, unknown>[]
  totalRows: number | null
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
  nullToken?: string
  onBytes?: (bytes: number) => void
  encoding?: BufferEncoding
  previewLimit?: number
  /** JSON only: yield whole records with LosslessNumber values instead of flattened columns (MongoDB). */
  documents?: boolean
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
    const allIntegers = nonNullValues.every(value => /^[+-]?\d+$/.test(String(value)))
    if (allIntegers) {
      return nonNullValues.some(value => BigInt(String(value)) > 2147483647n || BigInt(String(value)) < -2147483648n) ? 'BIGINT' : 'INTEGER'
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

/** Preview stops after the sample; an unknown total must not be presented as a count. */
const previewFile = async (options: ImportOptions): Promise<ImportPreview> => {
  const rows: Record<string, unknown>[] = []
  const limit = Math.min(1000, Math.max(1, options.previewLimit ?? 100))
  let totalRows: number | null = 0
  for await (const row of streamImportData(options)) {
    if (rows.length === limit) { totalRows = null; break }
    rows.push(row)
    totalRows++
  }
  const names = [...new Set(rows.flatMap(row => Object.keys(row)))]
  return {
    columns: names.map(name => {
      const sampleValues = rows.slice(0, 10).map(row => row[name])
      return { name, sampleValues, detectedType: detectType(sampleValues) }
    }),
    rows, totalRows, hasHeaders: options.format === 'json' || options.hasHeaders !== false,
  }
}

export const parseCSVFile = (options: ImportOptions): Promise<ImportPreview> => previewFile({ ...options, format: 'csv' })
export const parseJSONFile = (options: ImportOptions): Promise<ImportPreview> => previewFile({ ...options, format: 'json' })

/**
 * Flatten nested object into single level with dot notation keys
 */
export const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const key of Object.keys(obj)) {
    const value = obj[key]
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !isLosslessNumber(value)) {
      // Top-level keys are table columns: keep the whole document for JSON columns, plus its paths.
      if (!prefix) Object.defineProperty(result, newKey, { value: stringify(value), enumerable: true, configurable: true })
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey))
    } else if (Array.isArray(value)) {
      Object.defineProperty(result, newKey, { value: stringify(value), enumerable: true, configurable: true })
    } else {
      Object.defineProperty(result, newKey, { value: isLosslessNumber(value) ? value.value : value, enumerable: true, configurable: true })
    }
  }

  return result
}

/** Exact numeric values are retained before any JavaScript number conversion. */
class ExactAssembler extends Assembler {
  numberValue = (text: string): void => {
    const value = new LosslessNumber(text)
    if (this.done) this.current = value
    else if (Array.isArray(this.current)) this.current.push(value)
    else Object.defineProperty(this.current, this.key!, { value, enumerable: true, writable: true, configurable: true })
    this.key = null
  }
}

// Generator syntax is required for incremental async iteration.
export const streamImportData = async function* (
  options: ImportOptions,
  signal?: AbortSignal,
): AsyncGenerator<Record<string, unknown>> {
  const input = createReadStream(options.filePath, { encoding: options.encoding || 'utf-8', highWaterMark: 64 * 1024, signal })
  input.on('data', () => options.onBytes?.(input.bytesRead))
  const transform = options.format === 'csv'
    ? parseCSV({
      delimiter: options.delimiter === '\\t' ? '\t' : options.delimiter || ',',
      columns: options.hasHeaders !== false ? (headers: string[]): string[] => {
        if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV column names')
        return headers
      } : false,
      skip_empty_lines: true, bom: true,
      cast: (value, context) => !context.header && !context.quoting && value === (options.nullToken ?? '\\N') && value !== '' ? null : value,
    })
    : parser.asStream({ streamValues: false })
  const forwardError = (error: Error): void => { transform.destroy(error) }
  input.on('error', forwardError)
  input.pipe(transform)
  try {
    if (options.format === 'csv') {
      for await (const value of transform) {
        signal?.throwIfAborted()
        const row = value as Record<string, unknown> | unknown[]
        yield Array.isArray(row) ? Object.fromEntries(row.map((cell, index) => [String(index), cell])) : row
      }
      return
    }
    let depth = 0
    let arrayDepth: number | undefined
    let rootObject = false
    let selectedArrayDone = false
    let assembler = new ExactAssembler()
    const record = (): Record<string, unknown> => {
      const value = assembler.current
      if (!value || typeof value !== 'object' || Array.isArray(value) || isLosslessNumber(value)) {
        throw new Error('Each JSON row must be an object')
      }
      return options.documents ? value as Record<string, unknown> : flattenObject(value as Record<string, unknown>)
    }
    for await (const value of transform) {
      signal?.throwIfAborted()
      const token = value as parser.Token
      const opening = token.name === 'startArray' || token.name === 'startObject'
      const closing = token.name === 'endArray' || token.name === 'endObject'
      if (depth === 0 && !opening) throw new Error('JSON file must contain an array or object')
      if (opening) {
        depth++
        if (depth === 1) rootObject = token.name === 'startObject'
        // Accept an array, a single object, or the first array property of a wrapper object.
        if (token.name === 'startArray' && arrayDepth === undefined && (depth === 1 || (rootObject && depth === 2))) {
          arrayDepth = depth
          assembler = new ExactAssembler()
          continue
        }
      }
      if (arrayDepth === undefined) {
        assembler.consume(token)
        if (closing && depth === 1) yield record()
      } else if (!selectedArrayDone && (depth > arrayDepth || (!closing && depth === arrayDepth))) {
        assembler.consume(token)
        if (assembler.done) { yield record(); assembler = new ExactAssembler() }
      }
      if (closing) {
        if (arrayDepth !== undefined && depth === arrayDepth) selectedArrayDone = true
        depth--
      }
    }
  } finally {
    input.unpipe(transform)
    input.destroy()
    transform.destroy()
    input.removeListener('error', forwardError)
  }
}

/** Compatibility helper for small callers; production import consumes the iterator directly. */
export const readImportData = async (options: ImportOptions): Promise<Record<string, unknown>[]> => {
  const rows: Record<string, unknown>[] = []
  for await (const row of streamImportData(options)) rows.push(row)
  return rows
}
