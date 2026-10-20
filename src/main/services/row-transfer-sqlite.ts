import { serialize, deserialize } from 'node:v8'
import { BaseCursor } from '@main/db/cursors/BaseCursor'
import type { DatabaseDriver } from '@main/db/base'
import { DatabaseType, type ConnectionConfig } from '@main/types'

/** The driver surface used by file import/export, which can live outside the main thread. */
export type RowTransferDriver = Pick<DatabaseDriver, 'type' | 'supportsTransactions' | 'getColumns' | 'getTableDDL' |
  'execute' | 'insertRow' | 'cancelQuery' | 'beginTransaction' | 'commitTransaction' | 'rollbackTransaction' |
  'selectTopStream' | 'disconnect'>

type DriverMethod = 'getColumns' | 'getTableDDL' | 'execute' | 'insertRow' | 'cancelQuery' |
  'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'
type Method = DriverMethod | 'connect' | 'disconnect' | 'selectTopStream' | 'cursorStart' | 'cursorRead' | 'cursorCancel'

interface Request { id: number; method: Method; args: unknown[] }
type Response = { id: number; result: unknown } | { id: number; error: string }

/** The subset of MessagePort and Worker used by both ends. */
export interface RowTransferPort {
  postMessage(value: Uint8Array): void
  on(event: 'message', listener: (value: Uint8Array) => void): unknown
}

export interface RowTransferWorker extends RowTransferPort {
  on(event: 'message', listener: (value: Uint8Array) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  terminate(): Promise<number>
}

// v8 serialization keeps Buffer, BigInt and Date values exactly as the driver returned them.
const encode = (value: Request | Response): Uint8Array => serialize(value)
const decode = <T>(value: Uint8Array): T => deserialize(Buffer.from(value.buffer, value.byteOffset, value.byteLength)) as T

// Each message crosses the Electron main loop, so blocks amortize its latency while staying bounded.
const BLOCK_ROWS = 10_000
const BLOCK_BYTES = 4 * 1024 * 1024
const estimateBytes = (row: Record<string, unknown>): number => {
  let bytes = 0
  for (const value of Object.values(row)) {
    if (typeof value === 'string') bytes += value.length * 2
    else if (value instanceof Uint8Array) bytes += value.byteLength
    else bytes += 8
  }
  return bytes
}

const DRIVER_METHODS = new Set<string>(['getColumns', 'getTableDDL', 'execute', 'insertRow', 'cancelQuery',
  'beginTransaction', 'commitTransaction', 'rollbackTransaction'])

/** Worker side: owns the SQLite connection and its cursors, and runs requests strictly in order. */
export const serveSQLiteRows = (port: RowTransferPort, createDriver: () => DatabaseDriver): void => {
  let driver: DatabaseDriver | undefined
  const cursors = new Map<number, BaseCursor>()
  let nextCursor = 1
  let queue = Promise.resolve()
  const cursor = (id: unknown): BaseCursor => {
    const found = cursors.get(Number(id))
    if (!found) throw new Error('Unknown SQLite transfer cursor')
    return found
  }
  const run = async ({ method, args }: Request): Promise<unknown> => {
    if (method === 'connect') {
      if (driver) throw new Error('SQLite transfer worker is already connected')
      driver = createDriver()
      await driver.connect(args[0] as ConnectionConfig)
      return undefined
    }
    if (!driver) throw new Error('SQLite transfer worker is not connected')
    switch (method) {
      case 'selectTopStream': {
        const stream = await driver.selectTopStream(args[0] as string, args[1] as Parameters<DatabaseDriver['selectTopStream']>[1], args[2] as number)
        const id = nextCursor++
        cursors.set(id, stream.cursor)
        return { columns: stream.columns, totalRows: stream.totalRows, cursor: id, chunkSize: stream.cursor.chunkSize }
      }
      case 'cursorStart': return cursor(args[0]).start()
      case 'cursorRead': {
        // Several cursor chunks per message, bounded by rows and approximate bytes.
        const source = cursor(args[0])
        const rows: Record<string, unknown>[] = []
        let bytes = 0
        while (rows.length < BLOCK_ROWS && bytes < BLOCK_BYTES) {
          const chunk = await source.read()
          if (!chunk.length) break
          for (const row of chunk) { rows.push(row); bytes += estimateBytes(row) }
        }
        return rows
      }
      case 'cursorCancel': {
        const found = cursors.get(Number(args[0]))
        cursors.delete(Number(args[0]))
        return found?.cancel()
      }
      case 'disconnect': {
        for (const open of cursors.values()) await open.cancel().catch(() => {})
        cursors.clear()
        return driver.disconnect()
      }
      default: {
        if (!DRIVER_METHODS.has(method)) throw new Error(`Unsupported SQLite transfer request: ${method}`)
        const call = driver[method as DriverMethod] as (...values: unknown[]) => Promise<unknown>
        return call.apply(driver, args)
      }
    }
  }
  port.on('message', message => {
    const request = decode<Request>(message)
    queue = queue.then(async () => {
      let response: Response
      try { response = { id: request.id, result: await run(request) } } catch (error) {
        response = { id: request.id, error: error instanceof Error ? error.message : String(error) }
      }
      port.postMessage(encode(response))
    })
  })
}

class WorkerCursor extends BaseCursor {
  private buffered: Record<string, unknown>[] = []
  private next: Promise<Record<string, unknown>[]> | undefined
  private done = false

  constructor(private readonly call: (method: Method, args: unknown[]) => Promise<unknown>, private readonly id: number, chunkSize: number) {
    super(chunkSize)
  }

  private fetch(): void {
    // Prefetch one block so the worker reads while the caller writes the previous rows.
    this.next = this.call('cursorRead', [this.id]) as Promise<Record<string, unknown>[]>
    this.next.catch(() => {})
  }

  async start(): Promise<void> {
    await this.call('cursorStart', [this.id])
    this.fetch()
  }

  async read(): Promise<Record<string, unknown>[]> {
    while (this.buffered.length < this.chunkSize && this.next) {
      const block = await this.next
      this.next = undefined
      if (!block.length) this.done = true
      else {
        this.buffered = this.buffered.length ? this.buffered.concat(block) : block
        if (!this.done) this.fetch()
      }
    }
    return this.buffered.splice(0, this.chunkSize)
  }

  async cancel(): Promise<void> {
    this.done = true
    this.next = undefined
    this.buffered = []
    await this.call('cursorCancel', [this.id])
  }
}

/**
 * Main side: a SQLite driver whose statements, COMMIT and fsync run in a worker thread,
 * so a slow disk can no longer stall IPC, menus or other windows.
 */
export const connectSQLiteRowWorker = async (worker: RowTransferWorker, config: ConnectionConfig): Promise<RowTransferDriver> => {
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  let nextId = 1
  let stopped: Error | undefined
  let closing: Promise<void> | undefined
  const stop = (error: Error): void => {
    stopped ??= error
    for (const request of pending.values()) request.reject(stopped)
    pending.clear()
  }
  worker.on('message', message => {
    const response = decode<Response>(message)
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if ('error' in response) request.reject(new Error(response.error))
    else request.resolve(response.result)
  })
  worker.on('error', error => stop(new Error(`SQLite transfer worker failed: ${error.message}`)))
  // A worker that exits mid-COMMIT leaves the outcome to SQLite's journal; never report it as rolled back.
  worker.on('exit', code => stop(new Error(`SQLite transfer worker stopped (exit code ${code})`)))
  const call = (method: Method, args: unknown[] = []): Promise<unknown> => {
    if (stopped) return Promise.reject(stopped)
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      worker.postMessage(encode({ id, method, args }))
    })
  }
  const disconnect = (): Promise<void> => closing ??= (async () => {
    try { if (!stopped) await call('disconnect') } finally {
      stop(new Error('SQLite transfer worker closed'))
      await worker.terminate()
    }
  })()
  try { await call('connect', [config]) } catch (error) {
    await disconnect().catch(() => {})
    throw error
  }
  return {
    type: DatabaseType.SQLite,
    supportsTransactions: true,
    getColumns: (...args) => call('getColumns', args) as ReturnType<DatabaseDriver['getColumns']>,
    getTableDDL: (...args) => call('getTableDDL', args) as ReturnType<DatabaseDriver['getTableDDL']>,
    execute: (...args) => call('execute', args) as ReturnType<DatabaseDriver['execute']>,
    insertRow: (...args) => call('insertRow', args) as ReturnType<DatabaseDriver['insertRow']>,
    cancelQuery: () => call('cancelQuery') as ReturnType<DatabaseDriver['cancelQuery']>,
    beginTransaction: () => call('beginTransaction') as Promise<void>,
    commitTransaction: () => call('commitTransaction') as Promise<void>,
    rollbackTransaction: () => call('rollbackTransaction') as Promise<void>,
    selectTopStream: async (...args) => {
      const stream = await call('selectTopStream', args) as { columns: Awaited<ReturnType<DatabaseDriver['selectTopStream']>>['columns']; totalRows: number; cursor: number; chunkSize: number }
      return { columns: stream.columns, totalRows: stream.totalRows, cursor: new WorkerCursor(call, stream.cursor, stream.chunkSize) }
    },
    disconnect,
  }
}
