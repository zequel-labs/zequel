import type { DataResult, DataFilter } from '@/types/table'
import type { CellChange } from '@/types/query'

export interface DataGridState {
  sorting: { id: string; desc: boolean }[]
  columnSizing: Record<string, number>
  columnOrder: string[]
  columnVisibility: Record<string, boolean>
  pendingChanges: [string, CellChange][]
  pendingNewRows: Record<string, unknown>[]
  pendingDeleteRows: number[]
}

export interface TableViewState {
  dataResult: DataResult | null
  offset: number
  filters: DataFilter[]
  error: string | null
  grid?: DataGridState
}

export interface ViewViewState {
  dataResult: DataResult | null
  offset: number
  filters: DataFilter[]
  error: string | null
  grid?: DataGridState
}

export interface QueryViewState {
  runMode: 'current' | 'all'
}

export type ViewState = TableViewState | ViewViewState | QueryViewState
