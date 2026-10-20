import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseType, ExportFormat } from '@main/types'
import type { ExportOptions, ExportResult } from '@main/ipc/export'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), driver: vi.fn(), dialog: vi.fn(), clipboard: vi.fn(), owner: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle }, dialog: { showSaveDialog: mocks.dialog }, BrowserWindow: { fromWebContents: () => ({}) }, clipboard: { writeText: mocks.clipboard } }))
vi.mock('@main/db/manager', () => ({ connectionManager: { getConnection: mocks.driver } }))
vi.mock('@main/services/windowManager', () => ({ windowManager: { getSessionOwner: mocks.owner } }))
vi.mock('@main/utils/pathValidation', () => ({ isPathAllowed: () => true }))
vi.mock('@main/utils/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), error: vi.fn() } }))
import { registerExportHandlers } from '@main/ipc/export'
import { rowTransfers } from '@main/services/row-transfer'

let directory: string
const invoke = async (channel: string, ...args: unknown[]): Promise<ExportResult> => {
  const handler = mocks.handle.mock.calls.find(call => call[0] === channel)![1] as (...args: unknown[]) => Promise<ExportResult>
  return handler({ sender: { id: 1 } }, ...args)
}
const options = (format: ExportFormat, changes: Partial<ExportOptions> = {}): ExportOptions => ({
  format, filePath: join(directory, `output.${format}`), tableName: 'items',
  columns: [{ name: 'id', type: 'BIGINT' }, { name: 'note', type: 'TEXT' }],
  rows: [{ id: '9007199254740993', note: 'São Paulo, "hello"\nworld' }], ...changes,
})
beforeEach(async () => {
  vi.clearAllMocks()
  mocks.owner.mockReturnValue(undefined)
  directory = await mkdtemp(join(tmpdir(), 'zequel-export-'))
  registerExportHandlers()
})
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

describe('file exports', () => {
  it.each([ExportFormat.CSV, ExportFormat.JSON])('encodes binary data losslessly in %s', async format => {
    const config = options(format, { columns: [{ name: 'payload', type: 'BYTEA' }], rows: [{ payload: Buffer.from([0, 255, 128]) }] })
    expect((await invoke('export:toFile', config)).success).toBe(true)
    const text = await readFile(config.filePath!, 'utf8')
    if (format === ExportFormat.JSON) expect(JSON.parse(text)).toEqual([{ payload: '\\x00ff80' }])
    else expect(text).toBe('payload\n\\x00ff80\n')
  })
  it.each([
    [DatabaseType.PostgreSQL, "decode('00ff80', 'hex')"],
    [DatabaseType.MySQL, "X'00ff80'"],
    [DatabaseType.SQLite, "X'00ff80'"],
    [DatabaseType.SQLServer, '0x00ff80'],
    [DatabaseType.DuckDB, "from_hex('00ff80')"],
  ])('exports binary SQL using the %s dialect', async (databaseType, expression) => {
    const config = options(ExportFormat.SQL, { databaseType: databaseType as DatabaseType, columns: [{ name: 'payload', type: 'BLOB' }], rows: [{ payload: Buffer.from([0, 255, 128]) }] })
    expect((await invoke('export:toFile', config)).success).toBe(true)
    expect(await readFile(config.filePath!, 'utf8')).toContain(expression)
  })
  it('writes quoted multiline CSV with exact numbers', async () => {
    const config = options(ExportFormat.CSV)
    expect((await invoke('export:toFile', config)).success).toBe(true)
    expect(await readFile(config.filePath!, 'utf8')).toBe('id,note\n9007199254740993,"São Paulo, ""hello""\nworld"\n')
    expect(await readdir(directory)).toEqual(['output.csv'])
  })
  it('applies delimiter, headers and NULL choices', async () => {
    const config = options(ExportFormat.CSV, { includeHeaders: false, delimiter: ';', nullAsEmpty: false, rows: [{ id: null, note: '' }] })
    await invoke('export:toFile', config)
    expect(await readFile(config.filePath!, 'utf8')).toBe('\\N;\n')
  })
  it.each([true, false])('writes valid JSON respecting prettyPrint=%s', async prettyPrint => {
    const config = options(ExportFormat.JSON, { prettyPrint })
    expect((await invoke('export:toFile', config)).success).toBe(true)
    const text = await readFile(config.filePath!, 'utf8')
    expect(JSON.parse(text)).toEqual(config.rows)
    if (!prettyPrint) expect(text).not.toContain('\n')
  })
  it('quotes literal NULL markers and only collapses NULL when explicitly requested', async () => {
    const config = options(ExportFormat.CSV, { rows: [{ id: null, note: '\\N' }] })
    await invoke('export:toFile', config)
    expect(await readFile(config.filePath!, 'utf8')).toBe('id,note\n\\N,"\\N"\n')
    await invoke('export:toFile', { ...config, filePath: join(directory, 'lossy.csv'), nullAsEmpty: true })
    expect(await readFile(join(directory, 'lossy.csv'), 'utf8')).toBe('id,note\n,"\\N"\n')
  })
  it('writes empty JSON as an array', async () => {
    const config = options(ExportFormat.JSON, { rows: [] })
    await invoke('export:toFile', config)
    expect(JSON.parse(await readFile(config.filePath!, 'utf8'))).toEqual([])
  })
  it('escapes SQL identifiers, strings and emits PostgreSQL booleans', async () => {
    const config = options(ExportFormat.SQL, { tableName: 'a"b', schema: 's"x', includeSchema: true, rows: [{ id: true, note: "O'Reilly" }] })
    await invoke('export:toFile', config)
    expect(await readFile(config.filePath!, 'utf8')).toBe('INSERT INTO "s""x"."a""b" ("id", "note") VALUES (TRUE, \'O\'\'Reilly\');\n')
  })
  it('does not silently drop a table when exporting its DDL', async () => {
    const config = options(ExportFormat.SQL, { createTable: true, ddl: 'CREATE TABLE "items" (id BIGINT, note TEXT)' })
    await invoke('export:toFile', config)
    const text = await readFile(config.filePath!, 'utf8')
    expect(text).toContain('CREATE TABLE')
    expect(text).not.toContain('DROP TABLE')
  })
  it('refuses to overwrite an existing destination and preserves its contents', async () => {
    const config = options(ExportFormat.JSON)
    await writeFile(config.filePath!, 'original')
    expect((await invoke('export:toFile', config)).success).toBe(false)
    expect(await readFile(config.filePath!, 'utf8')).toBe('original')
  })
  it('cleans its staging file after serialization failure', async () => {
    const circular: Record<string, unknown> = {}; circular.self = circular
    const config = options(ExportFormat.JSON, { rows: [{ note: circular }] })
    expect((await invoke('export:toFile', config)).success).toBe(false)
    expect(await readdir(directory)).toEqual([])
  })
  it('publishes a completed progress snapshot with real rows', async () => {
    const config = options(ExportFormat.CSV, { operationId: crypto.randomUUID() })
    await invoke('export:toFile', config)
    expect(rowTransfers.get(1, config.operationId!)).toMatchObject({ status: 'completed', processed: 1, total: 1 })
  })
  it('does not write when the save dialog is cancelled', async () => {
    mocks.dialog.mockResolvedValue({ canceled: true })
    expect((await invoke('export:toFile', options(ExportFormat.CSV, { filePath: undefined }))).success).toBe(false)
    expect(await readdir(directory)).toEqual([])
  })
  it('retains clipboard support without a file operation', async () => {
    const config = options(ExportFormat.JSON)
    expect((await invoke('export:toClipboard', config)).success).toBe(true)
    expect(JSON.parse(mocks.clipboard.mock.calls[0][0])).toEqual(config.rows)
  })
})

describe('cursor exports', () => {
  const cursor = { start: vi.fn(), read: vi.fn(), cancel: vi.fn() }
  const driver = { type: DatabaseType.PostgreSQL, selectTopStream: vi.fn(), getTableDDL: vi.fn(), setCurrentSchema: vi.fn() }
  beforeEach(() => {
    cursor.start.mockReset().mockResolvedValue(undefined)
    cursor.cancel.mockReset().mockResolvedValue(undefined)
    cursor.read.mockReset().mockResolvedValueOnce([{ id: '9007199254740993', note: 'row' }]).mockResolvedValue([])
    driver.selectTopStream.mockResolvedValue({ cursor, totalRows: 1, columns: options(ExportFormat.CSV).columns })
    mocks.driver.mockReturnValue(driver)
  })
  it('uses the explicit schema without mutating editor state', async () => {
    const path = join(directory, 'all.json')
    expect((await invoke('export:tableToFile', 'connection', 'items', path, { format: ExportFormat.JSON, schema: 'reporting' })).success).toBe(true)
    expect(driver.selectTopStream).toHaveBeenCalledWith('items', { schema: 'reporting', rawValues: true }, 500)
    expect(driver.setCurrentSchema).not.toHaveBeenCalled()
    expect(cursor.cancel).toHaveBeenCalledOnce()
    expect(JSON.parse(await readFile(path, 'utf8'))).toHaveLength(1)
  })
  it('closes the cursor and removes partial output on read failure', async () => {
    cursor.read.mockReset().mockRejectedValue(new Error('connection lost'))
    expect((await invoke('export:tableToFile', 'connection', 'items', join(directory, 'all.csv'), { format: ExportFormat.CSV })).success).toBe(false)
    expect(cursor.cancel).toHaveBeenCalledOnce()
    expect(await readdir(directory)).toEqual([])
  })
  it('cancels without publishing a partial destination', async () => {
    const operationId = crypto.randomUUID()
    cursor.read.mockReset().mockImplementation(async () => { rowTransfers.cancel(1, operationId); return [{ id: 1 }] })
    const result = await invoke('export:tableToFile', 'connection', 'items', join(directory, 'all.csv'), { format: ExportFormat.CSV, operationId })
    expect(result.success).toBe(false)
    expect(rowTransfers.get(1, operationId)?.status).toBe('cancelled')
    expect(cursor.cancel).toHaveBeenCalled()
    expect(await readdir(directory)).toEqual([])
  })
  it('rejects access from a different session owner', async () => {
    mocks.owner.mockReturnValue(2)
    await expect(invoke('export:tableToFile', 'connection', 'items', join(directory, 'all.csv'), { format: ExportFormat.CSV })).rejects.toThrow('Not authorized')
    expect(driver.selectTopStream).not.toHaveBeenCalled()
  })
})

vi.mock('@main/services/row-transfer-context', () => ({ createRowTransferContext: async () => {
  const driver = mocks.driver()
  if (!driver) throw new Error('Not connected to database')
  return { driver, close: async () => {} }
} }))
