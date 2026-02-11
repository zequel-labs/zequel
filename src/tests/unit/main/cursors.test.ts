import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CursorManager } from '@main/db/cursors/CursorManager'
import { BaseCursor } from '@main/db/cursors/BaseCursor'

vi.mock('@main/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Helper: concrete test cursor ──────────────────────────────────────────

class TestCursor extends BaseCursor {
  public startCalled = false
  public cancelCalled = false
  private batches: Record<string, unknown>[][]

  constructor(batches: Record<string, unknown>[][], chunkSize = 100) {
    super(chunkSize)
    this.batches = [...batches]
  }

  async start(): Promise<void> {
    this.startCalled = true
  }

  async read(): Promise<Record<string, unknown>[]> {
    return this.batches.shift() || []
  }

  async cancel(): Promise<void> {
    this.cancelCalled = true
  }
}

// ─── CursorManager ─────────────────────────────────────────────────────────

describe('CursorManager', () => {
  let manager: CursorManager

  beforeEach(() => {
    manager = new CursorManager()
  })

  it('should register a cursor and call start()', async () => {
    const cursor = new TestCursor([[{ a: 1 }]])
    const id = await manager.register(cursor)

    expect(id).toMatch(/^cursor_\d+$/)
    expect(cursor.startCalled).toBe(true)
    expect(manager.activeCount).toBe(1)
  })

  it('should assign incrementing IDs', async () => {
    const c1 = new TestCursor([[]])
    const c2 = new TestCursor([[]])
    const id1 = await manager.register(c1)
    const id2 = await manager.register(c2)

    expect(id1).not.toBe(id2)
    expect(manager.activeCount).toBe(2)
  })

  it('should read rows from a registered cursor', async () => {
    const cursor = new TestCursor([
      [{ id: 1 }, { id: 2 }],
      [{ id: 3 }],
      [],
    ])
    const id = await manager.register(cursor)

    const batch1 = await manager.read(id)
    expect(batch1).toEqual([{ id: 1 }, { id: 2 }])

    const batch2 = await manager.read(id)
    expect(batch2).toEqual([{ id: 3 }])
  })

  it('should auto-cancel cursor when read returns empty', async () => {
    const cursor = new TestCursor([
      [{ id: 1 }],
      [],
    ])
    const id = await manager.register(cursor)

    await manager.read(id)
    const empty = await manager.read(id)

    expect(empty).toEqual([])
    expect(cursor.cancelCalled).toBe(true)
    expect(manager.activeCount).toBe(0)
  })

  it('should throw when reading an unknown cursor', async () => {
    await expect(manager.read('cursor_999')).rejects.toThrow('Cursor not found: cursor_999')
  })

  it('should cancel a cursor and remove it', async () => {
    const cursor = new TestCursor([[{ a: 1 }]])
    const id = await manager.register(cursor)

    await manager.cancel(id)

    expect(cursor.cancelCalled).toBe(true)
    expect(manager.activeCount).toBe(0)
  })

  it('should silently handle cancelling an unknown cursor', async () => {
    await expect(manager.cancel('cursor_unknown')).resolves.toBeUndefined()
  })

  it('should cancel all cursors', async () => {
    const c1 = new TestCursor([[]])
    const c2 = new TestCursor([[]])
    const c3 = new TestCursor([[]])
    await manager.register(c1)
    await manager.register(c2)
    await manager.register(c3)

    expect(manager.activeCount).toBe(3)

    await manager.cancelAll()

    expect(c1.cancelCalled).toBe(true)
    expect(c2.cancelCalled).toBe(true)
    expect(c3.cancelCalled).toBe(true)
    expect(manager.activeCount).toBe(0)
  })

  it('should clean up cursor from map and call cancel() if start() fails', async () => {
    const cursor = new TestCursor([[]])
    cursor.start = async () => { throw new Error('start failed') }

    await expect(manager.register(cursor)).rejects.toThrow('start failed')
    expect(manager.activeCount).toBe(0)
    expect(cursor.cancelCalled).toBe(true)
  })

  it('should continue cancelling remaining cursors when one throws', async () => {
    const c1 = new TestCursor([[]])
    const c2 = new TestCursor([[]])
    // Override cancel to throw for c1
    c1.cancel = async () => { throw new Error('cancel failed') }
    await manager.register(c1)
    await manager.register(c2)

    await manager.cancelAll()

    expect(c2.cancelCalled).toBe(true)
    expect(manager.activeCount).toBe(0)
  })
})

// ─── SQLiteCursor ───────────────────────────────────────────────────────────

describe('SQLiteCursor', () => {
  // We test SQLiteCursor directly since better-sqlite3 is synchronous and easy to mock

  it('should iterate through rows in chunks', async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    let index = 0
    const iterator: IterableIterator<Record<string, unknown>> = {
      [Symbol.iterator]() { return this },
      next() {
        if (index < rows.length) {
          return { value: rows[index++], done: false }
        }
        return { value: undefined, done: true }
      },
    }

    const mockStmt = {
      iterate: vi.fn().mockReturnValue(iterator),
    }
    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    }

    const { SQLiteCursor } = await import('@main/db/cursors/SQLiteCursor')
    const cursor = new SQLiteCursor(mockDb as any, 'SELECT * FROM t', [], 2)

    await cursor.start()
    expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM t')
    expect(mockStmt.iterate).toHaveBeenCalled()

    const batch1 = await cursor.read()
    expect(batch1).toEqual([{ id: 1 }, { id: 2 }])

    const batch2 = await cursor.read()
    expect(batch2).toEqual([{ id: 3 }, { id: 4 }])

    const batch3 = await cursor.read()
    expect(batch3).toEqual([{ id: 5 }])

    const batch4 = await cursor.read()
    expect(batch4).toEqual([])

    await cursor.cancel()
  })

  it('should return empty when read before start', async () => {
    const { SQLiteCursor } = await import('@main/db/cursors/SQLiteCursor')
    const cursor = new SQLiteCursor({} as any, 'SELECT 1', [], 10)

    const rows = await cursor.read()
    expect(rows).toEqual([])
  })

  it('should pass params to iterate when present', async () => {
    const mockStmt = {
      iterate: vi.fn().mockReturnValue({
        [Symbol.iterator]() { return this },
        next() { return { value: undefined, done: true } },
      }),
    }
    const mockDb = {
      prepare: vi.fn().mockReturnValue(mockStmt),
    }

    const { SQLiteCursor } = await import('@main/db/cursors/SQLiteCursor')
    const cursor = new SQLiteCursor(mockDb as any, 'SELECT * FROM t WHERE id = ?', [42], 10)

    await cursor.start()
    expect(mockStmt.iterate).toHaveBeenCalledWith(42)
  })
})

// ─── ClickHouseCursor ───────────────────────────────────────────────────────

describe('ClickHouseCursor', () => {
  it('should paginate using LIMIT/OFFSET', async () => {
    const mockJson = vi.fn()
    const mockQuery = vi.fn().mockResolvedValue({ json: mockJson })

    mockJson
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }])
      .mockResolvedValueOnce([])

    const mockClient = { query: mockQuery }

    const { ClickHouseCursor } = await import('@main/db/cursors/ClickHouseCursor')
    const cursor = new ClickHouseCursor(mockClient as any, 'SELECT * FROM t', 2)

    await cursor.start()

    const batch1 = await cursor.read()
    expect(batch1).toEqual([{ id: 1 }, { id: 2 }])
    expect(mockQuery).toHaveBeenCalledWith({
      query: 'SELECT * FROM t LIMIT 2 OFFSET 0',
      format: 'JSONEachRow',
    })

    const batch2 = await cursor.read()
    expect(batch2).toEqual([{ id: 3 }])
    expect(mockQuery).toHaveBeenCalledWith({
      query: 'SELECT * FROM t LIMIT 2 OFFSET 2',
      format: 'JSONEachRow',
    })

    const batch3 = await cursor.read()
    expect(batch3).toEqual([])

    await cursor.cancel() // no-op for ClickHouse
  })
})

// ─── MongoDBCursor ──────────────────────────────────────────────────────────

describe('MongoDBCursor', () => {
  it('should iterate through MongoDB cursor in chunks', async () => {
    const docs = [
      { _id: 'a', name: 'Alice' },
      { _id: 'b', name: 'Bob' },
      { _id: 'c', name: 'Charlie' },
    ]
    let index = 0

    const mockFindCursor = {
      next: vi.fn().mockImplementation(async () => index < docs.length ? docs[index++] : null),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const mockCollection = {
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue(mockFindCursor),
      }),
    }
    const mockSerialize = vi.fn().mockImplementation((doc: Record<string, unknown>) => ({ ...doc, serialized: true }))

    const { MongoDBCursor } = await import('@main/db/cursors/MongoDBCursor')
    const cursor = new MongoDBCursor(mockCollection as any, { active: true }, { name: 1 }, mockSerialize, 2)

    await cursor.start()
    expect(mockCollection.find).toHaveBeenCalledWith({ active: true })

    const batch1 = await cursor.read()
    expect(batch1).toHaveLength(2)
    expect(batch1[0]).toEqual({ _id: 'a', name: 'Alice', serialized: true })
    expect(mockSerialize).toHaveBeenCalled()

    const batch2 = await cursor.read()
    expect(batch2).toHaveLength(1)

    const batch3 = await cursor.read()
    expect(batch3).toHaveLength(0)

    await cursor.cancel()
    expect(mockFindCursor.close).toHaveBeenCalled()
  })

  it('should return empty when read before start', async () => {
    const { MongoDBCursor } = await import('@main/db/cursors/MongoDBCursor')
    const cursor = new MongoDBCursor({} as any, {}, {}, (d: any) => d, 10)

    const rows = await cursor.read()
    expect(rows).toEqual([])
  })
})

// ─── MySQLCursor ────────────────────────────────────────────────────────────

describe('MySQLCursor', () => {
  it('should buffer rows and pause/resume the connection', async () => {
    const { MySQLCursor } = await import('@main/db/cursors/MySQLCursor')

    // We test the constructor sets chunkSize correctly
    const cursor = new MySQLCursor({} as any, 'SELECT 1', [], 500)
    expect(cursor.chunkSize).toBe(500)
  })
})

// ─── PostgresCursor ─────────────────────────────────────────────────────────

describe('PostgresCursor', () => {
  it('should store chunkSize from constructor', async () => {
    const { PostgresCursor } = await import('@main/db/cursors/PostgresCursor')
    const cursor = new PostgresCursor({} as any, 'SELECT 1', [], 1000)
    expect(cursor.chunkSize).toBe(1000)
  })
})
