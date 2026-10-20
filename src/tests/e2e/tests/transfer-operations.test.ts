import { DatabaseType } from '@/types/connection'
import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { Client } from 'pg'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer, type Socket } from 'node:net'

test('standalone PostgreSQL backup and restore use their own connections and bundled clients', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_TEST_PG_PORT, 'Requires an explicitly configured isolated PostgreSQL server')
  test.setTimeout(120_000)
  const config = {
    host: '127.0.0.1',
    port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT),
    user: 'zequel_test',
    database: 'postgres',
  }
  const suffix = Date.now().toString()
  const source = `transfer_source_${suffix}`
  const target = `transfer_target_${suffix}`
  const directory = await mkdtemp(join(tmpdir(), 'zequel-transfer-e2e-'))
  const backupPath = join(directory, 'database.dump')
  const admin = new Client(config)
  let app: ElectronApplication | undefined
  await admin.connect()
  try {
    await admin.query(`CREATE DATABASE "${source}"`)
    const seed = new Client({ ...config, database: source })
    await seed.connect()
    try {
      await seed.query(`
        CREATE SCHEMA reporting;
        CREATE TABLE public.items (id bigint PRIMARY KEY, amount numeric(30,8), label text, payload bytea);
        INSERT INTO public.items VALUES (9007199254740993, 123456789012345678.12345678, E'João, "quoted"\\nnext line', decode('00ff80', 'hex'));
        CREATE TABLE reporting.items (id integer PRIMARY KEY, label text);
        INSERT INTO reporting.items VALUES (1, 'other schema');
        CREATE VIEW reporting.summary AS SELECT id, amount FROM public.items;
        CREATE FUNCTION public.answer() RETURNS integer LANGUAGE sql AS 'SELECT 42';
      `)
    } finally { await seed.end() }

    const bootstrap = join(directory, 'bootstrap.cjs')
    await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
    app = await electron.launch({ executablePath: process.env.ZEQUEL_PACKAGED_EXECUTABLE, args: process.env.ZEQUEL_PACKAGED_EXECUTABLE ? [] : [bootstrap], cwd: process.cwd(), env: { ...process.env, E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile'), ...(process.env.ZEQUEL_PACKAGED_EXECUTABLE ? { PATH: process.platform === 'win32' ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin' } : {}) } })
    await prepareTransferTestApp(app)
    const home = await app.firstWindow()
    await home.waitForLoadState('domcontentloaded')
    await home.evaluate(async (connection) => {
      await window.api.connections.save(connection)
    }, { id: `transfer-test-${suffix}`, name: 'Transfer test server', type: DatabaseType.PostgreSQL, host: config.host, port: config.port, username: config.user, database: 'postgres', ssl: false })

    const backupWindowPromise = app.waitForEvent('window')
    await home.evaluate(() => window.api.transfers.open('backup'))
    const backupWindow = await backupWindowPromise
    await backupWindow.locator('aside').getByRole('button', { name: /Transfer test server/ }).click()
    await backupWindow.getByRole('button', { name: source, exact: true }).click()
    const tool = await backupWindow.evaluate((id) => window.api.transfers.tool(id, 'backup'), `transfer-test-${suffix}`)
    expect(tool.path).toContain('resources/database-tools')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }); }, backupPath)
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('operation=backup'))?.setSize(800, 600) })
    // Like TablePlus, the file name follows the database and Start picks the file and begins.
    await expect(backupWindow.getByRole('textbox', { name: 'File name:' })).toHaveValue(source)
    await backupWindow.screenshot({ path: join(directory, 'backup-dark-minimum.png') })
    await backupWindow.evaluate(() => window.api.theme.set('light'))
    await expect(backupWindow.getByRole('button', { name: 'Start backup…' })).toBeInViewport()
    await backupWindow.screenshot({ path: join(directory, 'backup-light-minimum.png') })
    await backupWindow.getByRole('button', { name: 'Start backup…' }).focus()
    await backupWindow.keyboard.press('Enter')
    await expect.poll(() => backupWindow.evaluate(() => window.api.transfers.list().then(items => items.find(item => item.mode === 'backup')?.status))).toBe('completed')
    expect((await readFile(backupPath)).subarray(0, 5).toString()).toBe('PGDMP')
    await backupWindow.close()

    const restoreWindowPromise = app.waitForEvent('window')
    await home.evaluate(() => window.api.transfers.open('restore'))
    const restoreWindow = await restoreWindowPromise
    await restoreWindow.evaluate(() => window.api.theme.set('dark'))
    await restoreWindow.locator('aside').getByRole('button', { name: /Transfer test server/ }).click()
    await restoreWindow.getByRole('button', { name: 'New database', exact: true }).click()
    await restoreWindow.getByRole('textbox', { name: 'New database name' }).fill(target)
    await restoreWindow.getByRole('button', { name: 'Create database', exact: true }).click()
    await expect(restoreWindow.getByRole('button', { name: target, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, backupPath)
    await restoreWindow.screenshot({ path: join(directory, 'restore.png') })
    await restoreWindow.getByRole('button', { name: 'Start restore…' }).click()
    await expect.poll(() => restoreWindow.evaluate(() => window.api.transfers.list().then(items => items.find(item => item.mode === 'restore')?.status))).toBe('completed')

    const restored = new Client({ ...config, database: target })
    await restored.connect()
    try {
      const result = await restored.query('SELECT id, amount, label, encode(payload, \'hex\') AS payload FROM public.items')
      expect(result.rows).toEqual([{ id: '9007199254740993', amount: '123456789012345678.12345678', label: 'João, "quoted"\nnext line', payload: '00ff80' }])
      expect((await restored.query('SELECT * FROM reporting.items')).rows).toEqual([{ id: 1, label: 'other schema' }])
      expect((await restored.query('SELECT public.answer() AS answer')).rows).toEqual([{ answer: 42 }])
      expect((await restored.query('SELECT count(*)::int AS count FROM reporting.summary')).rows).toEqual([{ count: 1 }])
    } finally { await restored.end() }
    console.log(`Transfer UI screenshots: ${directory}`)
  } finally {
    await closeTransferTestApp(app)
    await admin.query(`DROP DATABASE IF EXISTS "${source}" WITH (FORCE)`)
    await admin.query(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`)
    await admin.end()
    // Keep the screenshots and backup as test evidence; discard only the private application profile.
    await rm(join(directory, 'profile'), { recursive: true, force: true })
  }
})

test('PostgreSQL restore reports SQL errors and cancels a running native client', async () => {
  test.skip(!process.env.ZEQUEL_TRANSFER_TEST_PG_PORT, 'Requires an explicitly configured isolated PostgreSQL server')
  test.setTimeout(60_000)
  const directory = await mkdtemp(join(tmpdir(), 'zequel-transfer-failures-'))
  const id = `transfer-failures-${Date.now()}`
  const database = `transfer_failures_${Date.now()}`
  const admin = new Client({ host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), user: 'zequel_test', database: 'postgres' })
  await admin.connect()
  let app: ElectronApplication | undefined
  try {
    await admin.query(`CREATE DATABASE "${database}"`)
    const bootstrap = join(directory, 'bootstrap.cjs')
    await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
    app = await electron.launch({ executablePath: process.env.ZEQUEL_PACKAGED_EXECUTABLE, args: process.env.ZEQUEL_PACKAGED_EXECUTABLE ? [] : [bootstrap], cwd: process.cwd(), env: { ...process.env, E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile'), ...(process.env.ZEQUEL_PACKAGED_EXECUTABLE ? { PATH: process.platform === 'win32' ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin' } : {}) } })
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(config => window.api.connections.save(config), { id, name: 'Failure fixtures', type: DatabaseType.PostgreSQL, host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), username: 'zequel_test', database: 'postgres', ssl: false })
    const invalid = join(directory, 'invalid.sql')
    await writeFile(invalid, 'CREATE TABLE applied_before_error(id integer);\nSELECT * FROM definitely_missing_table;\nCREATE TABLE must_not_exist(id integer);\n')
    const failedId = await page.evaluate(request => window.api.transfers.start(request), { mode: 'restore' as const, savedConnectionId: id, database, path: invalid, compress: false, options: {} })
    await expect.poll(() => page.evaluate(operation => window.api.transfers.get(operation).then(value => value?.status), failedId)).toBe('error')
    const target = new Client({ host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), user: 'zequel_test', database })
    await target.connect()
    try {
      expect((await target.query("SELECT to_regclass('public.applied_before_error') AS applied, to_regclass('public.must_not_exist') AS skipped")).rows).toEqual([{ applied: 'applied_before_error', skipped: null }])
    } finally { await target.end() }
    const slow = join(directory, 'slow.sql')
    await writeFile(slow, 'SELECT pg_sleep(30);\n')
    const editorSession = await page.evaluate(config => window.api.connections.connectWithConfig(config), { id, name: 'Editor fixture', type: DatabaseType.PostgreSQL, host: '127.0.0.1', port: Number(process.env.ZEQUEL_TRANSFER_TEST_PG_PORT), username: 'zequel_test', database, ssl: false })
    const operationWindowPromise = app.waitForEvent('window')
    await page.evaluate(() => window.api.transfers.open('restore'))
    const operationWindow = await operationWindowPromise
    await operationWindow.waitForLoadState('domcontentloaded')
    await expect(operationWindow.getByText('error', { exact: true }).first()).toBeVisible()
    await operationWindow.getByRole('button', { name: /Failure fixtures.*restore/ }).click()
    await expect(operationWindow.locator('pre')).toContainText('definitely_missing_table')
    await operationWindow.screenshot({ path: test.info().outputPath('restore-error.png') })
    const cancelledId = await operationWindow.evaluate(request => window.api.transfers.start(request), { mode: 'restore' as const, savedConnectionId: id, database, path: slow, compress: false, options: {} })
    await expect.poll(async () => {
      const rows = await admin.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1 AND query LIKE '%pg_sleep%' AND state = 'active'", [database])
      return rows.rows[0].count
    }).toBe(1)
    await operationWindow.close()
    await page.evaluate(session => window.api.connections.disconnect(session), editorSession)
    expect(await page.evaluate(operation => window.api.transfers.get(operation).then(value => value?.status), cancelledId)).toBe('running')
    await app.evaluate(({ app, dialog }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
      app.quit()
    })
    expect(await page.evaluate(operation => window.api.transfers.get(operation).then(value => value?.status), cancelledId)).toBe('running')
    const reopenedPromise = app.waitForEvent('window')
    await page.evaluate(() => window.api.transfers.open('restore'))
    const reopened = await reopenedPromise
    await expect(reopened.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
    const stoppedAt = Date.now()
    await reopened.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(() => page.evaluate(operation => window.api.transfers.get(operation).then(value => value?.status), cancelledId)).toBe('cancelled')
    await expect.poll(async () => (await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1', [database])).rows[0].count).toBe(0)
    expect(Date.now() - stoppedAt).toBeLessThan(5000)
    await page.evaluate(connectionId => window.api.connections.delete(connectionId), id)
  } finally {
    await closeTransferTestApp(app)
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`)
    await admin.end()
    await rm(directory, { recursive: true, force: true })
  }
})

test('preparation is visible and cancellable while a server handshake stalls', async () => {
  test.setTimeout(30_000)
  const directory = await mkdtemp(join(tmpdir(), 'zequel-transfer-preparation-'))
  const sockets = new Set<Socket>()
  const server = createServer(socket => {
    sockets.add(socket)
    socket.resume()
    socket.on('error', () => {})
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing isolated server port')
  let app: ElectronApplication | undefined
  try {
    const bootstrap = join(directory, 'bootstrap.cjs')
    await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
    app = await electron.launch({ executablePath: process.env.ZEQUEL_PACKAGED_EXECUTABLE, args: process.env.ZEQUEL_PACKAGED_EXECUTABLE ? [] : [bootstrap], cwd: process.cwd(), env: { ...process.env, E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile') } })
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.evaluate(config => window.api.connections.save(config), { id: 'stalled-server', name: 'Stalled server fixture', type: DatabaseType.PostgreSQL, host: '127.0.0.1', port: address.port, username: 'fixture', database: 'fixture', ssl: false })
    const id = await page.evaluate(request => window.api.transfers.start(request), { mode: 'backup' as const, savedConnectionId: 'stalled-server', database: 'fixture', path: join(directory, 'never-created.dump'), compress: false, options: {} })
    await expect.poll(() => sockets.size).toBe(1)
    expect(await page.evaluate(operation => window.api.transfers.get(operation), id)).toMatchObject({ status: 'running', metrics: { phase: 'preparing' } })
    await page.evaluate(operation => window.api.transfers.cancel(operation), id)
    await expect.poll(() => page.evaluate(operation => window.api.transfers.get(operation).then(value => value?.status), id), { timeout: 10000 }).toBe('cancelled')
    await expect.poll(() => sockets.size).toBe(0)
    await expect(readFile(join(directory, 'never-created.dump'))).rejects.toThrow()
    await page.evaluate(() => window.api.connections.delete('stalled-server'))
  } finally {
    await closeTransferTestApp(app)
    for (const socket of sockets) socket.destroy()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await rm(directory, { recursive: true, force: true })
  }
})
