import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MySQLDriver } from '@main/db/mysql'
import { MariaDBDriver } from '@main/db/mariadb'
import { DatabaseType } from '@main/types'
import type { ConnectionConfig } from '@main/types'

/**
 * Integration tests for streaming export (selectTopStream).
 *
 * Verifies that after switching databases, the cursor connection uses the
 * currently-selected database — NOT the original database from the config.
 *
 * Only MySQL and MariaDB are tested because they are the only drivers that
 * create a separate connection for cursors. All other drivers (PostgreSQL,
 * SQL Server, ClickHouse, SQLite, DuckDB, MongoDB) reuse existing
 * connections/pools and are not affected.
 */

// ─── MySQL ──────────────────────────────────────────────────────────────────

describe('MySQL selectTopStream after database switch', () => {
  let driver: MySQLDriver | null = null

  const config: ConnectionConfig = {
    id: 'test-mysql-export',
    name: 'Test MySQL Export',
    type: DatabaseType.MySQL,
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 33061,
    username: process.env.MYSQL_USERNAME || 'zequel',
    password: process.env.MYSQL_PASSWORD || 'zequel',
    database: process.env.MYSQL_DATABASE || 'zequel',
  }

  beforeAll(async () => {
    try {
      driver = new MySQLDriver()
      await driver.connect(config)
    } catch (error) {
      console.warn('MySQL connection failed:', (error as Error).message)
      driver = null
    }
  })

  afterAll(async () => {
    if (driver?.isConnected) {
      await driver.disconnect()
    }
  })

  it('should stream table data from the initial database', async () => {
    if (!driver) return console.warn('Skipping - no MySQL connection')

    const result = await driver.selectTopStream('customers', {}, 100)

    expect(result.totalRows).toBeGreaterThan(0)
    expect(result.columns.length).toBeGreaterThan(0)
    expect(result.cursor).toBeDefined()

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)
    await result.cursor.cancel()
  })

  it('should stream table data correctly after switching databases', async () => {
    if (!driver) return console.warn('Skipping - no MySQL connection')

    // Switch to information_schema (always exists on MySQL)
    await driver.getTables('information_schema')

    // Stream from a table in information_schema
    const result = await driver.selectTopStream('SCHEMATA', {}, 100)

    expect(result.totalRows).toBeGreaterThan(0)
    expect(result.columns.length).toBeGreaterThan(0)

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)

    // Verify we got information_schema data (should have a SCHEMA_NAME column)
    const hasSchemaName = result.columns.some(c => c.name === 'SCHEMA_NAME')
    expect(hasSchemaName).toBe(true)

    await result.cursor.cancel()
  })

  it('should stream correctly after switching back to original database', async () => {
    if (!driver) return console.warn('Skipping - no MySQL connection')

    // Switch to information_schema then back to zequel
    await driver.getTables('information_schema')
    await driver.getTables(config.database)

    const result = await driver.selectTopStream('customers', {}, 100)

    expect(result.totalRows).toBeGreaterThan(0)

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)

    // Verify we're querying customers from zequel
    const cols = result.columns.map(c => c.name)
    expect(cols).toContain('id')

    await result.cursor.cancel()
  })

  it('should not error with "No database selected" when exporting after switch', async () => {
    if (!driver) return console.warn('Skipping - no MySQL connection')

    // Switch to information_schema
    await driver.getTables('information_schema')

    // This was the original bug: cursor created a new connection with
    // config.database instead of currentDatabase, causing MySQL error 1046
    const result = await driver.selectTopStream('TABLES', {}, 50)

    await result.cursor.start()
    const rows = await result.cursor.read()

    // Should have rows (information_schema.TABLES is never empty)
    expect(rows.length).toBeGreaterThan(0)

    await result.cursor.cancel()
  })
})

// ─── MariaDB ────────────────────────────────────────────────────────────────

describe('MariaDB selectTopStream after database switch', () => {
  let driver: MariaDBDriver | null = null

  const config: ConnectionConfig = {
    id: 'test-mariadb-export',
    name: 'Test MariaDB Export',
    type: DatabaseType.MariaDB,
    host: process.env.MARIADB_HOST || '127.0.0.1',
    port: Number(process.env.MARIADB_PORT) || 33070,
    username: process.env.MARIADB_USERNAME || 'zequel',
    password: process.env.MARIADB_PASSWORD || 'zequel',
    database: process.env.MARIADB_DATABASE || 'zequel',
  }

  beforeAll(async () => {
    try {
      driver = new MariaDBDriver()
      await driver.connect(config)
    } catch (error) {
      console.warn('MariaDB connection failed:', (error as Error).message)
      driver = null
    }
  })

  afterAll(async () => {
    if (driver?.isConnected) {
      await driver.disconnect()
    }
  })

  it('should stream table data from the initial database', async () => {
    if (!driver) return console.warn('Skipping - no MariaDB connection')

    const result = await driver.selectTopStream('customers', {}, 100)

    expect(result.totalRows).toBeGreaterThan(0)
    expect(result.columns.length).toBeGreaterThan(0)

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)
    await result.cursor.cancel()
  })

  it('should stream table data correctly after switching databases', async () => {
    if (!driver) return console.warn('Skipping - no MariaDB connection')

    // Switch to information_schema
    await driver.getTables('information_schema')

    const result = await driver.selectTopStream('SCHEMATA', {}, 100)

    expect(result.totalRows).toBeGreaterThan(0)

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)

    const hasSchemaName = result.columns.some(c => c.name === 'SCHEMA_NAME')
    expect(hasSchemaName).toBe(true)

    await result.cursor.cancel()
  })

  it('should not error with "No database selected" when exporting after switch', async () => {
    if (!driver) return console.warn('Skipping - no MariaDB connection')

    await driver.getTables('information_schema')

    const result = await driver.selectTopStream('TABLES', {}, 50)

    await result.cursor.start()
    const rows = await result.cursor.read()
    expect(rows.length).toBeGreaterThan(0)

    await result.cursor.cancel()
  })
})
