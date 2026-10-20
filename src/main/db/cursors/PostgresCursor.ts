import Cursor from 'pg-cursor'
import type { Pool, PoolClient } from 'pg'
import { types } from 'pg'
import { BaseCursor } from './BaseCursor'

export class PostgresCursor extends BaseCursor {
  private client: PoolClient | null = null
  private cursor: Cursor | null = null

  constructor(
    private readonly pool: Pool,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number,
    private readonly rawValues = false,
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.client = await this.pool.connect()
    this.cursor = this.client.query(new Cursor(this.query, this.params, this.rawValues ? {
      // Preserve server text for arrays, JSON, dates, intervals and extension types.
      // Only decode types whose JavaScript representation is lossless here.
      types: { getTypeParser: (oid, format) => [16, 17, 21, 23, 26, 700, 701].includes(oid)
        ? types.getTypeParser(oid, format) : (value: string) => value },
    } : undefined))
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.cursor) return []

    return new Promise((resolve, reject) => {
      this.cursor!.read(this.chunkSize, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows as Record<string, unknown>[])
        }
      })
    })
  }

  async cancel(): Promise<void> {
    try {
      if (this.cursor) {
        await new Promise<void>((resolve, reject) => {
          this.cursor!.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        this.cursor = null
      }
    } finally {
      if (this.client) {
        this.client.release()
        this.client = null
      }
    }
  }
}
