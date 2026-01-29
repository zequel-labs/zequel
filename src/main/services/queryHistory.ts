import { appDatabase } from './database'
import { logger } from '../utils/logger'

export interface QueryHistoryItem {
  id: number
  connectionId: string
  sql: string
  executionTime?: number
  rowCount?: number
  error?: string
  executedAt: string
}

export interface SavedQuery {
  id: number
  connectionId?: string
  name: string
  sql: string
  description?: string
  createdAt: string
  updatedAt: string
}

export class QueryHistoryService {
  private get db() {
    return appDatabase.getDatabase()
  }

  // Query History Methods
  addToHistory(
    connectionId: string,
    sql: string,
    executionTime?: number,
    rowCount?: number,
    error?: string
  ): QueryHistoryItem {
    const result = this.db.prepare(`
      INSERT INTO query_history (connection_id, sql, execution_time, row_count, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(connectionId, sql, executionTime || null, rowCount || null, error || null)

    logger.debug('Query added to history', { connectionId, id: result.lastInsertRowid })

    return this.getHistoryItem(Number(result.lastInsertRowid))!
  }

  getHistory(connectionId: string, limit = 100, offset = 0): QueryHistoryItem[] {
    const rows = this.db.prepare(`
      SELECT id, connection_id, sql, execution_time, row_count, error, executed_at
      FROM query_history
      WHERE connection_id = ?
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `).all(connectionId, limit, offset) as any[]

    return rows.map(this.mapRowToHistoryItem)
  }

  getAllHistory(limit = 100, offset = 0): QueryHistoryItem[] {
    const rows = this.db.prepare(`
      SELECT id, connection_id, sql, execution_time, row_count, error, executed_at
      FROM query_history
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[]

    return rows.map(this.mapRowToHistoryItem)
  }

  getHistoryItem(id: number): QueryHistoryItem | null {
    const row = this.db.prepare(`
      SELECT id, connection_id, sql, execution_time, row_count, error, executed_at
      FROM query_history
      WHERE id = ?
    `).get(id) as any

    return row ? this.mapRowToHistoryItem(row) : null
  }

  clearHistory(connectionId?: string): number {
    if (connectionId) {
      const result = this.db.prepare('DELETE FROM query_history WHERE connection_id = ?').run(connectionId)
      logger.debug('Query history cleared for connection', { connectionId, deleted: result.changes })
      return result.changes
    } else {
      const result = this.db.prepare('DELETE FROM query_history').run()
      logger.debug('All query history cleared', { deleted: result.changes })
      return result.changes
    }
  }

  deleteHistoryItem(id: number): boolean {
    const result = this.db.prepare('DELETE FROM query_history WHERE id = ?').run(id)
    return result.changes > 0
  }

  // Saved Queries Methods
  saveQuery(
    name: string,
    sql: string,
    connectionId?: string,
    description?: string
  ): SavedQuery {
    const now = new Date().toISOString()
    const result = this.db.prepare(`
      INSERT INTO saved_queries (connection_id, name, sql, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(connectionId || null, name, sql, description || null, now, now)

    logger.debug('Query saved', { id: result.lastInsertRowid, name })

    return this.getSavedQuery(Number(result.lastInsertRowid))!
  }

  updateSavedQuery(
    id: number,
    updates: { name?: string; sql?: string; description?: string }
  ): SavedQuery | null {
    const existing = this.getSavedQuery(id)
    if (!existing) return null

    const now = new Date().toISOString()
    this.db.prepare(`
      UPDATE saved_queries SET
        name = ?,
        sql = ?,
        description = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.name ?? existing.name,
      updates.sql ?? existing.sql,
      updates.description ?? existing.description ?? null,
      now,
      id
    )

    return this.getSavedQuery(id)
  }

  getSavedQuery(id: number): SavedQuery | null {
    const row = this.db.prepare(`
      SELECT id, connection_id, name, sql, description, created_at, updated_at
      FROM saved_queries
      WHERE id = ?
    `).get(id) as any

    return row ? this.mapRowToSavedQuery(row) : null
  }

  listSavedQueries(connectionId?: string): SavedQuery[] {
    let rows: any[]

    if (connectionId) {
      rows = this.db.prepare(`
        SELECT id, connection_id, name, sql, description, created_at, updated_at
        FROM saved_queries
        WHERE connection_id = ? OR connection_id IS NULL
        ORDER BY name ASC
      `).all(connectionId) as any[]
    } else {
      rows = this.db.prepare(`
        SELECT id, connection_id, name, sql, description, created_at, updated_at
        FROM saved_queries
        ORDER BY name ASC
      `).all() as any[]
    }

    return rows.map(this.mapRowToSavedQuery)
  }

  deleteSavedQuery(id: number): boolean {
    const result = this.db.prepare('DELETE FROM saved_queries WHERE id = ?').run(id)
    logger.debug('Saved query deleted', { id, deleted: result.changes > 0 })
    return result.changes > 0
  }

  private mapRowToHistoryItem(row: any): QueryHistoryItem {
    return {
      id: row.id,
      connectionId: row.connection_id,
      sql: row.sql,
      executionTime: row.execution_time || undefined,
      rowCount: row.row_count || undefined,
      error: row.error || undefined,
      executedAt: row.executed_at
    }
  }

  private mapRowToSavedQuery(row: any): SavedQuery {
    return {
      id: row.id,
      connectionId: row.connection_id || undefined,
      name: row.name,
      sql: row.sql,
      description: row.description || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }
}

export const queryHistoryService = new QueryHistoryService()
