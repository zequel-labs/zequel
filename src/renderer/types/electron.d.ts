import type { ConnectionConfig, SavedConnection } from './connection'
import type { QueryResult, QueryHistoryItem } from './query'
import type { Database, Table, Column, Index, ForeignKey, DataOptions, DataResult } from './table'

export interface SavedQuery {
  id: number
  connectionId?: string
  name: string
  sql: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface ElectronAPI {
  connections: {
    list(): Promise<SavedConnection[]>
    get(id: string): Promise<SavedConnection | null>
    save(config: ConnectionConfig): Promise<SavedConnection>
    delete(id: string): Promise<boolean>
    test(config: ConnectionConfig): Promise<{ success: boolean; error: string | null }>
    connect(id: string): Promise<boolean>
    disconnect(id: string): Promise<boolean>
  }
  query: {
    execute(connectionId: string, sql: string, params?: unknown[]): Promise<QueryResult>
    cancel(connectionId: string): Promise<boolean>
  }
  schema: {
    databases(connectionId: string): Promise<Database[]>
    tables(connectionId: string, database: string, schema?: string): Promise<Table[]>
    columns(connectionId: string, table: string): Promise<Column[]>
    indexes(connectionId: string, table: string): Promise<Index[]>
    foreignKeys(connectionId: string, table: string): Promise<ForeignKey[]>
    tableDDL(connectionId: string, table: string): Promise<string>
    tableData(connectionId: string, table: string, options: DataOptions): Promise<DataResult>
  }
  history: {
    list(connectionId?: string, limit?: number, offset?: number): Promise<QueryHistoryItem[]>
    add(connectionId: string, sql: string, executionTime?: number, rowCount?: number, error?: string): Promise<QueryHistoryItem>
    clear(connectionId?: string): Promise<number>
    delete(id: number): Promise<boolean>
  }
  savedQueries: {
    list(connectionId?: string): Promise<SavedQuery[]>
    get(id: number): Promise<SavedQuery | null>
    save(name: string, sql: string, connectionId?: string, description?: string): Promise<SavedQuery>
    update(id: number, updates: { name?: string; sql?: string; description?: string }): Promise<SavedQuery | null>
    delete(id: number): Promise<boolean>
  }
  app: {
    getVersion(): Promise<string>
    openExternal(url: string): Promise<void>
    showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
