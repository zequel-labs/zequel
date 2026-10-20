import { randomUUID } from 'node:crypto'
import type { DatabaseDriver } from '@main/db/base'

/** Copy through our own connection so the CLI never reopens an editor's locked file. */
export const createDuckDBSnapshot = async (driver: DatabaseDriver, path: string, signal?: AbortSignal): Promise<void> => {
  const alias = `zequel_backup_${randomUUID().replace(/-/g, '')}`
  const execute = async (sql: string): Promise<Awaited<ReturnType<DatabaseDriver['execute']>>> => {
    const result = await driver.execute(sql)
    if (result.error) throw new Error(result.error)
    return result
  }
  signal?.throwIfAborted()
  const current = await execute('SELECT current_database() AS name')
  const source = current.rows[0]?.name
  if (typeof source !== 'string') throw new Error('Unable to identify the DuckDB source database')
  const cancel = (): void => { void driver.cancelQuery().catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  let attached = false
  try {
    signal?.throwIfAborted()
    await execute(`ATTACH '${path.replace(/'/g, "''")}' AS "${alias}"`)
    attached = true
    signal?.throwIfAborted()
    await execute(`COPY FROM DATABASE "${source.replace(/"/g, '""')}" TO "${alias}"`)
    signal?.throwIfAborted()
  } finally {
    signal?.removeEventListener('abort', cancel)
    if (attached) await execute(`DETACH "${alias}"`)
  }
}
