import type Database from 'better-sqlite3'
import { BaseCursor } from './BaseCursor'

export class SQLiteCursor extends BaseCursor {
  private iterator: IterableIterator<Record<string, unknown>> | null = null

  constructor(
    private readonly db: Database.Database,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number,
    private readonly exactIntegers = false
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    const stmt = this.db.prepare(this.query)
    // File exports must not round INTEGER values beyond 2^53.
    if (this.exactIntegers) stmt.safeIntegers(true)
    this.iterator = stmt.iterate(...this.params) as IterableIterator<Record<string, unknown>>
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.iterator) return []

    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < this.chunkSize; i++) {
      const result = this.iterator.next()
      if (result.done) break
      if (this.exactIntegers) {
        for (const [key, value] of Object.entries(result.value)) {
          if (typeof value === 'bigint' && Number.isSafeInteger(Number(value))) result.value[key] = Number(value)
        }
      }
      rows.push(result.value)
    }
    return rows
  }

  async cancel(): Promise<void> {
    if (this.iterator) {
      this.iterator.return?.(undefined)
      this.iterator = null
    }
  }
}
