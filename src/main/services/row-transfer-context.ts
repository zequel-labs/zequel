import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import { connectionManager } from '@main/db/manager'
import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { connectSQLiteRowWorker, type RowTransferDriver } from '@main/services/row-transfer-sqlite'
import { DatabaseType, DEFAULT_PORTS, type ConnectionConfig } from '@main/types'

// better-sqlite3 is synchronous: a slow COMMIT/fsync would otherwise freeze every window.
const connectSQLite = (config: ConnectionConfig): Promise<RowTransferDriver> => {
  const entry = join(__dirname, 'sqlite-rows-worker.js')
  const worker = new Worker(`
    const { workerData } = require('node:worker_threads');
    require('node:module').createRequire(workerData.entry)(workerData.entry);
  `, { eval: true, workerData: { entry } })
  return connectSQLiteRowWorker(worker, config)
}

/** File jobs keep working if their editor disconnects, and can cancel only their own queries. */
export const createRowTransferContext = async (sessionId: string): Promise<{ driver: RowTransferDriver; close: () => Promise<void> }> => {
  const source = connectionManager.getConnectionConfig(sessionId)
  if (!source || !connectionManager.getConnection(sessionId)) throw new Error('Not connected to database')
  const config = { ...source, id: `rows-${randomUUID()}`, sslConfig: source.sslConfig ? { ...source.sslConfig } : undefined }
  let driver: RowTransferDriver | undefined
  let closing: Promise<void> | undefined
  const release = async (): Promise<void> => {
    try { await driver?.disconnect() } finally { sshTunnelManager.closeTunnel(config.id) }
  }
  const close = (): Promise<void> => closing ??= release()
  try {
    if (config.type === DatabaseType.SQLite) {
      driver = await connectSQLite(config)
      return { driver, close }
    }
    if (config.ssh?.enabled && ![DatabaseType.SQLite, DatabaseType.DuckDB].includes(config.type)) {
      config.sslConfig = { ...config.sslConfig, serverName: config.sslConfig?.serverName || config.host }
      config.port = await sshTunnelManager.createTunnel(config.id, config.ssh, config.host || 'localhost', config.port || DEFAULT_PORTS[config.type])
      config.host = '127.0.0.1'
    }
    const created = await connectionManager.createDriver(config.type)
    driver = created
    await created.connect(config)
    return { driver, close }
  } catch (error) { await close().catch(() => {}); throw error }
}
