import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { Client } from 'pg'
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

test('streaming row transfers preserve exact data and measure scale', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_SCALE, 'Opt-in large data benchmark on an isolated PostgreSQL server')
  test.setTimeout(600_000)
  const config = { host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), user: 'zequel_test', database: 'postgres' }
  const database = `transfer_scale_${Date.now()}`
  const directory = await mkdtemp(join(tmpdir(), 'zequel-transfer-scale-'))
  const admin = new Client(config)
  let app: ElectronApplication | undefined
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE "${database}"`)
    const seed = new Client({ ...config, database })
    await seed.connect()
    await seed.query('CREATE SCHEMA reporting; CREATE TABLE reporting.items(id bigint PRIMARY KEY, amount numeric(30,8), label text); CREATE TABLE public.items(id bigint);')
    await seed.end()
    const bootstrap = join(directory, 'bootstrap.cjs')
    await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
    app = await electron.launch({ args: [bootstrap], cwd: process.cwd(), env: { ...process.env, E2E: '1' } })
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const sessionId = await page.evaluate(config => window.api.connections.connectWithConfig(config), {
      id: database, name: 'Isolated scale test', type: 'postgresql', host: config.host, port: config.port, username: config.user, database, ssl: false,
    })
    const measurements: Record<string, unknown>[] = []
    for (const count of [10_000, 100_000, 1_000_000]) {
      const filePath = join(directory, `${count}.csv`)
      const content = async function* (): AsyncGenerator<string> {
        yield 'id,amount,label\n'
        for (let index = 1; index <= count; index++) yield `${9007199254740993n + BigInt(index)},123456789012345678.12345678,"São Paulo, ""quoted""\nrow ${index}"\n`
      }
      await pipeline(content(), createWriteStream(filePath))
      await app.evaluate(() => {
        const state = globalThis as typeof globalThis & { transferMetrics?: { rss: number; heap: number; lag: number; timer?: ReturnType<typeof setInterval> } }
        const metrics = { rss: 0, heap: 0, lag: 0, timer: undefined as ReturnType<typeof setInterval> | undefined }
        let previous = Date.now()
        metrics.timer = setInterval(() => {
          const now = Date.now(); metrics.lag = Math.max(metrics.lag, now - previous - 50); previous = now
          const memory = process.memoryUsage(); metrics.rss = Math.max(metrics.rss, memory.rss); metrics.heap = Math.max(metrics.heap, memory.heapUsed)
        }, 50)
        state.transferMetrics = metrics
      })
      const start = Date.now()
      const imported = await page.evaluate(async ({ sessionId, filePath }) => window.api.import.execute(sessionId, 'items', filePath, 'csv', [
        { sourceColumn: 'id', targetColumn: 'id', targetType: 'BIGINT' },
        { sourceColumn: 'amount', targetColumn: 'amount', targetType: 'NUMERIC' },
        { sourceColumn: 'label', targetColumn: 'label', targetType: 'TEXT' },
      ], { schema: 'reporting', truncateTable: true, batchSize: 500, operationId: crypto.randomUUID() }), { sessionId, filePath })
      expect(imported, JSON.stringify(imported)).toMatchObject({ success: true, insertedRows: count })
      const importMs = Date.now() - start
      const exportPath = join(directory, `${count}.json`)
      const exportStart = Date.now()
      const exported = await page.evaluate(({ sessionId, exportPath }) => window.api.export.tableToFile(sessionId, 'items', exportPath, { format: 'json', prettyPrint: false, schema: 'reporting', operationId: crypto.randomUUID() }), { sessionId, exportPath })
      expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
      const exportMs = Date.now() - exportStart
      const memory = await app.evaluate(() => {
        const state = globalThis as typeof globalThis & { transferMetrics?: { rss: number; heap: number; lag: number; timer?: ReturnType<typeof setInterval> } }
        const metrics = state.transferMetrics!
        clearInterval(metrics.timer)
        return { peakRss: metrics.rss, peakHeap: metrics.heap, maxMainEventLoopDelayMs: metrics.lag }
      })
      measurements.push({ count, csvBytes: (await stat(filePath)).size, jsonBytes: (await stat(exportPath)).size, importMs, exportMs, ...memory })
      const check = new Client({ ...config, database }); await check.connect()
      try {
        expect((await check.query('SELECT count(*)::int AS count FROM reporting.items')).rows[0].count).toBe(count)
        expect((await check.query('SELECT count(*)::int AS count FROM public.items')).rows[0].count).toBe(0)
        expect((await check.query('SELECT id, amount, label FROM reporting.items ORDER BY id LIMIT 1')).rows[0]).toEqual({ id: '9007199254740994', amount: '123456789012345678.12345678', label: 'São Paulo, "quoted"\nrow 1' })
      } finally { await check.end() }
    }
    await writeFile(join(directory, 'measurements.json'), JSON.stringify({ machine: process.platform + '-' + process.arch, measurements }, null, 2))
    console.log(`Transfer scale measurements: ${directory}`, JSON.stringify(measurements))
  } finally {
    await closeTransferTestApp(app)
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.end()
    await rm(join(directory, 'profile'), { recursive: true, force: true })
  }
})

test('row files preserve special types and failed imports roll back cleared data', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_TEST_PG_PORT, 'Requires the isolated PostgreSQL server')
  test.setTimeout(120_000)
  const config = { host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), user: 'zequel_test', database: 'postgres' }
  const schema = `transfer_rows_${Date.now()}`
  const directory = await mkdtemp(join(tmpdir(), 'zequel-row-types-'))
  const client = new Client(config)
  let app: ElectronApplication | undefined
  await client.connect()
  try {
    await client.query(`CREATE SCHEMA "${schema}"; CREATE TABLE "${schema}".source(id bigint PRIMARY KEY, amount numeric(30,8), label text, payload bytea, stamp timestamp, document jsonb, missing text, empty text, marker text)`)
    await client.query(`INSERT INTO "${schema}".source VALUES (9007199254740993, 123456789012345678.12345678, $1, decode('00ff80','hex'), '2026-10-20 10:20:30.123456', '{"exact":9007199254740993}', NULL, '', $2)`, ['Olá, "quoted"\nnext', '\\N'])
    await client.query(`CREATE TABLE "${schema}".target (LIKE "${schema}".source INCLUDING ALL)`)
    const bootstrap = join(directory, 'bootstrap.cjs')
    await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
    app = await electron.launch({ args: [bootstrap], cwd: process.cwd(), env: { ...process.env, E2E: '1' } })
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const sessionId = await page.evaluate(config => window.api.connections.connectWithConfig(config), { id: schema, name: 'Isolated row types', type: 'postgresql', host: config.host, port: config.port, username: config.user, database: 'postgres', ssl: false })
    const mappings = ['id', 'amount', 'label', 'payload', 'stamp', 'document', 'missing', 'empty', 'marker'].map(name => ({ sourceColumn: name, targetColumn: name, targetType: '' }))
    const projection = "id, amount, label, encode(payload, 'hex') AS payload, stamp::text, document::text, missing, empty, marker"
    const expected = (await client.query(`SELECT ${projection} FROM "${schema}".source`)).rows
    for (const format of ['csv', 'json'] as const) {
      const filePath = join(directory, `rows.${format}`)
      const exported = await page.evaluate(({ sessionId, filePath, schema, format }) => window.api.export.tableToFile(sessionId, 'source', filePath, { format, schema }), { sessionId, filePath, schema, format })
      expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
      const imported = await page.evaluate(({ sessionId, filePath, schema, format, mappings }) => window.api.import.execute(sessionId, 'target', filePath, format, mappings, { schema, truncateTable: true }), { sessionId, filePath, schema, format, mappings })
      expect(imported, JSON.stringify(imported)).toMatchObject({ success: true, insertedRows: 1 })
      expect((await client.query(`SELECT ${projection} FROM "${schema}".target`)).rows).toEqual(expected)
    }
    const invalidPath = join(directory, 'duplicate.csv')
    await writeFile(invalidPath, 'id\n1\n1\n')
    const failed = await page.evaluate(({ sessionId, invalidPath, schema }) => window.api.import.execute(sessionId, 'target', invalidPath, 'csv', [{ sourceColumn: 'id', targetColumn: 'id', targetType: '' }], { schema, truncateTable: true, batchSize: 1 }), { sessionId, invalidPath, schema })
    expect(failed).toMatchObject({ success: false, insertedRows: 0 })
    expect((await client.query(`SELECT ${projection} FROM "${schema}".target`)).rows).toEqual(expected)
    await client.query(`CREATE FUNCTION "${schema}".slow_insert() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN PERFORM pg_sleep(1); RETURN NEW; END'; CREATE TRIGGER slow_insert BEFORE INSERT ON "${schema}".target FOR EACH ROW EXECUTE FUNCTION "${schema}".slow_insert()`)
    const slowPath = join(directory, 'slow.csv')
    await writeFile(slowPath, 'id\n' + Array.from({ length: 20 }, (_, index) => index + 1).join('\n') + '\n')
    const operationId = `cancel-rows-${Date.now()}`
    await page.evaluate(({ sessionId, slowPath, schema, operationId }) => {
      void window.api.import.execute(sessionId, 'target', slowPath, 'csv', [{ sourceColumn: 'id', targetColumn: 'id', targetType: '' }], { schema, truncateTable: true, batchSize: 1, operationId })
    }, { sessionId, slowPath, schema, operationId })
    await expect.poll(async () => (await client.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE state = $1 AND query LIKE $2', ['active', `INSERT INTO "${schema}"."target"%`])).rows[0].count).toBe(1)
    const opened = app.waitForEvent('window')
    await page.evaluate(() => window.api.transfers.open('restore'))
    const operations = await opened
    await operations.waitForLoadState('domcontentloaded')
    await page.close()
    await expect.poll(() => operations.evaluate(() => window.api.transfers.rows().then(rows => rows.map(row => row.id)))).toContain(operationId)
    const cancelledAt = Date.now()
    await operations.evaluate(id => window.api.transfers.cancelRow(id), operationId)
    await expect.poll(() => operations.evaluate(id => window.api.transfers.rows().then(rows => rows.find(row => row.id === id)?.status), operationId), { timeout: 10_000 }).toBe('cancelled')
    expect(Date.now() - cancelledAt).toBeLessThan(5000)
    expect((await client.query(`SELECT ${projection} FROM "${schema}".target`)).rows).toEqual(expected)
    await client.query(`CREATE FUNCTION "${schema}".slow_value(n integer) RETURNS integer LANGUAGE plpgsql STABLE AS 'BEGIN PERFORM pg_sleep(1); RETURN n; END'; CREATE VIEW "${schema}".slow_export AS SELECT "${schema}".slow_value(n) AS id FROM generate_series(1, 20) AS n`)
    const exportSession = await operations.evaluate(config => window.api.connections.connectWithConfig(config), { id: schema + '-export', name: 'Isolated slow export', type: 'postgresql', host: config.host, port: config.port, username: config.user, database: 'postgres', ssl: false })
    const exportId = `cancel-export-${Date.now()}`
    const exportPath = join(directory, 'cancelled.csv')
    await operations.evaluate(({ exportSession, exportPath, schema, exportId }) => {
      void window.api.export.tableToFile(exportSession, 'slow_export', exportPath, { format: 'csv', schema, operationId: exportId })
    }, { exportSession, exportPath, schema, exportId })
    await expect.poll(() => operations.evaluate(id => window.api.transfers.rows().then(rows => rows.find(row => row.id === id)?.status), exportId)).toBe('running')
    const exportCancelledAt = Date.now()
    await operations.evaluate(id => window.api.transfers.cancelRow(id), exportId)
    await expect.poll(() => operations.evaluate(id => window.api.transfers.rows().then(rows => rows.find(row => row.id === id)?.status), exportId), { timeout: 10_000 }).toBe('cancelled')
    expect(Date.now() - exportCancelledAt).toBeLessThan(5000)
    await expect(stat(exportPath)).rejects.toThrow()
  } finally {
    await closeTransferTestApp(app)
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    await client.end()
    await rm(directory, { recursive: true, force: true })
  }
})
