import type Database from 'better-sqlite3'
import { BaseCursor } from './BaseCursor'

export class SQLiteCursor extends BaseCursor {
  private iterator: IterableIterator<Record<string, unknown>> | null = null

  constructor(
    private readonly db: Database.Database,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    const stmt = this.db.prepare(this.query)
    this.iterator = stmt.iterate(...this.params) as IterableIterator<Record<string, unknown>>
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.iterator) return []

    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < this.chunkSize; i++) {
      const result = this.iterator.next()
      if (result.done) break
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
