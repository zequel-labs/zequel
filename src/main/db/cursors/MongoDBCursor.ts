import type { Collection, Document, FindCursor } from 'mongodb'
import { BaseCursor } from './BaseCursor'

export class MongoDBCursor extends BaseCursor {
  private cursor: FindCursor<Document> | null = null

  constructor(
    private readonly collection: Collection,
    private readonly filter: Document,
    private readonly sort: Document,
    private readonly serializeDocument: (doc: Document) => Record<string, unknown>,
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.cursor = this.collection
      .find(this.filter)
      .sort(this.sort)
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.cursor) return []

    const rows: Record<string, unknown>[] = []
    for (let i = 0; i < this.chunkSize; i++) {
      const doc = await this.cursor.next()
      if (!doc) break
      rows.push(this.serializeDocument(doc))
    }
    return rows
  }

  async cancel(): Promise<void> {
    if (this.cursor) {
      await this.cursor.close()
      this.cursor = null
    }
  }
}
