import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'

describe('PostgreSQL Driver Integration', () => {
  let client: pg.Client | null = null

  const config = {
    host: process.env.PG_HOST || '127.0.0.1',
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || '',
    database: process.env.PG_DATABASE || 'postgres'
  }

  beforeAll(async () => {
    try {
      client = new pg.Client(config)
      await client.connect()
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error)
      throw error
    }
  })

  afterAll(async () => {
    if (client) {
      await client.end()
    }
  })

  it('should connect to PostgreSQL database', () => {
    expect(client).not.toBeNull()
  })

  it('should list databases', async () => {
    const result = await client!.query('SELECT datname FROM pg_database WHERE datistemplate = false')
    expect(Array.isArray(result.rows)).toBe(true)
    expect(result.rows.length).toBeGreaterThan(0)
  })

  it('should list tables', async () => {
    const result = await client!.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `)
    expect(Array.isArray(result.rows)).toBe(true)
  })

  it('should execute SELECT query', async () => {
    const result = await client!.query('SELECT 1 as test')
    expect(Array.isArray(result.rows)).toBe(true)
    expect(result.rows[0].test).toBe(1)
  })

  it('should get table schema from information_schema', async () => {
    const result = await client!.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      LIMIT 10
    `)
    expect(Array.isArray(result.rows)).toBe(true)
  })

  it('should handle invalid query gracefully', async () => {
    await expect(
      client!.query('SELECT * FROM non_existent_table_xyz')
    ).rejects.toThrow()
  })
})
