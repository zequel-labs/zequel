import { BaseCursor } from './BaseCursor'
import { logger } from '../../utils/logger'

export class CursorManager {
  private cursors = new Map<string, BaseCursor>()
  private nextId = 1

  async register(cursor: BaseCursor): Promise<string> {
    const id = `cursor_${this.nextId++}`
    this.cursors.set(id, cursor)
    try {
      await cursor.start()
    } catch (err) {
      this.cursors.delete(id)
      try { await cursor.cancel() } catch { /* ignore cleanup errors */ }
      throw err
    }
    logger.debug('Cursor registered', { cursorId: id, chunkSize: cursor.chunkSize })
    return id
  }

  async read(cursorId: string): Promise<Record<string, unknown>[]> {
    const cursor = this.cursors.get(cursorId)
    if (!cursor) {
      throw new Error(`Cursor not found: ${cursorId}`)
    }

    const rows = await cursor.read()

    // Auto-close when no more data
    if (rows.length === 0) {
      await this.cancel(cursorId)
    }

    return rows
  }

  async cancel(cursorId: string): Promise<void> {
    const cursor = this.cursors.get(cursorId)
    if (cursor) {
      try {
        await cursor.cancel()
      } finally {
        this.cursors.delete(cursorId)
        logger.debug('Cursor cancelled', { cursorId })
      }
    }
  }

  async cancelAll(): Promise<void> {
    for (const [id, cursor] of this.cursors) {
      try {
        await cursor.cancel()
      } catch (err) {
        logger.warn('Error cancelling cursor', { cursorId: id, error: err instanceof Error ? err.message : String(err) })
      }
    }
    this.cursors.clear()
  }

  get activeCount(): number {
    return this.cursors.size
  }
}

export const cursorManager = new CursorManager()
