import { randomUUID } from 'node:crypto'
import { connectionManager } from '@main/db/manager'
import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { DatabaseType, DEFAULT_PORTS } from '@main/types'
import type { DatabaseDriver } from '@main/db/base'

/** File jobs keep working if their editor disconnects, and can cancel only their own queries. */
export const createRowTransferContext = async (sessionId: string): Promise<{ driver: DatabaseDriver; close: () => Promise<void> }> => {
  const source = connectionManager.getConnectionConfig(sessionId)
  if (!source || !connectionManager.getConnection(sessionId)) throw new Error('Not connected to database')
  const config = { ...source, id: `rows-${randomUUID()}`, sslConfig: source.sslConfig ? { ...source.sslConfig } : undefined }
  let driver: DatabaseDriver | undefined
  let closing: Promise<void> | undefined
  const release = async (): Promise<void> => {
    try { await driver?.disconnect() } finally { sshTunnelManager.closeTunnel(config.id) }
  }
  const close = (): Promise<void> => closing ??= release()
  try {
    if (config.ssh?.enabled && ![DatabaseType.SQLite, DatabaseType.DuckDB].includes(config.type)) {
      config.sslConfig = { ...config.sslConfig, serverName: config.sslConfig?.serverName || config.host }
      config.port = await sshTunnelManager.createTunnel(config.id, config.ssh, config.host || 'localhost', config.port || DEFAULT_PORTS[config.type])
      config.host = '127.0.0.1'
    }
    driver = await connectionManager.createDriver(config.type)
    await driver.connect(config)
    return { driver, close }
  } catch (error) { await close().catch(() => {}); throw error }
}
