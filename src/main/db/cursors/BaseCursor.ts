import type { ColumnInfo } from '@main/types'

export interface StreamResult {
  columns: ColumnInfo[]
  totalRows: number
  cursor: BaseCursor
}

export abstract class BaseCursor {
  constructor(public readonly chunkSize: number) {}

  abstract start(): Promise<void>
  abstract read(): Promise<Record<string, unknown>[]>
  abstract cancel(): Promise<void>
}
