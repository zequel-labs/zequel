import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { TableObjectType } from '@main/types'
import { streamSqlStatements } from '@main/services/backup/native/sql-stream'
import type { ClickHouseDriver } from '@main/db/clickhouse'

/** Stream server-generated INSERT batches with backpressure, including schema-only views. */
export const writeClickHouseArchive = async (
  driver: ClickHouseDriver, database: string, tables: string[], path: string,
  signal?: AbortSignal, onProgress?: (bytes: number) => void,
): Promise<void> => {
  const objects = await driver.getTables(database, '')
  const selected = tables.length ? objects.filter(table => tables.includes(table.name)) : objects
  selected.sort((a, b) => Number(a.type === TableObjectType.View) - Number(b.type === TableObjectType.View))
  let bytes = 0
  const chunks = async function* (): AsyncGenerator<string | Buffer> {
    for (const table of selected) {
      signal?.throwIfAborted()
      const ddl = (await driver.getTableDDL(table.name)).trim()
      if (!ddl) throw new Error(`Missing definition for ${table.name}`)
      // Keep references within this backup relative to the selected destination database.
      const localDdl = ddl.replace(/'(?:\\.|''|[^'\\])*'|(`(?:``|[^`])+`|"(?:""|[^"])+"|[A-Za-z_][\w]*)\s*\./g, (match, identifier: string | undefined) => {
        if (!identifier) return match
        const name = identifier.startsWith('`') ? identifier.slice(1, -1).replace(/``/g, '`')
          : identifier.startsWith('"') ? identifier.slice(1, -1).replace(/""/g, '"') : identifier
        return name === database ? '' : match
      })
      const schema = localDdl.replace(/;$/, '') + ';\n'
      bytes += Buffer.byteLength(schema); onProgress?.(bytes); yield schema
      if (table.type === TableObjectType.View) continue
      const identifier = '`' + table.name.replace(/`/g, '``') + '`'
      const name = table.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const stream = await driver.queryRawStream(`SELECT * FROM ${identifier} SETTINGS output_format_sql_insert_table_name = '${name}', output_format_sql_insert_max_batch_size = 500 FORMAT SQLInsert`, signal)
      try {
        for await (const value of stream) {
          signal?.throwIfAborted()
          const chunk = value as Buffer
          bytes += chunk.length; onProgress?.(bytes); yield chunk
        }
        yield '\n'
      } finally { stream.destroy() }
    }
  }
  await pipeline(chunks(), createWriteStream(path, { flags: 'wx', mode: 0o600 }), { signal })
}

export const restoreClickHouseArchive = async (
  driver: ClickHouseDriver, path: string, signal?: AbortSignal,
  onProgress?: (statements: number) => void,
): Promise<number> => {
  let count = 0
  const readStatements = (): AsyncGenerator<string> => streamSqlStatements(createReadStream(path, { encoding: 'utf8', signal }))
  // Validate framing before creating or inserting anything.
  for await (const _statement of readStatements()) signal?.throwIfAborted()
  let cancellation: Promise<boolean> | undefined
  const cancel = (): void => { cancellation = driver.cancelQuery().catch(() => false) }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    for await (const statement of readStatements()) {
      signal?.throwIfAborted()
      const result = await driver.execute(statement)
      signal?.throwIfAborted()
      if (result.error) throw new Error(`Restore stopped after ${count} statements: ${result.error}`)
      count++
      onProgress?.(count)
    }
    return count
  } finally {
    signal?.removeEventListener('abort', cancel)
    await cancellation
  }
}
