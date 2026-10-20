import { test, expect, _electron as electron } from '@playwright/test'
import { Server } from 'ssh2'
import { connect } from 'node:net'
import { generateKeyPairSync } from 'node:crypto'
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
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
  const server = new Server({ hostKeys: [privateKey] }, client => {
    client.on('authentication', context => {
      if (context.method === 'password' && context.username === 'transfer' && context.password === 'isolated-test') context.accept()
      else context.reject()
    })
    client.on('ready', () => client.on('tcpip', (accept, reject, info) => {
      if (info.destIP !== 'localhost' || info.destPort !== port) { reject(); return }
      const socket = connect({ host: '127.0.0.1', port }, () => {
        const channel = accept()
        channel.pipe(socket).pipe(channel)
        channel.on('close', () => socket.destroy())
      })
      socket.on('error', () => { socket.destroy(); reject() })
    }))
    client.on('error', () => {})
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('SSH server did not start')
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
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    const config = {
      id: source, name: 'Isolated SSH with verified TLS', type: 'postgresql',
      host: 'localhost', port, username: 'zequel_test', database: source, ssl: true,
      sslConfig: { enabled: true, mode: 'verify-full', ca, serverName: 'localhost' },
      ssh: { enabled: true, host: '127.0.0.1', port: address.port, username: 'transfer', authMethod: 'password', password: 'isolated-test' },
    }
    await page.evaluate(config => window.api.connections.save(config), config)
    expect(await page.evaluate(id => window.api.transfers.databases(id), source)).toEqual(expect.arrayContaining([expect.objectContaining({ name: source })]))
    for (const mode of ['backup', 'restore'] as const) {
      const operation = await page.evaluate(request => window.api.transfers.start(request), {
        mode, savedConnectionId: source, database: mode === 'backup' ? source : target,
        path: join(directory, 'database.dump'), compress: false,
        options: mode === 'backup' ? { format: 'custom' } : { 'no-owner': true },
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
    await app.close()
    server.close()
    await admin.query(`DROP DATABASE IF EXISTS "${source}" WITH (FORCE)`)
    await admin.query(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`)
    await admin.end()
    await rm(directory, { recursive: true, force: true })
  }
})
