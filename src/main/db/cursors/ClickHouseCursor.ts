import type { ClickHouseClient } from '@clickhouse/client'
import { BaseCursor } from './BaseCursor'

export class ClickHouseCursor extends BaseCursor {
  private offset = 0

  constructor(
    private readonly client: ClickHouseClient,
    private readonly query: string,
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.offset = 0
  }

  async read(): Promise<Record<string, unknown>[]> {
    const paginatedQuery = `${this.query} LIMIT ${this.chunkSize} OFFSET ${this.offset}`

    const resultSet = await this.client.query({
      query: paginatedQuery,
      format: 'JSONEachRow'
    })
    const rows = await resultSet.json<Record<string, unknown>>()

    this.offset += rows.length
    return rows
  }

  async cancel(): Promise<void> {
    // ClickHouse HTTP queries are stateless; nothing to close
  }
}
