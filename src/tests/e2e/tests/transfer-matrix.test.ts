import { createTransferTlsServer } from '@e2e/helpers/transfer-tls'
import { createTransferSshServer } from '@e2e/helpers/transfer-ssh'
import { ExportFormat } from '@/types/table'
import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { createConnection } from 'mysql2/promise'
import { MongoClient, Long, Decimal128, Binary, ObjectId, BSON } from 'mongodb'
import Redis from 'ioredis'
import sql from 'mssql'
import { Client } from 'pg'
import { createClient } from '@clickhouse/client'
import { mkdtemp, writeFile, readFile, rm, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { SSLMode, type ConnectionConfig, type TransferRequest } from '@main/types'

// Only run against the explicitly provisioned, isolated compose project.
test.skip(process.env.ZEQUEL_TRANSFER_MATRIX !== '1', 'Requires the isolated zequel-transfer-test compose project')
test.setTimeout(180_000)

const runTransfer = async (page: Page, request: TransferRequest): Promise<void> => {
  const started = await page.evaluate(input => window.api.transfers.start(input), request)
  const id = started
  await expect.poll(async () => {
    const result = await page.evaluate(operationId => window.api.transfers.get(operationId), id)
    return result && ['error', 'cancelled', 'completed'].includes(result.status)
  }, { timeout: 150_000 }).toBeTruthy()
  const result = await page.evaluate(operationId => window.api.transfers.get(operationId), id)
  expect(result, JSON.stringify(result)).toMatchObject({ status: 'completed' })
}

const withApplication = async (connection: ConnectionConfig, body: (page: Page, directory: string) => Promise<void>): Promise<void> => {
  const tls = process.env.ZEQUEL_TRANSFER_TLS_MATRIX === '1' && connection.port
    ? await createTransferTlsServer(connection.port) : undefined
  if (tls) connection = { ...connection, host: 'localhost', port: tls.port, ssl: true, sslConfig: { enabled: true, mode: SSLMode.VerifyFull, ca: tls.ca, serverName: 'localhost' } }
  const tunnel = process.env.ZEQUEL_TRANSFER_SSH_MATRIX === '1' && connection.port
    ? await createTransferSshServer(connection.port) : undefined
  if (tunnel) connection = { ...connection, host: 'localhost', ssh: { enabled: true, host: '127.0.0.1', port: tunnel.port, username: 'transfer', authMethod: 'password', password: 'isolated-test' } }
  const directory = await mkdtemp(join(tmpdir(), "zequel matrix 'ç'-"))
  const bootstrap = join(directory, 'bootstrap.cjs')
  await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  const packaged = process.env.ZEQUEL_PACKAGED_EXECUTABLE
  const app = await electron.launch({
    executablePath: packaged,
    args: [...(packaged ? [] : [bootstrap]), ...(process.env.CI && process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [])],
    cwd: process.cwd(),
    env: { ...process.env, E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile'),
      ...(packaged ? { PATH: process.platform === 'win32' ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin' } : {}) },
  })
  await prepareTransferTestApp(app)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  try {
    await page.evaluate(config => window.api.connections.save(config), connection)
    await body(page, directory)
    if (tunnel) await expect.poll(tunnel.activeConnections).toBe(0)
    if (tls) {
      await page.evaluate(config => window.api.connections.save(config), { ...connection, sslConfig: { ...connection.sslConfig, ca: tls.wrongCA } })
      await expect(page.evaluate(id => window.api.transfers.databases(id), connection.id)).rejects.toThrow()
      if (connection.type === 'mongodb') {
        const id = await page.evaluate(request => window.api.transfers.start(request), { mode: 'backup' as const, savedConnectionId: connection.id, database: connection.database, path: join(directory, 'rejected.archive'), compress: false, options: { archive: true } })
        await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(item => item?.status), id), { timeout: 60000 }).toBe('error')
        await expect(stat(join(directory, 'rejected.archive'))).rejects.toMatchObject({ code: 'ENOENT' })
      }
      if (connection.type !== 'mongodb') {
        await page.evaluate(config => window.api.connections.save(config), { ...connection, sslConfig: { ...connection.sslConfig, serverName: 'wrong.invalid' } })
        await expect(page.evaluate(id => window.api.transfers.databases(id), connection.id)).rejects.toThrow()
      }
      if (tunnel) await expect.poll(tunnel.activeConnections).toBe(0)
    }
  } finally {
    try { await page.evaluate(id => window.api.connections.delete(id), connection.id) }
    finally {
      await closeTransferTestApp(app)
      await tunnel?.close()
      await tls?.close()
      await rm(directory, { recursive: true, force: true })
    }
  }
}

for (const engine of ['mysql', 'mariadb'] as const) {
  test(`${engine}: exact values, view, trigger and routine survive a full backup`, async () => {
    const port = engine === 'mysql' ? 33061 : 33070
    const source = `zequel_matrix_${Date.now()}`
    const target = source + '_restored'
    const admin = await createConnection({ host: '127.0.0.1', port, user: 'root', password: 'zequel', supportBigNumbers: true, bigNumberStrings: true })
    try {
      await admin.query(`CREATE DATABASE ${source}`)
      await admin.query(`CREATE DATABASE ${target}`)
      await admin.query(`USE ${source}`)
      await admin.query('CREATE TABLE items (id BIGINT PRIMARY KEY, amount DECIMAL(30,8), label TEXT, payload BLOB)')
      await admin.query('INSERT INTO items VALUES (?, ?, ?, ?)', ['9007199254740993', '123456789012345678.12345678', 'Olá 🧪, "quoted"\nnext', Buffer.from([0, 255, 128])])
      await admin.query('CREATE VIEW summary AS SELECT id, amount FROM items')
      await admin.query('CREATE PROCEDURE answer() SELECT 42 AS answer')
      await admin.query('CREATE TRIGGER label_default BEFORE INSERT ON items FOR EACH ROW SET NEW.label = COALESCE(NEW.label, \'default\')')
      await withApplication({ id: source, name: engine, type: engine, host: '127.0.0.1', port, username: 'root', password: 'zequel', database: source, ssl: false } as ConnectionConfig, async (page, directory) => {
        const path = join(directory, 'database.sql')
        await runTransfer(page, { mode: 'backup' as const, savedConnectionId: source, database: source, path, compress: false, options: {} })
        await runTransfer(page, { mode: 'restore' as const, savedConnectionId: source, database: target, path, compress: false, options: {} })
      })
      await admin.query(`USE ${target}`)
      const [rows] = await admin.query('SELECT id, amount, label, HEX(payload) AS payload FROM items')
      expect(rows).toEqual([{ id: '9007199254740993', amount: '123456789012345678.12345678', label: 'Olá 🧪, "quoted"\nnext', payload: '00FF80' }])
      const [view] = await admin.query('SELECT COUNT(*) AS count FROM summary')
      expect(view).toEqual([{ count: '1' }])
      const [routine] = await admin.query('CALL answer()')
      expect(String((routine as { answer: string | number }[][])[0][0].answer)).toBe('42')
      await admin.query('INSERT INTO items(id) VALUES (2)')
      expect((await admin.query('SELECT label FROM items WHERE id = 2'))[0]).toEqual([{ label: 'default' }])
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS ${source}`)
      await admin.query(`DROP DATABASE IF EXISTS ${target}`)
      await admin.end()
    }
  })
}

test('mongodb: BSON types, indexes, empty collection and destination rename', async () => {
  const source = `zequel_matrix_${Date.now()}`
  const target = source + '_restored'
  const targets = [target, target + '_directory', target + '_zip']
  const client = await new MongoClient('mongodb://zequel:zequel@127.0.0.1:27018/?authSource=admin', { promoteLongs: false }).connect()
  try {
    const document = { _id: new ObjectId(), long: Long.fromString('9007199254740993'), amount: Decimal128.fromString('123456789012345678.12345678'), bytes: new Binary(Buffer.from([0, 255, 128])), date: new Date('2026-01-01T00:00:00Z'), label: 'Olá 🧪' }
    await client.db(source).collection('items').insertOne(document)
    await client.db(source).collection('items').createIndex({ label: 1 }, { unique: true })
    await client.db(source).createCollection('empty')
    await withApplication({ id: source, name: 'mongodb', type: 'mongodb', host: '127.0.0.1', port: 27018, username: 'zequel', password: 'zequel', database: source, ssl: false } as ConnectionConfig, async (page, directory) => {
      const path = join(directory, 'database.archive')
      await runTransfer(page, { mode: 'backup' as const, savedConnectionId: source, database: source, path, compress: false, options: { archive: true } })
      await runTransfer(page, { mode: 'restore' as const, savedConnectionId: source, database: target, path, compress: false, options: { archive: true, sourceDatabase: source } })
      for (const compress of [false, true]) {
        const path = join(directory, compress ? 'directory.zip' : 'directory')
        await runTransfer(page, { mode: 'backup', savedConnectionId: source, database: source, path, compress, options: { archive: false } })
        await runTransfer(page, { mode: 'restore', savedConnectionId: source, database: compress ? targets[2] : targets[1], path, compress: false, options: { sourceDatabase: source } })
      }
    })
    for (const target of targets) {
      const restored = await client.db(target).collection('items').findOne({})
      expect(BSON.EJSON.stringify(restored, { relaxed: false })).toBe(BSON.EJSON.stringify(document, { relaxed: false }))
      expect((await client.db(target).collection('items').indexes()).some(index => index.unique && index.key.label === 1)).toBe(true)
      expect((await client.db(target).listCollections().toArray()).map(item => item.name)).toContain('empty')
    }
  } finally {
    await client.db(source).dropDatabase()
    for (const target of targets) await client.db(target).dropDatabase()
    await client.close()
  }
})

test('redis: 50,001 keys, 10,001 stream entries, pending groups, binary and TTL', async () => {
  const source = new Redis({ host: '127.0.0.1', port: 63790, password: 'zequel', db: 14 })
  const target = new Redis({ host: '127.0.0.1', port: 63790, password: 'zequel', db: 15 })
  // Refuse to overwrite a reused database, even in the isolated project.
  expect(await source.dbsize()).toBe(0)
  expect(await target.dbsize()).toBe(0)
  try {
    for (let offset = 0; offset < 50001; offset += 1000) {
      const batch = source.pipeline()
      for (let index = offset; index < Math.min(offset + 1000, 50001); index++) batch.set(`key:${index}`, `value:${index}`)
      await batch.exec()
    }
    const entries = source.pipeline()
    for (let index = 1; index <= 10001; index++) entries.xadd('stream', `${index}-0`, 'value', String(index))
    await entries.exec()
    await source.xgroup('CREATE', 'stream', 'group', '0')
    await source.xreadgroup('GROUP', 'group', 'consumer', 'COUNT', 3, 'STREAMS', 'stream', '>')
    await source.set(Buffer.from([0, 255]), Buffer.from([0, 128, 255]), 'PX', 600000)
    await source.hset('__proto__', 'field', 'value')
    await withApplication({ id: 'redis-matrix', name: 'redis', type: 'redis', host: '127.0.0.1', port: 63790, password: 'zequel', database: '14', ssl: false } as ConnectionConfig, async (page, directory) => {
      const path = join(directory, 'database.jsonl')
      const started = Date.now()
      await runTransfer(page, { mode: 'backup' as const, savedConnectionId: 'redis-matrix', database: '14', path, compress: false, options: {} })
      const backedUp = Date.now()
      await runTransfer(page, { mode: 'restore' as const, savedConnectionId: 'redis-matrix', database: '15', path, compress: false, options: {} })
      console.log(`Redis 50k archive: backup ${backedUp - started} ms / restore ${Date.now() - backedUp} ms`)
    })
    expect(await target.dbsize()).toBe(await source.dbsize())
    expect(await target.xlen('stream')).toBe(10001)
    expect(await target.xpending('stream', 'group')).toEqual(await source.xpending('stream', 'group'))
    expect(await target.dumpBuffer('stream')).toEqual(await source.dumpBuffer('stream'))
    expect(await target.getBuffer(Buffer.from([0, 255]))).toEqual(Buffer.from([0, 128, 255]))
    expect(await target.pttl(Buffer.from([0, 255]))).toBeGreaterThan(0)
    expect(await target.hget('__proto__', 'field')).toBe('value')
    expect(await target.get('key:50000')).toBe('value:50000')
  } finally {
    await source.flushdb(); await target.flushdb()
    await source.quit(); await target.quit()
  }
})

test('redis: legacy restore preserves destinations, stream IDs and validates before writes', async () => {
  const target = new Redis({ host: '127.0.0.1', port: 63790, password: 'zequel', db: 15 })
  expect(await target.dbsize()).toBe(0)
  try {
    await target.set('existing', 'original', 'EX', 600)
    await withApplication({ id: 'redis-legacy', name: 'Redis legacy', type: 'redis', host: '127.0.0.1', port: 63790, password: 'zequel', database: '15', ssl: false } as ConnectionConfig, async (page, directory) => {
      const path = join(directory, 'legacy.json')
      const data = {
        existing: { type: 'string', value: 'replacement', ttl: -1 },
        stream: { type: 'stream', value: [{ _id: '100-3', message: 'Olá' }, { _id: '101-0', message: 'next' }], ttl: 600 },
        tasks: { type: 'list', value: ['first', 'second'], ttl: -1 },
        scores: { type: 'zset', value: [{ member: 'top', score: 'inf' }, { member: 'bottom', score: '-inf' }], ttl: -1 },
      }
      await writeFile(path, JSON.stringify({ data, _meta: { type: 'redis', version: 1 } }))
      const request = { mode: 'restore' as const, savedConnectionId: 'redis-legacy', database: '15', path, compress: false, options: {} } as TransferRequest
      const id = await page.evaluate(input => window.api.transfers.start(input), request)
      await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(result => result?.status), id)).toBe('error')
      expect(await target.get('existing')).toBe('original')
      expect(await target.ttl('existing')).toBeGreaterThan(0)
      expect(await target.dbsize()).toBe(1)
      await runTransfer(page, { ...request, options: { replace: true } })
      expect(await target.get('existing')).toBe('replacement')
      expect(await target.ttl('existing')).toBe(-1)
      expect(await target.xrange('stream', '-', '+')).toEqual([['100-3', ['message', 'Olá']], ['101-0', ['message', 'next']]])
      expect(await target.ttl('stream')).toBeGreaterThan(0)
      expect(await target.lrange('tasks', 0, -1)).toEqual(['first', 'second'])
      expect(await target.zrange('scores', 0, -1, 'WITHSCORES')).toEqual(['bottom', '-inf', 'top', 'inf'])
      await writeFile(path, JSON.stringify({ untouched: { type: 'string', value: 'no', ttl: -1 }, invalid: { type: 'stream', value: [{ _id: '0-0', message: 'invalid' }], ttl: -1 } }))
      const invalid = await page.evaluate(input => window.api.transfers.start(input), request)
      await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(result => result?.status), invalid)).toBe('error')
      expect(await target.exists('untouched')).toBe(0)
      expect(await target.keys('__zequel_restore_*')).toEqual([])
    })
  } finally { await target.flushdb(); await target.quit() }
})

test('sqlserver: server-side backup restores into a new database with new physical files', async () => {
  const source = `zequel_matrix_${Date.now()}`
  const target = source + '_restored'
  const admin = await new sql.ConnectionPool({ server: '127.0.0.1', port: 14330, user: 'sa', password: 'Zequel123!', database: 'master', options: { trustServerCertificate: true, encrypt: false } }).connect()
  try {
    await admin.request().query(`CREATE DATABASE [${source}]`)
    await admin.request().query(`USE [${source}]; CREATE TABLE items (id bigint PRIMARY KEY, amount decimal(30,8), label nvarchar(100), payload varbinary(max)); INSERT INTO items VALUES (9007199254740993, 123456789012345678.12345678, N'Olá', 0x00ff80)`)
    await withApplication({ id: source, name: 'sqlserver', type: 'sqlserver', host: '127.0.0.1', port: 14330, username: 'sa', password: 'Zequel123!', database: source, ssl: false, trustServerCertificate: true } as ConnectionConfig, async page => {
      const path = `/var/opt/mssql/data/${source}.bak`
      await runTransfer(page, { mode: 'backup' as const, savedConnectionId: source, database: source, path, compress: false, options: {} })
      await page.evaluate(({ id, name }) => window.api.transfers.createDatabase(id, name), { id: source, name: target })
      await runTransfer(page, { mode: 'restore' as const, savedConnectionId: source, database: target, path, compress: false, options: {} })
    })
    const result = await admin.request().query(`SELECT CAST(id AS varchar(30)) AS id, CAST(amount AS varchar(40)) AS amount, label, CONVERT(varchar(max), payload, 2) AS payload FROM [${target}].dbo.items`)
    expect(result.recordset).toEqual([{ id: '9007199254740993', amount: '123456789012345678.12345678', label: 'Olá', payload: '00FF80' }])
  } finally {
    await admin.request().query(`USE master; IF DB_ID('${source}') IS NOT NULL DROP DATABASE [${source}]; IF DB_ID('${target}') IS NOT NULL DROP DATABASE [${target}]`)
    await admin.close()
  }
})

for (const engine of ['sqlite', 'duckdb'] as const) {
  test(`${engine}: full dump restores into a different database file`, async () => {
    const manifest = JSON.parse(await readFile(resolve(`resources/database-tools/${process.platform}-${process.arch}/manifest.json`), 'utf8')) as { tools: { engine: string; binaries: Record<string, string> }[] }
    const executable = resolve(`resources/database-tools/${process.platform}-${process.arch}`, manifest.tools.find(tool => tool.engine === engine)!.binaries[engine === 'sqlite' ? 'sqlite3' : 'duckdb'])
    await withApplication({ id: `${engine}-matrix`, name: engine, type: engine, database: '', filepath: '' } as ConnectionConfig, async (page, directory) => {
      const source = join(directory, `source.${engine}`)
      const target = join(directory, `target.${engine}`)
      execFileSync(executable, [source, "CREATE TABLE items (id BIGINT PRIMARY KEY, label TEXT); INSERT INTO items VALUES (9007199254740993, 'Olá'); CREATE VIEW summary AS SELECT * FROM items;"])
      await page.evaluate(config => window.api.connections.save(config), { id: `${engine}-matrix`, name: engine, type: engine, database: source, filepath: source } as ConnectionConfig)
      const editor = await page.evaluate(config => window.api.connections.connectWithConfig(config), { id: `${engine}-open-editor`, name: 'Open file editor', type: engine, database: source, filepath: source } as ConnectionConfig)
      const path = join(directory, 'database.sql')
      await runTransfer(page, { mode: 'backup' as const, savedConnectionId: `${engine}-matrix`, database: source, path, compress: false, options: {} })
      await runTransfer(page, { mode: 'restore' as const, savedConnectionId: `${engine}-matrix`, database: target, path, compress: false, options: {} })
      expect(execFileSync(executable, [target, '-json', 'SELECT CAST(id AS TEXT) AS id, label FROM summary'], { encoding: 'utf8' }).trim()).toContain('9007199254740993')
      expect(execFileSync(executable, [target, '-json', 'SELECT label FROM items'], { encoding: 'utf8' })).toContain('Olá')
      await page.evaluate(id => window.api.connections.disconnect(id), editor)
      const before = await readFile(target)
      const repeated = await page.evaluate(request => window.api.transfers.start(request), { mode: 'restore' as const, savedConnectionId: `${engine}-matrix`, database: target, path, compress: false, options: {} })
      await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => value?.status), repeated)).toBe('error')
      expect(await readFile(target)).toEqual(before)
      const broken = join(directory, 'broken.sql')
      const failedTarget = join(directory, `failed.${engine}`)
      await writeFile(broken, 'CREATE TABLE partial(id INTEGER); SELECT * FROM definitely_missing_table;')
      const failed = await page.evaluate(request => window.api.transfers.start(request), { mode: 'restore' as const, savedConnectionId: `${engine}-matrix`, database: failedTarget, path: broken, compress: false, options: {} })
      await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => value?.status), failed)).toBe('error')
      await expect(readFile(failedTarget)).rejects.toThrow()
      const scaleSql = engine === 'sqlite'
        ? "CREATE TABLE scale AS WITH RECURSIVE rows(id) AS (VALUES(1) UNION ALL SELECT id + 1 FROM rows WHERE id < 100000) SELECT id, 'sample row' AS label FROM rows"
        : "CREATE TABLE scale AS SELECT i AS id, 'sample row' AS label FROM range(1, 100001) r(i)"
      execFileSync(executable, [source, scaleSql + '; CREATE TABLE imported(id BIGINT, label TEXT);'])
      const session = await page.evaluate(config => window.api.connections.connectWithConfig(config), { id: `${engine}-rows`, name: 'Isolated row scale', type: engine, database: source, filepath: source } as ConnectionConfig)
      const rowsPath = join(directory, 'rows.csv')
      const startedAt = Date.now()
      const exported = await page.evaluate(({ session, rowsPath }) => window.api.export.tableToFile(session, 'scale', rowsPath, { format: 'csv' as ExportFormat, includeHeaders: true }), { session, rowsPath })
      expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
      const exportMs = Date.now() - startedAt
      const importStarted = Date.now()
      const imported = await page.evaluate(({ session, rowsPath }) => window.api.import.execute(session, 'imported', rowsPath, 'csv', [{ sourceColumn: 'id', targetColumn: 'id', targetType: 'BIGINT' }, { sourceColumn: 'label', targetColumn: 'label', targetType: 'TEXT' }], {}), { session, rowsPath })
      expect(imported, JSON.stringify(imported)).toMatchObject({ success: true, insertedRows: 100000 })
      console.log(`${process.platform}-${process.arch} ${engine} 100000 rows: export ${exportMs} ms, import ${Date.now() - importStarted} ms`)
      await page.evaluate(id => window.api.connections.disconnect(id), session)
      expect(execFileSync(executable, [source, '-json', 'SELECT count(*) AS count FROM imported'], { encoding: 'utf8' }).trim()).toContain('100000')
    })
  })
}

test('sqlite: cancelling ZIP compression removes staging without publishing a partial backup', async () => {
  const manifest = JSON.parse(await readFile(resolve(`resources/database-tools/${process.platform}-${process.arch}/manifest.json`), 'utf8')) as { tools: { engine: string; binaries: Record<string, string> }[] }
  const executable = resolve(`resources/database-tools/${process.platform}-${process.arch}`, manifest.tools.find(tool => tool.engine === 'sqlite')!.binaries.sqlite3)
  await withApplication({ id: 'sqlite-compression', name: 'Compression fixture', type: 'sqlite', database: '', filepath: '' } as ConnectionConfig, async (page, directory) => {
    const source = join(directory, 'large.sqlite')
    execFileSync(executable, [source, 'CREATE TABLE items(payload BLOB); WITH RECURSIVE rows(id) AS (VALUES(1) UNION ALL SELECT id + 1 FROM rows WHERE id < 64) INSERT INTO items SELECT randomblob(1048576) FROM rows;'])
    const path = join(directory, 'cancelled.zip')
    const request: TransferRequest = { mode: 'backup', savedConnectionId: 'sqlite-compression', database: source, path, compress: true, options: {} }
    const id = await page.evaluate(request => window.api.transfers.start(request), request)
    await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => value?.metrics?.phase), id), { intervals: [25], timeout: 60000 }).toBe('compressing')
    await page.evaluate(id => window.api.transfers.cancel(id), id)
    await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => value?.status), id)).toBe('cancelled')
    await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readdir(directory)).filter(name => name.startsWith('.zequel-backup-'))).toEqual([])
    expect(execFileSync(executable, [source, 'SELECT count(*) FROM items'], { encoding: 'utf8' }).trim()).toBe('64')
  })
})

test('clickhouse: streamed SQL preserves exact values and restores view references into destination', async () => {
  const source = `zequel_matrix_${Date.now()}`
  const target = source + '_restored'
  const client = createClient({ url: 'http://127.0.0.1:18123', username: 'zequel', password: 'zequel' })
  try {
    await client.command({ query: `CREATE DATABASE ${source}` })
    await client.command({ query: `CREATE DATABASE ${target}` })
    await client.command({ query: `CREATE TABLE ${source}.items (id UInt64, amount Decimal(30,8), label Nullable(String), tags Array(String)) ENGINE = MergeTree ORDER BY id` })
    await client.command({ query: `INSERT INTO ${source}.items VALUES (9007199254740993, 123456789012345678.12345678, 'Olá; quoted', ['one', 'two'])` })
    await client.command({ query: `CREATE VIEW ${source}.summary AS SELECT * FROM ${source}.items` })
    await withApplication({ id: source, name: 'clickhouse', type: 'clickhouse', host: '127.0.0.1', port: 18123, username: 'zequel', password: 'zequel', database: source, ssl: false } as ConnectionConfig, async (page, directory) => {
      const path = join(directory, 'database.sql')
      await runTransfer(page, { mode: 'backup' as const, savedConnectionId: source, database: source, path, compress: false, options: {} })
      await runTransfer(page, { mode: 'restore' as const, savedConnectionId: source, database: target, path, compress: false, options: {} })
      const slowPath = join(directory, 'slow.sql')
      const marker = `cancel_${source}`
      await writeFile(slowPath, `SELECT sleepEachRow(0.05) FROM numbers(1000) SETTINGS max_block_size=10 /* ${marker} */;`)
      const operation = await page.evaluate(request => window.api.transfers.start(request), { mode: 'restore' as const, savedConnectionId: source, database: target, path: slowPath, compress: false, options: {} })
      const active = async (): Promise<number> => {
        const result = await client.query({ query: 'SELECT count() AS count FROM system.processes WHERE query LIKE {pattern:String} AND query NOT LIKE \'%system.processes%\'', query_params: { pattern: `%${marker}%` }, format: 'JSONEachRow' })
        return Number((await result.json<{ count: string }>())[0].count)
      }
      await expect.poll(active).toBe(1)
      await page.evaluate(id => window.api.transfers.cancel(id), operation)
      await expect.poll(async () => (await page.evaluate(id => window.api.transfers.get(id), operation))?.status).toBe('cancelled')
      await expect.poll(active).toBe(0)
    })
    await client.command({ query: `DROP DATABASE ${source}` })
    const result = await client.query({ query: `SELECT toString(id) AS id, toString(amount) AS amount, label, tags FROM ${target}.summary`, format: 'JSONEachRow' })
    expect(await result.json()).toEqual([{ id: '9007199254740993', amount: '123456789012345678.12345678', label: 'Olá; quoted', tags: ['one', 'two'] }])
  } finally {
    await client.command({ query: `DROP DATABASE IF EXISTS ${source}` })
    await client.command({ query: `DROP DATABASE IF EXISTS ${target}` })
    await client.close()
  }
})

test('postgresql: ZIP round trips for plain, custom and directory formats without deleting the final archive', async () => {
  const source = `zequel_zip_${Date.now()} = 'á'`
  const admin = new Client({ host: '127.0.0.1', port: 54320, user: 'zequel', password: 'zequel', database: 'postgres' })
  await admin.connect()
  const targets: string[] = []
  try {
    await admin.query(`CREATE DATABASE "${source}"`)
    const seed = new Client({ host: '127.0.0.1', port: 54320, user: 'zequel', password: 'zequel', database: source })
    await seed.connect()
    await seed.query("CREATE TABLE items(id bigint, payload bytea); INSERT INTO items VALUES(9007199254740993, decode('00ff80','hex'))")
    await seed.end()
    await withApplication({ id: source, name: 'ZIP fixtures', type: 'postgresql', host: '127.0.0.1', port: 54320, username: 'zequel', password: 'zequel', database: source, ssl: false } as ConnectionConfig, async (page, directory) => {
      for (const format of ['plain', 'custom', 'directory']) {
        const target = `${source}_${format}`
        targets.push(target)
        await admin.query(`CREATE DATABASE "${target}"`)
        const path = join(directory, `${format}.zip`)
        await runTransfer(page, { mode: 'backup' as const, savedConnectionId: source, database: source, path, compress: true, options: { format } })
        expect((await readFile(path)).subarray(0, 2).toString()).toBe('PK')
        await runTransfer(page, { mode: 'restore' as const, savedConnectionId: source, database: target, path, compress: false, options: {} })
        const restored = new Client({ host: '127.0.0.1', port: 54320, user: 'zequel', password: 'zequel', database: target })
        await restored.connect()
        try { expect((await restored.query("SELECT id, encode(payload, 'hex') AS payload FROM items")).rows).toEqual([{ id: '9007199254740993', payload: '00ff80' }]) }
        finally { await restored.end() }
      }
    })
  } finally {
    for (const database of [source, ...targets]) await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.end()
  }
})
