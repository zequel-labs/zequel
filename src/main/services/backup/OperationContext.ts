import { randomUUID } from 'node:crypto'
import { connectionManager } from '@main/db/manager'
import type { DatabaseDriver } from '@main/db/base'
import { sshTunnelManager } from '@main/services/ssh-tunnel'
import { DatabaseType, DEFAULT_PORTS, type ConnectionConfig, type SavedConnection } from '@main/types'

export interface OperationContext {
  id: string
  connection: SavedConnection
  driver?: DatabaseDriver
  close: () => Promise<void>
}

/** Owns resources independently of every editor session and window. */
export const createOperationContext = async (
  connection: SavedConnection,
  password: string | null,
  needsDriver: boolean,
): Promise<OperationContext> => {
  const id = `operation-${randomUUID()}`
  let driver: DatabaseDriver | undefined
  let closed = false
  const close = async (): Promise<void> => {
    if (closed) return
    closed = true
    try {
      await driver?.disconnect()
    } finally {
      sshTunnelManager.closeTunnel(id)
    }
  }
  try {
    const sslConfig = connection.sslConfig || connection.ssl
      ? { ...connection.sslConfig, serverName: connection.sslConfig?.serverName || connection.host || undefined }
      : undefined
    let host = connection.host ?? undefined
    let port = connection.port ?? DEFAULT_PORTS[connection.type]
    if (connection.ssh?.enabled && ![DatabaseType.SQLite, DatabaseType.DuckDB].includes(connection.type)) {
      port = await sshTunnelManager.createTunnel(id, connection.ssh, host || 'localhost', port)
      host = '127.0.0.1'
    }
    if (needsDriver) {
      const config: ConnectionConfig = {
        id, name: connection.name, type: connection.type,
        database: connection.database, host, port,
        username: connection.username ?? undefined,
        password: password ?? undefined,
        filepath: connection.filepath ?? undefined,
        ssl: connection.ssl,
        sslConfig,
        trustServerCertificate: connection.trustServerCertificate,
      }
      driver = await connectionManager.createDriver(connection.type)
      await driver.connect(config)
    }
    return { id, connection: { ...connection, sslConfig: sslConfig ?? null }, driver, close }
  } catch (error) {
    await close().catch(() => {})
    throw error
  }
}
