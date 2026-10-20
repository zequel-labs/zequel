import { createConnection } from 'mysql2/promise'
import type { ConnectionConfig } from '@/types/connection'
import type { TransferRequest } from '@main/types'
import { DatabaseType } from '@/types/connection'
import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { test, expect, _electron as electron } from '@playwright/test'
import { createTransferSshServer } from '@e2e/helpers/transfer-ssh'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Client } from 'pg'

test('standalone backup and restore preserve TLS identity through a dedicated SSH tunnel', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_TLS_CA || !process.env.ZEQUEL_TRANSFER_TEST_PG_PORT, 'Requires an isolated TLS PostgreSQL server and its test CA')
  test.setTimeout(120_000)
  const port = Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT)
  const ca = await readFile(process.env.ZEQUEL_TRANSFER_TLS_CA!, 'utf8')
  const directory = await mkdtemp(join(tmpdir(), 'zequel-ssh-tls-'))
  const source = `transfer_tls_${Date.now()}`
  const target = source + '_restored'
  const admin = new Client({ host: '127.0.0.1', port, user: 'zequel_test', database: 'postgres' })
  const { server, port: sshPort } = await createTransferSshServer(port)
  await admin.connect()
  await admin.query(`CREATE DATABASE "${source}"`)
  await admin.query(`CREATE DATABASE "${target}"`)
  const seed = new Client({ host: '127.0.0.1', port, user: 'zequel_test', database: source })
  await seed.connect()
  await seed.query('CREATE TABLE items (id bigint); INSERT INTO items VALUES (9007199254740993)')
  await seed.end()
  const bootstrap = join(directory, 'bootstrap.cjs')
  await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  const app = await electron.launch({ args: [bootstrap], env: { ...process.env, E2E: '1' } })
  try {
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const config: ConnectionConfig = {
      id: source, name: 'Isolated SSH with verified TLS', type: DatabaseType.PostgreSQL,
      host: 'localhost', port, username: 'zequel_test', database: source, ssl: true,
      sslConfig: { enabled: true, mode: 'verify-full', ca, serverName: 'localhost' },
      ssh: { enabled: true, host: '127.0.0.1', port: sshPort, username: 'transfer', authMethod: 'password', password: 'isolated-test' },
    }
    await page.evaluate(config => window.api.connections.save(config), config)
    expect(await page.evaluate(id => window.api.transfers.databases(id), source)).toEqual(expect.arrayContaining([expect.objectContaining({ name: source })]))
    for (const mode of ['backup', 'restore'] as const) {
      const operation = await page.evaluate(request => window.api.transfers.start(request), {
        mode, savedConnectionId: source, database: mode === 'backup' ? source : target,
        path: join(directory, 'database.dump'), compress: false,
        options: (mode === 'backup' ? { format: 'custom' } : { 'no-owner': true }) as TransferRequest['options'],
      })
      await expect.poll(async () => {
        const result = await page.evaluate(id => window.api.transfers.get(id), operation)
        return result && ['error', 'completed', 'cancelled'].includes(result.status) ? result.status : 'running'
      }).toBe('completed')
    }
    const restored = new Client({ host: '127.0.0.1', port, user: 'zequel_test', database: target })
    await restored.connect()
    try { expect((await restored.query('SELECT id FROM items')).rows).toEqual([{ id: '9007199254740993' }]) }
    finally { await restored.end() }
    await page.evaluate(config => window.api.connections.save(config), { ...config, sslConfig: { ...config.sslConfig, serverName: 'wrong.invalid' } })
    await expect(page.evaluate(id => window.api.transfers.databases(id), source)).rejects.toThrow()
  } finally {
    await closeTransferTestApp(app)
    server.close()
    await admin.query(`DROP DATABASE IF EXISTS "${source}" WITH (FORCE)`)
    await admin.query(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`)
    await admin.end()
    await rm(directory, { recursive: true, force: true })
  }
})


test('MySQL backup and restore verify the CA through SSH and reject a wrong CA', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_MYSQL_CA || !process.env.ZEQUEL_TRANSFER_TLS_CA, 'Requires the isolated MySQL CA and unrelated PostgreSQL CA')
  test.setTimeout(120_000)
  const ca = await readFile(process.env.ZEQUEL_TRANSFER_MYSQL_CA!, 'utf8')
  const wrongCA = await readFile(process.env.ZEQUEL_TRANSFER_TLS_CA!, 'utf8')
  const directory = await mkdtemp(join(tmpdir(), 'zequel-mysql-tls-'))
  const source = `transfer_mysql_tls_${Date.now()}`
  const target = source + '_restored'
  const admin = await createConnection({ host: '127.0.0.1', port: 33061, user: 'root', password: 'zequel' })
  const { server, port: sshPort } = await createTransferSshServer(33061)
  await admin.query(`CREATE DATABASE ${source}`)
  await admin.query(`CREATE DATABASE ${target}`)
  await admin.query(`CREATE TABLE ${source}.items (id bigint)`)
  await admin.query(`INSERT INTO ${source}.items VALUES (9007199254740993)`)
  const bootstrap = join(directory, 'bootstrap.cjs')
  await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  const app = await electron.launch({ args: [bootstrap], env: { ...process.env, E2E: '1' } })
  try {
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const config: ConnectionConfig = {
      id: source, name: 'MySQL SSH/TLS fixture', type: DatabaseType.MySQL,
      host: 'localhost', port: 33061, username: 'root', password: 'zequel', database: source, ssl: true,
      sslConfig: { enabled: true, mode: 'verify-ca', ca },
      ssh: { enabled: true, host: '127.0.0.1', port: sshPort, username: 'transfer', authMethod: 'password', password: 'isolated-test' },
    }
    await page.evaluate(config => window.api.connections.save(config), config)
    expect(await page.evaluate(id => window.api.transfers.databases(id), source)).toEqual(expect.arrayContaining([expect.objectContaining({ name: source })]))
    for (const mode of ['backup', 'restore'] as const) {
      const request: TransferRequest = { mode, savedConnectionId: source, database: mode === 'backup' ? source : target, path: join(directory, 'backup.sql'), compress: false, options: {} }
      const id = await page.evaluate(request => window.api.transfers.start(request), request)
      await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => ['error', 'completed'].includes(value?.status || '') ? value : null), id)).toMatchObject({ status: 'completed' })
    }
    expect((await admin.query(`SELECT CAST(id AS CHAR) AS id FROM ${target}.items`))[0]).toEqual([{ id: '9007199254740993' }])
    await page.evaluate(config => window.api.connections.save(config), { ...config, sslConfig: { ...config.sslConfig, ca: wrongCA } })
    await expect(page.evaluate(id => window.api.transfers.databases(id), source)).rejects.toThrow()
    const request: TransferRequest = { mode: 'backup', savedConnectionId: source, database: source, path: join(directory, 'rejected.sql'), compress: false, options: {} }
    const id = await page.evaluate(request => window.api.transfers.start(request), request)
    await expect.poll(() => page.evaluate(id => window.api.transfers.get(id).then(value => value?.status), id)).toBe('error')
    await expect(readFile(request.path)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally {
    await closeTransferTestApp(app)
    server.close()
    await admin.query(`DROP DATABASE IF EXISTS ${source}`)
    await admin.query(`DROP DATABASE IF EXISTS ${target}`)
    await admin.end()
    await rm(directory, { recursive: true, force: true })
  }
})
