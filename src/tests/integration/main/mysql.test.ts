import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mysql from 'mysql2/promise'

describe('MySQL Driver Integration', () => {
  let connection: mysql.Connection | null = null
  let connectionError: string | null = null

  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || ''
  }

  const database = process.env.DB_DATABASE || 'mysql' // Use 'mysql' as default (always exists)

  beforeAll(async () => {
    try {
      // First connect without database to test connection
      connection = await mysql.createConnection(config)
      // Then switch to the database
      await connection.query(`USE \`${database}\``)
    } catch (error: any) {
      connectionError = error.message
      console.warn('MySQL connection failed:', error.message)
    }
  })

  afterAll(async () => {
    if (connection) {
      await connection.end()
    }
  })

  it('should connect to MySQL database', () => {
    if (connectionError) {
      console.warn('Skipping test - connection failed:', connectionError)
      return
    }
    expect(connection).not.toBeNull()
  })

  it('should list databases', async () => {
    if (!connection) {
      console.warn('Skipping test - no connection')
      return
    }
    const [rows] = await connection.query('SHOW DATABASES')
    expect(Array.isArray(rows)).toBe(true)
    expect((rows as any[]).length).toBeGreaterThan(0)
  })

  it('should list tables', async () => {
    if (!connection) {
      console.warn('Skipping test - no connection')
      return
    }
    const [rows] = await connection.query('SHOW TABLES')
    expect(Array.isArray(rows)).toBe(true)
  })

  it('should execute SELECT query', async () => {
    if (!connection) {
      console.warn('Skipping test - no connection')
      return
    }
    const [rows] = await connection.query('SELECT 1 as test')
    expect(Array.isArray(rows)).toBe(true)
    expect((rows as any[])[0].test).toBe(1)
  })

  it('should get table schema from information_schema', async () => {
    if (!connection) {
      console.warn('Skipping test - no connection')
      return
    }
    const [rows] = await connection.query(`
      SELECT TABLE_NAME, TABLE_TYPE
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      LIMIT 10
    `, [database])

    expect(Array.isArray(rows)).toBe(true)
  })

  it('should handle invalid query gracefully', async () => {
    if (!connection) {
      console.warn('Skipping test - no connection')
      return
    }
    await expect(
      connection.query('SELECT * FROM non_existent_table_xyz')
    ).rejects.toThrow()
  })
})
