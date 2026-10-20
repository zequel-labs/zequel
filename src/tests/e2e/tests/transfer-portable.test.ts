import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { prepareTransferTestApp, closeTransferTestApp } from '@e2e/helpers/transfer-app'
import { DatabaseType } from '@/types/connection'
import type { ExportFormat } from '@/types/table'
import { mkdtemp, writeFile, rm, stat, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

test.skip(process.env.ZEQUEL_TRANSFER_PORTABLE !== '1', 'Opt-in packaged cross-platform transfer checks')
test.setTimeout(180_000)

const withApp = async (body: (app: ElectronApplication, page: Page, directory: string) => Promise<void>): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), "Zequel portable 'á' "))
  const bootstrap = join(directory, 'bootstrap.cjs')
  await writeFile(bootstrap, `require('electron').app.setPath('userData', ${JSON.stringify(join(directory, 'profile'))}); require(${JSON.stringify(resolve('out/main/index.js'))});`)
  const packaged = process.env.ZEQUEL_PACKAGED_EXECUTABLE
  const app = await electron.launch({
    executablePath: packaged,
    args: [...(packaged ? [] : [bootstrap]), ...(process.env.CI && process.platform === 'linux' ? ['--no-sandbox'] : [])],
    env: { ...process.env, E2E: '1', ZEQUEL_TEST_PROFILE: join(directory, 'profile'),
      ...(packaged ? { PATH: process.platform === 'win32' ? process.env.SystemRoot + '\\System32' : '/usr/bin:/bin' } : {}) },
  })
  try {
    await prepareTransferTestApp(app)
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await body(app, page, directory)
  } finally {
    await closeTransferTestApp(app)
    await rm(directory, { recursive: true, force: true })
  }
}

test('portable: review, themes, independent windows, quit and native cancellation', async ({}, testInfo) => {
  await withApp(async (app, home, directory) => {
    const database = join(directory, 'source.sqlite')
    const config = { id: 'portable', name: 'Local database with a long connection name for layout validation', type: DatabaseType.SQLite, database, filepath: database }
    await home.evaluate(config => window.api.connections.save(config), config)
    const session = await home.evaluate(config => window.api.connections.connectWithConfig(config), config)
    expect(await home.evaluate(id => window.api.query.execute(id, 'CREATE TABLE items(id INTEGER PRIMARY KEY, label TEXT)'), session)).not.toHaveProperty('error')
    await home.evaluate(id => window.api.query.execute(id, "INSERT INTO items VALUES(1, 'Olá')"), session)
    const opened = app.waitForEvent('window')
    await home.evaluate(() => window.api.transfers.open('backup'))
    const backup = await opened
    await expect(backup.getByText('Choose a connection to get started.')).toBeVisible()
    await backup.locator('aside').getByRole('button', { name: /Local database/ }).click()
    await backup.getByRole('button', { name: database, exact: true }).click()
    const path = join(directory, 'backup with spaces and Unicode ç.sql')
    await app.evaluate(({ dialog }, path) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: path }) }, path)
    await backup.getByRole('button', { name: 'Choose destination…' }).click()
    await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('operation=backup'))?.setSize(800, 600) })
    await backup.getByRole('button', { name: 'Review backup' }).click()
    await expect(backup.getByRole('region', { name: 'Transfer review' })).toBeFocused()
    for (const theme of ['light', 'dark'] as const) {
      await backup.evaluate(theme => window.api.theme.set(theme), theme)
      await expect(backup.getByRole('button', { name: 'Start backup' })).toBeInViewport()
      await backup.screenshot({ path: testInfo.outputPath(`portable-${theme}.png`) })
      expect(await backup.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await backup.getByRole('button', { name: 'Start backup' }).focus()
    await backup.keyboard.press('Enter')
    await expect.poll(() => backup.evaluate(() => window.api.transfers.list().then(items => items[0]?.status))).toBe('completed')
    expect((await stat(path)).size).toBeGreaterThan(0)
    await backup.close()
    const slowPath = join(directory, 'slow.sql')
    const target = join(directory, 'cancelled.sqlite')
    await writeFile(slowPath, 'CREATE TABLE items AS WITH RECURSIVE rows(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM rows WHERE n < 100000000) SELECT n FROM rows;')
    const reopen = app.waitForEvent('window')
    await home.evaluate(() => window.api.transfers.open('restore'))
    const restore = await reopen
    await restore.waitForLoadState('domcontentloaded')
    const id = await restore.evaluate(({ target, slowPath }) => window.api.transfers.start({ mode: 'restore', savedConnectionId: 'portable', database: target, path: slowPath, compress: false, options: {} }), { target, slowPath })
    await expect.poll(() => restore.evaluate(id => window.api.transfers.get(id).then(item => item?.metrics?.phase), id)).toBe('applying')
    await restore.close()
    await home.evaluate(id => window.api.connections.disconnect(id), session)
    await app.evaluate(({ dialog, app }) => {
      dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
      app.quit()
    })
    expect(await home.evaluate(id => window.api.transfers.get(id).then(item => item?.status), id)).toBe('running')
    const reopened = app.waitForEvent('window')
    await home.evaluate(() => window.api.transfers.open('restore'))
    const observer = await reopened
    await observer.waitForLoadState('domcontentloaded')
    await expect(observer.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
    const started = Date.now()
    await observer.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(() => observer.evaluate(id => window.api.transfers.get(id).then(item => item?.status), id), { timeout: 15000 }).toBe('cancelled')
    expect(Date.now() - started).toBeLessThan(15000)
    await expect(stat(target)).rejects.toMatchObject({ code: 'ENOENT' })
    expect((await readdir(directory)).filter(name => name.startsWith('.zequel-restore-'))).toEqual([])
    await expect(observer.getByText('cancelled', { exact: true }).first()).toBeVisible()
    await observer.screenshot({ path: testInfo.outputPath('portable-cancelled.png') })
    // A completed cancellation must no longer prevent shutdown.
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => { throw new Error('Unexpected quit confirmation after cancellation') } })
  })
})

test('portable: repeated 10k, 100k and 1m row transfers stay responsive', async ({}, testInfo) => {
  await withApp(async (app, page, directory) => {
    const database = join(directory, 'scale.sqlite')
    const session = await page.evaluate(config => window.api.connections.connectWithConfig(config), { id: 'scale', name: 'Scale fixture', type: DatabaseType.SQLite, database, filepath: database })
    await page.evaluate(id => window.api.query.execute(id, 'CREATE TABLE source(id INTEGER PRIMARY KEY, label TEXT)'), session)
    await page.evaluate(id => window.api.query.execute(id, 'CREATE TABLE target(id INTEGER PRIMARY KEY, label TEXT)'), session)
    const measurements: Record<string, unknown>[] = []
    for (const count of [10_000, 100_000, 1_000_000, 10_000]) {
      await page.evaluate(id => window.api.query.execute(id, 'DELETE FROM source'), session)
      const seeded = await page.evaluate(({ session, count }) => window.api.query.execute(session, `WITH RECURSIVE rows(n) AS (VALUES(1) UNION ALL SELECT n + 1 FROM rows WHERE n < ${count}) INSERT INTO source SELECT n, 'Olá, "quoted"' || char(10) || n FROM rows`), { session, count })
      expect(seeded.error).toBeUndefined()
      await page.evaluate(() => {
        const state = globalThis as typeof globalThis & { scaleTimer?: ReturnType<typeof setInterval>; scaleLag?: number }
        state.scaleLag = 0
        let previous = performance.now()
        state.scaleTimer = setInterval(() => { const now = performance.now(); state.scaleLag = Math.max(state.scaleLag!, now - previous - 50); previous = now }, 50)
      })
      await app.evaluate(() => {
        const state = globalThis as typeof globalThis & { scaleMetrics?: { rss: number; heap: number; lag: number; timer: ReturnType<typeof setInterval> } }
        let previous = Date.now()
        const metrics = { rss: 0, heap: 0, lag: 0, timer: setInterval(() => {
          const now = Date.now()
          metrics.lag = Math.max(metrics.lag, now - previous - 50)
          previous = now
          const memory = process.memoryUsage()
          metrics.rss = Math.max(metrics.rss, memory.rss)
          metrics.heap = Math.max(metrics.heap, memory.heapUsed)
        }, 50) }
        state.scaleMetrics = metrics
      })
      const path = join(directory, 'rows.csv')
      const started = Date.now()
      const exported = await page.evaluate(({ session, path }) => window.api.export.tableToFile(session, 'source', path, { format: 'csv' as ExportFormat, includeHeaders: true }), { session, path })
      expect(exported, JSON.stringify(exported)).toMatchObject({ success: true })
      const exportedAt = Date.now()
      const imported = await page.evaluate(({ session, path }) => window.api.import.execute(session, 'target', path, 'csv', [{ sourceColumn: 'id', targetColumn: 'id', targetType: 'INTEGER' }, { sourceColumn: 'label', targetColumn: 'label', targetType: 'TEXT' }], { truncateTable: true, batchSize: 500 }), { session, path })
      expect(imported, JSON.stringify(imported)).toMatchObject({ success: true, insertedRows: count })
      const importMs = Date.now() - exportedAt
      const rendererLag = await page.evaluate(() => {
        const state = globalThis as typeof globalThis & { scaleTimer?: ReturnType<typeof setInterval>; scaleLag?: number }
        clearInterval(state.scaleTimer)
        return state.scaleLag
      })
      const memory = await app.evaluate(() => {
        const state = globalThis as typeof globalThis & { scaleMetrics?: { rss: number; heap: number; lag: number; timer: ReturnType<typeof setInterval> } }
        const metrics = state.scaleMetrics!
        clearInterval(metrics.timer)
        return { rss: metrics.rss, heap: metrics.heap, lag: metrics.lag }
      })
      const compared = await page.evaluate(id => window.api.query.execute(id, 'SELECT COUNT(*) AS differences FROM (SELECT * FROM source EXCEPT SELECT * FROM target UNION ALL SELECT * FROM target EXCEPT SELECT * FROM source)'), session)
      expect(compared.rows).toEqual([{ differences: 0 }])
      const rows = await page.evaluate(id => window.api.query.execute(id, 'SELECT COUNT(*) AS count FROM target'), session)
      expect(rows.rows).toEqual([{ count }])
      measurements.push({ count, exportMs: exportedAt - started, importMs, rendererLag, peakRss: memory.rss, peakHeap: memory.heap, mainLag: memory.lag })
      expect(rendererLag).toBeLessThan(2000)
      await rm(path)
    }
    await writeFile(testInfo.outputPath('measurements.json'), JSON.stringify({ platform: process.platform, arch: process.arch, measurements }, null, 2))
    console.log('Portable scale measurements', JSON.stringify(measurements))
  })
})

test('portable: import review keeps its session privacy and rechecks Safe Mode before writing', async () => {
  await withApp(async (app, page, directory) => {
    const database = join(directory, 'protected.sqlite')
    const config = { id: 'protected', name: 'Protected import', type: DatabaseType.SQLite, database, filepath: database }
    await page.evaluate(config => window.api.connections.save(config), config)
    const seed = await page.evaluate(config => window.api.connections.connectWithConfig(config), config)
    await page.evaluate(id => window.api.query.execute(id, 'CREATE TABLE items(id INTEGER PRIMARY KEY, label TEXT)'), seed)
    await page.evaluate(id => window.api.query.execute(id, "INSERT INTO items VALUES(1, 'original')"), seed)
    await page.evaluate(id => window.api.connections.disconnect(id), seed)
    const session = await page.evaluate(async () => {
      const element = document.querySelector('#app') as HTMLElement & { __vue_app__: { _context: { provides: Record<symbol, unknown> } } }
      const provides = element.__vue_app__._context.provides
      const pinia = Reflect.ownKeys(provides).map(key => Reflect.get(provides, key)).find(value => value && typeof value === 'object' && '_s' in value) as { _s: Map<string, unknown> }
      const connections = pinia._s.get('connections') as { loadConnections: () => Promise<void>; connect: (id: string) => Promise<void>; activeSessionId: string }
      const tabs = pinia._s.get('tabs') as { createTableTab: (session: string, table: string, database: string) => void }
      await connections.loadConnections()
      await connections.connect('protected')
      tabs.createTableTab(connections.activeSessionId, 'items', '')
      return connections.activeSessionId
    })
    const path = join(directory, 'private.csv')
    await writeFile(path, 'id,label\n2,private preview value\n')
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, path)
    await page.getByTestId('grid-cell-0-label').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Import', exact: true }).hover()
    await page.getByRole('menuitem', { name: 'CSV', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('private preview value', { exact: true })).toBeVisible()
    await page.evaluate(session => {
      const element = document.querySelector('#app') as HTMLElement & { __vue_app__: { _context: { provides: Record<symbol, unknown> } } }
      const provides = element.__vue_app__._context.provides
      const pinia = Reflect.ownKeys(provides).map(key => Reflect.get(provides, key)).find(value => value && typeof value === 'object' && '_s' in value) as { _s: Map<string, unknown> }
      const connections = pinia._s.get('connections') as { safeModeOverrides: Map<string, boolean>; privacyModeOverrides: Map<string, boolean> }
      connections.privacyModeOverrides.set(session, true)
      connections.safeModeOverrides.set(session, true)
    }, session)
    await expect(dialog.getByText('private preview value', { exact: true })).toHaveClass(/blur-sm/)
    await dialog.getByRole('button', { name: 'Continue to Mapping' }).click()
    await expect(dialog.getByRole('button', { name: 'Start Import' })).toBeDisabled()
    await expect(dialog.getByRole('status')).toContainText('Safe Mode is enabled')
    const rows = await page.evaluate(id => window.api.query.execute(id, 'SELECT * FROM items'), session)
    expect(rows.rows).toEqual([{ id: 1, label: 'original' }])
  })
})
