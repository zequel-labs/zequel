import { EventEmitter } from 'node:events'
import { MessageChannel, type MessagePort } from 'node:worker_threads'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BaseCursor } from '@main/db/cursors/BaseCursor'
import type { DatabaseDriver } from '@main/db/base'
import { DatabaseType, type ConnectionConfig } from '@main/types'
import { connectSQLiteRowWorker, serveSQLiteRows, type RowTransferWorker } from '@main/services/row-transfer-sqlite'

const config = { id: 'rows-1', name: 'File', type: DatabaseType.SQLite, database: '/tmp/file.sqlite', filepath: '/tmp/file.sqlite' } as ConnectionConfig

class FakeCursor extends BaseCursor {
  rows: Record<string, unknown>[] = [{ id: 1 }, { id: 2 }, { id: 3 }]
  started = false
  cancelled = false
  reads = 0
  async start(): Promise<void> { this.started = true }
  async read(): Promise<Record<string, unknown>[]> { this.reads++; return this.rows.splice(0, this.chunkSize) }
  async cancel(): Promise<void> { this.cancelled = true }
}

/** A worker double backed by a real MessageChannel, so values cross a real serialization boundary. */
class ChannelWorker extends EventEmitter {
  terminated = 0
  constructor(private readonly port: MessagePort) {
    super()
    port.on('message', (value: Uint8Array) => this.emit('message', value))
  }
  postMessage(value: Uint8Array): void { this.port.postMessage(value) }
  async terminate(): Promise<number> {
    this.terminated++
    this.port.close()
    this.emit('exit', 1)
    return 1
  }
}

const channels: MessageChannel[] = []
afterEach(() => { for (const channel of channels.splice(0)) { channel.port1.close(); channel.port2.close() } })

const setup = (overrides: Partial<Record<keyof DatabaseDriver, unknown>> = {}) => {
  const cursor = new FakeCursor(2)
  const driver = {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    execute: vi.fn(async () => ({ rows: [{ blob: Buffer.from([0, 255]), big: 2n ** 63n, at: new Date(0), bytes: new Uint8Array([7]) }], columns: [], rowCount: 1, executionTime: 1 })),
    beginTransaction: vi.fn(async () => {}),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => {}),
    selectTopStream: vi.fn(async () => ({ columns: [{ name: 'id', type: 'INTEGER' }], totalRows: 3, cursor })),
    ...overrides,
  }
  const channel = new MessageChannel()
  channels.push(channel)
  serveSQLiteRows(channel.port2, () => driver as unknown as DatabaseDriver)
  const worker = new ChannelWorker(channel.port1)
  return { driver, cursor, worker, connect: () => connectSQLiteRowWorker(worker as unknown as RowTransferWorker, config) }
}

describe('SQLite row transfer worker', () => {
  it('connects with the dedicated configuration and preserves exact value types', async () => {
    const { driver, connect } = setup()
    const rows = await connect()
    expect(driver.connect).toHaveBeenCalledWith(config)
    expect(rows.type).toBe(DatabaseType.SQLite)
    expect(rows.supportsTransactions).toBe(true)
    const result = await rows.execute('SELECT * FROM t WHERE id = ?', [1n], true)
    expect(driver.execute).toHaveBeenCalledWith('SELECT * FROM t WHERE id = ?', [1n], true)
    const [row] = result.rows
    expect(Buffer.isBuffer(row.blob)).toBe(true)
    expect(row.blob).toEqual(Buffer.from([0, 255]))
    expect(row.big).toBe(2n ** 63n)
    expect(row.at).toEqual(new Date(0))
    expect(Buffer.isBuffer(row.bytes)).toBe(false)
    expect(row.bytes).toEqual(new Uint8Array([7]))
  })

  it('runs requests in order even when a statement is slow', async () => {
    const order: string[] = []
    const { connect } = setup({
      execute: vi.fn(async (sql: string) => {
        if (sql === 'slow') await new Promise(resolve => setTimeout(resolve, 20))
        order.push(sql)
        return { rows: [], columns: [], rowCount: 0, executionTime: 0 }
      }),
      commitTransaction: vi.fn(async () => { order.push('COMMIT') }),
    })
    const rows = await connect()
    await Promise.all([rows.execute('slow'), rows.execute('fast'), rows.commitTransaction()])
    expect(order).toEqual(['slow', 'fast', 'COMMIT'])
  })

  it('rejects with the driver error and keeps serving later requests', async () => {
    const { driver, connect } = setup({ commitTransaction: vi.fn(async () => { throw new Error('SQLITE_FULL: database or disk is full') }) })
    const rows = await connect()
    await expect(rows.commitTransaction()).rejects.toThrow('SQLITE_FULL: database or disk is full')
    await rows.rollbackTransaction()
    expect(driver.rollbackTransaction).toHaveBeenCalledOnce()
  })

  it('streams cursor chunks from the worker and cancels them', async () => {
    const { cursor, connect } = setup()
    const rows = await connect()
    const stream = await rows.selectTopStream('items', { rawValues: true }, 2)
    expect(stream.columns).toEqual([{ name: 'id', type: 'INTEGER' }])
    expect(stream.totalRows).toBe(3)
    expect(stream.cursor.chunkSize).toBe(2)
    await stream.cursor.start()
    expect(cursor.started).toBe(true)
    expect(await stream.cursor.read()).toEqual([{ id: 1 }, { id: 2 }])
    expect(await stream.cursor.read()).toEqual([{ id: 3 }])
    expect(await stream.cursor.read()).toEqual([])
    await stream.cursor.cancel()
    expect(cursor.cancelled).toBe(true)
    expect(await stream.cursor.read()).toEqual([])
  })

  it('batches cursor chunks per message but prefetches only one bounded block', async () => {
    const { cursor, connect } = setup()
    cursor.rows = Array.from({ length: 10 }, (_, id) => ({ id, payload: Buffer.alloc(1024 * 1024, id) }))
    const rows = await connect()
    const stream = await rows.selectTopStream('items', {}, 2)
    await stream.cursor.start()
    const first = await stream.cursor.read()
    expect(first.map(row => row.id)).toEqual([0, 1])
    expect(Buffer.isBuffer(first[0].payload)).toBe(true)
    // Each 4 MiB block takes two 2-row reads; only the first block and one prefetched block are read.
    await vi.waitFor(() => expect(cursor.reads).toBe(4))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(cursor.reads).toBe(4)
    const ids = first.map(row => row.id)
    for (;;) {
      const chunk = await stream.cursor.read()
      if (!chunk.length) break
      expect(chunk).toHaveLength(2)
      ids.push(...chunk.map(row => row.id))
    }
    expect(ids).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('propagates read failures from a prefetched block', async () => {
    const { cursor, connect } = setup()
    cursor.read = async () => { throw new Error('SQLITE_CORRUPT') }
    const rows = await connect()
    const stream = await rows.selectTopStream('items', {}, 2)
    await stream.cursor.start()
    await expect(stream.cursor.read()).rejects.toThrow('SQLITE_CORRUPT')
  })

  it('closes open cursors and the connection once, then terminates the thread', async () => {
    const { driver, cursor, worker, connect } = setup()
    const rows = await connect()
    await rows.selectTopStream('items', {}, 2)
    await Promise.all([rows.disconnect(), rows.disconnect()])
    expect(cursor.cancelled).toBe(true)
    expect(driver.disconnect).toHaveBeenCalledOnce()
    expect(worker.terminated).toBe(1)
    await expect(rows.execute('SELECT 1')).rejects.toThrow('SQLite transfer worker closed')
  })

  it('terminates the thread and rethrows when the connection fails', async () => {
    const { worker, driver, connect } = setup({ connect: vi.fn(async () => { throw new Error('SQLITE_CANTOPEN') }) })
    await expect(connect()).rejects.toThrow('SQLITE_CANTOPEN')
    expect(driver.disconnect).toHaveBeenCalledOnce()
    expect(worker.terminated).toBe(1)
  })

  it('never reports a commit or rollback as successful when the thread dies mid-transaction', async () => {
    let started!: () => void
    const commitStarted = new Promise<void>(resolve => { started = resolve })
    const { worker, connect } = setup({ commitTransaction: vi.fn(() => { started(); return new Promise<void>(() => {}) }) })
    const rows = await connect()
    const commit = rows.commitTransaction()
    await commitStarted
    worker.emit('exit', 1)
    await expect(commit).rejects.toThrow('SQLite transfer worker stopped (exit code 1)')
    await expect(rows.rollbackTransaction()).rejects.toThrow('SQLite transfer worker stopped (exit code 1)')
    await rows.disconnect()
    expect(worker.terminated).toBe(1)
  })
})
