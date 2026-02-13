import type { ConnectionPool, Request as MSSQLRequest } from 'mssql'
import { BaseCursor } from './BaseCursor'
import { replacePlaceholders } from '@main/db/sql-placeholder'

export class SQLServerCursor extends BaseCursor {
  private request: MSSQLRequest | null = null
  private rowBuffer: Record<string, unknown>[] = []
  private end = false
  private error: Error | null = null
  private resolve: (() => void) | null = null

  constructor(
    private readonly pool: ConnectionPool,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    const mssql = await import('mssql')
    this.request = new mssql.Request(this.pool)
    this.request.stream = true

    // Bind parameters
    if (this.params.length > 0) {
      for (let i = 0; i < this.params.length; i++) {
        this.request.input(`p${i}`, this.params[i])
      }
    }

    const sql = replacePlaceholders(this.query)

    this.request.on('row', (row: Record<string, unknown>) => {
      this.rowBuffer.push(row)
      if (this.rowBuffer.length >= this.chunkSize) {
        this.request?.pause()
        this.resolve?.()
      }
    })

    this.request.on('error', (err: Error) => {
      this.error = err
      this.resolve?.()
    })

    this.request.on('done', () => {
      this.end = true
      this.resolve?.()
    })

    this.request.query(sql)
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.end && !this.error && this.rowBuffer.length < this.chunkSize) {
      await new Promise<void>((r) => { this.resolve = r })
      this.resolve = null
    }

    if (this.error) throw this.error

    const rows = this.rowBuffer
    this.rowBuffer = []

    if (!this.end && this.request) {
      this.request.resume()
    }

    return rows
  }

  async cancel(): Promise<void> {
    this.end = true
    this.resolve?.()
    if (this.request) {
      try {
        this.request.cancel()
      } catch {
        // Request may already be completed
      }
      this.request = null
    }
  }
}
