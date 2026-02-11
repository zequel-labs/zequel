import { appDatabase } from './database'
import { logger } from '../utils/logger'
import { TableObjectType } from '../types'

export interface PinnedEntity {
  id: number
  type: TableObjectType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sortOrder: number
  createdAt: string
}

export class PinnedService {
  private get db() {
    return appDatabase.getDatabase()
  }

  pin(
    type: TableObjectType,
    name: string,
    connectionId: string,
    database?: string,
    schema?: string
  ): PinnedEntity {
    const existing = this.db.prepare(`
      SELECT id FROM pinned_entities
      WHERE type = ? AND name = ? AND connection_id = ? AND COALESCE(schema, '') = ?
    `).get(type, name, connectionId, schema || '') as { id: number } | undefined

    if (existing) {
      return this.getById(existing.id)!
    }

    const maxOrder = this.db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order FROM pinned_entities
      WHERE connection_id = ?
    `).get(connectionId) as { max_order: number }

    const result = this.db.prepare(`
      INSERT INTO pinned_entities (type, name, connection_id, database, schema, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, name, connectionId, database || null, schema || null, maxOrder.max_order + 1)

    logger.debug('Entity pinned', { type, name, connectionId })

    return this.getById(Number(result.lastInsertRowid))!
  }

  unpin(id: number): boolean {
    const result = this.db.prepare('DELETE FROM pinned_entities WHERE id = ?').run(id)
    return result.changes > 0
  }

  unpinByName(
    type: TableObjectType,
    name: string,
    connectionId: string,
    schema?: string
  ): boolean {
    const result = this.db.prepare(`
      DELETE FROM pinned_entities
      WHERE type = ? AND name = ? AND connection_id = ? AND COALESCE(schema, '') = ?
    `).run(type, name, connectionId, schema || '')
    return result.changes > 0
  }

  listByConnection(connectionId: string): PinnedEntity[] {
    const rows = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sort_order, created_at
      FROM pinned_entities
      WHERE connection_id = ?
      ORDER BY sort_order ASC
    `).all(connectionId) as any[]

    return rows.map(this.mapRowToEntity)
  }

  isPinned(
    type: TableObjectType,
    name: string,
    connectionId: string,
    schema?: string
  ): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM pinned_entities
      WHERE type = ? AND name = ? AND connection_id = ? AND COALESCE(schema, '') = ?
    `).get(type, name, connectionId, schema || '')
    return !!row
  }

  reorder(ids: number[]): void {
    const stmt = this.db.prepare('UPDATE pinned_entities SET sort_order = ? WHERE id = ?')
    const transaction = this.db.transaction(() => {
      for (let i = 0; i < ids.length; i++) {
        stmt.run(i, ids[i])
      }
    })
    transaction()
  }

  clearForConnection(connectionId: string): number {
    const result = this.db.prepare('DELETE FROM pinned_entities WHERE connection_id = ?').run(connectionId)
    logger.debug('Pinned entities cleared for connection', { connectionId, deleted: result.changes })
    return result.changes
  }

  private getById(id: number): PinnedEntity | null {
    const row = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sort_order, created_at
      FROM pinned_entities
      WHERE id = ?
    `).get(id) as any

    return row ? this.mapRowToEntity(row) : null
  }

  private mapRowToEntity(row: any): PinnedEntity {
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      connectionId: row.connection_id,
      database: row.database || undefined,
      schema: row.schema || undefined,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }
  }
}

export const pinnedService = new PinnedService()
