import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseType, type TransferRequest } from '@main/types'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), saved: vi.fn(), password: vi.fn(), context: vi.fn(), backup: vi.fn(), restore: vi.fn(), close: vi.fn(), setting: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle } }))
vi.mock('@main/services/connections', () => ({ connectionsService: { get: mocks.saved } }))
vi.mock('@main/services/keychain', () => ({ keychainService: { getPassword: mocks.password } }))
vi.mock('@main/services/settings', () => ({ settingsService: { get: mocks.setting } }))
vi.mock('@main/services/windowManager', () => ({ windowManager: { openNewWindow: vi.fn() } }))
vi.mock('@main/services/backup/OperationContext', () => ({ createOperationContext: mocks.context }))
vi.mock('@main/services/backup', () => ({ backupService: {
  usesDriverPath: (type: DatabaseType) => type === DatabaseType.Redis,
  detectBackupBinary: () => ({ path: '/bundled/pg_dump', found: true }),
  detectRestoreBinary: () => ({ path: '/bundled/psql', found: true }),
  executeBackup: mocks.backup, executeRestore: mocks.restore,
  prepareTransfer: async (_mode: string, _connection: unknown, _webId: number, prepare: (signal: AbortSignal) => Promise<(id: string) => void>, release: () => Promise<void>) => {
    try { (await prepare(new AbortController().signal))('operation'); return 'operation' }
    catch (error) { await release(); throw error }
  },
} }))
import { registerTransferHandlers } from '@main/ipc/transfers'

const invoke = (name: string, ...args: unknown[]): Promise<unknown> => {
  const handler = mocks.handle.mock.calls.find(call => call[0] === name)![1] as (...args: unknown[]) => unknown
  return Promise.resolve().then(() => handler({ sender: { id: 1 } }, ...args))
}
const request = (database: string): TransferRequest => ({ mode: 'backup', savedConnectionId: 'saved', database, path: '/tmp/backup.dump', options: {}, compress: false })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.saved.mockReturnValue({ id: 'saved', name: 'Saved connection', type: DatabaseType.PostgreSQL, host: 'server', port: 5432, database: 'original' })
  mocks.password.mockResolvedValue('private-password')
  mocks.close.mockResolvedValue(undefined)
  mocks.setting.mockReturnValue(null)
  mocks.context.mockImplementation(async connection => ({ id: 'independent', connection, close: mocks.close, driver: {} }))
  mocks.backup.mockResolvedValue('operation')
  registerTransferHandlers()
})

describe('standalone transfer IPC', () => {
  it('acquires its own context for the explicit destination without an editor session', async () => {
    expect(await invoke('transfers:start', request('selected'))).toBe('operation')
    expect(mocks.context).toHaveBeenCalledWith(expect.objectContaining({ database: 'selected' }), 'private-password', true)
    expect(mocks.backup).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'independent', binaryPath: '/bundled/pg_dump' }), expect.objectContaining({ database: 'selected' }), 'private-password', 1, {}, expect.any(Function), 'operation')
    await mocks.backup.mock.calls[0][5]()
    expect(mocks.close).toHaveBeenCalledOnce()
  })
  it('rejects conflicting targets until the original operation releases its resources', async () => {
    await invoke('transfers:start', request('locked'))
    await expect(invoke('transfers:start', request('locked'))).rejects.toThrow('Another operation')
    const release = mocks.backup.mock.calls[0][5] as () => Promise<void>
    await release()
    await invoke('transfers:start', request('locked'))
    await mocks.backup.mock.calls[1][5]()
  })
  it('releases the target when preparation fails', async () => {
    mocks.context.mockRejectedValueOnce(new Error('Authentication failed'))
    await expect(invoke('transfers:start', request('retry'))).rejects.toThrow('Authentication failed')
    await invoke('transfers:start', request('retry'))
    await mocks.backup.mock.calls[0][5]()
  })
  it('rejects destination-changing flags before opening any connection', async () => {
    await expect(invoke('transfers:start', { ...request('safe'), options: { create: true } })).rejects.toThrow('Unsupported option')
    expect(mocks.context).not.toHaveBeenCalled()
  })
  it('keeps a previous custom path optional while selecting the bundled client', async () => {
    mocks.setting.mockReturnValue('/old/pg_dump')
    expect(await invoke('transfers:tool', 'saved', 'backup')).toMatchObject({ path: '/bundled/pg_dump', previousPath: '/old/pg_dump' })
  })
})
