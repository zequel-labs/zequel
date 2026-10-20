import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseType, type SavedConnection } from '@main/types'
import { createOperationContext } from '@main/services/backup/OperationContext'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(), disconnect: vi.fn(), createDriver: vi.fn(),
  createTunnel: vi.fn(), closeTunnel: vi.fn(),
}))
vi.mock('@main/db/manager', () => ({ connectionManager: { createDriver: mocks.createDriver } }))
vi.mock('@main/services/ssh-tunnel', () => ({ sshTunnelManager: {
  createTunnel: mocks.createTunnel, closeTunnel: mocks.closeTunnel,
} }))

const connection = {
  id: 'saved-connection', name: 'Test', type: DatabaseType.Redis,
  database: '4', host: 'database.example', port: 6379,
  username: null, filepath: null, ssl: false, sslConfig: null,
  ssh: { enabled: true, host: 'jump.example', port: 22, username: 'test' },
} as SavedConnection

beforeEach(() => {
  vi.resetAllMocks()
  mocks.createDriver.mockResolvedValue({ connect: mocks.connect, disconnect: mocks.disconnect })
  mocks.createTunnel.mockResolvedValue(16379)
})

describe('backup operation connection ownership', () => {
  it('uses a distinct driver and tunnel per operation with the selected database', async () => {
    const first = await createOperationContext(connection, 'secret', true)
    const second = await createOperationContext({ ...connection, database: '5' }, 'secret', true)
    expect(first.id).not.toBe(second.id)
    expect(mocks.createTunnel).toHaveBeenCalledWith(first.id, connection.ssh, 'database.example', 6379)
    expect(mocks.connect).toHaveBeenLastCalledWith(expect.objectContaining({
      id: second.id, database: '5', host: '127.0.0.1', port: 16379,
    }))
    await first.close()
    await first.close()
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.closeTunnel).toHaveBeenCalledWith(first.id)
    expect(mocks.closeTunnel).not.toHaveBeenCalledWith(second.id)
    await second.close()
  })

  it('does not open a driver when an external tool owns its connection', async () => {
    const context = await createOperationContext(connection, null, false)
    expect(mocks.createDriver).not.toHaveBeenCalled()
    expect(context.driver).toBeUndefined()
    await context.close()
    expect(mocks.closeTunnel).toHaveBeenCalledWith(context.id)
  })

  it('releases the tunnel and failed driver when connection setup fails', async () => {
    mocks.connect.mockRejectedValue(new Error('authentication failed'))
    await expect(createOperationContext(connection, 'secret', true)).rejects.toThrow('authentication failed')
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
    expect(mocks.closeTunnel).toHaveBeenCalledTimes(1)
  })

  it('closes the tunnel even if driver disconnect fails', async () => {
    const context = await createOperationContext(connection, null, true)
    mocks.disconnect.mockRejectedValue(new Error('connection lost'))
    await expect(context.close()).rejects.toThrow('connection lost')
    expect(mocks.closeTunnel).toHaveBeenCalledWith(context.id)
  })
})
