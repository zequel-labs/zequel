import mysql from 'mysql2'
import { BaseCursor } from './BaseCursor'

export class MySQLCursor extends BaseCursor {
  private connection: mysql.Connection | null = null
  private rowBuffer: Record<string, unknown>[] = []
  private end = false
  private error: Error | null = null
  private resolve: (() => void) | null = null

  constructor(
    private readonly connectionConfig: Record<string, unknown>,
    private readonly query: string,
    private readonly params: unknown[],
    chunkSize: number
  ) {
    super(chunkSize)
  }

  async start(): Promise<void> {
    this.connection = mysql.createConnection(this.connectionConfig as mysql.ConnectionOptions)

    await new Promise<void>((resolve, reject) => {
      this.connection!.connect((err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const q = this.connection.query({ sql: this.query, values: this.params })

    q.on('result', (row: Record<string, unknown>) => {
      this.rowBuffer.push(row)
      if (this.rowBuffer.length >= this.chunkSize) {
        this.connection!.pause()
        this.resolve?.()
      }
    })

    q.on('end', () => {
      this.end = true
      this.resolve?.()
    })

    q.on('error', (err: Error) => {
      this.error = err
      this.resolve?.()
    })
  }

  async read(): Promise<Record<string, unknown>[]> {
    if (!this.end && !this.error && this.rowBuffer.length < this.chunkSize) {
      await new Promise<void>((r) => { this.resolve = r })
      this.resolve = null
    }

    if (this.error) throw this.error

    const rows = this.rowBuffer
    this.rowBuffer = []

    if (!this.end && this.connection) {
      this.connection.resume()
    }

    return rows
  }

  async cancel(): Promise<void> {
    this.end = true
    this.resolve?.()
    if (this.connection) {
      this.connection.destroy()
      this.connection = null
    }
  }
}
