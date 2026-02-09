import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type ClickHouseClient } from '@clickhouse/client'

describe('ClickHouse Seed Data', () => {
  let client: ClickHouseClient | null = null

  beforeAll(async () => {
    try {
      client = createClient({
        url: `http://${process.env.CH_HOST || '127.0.0.1'}:${process.env.CH_PORT || '18123'}`,
        username: process.env.CH_USERNAME || 'zequel',
        password: process.env.CH_PASSWORD || 'zequel',
        database: process.env.CH_DATABASE || 'zequel',
      })
      // Test the connection
      await client.query({ query: 'SELECT 1' })
    } catch (error) {
      console.error('ClickHouse connection failed:', (error as Error).message)
      client = null
    }
  })

  afterAll(async () => {
    if (client) {
      await client.close()
    }
  })

  // -- Tables & Data ----------------------------------------------------------

  describe('tables and data', () => {
    it('should have events table with 100 rows', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query({ query: 'SELECT count() AS cnt FROM events' })
      const rows = await result.json<{ cnt: string }>()
      expect(Number(rows.data[0].cnt)).toBe(100)
    })
  })

  // -- Views ------------------------------------------------------------------

  describe('views', () => {
    const expectedViews = ['events_by_country', 'daily_events', 'user_journey']

    it('should have all seed views', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query({
        query: "SELECT name FROM system.tables WHERE database = 'zequel' AND engine = 'View'",
      })
      const rows = await result.json<{ name: string }>()
      const viewNames = rows.data.map((r) => r.name)
      for (const v of expectedViews) {
        expect(viewNames).toContain(v)
      }
    })

    it('should return data from events_by_country', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query({ query: 'SELECT * FROM events_by_country LIMIT 5' })
      const rows = await result.json()
      expect(rows.data.length).toBeGreaterThan(0)
      expect(rows.data[0]).toHaveProperty('event_count')
      expect(rows.data[0]).toHaveProperty('unique_users')
    })

    it('should return data from daily_events', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query({ query: 'SELECT * FROM daily_events LIMIT 5' })
      const rows = await result.json()
      expect(rows.data.length).toBeGreaterThan(0)
      expect(rows.data[0]).toHaveProperty('total_events')
      expect(rows.data[0]).toHaveProperty('page_views')
    })

    it('should return data from user_journey', async () => {
      if (!client) return console.warn('Skipping - no connection')
      const result = await client.query({ query: 'SELECT * FROM user_journey LIMIT 5' })
      const rows = await result.json()
      expect(rows.data.length).toBeGreaterThan(0)
      expect(rows.data[0]).toHaveProperty('journey')
      expect(rows.data[0]).toHaveProperty('total_events')
    })
  })
})
