import { appDatabase } from './database'
import type { ConnectionConfig, ConnectionEnvironment, SavedConnection } from '../types'
import { logger } from '../utils/logger'

interface ConnectionRow {
  id: string
  name: string
  type: string
  host: string | null
  port: number | null
  database: string | null
  username: string | null
  filepath: string | null
  ssl: number
  ssl_config: string | null
  ssh_config: string | null
  color: string | null
  environment: string | null
  folder: string | null
  sort_order: number
  created_at: string
  updated_at: string
  last_connected_at: string | null
}

export class ConnectionsService {
  private get db() {
    return appDatabase.getDatabase()
  }

  list(): SavedConnection[] {
    const rows = this.db.prepare(`
      SELECT
        id, name, type, host, port, database, username, filepath,
        ssl, ssl_config, ssh_config, color, environment, folder, sort_order, created_at, updated_at, last_connected_at
      FROM connections
      ORDER BY sort_order ASC, name ASC
    `).all() as ConnectionRow[]

    return rows.map((row) => this.mapRowToConnection(row))
  }

  get(id: string): SavedConnection | null {
    const row = this.db.prepare(`
      SELECT
        id, name, type, host, port, database, username, filepath,
        ssl, ssl_config, ssh_config, color, environment, folder, sort_order, created_at, updated_at, last_connected_at
      FROM connections
      WHERE id = ?
    `).get(id) as ConnectionRow | undefined

    return row ? this.mapRowToConnection(row) : null
  }

  save(config: ConnectionConfig): SavedConnection {
    const existing = this.get(config.id)
    const now = new Date().toISOString()

    // Prepare SSH config for storage (remove sensitive data if needed)
    const sshConfigForStorage = config.ssh ? { ...config.ssh } : null

    if (existing) {
      // Update existing connection
      this.db.prepare(`
        UPDATE connections SET
          name = ?,
          type = ?,
          host = ?,
          port = ?,
          database = ?,
          username = ?,
          filepath = ?,
          ssl = ?,
          ssl_config = ?,
          ssh_config = ?,
          color = ?,
          environment = ?,
          folder = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        config.name,
        config.type,
        config.host || null,
        config.port || null,
        config.database,
        config.username || null,
        config.filepath || null,
        config.ssl ? 1 : 0,
        config.sslConfig ? JSON.stringify(config.sslConfig) : null,
        sshConfigForStorage ? JSON.stringify(sshConfigForStorage) : null,
        config.color || null,
        config.environment || null,
        config.folder || null,
        now,
        config.id
      )

      logger.debug('Connection updated', { id: config.id, name: config.name })
    } else {
      // Insert new connection
      this.db.prepare(`
        INSERT INTO connections (
          id, name, type, host, port, database, username, filepath,
          ssl, ssl_config, ssh_config, color, environment, folder, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        config.id,
        config.name,
        config.type,
        config.host || null,
        config.port || null,
        config.database,
        config.username || null,
        config.filepath || null,
        config.ssl ? 1 : 0,
        config.sslConfig ? JSON.stringify(config.sslConfig) : null,
        sshConfigForStorage ? JSON.stringify(sshConfigForStorage) : null,
        config.color || null,
        config.environment || null,
        config.folder || null,
        now,
        now
      )

      logger.debug('Connection created', { id: config.id, name: config.name })
    }

    return this.get(config.id)!
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM connections WHERE id = ?').run(id)
    logger.debug('Connection deleted', { id, deleted: result.changes > 0 })
    return result.changes > 0
  }

  updateFolder(id: string, folder: string | null): void {
    this.db.prepare(`
      UPDATE connections SET folder = ?, updated_at = ? WHERE id = ?
    `).run(folder, new Date().toISOString(), id)
    logger.debug('Connection folder updated', { id, folder })
  }

  getFolders(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT folder FROM connections WHERE folder IS NOT NULL AND folder != '' ORDER BY folder ASC
    `).all() as { folder: string }[]
    return rows.map(r => r.folder)
  }

  renameFolder(oldName: string, newName: string): void {
    this.db.prepare(`
      UPDATE connections SET folder = ?, updated_at = ? WHERE folder = ?
    `).run(newName, new Date().toISOString(), oldName)
    logger.debug('Folder renamed', { oldName, newName })
  }

  deleteFolder(folder: string): void {
    this.db.prepare(`
      UPDATE connections SET folder = NULL, updated_at = ? WHERE folder = ?
    `).run(new Date().toISOString(), folder)
    logger.debug('Folder deleted, connections moved to ungrouped', { folder })
  }

  updatePositions(positions: { id: string; sortOrder: number; folder: string | null }[]): void {
    const stmt = this.db.prepare(`
      UPDATE connections SET sort_order = ?, folder = ?, updated_at = ? WHERE id = ?
    `)
    const now = new Date().toISOString()
    const run = this.db.transaction(() => {
      for (const p of positions) {
        stmt.run(p.sortOrder, p.folder, now, p.id)
      }
    })
    run()
    logger.debug('Connection positions updated', { count: positions.length })
  }

  updateLastConnected(id: string): void {
    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE connections SET last_connected_at = ? WHERE id = ?
    `).run(now, id)
    logger.debug('Connection last_connected_at updated', { id })
  }

  private mapRowToConnection(row: ConnectionRow): SavedConnection {
    // Use null instead of undefined for better IPC serialization
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      host: row.host || null,
      port: row.port || null,
      database: row.database,
      username: row.username || null,
      filepath: row.filepath || null,
      ssl: row.ssl === 1,
      sslConfig: this.safeJsonParse(row.ssl_config),
      ssh: this.safeJsonParse(row.ssh_config),
      color: row.color || null,
      environment: (row.environment as ConnectionEnvironment) || null,
      folder: row.folder || null,
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastConnectedAt: row.last_connected_at || null
    }
  }
  private safeJsonParse(value: string | null): unknown {
    if (!value) return null
    try {
      return JSON.parse(value)
    } catch {
      logger.warn('Failed to parse JSON from database', { value: value.substring(0, 50) })
      return null
    }
  }
}

export const connectionsService = new ConnectionsService()
