import { randomUUID } from 'node:crypto'
import type { ClickHouseClient } from '@clickhouse/client'
import { BaseCursor } from './BaseCursor'

interface StreamRow { json<T>(): T }

/**
 * One streamed query: LIMIT/OFFSET pages have no stable order without ORDER BY and can
 * skip or repeat rows while parts merge. The HTTP response is paused between reads.
 */
export class ClickHouseCursor extends BaseCursor {
  private controller = new AbortController()
  private queryId: string | null = null
  private rows: AsyncIterator<StreamRow[]> | null = null
  private buffer: Record<string, unknown>[] = []
  private done = false

  constructor(
    private readonly client: ClickHouseClient,
    private readonly query: string,
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.controller = new AbortController()
    this.queryId = randomUUID()
    this.buffer = []
    this.done = false
    const resultSet = await this.client.query({
      query: this.query,
      query_id: this.queryId,
      abort_signal: this.controller.signal,
      // Decimals are JSON numbers by default, which rounds beyond double precision.
      clickhouse_settings: { cancel_http_readonly_queries_on_client_close: 1, output_format_json_quote_decimals: 1 },
      format: 'JSONEachRow'
    })
    this.rows = (resultSet.stream() as AsyncIterable<StreamRow[]>)[Symbol.asyncIterator]()
  }

  async read(): Promise<Record<string, unknown>[]> {
    while (this.buffer.length < this.chunkSize && !this.done && this.rows) {
      this.controller.signal.throwIfAborted()
      const { value, done } = await this.rows.next()
      if (done) { this.done = true; this.queryId = null; break }
      for (const row of value) this.buffer.push(row.json<Record<string, unknown>>())
    }
    return this.buffer.splice(0, this.chunkSize)
  }

  async cancel(): Promise<void> {
    const queryId = this.queryId
    this.queryId = null
    this.done = true
    this.buffer = []
    try {
      if (queryId) await this.client.command({ query: 'KILL QUERY WHERE query_id = {id:String} SYNC', query_params: { id: queryId } })
    } finally {
      this.controller.abort()
      const rows = this.rows
      this.rows = null
      try { await rows?.return?.() } catch { /* The aborted response may already be closed. */ }
    }
  }
}
