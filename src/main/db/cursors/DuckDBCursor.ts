import type { DuckDBConnection, DuckDBResult, DuckDBDataChunk } from '@duckdb/node-api'
import { BaseCursor } from './BaseCursor'

export class DuckDBCursor extends BaseCursor {
  private result: DuckDBResult | null = null
  private columnNames: string[] = []
  private iterator: AsyncIterableIterator<DuckDBDataChunk> | null = null
  private buffer: Record<string, unknown>[] = []

  constructor(
    private readonly connection: DuckDBConnection,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    if (this.params.length > 0) {
      const stmt = await this.connection.prepare(this.query)
      const values = this.params.map((p) => p as import('@duckdb/node-api').DuckDBValue)
      stmt.bind(values)
      this.result = await stmt.stream()
    } else {
      this.result = await this.connection.stream(this.query)
    }
    this.columnNames = this.result.columnNames()
    this.iterator = this.result[Symbol.asyncIterator]()
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.iterator) return []

    const rows: Record<string, unknown>[] = []

    // Drain buffer first
    while (rows.length < this.chunkSize && this.buffer.length > 0) {
      rows.push(this.buffer.shift()!)
    }

    // Fetch more chunks if needed
    while (rows.length < this.chunkSize) {
      const { value: chunk, done } = await this.iterator.next()
      if (done || !chunk) break

      const chunkRows = chunk.getRowObjects(this.columnNames)
      const jsRows = chunkRows.map((row) => {
        const obj: Record<string, unknown> = {}
        for (const key of this.columnNames) {
          const val = row[key]
          obj[key] = convertDuckDBValue(val)
        }
        return obj
      })

      for (const r of jsRows) {
        if (rows.length < this.chunkSize) {
          rows.push(r)
        } else {
          this.buffer.push(r)
        }
      }
    }

    return rows
  }

  async cancel(): Promise<void> {
    this.iterator = null
    this.result = null
    this.buffer = []
  }
}

const convertDuckDBValue = (val: unknown): unknown => {
  if (val === null || val === undefined) return null
  if (typeof val === 'bigint') return Number(val)
  if (typeof val === 'object' && val !== null && 'toString' in val) {
    // DuckDB value types (Date, Time, Timestamp, etc.) have toString()
    const proto = Object.getPrototypeOf(val)
    if (proto && proto.constructor && proto.constructor.name.startsWith('DuckDB')) {
      return String(val)
    }
  }
  return val
}
