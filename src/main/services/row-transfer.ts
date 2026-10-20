import { randomUUID } from 'node:crypto'

export interface RowTransferProgress {
  id: string
  label?: string
  status: 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
  phase: 'validating' | 'transferring' | 'finalizing'
  processed: number
  total?: number
  applied: number
  bytes?: number
  startedAt: number
  finishedAt?: number
  error?: string
}

interface RowTransfer {
  owner: number
  controller: AbortController
  progress: RowTransferProgress
}
const operations = new Map<string, RowTransfer>()

export const rowTransfers = {
  list: (): RowTransferProgress[] => [...operations.values()].map(operation => ({ ...operation.progress })),
  cancelOperation: (id: string): void => {
    const operation = operations.get(id)
    if (operation) rowTransfers.cancel(operation.owner, id)
  },
  hasRunning: (): boolean => [...operations.values()].some(operation => !operation.progress.finishedAt),
  cancelAllAndWait: async (): Promise<void> => {
    for (const [id, operation] of operations) rowTransfers.cancel(operation.owner, id)
    const deadline = Date.now() + 15000
    while (rowTransfers.hasRunning()) {
      if (Date.now() >= deadline) throw new Error('Transfers are still stopping. Keep Zequel open until cleanup completes.')
      await new Promise<void>(resolve => setTimeout(resolve, 50))
    }
  },
  start: (owner: number, requestedId?: string): RowTransfer => {
    const id = requestedId || randomUUID()
    if (typeof id !== 'string' || id.length > 100 || operations.has(id)) throw new Error('Invalid or duplicate operation ID')
    for (const [key, operation] of operations) {
      if (operations.size < 100) break
      if (operation.progress.finishedAt) operations.delete(key)
    }
    const operation: RowTransfer = {
      owner, controller: new AbortController(),
      progress: { id, status: 'running', phase: 'validating', processed: 0, applied: 0, startedAt: Date.now() },
    }
    operations.set(id, operation)
    return operation
  },
  get: (owner: number, id: string): RowTransferProgress | undefined => {
    const operation = operations.get(id)
    if (operation && operation.owner !== owner) throw new Error('Not authorized to access this operation')
    return operation ? { ...operation.progress } : undefined
  },
  cancel: (owner: number, id: string): void => {
    const operation = operations.get(id)
    if (!operation) return
    if (operation.owner !== owner) throw new Error('Not authorized to cancel this operation')
    if (operation.progress.finishedAt) return
    operation.progress.status = 'cancelling'
    operation.controller.abort(new Error('Operation cancelled'))
  },
  finish: (operation: RowTransfer, error?: unknown): void => {
    operation.progress.status = operation.controller.signal.aborted ? 'cancelled' : error ? 'failed' : 'completed'
    operation.progress.finishedAt = Date.now()
    if (error) operation.progress.error = error instanceof Error ? error.message : String(error)
  },
}
