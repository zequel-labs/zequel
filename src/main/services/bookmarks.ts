import { appDatabase } from './database'
import { logger } from '../utils/logger'

export type BookmarkType = 'table' | 'view' | 'query'

export interface Bookmark {
  id: number
  type: BookmarkType
  name: string
  connectionId: string
  database?: string
  schema?: string
  sql?: string
  folder?: string
  createdAt: string
}

interface BookmarkRow {
  id: number
  type: string
  name: string
  connection_id: string
  database: string | null
  schema: string | null
  sql: string | null
  folder: string | null
  created_at: string
}

export class BookmarksService {
  private get db() {
    return appDatabase.getDatabase()
  }

  addBookmark(
    type: BookmarkType,
    name: string,
    connectionId: string,
    database?: string,
    schema?: string,
    sql?: string,
    folder?: string
  ): Bookmark {
    const result = this.db.prepare(`
      INSERT INTO bookmarks (type, name, connection_id, database, schema, sql, folder)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(type, name, connectionId, database || null, schema || null, sql || null, folder || null)

    logger.debug('Bookmark added', { type, name, connectionId })
    return this.getBookmark(Number(result.lastInsertRowid))!
  }

  getBookmark(id: number): Bookmark | null {
    const row = this.db.prepare(`
      SELECT id, type, name, connection_id, database, schema, sql, folder, created_at
      FROM bookmarks
      WHERE id = ?
    `).get(id) as BookmarkRow | undefined

    return row ? this.mapRow(row) : null
  }

  getBookmarks(connectionId?: string): Bookmark[] {
    let sql = `
      SELECT id, type, name, connection_id, database, schema, sql, folder, created_at
      FROM bookmarks
    `
    const params: unknown[] = []

    if (connectionId) {
      sql += ` WHERE connection_id = ?`
      params.push(connectionId)
    }

    sql += ` ORDER BY folder NULLS LAST, name ASC`

    const rows = this.db.prepare(sql).all(...params) as BookmarkRow[]
    return rows.map(this.mapRow)
  }

  getBookmarksByType(type: BookmarkType, connectionId?: string): Bookmark[] {
    let sql = `
      SELECT id, type, name, connection_id, database, schema, sql, folder, created_at
      FROM bookmarks
      WHERE type = ?
    `
    const params: unknown[] = [type]

    if (connectionId) {
      sql += ` AND connection_id = ?`
      params.push(connectionId)
    }

    sql += ` ORDER BY folder NULLS LAST, name ASC`

    const rows = this.db.prepare(sql).all(...params) as BookmarkRow[]
    return rows.map(this.mapRow)
  }

  getFolders(connectionId?: string): string[] {
    let sql = `
      SELECT DISTINCT folder FROM bookmarks
      WHERE folder IS NOT NULL AND folder != ''
    `
    const params: unknown[] = []

    if (connectionId) {
      sql += ` AND connection_id = ?`
      params.push(connectionId)
    }

    sql += ` ORDER BY folder`

    const rows = this.db.prepare(sql).all(...params) as { folder: string }[]
    return rows.map((r) => r.folder)
  }

  updateBookmark(id: number, updates: { name?: string; folder?: string; sql?: string }): Bookmark | null {
    const sets: string[] = []
    const params: unknown[] = []

    if (updates.name !== undefined) {
      sets.push('name = ?')
      params.push(updates.name)
    }
    if (updates.folder !== undefined) {
      sets.push('folder = ?')
      params.push(updates.folder || null)
    }
    if (updates.sql !== undefined) {
      sets.push('sql = ?')
      params.push(updates.sql || null)
    }

    if (sets.length === 0) return this.getBookmark(id)

    params.push(id)
    this.db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(...params)

    return this.getBookmark(id)
  }

  removeBookmark(id: number): boolean {
    const result = this.db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id)
    return result.changes > 0
  }

  isBookmarked(type: BookmarkType, name: string, connectionId: string): boolean {
    const row = this.db.prepare(`
      SELECT id FROM bookmarks
      WHERE type = ? AND name = ? AND connection_id = ?
    `).get(type, name, connectionId)

    return !!row
  }

  clearBookmarks(connectionId?: string): number {
    if (connectionId) {
      const result = this.db.prepare('DELETE FROM bookmarks WHERE connection_id = ?').run(connectionId)
      return result.changes
    }
    const result = this.db.prepare('DELETE FROM bookmarks').run()
    return result.changes
  }

  private mapRow(row: BookmarkRow): Bookmark {
    return {
      id: row.id,
      type: row.type as BookmarkType,
      name: row.name,
      connectionId: row.connection_id,
      database: row.database || undefined,
      schema: row.schema || undefined,
      sql: row.sql || undefined,
      folder: row.folder || undefined,
      createdAt: row.created_at
    }
  }
}

export const bookmarksService = new BookmarksService()
