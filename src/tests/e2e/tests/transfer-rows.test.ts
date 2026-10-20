import { createTransferSshServer } from '@e2e/helpers/transfer-ssh'
import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { ExportFormat } from '@/types/table'
import { test, expect, _electron as electron, type Page } from '@playwright/test'
import { createConnection } from 'mysql2/promise'
import sql from 'mssql'
import { Client } from 'pg'
import { createClient } from '@clickhouse/client'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import type { ConnectionConfig } from '@main/types'

// Only run against the explicitly provisioned, isolated compose project.
test.skip(process.env.ZEQUEL_TRANSFER_MATRIX !== '1', 'Requires the isolated zequel-transfer-test compose project')
test.setTimeout(300_000)

const ROWS = 2505
type Row = Record<string, unknown>

interface Engine {
  name: 'postgresql' | 'mysql' | 'mariadb' | 'sqlserver' | 'clickhouse' | 'sqlite' | 'duckdb'
  /** Creates an isolated database and returns the connection plus its cleanup. */
  provision: (directory: string, suffix: string) => Promise<{ config: ConnectionConfig; drop: () => Promise<void> }>
  schema?: string
  prepare?: string
  create: (table: string) => string
  seed: string[]
  /** Every value as the engine's own text representation, so drivers cannot hide differences. */
  canonical: (table: string) => string
}

const mysqlLike = (name: 'mysql' | 'mariadb', port: number): Engine => ({
  name,
  provision: async (_directory, suffix) => {
    const database = `zequel_rows_${suffix}`
    const admin = await createConnection({ host: '127.0.0.1', port, user: 'root', password: 'zequel' })
    await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`)
    return {
      config: { id: database, name, type: name, host: '127.0.0.1', port, username: 'root', password: 'zequel', database, ssl: false } as ConnectionConfig,
      drop: async () => { try { await admin.query(`DROP DATABASE IF EXISTS ${database}`) } finally { await admin.end() } },
    }
  },
  create: table => `CREATE TABLE ${table} (id INT PRIMARY KEY, big BIGINT, amount DECIMAL(30,8), label TEXT, payload BLOB, flag TINYINT(1), day DATE, ts DATETIME, doc JSON) CHARACTER SET utf8mb4`,
  seed: [
    `INSERT INTO src VALUES (1, 9007199254740993, 123456789012345678.12345678, CONCAT('Olá 🧪, "quoted"', CHAR(10), 'next; line', CHAR(9), 'tab \\\\ back'), X'00FF80', 1, '2026-01-02', '2026-01-02 03:04:05', '{"a": [1, "x"]}')`,
    'INSERT INTO src (id) VALUES (2)',
    `INSERT INTO src VALUES (3, -9007199254740993, -0.00000001, '', X'', 0, '1999-12-31', '1999-12-31 23:59:59', '{}')`,
    `INSERT INTO src (id, big, amount, label) VALUES (4, 0, 0, '\\\\N')`,
    `INSERT INTO src (id, label) VALUES (5, 'NULL')`,
    `INSERT INTO src SELECT n, n * 1000, n / 7, CONCAT('row ', n), UNHEX(HEX(n)), n % 2, DATE_ADD('2026-01-01', INTERVAL n DAY), DATE_ADD('2026-01-01 00:00:00', INTERVAL n MINUTE), JSON_OBJECT('n', n)
      FROM (SELECT a.d + b.d * 10 + c.d * 100 + e.d * 1000 AS n FROM ${digits} a, ${digits} b, ${digits} c, ${digits} e) numbers WHERE n BETWEEN 100 AND 2599`,
  ],
  canonical: table => `SELECT id, CAST(big AS CHAR) AS big, CAST(amount AS CHAR) AS amount, label, HEX(payload) AS payload, CAST(flag AS CHAR) AS flag, CAST(day AS CHAR) AS day, CAST(ts AS CHAR) AS ts, CAST(doc AS CHAR) AS doc FROM ${table} ORDER BY id`,
})
const digits = '(SELECT 0 AS d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9)'

const ENGINES: Engine[] = [
  {
    name: 'postgresql',
    schema: 'rows schema',
    prepare: 'CREATE SCHEMA "rows schema"',
    provision: async (_directory, suffix) => {
      const database = `zequel_rows_${suffix}`
      const admin = new Client({ host: '127.0.0.1', port: 54320, user: 'zequel', password: 'zequel', database: 'postgres' })
      await admin.connect()
      await admin.query(`CREATE DATABASE "${database}"`)
      return {
        config: { id: database, name: 'postgresql', type: 'postgresql', host: '127.0.0.1', port: 54320, username: 'zequel', password: 'zequel', database, ssl: false } as ConnectionConfig,
        drop: async () => { try { await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`) } finally { await admin.end() } },
      }
    },
    create: table => `CREATE TABLE "rows schema".${table} (id integer PRIMARY KEY, big bigint, amount numeric(30,8), label text, payload bytea, flag boolean, day date, ts timestamp, doc jsonb)`,
    seed: [
      `INSERT INTO "rows schema".src VALUES (1, 9007199254740993, 123456789012345678.12345678, 'Olá 🧪, "quoted"' || chr(10) || 'next; line' || chr(9) || 'tab \\ back', '\\x00ff80', true, '2026-01-02', '2026-01-02 03:04:05', '{"a": [1, "x"]}')`,
      'INSERT INTO "rows schema".src (id) VALUES (2)',
      `INSERT INTO "rows schema".src VALUES (3, -9007199254740993, -0.00000001, '', '\\x', false, '1999-12-31', '1999-12-31 23:59:59', '{}')`,
      `INSERT INTO "rows schema".src (id, big, amount, label) VALUES (4, 0, 0, '\\N')`,
      `INSERT INTO "rows schema".src (id, label) VALUES (5, 'NULL')`,
      `INSERT INTO "rows schema".src SELECT n, n * 1000, n / 7.0, 'row ' || n, int4send(n), n % 2 = 0, DATE '2026-01-01' + n, TIMESTAMP '2026-01-01' + n * INTERVAL '1 minute', jsonb_build_object('n', n) FROM generate_series(100, 2599) n`,
    ],
    canonical: table => `SELECT id, big::text AS big, amount::text AS amount, label, encode(payload, 'hex') AS payload, flag::text AS flag, day::text AS day, ts::text AS ts, doc::text AS doc FROM "rows schema".${table} ORDER BY id`,
  },
  mysqlLike('mysql', 33061),
  mysqlLike('mariadb', 33070),
  {
    name: 'sqlserver',
    provision: async (_directory, suffix) => {
      const database = `zequel_rows_${suffix}`
      const admin = await new sql.ConnectionPool({ server: '127.0.0.1', port: 14330, user: 'sa', password: 'Zequel123!', database: 'master', options: { trustServerCertificate: true, encrypt: false } }).connect()
      await admin.request().query(`CREATE DATABASE [${database}]`)
      return {
        config: { id: database, name: 'sqlserver', type: 'sqlserver', host: '127.0.0.1', port: 14330, username: 'sa', password: 'Zequel123!', database, ssl: false, trustServerCertificate: true } as ConnectionConfig,
        drop: async () => {
          try { await admin.request().query(`IF DB_ID('${database}') IS NOT NULL BEGIN ALTER DATABASE [${database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${database}] END`) }
          finally { await admin.close() }
        },
      }
    },
    create: table => `CREATE TABLE ${table} (id int PRIMARY KEY, big bigint, amount decimal(30,8), label nvarchar(max), payload varbinary(max), flag bit, day date, ts datetime2(0), doc nvarchar(max))`,
    seed: [
      `INSERT INTO src VALUES (1, 9007199254740993, 123456789012345678.12345678, N'Olá 🧪, "quoted"' + CHAR(10) + N'next; line' + CHAR(9) + N'tab \\ back', 0x00FF80, 1, '2026-01-02', '2026-01-02 03:04:05', N'{"a": [1, "x"]}')`,
      'INSERT INTO src (id) VALUES (2)',
      `INSERT INTO src VALUES (3, -9007199254740993, -0.00000001, N'', 0x, 0, '1999-12-31', '1999-12-31 23:59:59', N'{}')`,
      `INSERT INTO src (id, big, amount, label) VALUES (4, 0, 0, N'\\N')`,
      `INSERT INTO src (id, label) VALUES (5, N'NULL')`,
      `INSERT INTO src SELECT n, CAST(n AS bigint) * 1000, n / 7.0, CONCAT(N'row ', n), CAST(n AS varbinary(4)), n % 2, DATEADD(day, n, '2026-01-01'), DATEADD(minute, n, CAST('2026-01-01' AS datetime2(0))), CONCAT(N'{"n":', n, N'}')
        FROM (SELECT a.d + b.d * 10 + c.d * 100 + e.d * 1000 AS n FROM ${digits} a, ${digits} b, ${digits} c, ${digits} e) numbers WHERE n BETWEEN 100 AND 2599`,
    ],
    canonical: table => `SELECT id, CAST(big AS varchar(30)) AS big, CAST(amount AS varchar(50)) AS amount, label, CONVERT(varchar(max), payload, 2) AS payload, CAST(flag AS varchar(1)) AS flag, CONVERT(varchar(10), day, 23) AS day, CONVERT(varchar(19), ts, 120) AS ts, doc FROM ${table} ORDER BY id`,
  },
  {
    name: 'clickhouse',
    provision: async (_directory, suffix) => {
      const database = `zequel_rows_${suffix}`
      const admin = createClient({ url: 'http://127.0.0.1:18123', username: 'zequel', password: 'zequel' })
      await admin.command({ query: `CREATE DATABASE ${database}` })
      return {
        config: { id: database, name: 'clickhouse', type: 'clickhouse', host: '127.0.0.1', port: 18123, username: 'zequel', password: 'zequel', database, ssl: false } as ConnectionConfig,
        drop: async () => { try { await admin.command({ query: `DROP DATABASE IF EXISTS ${database}` }) } finally { await admin.close() } },
      }
    },
    // ClickHouse has no separate binary type; payload holds text here.
    create: table => `CREATE TABLE ${table} (id Int32, big Nullable(Int64), amount Nullable(Decimal(30,8)), label Nullable(String), payload Nullable(String), flag Nullable(Bool), day Nullable(Date), ts Nullable(DateTime), doc Nullable(String)) ENGINE = MergeTree ORDER BY id`,
    seed: [
      `INSERT INTO src VALUES (1, 9007199254740993, 123456789012345678.12345678, 'Olá 🧪, "quoted"\\nnext; line\\ttab \\\\ back', 'bytes', true, '2026-01-02', '2026-01-02 03:04:05', '{"a": [1, "x"]}')`,
      'INSERT INTO src (id) VALUES (2)',
      `INSERT INTO src VALUES (3, -9007199254740993, -0.00000001, '', '', false, '1999-12-31', '1999-12-31 23:59:59', '{}')`,
      `INSERT INTO src (id, big, amount, label) VALUES (4, 0, 0, '\\\\N')`,
      `INSERT INTO src (id, label) VALUES (5, 'NULL')`,
      `INSERT INTO src SELECT number, number * 1000, toDecimal128(number / 7, 8), concat('row ', toString(number)), hex(number), number % 2 = 1, toDate('2026-01-01') + number, toDateTime('2026-01-01 00:00:00') + number * 60, concat('{"n":', toString(number), '}') FROM numbers(100, 2500)`,
    ],
    canonical: table => `SELECT id, toString(big) AS big, toString(amount) AS amount, label, payload, toString(flag) AS flag, toString(day) AS day, toString(ts) AS ts, doc FROM ${table} ORDER BY id`,
  },
  ...(['sqlite', 'duckdb'] as const).map((name): Engine => ({
    name,
    provision: async directory => {
      const database = join(directory, `rows.${name}`)
      return { config: { id: `${name}-rows`, name, type: name, database, filepath: database } as ConnectionConfig, drop: async () => {} }
    },
    create: table => name === 'sqlite'
      ? `CREATE TABLE ${table} (id INTEGER PRIMARY KEY, big INTEGER, amount TEXT, label TEXT, payload BLOB, flag BOOLEAN, day DATE, ts DATETIME, doc TEXT)`
      : `CREATE TABLE ${table} (id INTEGER PRIMARY KEY, big BIGINT, amount DECIMAL(30,8), label VARCHAR, payload BLOB, flag BOOLEAN, day DATE, ts TIMESTAMP, doc VARCHAR)`,
    seed: [
      `INSERT INTO src VALUES (1, 9007199254740993, '123456789012345678.12345678', 'Olá 🧪, "quoted"' || chr(10) || 'next; line' || chr(9) || 'tab \\ back', ${name === 'sqlite' ? "X'00FF80'" : "'\\x00\\xFF\\x80'::BLOB"}, true, '2026-01-02', '2026-01-02 03:04:05', '{"a": [1, "x"]}')`.replace(/chr\(/g, name === 'sqlite' ? 'char(' : 'chr('),
      'INSERT INTO src (id) VALUES (2)',
      `INSERT INTO src VALUES (3, -9007199254740993, '-0.00000001', '', ${name === 'sqlite' ? "X''" : "''::BLOB"}, false, '1999-12-31', '1999-12-31 23:59:59', '{}')`,
      `INSERT INTO src (id, big, amount, label) VALUES (4, 0, '0', '\\N')`,
      `INSERT INTO src (id, label) VALUES (5, 'NULL')`,
      name === 'sqlite'
        ? `WITH RECURSIVE numbers(n) AS (VALUES(100) UNION ALL SELECT n + 1 FROM numbers WHERE n < 2599)
           INSERT INTO src SELECT n, n * 1000, printf('%.8f', n / 7.0), 'row ' || n, randomblob(4), n % 2, date('2026-01-01', '+' || n || ' days'), datetime('2026-01-01', '+' || n || ' minutes'), json_object('n', n) FROM numbers`
        : `INSERT INTO src SELECT n, n * 1000, n / 7, 'row ' || n, encode(n::VARCHAR), n % 2 = 0, DATE '2026-01-01' + n::INTEGER, TIMESTAMP '2026-01-01' + to_minutes(n), '{"n":' || n || '}' FROM range(100, 2600) t(n)`,
    ],
    canonical: table => name === 'sqlite'
      // typeof() also catches values imported with the wrong storage class.
      ? `SELECT id, CAST(big AS TEXT) AS big, typeof(big) AS big_type, amount, label, hex(payload) AS payload, typeof(payload) AS payload_type, CAST(flag AS TEXT) AS flag, typeof(flag) AS flag_type, day, ts, doc FROM ${table} ORDER BY id`
      : `SELECT id, CAST(big AS VARCHAR) AS big, CAST(amount AS VARCHAR) AS amount, label, hex(payload) AS payload, CAST(flag AS VARCHAR) AS flag, CAST(day AS VARCHAR) AS day, CAST(ts AS VARCHAR) AS ts, doc FROM ${table} ORDER BY id`,
  })),
]

const execute = async (page: Page, session: string, statement: string): Promise<Row[]> => {
  const result = await page.evaluate(({ session, statement }) => window.api.query.execute(session, statement), { session, statement })
  expect(result.error, statement).toBeUndefined()
  return result.rows
}

const withApplication = async (connection: ConnectionConfig, body: (page: Page, directory: string, config: ConnectionConfig) => Promise<void>, directory: string): Promise<void> => {
  const tunnel = process.env.ZEQUEL_TRANSFER_SSH_MATRIX === '1' && connection.port
    ? await createTransferSshServer(connection.port) : undefined
  if (tunnel) connection = { ...connection, host: 'localhost', ssh: { enabled: true, host: '127.0.0.1', port: tunnel.port, username: 'transfer', authMethod: 'password', password: 'isolated-test' } }
  const bootstrap = join(directory, 'bootstrap.cjs')
  await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  const packaged = process.env.ZEQUEL_PACKAGED_EXECUTABLE
  const app = await electron.launch({
    executablePath: packaged,
    args: [...(packaged ? [] : [bootstrap]), ...(process.env.CI && process.platform === 'linux' ? ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] : [])],
    cwd: process.cwd(),
    // A non-UTC zone exposes Date values printed in the wrong clock; CI runners default to UTC.
    env: { ...process.env, TZ: 'America/Sao_Paulo', E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile'),
      ...(packaged ? { PATH: process.platform === 'win32' ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin' } : {}) },
  })
  try {
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await body(page, directory, connection)
  } finally {
    await closeTransferTestApp(app)
    await tunnel?.close()
  }
}

for (const engine of ENGINES) {
  test(`${engine.name}: CSV, JSON and SQL row exports import back exactly`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "zequel rows 'ç'-"))
    const { config, drop } = await engine.provision(directory, `${Date.now()}`)
    try {
      await withApplication(config, async (page, directory, connection) => {
        const session = await page.evaluate(config => window.api.connections.connectWithConfig(config), connection)
        if (engine.prepare) await execute(page, session, engine.prepare)
        for (const table of ['src', 'dst']) await execute(page, session, engine.create(table))
        for (const statement of engine.seed) await execute(page, session, statement)
        const expected = await execute(page, session, engine.canonical('src'))
        expect(expected).toHaveLength(ROWS)
        const schema = engine.schema
        const columns = await page.evaluate(({ session, schema }) => window.api.import.getTableColumns(session, 'dst', schema), { session, schema })
        expect(columns.error).toBeUndefined()
        // The same mappings and options the import dialog sends.
        const mappings = columns.columns.map(column => ({ sourceColumn: column.name, targetColumn: column.name, targetType: column.type }))
        const importBack = async (label: string, path: string, format: 'csv' | 'json'): Promise<void> => {
          const imported = await page.evaluate(({ session, path, format, mappings, schema }) => window.api.import.execute(session, 'dst', path, format, mappings, {
            hasHeaders: true, delimiter: format === 'csv' ? ',' : undefined, nullToken: '\\N', truncateTable: true, batchSize: 500, schema,
          }), { session, path, format, mappings, schema })
          expect(imported, `${label}: ${JSON.stringify(imported)}`).toMatchObject({ success: true, insertedRows: ROWS })
          expect(await execute(page, session, engine.canonical('dst')), label).toEqual(expected)
        }

        for (const format of [ExportFormat.CSV, ExportFormat.JSON]) {
          const path = join(directory, `table.${format}`)
          const exported = await page.evaluate(({ session, path, format, schema }) => window.api.export.tableToFile(session, 'src', path, { format, includeHeaders: true, nullAsEmpty: false, prettyPrint: true, schema }), { session, path, format, schema })
          expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
          await importBack(`table ${format}`, path, format as 'csv' | 'json')

          // "Export current page" sends the grid's already-loaded rows through IPC.
          const pagePath = join(directory, `page.${format}`)
          const pageExport = await page.evaluate(async ({ session, pagePath, format, schema }) => {
            // Like the grid, select the schema first instead of qualifying the table.
            if (schema) await window.api.schema.setCurrentSchema(session, schema)
            const data = await window.api.schema.tableData(session, 'src', { limit: 5000 })
            return window.api.export.toFile({ format, columns: data.columns.map(column => ({ name: column.name, type: column.type })), rows: data.rows, tableName: 'src', schema, filePath: pagePath, includeHeaders: true, nullAsEmpty: false, prettyPrint: true, connectionId: session })
          }, { session, pagePath, format, schema })
          expect(pageExport, JSON.stringify(pageExport)).toMatchObject({ success: true })
          await importBack(`page ${format}`, pagePath, format as 'csv' | 'json')
        }

        // SQL exports run back through the editor's script runner into the emptied source table.
        const runScript = async (label: string, path: string): Promise<void> => {
          // ClickHouse DELETE needs WHERE and runs asynchronously; TRUNCATE is immediate.
          await execute(page, session, engine.name === 'clickhouse' ? 'TRUNCATE TABLE src' : `DELETE FROM ${schema ? `"${schema}".` : ''}src`)
          const script = await readFile(path, 'utf8')
          const ran = await page.evaluate(({ session, script }) => window.api.query.executeMultiple(session, script), { session, script })
          expect(ran.results.map(result => result.error).filter(Boolean), label).toEqual([])
          expect(await execute(page, session, engine.canonical('src')), label).toEqual(expected)
        }
        const sqlPath = join(directory, 'table.sql')
        const exported = await page.evaluate(({ session, sqlPath, schema }) => window.api.export.tableToFile(session, 'src', sqlPath, { format: 'sql' as ExportFormat, includeSchema: Boolean(schema), schema }), { session, sqlPath, schema })
        expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
        const pageSqlPath = join(directory, 'page.sql')
        const pageSql = await page.evaluate(async ({ session, pageSqlPath, schema }) => {
          if (schema) await window.api.schema.setCurrentSchema(session, schema)
          const data = await window.api.schema.tableData(session, 'src', { limit: 5000 })
          return window.api.export.toFile({ format: 'sql' as ExportFormat, columns: data.columns.map(column => ({ name: column.name, type: column.type })), rows: data.rows, tableName: 'src', schema, includeSchema: Boolean(schema), filePath: pageSqlPath, connectionId: session })
        }, { session, pageSqlPath, schema })
        expect(pageSql, JSON.stringify(pageSql)).toMatchObject({ success: true })
        await runScript('table sql', sqlPath)
        await runScript('page sql', pageSqlPath)
        await page.evaluate(id => window.api.connections.disconnect(id), session)
      }, directory)
    } finally {
      await drop()
      await rm(directory, { recursive: true, force: true })
    }
  })
}
