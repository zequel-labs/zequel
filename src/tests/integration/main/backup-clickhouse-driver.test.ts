/**
 * Real round-trip of the driver-based ClickHouse backup: populate → serialize → drop →
 * deserialize → assert data identical (including emoji / multibyte). Runs over the HTTP
 * interface (the path that works through SSH tunnels). Skips gracefully if the container
 * isn't running.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('@main/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { ClickHouseDriver } from '@main/db/clickhouse'
import {
  serializeClickHouse,
  deserializeClickHouse,
} from '@main/services/backup/native/clickhouse-serializer'
import { requireOrSkip } from './db-guard'

const CH = {
  type: 'clickhouse',
  host: process.env.CH_HOST || '127.0.0.1',
  port: Number(process.env.CH_PORT || 18123),
  username: process.env.CH_USERNAME || 'zequel',
  password: process.env.CH_PASSWORD || 'zequel',
  database: process.env.CH_DATABASE || 'zequel',
  ssl: false,
}

const TABLE = 'zequel_backup_roundtrip_test'

describe('ClickHouse driver-based backup round-trip', () => {
  let driver: ClickHouseDriver | null = null

  beforeAll(async () => {
    driver = new ClickHouseDriver()
    try {
      await driver.connect(CH as never)
    } catch {
      driver = null
    }
  })

  afterAll(async () => {
    if (driver) {
      try { await driver.execute(`DROP TABLE IF EXISTS \`${TABLE}\``) } catch { /* ignore */ }
      await driver.disconnect()
    }
  })

  it('round-trips a table with emoji / multibyte data', async () => {
    if (!requireOrSkip(!!driver, 'ClickHouse container')) return

    await driver.execute(`DROP TABLE IF EXISTS \`${TABLE}\``)
    await driver.execute(
      `CREATE TABLE \`${TABLE}\` (id UInt32, name String) ENGINE = MergeTree ORDER BY id`
    )
    await driver.execute(
      `INSERT INTO \`${TABLE}\` VALUES (1, 'héllo 🎉'), (2, 'café ☕'), (3, '日本語')`
    )

    // Back up via the driver (server generates the INSERTs through FORMAT SQLInsert).
    const sql = await serializeClickHouse(driver, CH.database, [TABLE])
    expect(sql).toContain('CREATE TABLE')
    expect(sql).toContain('INSERT INTO')
    expect(sql).toContain('🎉')

    // Drop and restore from the serialized SQL.
    await driver.execute(`DROP TABLE \`${TABLE}\``)
    const result = await deserializeClickHouse(driver, sql)
    expect(result.errors).toEqual([])

    // The data must come back identical, emoji included.
    const check = await driver.execute(`SELECT id, name FROM \`${TABLE}\` ORDER BY id`)
    const rows = check.rows as { id: number; name: string }[]
    expect(rows.map(r => r.name)).toEqual(['héllo 🎉', 'café ☕', '日本語'])
  })
})
