import { appDatabase } from './database'
import { logger } from '../utils/logger'
import { ItemType } from '../types'

export interface RecentItem {
  id: number
  type: ItemType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sql?: string
  accessedAt: string
}

const MAX_RECENTS = 50

export class RecentsService {
  private get db() {
    return appDatabase.getDatabase()
  }

  addRecent(
    type: ItemType,
    name: string,
    connectionId: string,
    database?: string,
    schema?: string,
    sql?: string
  ): RecentItem {
    // Use INSERT OR REPLACE to update if exists, insert if not
    // First try to update the accessed_at if the record exists
    const existing = this.db.prepare(`
      SELECT id FROM recents
      WHERE type = ? AND name = ? AND connection_id = ?
    `).get(type, name, connectionId) as { id: number } | undefined

    if (existing) {
      // Update accessed_at
      this.db.prepare(`
        UPDATE recents SET accessed_at = datetime('now'), sql = COALESCE(?, sql)
        WHERE id = ?
      `).run(sql || null, existing.id)

      return this.getRecent(existing.id)!
    }

    // Insert new record
    const result = this.db.prepare(`
      INSERT INTO recents (type, name, connection_id, database, schema, sql)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, name, connectionId, database || null, schema || null, sql || null)

    logger.debug('Recent item added', { type, name, connectionId })

    // Cleanup old records if we have too many
    this.cleanup()

    return this.getRecent(Number(result.lastInsertRowid))!
  }

  getRecent(id: number): RecentItem | null {
    const row = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sql, accessed_at
      FROM recents
      WHERE id = ?
    `).get(id) as any

    return row ? this.mapRowToRecent(row) : null
  }

  getRecents(limit = 20): RecentItem[] {
    const rows = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sql, accessed_at
      FROM recents
      ORDER BY accessed_at DESC
      LIMIT ?
    `).all(limit) as any[]

    return rows.map(this.mapRowToRecent)
  }

  getRecentsByConnection(connectionId: string, limit = 20): RecentItem[] {
    const rows = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sql, accessed_at
      FROM recents
      WHERE connection_id = ?
      ORDER BY accessed_at DESC
      LIMIT ?
    `).all(connectionId, limit) as any[]

    return rows.map(this.mapRowToRecent)
  }

  getRecentsByType(type: ItemType, limit = 20): RecentItem[] {
    const rows = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sql, accessed_at
      FROM recents
      WHERE type = ?
      ORDER BY accessed_at DESC
      LIMIT ?
    `).all(type, limit) as any[]

    return rows.map(this.mapRowToRecent)
  }

  removeRecent(id: number): boolean {
    const result = this.db.prepare('DELETE FROM recents WHERE id = ?').run(id)
    return result.changes > 0
  }

  clearRecents(): number {
    const result = this.db.prepare('DELETE FROM recents').run()
    logger.debug('All recents cleared', { deleted: result.changes })
    return result.changes
  }

  clearRecentsForConnection(connectionId: string): number {
    const result = this.db.prepare('DELETE FROM recents WHERE connection_id = ?').run(connectionId)
    logger.debug('Recents cleared for connection', { connectionId, deleted: result.changes })
    return result.changes
  }

  private cleanup(): void {
    // Keep only the most recent MAX_RECENTS items
    this.db.prepare(`
      DELETE FROM recents
      WHERE id NOT IN (
        SELECT id FROM recents
        ORDER BY accessed_at DESC
        LIMIT ?
      )
    `).run(MAX_RECENTS)
  }

  private mapRowToRecent(row: any): RecentItem {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      connectionId: row.connection_id,
      database: row.database || undefined,
      schema: row.schema || undefined,
      sql: row.sql || undefined,
      accessedAt: row.accessed_at
    }
  }
}

export const recentsService = new RecentsService()
