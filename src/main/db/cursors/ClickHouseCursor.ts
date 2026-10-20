import { randomUUID } from 'node:crypto'
import type { ClickHouseClient } from '@clickhouse/client'
import { BaseCursor } from './BaseCursor'

export class ClickHouseCursor extends BaseCursor {
  private offset = 0
  private controller = new AbortController()
  private queryId: string | null = null

  constructor(
    private readonly client: ClickHouseClient,
    private readonly query: string,
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.offset = 0
    this.controller = new AbortController()
  }

  async read(): Promise<Record<string, unknown>[]> {
    const paginatedQuery = `${this.query} LIMIT ${this.chunkSize} OFFSET ${this.offset}`

    this.controller.signal.throwIfAborted()
    this.queryId = randomUUID()
    try {
      const resultSet = await this.client.query({
        query: paginatedQuery,
        query_id: this.queryId,
        abort_signal: this.controller.signal,
        clickhouse_settings: { cancel_http_readonly_queries_on_client_close: 1 },
        format: 'JSONEachRow'
      })
      const rows = await resultSet.json<Record<string, unknown>>()
      this.offset += rows.length
      return rows
    } finally { this.queryId = null }
  }

  async cancel(): Promise<void> {
    const queryId = this.queryId
    try {
      if (queryId) await this.client.command({ query: 'KILL QUERY WHERE query_id = {id:String} SYNC', query_params: { id: queryId } })
    } finally { this.controller.abort() }
  }
}
